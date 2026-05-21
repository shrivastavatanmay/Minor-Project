import os
import io
import base64
import uuid
from datetime import datetime, timezone

import numpy as np
import cv2
from PIL import Image
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

app = Flask(__name__)
CORS(app)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    return response

# ─── Supabase Client ────────────────────────────────────────────────────────
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY) if SUPABASE_URL and SUPABASE_KEY else None
admin_supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_KEY else supabase

# ─── Stress Mapping Configuration ───────────────────────────────────────────
EMOTION_WEIGHTS = {
    "angry": 1.0,     # Max stress
    "disgust": 0.8,
    "fear": 0.8,
    "sad": 0.6,
    "surprise": 0.4,
    "neutral": 0.2,
    "happy": 0.0,     # Min stress
}

STRESS_THRESHOLDS = {
    "low": 0.35,      # 0% - 35% is Low
    "moderate": 0.7,   # 35% - 70% is Moderate, >70% is High
}

DEMO_THERAPISTS = [
    {
        "id": "demo-therapist-demot",
        "full_name": "demot",
        "email": "demot@mindease.demo",
        "therapy_name": "MindEase Wellness Center",
        "specialty": "stress_management",
        "years_experience": 6,
        "verified": True,
    }
]

# Fallback in-memory consult request storage used when DB table is missing.
CONSULT_REQUESTS_FALLBACK = []
MESSAGES_FALLBACK = []


def is_missing_consult_table_error(message: str) -> bool:
    text = (message or "").lower()
    return (
        "consult_requests" in text and "does not exist" in text
    ) or ("pgrst205" in text) or ("public.consult_requests" in text) or ("getaddrinfo" in text) or ("failed to establish" in text) or ("pgrst301" in text) or ("22p02" in text)

def is_missing_messages_table_error(message: str) -> bool:
    text = (message or "").lower()
    return (
        "chat_messages" in text and "does not exist" in text
    ) or ("pgrst205" in text) or ("public.chat_messages" in text) or ("getaddrinfo" in text) or ("failed to establish" in text) or ("pgrst301" in text) or ("22p02" in text)


def enrich_consult_rows_with_students(rows, db_client):
    """Attach student profile fields to consult request rows."""
    rows = rows or []
    if not rows:
        return []

    student_ids = [r.get("student_id") for r in rows if r.get("student_id")]
    user_map = {}
    if student_ids:
        try:
            user_res = (
                db_client.table("users")
                .select("id, full_name, email")
                .in_("id", list(set(student_ids)))
                .execute()
            )
            user_map = {u["id"]: u for u in (user_res.data or [])}
        except Exception:
            user_map = {}

    enriched = []
    for row in rows:
        user = user_map.get(row.get("student_id"), {})
        enriched.append({
            **row,
            "student_name": row.get("student_name") or user.get("full_name") or "Student",
            "student_email": row.get("student_email") or user.get("email") or "Unknown",
        })
    return enriched


def build_patient_summary(student_id, fallback_name=None, fallback_email=None, consult_status=None):
    """Build therapist patient card data with latest stress and journals."""
    db = get_supabase()

    name = fallback_name or "Student"
    email = fallback_email or "Unknown"
    try:
        user_res = db.table("users").select("id, full_name, email").eq("id", student_id).limit(1).execute()
        if user_res.data:
            name = user_res.data[0].get("full_name") or name
            email = user_res.data[0].get("email") or email
    except Exception:
        pass

    latest_stress = {"score": 0, "level": "Low", "created_at": None}
    try:
        stress_res = (
            db.table("stress_scores")
            .select("score, level, created_at")
            .eq("user_id", student_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if stress_res.data:
            latest_stress = stress_res.data[0]
    except Exception:
        pass

    recent_journals = []
    try:
        journal_res = (
            db.table("journals")
            .select("id, content, sentiment_score, created_at")
            .eq("user_id", student_id)
            .order("created_at", desc=True)
            .limit(3)
            .execute()
        )
        recent_journals = journal_res.data or []
    except Exception:
        pass

    return {
        "id": student_id,
        "full_name": name,
        "email": email,
        "consult_status": consult_status or "accepted",
        "latest_stress": latest_stress,
        "recent_journals": recent_journals,
    }

# ─── Lazy-load the Hugging Face Model ───────────────────────────────────────

def get_supabase():
    auth_header = request.headers.get("Authorization")
    if auth_header and SUPABASE_URL and SUPABASE_KEY:
        from supabase import ClientOptions
        return create_client(SUPABASE_URL, SUPABASE_KEY, options=ClientOptions(headers={"Authorization": auth_header}))
    return supabase


def get_admin_supabase():
    """Use service-role client when configured; otherwise preserve request auth context."""
    if SUPABASE_SERVICE_KEY:
        return admin_supabase
    return get_supabase()

emotion_pipeline = None


def get_emotion_pipeline():
    """Lazy-load the Hugging Face emotion detection model."""
    global emotion_pipeline
    if emotion_pipeline is None:
        from transformers import pipeline
        emotion_pipeline = pipeline(
            "image-classification",
            model="dima806/facial_emotions_image_detection",
        )
    return emotion_pipeline


# ─── Helper Functions ────────────────────────────────────────────────────────
def compute_stress_score(emotions: dict) -> float:
    """Compute a weighted stress score from emotion probabilities."""
    score = 0.0
    for emotion, probability in emotions.items():
        weight = EMOTION_WEIGHTS.get(emotion.lower(), 0.3)
        score += probability * weight
    return round(score, 4)


def classify_stress(score: float) -> str:
    """Classify the stress score into Low / Moderate / High."""
    if score < STRESS_THRESHOLDS["low"]:
        return "Low"
    elif score < STRESS_THRESHOLDS["moderate"]:
        return "Moderate"
    else:
        return "High"


def decode_base64_image(image_data: str) -> Image.Image:
    """Decode a base64 image string into a PIL Image."""
    if "," in image_data:
        image_data = image_data.split(",")[1]
    image_bytes = base64.b64decode(image_data)
    return Image.open(io.BytesIO(image_bytes)).convert("RGB")


# ─── Face Cropping ───────────────────────────────────────────────────────────
face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')


def crop_face(pil_image: Image.Image) -> Image.Image:
    """Detect and crop the largest face from the image using OpenCV Haar Cascades.
    Returns the cropped face as a PIL Image, or the original image if no face found."""
    cv_image = np.array(pil_image)
    gray = cv2.cvtColor(cv_image, cv2.COLOR_RGB2GRAY)
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))

    if len(faces) == 0:
        return pil_image  # fallback: use full image

    # Pick the largest face
    x, y, w, h = max(faces, key=lambda f: f[2] * f[3])

    # Add 20% padding around the face for context
    pad = int(0.2 * max(w, h))
    x1 = max(0, x - pad)
    y1 = max(0, y - pad)
    x2 = min(cv_image.shape[1], x + w + pad)
    y2 = min(cv_image.shape[0], y + h + pad)

    face_crop = cv_image[y1:y2, x1:x2]
    return Image.fromarray(face_crop)


# ════════════════════════════════════════════════════════════════════════════
#  API ROUTES
# ════════════════════════════════════════════════════════════════════════════

# ─── Health ──────────────────────────────────────────────────────────────────
@app.route("/api/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "ok",
        "message": "MindEase API is running",
        "supabase_connected": supabase is not None,
    })


# ════════════════════════════════════════════════════════════════════════════
#  STRESS ANALYSIS
# ════════════════════════════════════════════════════════════════════════════

@app.route("/api/analyze", methods=["POST"])
def analyze_frame():
    """
    Accepts a base64-encoded webcam frame. Returns emotion probabilities,
    stress score and level, and persists to Supabase.
    """
    data = request.get_json()
    if not data or "image" not in data:
        return jsonify({"error": "No image data provided"}), 400

    try:
        image = decode_base64_image(data["image"])
        face_image = crop_face(image)  # Crop face for better accuracy
        pipe = get_emotion_pipeline()
        results = pipe(face_image)
        emotions = {r["label"].lower(): round(r["score"], 4) for r in results}

        stress_score = compute_stress_score(emotions)
        stress_level = classify_stress(stress_score)

        user_id = data.get("user_id")

        # Persist to Supabase if user is authenticated
        if supabase and user_id:
            # Save emotion log
            get_supabase().table("emotion_logs").insert({
                "user_id": user_id,
                "angry": emotions.get("angry", 0),
                "disgust": emotions.get("disgust", 0),
                "fear": emotions.get("fear", 0),
                "happy": emotions.get("happy", 0),
                "sad": emotions.get("sad", 0),
                "surprise": emotions.get("surprise", 0),
                "neutral": emotions.get("neutral", 0),
                "stress_score": stress_score,
            }).execute()

            # Save stress score
            get_supabase().table("stress_scores").insert({
                "user_id": user_id,
                "score": stress_score,
                "level": stress_level,
            }).execute()

        return jsonify({
            "emotions": emotions,
            "stress_score": stress_score,
            "stress_level": stress_level,
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/analyze-batch", methods=["POST"])
def analyze_batch():
    """
    Accepts a list of base64 frames, returns temporally-aggregated stress
    and persists the average to Supabase.
    """
    data = request.get_json()
    if not data or "frames" not in data:
        return jsonify({"error": "No frames provided"}), 400

    try:
        pipe = get_emotion_pipeline()
        all_scores = []
        all_emotions = []

        for frame_data in data["frames"]:
            image = decode_base64_image(frame_data)
            face_image = crop_face(image)  # Crop face for better accuracy
            results = pipe(face_image)
            emotions = {r["label"].lower(): round(r["score"], 4) for r in results}
            score = compute_stress_score(emotions)
            all_scores.append(score)
            all_emotions.append(emotions)

        avg_score = round(float(np.mean(all_scores)), 4)
        stress_level = classify_stress(avg_score)

        # Aggregate emotions (average across frames)
        avg_emotions = {}
        if all_emotions:
            keys = all_emotions[0].keys()
            for key in keys:
                avg_emotions[key] = round(float(np.mean([e.get(key, 0) for e in all_emotions])), 4)

        user_id = data.get("user_id")

        # Persist aggregated results
        if supabase and user_id:
            get_supabase().table("emotion_logs").insert({
                "user_id": user_id,
                **{k: v for k, v in avg_emotions.items()},
                "stress_score": avg_score,
            }).execute()

            get_supabase().table("stress_scores").insert({
                "user_id": user_id,
                "score": avg_score,
                "level": stress_level,
            }).execute()

        return jsonify({
            "average_stress_score": avg_score,
            "stress_level": stress_level,
            "emotions": avg_emotions,
            "frame_count": len(all_scores),
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ════════════════════════════════════════════════════════════════════════════
#  STRESS HISTORY
# ════════════════════════════════════════════════════════════════════════════

@app.route("/api/stress-history/<user_id>", methods=["GET"])
def get_stress_history(user_id):
    """Returns the last N stress scores for a user for chart display."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        limit = int(request.args.get("limit", 30))
        result = (
            get_supabase().table("stress_scores")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return jsonify({"data": result.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/emotion-logs/<user_id>", methods=["GET"])
def get_emotion_logs(user_id):
    """Returns the last N emotion logs for detailed breakdown."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        limit = int(request.args.get("limit", 30))
        result = (
            get_supabase().table("emotion_logs")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return jsonify({"data": result.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ════════════════════════════════════════════════════════════════════════════
#  JOURNALS
# ════════════════════════════════════════════════════════════════════════════

@app.route("/api/journals/<user_id>", methods=["GET"])
def get_journals(user_id):
    """Get all journal entries for a user."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        limit = int(request.args.get("limit", 20))
        result = (
            get_supabase().table("journals") 
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return jsonify({"data": result.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/journals", methods=["POST"])
def create_journal():
    """Create a new journal entry."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    data = request.get_json()
    if not data or "user_id" not in data or "content" not in data:
        return jsonify({"error": "user_id and content are required"}), 400

    try:
        # Simple keyword-based sentiment estimation
        content = data["content"].lower()
        positive_words = ["happy", "grateful", "excited", "good", "great", "wonderful", "amazing", "joy", "love", "peaceful", "calm", "relaxed"]
        negative_words = ["sad", "angry", "frustrated", "stressed", "anxious", "worried", "depressed", "tired", "exhausted", "overwhelmed", "fear", "lonely"]

        words = content.split()
        pos_count = sum(1 for w in words if w in positive_words)
        neg_count = sum(1 for w in words if w in negative_words)
        total = pos_count + neg_count
        if total > 0:
            sentiment = round((pos_count - neg_count) / total, 2)
            sentiment = max(-1.0, min(1.0, sentiment))
        else:
            sentiment = 0.0

        result = get_supabase().table("journals").insert({
            "user_id": data["user_id"],
            "content": data["content"],
            "sentiment_score": sentiment,
        }).execute()

        return jsonify({"data": result.data, "sentiment_score": sentiment}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/journals/<journal_id>", methods=["DELETE"])
def delete_journal(journal_id):
    """Delete a journal entry."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        get_supabase().table("journals").delete().eq("id", journal_id).execute()
        return jsonify({"message": "Journal entry deleted"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



# ════════════════════════════════════════════════════════════════════════════
#  THERAPISTS
# ════════════════════════════════════════════════════════════════════════════

@app.route("/api/therapists", methods=["GET"])
def list_therapists():
    """List all verified therapists for student browsing."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        specialty = request.args.get("specialty")
        include_pending = request.args.get("include_pending", "false").lower() == "true"
        db = get_admin_supabase()
        query = db.table("therapists").select(
            "id, full_name, email, therapy_name, specialty, years_experience, verified"
        )

        if specialty:
            query = query.eq("specialty", specialty)

        if not include_pending:
            # Default behavior for student browsing: verified therapists only.
            query = query.eq("verified", True)

        result = query.execute()
        data = result.data or []

        # Fallback for demo mode when DB is empty or RLS blocks profile visibility.
        if not data:
            fallback = DEMO_THERAPISTS
            if specialty:
                fallback = [t for t in fallback if t.get("specialty") == specialty]
            return jsonify({"data": fallback, "fallback": True})

        return jsonify({"data": data})
    except Exception as e:
        message = str(e).lower()
        if "42501" in message or "row-level security" in message or "getaddrinfo" in message or "failed to establish" in message or "pgrst301" in message or "22p02" in message:
            fallback = DEMO_THERAPISTS
            if specialty:
                fallback = [t for t in fallback if t.get("specialty") == specialty]
            return jsonify({"data": fallback, "fallback": True, "warning": "Demo fallback active"}), 200
        return jsonify({"error": str(e)}), 500


@app.route("/api/therapists/<therapist_id>", methods=["GET"])
def get_therapist(therapist_id):
    """Get a single therapist's profile."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        db = get_admin_supabase()
        result = (
            db.table("therapists")
            .select("id, full_name, email, therapy_name, specialty, years_experience, verified")
            .eq("id", therapist_id)
            .single()
            .execute()
        )
        return jsonify({"data": result.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ─── Consultation Requests ────────────────────────────────────────────────
@app.route("/api/consult-requests", methods=["POST"])
def create_consult_request():
    """Create a consultation request from a student to a therapist."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    data = request.get_json() or {}
    student_id = data.get("student_id")
    therapist_id = data.get("therapist_id")
    student_name = data.get("student_name")
    student_email = data.get("student_email")

    if not student_id or not therapist_id:
        return jsonify({"error": "student_id and therapist_id are required"}), 400

    try:
        existing = (
            get_supabase().table("consult_requests")
            .select("id")
            .eq("student_id", student_id)
            .eq("therapist_id", therapist_id)
            .eq("status", "pending")
            .limit(1)
            .execute()
        )
        if existing.data:
            return jsonify({"message": "Request already pending", "data": existing.data[0]}), 200

        result = get_supabase().table("consult_requests").insert({
            "student_id": student_id,
            "therapist_id": therapist_id,
            "status": "pending",
        }).execute()
        return jsonify({"data": result.data}), 201
    except Exception as e:
        message = str(e)
        if is_missing_consult_table_error(message):
            pending = [
                r for r in CONSULT_REQUESTS_FALLBACK
                if r["student_id"] == student_id and r["therapist_id"] == therapist_id and r["status"] == "pending"
            ]
            if pending:
                return jsonify({"message": "Request already pending", "data": [pending[0]], "fallback": True}), 200

            row = {
                "id": str(uuid.uuid4()),
                "student_id": student_id,
                "therapist_id": therapist_id,
                "status": "pending",
                "student_name": student_name,
                "student_email": student_email,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            CONSULT_REQUESTS_FALLBACK.append(row)
            return jsonify({"data": [row], "fallback": True, "warning": "consult_requests table is not configured"}), 201
        return jsonify({"error": message}), 500


@app.route("/api/consult-requests/therapist/<therapist_id>", methods=["GET"])
def list_consult_requests(therapist_id):
    """List consultation requests for a therapist."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        status = request.args.get("status", "pending")
        query = (
            get_supabase().table("consult_requests")
            .select("id, student_id, therapist_id, status, created_at")
            .eq("therapist_id", therapist_id)
            .order("created_at", desc=True)
        )

        if status:
            query = query.eq("status", status)

        result = query.execute()
        enriched = enrich_consult_rows_with_students(result.data or [], get_supabase())
        return jsonify({"data": enriched})
    except Exception as e:
        message = str(e)
        if is_missing_consult_table_error(message):
            rows = [r for r in CONSULT_REQUESTS_FALLBACK if r["therapist_id"] == therapist_id]
            if status:
                rows = [r for r in rows if r.get("status") == status]

            # Demo fallback mode: if no strict therapist match exists, return all pending rows
            # so therapist dashboards can still display incoming requests.
            if not rows:
                rows = CONSULT_REQUESTS_FALLBACK
                if status:
                    rows = [r for r in rows if r.get("status") == status]

            enriched = enrich_consult_rows_with_students(rows, get_supabase())
            return jsonify({"data": enriched, "fallback": True, "warning": "consult_requests table is not configured"}), 200
        return jsonify({"error": message}), 500


@app.route("/api/consult-requests/<request_id>", methods=["PUT"])
def update_consult_request(request_id):
    """Update consultation request status to accepted or rejected."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    data = request.get_json() or {}
    status = (data.get("status") or "").lower()

    if status not in ["accepted", "rejected", "pending"]:
        return jsonify({"error": "status must be one of: pending, accepted, rejected"}), 400

    try:
        result = (
            get_supabase().table("consult_requests")
            .update({"status": status})
            .eq("id", request_id)
            .execute()
        )
        return jsonify({"data": result.data})
    except Exception as e:
        message = str(e)
        if is_missing_consult_table_error(message):
            for item in CONSULT_REQUESTS_FALLBACK:
                if item["id"] == request_id:
                    item["status"] = status
                    return jsonify({"data": [item], "fallback": True, "warning": "consult_requests table is not configured"}), 200
            return jsonify({"error": "Consult request not found", "fallback": True}), 404
        return jsonify({"error": message}), 500


@app.route("/api/therapist/patients/<therapist_id>", methods=["GET"])
def get_therapist_patients(therapist_id):
    """Return therapist patients with stress + recent journals.
    Includes accepted requests by default, and pending as fallback for demo continuity.
    """
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        accepted_only = request.args.get("accepted_only", "false").lower() == "true"
        statuses = ["accepted"] if accepted_only else ["accepted", "pending"]

        req_res = (
            get_supabase().table("consult_requests")
            .select("student_id, status")
            .eq("therapist_id", therapist_id)
            .order("created_at", desc=True)
            .execute()
        )
        rows = [r for r in (req_res.data or []) if r.get("status") in statuses]
        student_ids = []
        status_map = {}
        seen = set()
        for row in rows:
            sid = row.get("student_id")
            if sid and sid not in seen:
                seen.add(sid)
                student_ids.append(sid)
                status_map[sid] = row.get("status") or "accepted"

        patients = [build_patient_summary(sid, consult_status=status_map.get(sid, "accepted")) for sid in student_ids]
        return jsonify({"data": patients})
    except Exception as e:
        message = str(e)
        if is_missing_consult_table_error(message):
            accepted_only = request.args.get("accepted_only", "false").lower() == "true"
            statuses = ["accepted"] if accepted_only else ["accepted", "pending"]
            accepted = [r for r in CONSULT_REQUESTS_FALLBACK if r.get("status") in statuses]

            # In fallback mode, preserve therapist experience by showing accepted patients
            # even if therapist IDs are demo/mismatched.
            if therapist_id:
                filtered = [r for r in accepted if r.get("therapist_id") == therapist_id]
                accepted = filtered if filtered else accepted

            unique = {}
            for row in accepted:
                sid = row.get("student_id")
                if sid and sid not in unique:
                    unique[sid] = row

            patients = []
            for sid, meta in unique.items():
                patients.append(
                    build_patient_summary(
                        sid,
                        fallback_name=meta.get("student_name"),
                        fallback_email=meta.get("student_email"),
                        consult_status=meta.get("status") or "accepted",
                    )
                )

            # Keep therapist UI usable in pure demo mode when no consult rows exist yet.
            if not patients:
                patients = [
                    {
                        "id": "demo-student-1",
                        "full_name": "Demo Student",
                        "email": "student@mindease.demo",
                        "consult_status": "pending",
                        "latest_stress": {"score": 0.42, "level": "Moderate", "created_at": datetime.now(timezone.utc).isoformat()},
                        "recent_journals": [
                            {
                                "id": "demo-journal-1",
                                "content": "Feeling pressure from deadlines, but trying breathing and short breaks.",
                                "sentiment_score": -0.1,
                                "created_at": datetime.now(timezone.utc).isoformat(),
                            }
                        ],
                    }
                ]

            return jsonify({"data": patients, "fallback": True, "warning": "consult_requests table is not configured"}), 200
        return jsonify({"error": message}), 500


# ════════════════════════════════════════════════════════════════════════════
#  USER PROFILE
# ════════════════════════════════════════════════════════════════════════════

@app.route("/api/profile/<user_id>", methods=["GET"])
def get_profile(user_id):
    """Get a user or therapist profile."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        # Try users table
        result = get_supabase().table("users").select("*").eq("id", user_id).execute()
        if result.data:
            return jsonify({"data": result.data[0], "role": "student"})

        # Try therapists table
        result = get_supabase().table("therapists").select("*").eq("id", user_id).execute()
        if result.data:
            return jsonify({"data": result.data[0], "role": "therapist"})

        return jsonify({"error": "Profile not found"}), 404
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/profile/<user_id>", methods=["PUT"])
def update_profile(user_id):
    """Update a user or therapist profile."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    data = request.get_json()
    role = data.pop("role", "student")

    try:
        table = "users" if role == "student" else "therapists"
        result = get_supabase().table(table).update(data).eq("id", user_id).execute()
        return jsonify({"data": result.data})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ════════════════════════════════════════════════════════════════════════════
#  STRESS QUESTIONNAIRE
# ════════════════════════════════════════════════════════════════════════════

QUESTIONNAIRES_FALLBACK = {}

@app.route("/api/questionnaire/<user_id>", methods=["GET"])
def get_questionnaire(user_id):
    """Check if a user has already completed the stress questionnaire."""
    if not supabase:
        return jsonify({"completed": user_id in QUESTIONNAIRES_FALLBACK}), 200

    try:
        result = (
            get_supabase().table("questionnaire_responses")
            .select("*")
            .eq("user_id", user_id)
            .execute()
        )
        completed = len(result.data) > 0 if result.data else False
        return jsonify({"completed": completed, "data": result.data[0] if completed else None})
    except Exception as e:
        message = str(e).lower()
        if "getaddrinfo" in message or "failed to establish" in message or "does not exist" in message or "pgrst301" in message or "22p02" in message:
            return jsonify({"completed": user_id in QUESTIONNAIRES_FALLBACK}), 200
        return jsonify({"error": str(e)}), 500


@app.route("/api/questionnaire", methods=["POST"])
def save_questionnaire():
    """Save a user's stress questionnaire responses."""
    data = request.get_json()
    if not data or "user_id" not in data or "responses" not in data:
        return jsonify({"error": "user_id and responses are required"}), 400

    if not supabase:
        QUESTIONNAIRES_FALLBACK[data["user_id"]] = data["responses"]
        return jsonify({"message": "Questionnaire saved locally (demo mode)", "baseline_stress": 0}), 201

    try:
        responses = data["responses"]  # dict of {"q1": 3, "q2": 5, ...}
        values = list(responses.values())
        # Compute baseline stress: average of all answers (1-5) mapped to 0-1
        avg = sum(values) / len(values) if values else 0
        baseline_score = round((avg - 1) / 4, 4)  # map 1-5 to 0.0-1.0

        result = get_supabase().table("questionnaire_responses").insert({
            "user_id": data["user_id"],
            "responses": responses,
            "baseline_stress": baseline_score,
        }).execute()
        
        # Insert as first stress score
        try:
            stress_level = classify_stress(baseline_score)
            get_supabase().table("stress_scores").insert({
                "user_id": data["user_id"],
                "score": baseline_score,
                "level": stress_level,
            }).execute()
        except Exception as e:
            print(f"Failed to save baseline stress score: {e}")

        return jsonify({"data": result.data, "baseline_stress": baseline_score}), 201
    except Exception as e:
        message = str(e).lower()
        if "getaddrinfo" in message or "failed to establish" in message or "does not exist" in message or "pgrst301" in message or "22p02" in message:
            QUESTIONNAIRES_FALLBACK[data["user_id"]] = data["responses"]
            return jsonify({"message": "Questionnaire saved locally (demo fallback)", "baseline_stress": 0}), 201
        return jsonify({"error": str(e)}), 500


# ════════════════════════════════════════════════════════════════════════════
#  DASHBOARD SUMMARY
# ════════════════════════════════════════════════════════════════════════════

@app.route("/api/dashboard/<user_id>", methods=["GET"])
def get_dashboard_summary(user_id):
    """
    Returns a complete dashboard summary: latest stress, weekly average,
    recent journals, and emotion breakdown.
    """
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        # Latest stress scores (last 7)
        stress_result = (
            get_supabase().table("stress_scores")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(7)
            .execute()
        )

        # Journal count
        journal_result = (
            get_supabase().table("journals")
            .select("id", count="exact")
            .eq("user_id", user_id)
            .execute()
        )

        # Recent emotions
        emotion_result = (
            get_supabase().table("emotion_logs")
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )

        scores = stress_result.data or []
        weekly_avg = round(float(np.mean([s["score"] for s in scores])), 2) if scores else 0

        latest_stress = scores[0] if scores else {"score": 0, "level": "Low"}
        latest_emotion = emotion_result.data[0] if emotion_result.data else None

        return jsonify({
            "current_stress": {
                "score": latest_stress["score"],
                "level": latest_stress["level"],
            },
            "weekly_average": weekly_avg,
            "journal_count": journal_result.count if journal_result.count else 0,
            "stress_trend": scores,
            "latest_emotions": latest_emotion,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/therapist/students", methods=["GET"])
def get_therapist_students():
    """Returns all students and their latest stress scores for therapists."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        db = get_admin_supabase()
        # Fetch all students from users table
        users_result = db.table("users").select("*").execute()
        students = users_result.data or []

        # For each student, find their most recent stress score
        for student in students:
            score_result = (
                db.table("stress_scores")
                .select("score, level, created_at")
                .eq("user_id", student["id"])
                .order("created_at", desc=True)
                .limit(1)
                .execute()
            )
            if score_result.data:
                student["latest_stress"] = score_result.data[0]
            else:
                student["latest_stress"] = {"score": 0, "level": "Low"}

        return jsonify({"data": students})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# ════════════════════════════════════════════════════════════════════════════
#  RECOMMENDATIONS ENGINE
# ════════════════════════════════════════════════════════════════════════════

@app.route("/api/recommendations/<user_id>", methods=["GET"])
def get_recommendations(user_id):
    """Generate personalized recommendations based on recent stress levels."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    try:
        result = (
            get_supabase().table("stress_scores")
            .select("score, level")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(5)
            .execute()
        )

        scores = result.data or []
        avg_score = float(np.mean([s["score"] for s in scores])) if scores else 0

        recommendations = []

        if avg_score >= 0.6:
            # High stress
            recommendations = [
                {"icon": "🧘", "title": "Guided Meditation", "description": "Try a 10-minute guided meditation session to calm your mind."},
                {"icon": "👨‍⚕️", "title": "Talk to a Therapist", "description": "Your stress levels have been high. Consider booking a session with a professional."},
                {"icon": "😴", "title": "Prioritize Sleep", "description": "Aim for 7-8 hours of quality sleep to help your body recover from stress."},
                {"icon": "📵", "title": "Digital Detox", "description": "Take a 30-minute break from screens to reduce mental fatigue."},
            ]
        elif avg_score >= 0.3:
            # Moderate stress
            recommendations = [
                {"icon": "🚶", "title": "Take a Short Walk", "description": "A 15-minute walk outdoors can significantly improve your mood."},
                {"icon": "📝", "title": "Journal Your Thoughts", "description": "Writing about your feelings helps process emotions effectively."},
                {"icon": "🎵", "title": "Listen to Music", "description": "Calming music can lower cortisol levels and reduce anxiety."},
                {"icon": "💧", "title": "Stay Hydrated", "description": "Dehydration can worsen stress symptoms. Drink some water!"},
            ]
        else:
            # Low stress
            recommendations = [
                {"icon": "🎉", "title": "Keep It Up!", "description": "Your stress levels are looking great. Maintain your healthy habits."},
                {"icon": "📝", "title": "Journal Your Day", "description": "Record what made today good so you can replicate positive patterns."},
                {"icon": "🧘", "title": "Try Deep Breathing", "description": "Even when stress is low, breathing exercises help maintain balance."},
            ]

        return jsonify({"recommendations": recommendations, "average_score": round(avg_score, 2)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ════════════════════════════════════════════════════════════════════════════
#  REAL-TIME CHAT
# ════════════════════════════════════════════════════════════════════════════

@app.route("/api/messages/<other_user_id>", methods=["GET"])
def get_messages(other_user_id):
    """Fetch chat history between the current authorized user and another user."""
    auth_header = request.headers.get("Authorization")
    if not supabase or not auth_header:
        return jsonify({"error": "Database not connected or Unauthorized"}), 503

    current_user_id = request.args.get("current_user_id")
    if not current_user_id:
        return jsonify({"error": "current_user_id query param is required"}), 400

    try:
        # Fetch where (sender=current AND receiver=other) OR (sender=other AND receiver=current)
        res = get_supabase().table("chat_messages").select("*").or_(
            f"and(sender_id.eq.{current_user_id},receiver_id.eq.{other_user_id}),and(sender_id.eq.{other_user_id},receiver_id.eq.{current_user_id})"
        ).order("created_at", desc=False).execute()
        return jsonify({"data": res.data})
    except Exception as e:
        message = str(e)
        if is_missing_messages_table_error(message):
            history = [
                m for m in MESSAGES_FALLBACK
                if (m["sender_id"] == current_user_id and m["receiver_id"] == other_user_id) or
                   (m["sender_id"] == other_user_id and m["receiver_id"] == current_user_id)
            ]
            return jsonify({"data": history, "fallback": True})
        return jsonify({"error": message}), 500


@app.route("/api/messages", methods=["POST"])
def send_message():
    """Send a new message to another user."""
    if not supabase:
        return jsonify({"error": "Database not connected"}), 503

    data = request.get_json() or {}
    sender_id = data.get("sender_id")
    receiver_id = data.get("receiver_id")
    content = data.get("content")

    if not sender_id or not receiver_id or not content:
        return jsonify({"error": "sender_id, receiver_id, and content are required"}), 400

    try:
        res = get_supabase().table("chat_messages").insert({
            "sender_id": sender_id,
            "receiver_id": receiver_id,
            "content": content
        }).execute()
        return jsonify({"data": res.data}), 201
    except Exception as e:
        message = str(e)
        if is_missing_messages_table_error(message):
            row = {
                "id": str(uuid.uuid4()),
                "sender_id": sender_id,
                "receiver_id": receiver_id,
                "content": content,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            MESSAGES_FALLBACK.append(row)
            return jsonify({"data": [row], "fallback": True}), 201
        return jsonify({"error": message}), 500


if __name__ == "__main__":
    print("MindEase Backend starting...")
    print(f"   Supabase: {'Connected' if supabase else 'Not configured'}")
    app.run(debug=True, use_reloader=False, port=5000)

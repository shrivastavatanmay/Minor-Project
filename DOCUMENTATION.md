# 📘 Full Documentation

## 1. Introduction

This system monitors student stress using AI-based facial analysis, questionnaire scoring, and behavioral tracking.

---

## 2. Problem Statement

Current systems:
- Detect emotions only
- Lack real-time monitoring
- Do not integrate therapist support

---

## 3. System Modules

- Stress Assessment
- Facial Stress Detection
- Journal & Chatbot
- Therapist Interaction
- Cloud Database (Supabase)

---

## 4. Stress Detection

Facial expressions are processed using CNN / Hugging Face models.

---

## 5. Stress Mapping

stress_score =
(angry * 0.8) +
(sad * 0.6) +
(neutral * 0.3) +
(happy * 0.1)

---

## 6. Classification

Low / Moderate / High Stress

---

## 7. Datasets

- CK+
- JAFFE
- TFEID
- AffectNet
- FER2013

---

## 8. Tech Stack

- React
- Node / Flask
- Supabase
- Hugging Face
- OpenCV

---

## 9. Privacy

- No image storage
- Secure authentication
- Consent-based monitoring

---

## 10. Conclusion

The system provides a scalable, AI-driven solution for student well-being monitoring.
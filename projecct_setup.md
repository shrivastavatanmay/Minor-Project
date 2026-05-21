# ⚙️ Project Setup

## Install Dependencies

pip install opencv-python torch torchvision transformers

---

## Emotion Model (Hugging Face)

from transformers import pipeline

model = pipeline("image-classification", model="dima806/facial_emotions_image_detection")

---

## Webcam Integration

import cv2

cap = cv2.VideoCapture(0)

---

## Supabase Setup

Create tables:

- users
- stress_scores
- emotion_logs
- journals
- therapists

---

## Fusion Logic

final_score =
(stress_score * 0.6) +
(emotion_score * 0.4)

---

## Deployment

Frontend → Vercel  
Backend → Render  
Database → Supabase  

---

## Goal

Build a privacy-aware emotional monitoring system.
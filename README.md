# 🧠 Intelligent Emotional Well-Being Monitoring System

## 📌 Overview

This project is an AI-driven emotional well-being monitoring platform designed for college students. It combines stress assessment, facial analysis, journaling, and therapist interaction.

Unlike traditional systems, this project focuses on **stress levels (Low, Moderate, High)** instead of generic emotions.

---

## 🎯 Objectives

- Detect student stress levels using AI
- Combine questionnaire + facial analysis
- Provide journaling and chatbot support
- Enable therapist interaction
- Ensure privacy-first architecture

---

## 🧠 Stress Detection Layer

The system captures facial data via webcam and processes it using deep learning models.

Instead of detecting emotions directly, it maps them into stress levels.

### Stress Levels:
- Low Stress
- Moderate Stress
- High Stress

---

## ⚙️ Stress Mapping Logic

### Emotion Output Example:
happy: 0.2  
neutral: 0.3  
sad: 0.3  
angry: 0.2  

### Formula:

stress_score =
(angry * 0.8) +
(sad * 0.6) +
(neutral * 0.3) +
(happy * 0.1)

### Classification:

if score < 0.3 → Low  
0.3 – 0.6 → Moderate  
> 0.6 → High  

---

## ⏱️ Temporal Aggregation

Predictions are averaged over multiple frames for accuracy.

---

## ⚙️ Tech Stack

Frontend: React  
Backend: Node.js / Flask  
AI: Hugging Face, OpenCV  
Database: Supabase  
IDE: Antigravity  

---

## 🔐 Privacy

- No image storage  
- Only stress labels stored  
- Secure authentication  

---

## 🚀 Features

- **Real-time stress detection:** Analyzes facial expressions via webcam to map stress levels.
- **Dashboard visualization:** Interactive charts tracking your emotional trends over time.
- **Journal tracking:** Daily sentiment analysis for your text journal entries.
- **Therapist interaction:** Submit consultation requests to verified professionals.
- **Real-Time Live Chat:** Instant, secure messaging directly between students and therapists within the application.

---

## 🛠️ Setup Instructions

1. Ensure you have configured your `.env` files in both the `frontend` and `backend` directories.
2. Run database setup scripts (e.g., `chat_setup.sql`) in your Supabase SQL editor. *(Note: The system contains built-in Python fallbacks so the app will still function in 'demo mode' even if tables are missing!)*
3. Use the supplied Terminal commands to run both the Frontend (`npm run dev`) and Backend (`python app.py`) simultaneously.

---

## 📌 Note

This system does not diagnose mental health conditions. It provides guidance only.
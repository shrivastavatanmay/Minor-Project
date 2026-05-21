#  Intelligent Emotional Well-Being Monitoring System

## 📌 Overview

This project is an AI-driven emotional well-being monitoring platform designed for college students. It combines stress assessment, facial analysis, journaling, and therapist interaction.

Unlike traditional systems, this project focuses on **stress levels (Low, Moderate, High)** instead of generic emotions.

---

##  Objectives

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

### Frontend
- React.js
- HTML5
- CSS3
- JavaScript
- Vite

### Backend
- Flask
- REST APIs
- Python

### AI / ML
- OpenCV
- Hugging Face
- Deep Learning Models

### Database
- Supabase (PostgreSQL)

### Tools
- GitHub
- VS Code
- Postman

## 🔐 Privacy

- No image storage  
- Only stress labels stored  
- Secure authentication  

---
## 🏗️ System Architecture

The system follows a full-stack architecture consisting of:

1. Frontend Layer (React)
2. Backend API Layer (Flask)
3. AI Emotion Detection Module
4. Supabase Database Layer
5. Authentication Module

The frontend communicates with backend APIs through HTTP requests. The backend processes stress assessments, journal entries, therapist requests, and emotion detection results before storing them in the database.

##  Features

- Real-time stress detection
- Facial emotion analysis
- Stress questionnaire system
- Student dashboard
- Therapist dashboard
- Journal sentiment tracking
- Consultation request management
- Live chat support
- Role-based authentication
- Secure data handling
---
## 📂 Project Structure

```bash
frontend/
 ├── src/
 ├── pages/
 ├── components/

backend/
 ├── app.py
 ├── test_api.py
 ├── requirements.txt


## 🛠️ Setup Instructions

1. Ensure you have configured your `.env` files in both the `frontend` and `backend` directories.
2. Run database setup scripts (e.g., `chat_setup.sql`) in your Supabase SQL editor. *(Note: The system contains built-in Python fallbacks so the app will still function in 'demo mode' even if tables are missing!)*
3. Use the supplied Terminal commands to run both the Frontend (`npm run dev`) and Backend (`python app.py`) simultaneously.

---
## 🔮 Future Enhancements

- Cloud deployment
- Mobile application support
- Advanced AI stress prediction
- Real-time therapist video consultation
- Wearable sensor integration
- Multi-language support
## 📌 Note

This system does not diagnose mental health conditions. It provides guidance only.

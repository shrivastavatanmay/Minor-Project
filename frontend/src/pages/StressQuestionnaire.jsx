import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './StressQuestionnaire.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const QUESTIONS = [
  {
    text: "Do you feel pressure to succeed academically or financially?",
    options: ["Not at all", "Rarely", "Sometimes", "Often", "All the time"],
  },
  {
    text: "How often do you feel you must hide your emotions?",
    options: ["Never", "Rarely", "Sometimes", "Frequently", "Always"],
  },
  {
    text: "Do you feel responsible for solving problems on your own?",
    options: ["Never", "Occasionally", "Somewhat", "Mostly", "Completely"],
  },
  {
    text: "How often do you feel mentally exhausted but continue working?",
    options: ["Never", "Once a week", "A few times a week", "Almost daily", "Every day"],
  },
  {
    text: "Do you feel compared to others (friends, siblings)?",
    options: ["Not at all", "Rarely", "Sometimes", "Often", "Constantly"],
  },
  {
    text: "How often do you feel anxious about your future career?",
    options: ["Never", "Rarely", "Occasionally", "Frequently", "All the time"],
  },
  {
    text: "Do you avoid talking about your stress with others?",
    options: ["Never", "Rarely", "Sometimes", "Usually", "Always"],
  },
  {
    text: "Do you feel pressure to appear strong even when struggling?",
    options: ["Not at all", "A little", "Moderately", "A lot", "Extremely"],
  },
  {
    text: "How often do you feel irritated or frustrated without clear reason?",
    options: ["Never", "Rarely", "Sometimes", "Often", "Very often"],
  },
  {
    text: "Do you feel like you're falling behind in life?",
    options: ["Not at all", "Slightly", "Somewhat", "Quite a bit", "Definitely"],
  },
  {
    text: "How often do you experience sleep issues due to overthinking?",
    options: ["Never", "Rarely", "A few nights/week", "Most nights", "Every night"],
  },
  {
    text: "Do you feel pressure to be financially independent early?",
    options: ["Not at all", "A little", "Somewhat", "Quite a bit", "Very much"],
  },
  {
    text: "How often do you lose interest in things you used to enjoy?",
    options: ["Never", "Rarely", "Sometimes", "Often", "Almost always"],
  },
  {
    text: "Do you suppress emotions like sadness or fear?",
    options: ["Never", "Rarely", "Sometimes", "Often", "Always"],
  },
  {
    text: "How often do you feel overwhelmed but don't express it?",
    options: ["Never", "Rarely", "Sometimes", "Frequently", "Always"],
  },
  {
    text: "Do you use distractions (games, phone, etc.) to avoid stress?",
    options: ["Never", "Occasionally", "Sometimes", "Often", "Constantly"],
  },
  {
    text: "How often do you feel isolated even when around people?",
    options: ["Never", "Rarely", "Sometimes", "Often", "Very often"],
  },
  {
    text: "Do you feel judged when you talk about mental health?",
    options: ["Not at all", "A little", "Somewhat", "A lot", "Extremely"],
  },
  {
    text: "How often do you feel burnout from studies or expectations?",
    options: ["Never", "Rarely", "Sometimes", "Frequently", "Constantly"],
  },
  {
    text: "Do you feel you have no one to rely on emotionally?",
    options: ["Not at all", "Slightly", "Somewhat", "Mostly", "Completely"],
  },
];

const QUESTIONS_PER_PAGE = 5;

async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = { ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(url, { ...options, headers });
}

export default function StressQuestionnaire() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const [responses, setResponses] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const totalPages = Math.ceil(QUESTIONS.length / QUESTIONS_PER_PAGE);
  const startIdx = page * QUESTIONS_PER_PAGE;
  const currentQuestions = QUESTIONS.slice(startIdx, startIdx + QUESTIONS_PER_PAGE);
  const answeredCount = Object.keys(responses).length;
  const progress = (answeredCount / QUESTIONS.length) * 100;

  function handleSelect(qIndex, value) {
    setResponses(prev => ({ ...prev, [`q${qIndex + 1}`]: value }));
  }

  async function handleSubmit() {
    if (answeredCount < QUESTIONS.length) {
      setError('Please answer all 20 questions before submitting.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const currentUser = user || sessionData?.session?.user;
      if (!currentUser) {
        setError('User session not found. Please log in again.');
        setSubmitting(false);
        return;
      }

      const res = await apiFetch(`${BACKEND_URL}/api/questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUser.id, responses }),
      });

      if (res.ok) {
        navigate('/dashboard');
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to save questionnaire.');
      }
    } catch (err) {
      setError('Could not connect to the server.');
    }
    setSubmitting(false);
  }

  const allCurrentAnswered = currentQuestions.every((_, i) => responses[`q${startIdx + i + 1}`] !== undefined);
  const isLastPage = page === totalPages - 1;

  return (
    <div className="questionnaire-page">
      <div className="card-glass questionnaire-container">
        <div className="questionnaire-header">
          <h1>🧠 Stress Self-Assessment</h1>
          <p>Help us understand your baseline stress level. This takes about 3 minutes.</p>
        </div>

        <div className="progress-bar-container">
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-label">{answeredCount} of {QUESTIONS.length} answered</div>
        </div>

        {currentQuestions.map((question, i) => {
          const qIdx = startIdx + i;
          const selected = responses[`q${qIdx + 1}`];
          return (
            <div key={qIdx} className="card-glass question-card">
              <span className="question-number">Q{qIdx + 1}</span>
              <p className="question-text">{question.text}</p>
              <div className="likert-scale">
                {question.options.map((label, optIdx) => (
                  <button
                    key={optIdx}
                    className={`likert-option ${selected === (optIdx + 1) ? 'selected' : ''}`}
                    onClick={() => handleSelect(qIdx, optIdx + 1)}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        {error && <div className="auth-error">{error}</div>}

        <div className="questionnaire-nav">
          <button
            className="btn btn-secondary"
            onClick={() => setPage(p => p - 1)}
            disabled={page === 0}
          >
            ← Previous
          </button>

          {isLastPage ? (
            <button
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={submitting || answeredCount < QUESTIONS.length}
            >
              {submitting ? 'Submitting...' : '✅ Submit Assessment'}
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={() => setPage(p => p + 1)}
              disabled={!allCurrentAnswered}
            >
              Next →
            </button>
          )}
        </div>

        <div className="questionnaire-footer">
          Your responses are confidential and will only be used to personalize your experience.
        </div>
      </div>
    </div>
  );
}

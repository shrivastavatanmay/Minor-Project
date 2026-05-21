import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './Landing.css';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="landing">
      {/* Navbar */}
      <nav className="navbar">
        <div className="container flex items-center justify-between">
          <div className="logo" onClick={() => navigate('/')}>
            <span className="logo-icon">🧠</span>
            <span className="logo-text">MindEase</span>
          </div>
          <div className="nav-links">
            <a href="#features">Features</a>
            <a href="#about">About</a>
            <a href="#testimonials">Testimonials</a>
            <button className="btn btn-primary" onClick={() => navigate('/login')}>Get Started</button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="hero">
        <div className="hero-bg"></div>
        <div className="container hero-content">
          <div className="hero-text animate-fadeIn">
            <span className="hero-badge">AI-Powered Wellness</span>
            <h1>Your Mental Well-Being <span className="gradient-text">Matters</span></h1>
            <p className="hero-subtitle">
              An intelligent monitoring system that uses facial analysis, journaling, and AI to understand your stress levels and connect you with professional support.
            </p>
            <div className="hero-actions">
              <button className="btn btn-primary btn-lg" onClick={() => navigate('/register/student')}>
                I'm a Student
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => navigate('/register/therapist')}>
                I'm a Therapist
              </button>
            </div>
          </div>
          <div className="hero-visual animate-fadeIn">
            <div className="hero-card card-glass">
              <div className="pulse-circle"></div>
              <div className="hero-stat">
                <span className="stat-label">Current Stress</span>
                <span className="stress-badge low">● Low</span>
              </div>
              <div className="hero-stat">
                <span className="stat-label">Weekly Avg</span>
                <span className="stat-value">0.28</span>
              </div>
              <div className="mini-chart">
                <div className="bar" style={{height: '40%'}}></div>
                <div className="bar" style={{height: '55%'}}></div>
                <div className="bar" style={{height: '30%'}}></div>
                <div className="bar" style={{height: '65%'}}></div>
                <div className="bar" style={{height: '45%'}}></div>
                <div className="bar" style={{height: '35%'}}></div>
                <div className="bar active" style={{height: '25%'}}></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="features" id="features">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Features</span>
            <h2>Everything You Need for Better Mental Health</h2>
            <p>Our platform combines cutting-edge AI with compassionate care.</p>
          </div>
          <div className="features-grid grid grid-3 gap-6">
            <div className="feature-card card-glass animate-fadeIn">
              <div className="feature-icon">📷</div>
              <h3>AI Stress Detection</h3>
              <p>Real-time facial analysis using advanced AI models to detect and classify your stress levels accurately.</p>
            </div>
            <div className="feature-card card-glass animate-fadeIn" style={{animationDelay: '0.1s'}}>
              <div className="feature-icon">📝</div>
              <h3>Smart Journaling</h3>
              <p>Express your thoughts through guided journaling with sentiment analysis and mood tracking over time.</p>
            </div>
            <div className="feature-card card-glass animate-fadeIn" style={{animationDelay: '0.2s'}}>
              <div className="feature-icon">👨‍⚕️</div>
              <h3>Therapist Connect</h3>
              <p>Connect with verified mental health professionals who specialize in student stress and anxiety.</p>
            </div>
          </div>
        </div>
      </section>

      {/* About */}
      <section className="about" id="about">
        <div className="container">
          <div className="about-content">
            <div className="about-text">
              <span className="section-badge">About MindEase</span>
              <h2>Built for Students, By Students</h2>
              <p>
                We understand the unique pressures college students face. MindEase is designed specifically for the academic environment, providing privacy-first monitoring that respects your data while giving you actionable insights about your mental well-being.
              </p>
              <div className="about-stats">
                <div className="about-stat">
                  <span className="stat-number">100%</span>
                  <span className="stat-label">Privacy First</span>
                </div>
                <div className="about-stat">
                  <span className="stat-number">24/7</span>
                  <span className="stat-label">AI Monitoring</span>
                </div>
                <div className="about-stat">
                  <span className="stat-number">50+</span>
                  <span className="stat-label">Verified Therapists</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="testimonials" id="testimonials">
        <div className="container">
          <div className="section-header">
            <span className="section-badge">Testimonials</span>
            <h2>What Students Say</h2>
          </div>
          <div className="testimonials-grid grid grid-3 gap-6">
            <div className="testimonial-card card">
              <p>"MindEase helped me realize my stress patterns during exams. The AI detection is remarkably accurate."</p>
              <div className="testimonial-author">
                <div className="author-avatar">A</div>
                <div>
                  <strong>Anika Sharma</strong>
                  <span>Computer Science, 3rd Year</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card card">
              <p>"The journal feature combined with therapist access made a real difference in managing my anxiety."</p>
              <div className="testimonial-author">
                <div className="author-avatar">R</div>
                <div>
                  <strong>Rahul Mehta</strong>
                  <span>Mechanical Eng., 2nd Year</span>
                </div>
              </div>
            </div>
            <div className="testimonial-card card">
              <p>"I love that no images are stored. It feels safe and the weekly reports are incredibly insightful."</p>
              <div className="testimonial-author">
                <div className="author-avatar">P</div>
                <div>
                  <strong>Priya Desai</strong>
                  <span>Psychology, 4th Year</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-brand">
              <div className="logo">
                <span className="logo-icon">🧠</span>
                <span className="logo-text">MindEase</span>
              </div>
              <p>Intelligent emotional well-being monitoring for a healthier campus life.</p>
            </div>
            <div className="footer-links">
              <div className="footer-col">
                <h4>Platform</h4>
                <a href="#features">Features</a>
                <a href="#about">About</a>
                <a href="#testimonials">Testimonials</a>
              </div>
              <div className="footer-col">
                <h4>Support</h4>
                <a href="#">Help Center</a>
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            <p>© 2026 MindEase. All rights reserved. This system does not diagnose mental health conditions.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

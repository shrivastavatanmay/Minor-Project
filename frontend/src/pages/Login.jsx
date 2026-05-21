import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './Auth.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function Login() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [role, setRole] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { data: signInData, error: signInError } = await signIn(email, password);
    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    if (role === 'therapist') {
      navigate('/therapist-dashboard');
      setLoading(false);
      return;
    }

    // For students, check if questionnaire is completed
    const userId = signInData?.user?.id || signInData?.session?.user?.id;
    if (userId) {
      try {
        const token = signInData?.session?.access_token;
        const res = await fetch(`${BACKEND_URL}/api/questionnaire/${userId}`, {
          headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        });
        const json = await res.json();
        if (json.completed) {
          navigate('/dashboard');
          setLoading(false);
          return;
        }
      } catch (err) {
        console.error('Questionnaire check failed:', err);
      }
      // If questionnaire NOT completed, or check failed → show questionnaire
      navigate('/questionnaire');
    } else {
      navigate('/dashboard');
    }
    setLoading(false);
  }


  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-left-ornament"></div>
          <h2>Your sanctuary for inner peace starts here.</h2>
          <p>Join thousands of students taking control of their mental well-being.</p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-container card-glass">
          <div className="logo" onClick={() => navigate('/')}>
            <span className="logo-icon">🧠</span>
            <span className="logo-text">MindEase</span>
          </div>

          <div className="role-tabs">
            <button
              className={`role-tab ${role === 'student' ? 'active' : ''}`}
              onClick={() => setRole('student')}
            >
              Student
            </button>
            <button
              className={`role-tab ${role === 'therapist' ? 'active' : ''}`}
              onClick={() => setRole('therapist')}
            >
              Therapist
            </button>
          </div>

          <h3>Welcome Back</h3>
          <p className="auth-subtitle">Sign in to continue your wellness journey</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                className="input-field"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Login'}
            </button>
          </form>

          <div className="auth-links">
            <a href="#">Forgot Password?</a>
            <p>Don't have an account? <a onClick={() => navigate(`/register/${role}`)}>Register</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './Auth.css';

export default function StudentRegister() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    collegeId: '', age: '', gender: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!agreed) {
      setError('Please agree to the terms and conditions');
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await signUp(form.email, form.password);

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Insert user profile
    if (data?.user) {
      const { error: profileError } = await supabase.from('users').insert({
        id: data.user.id,
        full_name: form.fullName,
        email: form.email,
        college_id: form.collegeId,
        age: parseInt(form.age),
        gender: form.gender,
        role: 'student'
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    navigate('/questionnaire');
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-left-ornament"></div>
          <h2>Start your wellness journey today.</h2>
          <p>Create an account to access AI-powered stress monitoring and connect with professional therapists.</p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-container card-glass">
          <div className="logo" onClick={() => navigate('/')}>
            <span className="logo-icon">🧠</span>
            <span className="logo-text">MindEase</span>
          </div>
          <h3>Create Your Student Account</h3>
          <p className="auth-subtitle">Fill in your details to get started</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label>Full Name</label>
              <input type="text" className="input-field" name="fullName" placeholder="Enter your full name" value={form.fullName} onChange={handleChange} required />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input type="email" className="input-field" name="email" placeholder="Enter your email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Password</label>
                <input type="password" className="input-field" name="password" placeholder="Create password" value={form.password} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Confirm Password</label>
                <input type="password" className="input-field" name="confirmPassword" placeholder="Confirm password" value={form.confirmPassword} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-group">
              <label>College ID</label>
              <input type="text" className="input-field" name="collegeId" placeholder="Enter your college ID" value={form.collegeId} onChange={handleChange} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Age</label>
                <input type="number" className="input-field" name="age" placeholder="Age" value={form.age} onChange={handleChange} min="16" max="100" required />
              </div>
              <div className="form-group">
                <label>Gender</label>
                <select className="select-field" name="gender" value={form.gender} onChange={handleChange} required>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_to_say">Prefer not to say</option>
                </select>
              </div>
            </div>

            <div className="checkbox-group">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <label>I agree to the Terms and Conditions</label>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? 'Creating account...' : 'Register'}
            </button>
          </form>

          <div className="auth-links">
            <p>Already have an account? <a onClick={() => navigate('/login')}>Login</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}

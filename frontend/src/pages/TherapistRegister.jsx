import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './Auth.css';

export default function TherapistRegister() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    fullName: '', email: '', password: '', confirmPassword: '',
    therapyName: '', specialty: '', aadharNumber: '', yearsExperience: ''
  });
  const [proofFile, setProofFile] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
  }

  function handleFileChange(e) {
    if (e.target.files[0]) {
      setProofFile(e.target.files[0]);
    }
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
    if (form.aadharNumber.length !== 12) {
      setError('Aadhar number must be 12 digits');
      return;
    }

    setLoading(true);
    const { data, error: signUpError } = await signUp(form.email, form.password);

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    let proofUrl = '';
    // Upload proof document if provided
    if (proofFile && data?.user) {
      const fileExt = proofFile.name.split('.').pop();
      const filePath = `therapist-proofs/${data.user.id}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, proofFile);

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        proofUrl = urlData.publicUrl;
      }
    }

    // Insert therapist profile
    if (data?.user) {
      const { error: profileError } = await supabase.from('therapists').insert({
        id: data.user.id,
        full_name: form.fullName,
        email: form.email,
        therapy_name: form.therapyName,
        specialty: form.specialty,
        aadhar_number: form.aadharNumber,
        years_experience: parseInt(form.yearsExperience),
        proof_doc_url: proofUrl,
        role: 'therapist',
        verified: false
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    navigate('/therapist-dashboard');
    setLoading(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-left-content">
          <div className="auth-left-ornament"></div>
          <h2>Join our Network of Trusted Professionals</h2>
          <p>Help students manage their stress and improve their well-being through our AI-powered platform.</p>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-container card-glass" style={{maxWidth: '500px'}}>
          <div className="logo" onClick={() => navigate('/')}>
            <span className="logo-icon">🧠</span>
            <span className="logo-text">MindEase</span>
          </div>
          <h3>Register as a Therapist</h3>
          <p className="auth-subtitle">Provide your details for verification</p>

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
              <label>Therapy / Clinic Name</label>
              <input type="text" className="input-field" name="therapyName" placeholder="Enter therapy or clinic name" value={form.therapyName} onChange={handleChange} required />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Specialty</label>
                <select className="select-field" name="specialty" value={form.specialty} onChange={handleChange} required>
                  <option value="">Select specialty</option>
                  <option value="clinical_psychology">Clinical Psychology</option>
                  <option value="counseling">Counseling</option>
                  <option value="cbt">Cognitive Behavioral Therapy</option>
                  <option value="stress_management">Stress Management</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label>Years of Experience</label>
                <input type="number" className="input-field" name="yearsExperience" placeholder="Years" value={form.yearsExperience} onChange={handleChange} min="0" required />
              </div>
            </div>
            <div className="form-group">
              <label>Aadhar Number</label>
              <input type="text" className="input-field" name="aadharNumber" placeholder="12-digit Aadhar number" value={form.aadharNumber} onChange={handleChange} maxLength="12" pattern="[0-9]{12}" required />
            </div>

            <div className="form-group">
              <label>Upload Proof Document</label>
              <label className="file-upload">
                <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFileChange} style={{display: 'none'}} />
                <div className="file-upload-icon">📄</div>
                <p>Click to upload or drag and drop</p>
                <p style={{fontSize: '0.75rem'}}>PDF, JPG, PNG (Max 5MB)</p>
                {proofFile && <p className="file-name">{proofFile.name}</p>}
              </label>
            </div>

            <div className="checkbox-group">
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
              <label>I agree to the Terms and Conditions</label>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-full" disabled={loading}>
              {loading ? 'Submitting...' : 'Submit for Verification'}
            </button>
          </form>

          <div className="auth-links">
            <p>Already registered? <a onClick={() => navigate('/login')}>Login</a></p>
          </div>
        </div>
      </div>
    </div>
  );
}

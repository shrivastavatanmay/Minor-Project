import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import './Dashboard.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

async function apiFetch(url, options = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  const headers = { ...options.headers };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
}

// ───────────────────────────────────────────── Sample fallback data
const sampleStressData = [
  { day: 'Mon', score: 0.35 }, { day: 'Tue', score: 0.42 },
  { day: 'Wed', score: 0.28 }, { day: 'Thu', score: 0.55 },
  { day: 'Fri', score: 0.38 }, { day: 'Sat', score: 0.22 },
  { day: 'Sun', score: 0.30 },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  function renderContent() {
    switch (activeTab) {
      case 'monitor': return <StressMonitor user={user} />;
      case 'journal': return <JournalSection user={user} />;
      case 'therapist': return <FindTherapist user={user} profile={profile} />;
      case 'educate': return <EducateSection />;
      case 'profile': return <ProfileSection user={user} profile={profile} />;
      default: return <DashboardHome user={user} profile={profile} />;
    }
  }

  return (
    <div className="dashboard-layout">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="logo">
            <span className="logo-icon">🧠</span>
            <span className="logo-text">MindEase</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {[
            { key: 'dashboard', icon: '📊', label: 'Dashboard' },
            { key: 'monitor', icon: '📷', label: 'Stress Monitor' },
            { key: 'journal', icon: '📝', label: 'Journal' },
            { key: 'therapist', icon: '👨‍⚕️', label: 'Find Therapist' },
            { key: 'educate', icon: '📚', label: 'Educate' },
            { key: 'profile', icon: '👤', label: 'Profile' },
          ].map(item => (
            <button key={item.key} className={`nav-item ${activeTab === item.key ? 'active' : ''}`} onClick={() => setActiveTab(item.key)}>
              <span className="nav-icon">{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="nav-item logout" onClick={handleSignOut}>
            <span className="nav-icon">🚪</span> Sign Out
          </button>
        </div>
      </aside>
      <main className="dashboard-main">
        {renderContent()}
      </main>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
//  TAB: Dashboard Home
// ═══════════════════════════════════════════════════════════════════════
function DashboardHome({ user, profile }) {
  const [stressData, setStressData] = useState(sampleStressData);
  const [currentStress, setCurrentStress] = useState({ level: 'Low', score: 0.28 });
  const [journals, setJournals] = useState([]);
  const [recommendations, setRecommendations] = useState([]);

  useEffect(() => {
    if (user) {
      loadDashboard();
      loadRecommendations();
    }
  }, [user]);

  async function loadDashboard() {
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/dashboard/${user.id}`);
      if (res.ok) {
        const json = await res.json();
        setCurrentStress(json.current_stress);
        if (json.stress_trend?.length) {
          setStressData(json.stress_trend.reverse().map(d => ({
            day: new Date(d.created_at).toLocaleDateString('en', { weekday: 'short' }),
            score: d.score,
          })));
        }
      }
    } catch { /* use sample data */ }

    const { data } = await supabase
      .from('journals').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(5);
    if (data) setJournals(data);
  }

  async function loadRecommendations() {
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/recommendations/${user.id}`);
      if (res.ok) {
        const json = await res.json();
        setRecommendations(json.recommendations || []);
      }
    } catch { /* use defaults */ }
  }

  const defaultRecs = [
    { icon: '🧘', title: 'Try Deep Breathing', description: '5 minutes of guided breathing can significantly reduce stress.' },
    { icon: '📝', title: 'Journal Your Thoughts', description: 'Writing down feelings helps process emotions effectively.' },
    { icon: '🚶', title: 'Take a Short Walk', description: 'Physical activity helps release tension and improve mood.' },
  ];

  const recs = recommendations.length > 0 ? recommendations : defaultRecs;

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Welcome back, {profile?.full_name || 'Student'}</h1>
          <p className="header-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div className="header-profile">
          <div className="avatar">{(profile?.full_name || 'S')[0].toUpperCase()}</div>
        </div>
      </header>

      <div className="stats-grid grid grid-4 gap-4">
        <div className="stat-card card">
          <div className="stat-card-label">Current Stress</div>
          <div className={`stat-card-value stress-badge ${(currentStress.level || 'low').toLowerCase()}`}>● {currentStress.level}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-card-label">Weekly Average</div>
          <div className="stat-card-value">{currentStress.score}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-card-label">Journal Entries</div>
          <div className="stat-card-value">{journals.length}</div>
        </div>
        <div className="stat-card card">
          <div className="stat-card-label">Next Appointment</div>
          <div className="stat-card-value" style={{ fontSize: '0.95rem' }}>None scheduled</div>
        </div>
      </div>

      <div className="chart-section card">
        <h3>Stress Trend – Past 7 Days</h3>
        <div className="chart-container">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={stressData}>
              <defs>
                <linearGradient id="stressGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3d618e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3d618e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eaeef1" />
              <XAxis dataKey="day" stroke="#596063" fontSize={13} />
              <YAxis stroke="#596063" fontSize={13} domain={[0, 1]} />
              <Tooltip contentStyle={{ background: 'rgba(247,249,251,0.9)', border: 'none', borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }} />
              <Area type="monotone" dataKey="score" stroke="#3d618e" strokeWidth={3} fill="url(#stressGradient)" dot={{ fill: '#3d618e', strokeWidth: 0, r: 5 }} activeDot={{ r: 7, fill: '#684cb6' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="dashboard-bottom grid grid-2 gap-6">
        <div className="card">
          <h3>Recent Journal Entries</h3>
          {journals.length > 0 ? (
            <div className="journal-list">
              {journals.map((j, i) => (
                <div key={i} className="journal-item">
                  <span className="journal-date">{new Date(j.created_at).toLocaleDateString()}</span>
                  <p className="journal-preview">{j.content?.substring(0, 80)}...</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>No journal entries yet. Start writing to track your thoughts.</p>
            </div>
          )}
        </div>
        <div className="card">
          <h3>Recommended Actions</h3>
          <div className="recommendations">
            {recs.map((r, i) => (
              <div key={i} className="rec-item">
                <span className="rec-icon">{r.icon}</span>
                <div>
                  <strong>{r.title}</strong>
                  <p>{r.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════
//  TAB: Stress Monitor (Webcam)
// ═══════════════════════════════════════════════════════════════════════
function StressMonitor({ user }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef(null);

  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      setError('Could not access webcam. Please allow camera permissions.');
    }
  }

  function stopWebcam() {
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
      videoRef.current.srcObject = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsMonitoring(false);
  }

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return null;
    const ctx = canvas.getContext('2d');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.7);
  }

  async function analyzeOnce() {
    setLoading(true);
    setScanning(true);
    setError('');
    try {
      // Capture 5 frames over ~600ms for temporal averaging
      const frames = [];
      for (let i = 0; i < 5; i++) {
        const f = captureFrame();
        if (f) frames.push(f);
        if (i < 4) await new Promise(r => setTimeout(r, 150));
      }

      if (frames.length === 0) {
        setError('Could not capture frames from webcam.');
        setLoading(false);
        setScanning(false);
        return;
      }

      const res = await apiFetch(`${BACKEND_URL}/api/analyze-batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frames, user_id: user?.id }),
      });
      const json = await res.json();
      if (res.ok) {
        setResult({
          emotions: json.emotions,
          stress_score: json.average_stress_score,
          stress_level: json.stress_level,
          frame_count: json.frame_count,
        });
      } else {
        setError(json.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Could not connect to the backend server. Make sure it is running.');
    }
    setScanning(false);
    setLoading(false);
  }

  function startContinuous() {
    setIsMonitoring(true);
    analyzeOnce();
    intervalRef.current = setInterval(analyzeOnce, 10000); // every 10 sec
  }

  useEffect(() => {
    startWebcam();
    return stopWebcam;
  }, []);

  const emotions = result?.emotions || {};
  const emotionEntries = Object.entries(emotions).sort((a, b) => b[1] - a[1]);

  return (
    <>
      <header className="dashboard-header">
        <div><h1>Stress Monitor</h1><p className="header-date">Real-time facial emotion analysis</p></div>
      </header>

      <div className="monitor-layout grid grid-2 gap-6">
        <div className="card webcam-card">
          <div className="webcam-container">
            <video ref={videoRef} autoPlay playsInline muted className="webcam-video" />
            {scanning && <div className="scan-overlay"><div className="scan-line" /></div>}
          </div>
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          {error && <div className="auth-error" style={{ marginTop: '12px' }}>{error}</div>}
          <div className="webcam-controls">
            <button className="btn btn-primary" onClick={analyzeOnce} disabled={loading}>
              {loading ? '🔬 Scanning 5 frames...' : '📸 Capture & Analyze'}
            </button>
            {!isMonitoring ? (
              <button className="btn btn-secondary" onClick={startContinuous}>▶ Start Continuous</button>
            ) : (
              <button className="btn btn-secondary" onClick={() => { clearInterval(intervalRef.current); setIsMonitoring(false); }}>⏹ Stop</button>
            )}
          </div>
        </div>

        <div className="card results-card">
          <h3>Analysis Results</h3>
          {result ? (
            <>
              <div className="stress-result-big">
                <div className={`stress-circle ${(result.stress_level || 'low').toLowerCase()}`}>
                  <span className="stress-score-big">{(result.stress_score * 100).toFixed(0)}%</span>
                  <span className="stress-label-big">{result.stress_level}</span>
                </div>
              </div>
              <h4>Emotion Breakdown</h4>
              <div className="emotion-bars">
                {emotionEntries.map(([emotion, value]) => (
                  <div key={emotion} className="emotion-bar-row">
                    <span className="emotion-name">{emotion}</span>
                    <div className="emotion-bar-track">
                      <div className="emotion-bar-fill" style={{ width: `${(value * 100).toFixed(0)}%` }} />
                    </div>
                    <span className="emotion-value">{(value * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>📷 Click "Capture & Analyze" to start analyzing your stress levels through your webcam.</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════
//  TAB: Journal
// ═══════════════════════════════════════════════════════════════════════
function JournalSection({ user }) {
  const [journals, setJournals] = useState([]);
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (user) loadJournals();
  }, [user]);

  async function loadJournals() {
    const { data } = await supabase
      .from('journals').select('*').eq('user_id', user.id)
      .order('created_at', { ascending: false }).limit(20);
    if (data) setJournals(data);
  }

  async function handleSave() {
    if (!content.trim()) return;
    setSaving(true);
    setFeedback('');
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/journals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, content }),
      });
      const json = await res.json();
      if (res.ok) {
        const sentiment = json.sentiment_score;
        let msg = '✅ Journal saved! ';
        if (sentiment > 0.3) msg += 'Sounds like you\'re feeling positive today! 🌟';
        else if (sentiment < -0.3) msg += 'Sounds like a tough day. Remember, it\'s okay to seek help. 💙';
        else msg += 'Thank you for journaling today. Keep it up! 📝';
        setFeedback(msg);
        setContent('');
        loadJournals();
      }
    } catch {
      setFeedback('⚠️ Could not save. Saving directly to database...');
      await supabase.from('journals').insert({ user_id: user.id, content, sentiment_score: 0 });
      setContent('');
      loadJournals();
      setFeedback('✅ Journal saved locally!');
    }
    setSaving(false);
  }

  async function handleDelete(id) {
    await supabase.from('journals').delete().eq('id', id);
    loadJournals();
  }

  return (
    <>
      <header className="dashboard-header">
        <div><h1>Journal</h1><p className="header-date">Express your thoughts and track your emotional patterns</p></div>
      </header>

      <div className="card journal-write-card">
        <h3>Write a new entry</h3>
        <textarea className="journal-textarea" placeholder="How are you feeling today? What's on your mind..." value={content} onChange={e => setContent(e.target.value)} rows={6} />
        {feedback && <p className="journal-feedback">{feedback}</p>}
        <button className="btn btn-primary" onClick={handleSave} disabled={saving || !content.trim()}>
          {saving ? 'Saving...' : '💾 Save Entry'}
        </button>
      </div>

      <div className="card" style={{ marginTop: '24px' }}>
        <h3>Past Entries</h3>
        {journals.length > 0 ? (
          <div className="journal-list">
            {journals.map(j => (
              <div key={j.id} className="journal-item journal-item-full">
                <div className="journal-item-header">
                  <span className="journal-date">{new Date(j.created_at).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                  {j.sentiment_score != null && (
                    <span className={`sentiment-badge ${j.sentiment_score > 0.2 ? 'positive' : j.sentiment_score < -0.2 ? 'negative' : 'neutral'}`}>
                      {j.sentiment_score > 0.2 ? '😊 Positive' : j.sentiment_score < -0.2 ? '😔 Negative' : '😐 Neutral'}
                    </span>
                  )}
                  <button className="btn-icon" onClick={() => handleDelete(j.id)} title="Delete">🗑️</button>
                </div>
                <p className="journal-content">{j.content}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state"><p>No journal entries yet.</p></div>
        )}
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════
//  CHAT MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════
function ChatModal({ currentUser, otherUserId, otherUserName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [otherUserId]);

  const loadMessages = async () => {
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/messages/${otherUserId}?current_user_id=${currentUser.id}`);
      if (res.ok) {
        const json = await res.json();
        setMessages(json.data || []);
      }
    } catch (e) { console.error(e); }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    setLoading(true);
    try {
      await apiFetch(`${BACKEND_URL}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender_id: currentUser.id,
          receiver_id: otherUserId,
          content: input.trim()
        })
      });
      setInput('');
      await loadMessages();
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-container" onClick={e => e.stopPropagation()}>
        <div className="chat-header">
          <h3>Chat with {otherUserName}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>
        <div className="chat-messages">
          {messages.length === 0 && <p className="empty-state">No messages yet. Say hi!</p>}
          {messages.map(m => {
            const isMe = m.sender_id === currentUser.id;
            return (
              <div key={m.id} className={`chat-bubble-wrapper ${isMe ? 'sent' : 'received'}`}>
                <div className="chat-bubble">
                  {m.content}
                  <span className="chat-time">{new Date(m.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
        <div className="chat-input-area">
          <textarea
            className="chat-input"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
            placeholder="Type a message..."
          />
          <button className="chat-send-btn" onClick={sendMessage} disabled={loading || !input.trim()}>
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════
//  TAB: Find Therapist
// ═══════════════════════════════════════════════════════════════════════
function FindTherapist({ user, profile }) {
  const [therapists, setTherapists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [requestingId, setRequestingId] = useState(null);
  const [requestFeedback, setRequestFeedback] = useState('');
  const [chatTherapist, setChatTherapist] = useState(null);

  useEffect(() => { loadTherapists(); }, []);

  async function loadTherapists() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set('specialty', filter);
      params.set('include_pending', 'true');
      const url = `${BACKEND_URL}/api/therapists?${params.toString()}`;
      const res = await apiFetch(url);
      const json = await res.json();
      let items = json.data || [];

      // If no verified therapists are returned, include pending therapist profiles too.
      if (items.length === 0) {
        let query = supabase.from('therapists').select('id, full_name, email, therapy_name, specialty, years_experience, verified');
        if (filter) query = query.eq('specialty', filter);
        const { data } = await query;
        items = data || [];
      }

      setTherapists(items);
    } catch {
      // Fallback: query Supabase directly
      let query = supabase.from('therapists').select('id, full_name, email, therapy_name, specialty, years_experience, verified');
      if (filter) query = query.eq('specialty', filter);
      const { data } = await query;
      setTherapists(data || []);
    }
    setLoading(false);
  }

  async function requestConsultation(therapist) {
    if (!user) return;

    setRequestFeedback('');
    setRequestingId(therapist.id);

    try {
      const res = await apiFetch(`${BACKEND_URL}/api/consult-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          student_id: user.id,
          therapist_id: therapist.id,
          student_name: profile?.full_name || user?.email || 'Student',
          student_email: user?.email || profile?.email || 'unknown@mindease.local',
        }),
      });

      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error || 'Could not send consultation request.');
      }

      setRequestFeedback(`Consultation request sent to ${therapist.full_name}.`);
    } catch (err) {
      const msg = (err?.message || '').toLowerCase();
      if (
        msg.includes('consult_requests table is not configured') ||
        msg.includes('public.consult_requests') ||
        msg.includes('schema cache')
      ) {
        setRequestFeedback('Consultation requests are not configured yet. Please ask admin to create the consult_requests table.');
      } else {
        setRequestFeedback(err?.message || 'Could not send consultation request.');
      }
    } finally {
      setRequestingId(null);
    }
  }

  useEffect(() => { loadTherapists(); }, [filter]);

  const specialties = [
    { value: '', label: 'All Specialties' },
    { value: 'clinical_psychology', label: 'Clinical Psychology' },
    { value: 'counseling', label: 'Counseling' },
    { value: 'cbt', label: 'Cognitive Behavioral Therapy' },
    { value: 'stress_management', label: 'Stress Management' },
    { value: 'other', label: 'Other' },
  ];

  return (
    <>
      <header className="dashboard-header">
        <div><h1>Find a Therapist</h1><p className="header-date">Connect with verified professionals</p></div>
      </header>

      <div className="therapist-filters">
        <select className="select-field" value={filter} onChange={e => setFilter(e.target.value)}>
          {specialties.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
      </div>

      {requestFeedback && (
        <div className="journal-feedback" style={{ marginBottom: '12px' }}>
          {requestFeedback}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><p>Loading therapists...</p></div>
      ) : therapists.length > 0 ? (
        <div className="therapist-grid grid grid-3 gap-4">
          {therapists.map(t => (
            <div key={t.id} className="card therapist-card">
              <div className="therapist-avatar">{t.full_name?.[0]?.toUpperCase() || 'T'}</div>
              <h4>{t.full_name}</h4>
              <p className="therapist-specialty">{t.specialty?.replace('_', ' ')}</p>
              <p className="therapist-clinic">🏥 {t.therapy_name}</p>
              <p className="therapist-exp">📅 {t.years_experience} years experience</p>
              {t.verified ? <span className="verified-badge">✅ Verified</span> : <span className="verified-badge pending-badge">⏳ Pending Verification</span>}
              <button className="btn btn-primary btn-sm" style={{ marginTop: '10px', width: '100%' }} onClick={() => requestConsultation(t)} disabled={requestingId === t.id}>
                {requestingId === t.id ? 'Sending...' : '🗓 Request Consultation'}
              </button>
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px', justifyContent: 'center' }}>
                <a href={`mailto:${t.email}`} className="btn btn-secondary btn-sm">📧 Contact</a>
                <button className="btn btn-secondary btn-sm" onClick={() => setChatTherapist(t)}>💬 Chat</button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state card">
          <p>No verified therapists found. Check back later or adjust your filters.</p>
        </div>
      )}

      {chatTherapist && (
        <ChatModal
          currentUser={user}
          otherUserId={chatTherapist.id}
          otherUserName={chatTherapist.full_name}
          onClose={() => setChatTherapist(null)}
        />
      )}
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════
//  TAB: Profile
// ═══════════════════════════════════════════════════════════════════════
function ProfileSection({ user, profile }) {
  if (!profile) return <div className="empty-state"><p>Loading profile...</p></div>;

  return (
    <>
      <header className="dashboard-header">
        <div><h1>Your Profile</h1><p className="header-date">Manage your account information</p></div>
      </header>

      <div className="card profile-card">
        <div className="profile-header">
          <div className="avatar avatar-lg">{(profile.full_name || 'U')[0].toUpperCase()}</div>
          <div>
            <h2>{profile.full_name}</h2>
            <p className="text-muted">{profile.email}</p>
            <span className="role-badge">{profile.role === 'therapist' ? '👨‍⚕️ Therapist' : '🎓 Student'}</span>
          </div>
        </div>

        <div className="profile-details">
          {profile.role === 'student' ? (
            <div className="details-grid">
              <div className="detail-item"><label>College ID</label><p>{profile.college_id || '—'}</p></div>
              <div className="detail-item"><label>Age</label><p>{profile.age || '—'}</p></div>
              <div className="detail-item"><label>Gender</label><p>{profile.gender || '—'}</p></div>
              <div className="detail-item"><label>Joined</label><p>{profile.created_at ? new Date(profile.created_at).toLocaleDateString() : '—'}</p></div>
            </div>
          ) : (
            <div className="details-grid">
              <div className="detail-item"><label>Therapy / Clinic</label><p>{profile.therapy_name || '—'}</p></div>
              <div className="detail-item"><label>Specialty</label><p>{profile.specialty?.replace('_', ' ') || '—'}</p></div>
              <div className="detail-item"><label>Experience</label><p>{profile.years_experience ? `${profile.years_experience} years` : '—'}</p></div>
              <div className="detail-item"><label>Verified</label><p>{profile.verified ? '✅ Yes' : '⏳ Pending'}</p></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}


// ═══════════════════════════════════════════════════════════════════════
//  TAB: Educate
// ═══════════════════════════════════════════════════════════════════════
function EducateSection() {
  const learningModules = [
    {
      title: 'Understand Stress Signals',
      description: 'Notice early signs like racing thoughts, short temper, or body tension so you can respond before stress builds up.',
      tips: ['Track your mood twice a day', 'Identify top 3 stress triggers', 'Rate stress from 1 to 10'],
    },
    {
      title: 'Calm the Body First',
      description: 'Regulate your nervous system using breathing and muscle relaxation to reduce mental overload quickly.',
      tips: ['Use 4-4-6 breathing for 2 minutes', 'Relax shoulders and jaw every hour', 'Take a 5-minute movement break'],
    },
    {
      title: 'Think in Helpful Patterns',
      description: 'Challenge all-or-nothing thoughts and replace them with balanced statements that reduce pressure.',
      tips: ['Write one stressful thought', 'Ask: Is this 100% true?', 'Create one realistic alternative thought'],
    },
    {
      title: 'Build Daily Recovery Habits',
      description: 'Small daily routines improve resilience and keep stress from becoming chronic.',
      tips: ['Keep consistent sleep times', 'Stay hydrated and eat on schedule', 'Plan one enjoyable activity daily'],
    },
  ];

  const quickTechniques = [
    { name: 'Box Breathing', duration: '2-4 min', how: 'Inhale 4 sec, hold 4 sec, exhale 4 sec, hold 4 sec. Repeat.' },
    { name: '5-4-3-2-1 Grounding', duration: '3-5 min', how: 'Identify 5 things you see, 4 feel, 3 hear, 2 smell, 1 taste.' },
    { name: 'Brain Dump Journaling', duration: '10 min', how: 'Write freely without editing to release mental clutter.' },
    { name: 'Micro Walk', duration: '10-15 min', how: 'Walk outdoors at a moderate pace and focus on your breathing rhythm.' },
  ];

  return (
    <>
      <header className="dashboard-header">
        <div>
          <h1>Stress Education Hub</h1>
          <p className="header-date">Learn, practice, and build healthy stress-management skills.</p>
        </div>
      </header>

      <section className="educate-grid grid grid-2 gap-6">
        {learningModules.map((module) => (
          <article key={module.title} className="card educate-card">
            <h3>{module.title}</h3>
            <p>{module.description}</p>
            <ul className="educate-list">
              {module.tips.map((tip) => (
                <li key={tip}>{tip}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="card educate-techniques" style={{ marginTop: 'var(--spacing-6)' }}>
        <h3>Quick Techniques You Can Practice Anytime</h3>
        <div className="technique-grid">
          {quickTechniques.map((item) => (
            <div key={item.name} className="technique-item">
              <div className="technique-title-row">
                <strong>{item.name}</strong>
                <span>{item.duration}</span>
              </div>
              <p>{item.how}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

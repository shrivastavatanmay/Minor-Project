import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import './Dashboard.css'; // Reuse common styles
import './TherapistDashboard.css';

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

// ═══════════════════════════════════════════════════════════════════════
//  CHAT MODAL COMPONENT
// ═══════════════════════════════════════════════════════════════════════
function ChatModal({ currentUser, otherUserId, otherUserName, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = React.useRef(null);

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
          {messages.length === 0 && <p className="empty-state">No messages yet. Say hi to check on them!</p>}
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

export default function TherapistDashboard() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [patients, setPatients] = useState([]);
  const [consultRequests, setConsultRequests] = useState([]);
  const [acceptedRequests, setAcceptedRequests] = useState([]);
  const [showRequestPopup, setShowRequestPopup] = useState(false);
  const [chatPatient, setChatPatient] = useState(null);

  useEffect(() => {
    if (user && profile?.role === 'therapist') {
      loadPatients();
      loadConsultRequests();
      loadAcceptedRequests();

      const timer = setInterval(() => {
        loadConsultRequests();
        loadAcceptedRequests();
        loadPatients();
      }, 15000);

      return () => clearInterval(timer);
    }
  }, [user, profile]);

  useEffect(() => {
    if (activeTab === 'appointments' && user?.id) {
      loadConsultRequests();
      loadAcceptedRequests();
    }
    if (activeTab === 'patients' && user?.id) {
      loadPatients();
    }
  }, [activeTab, user?.id]);

  async function loadPatients() {
    setLoading(true);
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/therapist/patients/${user.id}`);
      if (res.ok) {
        const json = await res.json();
        const mapped = (json.data || []).map(p => ({
          id: p.id,
          name: p.full_name || 'Student',
          email: p.email || 'Unknown',
          consult_status: p.consult_status || 'accepted',
          last_stress: p.latest_stress?.level || 'Low',
          last_score: p.latest_stress?.score ?? 0,
          last_active: p.latest_stress?.created_at
            ? new Date(p.latest_stress.created_at).toLocaleString()
            : 'Never',
          latest_journal: p.recent_journals?.[0] || null,
          journal_count: p.recent_journals?.length || 0,
          initials: (p.full_name || 'S').split(' ').map(n => n[0]).join('').toUpperCase() || '?'
        }));
        setPatients(mapped);
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadConsultRequests() {
    if (!user?.id) return;

    try {
      let rows = [];
      const res = await apiFetch(`${BACKEND_URL}/api/consult-requests/therapist/${user.id}?status=pending`);
      if (res.ok) {
        const json = await res.json();
        rows = (json.data || []).map(r => ({
          ...r,
          student_name: r.student_name || 'Student',
          student_email: r.student_email || 'Unknown',
        }));
      } else {
        const { data: requests, error: requestError } = await supabase
          .from('consult_requests')
          .select('id, student_id, therapist_id, status, created_at')
          .eq('therapist_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (requestError) {
          if (requestError.code !== '42P01') {
            console.error('Failed to load consult requests:', requestError);
          }
          return;
        }

        rows = requests || [];
      }

      if (rows.length === 0) {
        setConsultRequests([]);
        return;
      }

      setConsultRequests(rows);
      if (rows.length > 0) {
        setShowRequestPopup(true);
      }
    } catch (err) {
      console.error('Failed to load consult requests:', err);
    }
  }

  async function loadAcceptedRequests() {
    if (!user?.id) return;
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/consult-requests/therapist/${user.id}?status=accepted`);
      if (!res.ok) {
        setAcceptedRequests([]);
        return;
      }
      const json = await res.json();
      setAcceptedRequests((json.data || []).map(r => ({
        ...r,
        student_name: r.student_name || 'Student',
        student_email: r.student_email || 'Unknown',
      })));
    } catch (err) {
      console.error('Failed to load accepted requests:', err);
    }
  }

  async function handleConsultRequestAction(requestId, status) {
    try {
      const res = await apiFetch(`${BACKEND_URL}/api/consult-requests/${requestId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });

      if (!res.ok) {
        const { error } = await supabase
          .from('consult_requests')
          .update({ status })
          .eq('id', requestId);

        if (error) {
          throw error;
        }
      }

      const remaining = consultRequests.filter(r => r.id !== requestId);
      setConsultRequests(remaining);
      if (remaining.length === 0) {
        setShowRequestPopup(false);
      }
      await loadAcceptedRequests();
      await loadPatients();
    } catch (err) {
      console.error('Could not update consult request:', err);
    }
  }

  function renderTherapistContent() {
    if (activeTab === 'educate') {
      return (
        <>
          <header className="welcome-section">
            <h1>Stress Education Hub</h1>
            <p className="text-secondary">Evidence-based guidance you can share with students and use in sessions.</p>
          </header>

          <div className="dashboard-sections" style={{ gridTemplateColumns: '1fr' }}>
            <div className="card-glass section-card">
              <div className="section-header">
                <h2>Core Learning Topics</h2>
              </div>
              <div className="student-list">
                {[
                  { title: 'Stress Awareness', body: 'Teach students to identify physical, emotional, and behavioral stress signals early.' },
                  { title: 'Breathing and Grounding', body: 'Practice short regulation methods like box breathing and 5-4-3-2-1 grounding.' },
                  { title: 'Cognitive Reframing', body: 'Replace catastrophic thoughts with balanced alternatives to reduce overwhelm.' },
                  { title: 'Lifestyle Recovery', body: 'Promote sleep consistency, movement, hydration, and social connection as protective habits.' },
                ].map(item => (
                  <div key={item.title} className="student-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.5rem' }}>
                    <h4 style={{ margin: 0 }}>{item.title}</h4>
                    <p className="text-secondary" style={{ margin: 0 }}>{item.body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      );
    }

    if (activeTab === 'patients') {
      return (
        <>
          <header className="welcome-section">
            <h1>My Patients</h1>
            <p className="text-secondary">Track student stress status and latest activity.</p>
          </header>
          <div className="card-glass section-card">
            <div className="section-header">
              <h2>Patient List</h2>
            </div>
            {loading ? (
              <p className="text-secondary">Loading students...</p>
            ) : (
              <div className="student-list">
                {patients.length === 0 ? (
                  <p className="text-secondary">No accepted patients yet. Accept consultation requests to add patients here.</p>
                ) : patients.map(s => (
                  <div key={s.id} className="student-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.7rem' }}>
                    <div className="student-info">
                      <div className="student-avatar">{s.initials}</div>
                      <div className="student-details">
                        <h4>{s.name}</h4>
                        <p>{s.email}</p>
                        <p>Last active: {s.last_active}</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`stress-badge ${s.consult_status === 'accepted' ? 'stress-low' : 'stress-moderate'}`}>
                        {s.consult_status === 'accepted' ? 'Accepted' : 'Pending'}
                      </span>
                      <span className={`stress-badge stress-${s.last_stress.toLowerCase()}`}>
                        {s.last_stress} Stress ({Math.round((s.last_score || 0) * 100)}%)
                      </span>
                      <span className="stress-badge" style={{ background: 'rgba(78,205,196,0.15)', color: '#4ECDC4' }}>
                        Journals: {s.journal_count}
                      </span>
                    </div>
                    <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <div style={{ flex: 1 }}>
                        <p className="text-secondary" style={{ marginBottom: '4px' }}>Latest Journal</p>
                        <p style={{ margin: 0 }}>
                          {s.latest_journal?.content ? `${s.latest_journal.content.slice(0, 160)}${s.latest_journal.content.length > 160 ? '...' : ''}` : 'No journal entries yet.'}
                        </p>
                      </div>
                      <button className="btn btn-secondary btn-sm" onClick={() => setChatPatient(s)}>💬 Chat</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      );
    }

    if (activeTab === 'appointments') {
      return (
        <>
          <header className="welcome-section">
            <h1>Consultation Requests</h1>
            <p className="text-secondary">Approve or reject incoming student consultation requests.</p>
          </header>
          <div className="card-glass section-card">
            <div className="section-header">
              <h2>Pending Requests</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => { loadConsultRequests(); loadAcceptedRequests(); }}>
                Refresh
              </button>
            </div>
            {consultRequests.length === 0 ? (
              <p className="text-secondary">No pending requests.</p>
            ) : (
              <div className="student-list">
                {consultRequests.map(req => (
                  <div key={req.id} className="student-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.6rem' }}>
                    <div>
                      <h4 style={{ marginBottom: '4px' }}>{req.student_name}</h4>
                      <p className="text-secondary">{req.student_email}</p>
                    </div>
                    <div className="consult-actions">
                      <button className="btn btn-primary btn-sm" onClick={() => handleConsultRequestAction(req.id, 'accepted')}>Accept</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => handleConsultRequestAction(req.id, 'rejected')}>Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="section-header" style={{ marginTop: '1.4rem' }}>
              <h2>Accepted Requests</h2>
            </div>
            {acceptedRequests.length === 0 ? (
              <p className="text-secondary">No accepted requests yet.</p>
            ) : (
              <div className="student-list">
                {acceptedRequests.map(req => (
                  <div key={req.id} className="student-item">
                    <div>
                      <h4 style={{ marginBottom: '4px' }}>{req.student_name}</h4>
                      <p className="text-secondary">{req.student_email}</p>
                    </div>
                    <span className="stress-badge stress-low">Accepted</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      );
    }

    if (activeTab === 'profile') {
      return (
        <>
          <header className="welcome-section">
            <h1>Therapist Profile</h1>
            <p className="text-secondary">Your account and verification details.</p>
          </header>
          <div className="card-glass section-card">
            <div className="student-list">
              <div className="student-item" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: '0.5rem' }}>
                <h4 style={{ margin: 0 }}>{profile?.full_name || 'Therapist'}</h4>
                <p className="text-secondary" style={{ margin: 0 }}>{profile?.email || '—'}</p>
                <p className="text-secondary" style={{ margin: 0 }}>Clinic: {profile?.therapy_name || '—'}</p>
                <p className="text-secondary" style={{ margin: 0 }}>Specialty: {profile?.specialty?.replace('_', ' ') || '—'}</p>
                <p className="text-secondary" style={{ margin: 0 }}>Experience: {profile?.years_experience ? `${profile.years_experience} years` : '—'}</p>
                <p className="text-secondary" style={{ margin: 0 }}>Verified: {profile?.verified ? 'Yes' : 'Pending'}</p>
              </div>
            </div>
          </div>
        </>
      );
    }

    return (
      <>
        <header className="welcome-section">
          <h1>Welcome, Dr. {profile?.full_name || 'Therapist'}</h1>
          <p className="text-secondary">Here's an overview of your current patients and stress alerts.</p>
        </header>

        <section className="stats-grid">
          <div className="card-glass stat-card">
            <div className="stat-icon" style={{background: 'rgba(78, 205, 196, 0.1)', color: '#4ECDC4'}}>👥</div>
            <div className="stat-info">
              <h3>Active Patients</h3>
              <div className="stat-value">{patients.length}</div>
            </div>
          </div>
          <div className="card-glass stat-card">
            <div className="stat-icon" style={{background: 'rgba(255, 107, 107, 0.1)', color: '#FF6B6B'}}>⚠️</div>
            <div className="stat-info">
              <h3>Pending Requests</h3>
              <div className="stat-value">{consultRequests.length}</div>
            </div>
          </div>
          <div className="card-glass stat-card">
            <div className="stat-icon" style={{background: 'rgba(123, 104, 238, 0.1)', color: '#7B68EE'}}>📅</div>
            <div className="stat-info">
              <h3>Accepted Requests</h3>
              <div className="stat-value">{acceptedRequests.length}</div>
            </div>
          </div>
        </section>

        <div className="dashboard-sections">
          <div className="card-glass section-card">
            <div className="section-header">
              <h2>Recent Patient Activity</h2>
              <button className="btn-text">View All</button>
            </div>
            <div className="student-list">
              {patients.slice(0, 6).map(s => (
                <div key={s.id} className="student-item">
                  <div className="student-info">
                    <div className="student-avatar">{s.initials}</div>
                    <div className="student-details">
                      <h4>{s.name}</h4>
                      <p>Last active: {s.last_active}</p>
                    </div>
                  </div>
                  <span className={`stress-badge stress-${s.last_stress.toLowerCase()}`}>
                    {s.last_stress} Stress
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="card-glass section-card">
            <div className="section-header">
              <h2>Upcoming</h2>
            </div>
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm font-semibold">Session with Sahil</p>
                <p className="text-xs text-secondary">Today, 4:30 PM</p>
              </div>
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm font-semibold">Session with Ananya</p>
                <p className="text-xs text-secondary">Today, 6:00 PM</p>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!user || profile?.role !== 'therapist') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="card-glass p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
          <p className="mb-6">This dashboard is for verified therapists only.</p>
          <button onClick={() => navigate('/login')} className="btn btn-primary">Go to Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="therapist-dashboard">
      {/* ────────────────── Sidebar ────────────────── */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <div className="logo cursor-pointer" onClick={() => navigate('/')}>
            <span className="logo-icon">🧠</span>
            <span className="logo-text">MindEase</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            <span className="nav-icon">📊</span>
            Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'patients' ? 'active' : ''}`} onClick={() => setActiveTab('patients')}>
            <span className="nav-icon">👥</span>
            My Patients
          </button>
          <button className={`nav-item ${activeTab === 'appointments' ? 'active' : ''}`} onClick={() => setActiveTab('appointments')}>
            <span className="nav-icon">📅</span>
            Appointments
            {consultRequests.length > 0 && <span className="request-count-pill">{consultRequests.length}</span>}
          </button>
          <button className={`nav-item ${activeTab === 'educate' ? 'active' : ''}`} onClick={() => setActiveTab('educate')}>
            <span className="nav-icon">📚</span>
            Educate
          </button>
          <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            <span className="nav-icon">👤</span>
            Profile
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="btn-logout" onClick={() => signOut()}>
            <span className="nav-icon">🚪</span>
            Sign Out
          </button>
        </div>
      </aside>

      {/* ────────────────── Main Content ────────────────── */}
      <main className="therapist-main">
        {showRequestPopup && consultRequests.length > 0 && (
          <div className="consult-popup">
            <div className="consult-popup-header">
              <strong>New Consultation Requests</strong>
              <button className="btn-icon" onClick={() => setShowRequestPopup(false)} title="Close">✕</button>
            </div>
            <div className="consult-popup-list">
              {consultRequests.slice(0, 3).map(req => (
                <div key={req.id} className="consult-popup-item">
                  <div>
                    <p><strong>{req.student_name}</strong> wants to consult you.</p>
                    <p className="text-secondary" style={{ margin: 0, fontSize: '0.8rem' }}>{req.student_email}</p>
                  </div>
                  <div className="consult-actions">
                    <button className="btn btn-primary btn-sm" onClick={() => handleConsultRequestAction(req.id, 'accepted')}>Accept</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleConsultRequestAction(req.id, 'rejected')}>Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {chatPatient && (
          <ChatModal
            currentUser={user}
            otherUserId={chatPatient.id}
            otherUserName={chatPatient.name}
            onClose={() => setChatPatient(null)}
          />
        )}

        {renderTherapistContent()}
      </main>
    </div>
  );
}

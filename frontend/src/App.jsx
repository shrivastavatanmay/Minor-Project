import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Landing from './pages/Landing';
import Login from './pages/Login';
import StudentRegister from './pages/StudentRegister';
import TherapistRegister from './pages/TherapistRegister';
import Dashboard from './pages/Dashboard';
import TherapistDashboard from './pages/TherapistDashboard';
import StressQuestionnaire from './pages/StressQuestionnaire';
import './index.css';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register/student" element={<StudentRegister />} />
          <Route path="/register/therapist" element={<TherapistRegister />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/therapist-dashboard" element={<TherapistDashboard />} />
          <Route path="/questionnaire" element={<StressQuestionnaire />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

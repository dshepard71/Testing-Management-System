import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AdminSidebar from './components/AdminSidebar';
import UserManagementTab from './features/UserManagementTab';
import SeatingChartManager from './features/seating-charts/SeatingChartManager';
import CounselorDashboard from './features/counselor/components/CounselorDashboard';
import MasterUpload from './features/counselor/components/MasterUpload';
import RoomLayoutManager from './features/counselor/components/RoomLayoutManager';
import LogisticsHub from './features/logistics/components/LogisticsHub';
import AttendanceCheckin from './features/logistics/components/AttendanceCheckin';
import MakeupTracker from './features/logistics/components/MakeupTracker';
import BusinessConsole from './features/billing/components/BusinessConsole';
import SATRegistration from './features/sat-psat/components/SATRegistration';
import AssessmentHub from './features/admin/components/AssessmentHub';
import StateAssessmentsHub from './features/state-assessments/components/StateAssessmentsHub';
import AnalyticsHub from './features/dashboards/components/AnalyticsHub';
import SettingsHub from './features/admin/components/SettingsHub';
import ActionItemsHub from './features/admin/components/ActionItemsHub';
import AccommodationsHub from './features/admin/components/AccommodationsHub';
import FormManager from './features/forms/components/FormManager';
import FormBuilder from './features/forms/components/FormBuilder';
import FormSubmissions from './features/forms/components/FormSubmissions';
import StudentFormList from './features/forms/components/StudentFormList';
import StudentFormView from './features/forms/components/StudentFormView';
import StudentPortal from './features/student/components/StudentPortal';
import ProctorDashboard from './features/counselor/components/ProctorDashboard';
import HelpGuide from './features/counselor/components/HelpGuide';
import './App.css';

const DashboardLanding = () => (
  <div className="glass-panel" style={{ padding: '32px' }}>
    <h2>Welcome to the V2 Command Center</h2>
    <p>Select an option from the sidebar to begin.</p>
  </div>
);

const ImpersonationBanner = () => {
  const { actualProfile, user, impersonatedRole, setImpersonatedRole, impersonatedCaseloadName, setImpersonatedCaseloadName, isAdminEmail } = useAuth();
  
  const isActualAdmin = actualProfile && (actualProfile.role === 'admin' || isAdminEmail(user?.email));
  if (!isActualAdmin) return null;

  return (
    <div className="glass-panel" style={{
      padding: '16px 24px',
      marginBottom: '24px',
      border: '1px solid rgba(234, 176, 16, 0.4)',
      background: impersonatedRole ? 'rgba(234, 176, 16, 0.08)' : 'var(--glass-bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: '16px',
      borderRadius: '12px'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '18px' }}>🛠️</span>
        <div>
          <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', fontSize: '14px' }}>Admin Impersonation Center</div>
          <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)' }}>
            {impersonatedRole ? (
              <span style={{ color: 'var(--fa-red)', fontWeight: 'bold' }}>
                👁️ Actively simulating role: <span style={{ textTransform: 'uppercase' }}>{impersonatedRole}</span>
                {impersonatedCaseloadName && ` (Caseload Link: "${impersonatedCaseloadName}")`}
              </span>
            ) : "Currently viewing system as a standard Global Administrator."}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Simulate Role:</label>
          <select
            value={impersonatedRole || ''}
            onChange={(e) => {
              const val = e.target.value;
              setImpersonatedRole(val || null);
              if (!val) setImpersonatedCaseloadName(null);
            }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '13px', outline: 'none', backgroundColor: 'white', fontWeight: '500' }}
          >
            <option value="">None (Admin)</option>
            <option value="student">Student</option>
            <option value="proctor">Proctor</option>
            <option value="counselor">Counselor</option>
            <option value="case_manager">Case Manager</option>
            <option value="business">Business Office</option>
            <option value="accommodations_director">Accommodations Director</option>
          </select>
        </div>

        {(impersonatedRole === 'case_manager' || impersonatedRole === 'counselor') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Caseload:</label>
            <input
              type="text"
              placeholder="e.g. Stevens"
              value={impersonatedCaseloadName || ''}
              onChange={(e) => setImpersonatedCaseloadName(e.target.value)}
              style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '13px', width: '120px', outline: 'none' }}
            />
          </div>
        )}

        {impersonatedRole && (
          <button
            onClick={() => {
              setImpersonatedRole(null);
              setImpersonatedCaseloadName(null);
            }}
            style={{
              padding: '6px 14px',
              backgroundColor: 'var(--fa-red)',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'background 0.2s'
            }}
          >
            Reset
          </button>
        )}
      </div>
    </div>
  );
};

function App() {
  const { user, userProfile, loginWithGoogle, loginWithEmail, logout, loading } = useAuth();
  
  const effectiveRole = userProfile?.role || 'student';

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const [showPasswordLogin, setShowPasswordLogin] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleGoogleLogin = async () => {
    setAuthError('');
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Login Error:", err);
      setAuthError(err.message || 'Google login failed');
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    if (!emailInput || !passwordInput) return;
    setAuthError('');
    setAuthLoading(true);
    try {
      await loginWithEmail(emailInput.trim(), passwordInput);
    } catch (err) {
      console.error("Email login error:", err);
      setAuthError(err.message || 'Invalid email or password');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Myriad Pro, sans-serif' }}>Loading secure system...</div>;
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--fa-blue)', fontFamily: 'Myriad Pro, sans-serif' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.95)', minWidth: '380px', maxWidth: '440px', borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
          <h1 style={{ color: 'var(--fa-dark-blue)', marginBottom: '6px', fontSize: '24px' }}>Fryeburg Academy</h1>
          <h2 style={{ color: 'var(--fa-warm-gray)', marginTop: 0, marginBottom: '24px', fontSize: '15px' }}>Testing Management System V2</h2>
          
          {authError && (
            <div style={{ padding: '10px 14px', backgroundColor: 'rgba(158, 36, 50, 0.1)', color: 'var(--fa-red)', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', textAlign: 'left', border: '1px solid rgba(158, 36, 50, 0.2)' }}>
              ⚠️ {authError}
            </div>
          )}

          {!showPasswordLogin ? (
            <>
              <button 
                onClick={handleGoogleLogin}
                style={{ width: '100%', padding: '12px 20px', backgroundColor: 'var(--fa-red)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 4px 12px rgba(158, 36, 50, 0.2)' }}
              >
                <span>🔑</span> Sign in with FA Google Account
              </button>

              <div style={{ marginTop: '24px', borderTop: '1px solid #eee', paddingTop: '16px' }}>
                <button
                  type="button"
                  onClick={() => setShowPasswordLogin(true)}
                  style={{ background: 'none', border: 'none', color: 'var(--fa-blue)', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  🔐 Administrator Email & Password Sign In
                </button>
              </div>
            </>
          ) : (
            <form onSubmit={handleEmailLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px', textAlign: 'left' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)', display: 'block', marginBottom: '4px' }}>Admin Email</label>
                <input
                  type="email"
                  placeholder="e.g. djdshep@gmail.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)', display: 'block', marginBottom: '4px' }}>Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={authLoading}
                style={{ marginTop: '8px', padding: '12px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', fontSize: '14px', cursor: authLoading ? 'default' : 'pointer' }}
              >
                {authLoading ? 'Signing in...' : 'Sign In with Password'}
              </button>

              <button
                type="button"
                onClick={() => { setShowPasswordLogin(false); setAuthError(''); }}
                style={{ background: 'none', border: 'none', color: 'var(--fa-warm-gray)', fontSize: '12px', cursor: 'pointer', textAlign: 'center', marginTop: '6px' }}
              >
                ← Back to Google Sign In
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const [showCheatSheet, setShowCheatSheet] = useState(false);

  // Strict route-level permission guard
  const ProtectedRoute = ({ allowedRoles, children }) => {
    if (!allowedRoles.includes(effectiveRole)) {
      return <Navigate to="/" replace />;
    }
    return children;
  };

  return (
    <Router>
      <div style={{ display: 'flex', width: '100vw', height: '100vh', overflow: 'hidden' }}>
        {(effectiveRole === 'admin' || effectiveRole === 'accommodations_director') && <AdminSidebar onOpenCheatSheet={() => setShowCheatSheet(true)} />}
        <main style={{ flex: 1, padding: isMobile ? '16px' : '32px', overflowY: 'auto', backgroundColor: 'var(--glass-bg)' }}>
          <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <button
                  onClick={() => setShowCheatSheet(true)}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'white',
                    color: 'var(--fa-blue)',
                    border: '1.5px solid var(--fa-blue)',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    fontSize: '13px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 6px rgba(0,70,139,0.08)'
                  }}
                >
                  <span>📖</span> Operations Cheat Sheet
                </button>
              </div>
              <div style={{ fontSize: '14px', color: 'var(--fa-warm-gray)', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                <span>Logged in as <b>{user.email}</b></span>
                {userProfile?.isImpersonated && (
                  <span style={{ color: 'var(--fa-red)', fontWeight: 'bold', fontSize: '12px', backgroundColor: 'rgba(158, 36, 50, 0.08)', padding: '4px 8px', borderRadius: '4px' }}>
                    🕵️ IMPERSONATING: {userProfile.role.toUpperCase()}
                  </span>
                )}
                <button onClick={logout} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer', backgroundColor: 'white' }}>Sign Out</button>
              </div>
            </div>
            
            <ImpersonationBanner />

            {showCheatSheet && <HelpGuide role={effectiveRole} onClose={() => setShowCheatSheet(false)} />}

            <Routes>
              <Route path="/" element={
                effectiveRole === 'admin' ? <DashboardLanding /> :
                effectiveRole === 'proctor' ? <Navigate to="/proctor" replace /> :
                (effectiveRole === 'counselor' || effectiveRole === 'case_manager') ? <Navigate to="/counselor" replace /> :
                effectiveRole === 'accommodations_director' ? <Navigate to="/admin/accommodations" replace /> :
                effectiveRole === 'business' ? <Navigate to="/admin/billing" replace /> :
                <StudentPortal />
              } />
              
              {/* Admin Setup Routes */}
              <Route path="/admin/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagementTab /></ProtectedRoute>} />
              <Route path="/admin/seating-charts" element={<ProtectedRoute allowedRoles={['admin']}><SeatingChartManager /></ProtectedRoute>} />
              <Route path="/admin/master-upload" element={<ProtectedRoute allowedRoles={['admin']}><MasterUpload /></ProtectedRoute>} />
              <Route path="/admin/rooms" element={<ProtectedRoute allowedRoles={['admin']}><RoomLayoutManager /></ProtectedRoute>} />
              <Route path="/admin/forms" element={<ProtectedRoute allowedRoles={['admin']}><FormManager /></ProtectedRoute>} />
              <Route path="/admin/forms/build" element={<ProtectedRoute allowedRoles={['admin']}><FormBuilder /></ProtectedRoute>} />
              <Route path="/admin/forms/build/:id" element={<ProtectedRoute allowedRoles={['admin']}><FormBuilder /></ProtectedRoute>} />
              <Route path="/admin/forms/:id/submissions" element={<ProtectedRoute allowedRoles={['admin']}><FormSubmissions /></ProtectedRoute>} />
              <Route path="/admin/testing-settings" element={<ProtectedRoute allowedRoles={['admin']}><SettingsHub /></ProtectedRoute>} />
              
              {/* Admin Execution Routes */}
              <Route path="/admin/action-items" element={<ProtectedRoute allowedRoles={['admin']}><ActionItemsHub /></ProtectedRoute>} />
              <Route path="/admin/logistics" element={<ProtectedRoute allowedRoles={['admin']}><LogisticsHub /></ProtectedRoute>} />
              <Route path="/admin/checkin" element={<ProtectedRoute allowedRoles={['admin']}><AttendanceCheckin /></ProtectedRoute>} />
              <Route path="/admin/makeups" element={<ProtectedRoute allowedRoles={['admin']}><MakeupTracker /></ProtectedRoute>} />
              <Route path="/admin/assessments" element={<ProtectedRoute allowedRoles={['admin']}><AssessmentHub /></ProtectedRoute>} />
              <Route path="/admin/state-assessments" element={<ProtectedRoute allowedRoles={['admin']}><StateAssessmentsHub /></ProtectedRoute>} />
              <Route path="/admin/analytics" element={<ProtectedRoute allowedRoles={['admin']}><AnalyticsHub /></ProtectedRoute>} />
              
              {/* Admin Business Routes */}
              <Route path="/admin/billing" element={<ProtectedRoute allowedRoles={['admin', 'business']}><BusinessConsole /></ProtectedRoute>} />
              
              {/* Special Accommodations Access */}
              <Route path="/admin/accommodations" element={<ProtectedRoute allowedRoles={['admin', 'accommodations_director']}><AccommodationsHub /></ProtectedRoute>} />
              
              {/* Student Routes */}
              <Route path="/student/sat-registration" element={<ProtectedRoute allowedRoles={['admin', 'student']}><SATRegistration /></ProtectedRoute>} />
              <Route path="/student/forms" element={<ProtectedRoute allowedRoles={['admin', 'student']}><StudentFormList /></ProtectedRoute>} />
              <Route path="/student/forms/:id" element={<ProtectedRoute allowedRoles={['admin', 'student']}><StudentFormView /></ProtectedRoute>} />
              
              {/* Staff/Counselor Routes */}
              <Route path="/counselor" element={<ProtectedRoute allowedRoles={['admin', 'counselor', 'case_manager']}><CounselorDashboard /></ProtectedRoute>} />
              <Route path="/proctor" element={<ProtectedRoute allowedRoles={['admin', 'proctor']}><ProctorDashboard /></ProtectedRoute>} />
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </Router>
  );
}

export default App;

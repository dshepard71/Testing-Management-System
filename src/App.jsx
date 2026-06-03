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
  const { user, userProfile, loginWithGoogle, logout, loading } = useAuth();
  
  const effectiveRole = userProfile?.role || 'student';

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  if (loading) {
    return <div style={{ padding: '50px', textAlign: 'center', fontFamily: 'Myriad Pro, sans-serif' }}>Loading secure system...</div>;
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: 'var(--fa-blue)', fontFamily: 'Myriad Pro, sans-serif' }}>
        <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.95)' }}>
          <h1 style={{ color: 'var(--fa-dark-blue)', marginBottom: '10px' }}>Fryeburg Academy</h1>
          <h2 style={{ color: 'var(--fa-warm-gray)', marginTop: 0, marginBottom: '30px', fontSize: '18px' }}>Testing Management V2</h2>
          <button 
            onClick={handleLogin}
            style={{ padding: '12px 24px', backgroundColor: 'var(--fa-red)', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Sign in with FA Google Account
          </button>
        </div>
      </div>
    );
  }

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
        {(effectiveRole === 'admin' || effectiveRole === 'accommodations_director') && <AdminSidebar />}
        <main style={{ flex: 1, padding: isMobile ? '16px' : '32px', overflowY: 'auto', backgroundColor: 'var(--glass-bg)' }}>
          <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', color: 'var(--fa-warm-gray)' }}>
                Logged in as <b>{user.email}</b>
                {userProfile?.isImpersonated && (
                  <span style={{ marginLeft: '12px', color: 'var(--fa-red)', fontWeight: 'bold', fontSize: '12px', backgroundColor: 'rgba(158, 36, 50, 0.08)', padding: '4px 8px', borderRadius: '4px' }}>
                    🕵️ IMPERSONATING: {userProfile.role.toUpperCase()}
                  </span>
                )}
                <button onClick={logout} style={{ marginLeft: '16px', padding: '6px 12px', borderRadius: '6px', border: '1px solid #ccc', cursor: 'pointer', backgroundColor: 'white' }}>Sign Out</button>
              </div>
            </div>
            
            <ImpersonationBanner />

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

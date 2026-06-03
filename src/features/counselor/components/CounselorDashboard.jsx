import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

import StudentTestSearch from './StudentTestSearch';
import ProctorDashboard from './ProctorDashboard';
import MasterUpload from './MasterUpload';
import HelpGuide from './HelpGuide';

export default function CounselorDashboard() {
  const { user, impersonatedCaseloadName, impersonatedRole } = useAuth();
  const [activeTab, setActiveTab] = useState('registry');
  const [showHelp, setShowHelp] = useState(false);

  // If there's an impersonated name, show it in the header
  const headerCaseloadText = impersonatedCaseloadName 
    ? `Caseload: ${impersonatedCaseloadName}` 
    : 'All Students';

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <header style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '2.5rem', color: 'var(--fa-dark-blue)' }}>Testing Management Hub</h1>
          <p style={{ color: 'var(--fa-warm-gray)', marginTop: '8px', fontSize: '1.1rem' }}>
            {user?.email} | <span style={{ fontWeight: 600, color: 'var(--fa-blue)' }}>{headerCaseloadText}</span>
          </p>
        </div>
        <button 
          onClick={() => setShowHelp(true)}
          style={{ padding: '8px 16px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          ❓ Help Guide
        </button>
      </header>

      {showHelp && <HelpGuide role={impersonatedRole || 'counselor'} onClose={() => setShowHelp(false)} />}

      {/* Glassmorphic Tab Navigation */}
      <div className="glass-panel" style={{ display: 'flex', padding: '8px', marginBottom: '24px', gap: '8px' }}>
        <TabButton active={activeTab === 'registry'} onClick={() => setActiveTab('registry')}>
          Student Search & Registry
        </TabButton>
        <TabButton active={activeTab === 'accommodations'} onClick={() => setActiveTab('accommodations')}>
          Caseload Accommodations
        </TabButton>
        <TabButton active={activeTab === 'proctor'} onClick={() => setActiveTab('proctor')}>
          My Proctor Assignments
        </TabButton>
      </div>

      {/* Tab Content Area */}
      <main>
        {activeTab === 'registry' && <StudentTestSearch impersonatedCaseload={impersonatedCaseloadName} />}
        {activeTab === 'accommodations' && <MasterUpload filterByCaseload={true} staffName={user?.displayName || ''} impersonatedCaseload={impersonatedCaseloadName} />}
        {activeTab === 'proctor' && <ProctorDashboard />}
      </main>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '12px 24px',
        border: 'none',
        borderRadius: '8px',
        backgroundColor: active ? 'var(--fa-blue)' : 'transparent',
        color: active ? '#fff' : 'var(--fa-dark-blue)',
        fontWeight: active ? '600' : '500',
        fontSize: '1rem',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        boxShadow: active ? '0 4px 12px rgba(0, 70, 139, 0.2)' : 'none',
      }}
      onMouseOver={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'rgba(0, 70, 139, 0.05)';
      }}
      onMouseOut={(e) => {
        if (!active) e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

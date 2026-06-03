import React, { useState } from 'react';
import TestingCalendar from './TestingCalendar';
import ReportingDashboard from './ReportingDashboard';
import HelpGuide from './HelpGuide';

const AnalyticsHub = () => {
    const [activeTab, setActiveTab] = useState('calendar');

    const tabStyle = (tabName) => ({
        padding: '10px 20px',
        backgroundColor: activeTab === tabName ? 'var(--fa-blue)' : 'white',
        color: activeTab === tabName ? 'white' : 'var(--fa-dark-blue)',
        border: '1px solid var(--fa-blue)',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '14px',
        transition: 'all 0.2s'
    });

    return (
        <div style={{ maxWidth: '1600px', margin: '0 auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid var(--glass-border)', paddingBottom: '10px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button onClick={() => setActiveTab('calendar')} style={tabStyle('calendar')}>
                        📅 Testing Calendar
                    </button>
                    <button onClick={() => setActiveTab('reporting')} style={tabStyle('reporting')}>
                        📊 Reporting Dashboard
                    </button>
                    <button onClick={() => setActiveTab('help')} style={tabStyle('help')}>
                        ❓ Proctor Help Hub
                    </button>
                </div>
                <div style={{ padding: '8px 16px', background: 'rgba(0, 70, 139, 0.05)', borderRadius: '8px', color: 'var(--fa-dark-blue)', fontWeight: 'bold', fontSize: '12px' }}>
                    Analytics & Support Workspace
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', minHeight: '600px' }} className="glass-panel">
                {activeTab === 'calendar' && <TestingCalendar />}
                {activeTab === 'reporting' && <ReportingDashboard />}
                {activeTab === 'help' && <HelpGuide role="admin" />}
            </div>
        </div>
    );
};

export default AnalyticsHub;

import React, { useState } from 'react';
import MaineScienceTest from './MaineScienceTest';
import MaineThroughYear from './MaineThroughYear';
import MAPUpload from './MAPUpload';
import MAPGrowthReport from './MAPGrowthReport';

const StateAssessmentsHub = () => {
    const [activeTab, setActiveTab] = useState('science');

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
        <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--glass-border)', paddingBottom: '10px', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveTab('science')} style={tabStyle('science')}>
                    Maine Science
                </button>
                <button onClick={() => setActiveTab('through_year')} style={tabStyle('through_year')}>
                    Maine Through Year
                </button>
                <button onClick={() => setActiveTab('map_report')} style={tabStyle('map_report')}>
                    MAP Growth Report
                </button>
                <button onClick={() => setActiveTab('map_upload')} style={tabStyle('map_upload')}>
                    NWEA MAP Upload
                </button>
            </div>

            {activeTab === 'science' && <MaineScienceTest />}
            {activeTab === 'through_year' && <MaineThroughYear />}
            {activeTab === 'map_report' && <MAPGrowthReport />}
            {activeTab === 'map_upload' && <MAPUpload />}
        </div>
    );
};

export default StateAssessmentsHub;

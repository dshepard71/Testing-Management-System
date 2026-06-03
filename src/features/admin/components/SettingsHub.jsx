import React, { useState } from 'react';
import SATSettings from '../../sat-psat/components/SATSettings';
import APSettings from '../../ap/components/APSettings';

const SettingsHub = () => {
    const [activeTab, setActiveTab] = useState('sat');

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid var(--glass-border)', paddingBottom: '10px' }}>
                <button
                    onClick={() => setActiveTab('sat')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: activeTab === 'sat' ? 'var(--fa-blue)' : 'white',
                        color: activeTab === 'sat' ? 'white' : 'var(--fa-dark-blue)',
                        border: '1px solid var(--fa-blue)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                >
                    SAT/PSAT Settings
                </button>
                <button
                    onClick={() => setActiveTab('ap')}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: activeTab === 'ap' ? 'var(--fa-blue)' : 'white',
                        color: activeTab === 'ap' ? 'white' : 'var(--fa-dark-blue)',
                        border: '1px solid var(--fa-blue)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        transition: 'all 0.2s'
                    }}
                >
                    AP Settings
                </button>
            </div>

            {activeTab === 'sat' ? <SATSettings /> : <APSettings />}
        </div>
    );
};

export default SettingsHub;

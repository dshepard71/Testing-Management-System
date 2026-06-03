import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const SATSettings = () => {
    const { user, userProfile } = useAuth();
    const [settings, setSettings] = useState({
        registrationOpen: false,
        registrationDeadline: '',
        currentSeason: 'Spring',
        testingYear: new Date().getFullYear(),
        gradeEligibility: {
            '12': 'none',
            '11': 'SAT',
            '10': 'PSAT 10',
            '09': 'none'
        }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'sat_registration'), (docSnap) => {
            if (docSnap.exists()) {
                setSettings(prev => ({ ...prev, ...docSnap.data() }));
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setMessage('');
        try {
            await setDoc(doc(db, 'settings', 'sat_registration'), {
                ...settings,
                lastUpdated: serverTimestamp(),
                updatedBy: user.email
            });
            setMessage('Settings saved successfully!');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            console.error("Error saving settings:", error);
            setMessage('Failed to save settings.');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading settings...</div>;

    return (
        <div className="glass-panel" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '600', color: 'var(--fa-dark-blue)' }}>SAT/PSAT Registration Settings</h2>
                <p style={{ color: 'var(--fa-warm-gray)', marginTop: '8px', fontSize: '14px' }}>
                    Configure the registration window, deadlines, and grade eligibility for the student portal.
                </p>
            </div>

            {message && (
                <div style={{ padding: '12px', backgroundColor: message.includes('Failed') ? '#fef2f2' : '#e6f4ea', color: message.includes('Failed') ? '#991b1b' : '#1e8e3e', borderRadius: '8px', marginBottom: '20px', border: `1px solid ${message.includes('Failed') ? '#fecaca' : '#ceead6'}` }}>
                    {message}
                </div>
            )}

            <form onSubmit={handleSave}>
                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #dadce0', marginBottom: '24px' }}>
                    <h3 style={{ marginTop: 0, fontSize: '18px', color: 'var(--fa-dark-blue)', marginBottom: '16px' }}>Status & Timing</h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div>
                            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '12px', padding: '12px', backgroundColor: settings.registrationOpen ? '#e6f4ea' : '#fef2f2', borderRadius: '8px', border: `1px solid ${settings.registrationOpen ? '#ceead6' : '#fecaca'}` }}>
                                <input
                                    type="checkbox"
                                    checked={settings.registrationOpen}
                                    onChange={(e) => setSettings({ ...settings, registrationOpen: e.target.checked })}
                                    style={{ width: '20px', height: '20px', accentColor: settings.registrationOpen ? '#1e8e3e' : '#991b1b' }}
                                />
                                <div>
                                    <div style={{ fontWeight: 'bold', color: settings.registrationOpen ? '#1e8e3e' : '#991b1b' }}>Registration is {settings.registrationOpen ? 'OPEN' : 'CLOSED'}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)' }}>Students can only see the form when open.</div>
                                </div>
                            </label>
                        </div>
                        
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Registration Deadline</label>
                            <input
                                type="date"
                                value={settings.registrationDeadline}
                                onChange={(e) => setSettings({ ...settings, registrationDeadline: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                                required
                            />
                            <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>Form auto-closes after this date.</div>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Testing Season</label>
                            <select
                                value={settings.currentSeason}
                                onChange={(e) => setSettings({ ...settings, currentSeason: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                            >
                                <option value="Fall">Fall</option>
                                <option value="Spring">Spring</option>
                                <option value="Summer">Summer</option>
                            </select>
                        </div>

                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Testing Year</label>
                            <input
                                type="number"
                                value={settings.testingYear}
                                onChange={(e) => setSettings({ ...settings, testingYear: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                                required
                            />
                        </div>
                    </div>
                </div>

                <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', border: '1px solid #dadce0', marginBottom: '24px' }}>
                    <h3 style={{ marginTop: 0, fontSize: '18px', color: 'var(--fa-dark-blue)', marginBottom: '8px' }}>Grade Eligibility & Pricing</h3>
                    <p style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '20px' }}>
                        Select which test each grade is eligible for. Students will only see the test option assigned to their grade. Prices are fixed ($60 SAT, $18 PSAT).
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
                        {['12', '11', '10', '09'].map(grade => (
                            <div key={grade} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', fontSize: '16px' }}>Grade {grade}</div>
                                <select
                                    value={settings.gradeEligibility[grade] || 'none'}
                                    onChange={(e) => setSettings({
                                        ...settings,
                                        gradeEligibility: { ...settings.gradeEligibility, [grade]: e.target.value }
                                    })}
                                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none', width: '200px', fontWeight: '500' }}
                                >
                                    <option value="none">Not Eligible</option>
                                    <option value="SAT">SAT ($60)</option>
                                    <option value="PSAT/NMSQT">PSAT/NMSQT ($18)</option>
                                    <option value="PSAT 10">PSAT 10 ($18)</option>
                                    <option value="PSAT 8/9">PSAT 8/9 ($18)</option>
                                </select>
                            </div>
                        ))}
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        type="submit"
                        disabled={saving}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: 'var(--fa-blue)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            cursor: saving ? 'not-allowed' : 'pointer',
                            opacity: saving ? 0.7 : 1,
                            transition: 'background 0.2s'
                        }}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default SATSettings;

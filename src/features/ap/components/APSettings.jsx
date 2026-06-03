import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';

const APSettings = () => {
    const { user } = useAuth();
    const [settings, setSettings] = useState({
        registrationOpen: false,
        registrationDeadline: '',
        testingYear: new Date().getFullYear(),
        fees: {
            standard: 99,
            reduced: 62,
            lateOrder: 40,
            lateTesting: 40,
            unused: 40
        }
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'ap_registration'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettings(prev => ({ 
                    ...prev, 
                    ...data,
                    fees: { ...prev.fees, ...(data.fees || {}) }
                }));
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
            await setDoc(doc(db, 'settings', 'ap_registration'), {
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

    const updateFee = (key, value) => {
        setSettings(prev => ({
            ...prev,
            fees: {
                ...prev.fees,
                [key]: parseInt(value) || 0
            }
        }));
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading settings...</div>;

    return (
        <div className="glass-panel" style={{ padding: '32px', maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '600', color: 'var(--fa-dark-blue)' }}>AP Registration Settings</h2>
                <p style={{ color: 'var(--fa-warm-gray)', marginTop: '8px', fontSize: '14px' }}>
                    Configure the registration window, deadlines, and base exam fees for the student portal.
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
                                    <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)' }}>Students can only select exams when open.</div>
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
                    <h3 style={{ marginTop: 0, fontSize: '18px', color: 'var(--fa-dark-blue)', marginBottom: '8px' }}>Exam Fees & Penalty Pricing</h3>
                    <p style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '20px' }}>
                        Set the base prices for standard and reduced exams, as well as the College Board penalty fees.
                    </p>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Standard Exam Fee ($)</label>
                            <input
                                type="number"
                                value={settings.fees.standard}
                                onChange={(e) => updateFee('standard', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                                required
                            />
                        </div>
                        <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Reduced Exam Fee ($)</label>
                            <input
                                type="number"
                                value={settings.fees.reduced}
                                onChange={(e) => updateFee('reduced', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                                required
                            />
                        </div>
                        <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Late Order Fee ($)</label>
                            <input
                                type="number"
                                value={settings.fees.lateOrder}
                                onChange={(e) => updateFee('lateOrder', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                                required
                            />
                        </div>
                        <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Late Testing Fee ($)</label>
                            <input
                                type="number"
                                value={settings.fees.lateTesting}
                                onChange={(e) => updateFee('lateTesting', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                                required
                            />
                        </div>
                        <div style={{ padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Unused/Canceled Fee ($)</label>
                            <input
                                type="number"
                                value={settings.fees.unused}
                                onChange={(e) => updateFee('unused', e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                                required
                            />
                        </div>
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

export default APSettings;

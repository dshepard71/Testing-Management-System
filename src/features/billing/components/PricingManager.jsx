import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';

export default function PricingManager({ billingSettings, onCycleChange }) {
    const [pricing, setPricing] = useState({
        apStandard: 99,
        apReduced: 62,
        apLateOrder: 40,
        apLateTest: 40,
        apUnused: 40,
        satStandard: 60,
        satReduced: 18,
        customFees: []
    });

    const [cycles, setCycles] = useState({
        apCycle: billingSettings?.apCycle || 'May 2026',
        satCycle: billingSettings?.satCycle || 'Fall 2026'
    });
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (billingSettings) {
            setCycles({
                apCycle: billingSettings.apCycle || 'May 2026',
                satCycle: billingSettings.satCycle || 'Fall 2026'
            });
        }
    }, [billingSettings]);

    useEffect(() => {
        const unsub = onSnapshot(doc(db, 'settings', 'pricing'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setPricing({
                    ...pricing,
                    ...data,
                    customFees: data.customFees || []
                });
            }
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleChange = (field, value) => {
        setPricing(prev => ({ ...prev, [field]: Number(value) || 0 }));
    };

    const handleCustomFeeChange = (index, field, value) => {
        const newCustom = [...pricing.customFees];
        newCustom[index] = { ...newCustom[index], [field]: field === 'amount' ? Number(value) || 0 : value };
        setPricing(prev => ({ ...prev, customFees: newCustom }));
    };

    const addCustomFee = () => {
        setPricing(prev => ({ ...prev, customFees: [...prev.customFees, { id: Date.now(), name: '', amount: 0 }] }));
    };

    const removeCustomFee = (index) => {
        const newCustom = [...pricing.customFees];
        newCustom.splice(index, 1);
        setPricing(prev => ({ ...prev, customFees: newCustom }));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, 'settings', 'pricing'), {
                ...pricing,
                lastUpdated: serverTimestamp()
            }, { merge: true });

            if (onCycleChange) {
                await onCycleChange('apCycle', cycles.apCycle);
                await onCycleChange('satCycle', cycles.satCycle);
            }

            alert('✅ Pricing and Cycles successfully updated!');
        } catch (e) {
            console.error("Error saving pricing:", e);
            alert("Error saving pricing.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div style={{ padding: '24px' }}>Loading Pricing Settings...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <div>
                        <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--fa-dark-blue)' }}>Master Pricing Configuration</h2>
                        <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '14px' }}>
                            Update the base costs and fees. These values will be dynamically injected into all Billing spreadsheets.
                        </p>
                    </div>
                    <button 
                        onClick={handleSave} 
                        disabled={saving}
                        style={{ padding: '10px 20px', background: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                        {saving ? '⏳ Saving...' : '💾 Save Changes'}
                    </button>
                </div>

                {/* Active Billing Cycles */}
                <div style={{ marginBottom: '32px', padding: '16px 20px', backgroundColor: 'rgba(0, 70, 139, 0.03)', borderRadius: '10px', border: '1px solid var(--glass-border)' }}>
                    <h3 style={{ color: 'var(--fa-dark-blue)', margin: '0 0 6px 0', fontSize: '15px' }}>Active Billing Cycle Terms</h3>
                    <p style={{ margin: '0 0 16px 0', fontSize: '12px', color: 'var(--fa-warm-gray)' }}>
                        These labels appear on the Financial Summary dashboard, clearinghouses, and export headers.
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '20px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)', marginBottom: '6px' }}>AP Billing Cycle</label>
                            <input
                                type="text"
                                value={cycles.apCycle}
                                onChange={e => setCycles({ ...cycles, apCycle: e.target.value })}
                                placeholder="e.g. May 2026"
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '13px' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)', marginBottom: '6px' }}>SAT / PSAT Billing Cycle</label>
                            <input
                                type="text"
                                value={cycles.satCycle}
                                onChange={e => setCycles({ ...cycles, satCycle: e.target.value })}
                                placeholder="e.g. Fall 2026 or Spring 2026"
                                style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '13px' }}
                            />
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '48px' }}>
                    {/* AP Pricing */}
                    <div style={{ flex: 1 }}>
                        <h3 style={{ color: 'var(--fa-dark-blue)', borderBottom: '2px solid var(--glass-border)', paddingBottom: '8px', marginBottom: '16px' }}>AP Exams</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Standard Exam Fee</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>$</span>
                                    <input type="number" value={pricing.apStandard} onChange={e => handleChange('apStandard', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Reduced Exam Fee</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>$</span>
                                    <input type="number" value={pricing.apReduced} onChange={e => handleChange('apReduced', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Late Order Add-on</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>$</span>
                                    <input type="number" value={pricing.apLateOrder} onChange={e => handleChange('apLateOrder', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Late Testing Add-on</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>$</span>
                                    <input type="number" value={pricing.apLateTest} onChange={e => handleChange('apLateTest', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Unused/Canceled Fee</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>$</span>
                                    <input type="number" value={pricing.apUnused} onChange={e => handleChange('apUnused', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* SAT Pricing */}
                    <div style={{ flex: 1 }}>
                        <h3 style={{ color: 'var(--fa-dark-blue)', borderBottom: '2px solid var(--glass-border)', paddingBottom: '8px', marginBottom: '16px' }}>SAT / PSAT</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>SAT Exam Fee</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>$</span>
                                    <input type="number" value={pricing.satStandard} onChange={e => handleChange('satStandard', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                                </div>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <label style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>PSAT Exam Fee</label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>$</span>
                                    <input type="number" value={pricing.satReduced} onChange={e => handleChange('satReduced', e.target.value)} style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                                </div>
                            </div>
                        </div>

                        {/* Custom Categories */}
                        <div style={{ marginTop: '32px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--glass-border)', paddingBottom: '8px', marginBottom: '16px' }}>
                                <h3 style={{ color: 'var(--fa-dark-blue)', margin: 0 }}>Custom Categories</h3>
                                <button onClick={addCustomFee} style={{ background: '#188038', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>+ Add Category</button>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {pricing.customFees.length === 0 ? (
                                    <div style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', fontStyle: 'italic' }}>No custom categories added.</div>
                                ) : (
                                    pricing.customFees.map((fee, idx) => (
                                        <div key={fee.id} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                            <input 
                                                type="text" 
                                                placeholder="Category Name (e.g. SAT Prep)" 
                                                value={fee.name} 
                                                onChange={e => handleCustomFeeChange(idx, 'name', e.target.value)} 
                                                style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} 
                                            />
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>$</span>
                                                <input 
                                                    type="number" 
                                                    value={fee.amount} 
                                                    onChange={e => handleCustomFeeChange(idx, 'amount', e.target.value)} 
                                                    style={{ width: '80px', padding: '8px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none' }} 
                                                />
                                            </div>
                                            <button onClick={() => removeCustomFee(idx)} style={{ background: 'none', border: 'none', color: 'var(--fa-red)', cursor: 'pointer', fontSize: '16px' }} title="Remove">✖</button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

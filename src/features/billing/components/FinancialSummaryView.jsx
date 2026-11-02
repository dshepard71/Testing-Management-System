import React, { useEffect, useState } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const FinancialSummaryView = ({ apCycle, satCycle, onCycleChange }) => {
    const [apStats, setApStats] = useState({ total: 0, billed: 0, count: 0 });
    const [satStats, setSatStats] = useState({ total: 0, billed: 0, boarding: 0, day: 0, commuter: 0, count: 0 });
    const [loading, setLoading] = useState(true);

    const [editingCycle, setEditingCycle] = useState(null); // 'ap' | 'sat' | null
    const [tempCycleVal, setTempCycleVal] = useState('');

    const startEdit = (type, currentVal) => {
        setEditingCycle(type);
        setTempCycleVal(currentVal || '');
    };

    const saveEdit = (type) => {
        if (onCycleChange && tempCycleVal.trim()) {
            onCycleChange(type === 'ap' ? 'apCycle' : 'satCycle', tempCycleVal.trim());
        }
        setEditingCycle(null);
    };

    useEffect(() => {
        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), (snapshot) => {
            let total = 0;
            let billed = 0;
            snapshot.docs.forEach(doc => {
                const s = doc.data();
                const base = s.orderExam === 'Yes' ? (s.feeStatus === 'Reduced' ? 62 : 99) : 0;
                const addOns = (s.lateOrderFee === 'Yes' ? 40 : 0) +
                    (s.lateTestingFee === 'Yes' ? 40 : 0) +
                    (s.unusedFee === 'Yes' ? 40 : 0);
                const fee = base + addOns;
                total += fee;
                if (s.isBilledFeb) billed += fee;
            });
            setApStats({ total, billed, count: snapshot.size });
        });

        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), (snapshot) => {
            let boarding = 0;
            let day = 0;
            let commuter = 0;
            let totalBilled = 0;
            snapshot.docs.forEach(doc => {
                const r = doc.data();
                const fees = r.waiverEligible === 'Yes' ? 0 : (r.testType === 'SAT' ? 60 : 18);
                const isBilled = r.billed || (r.paymentTender !== 'Account' && r.submittedToBO);

                if (r.studentType === 'boarding') boarding += fees;
                else if (r.studentType === 'commuter') commuter += fees;
                else day += fees;

                if (isBilled) totalBilled += fees;
            });
            const grandSatTotal = boarding + day + commuter;
            setSatStats({ total: grandSatTotal, billed: totalBilled, boarding, day, commuter, count: snapshot.size });
            setLoading(false);
        });

        return () => {
            unsubAP();
            unsubSAT();
        };
    }, []);

    if (loading) return <div style={{ padding: '20px' }}>Loading summary...</div>;

    const grandTotalProjected = apStats.total + satStats.total;
    const grandTotalBilled = apStats.billed + satStats.billed;

    return (
        <div style={{ marginTop: '0' }}>
            <div style={{ marginBottom: '30px' }}>
                <h3 style={{ margin: 0 }}>Financial Summary</h3>
                <div style={{ display: 'flex', gap: '24px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* AP Cycle */}
                    <div style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>AP Cycle:</span>
                        {editingCycle === 'ap' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="text"
                                    value={tempCycleVal}
                                    onChange={(e) => setTempCycleVal(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit('ap'); if (e.key === 'Escape') setEditingCycle(null); }}
                                    autoFocus
                                    style={{ padding: '2px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--fa-blue)', outline: 'none' }}
                                />
                                <button onClick={() => saveEdit('ap')} style={{ border: 'none', background: '#1e8e3e', color: 'white', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}>Save</button>
                                <button onClick={() => setEditingCycle(null)} style={{ border: 'none', background: '#ccc', color: '#333', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                            </span>
                        ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#1a73e8', fontWeight: 'bold' }}>{apCycle}</span>
                                {onCycleChange && (
                                    <button
                                        onClick={() => startEdit('ap', apCycle)}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', fontSize: '12px', padding: '0 2px' }}
                                        title="Edit AP Cycle"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </span>
                        )}
                    </div>

                    {/* SAT/PSAT Cycle */}
                    <div style={{ fontSize: '13px', color: '#666', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>SAT/PSAT Cycle:</span>
                        {editingCycle === 'sat' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <input
                                    type="text"
                                    value={tempCycleVal}
                                    onChange={(e) => setTempCycleVal(e.target.value)}
                                    onKeyDown={(e) => { if (e.key === 'Enter') saveEdit('sat'); if (e.key === 'Escape') setEditingCycle(null); }}
                                    autoFocus
                                    style={{ padding: '2px 6px', fontSize: '12px', borderRadius: '4px', border: '1px solid var(--fa-blue)', outline: 'none' }}
                                />
                                <button onClick={() => saveEdit('sat')} style={{ border: 'none', background: '#1e8e3e', color: 'white', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}>Save</button>
                                <button onClick={() => setEditingCycle(null)} style={{ border: 'none', background: '#ccc', color: '#333', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                            </span>
                        ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ color: '#1a73e8', fontWeight: 'bold' }}>{satCycle}</span>
                                {onCycleChange && (
                                    <button
                                        onClick={() => startEdit('sat', satCycle)}
                                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#888', fontSize: '12px', padding: '0 2px' }}
                                        title="Edit SAT/PSAT Cycle"
                                    >
                                        ✏️
                                    </button>
                                )}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginBottom: '40px' }}>
                {/* Grand Totals Card */}
                <div className="glass-panel" style={{ padding: '30px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--fa-warm-gray)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '20px' }}>Revenue Overview</div>

                    <div style={{ marginBottom: '25px' }}>
                        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Projected Revenue</div>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: '#374151' }}>${grandTotalProjected.toLocaleString()}</div>
                    </div>

                    <div>
                        <div style={{ fontSize: '12px', color: '#1e8e3e', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Billed / Collected</span>
                            <span style={{ fontWeight: 'bold' }}>{Math.round((grandTotalBilled / grandTotalProjected) * 100) || 0}%</span>
                        </div>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: '#1e8e3e' }}>${grandTotalBilled.toLocaleString()}</div>
                        <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', marginTop: '10px', overflow: 'hidden' }}>
                            <div style={{ width: `${(grandTotalBilled / grandTotalProjected) * 100}%`, height: '100%', backgroundColor: '#1e8e3e' }}></div>
                        </div>
                    </div>
                </div>

                {/* Program Breakdown */}
                <div className="glass-panel" style={{ padding: '30px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--fa-warm-gray)', fontWeight: '600', marginBottom: '20px' }}>Projected vs Billed by Program</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: '600', color: '#1a73e8' }}>Advanced Placement</span>
                                <span style={{ color: '#6b7280' }}>Billed: ${apStats.billed.toLocaleString()} / ${apStats.total.toLocaleString()}</span>
                            </div>
                            <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${(apStats.total / grandTotalProjected) * 100}%`, height: '100%', backgroundColor: '#1a73e866', position: 'relative' }}>
                                    <div style={{ width: `${(apStats.billed / apStats.total) * 100}%`, height: '100%', backgroundColor: '#1a73e8' }}></div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                <span style={{ fontWeight: '600', color: '#34a853' }}>SAT / PSAT</span>
                                <span style={{ color: '#6b7280' }}>Billed: ${satStats.billed.toLocaleString()} / ${satStats.total.toLocaleString()}</span>
                            </div>
                            <div style={{ height: '8px', backgroundColor: '#f3f4f6', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ width: `${(satStats.total / grandTotalProjected) * 100}%`, height: '100%', backgroundColor: '#34a85366' }}>
                                    <div style={{ width: `${(satStats.billed / satStats.total) * 100}%`, height: '100%', backgroundColor: '#34a853' }}></div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* SAT Demographic Breakdown */}
                <div className="glass-panel" style={{ padding: '30px' }}>
                    <div style={{ fontSize: '14px', color: 'var(--fa-warm-gray)', fontWeight: '600', marginBottom: '15px' }}>SAT Student Demographic Revenue</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#6b7280' }}>🏠 Boarding:</span>
                            <span style={{ fontWeight: '700', color: '#1a73e8' }}>${satStats.boarding.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#6b7280' }}>🚲 Commuter:</span>
                            <span style={{ fontWeight: '700', color: '#f9ab00' }}>${satStats.commuter.toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
                            <span style={{ color: '#6b7280' }}>🏢 District Day:</span>
                            <span style={{ fontWeight: '700', color: '#444' }}>${satStats.day.toLocaleString()}</span>
                        </div>
                        <div style={{ borderTop: '1px solid #eee', marginTop: '10px', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontStyle: 'italic' }}>
                            <span style={{ color: '#6b7280' }}>Total SAT Projected:</span>
                            <span style={{ fontWeight: '700' }}>${satStats.total.toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
                <h4 style={{ margin: '0 0 15px 0' }}>Billing Status Summary</h4>
                <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.5' }}>
                    <b>Projected Revenue</b> represents the total value of all registrations. <br />
                    <b>Billed / Collected</b> represents the portion where the Business Office has marked the student as "Sent" (to accounts) or where a cash/check/CC deposit has been recorded.
                </div>
            </div>
        </div>
    );
};

export default FinancialSummaryView;

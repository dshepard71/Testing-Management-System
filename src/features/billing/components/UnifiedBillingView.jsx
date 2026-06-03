import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

export default function UnifiedBillingView({ pricing }) {
    const [apRegs, setApRegs] = useState([]);
    const [satRegs, setSatRegs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedRow, setExpandedRow] = useState(null);

    useEffect(() => {
        let apLoaded = false;
        let satLoaded = false;
        const checkFinished = () => { if (apLoaded && satLoaded) setLoading(false); };

        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), (snapshot) => {
            setApRegs(snapshot.docs.map(doc => ({ id: doc.id, type: 'AP', ...doc.data() })));
            apLoaded = true; checkFinished();
        });

        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), (snapshot) => {
            setSatRegs(snapshot.docs.map(doc => ({ id: doc.id, type: 'SAT', ...doc.data() })));
            satLoaded = true; checkFinished();
        });

        return () => { unsubAP(); unsubSAT(); };
    }, []);

    const calcApFee = (s) => {
        const base = s.orderExam === 'Yes' ? (s.feeStatus === 'Reduced' ? (pricing?.apReduced || 0) : (pricing?.apStandard || 0)) : 0;
        const addOns = (s.lateOrderFee === 'Yes' ? (pricing?.apLateOrder || 0) : 0) +
            (s.lateTestingFee === 'Yes' ? (pricing?.apLateTest || 0) : 0) +
            (s.unusedFee === 'Yes' ? (pricing?.apUnused || 0) : 0);
        return { base, addOns, total: base + addOns };
    };

    const calcSatFee = (r) => {
        return r.waiverEligible === 'Yes' ? 0 : (r.testType === 'SAT' ? (pricing?.satStandard || 60) : (pricing?.satReduced || 18));
    };

    const handleUnifiedBillingToggle = async (studentRecords, isCurrentlyBilled) => {
        try {
            const batch = writeBatch(db);
            const newValue = !isCurrentlyBilled;
            studentRecords.forEach(rec => {
                if (rec.type === 'AP') batch.update(doc(db, 'ap_registrations', rec.id), { isBilledFeb: newValue, lastUpdated: serverTimestamp() });
                if (rec.type === 'SAT') batch.update(doc(db, 'sat_registrations', rec.id), { billed: newValue, lastUpdated: serverTimestamp() });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error updating unified billing:", error);
        }
    };

    const unifiedList = useMemo(() => {
        const map = new Map();
        
        [...apRegs, ...satRegs].forEach(rec => {
            const key = `${rec.lastName?.toLowerCase()}_${rec.firstName?.toLowerCase()}`;
            if (!map.has(key)) {
                map.set(key, {
                    firstName: rec.firstName,
                    lastName: rec.lastName,
                    email: rec.email,
                    grade: rec.grade || rec.studentType,
                    apExams: [],
                    satExams: [],
                    records: [],
                    totalApFee: 0,
                    totalSatFee: 0,
                    grandTotal: 0
                });
            }
            
            const student = map.get(key);
            student.records.push(rec);

            if (rec.type === 'AP') {
                student.apExams.push(rec);
                student.totalApFee += calcApFee(rec).total;
            } else {
                student.satExams.push(rec);
                student.totalSatFee += calcSatFee(rec);
            }
            
            student.grandTotal = student.totalApFee + student.totalSatFee;
        });

        const list = Array.from(map.values()).filter(s => 
            `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.email?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        return list.sort((a, b) => a.lastName?.localeCompare(b.lastName) || a.firstName?.localeCompare(b.firstName));
    }, [apRegs, satRegs, searchTerm, pricing]);

    const exportToCSV = () => {
        const rows = [["Student Name", "Grade/Type", "AP Fee", "SAT Fee", "Grand Total", "Billed"]];
        unifiedList.forEach(s => {
            const isBilled = s.records.every(r => r.type === 'AP' ? r.isBilledFeb : r.billed);
            rows.push([
                `"${s.lastName}, ${s.firstName}"`, `"${s.grade || ''}"`, s.totalApFee, s.totalSatFee, s.grandTotal, isBilled ? 'Yes' : 'No'
            ]);
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Unified_Billing_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div style={{ padding: '24px', color: 'var(--fa-warm-gray)' }}>Loading Consolidated Billing...</div>;

    const totalExpected = unifiedList.reduce((acc, s) => acc + s.grandTotal, 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel no-print" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--fa-dark-blue)' }}>Unified Billing Dashboard</h2>
                    <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '14px' }}>A consolidated view of all AP and SAT testing fees per student.</p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Search student..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', width: '250px' }}
                    />
                    <button onClick={exportToCSV} style={{ padding: '10px 16px', background: 'white', color: 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📥 Export Master CSV
                    </button>
                    <button onClick={() => window.print()} style={{ padding: '10px 16px', background: 'white', color: 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        🖨️ Print Master
                    </button>
                    <div style={{ padding: '8px 16px', background: 'rgba(24, 128, 56, 0.05)', borderRadius: '8px', border: '1px solid rgba(24, 128, 56, 0.2)', textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#188038', fontWeight: 'bold', textTransform: 'uppercase' }}>Consolidated Revenue</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#188038' }}>${totalExpected.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={{ width: '40px', background: '#f8f9fa', borderBottom: '1px solid var(--glass-border)' }}></th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Student</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>AP Exams</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>SAT Exams</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Grand Total</th>
                            <th style={{ textAlign: 'center', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Invoice Sent</th>
                        </tr>
                    </thead>
                    <tbody>
                        {unifiedList.map(s => {
                            const isAllBilled = s.records.length > 0 && s.records.every(r => r.type === 'AP' ? r.isBilledFeb : r.billed);
                            const isExpanded = expandedRow === s.lastName + s.firstName;
                            
                            return (
                                <React.Fragment key={s.lastName + s.firstName}>
                                    <tr style={{ background: isExpanded ? 'rgba(0, 70, 139, 0.02)' : 'white', borderBottom: isExpanded ? 'none' : '1px solid var(--glass-border)', transition: 'background 0.2s', cursor: 'pointer' }} onClick={() => setExpandedRow(isExpanded ? null : s.lastName + s.firstName)}>
                                        <td style={{ textAlign: 'center', color: 'var(--fa-blue)', fontWeight: 'bold' }}>
                                            {isExpanded ? '▼' : '▶'}
                                        </td>
                                        <td style={{ padding: '16px 24px' }}>
                                            <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{s.lastName}, {s.firstName}</div>
                                        </td>
                                        <td style={{ padding: '16px 24px', color: s.totalApFee > 0 ? 'inherit' : 'var(--fa-warm-gray)' }}>
                                            {s.apExams.length > 0 ? `${s.apExams.length} Exams ($${s.totalApFee})` : '-'}
                                        </td>
                                        <td style={{ padding: '16px 24px', color: s.totalSatFee > 0 ? 'inherit' : 'var(--fa-warm-gray)' }}>
                                            {s.satExams.length > 0 ? `${s.satExams.length} Exams ($${s.totalSatFee})` : '-'}
                                        </td>
                                        <td style={{ padding: '16px 24px', fontWeight: 'bold', fontSize: '15px', color: 'var(--fa-dark-blue)' }}>
                                            ${s.grandTotal}
                                        </td>
                                        <td style={{ padding: '16px 24px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
                                            <input 
                                                type="checkbox" 
                                                checked={isAllBilled} 
                                                onChange={() => handleUnifiedBillingToggle(s.records, isAllBilled)} 
                                                style={{ cursor: 'pointer', transform: 'scale(1.2)' }} 
                                            />
                                        </td>
                                    </tr>

                                    {/* Expanded Itemized Row */}
                                    {isExpanded && (
                                        <tr style={{ background: 'rgba(0, 70, 139, 0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                            <td colSpan="6" style={{ padding: '0 24px 24px 64px' }}>
                                                <div style={{ display: 'flex', gap: '32px' }}>
                                                    {s.apExams.length > 0 && (
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>AP Itemization</div>
                                                            {s.apExams.map(ex => {
                                                                const fees = calcApFee(ex);
                                                                return (
                                                                    <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed rgba(0,0,0,0.1)', fontSize: '12px' }}>
                                                                        <span>{ex.course}</span>
                                                                        <span style={{ fontWeight: 'bold' }}>${fees.total}</span>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                    {s.satExams.length > 0 && (
                                                        <div style={{ flex: 1 }}>
                                                            <div style={{ fontWeight: 'bold', color: 'var(--fa-warm-gray)', fontSize: '11px', textTransform: 'uppercase', marginBottom: '8px' }}>SAT Itemization</div>
                                                            {s.satExams.map(ex => (
                                                                <div key={ex.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed rgba(0,0,0,0.1)', fontSize: '12px' }}>
                                                                    <span>{ex.testType} ({ex.paymentTender || 'Account'})</span>
                                                                    <span style={{ fontWeight: 'bold' }}>${calcSatFee(ex)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            
            <style>{`
                @media print {
                    @page { size: portrait; margin: 1cm; }
                    .no-print, nav, aside { display: none !important; }
                    body, #root, main { height: auto !important; overflow: visible !important; position: static !important; }
                }
            `}</style>
        </div>
    );
}

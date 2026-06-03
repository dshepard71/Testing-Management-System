import React, { useEffect, useState } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

export default function APBillingView({ cycle, onCycleChange, pricing }) {
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [localCycle, setLocalCycle] = useState(cycle);

    useEffect(() => { setLocalCycle(cycle); }, [cycle]);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'ap_registrations'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setStudents(data);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const calculateFees = (s) => {
        // Use dynamic pricing from the master settings
        const base = s.orderExam === 'Yes' ? (s.feeStatus === 'Reduced' ? (pricing?.apReduced || 0) : (pricing?.apStandard || 0)) : 0;
        const addOns = (s.lateOrderFee === 'Yes' ? (pricing?.apLateOrder || 0) : 0) +
            (s.lateTestingFee === 'Yes' ? (pricing?.apLateTest || 0) : 0) +
            (s.unusedFee === 'Yes' ? (pricing?.apUnused || 0) : 0);
        return { base, addOns, total: base + addOns };
    };

    const handleGroupBillingToggle = async (groupTests, currentAllBilled) => {
        try {
            const batch = writeBatch(db);
            const newValue = !currentAllBilled;
            groupTests.forEach(t => {
                batch.update(doc(db, 'ap_registrations', t.id), { isBilledFeb: newValue, lastUpdated: serverTimestamp() });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error updating group billing status:", error);
        }
    };

    const handleNoteChange = async (regId, field, note) => {
        try {
            await updateDoc(doc(db, 'ap_registrations', regId), { [field]: note, lastUpdated: serverTimestamp() });
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
        }
    };

    const filtered = students.filter(s =>
        `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.email?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groupedStudents = filtered.reduce((acc, s) => {
        const key = `${s.lastName}_${s.firstName}_${s.email}`;
        if (!acc[key]) acc[key] = { firstName: s.firstName, lastName: s.lastName, email: s.email, grade: s.grade, tests: [] };
        acc[key].tests.push(s);
        return acc;
    }, {});

    const sortedGroups = Object.values(groupedStudents).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    const totals = filtered.reduce((acc, s) => {
        const fees = calculateFees(s);
        acc.base += fees.base;
        acc.addOns += fees.addOns;
        acc.total += fees.total;
        return acc;
    }, { base: 0, addOns: 0, total: 0 });

    const exportToCSV = () => {
        const rows = [["Student Name", "Grade", "Course", "Test Fee", "Add-ons", "Total Cost", "Billed", "BO Notes", "Student Notes"]];
        sortedGroups.forEach(group => {
            group.tests.forEach(s => {
                const { base, addOns, total } = calculateFees(s);
                rows.push([
                    `"${s.lastName}, ${s.firstName}"`, s.grade, `"${s.course}"`, base, addOns, total, s.isBilledFeb ? 'Yes' : 'No',
                    `"${s.boNotes || ''}"`, `"${s.studentNotes || ''}"`
                ]);
            });
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `AP_Billing_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div style={{ padding: '24px', color: 'var(--fa-warm-gray)' }}>Loading AP Billing...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel no-print" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--fa-dark-blue)' }}>AP Billing Clearinghouse</h2>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Cycle:</span>
                        <input
                            type="text"
                            value={localCycle}
                            onChange={(e) => setLocalCycle(e.target.value)}
                            onBlur={() => onCycleChange(localCycle)}
                            style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '13px', fontWeight: 'bold', color: 'var(--fa-blue)', width: '200px' }}
                        />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <input
                        type="text"
                        placeholder="Search student or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', width: '250px' }}
                    />
                    <button onClick={exportToCSV} style={{ padding: '10px 16px', background: 'white', color: 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📥 Export CSV
                    </button>
                    <button onClick={() => window.print()} style={{ padding: '10px 16px', background: 'white', color: 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        🖨️ Print Sheet
                    </button>
                    <div style={{ padding: '8px 16px', background: 'rgba(0, 70, 139, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 70, 139, 0.1)', textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>Total Revenue</div>
                        <div style={{ fontSize: '20px', fontWeight: 'bold', color: 'var(--fa-blue)' }}>${totals.total.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Student</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Course</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Fee</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Add-ons</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Total</th>
                            <th style={{ textAlign: 'center', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Billed</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedGroups.map(group => {
                            const studentSubtotal = group.tests.reduce((acc, t) => acc + calculateFees(t).total, 0);
                            const allBilled = group.tests.every(t => t.isBilledFeb);
                            const hasMultiple = group.tests.length > 1;

                            return (
                                <React.Fragment key={`${group.lastName}_${group.firstName}_${group.email}`}>
                                    {group.tests.map((s, idx) => {
                                        const { base, addOns, total } = calculateFees(s);
                                        return (
                                            <tr key={s.id} style={{ borderBottom: hasMultiple && idx < group.tests.length - 1 ? '1px solid #eee' : 'none', background: 'white' }}>
                                                <td style={{ padding: '16px 24px' }}>
                                                    {idx === 0 && (
                                                        <>
                                                            <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{s.lastName}, {s.firstName}</div>
                                                            <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)' }}>Grade {s.grade}</div>
                                                        </>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>{s.course}</td>
                                                <td style={{ padding: '16px 24px' }}>${base}</td>
                                                <td style={{ padding: '16px 24px', color: addOns > 0 ? 'var(--fa-red)' : 'inherit' }}>
                                                    ${addOns} {addOns > 0 && <span style={{ fontSize: '10px' }}>({(s.lateOrderFee === 'Yes' ? 'L' : '')}{(s.lateTestingFee === 'Yes' ? 'T' : '')}{(s.unusedFee === 'Yes' ? 'C' : '')})</span>}
                                                </td>
                                                <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>${total}</td>
                                                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                    {!hasMultiple && (
                                                        <input type="checkbox" checked={s.isBilledFeb || false} onChange={() => handleGroupBillingToggle([s], s.isBilledFeb)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 24px' }}>
                                                    {!hasMultiple && (
                                                        <input type="text" defaultValue={s.boNotes || ''} onBlur={(e) => handleNoteChange(s.id, 'boNotes', e.target.value)} placeholder="Add note..." style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none', width: '100%', fontSize: '12px' }} />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    
                                    {/* Subtotal Row */}
                                    <tr style={{ background: 'rgba(0, 70, 139, 0.02)', borderBottom: '2px solid var(--glass-border)' }}>
                                        <td colSpan="2" style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{group.lastName}, {group.firstName} Subtotal:</td>
                                        <td colSpan="2"></td>
                                        <td style={{ padding: '12px 24px', fontWeight: 'bold', fontSize: '15px', color: 'var(--fa-blue)' }}>${studentSubtotal}</td>
                                        <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                                            {hasMultiple && (
                                                <input type="checkbox" checked={allBilled} onChange={() => handleGroupBillingToggle(group.tests, allBilled)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                            )}
                                        </td>
                                        <td style={{ padding: '12px 24px' }}>
                                            <input type="text" defaultValue={group.tests[0]?.studentNotes || ''} onBlur={(e) => handleNoteChange(group.tests[0].id, 'studentNotes', e.target.value)} placeholder="Add student-level note..." style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none', width: '100%', fontSize: '12px', fontWeight: 'bold' }} />
                                        </td>
                                    </tr>
                                </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <style>{`
                @media print {
                    @page { size: landscape; margin: 1cm; }
                    .no-print, nav, aside { display: none !important; }
                    body, #root, main { height: auto !important; overflow: visible !important; position: static !important; }
                    input[type="text"] { border: none !important; background: transparent !important; }
                }
            `}</style>
        </div>
    );
}

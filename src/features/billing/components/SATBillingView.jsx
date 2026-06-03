import React, { useEffect, useState } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';

export default function SATBillingView({ cycle, onCycleChange, pricing }) {
    const [registrations, setRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [localCycle, setLocalCycle] = useState(cycle);

    useEffect(() => { setLocalCycle(cycle); }, [cycle]);

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'sat_registrations'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setRegistrations(data);
            setLoading(false);
        });
        return unsubscribe;
    }, []);

    const calculateFee = (r) => {
        return r.waiverEligible === 'Yes' ? 0 : (r.testType === 'SAT' ? (pricing?.satStandard || 60) : (pricing?.satReduced || 18));
    };

    const handleBillingToggle = async (regId, isBilled) => {
        try {
            await updateDoc(doc(db, 'sat_registrations', regId), { billed: isBilled, lastUpdated: serverTimestamp() });
        } catch (error) {
            console.error("Error updating billing status:", error);
        }
    };

    const handleNoteChange = async (regId, note) => {
        try {
            await updateDoc(doc(db, 'sat_registrations', regId), { boNotes: note, lastUpdated: serverTimestamp() });
        } catch (error) {
            console.error("Error updating note:", error);
        }
    };

    const baseFiltered = registrations.filter(r => {
        const matchesSearch = `${r.firstName} ${r.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || r.email?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'all' || r.studentType === filterType;
        const isActuallyBilled = r.billed || (r.paymentTender !== 'Account' && r.submittedToBO);
        const matchesStatus = filterStatus === 'all' || (filterStatus === 'billed' && isActuallyBilled) || (filterStatus === 'pending' && !isActuallyBilled);
        return matchesSearch && matchesType && matchesStatus;
    });

    const grouped = baseFiltered.reduce((acc, r) => {
        const key = `${r.lastName}_${r.firstName}_${r.email}`;
        if (!acc[key]) acc[key] = { firstName: r.firstName, lastName: r.lastName, email: r.email, studentType: r.studentType, tests: [] };
        acc[key].tests.push(r);
        return acc;
    }, {});

    const sortedGroups = Object.values(grouped).sort((a, b) => a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName));

    const totals = registrations.reduce((acc, r) => {
        const fee = calculateFee(r);
        acc.total += fee;
        if (r.studentType === 'boarding') acc.boarding += fee;
        else if (r.studentType === 'commuter') acc.commuter += fee;
        else acc.day += fee;
        return acc;
    }, { boarding: 0, day: 0, commuter: 0, total: 0 });

    const exportToCSV = () => {
        const rows = [["Last Name", "First Name", "Email", "Test Exam", "Student Type", "Payment Option", "Payment Received", "Fee Amount", "Billed/Paid", "Business Office Notes"]];
        baseFiltered.forEach(r => {
            rows.push([
                `"${r.lastName || ''}"`, `"${r.firstName || ''}"`, `"${r.email || ''}"`, `"${r.testType || ''}"`, `"${r.studentType || ''}"`,
                `"${r.paymentTender || (r.studentType === 'boarding' ? 'Account' : '')}"`, r.paymentRecd === 'Yes' ? 'Yes' : 'No',
                calculateFee(r), (r.billed || (r.paymentTender !== 'Account' && r.submittedToBO)) ? 'Yes' : 'No', `"${r.boNotes || ''}"`
            ]);
        });
        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `SAT_Billing_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div style={{ padding: '24px', color: 'var(--fa-warm-gray)' }}>Loading SAT Billing...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="glass-panel no-print" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'var(--fa-dark-blue)' }}>SAT / PSAT Billing Clearinghouse</h2>
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

                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <button onClick={exportToCSV} style={{ padding: '10px 16px', background: 'white', color: 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        📥 Export CSV
                    </button>
                    <button onClick={() => window.print()} style={{ padding: '10px 16px', background: 'white', color: 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>
                        🖨️ Print Sheet
                    </button>
                    <div style={{ padding: '8px 12px', background: 'rgba(0, 70, 139, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 70, 139, 0.1)', textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>Boarding</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: 'var(--fa-blue)' }}>${totals.boarding.toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '8px 12px', background: 'rgba(249, 171, 0, 0.05)', borderRadius: '8px', border: '1px solid rgba(249, 171, 0, 0.2)', textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: '#f9ab00', fontWeight: 'bold', textTransform: 'uppercase' }}>Commuter</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#f9ab00' }}>${totals.commuter.toLocaleString()}</div>
                    </div>
                    <div style={{ padding: '8px 12px', background: 'white', borderRadius: '8px', border: '1px solid var(--glass-border)', textAlign: 'right' }}>
                        <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>District Day</div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#444' }}>${totals.day.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <div className="glass-panel no-print" style={{ padding: '16px 24px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <input type="text" placeholder="Search student or email..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', width: '250px' }} />
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', background: 'white' }}>
                    <option value="all">All Student Types</option>
                    <option value="boarding">Boarding Only</option>
                    <option value="commuter">Commuter Day Only</option>
                    <option value="day">District Day Only</option>
                </select>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', background: 'white' }}>
                    <option value="all">All Statuses</option>
                    <option value="billed">Billed/Paid Only</option>
                    <option value="pending">Pending Only</option>
                </select>
            </div>

            <div className="glass-panel" style={{ padding: '0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Student</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Test Exam</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Student Type</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Payment Info</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Fee</th>
                            <th style={{ textAlign: 'center', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Billed/Paid</th>
                            <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', borderBottom: '1px solid var(--glass-border)', background: '#f8f9fa' }}>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedGroups.map(group => {
                            const studentSubtotal = group.tests.reduce((acc, t) => acc + calculateFee(t), 0);
                            const hasMultiple = group.tests.length > 1;

                            return (
                                <React.Fragment key={`${group.lastName}_${group.firstName}_${group.email}`}>
                                    {group.tests.map((t, idx) => {
                                        const isBilled = t.billed || (t.paymentTender !== 'Account' && t.submittedToBO);
                                        const typeColor = t.studentType === 'boarding' ? 'var(--fa-blue)' : (t.studentType === 'commuter' ? '#f9ab00' : '#1e8e3e');

                                        return (
                                            <tr key={t.id} style={{ borderBottom: hasMultiple && idx < group.tests.length - 1 ? '1px solid #eee' : 'none', background: 'white' }}>
                                                <td style={{ padding: '16px 24px' }}>
                                                    {idx === 0 && <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{t.lastName}, {t.firstName}</div>}
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>{t.testType}</td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <span style={{ fontSize: '10px', textTransform: 'uppercase', color: typeColor, fontWeight: 'bold', padding: '4px 8px', background: `${typeColor}15`, borderRadius: '12px' }}>
                                                        {t.studentType}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>
                                                        {t.paymentTender || (t.studentType === 'boarding' ? 'Account' : '-')}
                                                    </div>
                                                    {t.paymentRecd === 'Yes' && (
                                                        <div style={{ fontSize: '11px', color: '#1e8e3e', marginTop: '4px' }}>
                                                            Rec'd {t.checkNumber ? `#${t.checkNumber}` : ''} <br/> ${t.paymentAmount} | {t.paymentDate}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px', fontWeight: 'bold' }}>${calculateFee(t)}</td>
                                                <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                    {!hasMultiple && (
                                                        <input type="checkbox" checked={isBilled || false} onChange={() => handleBillingToggle(t.id, !t.billed)} style={{ cursor: 'pointer', transform: 'scale(1.2)' }} />
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 24px' }}>
                                                    {!hasMultiple && (
                                                        <input type="text" defaultValue={t.boNotes || ''} onBlur={(e) => handleNoteChange(t.id, e.target.value)} placeholder="Add note..." style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none', width: '100%', fontSize: '12px' }} />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}

                                    {hasMultiple && (
                                        <tr style={{ background: 'rgba(0, 70, 139, 0.02)', borderBottom: '2px solid var(--glass-border)' }}>
                                            <td colSpan="2" style={{ padding: '12px 24px', textAlign: 'right', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{group.lastName}, {group.firstName} Subtotal:</td>
                                            <td colSpan="2"></td>
                                            <td style={{ padding: '12px 24px', fontWeight: 'bold', fontSize: '15px', color: 'var(--fa-blue)' }}>${studentSubtotal}</td>
                                            <td style={{ padding: '12px 24px', textAlign: 'center' }}>
                                                <input
                                                    type="checkbox"
                                                    checked={group.tests.every(t => t.billed || (t.studentType !== 'boarding' && t.submittedToBO))}
                                                    onChange={async () => {
                                                        const allBilled = group.tests.every(t => t.billed);
                                                        const batch = writeBatch(db);
                                                        group.tests.forEach(test => batch.update(doc(db, 'sat_registrations', test.id), { billed: !allBilled }));
                                                        await batch.commit();
                                                    }}
                                                    style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                                                />
                                            </td>
                                            <td style={{ padding: '12px 24px' }}>
                                                <input type="text" defaultValue={group.tests[0]?.boNotes || ''} onBlur={(e) => handleNoteChange(group.tests[0].id, e.target.value)} placeholder="Add student note..." style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)', outline: 'none', width: '100%', fontSize: '12px', fontWeight: 'bold' }} />
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
                    @page { size: landscape; margin: 1cm; }
                    .no-print, nav, aside { display: none !important; }
                    body, #root, main { height: auto !important; overflow: visible !important; position: static !important; }
                    input[type="text"] { border: none !important; background: transparent !important; }
                }
            `}</style>
        </div>
    );
}

import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, query, getDocs } from 'firebase/firestore';
import { db } from '../../../firebase';

export default function ActionItemsHub() {
    const [students, setStudents] = useState([]);
    const [seatingCharts, setSeatingCharts] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let masterLoaded = false, apLoaded = false, satLoaded = false, chartsLoaded = false;
        const checkDone = () => { if (masterLoaded && apLoaded && satLoaded && chartsLoaded) setLoading(false); };

        const unsubMaster = onSnapshot(collection(db, 'master_students'), snap => {
            setStudents(prev => [...prev.filter(s => s.collectionSource !== 'master_students'), ...snap.docs.map(doc => ({ id: doc.id, ...doc.data(), collectionSource: 'master_students' }))]);
            masterLoaded = true; checkDone();
        });
        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), snap => {
            setStudents(prev => [...prev.filter(s => s.collectionSource !== 'ap_registrations'), ...snap.docs.map(doc => ({ id: doc.id, ...doc.data(), collectionSource: 'ap_registrations' }))]);
            apLoaded = true; checkDone();
        });
        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), snap => {
            setStudents(prev => [...prev.filter(s => s.collectionSource !== 'sat_registrations'), ...snap.docs.map(doc => ({ id: doc.id, ...doc.data(), collectionSource: 'sat_registrations' }))]);
            satLoaded = true; checkDone();
        });
        const unsubCharts = onSnapshot(collection(db, 'seating_charts'), snap => {
            setSeatingCharts(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            chartsLoaded = true; checkDone();
        });

        return () => { unsubMaster(); unsubAP(); unsubSAT(); unsubCharts(); };
    }, []);

    const alerts = useMemo(() => {
        if (loading) return { unassigned: [], conflicts: [], accommodations: [] };
        
        const unassigned = [];
        const conflicts = [];
        const accommodations = [];

        // Pre-compute assigned students from Seating Charts
        const chartAssignedStudentIds = new Set();
        seatingCharts.forEach(chart => {
            if (chart.assignedSeats) {
                Object.values(chart.assignedSeats).forEach(s => {
                    if (s.id) chartAssignedStudentIds.add(s.id);
                });
            }
        });

        // 1. Unassigned Students & 3. Missing Accommodations
        students.forEach(s => {
            // Check Accommodations
            if (s.hasAccommodations || s.accommodationsNeeded || (s.accommodations && s.accommodations.length > 0)) {
                const inferredCaseManager = s.caseManager || (s.advisor ? s.advisor.split(',')[0].trim() : null);
                if (!inferredCaseManager || !s.accommodations || s.accommodations.length === 0) {
                    accommodations.push({
                        student: s,
                        reason: !inferredCaseManager ? 'Missing Case Manager' : 'Missing Accommodation Details'
                    });
                }
            }

            // Check Unassigned (Only check AP and SAT since Master might not be taking a test)
            if (s.collectionSource === 'ap_registrations' || s.collectionSource === 'sat_registrations') {
                const isAssignedToChart = chartAssignedStudentIds.has(s.id);
                const isAssignedDirectly = s.assignedRoom && (s.assignedDate || s.isoDate);
                const hasMakeup = s.makeupRoom && s.makeupDate;

                if (!isAssignedToChart && !isAssignedDirectly && !hasMakeup) {
                    unassigned.push({
                        student: s,
                        test: s.apTestName || s.testType || 'Unknown Test'
                    });
                }
            }
        });

        // 2. Proctor Conflicts
        const proctorSchedule = {}; // date|session -> [proctorNames]
        seatingCharts.forEach(chart => {
            if (!chart.date) return;
            const session = chart.session || 'All Day';
            const key = `${chart.date}|${session}`;
            
            if (!proctorSchedule[key]) proctorSchedule[key] = [];
            
            if (chart.proctor && chart.proctor !== 'TBD') {
                proctorSchedule[key].push({
                    name: chart.proctor,
                    room: chart.roomId,
                    test: chart.apSubject || chart.testType || 'General'
                });
            }
            if (chart.monitor && chart.monitor !== 'None') {
                proctorSchedule[key].push({
                    name: chart.monitor,
                    room: chart.roomId,
                    test: chart.apSubject || chart.testType || 'General'
                });
            }
        });

        Object.keys(proctorSchedule).forEach(key => {
            const staffList = proctorSchedule[key];
            const nameCounts = {};
            staffList.forEach(staff => {
                if (!nameCounts[staff.name]) nameCounts[staff.name] = [];
                nameCounts[staff.name].push(staff);
            });

            Object.keys(nameCounts).forEach(name => {
                if (nameCounts[name].length > 1) {
                    const [date, session] = key.split('|');
                    conflicts.push({
                        name,
                        date,
                        session,
                        assignments: nameCounts[name] // Array of {room, test}
                    });
                }
            });
        });

        // Sort results
        unassigned.sort((a, b) => (a.student.lastName || '').localeCompare(b.student.lastName || ''));
        accommodations.sort((a, b) => (a.student.lastName || '').localeCompare(b.student.lastName || ''));

        return { unassigned, conflicts, accommodations };
    }, [students, seatingCharts, loading]);

    const totalAlerts = alerts.unassigned.length + alerts.conflicts.length + alerts.accommodations.length;

    if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>Scanning data for Action Items...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
            {/* Header */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--fa-dark-blue)' }}>Smart Alerts & Validation</h2>
                    <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '14px' }}>
                        Automated checks for missing assignments, proctor conflicts, and data gaps.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: totalAlerts > 0 ? 'rgba(217, 48, 37, 0.1)' : 'rgba(24, 128, 56, 0.1)', padding: '10px 16px', borderRadius: '12px', border: `1px solid ${totalAlerts > 0 ? '#d93025' : '#188038'}` }}>
                    <span style={{ fontSize: '20px' }}>{totalAlerts > 0 ? '⚠️' : '✅'}</span>
                    <span style={{ fontWeight: 'bold', color: totalAlerts > 0 ? '#d93025' : '#188038', fontSize: '16px' }}>
                        {totalAlerts} Action Items Found
                    </span>
                </div>
            </div>

            {totalAlerts === 0 && (
                <div className="glass-panel" style={{ padding: '64px', textAlign: 'center' }}>
                    <span style={{ fontSize: '64px', display: 'block', marginBottom: '16px' }}>🎉</span>
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--fa-dark-blue)' }}>All Clear!</h3>
                    <p style={{ margin: 0, color: 'var(--fa-warm-gray)' }}>There are no outstanding action items. Your testing data is perfectly valid.</p>
                </div>
            )}

            {alerts.conflicts.length > 0 && (
                <div className="glass-panel" style={{ overflow: 'hidden', borderLeft: '4px solid #d93025' }}>
                    <div style={{ padding: '16px 24px', backgroundColor: 'rgba(217, 48, 37, 0.05)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>🚨</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', color: '#d93025' }}>Proctor Conflicts ({alerts.conflicts.length})</h3>
                            <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>Staff double-booked at the same time.</div>
                        </div>
                    </div>
                    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {alerts.conflicts.map((c, i) => (
                            <div key={i} style={{ padding: '16px', background: '#fff', border: '1px solid #eee', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', fontSize: '15px' }}>{c.name}</div>
                                    <div style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>{c.date} • {c.session} Session</div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--fa-red)', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '4px' }}>Conflicting Assignments:</div>
                                    {c.assignments.map((a, j) => (
                                        <div key={j} style={{ fontSize: '13px', color: '#555' }}>Room {a.room} ({a.test})</div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {alerts.unassigned.length > 0 && (
                <div className="glass-panel" style={{ overflow: 'hidden', borderLeft: '4px solid #f29900' }}>
                    <div style={{ padding: '16px 24px', backgroundColor: 'rgba(242, 153, 0, 0.05)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>⚠️</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', color: '#f29900' }}>Unassigned Students ({alerts.unassigned.length})</h3>
                            <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>Registered for a test but missing a room assignment.</div>
                        </div>
                    </div>
                    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {alerts.unassigned.map((a, i) => (
                            <div key={i} style={{ padding: '16px', background: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', fontSize: '15px' }}>{a.student.lastName}, {a.student.firstName}</div>
                                <div style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>Grade {a.student.grade || 'N/A'}</div>
                                <div style={{ marginTop: '12px', padding: '6px 10px', background: 'rgba(242, 153, 0, 0.1)', color: '#f29900', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' }}>
                                    Missing: {a.test}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {alerts.accommodations.length > 0 && (
                <div className="glass-panel" style={{ overflow: 'hidden', borderLeft: '4px solid #1a73e8' }}>
                    <div style={{ padding: '16px 24px', backgroundColor: 'rgba(26, 115, 232, 0.05)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontSize: '20px' }}>⚡</span>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '16px', color: '#1a73e8' }}>Accommodation Gaps ({alerts.accommodations.length})</h3>
                            <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>Flagged for accommodations but missing case manager or details.</div>
                        </div>
                    </div>
                    <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                        {alerts.accommodations.map((a, i) => (
                            <div key={i} style={{ padding: '16px', background: '#fff', border: '1px solid #eee', borderRadius: '8px' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', fontSize: '15px' }}>{a.student.lastName}, {a.student.firstName}</div>
                                <div style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>Grade {a.student.grade || 'N/A'}</div>
                                <div style={{ marginTop: '12px', padding: '6px 10px', background: 'rgba(26, 115, 232, 0.1)', color: '#1a73e8', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', display: 'inline-block' }}>
                                    {a.reason}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

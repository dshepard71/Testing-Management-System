import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { decryptText } from '../../../utils/crypto';

export default function MakeupTracker() {
    const [masterStudents, setMasterStudents] = useState([]);
    const [apRegistrations, setApRegistrations] = useState([]);
    const [satRegistrations, setSatRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);

    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedStudents, setSelectedStudents] = useState(new Set());
    
    // Assignment form state
    const [makeupRoom, setMakeupRoom] = useState('');
    const [makeupDate, setMakeupDate] = useState('');
    const [makeupSession, setMakeupSession] = useState('Morning');

    useEffect(() => {
        let masterLoaded = false, apLoaded = false, satLoaded = false;
        const checkFinished = () => { if (masterLoaded && apLoaded && satLoaded) setLoading(false); };

        const unsubMaster = onSnapshot(collection(db, 'master_students'), snap => {
            setMasterStudents(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    stateId: decryptText(data.stateId || ''),
                    dob: decryptText(data.dob || ''),
                    collectionSource: 'master_students'
                };
            }));
            masterLoaded = true; checkFinished();
        });
        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), snap => {
            setApRegistrations(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    stateId: decryptText(data.stateId || ''),
                    collectionSource: 'ap_registrations'
                };
            }));
            apLoaded = true; checkFinished();
        });
        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), snap => {
            setSatRegistrations(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    stateId: decryptText(data.stateId || ''),
                    collectionSource: 'sat_registrations'
                };
            }));
            satLoaded = true; checkFinished();
        });

        const timer = setTimeout(() => setLoading(false), 2000);
        return () => { unsubMaster(); unsubAP(); unsubSAT(); clearTimeout(timer); };
    }, []);

    const allStudents = useMemo(() => [...masterStudents, ...apRegistrations, ...satRegistrations], [masterStudents, apRegistrations, satRegistrations]);

    // Gather absentees
    const absentees = useMemo(() => {
        const dateFilter = selectedDate.trim();
        const rawList = [];

        allStudents.forEach(s => {
            if (s.attendanceStatus !== 'Absent') return;
            
            // Check if they were absent on the selected date
            let testMissed = null;
            if (s.attendanceTimestamp && s.attendanceTimestamp.startsWith(dateFilter)) {
                // If we have a timestamp, use it
                testMissed = s.testType || s.test || s.testCategory || 'Assigned Test';
            } else if (
                s.maine_science_date === dateFilter || s.maine_ty_math_date === dateFilter || 
                s.maine_ty_reading_date === dateFilter || s.assignedDate === dateFilter || 
                s.isoDate === dateFilter
            ) {
                testMissed = s.testType || s.test || 'Assigned Test';
            }

            if (testMissed) {
                rawList.push({ ...s, testMissed });
            }
        });

        // Consolidate duplicates
        const consolidatedMap = new Map();
        rawList.forEach(s => {
            const f = s.firstName || s.name?.split(' ')[0] || '';
            const l = s.lastName || s.name?.split(' ').pop() || '';
            const idKey = (s.stateId && s.stateId !== 'unknown') ? s.stateId : `${f}_${l}`;
            
            if (!consolidatedMap.has(idKey)) {
                consolidatedMap.set(idKey, { ...s, firstName: f, lastName: l, sourceRecords: [{ id: s.id, source: s.collectionSource }] });
            } else {
                consolidatedMap.get(idKey).sourceRecords.push({ id: s.id, source: s.collectionSource });
            }
        });

        return Array.from(consolidatedMap.values()).sort((a, b) => a.lastName.localeCompare(b.lastName));
    }, [allStudents, selectedDate]);

    const handleToggleSelect = (idKey) => {
        const next = new Set(selectedStudents);
        if (next.has(idKey)) next.delete(idKey);
        else next.add(idKey);
        setSelectedStudents(next);
    };

    const handleSelectAll = () => {
        if (selectedStudents.size === absentees.length) setSelectedStudents(new Set());
        else setSelectedStudents(new Set(absentees.map(a => (a.stateId && a.stateId !== 'unknown') ? a.stateId : `${a.firstName}_${a.lastName}`)));
    };

    const handleAssignMakeups = async () => {
        if (!makeupRoom || !makeupDate) {
            alert("Please specify a Makeup Room and Date.");
            return;
        }
        if (selectedStudents.size === 0) {
            alert("Please select at least one student to assign.");
            return;
        }

        try {
            const batch = writeBatch(db);
            absentees.forEach(a => {
                const idKey = (a.stateId && a.stateId !== 'unknown') ? a.stateId : `${a.firstName}_${a.lastName}`;
                if (selectedStudents.has(idKey)) {
                    a.sourceRecords.forEach(target => {
                        batch.update(doc(db, target.source, target.id), {
                            makeupRoom,
                            makeupDate,
                            makeupSession,
                            attendanceStatus: 'Makeup Scheduled', // Reset attendance status
                            testCategory: a.testMissed // Retain the test they missed
                        });
                    });
                }
            });

            await batch.commit();
            alert(`Successfully scheduled makeups for ${selectedStudents.size} students!`);
            setSelectedStudents(new Set());
            setMakeupRoom('');
            setMakeupDate('');
        } catch (error) {
            console.error("Error scheduling makeups:", error);
            alert("Failed to schedule makeups.");
        }
    };

    const handleEmailAbsentees = () => {
        const emails = [];
        absentees.forEach(a => {
            if (a.email) emails.push(a.email.toLowerCase().trim());
        });

        if (emails.length === 0) {
            alert("None of the absentees for this date have an email address on file.");
            return;
        }

        const bccList = Array.from(new Set(emails)).join(',');
        const subject = encodeURIComponent("Important: Missed Exam - Scheduling Makeup");
        const body = encodeURIComponent(
            "Hello,\n\nOur records indicate you were absent for your scheduled exam today. Please reply to this email as soon as possible to coordinate your makeup exam.\n\nThank you,\nTesting Coordinator"
        );

        window.open(`mailto:?bcc=${bccList}&subject=${subject}&body=${body}`, '_blank');
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
            {/* Header */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--fa-dark-blue)' }}>Makeup Tracker</h2>
                    <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '14px' }}>
                        Coordinate makeup testing for students marked Absent.
                    </p>
                </div>

                <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)', textTransform: 'uppercase' }}>Filter by Absence Date</label>
                        <input type="date" value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setSelectedStudents(new Set()); }} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                    </div>
                    
                    <button 
                        onClick={handleEmailAbsentees}
                        style={{ padding: '10px 16px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        ✉️ Email Absentees (BCC)
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>Loading Absentees...</div>
            ) : (
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                    
                    {/* Absentees List */}
                    <div className="glass-panel" style={{ flex: 2, padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>Absentees: {selectedDate}</h3>
                            <span style={{ padding: '4px 12px', background: 'rgba(217, 48, 37, 0.1)', color: '#d93025', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }}>
                                {absentees.length} Total
                            </span>
                        </div>

                        {absentees.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fa-warm-gray)', border: '1px dashed var(--glass-border)', borderRadius: '8px' }}>
                                No absentees recorded for this date.
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--glass-border)' }}>
                                            <input type="checkbox" checked={selectedStudents.size === absentees.length && absentees.length > 0} onChange={handleSelectAll} style={{ cursor: 'pointer' }} />
                                        </th>
                                        <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--glass-border)', color: 'var(--fa-warm-gray)' }}>Student</th>
                                        <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--glass-border)', color: 'var(--fa-warm-gray)' }}>Test Missed</th>
                                        <th style={{ textAlign: 'left', padding: '12px', borderBottom: '2px solid var(--glass-border)', color: 'var(--fa-warm-gray)' }}>Email</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {absentees.map(a => {
                                        const idKey = (a.stateId && a.stateId !== 'unknown') ? a.stateId : `${a.firstName}_${a.lastName}`;
                                        const isSelected = selectedStudents.has(idKey);
                                        return (
                                            <tr key={idKey} style={{ background: isSelected ? 'rgba(0, 70, 139, 0.05)' : 'transparent', borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s' }}>
                                                <td style={{ padding: '12px' }}>
                                                    <input type="checkbox" checked={isSelected} onChange={() => handleToggleSelect(idKey)} style={{ cursor: 'pointer' }} />
                                                </td>
                                                <td style={{ padding: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{a.lastName}, {a.firstName}</td>
                                                <td style={{ padding: '12px' }}>{a.testMissed}</td>
                                                <td style={{ padding: '12px', color: 'var(--fa-warm-gray)', fontSize: '12px' }}>{a.email || 'None'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Scheduling Panel */}
                    <div className="glass-panel" style={{ flex: 1, padding: '24px', position: 'sticky', top: '24px' }}>
                        <h3 style={{ margin: '0 0 20px 0', color: 'var(--fa-dark-blue)' }}>Schedule Makeup</h3>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ padding: '16px', background: 'rgba(0, 70, 139, 0.05)', borderRadius: '8px', border: '1px solid rgba(0, 70, 139, 0.1)', textAlign: 'center' }}>
                                <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--fa-blue)' }}>{selectedStudents.size}</div>
                                <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', textTransform: 'uppercase', fontWeight: 'bold' }}>Students Selected</div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Makeup Room</label>
                                <input type="text" placeholder="e.g. Library" value={makeupRoom} onChange={e => setMakeupRoom(e.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Makeup Date</label>
                                <input type="date" value={makeupDate} onChange={e => setMakeupDate(e.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Session</label>
                                <select value={makeupSession} onChange={e => setMakeupSession(e.target.value)} style={{ padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', background: 'white' }}>
                                    <option value="Morning">Morning</option>
                                    <option value="Afternoon">Afternoon</option>
                                    <option value="All Day">All Day</option>
                                </select>
                            </div>

                            <button 
                                onClick={handleAssignMakeups}
                                disabled={selectedStudents.size === 0}
                                style={{ 
                                    padding: '12px', background: selectedStudents.size === 0 ? '#ccc' : 'var(--fa-red)', 
                                    color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: selectedStudents.size === 0 ? 'default' : 'pointer',
                                    marginTop: '8px'
                                }}
                            >
                                Assign Selected to Makeup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

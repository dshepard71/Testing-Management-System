import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { decryptText } from '../../../utils/crypto';

export default function AttendanceCheckin({ testType = 'all' }) {
    const { user, userProfile } = useAuth();
    const [masterStudents, setMasterStudents] = useState([]);
    const [apRegistrations, setApRegistrations] = useState([]);
    const [satRegistrations, setSatRegistrations] = useState([]);
    const [seatingCharts, setSeatingCharts] = useState([]);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRoom, setSelectedRoom] = useState('');
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [selectedSession, setSelectedSession] = useState('Morning');

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
                    accommodations: decryptText(data.accommodations || ''),
                    accommodationNotes: decryptText(data.accommodationNotes || ''),
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
                    accommodations: decryptText(data.accommodations || ''),
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
                    accommodations: decryptText(data.accommodations || ''),
                    collectionSource: 'sat_registrations'
                };
            }));
            satLoaded = true; checkFinished();
        });
        const unsubCharts = onSnapshot(collection(db, 'seating_charts'), snap => {
            setSeatingCharts(snap.docs.map(doc => {
                const data = doc.data();
                const decryptedAssignedSeats = {};
                if (data.assignedSeats) {
                    Object.entries(data.assignedSeats).forEach(([seatId, studentInfo]) => {
                        decryptedAssignedSeats[seatId] = {
                            ...studentInfo,
                            accommodations: decryptText(studentInfo.accommodations || '')
                        };
                    });
                }
                return {
                    id: doc.id,
                    ...data,
                    assignedSeats: decryptedAssignedSeats
                };
            }));
        });

        const timer = setTimeout(() => setLoading(false), 2000);
        return () => { unsubMaster(); unsubAP(); unsubSAT(); unsubCharts(); clearTimeout(timer); };
    }, []);

    const allStudents = useMemo(() => [...masterStudents, ...apRegistrations, ...satRegistrations], [masterStudents, apRegistrations, satRegistrations]);

    const rooms = useMemo(() => {
        const allRooms = new Set();
        const dateFilter = selectedDate.trim();
        const sessionFilter = selectedSession.trim().toLowerCase();

        seatingCharts.forEach(c => {
            if (c.roomId && (c.date || '').trim() === dateFilter) {
                const cSession = c.session || 'All Day';
                if (sessionFilter === 'all day' || cSession === 'All Day' || cSession.toLowerCase().includes(sessionFilter)) {
                    allRooms.add(c.roomId);
                }
            }
        });

        allStudents.forEach(s => {
            const aDate = (s.assignedDate || '').trim();
            const aIsoDate = (s.isoDate || '').trim();
            const aRoom = (s.assignedRoom || '').trim();
            const aSession = (s.session || 'Morning').toLowerCase();

            if (aRoom && (aDate === dateFilter || aIsoDate === dateFilter)) {
                if (sessionFilter === 'all day' || aSession === 'all day' || aSession.includes(sessionFilter) || sessionFilter.includes(aSession)) {
                    allRooms.add(aRoom);
                }
            }

            const mDate = (s.makeupDate || '').trim();
            const mRoom = (s.makeupRoom || '').trim();
            const mSession = (s.makeupSession || 'Morning').toLowerCase();

            if (mRoom && mDate === dateFilter) {
                if (sessionFilter === 'all day' || mSession === 'all day' || mSession.includes(sessionFilter) || sessionFilter.includes(mSession)) {
                    allRooms.add(mRoom);
                }
            }
        });

        return Array.from(allRooms).sort();
    }, [allStudents, seatingCharts, selectedDate, selectedSession]);

    const checkinList = useMemo(() => {
        if (!selectedRoom) return [];
        const roomFilter = selectedRoom.trim().toLowerCase();
        const dateFilter = selectedDate.trim();
        const sessionFilter = selectedSession.trim().toLowerCase();

        const chartAssignedIds = new Set();
        const chartMetadata = new Map();

        seatingCharts.forEach(chart => {
            if ((chart.roomId || '').trim().toLowerCase() === roomFilter && (chart.date || '').trim() === dateFilter) {
                const cSession = chart.session || 'All Day';
                if (sessionFilter !== 'all day' && cSession !== 'All Day' && !cSession.toLowerCase().includes(sessionFilter)) return;

                if (chart.assignedSeats) {
                    Object.values(chart.assignedSeats).forEach(s => {
                        if (s.id) {
                            chartAssignedIds.add(s.id);
                            chartMetadata.set(s.id, { test: chart.testType || 'Chart', session: cSession });
                        }
                    });
                }
            }
        });

        const rawList = allStudents.map(s => {
            let matchedTest = null, matchedSession = null;

            const mkRoom = (s.makeupRoom || '').trim().toLowerCase();
            const mkDate = (s.makeupDate || '').trim();
            if (mkRoom === roomFilter && mkDate === dateFilter) {
                matchedTest = (s.testCategory || 'Makeup') + ' (Makeup)';
                matchedSession = s.makeupSession || 'Morning';
            }

            if (!matchedTest && chartAssignedIds.has(s.id)) {
                const meta = chartMetadata.get(s.id);
                matchedTest = meta.test;
                matchedSession = meta.session;
            }

            if (!matchedTest) {
                const aRoom = (s.assignedRoom || '').trim().toLowerCase();
                const aDate = (s.assignedDate || '').trim();
                const isoDate = (s.isoDate || '').trim();
                
                if (aRoom === roomFilter && (aDate === dateFilter || isoDate === dateFilter)) {
                    matchedTest = s.testType || s.test || 'Test';
                    matchedSession = s.session || 'Morning';
                }
            }

            if (matchedTest) {
                const mSess = matchedSession || 'All Day';
                if (mSess !== 'All Day' && sessionFilter !== 'all day' && !mSess.toLowerCase().includes(sessionFilter) && !sessionFilter.includes(mSess.toLowerCase())) {
                    return null;
                }
                return { ...s, matchedTest };
            }
            return null;
        }).filter(Boolean);

        const consolidatedMap = new Map();
        rawList.forEach(s => {
            const f = (s.firstName || s.name?.split(' ')[0] || '').trim();
            const l = (s.lastName || s.name?.split(' ').slice(1).join(' ') || '').trim();
            const emailKey = (s.email || '').trim().toLowerCase();
            const stateIdKey = (s.stateId && s.stateId !== 'unknown' && s.stateId.trim() !== '') ? s.stateId.trim() : null;
            // Primary deduplication key: email if available, else stateId, else normalized first_last
            const idKey = emailKey || stateIdKey || `${f.toLowerCase()}_${l.toLowerCase()}`;
            
            if (!consolidatedMap.has(idKey)) {
                consolidatedMap.set(idKey, { ...s, firstName: f, lastName: l, sourceRecords: [{ id: s.id, source: s.collectionSource || 'master_students' }] });
            } else {
                const existing = consolidatedMap.get(idKey);
                if (s.attendanceStatus === 'Present') existing.attendanceStatus = 'Present';
                else if (s.attendanceStatus === 'Absent' && existing.attendanceStatus !== 'Present') existing.attendanceStatus = 'Absent';
                // Merge matchedTest if existing was generic
                if (s.matchedTest && (!existing.matchedTest || existing.matchedTest === 'General' || existing.matchedTest === 'Test')) {
                    existing.matchedTest = s.matchedTest;
                }
                existing.sourceRecords.push({ id: s.id, source: s.collectionSource || 'master_students' });
            }
        });

        return Array.from(consolidatedMap.values()).sort((a, b) => a.lastName.localeCompare(b.lastName));
    }, [allStudents, seatingCharts, selectedRoom, selectedDate, selectedSession]);

    const roomTestName = useMemo(() => {
        if (!selectedRoom || !selectedDate) return 'General Testing';
        const matchedChart = seatingCharts.find(c => 
            (c.roomId || '').trim().toLowerCase() === selectedRoom.trim().toLowerCase() && 
            (c.date || '').trim() === selectedDate.trim() && 
            (c.session || 'All Day') === (selectedSession === 'All Day' ? (c.session || 'All Day') : selectedSession)
        );
        
        if (matchedChart) {
            return matchedChart.apSubject || matchedChart.testType || 'General Testing';
        } else if (checkinList.length > 0) {
            return checkinList[0].matchedTest || 'General Testing';
        }
        return 'General Testing';
    }, [seatingCharts, checkinList, selectedRoom, selectedDate, selectedSession]);

    const handleToggleAttendance = async (studentId, status, sourceRecords) => {
        try {
            const batch = writeBatch(db);
            sourceRecords.forEach(target => {
                batch.update(doc(db, target.source, target.id), { 
                    attendanceStatus: status,
                    attendanceTimestamp: status === 'Present' ? new Date().toISOString() : null
                });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error updating attendance:", error);
            alert("Failed to update attendance.");
        }
    };

    const generateAttendanceReportText = () => {
        const presentStudents = [];
        const absentStudents = [];

        checkinList.forEach(s => {
            const status = s.attendanceStatus || 'Not Checked';
            const line = `- ${s.lastName}, ${s.firstName} (Grade ${s.grade || 'N/A'}) - Room: ${selectedRoom} - Test: ${s.matchedTest || 'General'}`;
            
            if (status === 'Absent') {
                absentStudents.push(line);
            } else {
                presentStudents.push(line);
            }
        });

        presentStudents.sort();
        absentStudents.sort();

        const reportLines = [
            `Testing Attendance Report - ${selectedRoom} (${selectedSession} Session)`,
            `Test: ${roomTestName}`,
            `Date: ${selectedDate}`,
            ``,
            `=== ABSENT STUDENTS (${absentStudents.length}) ===`,
            absentStudents.length > 0 ? absentStudents.join('\n') : 'None',
            ``,
            `=== PRESENT STUDENTS (${presentStudents.length}) ===`,
            presentStudents.length > 0 ? presentStudents.join('\n') : 'None'
        ];

        return {
            subject: `${roomTestName} Attendance: ${selectedRoom} (${selectedSession}) - ${selectedDate}`,
            bodyText: reportLines.join('\n')
        };
    };

    const [copiedReport, setCopiedReport] = useState(false);

    const handleCopyReport = () => {
        if (!selectedDate || checkinList.length === 0) {
            alert("No students to copy for this room.");
            return;
        }
        const { subject, bodyText } = generateAttendanceReportText();
        const fullClipboard = `Subject: ${subject}\n\n${bodyText}`;
        navigator.clipboard.writeText(fullClipboard).then(() => {
            setCopiedReport(true);
            setTimeout(() => setCopiedReport(false), 3000);
        }).catch(err => {
            console.error("Clipboard copy failed:", err);
            alert("Could not copy automatically. Please select text manually.");
        });
    };

    const handleEmailAttendance = async () => {
        if (!selectedDate) {
            alert("Please select a Date first.");
            return;
        }

        if (checkinList.length === 0) {
            alert("No students to report for this room.");
            return;
        }

        try {
            setSaving(true);
            // Send directly to the logged-in user so they can review and forward
            const recipientEmail = (user && user.email) ? user.email : 'dshepard@fryeburgacademy.org';

            const { subject, bodyText } = generateAttendanceReportText();

            // Try direct Gmail compose link first
            const encodedSubject = encodeURIComponent(subject);
            const encodedBody = encodeURIComponent(bodyText);
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodedSubject}&body=${encodedBody}`;

            // Copy to clipboard in background as an immediate fallback
            try {
                await navigator.clipboard.writeText(`Subject: ${subject}\n\n${bodyText}`);
            } catch (clipErr) {
                // Ignore clipboard permission issues if any
            }

            const win = window.open(gmailUrl, '_blank');
            if (!win || win.closed || typeof win.closed === 'undefined') {
                // If popup was blocked or failed, fall back to mailto:
                window.location.href = `mailto:${recipientEmail}?subject=${encodedSubject}&body=${encodedBody}`;
            }

        } catch (error) {
            console.error("Error generating attendance email:", error);
            alert("Failed to generate email. Report copied to clipboard instead!");
        } finally {
            setSaving(false);
        }
    };

    const handleMarkAllRemainingPresent = async () => {
        if (!window.confirm("Are you sure you want to mark ALL unchecked students in this room as Present?")) return;
        
        const unchecked = checkinList.filter(s => s.attendanceStatus !== 'Present' && s.attendanceStatus !== 'Absent');
        if (unchecked.length === 0) return;

        try {
            const batch = writeBatch(db);
            unchecked.forEach(s => {
                s.sourceRecords.forEach(target => {
                    batch.update(doc(db, target.source, target.id), { 
                        attendanceStatus: 'Present',
                        attendanceTimestamp: new Date().toISOString()
                    });
                });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error mass updating:", error);
            alert("Failed to mass update attendance.");
        }
    };

    const handleResetRoomAttendance = async () => {
        if (!window.confirm(`Reset attendance for all students in ${selectedRoom}? This will change everyone back to Unchecked.`)) return;

        try {
            const batch = writeBatch(db);
            checkinList.forEach(s => {
                s.sourceRecords.forEach(target => {
                    batch.update(doc(db, target.source, target.id), { 
                        attendanceStatus: null,
                        attendanceTimestamp: null
                    });
                });
            });
            await batch.commit();
        } catch (error) {
            console.error("Error resetting attendance:", error);
            alert("Failed to reset attendance.");
        }
    };

    const presentCount = checkinList.filter(s => s.attendanceStatus === 'Present').length;
    const absentCount = checkinList.filter(s => s.attendanceStatus === 'Absent').length;
    const uncheckedCount = checkinList.length - presentCount - absentCount;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--fa-dark-blue)' }}>Live Attendance Check-in</h2>
                    <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '14px' }}>
                        Mark students present as they enter the room.
                    </p>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <button 
                        onClick={handleCopyReport}
                        disabled={saving}
                        title="Copy attendance report text to clipboard"
                        style={{ padding: '8px 14px', backgroundColor: copiedReport ? '#188038' : 'white', color: copiedReport ? 'white' : 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', height: '38px', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                        {copiedReport ? '✓ Copied!' : '📋 Copy Report'}
                    </button>
                    <button 
                        onClick={handleEmailAttendance}
                        disabled={saving}
                        title="Open email addressed to you to review and forward"
                        style={{ padding: '8px 16px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'default' : 'pointer', fontWeight: 'bold', height: '38px', opacity: saving ? 0.7 : 1 }}
                    >
                        📧 Email to Me
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)', textTransform: 'uppercase' }}>Date</label>
                        <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none' }} />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)', textTransform: 'uppercase' }}>Session</label>
                        <select value={selectedSession} onChange={e => setSelectedSession(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', background: 'white' }}>
                            <option value="All Day">All Day</option>
                            <option value="Morning">Morning</option>
                            <option value="Afternoon">Afternoon</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)', textTransform: 'uppercase' }}>Room</label>
                        <select value={selectedRoom} onChange={e => setSelectedRoom(e.target.value)} style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', background: 'white', fontWeight: 'bold', color: 'var(--fa-blue)' }}>
                            <option value="">Select Room...</option>
                            {rooms.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>Loading Live Rosters...</div>
            ) : !selectedRoom ? (
                <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
                    <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>✅</span>
                    <h3 style={{ margin: '0 0 8px 0', color: 'var(--fa-dark-blue)' }}>Select a Room to Begin</h3>
                    <p style={{ margin: 0, color: 'var(--fa-warm-gray)' }}>Choose a room from the dropdown above to load its roster.</p>
                </div>
            ) : (
                <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                    
                    {/* Roster List */}
                    <div className="glass-panel" style={{ flex: 1, padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>
                                Roster: {selectedRoom} 
                                <span style={{ color: 'var(--fa-warm-gray)', fontWeight: 'normal', fontSize: '16px', marginLeft: '8px' }}>
                                    • {roomTestName}
                                </span>
                            </h3>
                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                <span style={{ padding: '4px 12px', background: 'rgba(24, 128, 56, 0.1)', color: '#188038', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }}>{presentCount} Present</span>
                                <span style={{ padding: '4px 12px', background: 'rgba(217, 48, 37, 0.1)', color: '#d93025', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }}>{absentCount} Absent</span>
                                <span style={{ padding: '4px 12px', background: 'rgba(95, 99, 104, 0.1)', color: '#5f6368', borderRadius: '12px', fontWeight: 'bold', fontSize: '12px' }}>{uncheckedCount} Unchecked</span>
                                
                                {uncheckedCount > 0 && (
                                    <button 
                                        onClick={handleMarkAllRemainingPresent}
                                        style={{ marginLeft: '8px', background: '#188038', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                    >
                                        ✨ Mark Remaining Present
                                    </button>
                                )}

                                {(presentCount > 0 || absentCount > 0) && (
                                    <button 
                                        onClick={handleResetRoomAttendance}
                                        title="Clear all Present/Absent marks for this room"
                                        style={{ background: '#fff', color: '#5f6368', border: '1px solid var(--glass-border)', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px' }}
                                    >
                                        🔄 Reset Room
                                    </button>
                                )}
                            </div>
                        </div>

                        {checkinList.length === 0 ? (
                            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--fa-warm-gray)', border: '1px dashed var(--glass-border)', borderRadius: '8px' }}>
                                No students found for {selectedRoom} on {selectedDate}.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {checkinList.map(s => {
                                    const isPresent = s.attendanceStatus === 'Present';
                                    const isAbsent = s.attendanceStatus === 'Absent';
                                    
                                    return (
                                        <div key={s.stateId || s.id} style={{ 
                                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
                                            padding: '12px 16px', borderRadius: '8px', 
                                            background: isPresent ? 'rgba(24, 128, 56, 0.05)' : isAbsent ? 'rgba(217, 48, 37, 0.05)' : 'white',
                                            border: `1px solid ${isPresent ? '#188038' : isAbsent ? '#d93025' : 'var(--glass-border)'}`,
                                            transition: 'all 0.2s'
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--fa-dark-blue)' }}>{s.lastName}, {s.firstName}</div>
                                                <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>{s.matchedTest} • Grade {s.grade}</div>
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    onClick={() => handleToggleAttendance(s.id, isPresent ? 'Not Checked' : 'Present', s.sourceRecords)}
                                                    style={{ 
                                                        padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
                                                        background: isPresent ? '#188038' : '#f1f3f4',
                                                        color: isPresent ? 'white' : '#5f6368'
                                                    }}
                                                >
                                                    {isPresent ? '✅ Present' : 'Present'}
                                                </button>
                                                <button 
                                                    onClick={() => handleToggleAttendance(s.id, isAbsent ? 'Not Checked' : 'Absent', s.sourceRecords)}
                                                    style={{ 
                                                        padding: '8px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', border: 'none',
                                                        background: isAbsent ? '#d93025' : '#f1f3f4',
                                                        color: isAbsent ? 'white' : '#5f6368'
                                                    }}
                                                >
                                                    {isAbsent ? '❌ Absent' : 'Absent'}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

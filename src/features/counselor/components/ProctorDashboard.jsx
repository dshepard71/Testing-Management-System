import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import HelpGuide from './HelpGuide';
import { decryptText } from '../../../utils/crypto';

const ProctorDashboard = () => {
    const { user, userProfile } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showHelp, setShowHelp] = useState(false);

    // Live Student Database Listeners for attendance tracking
    const [masterStudents, setMasterStudents] = useState([]);
    const [apRegistrations, setApRegistrations] = useState([]);
    const [satRegistrations, setSatRegistrations] = useState([]);

    useEffect(() => {
        if (!user?.email) {
            setLoading(false);
            return;
        }

        const userEmail = user.email.toLowerCase();
        const chartsRef = collection(db, 'seating_charts');

        const unsubscribe = onSnapshot(chartsRef, (snapshot) => {
            const myAssignments = [];

            snapshot.docs.forEach(doc => {
                const data = doc.data();
                const isProctor = data.proctorEmail?.toLowerCase() === userEmail;
                const isMonitor = data.monitorEmail?.toLowerCase() === userEmail;

                if (isProctor || isMonitor) {
                    const decryptedAssignedSeats = {};
                    if (data.assignedSeats) {
                        Object.entries(data.assignedSeats).forEach(([seatId, studentInfo]) => {
                            decryptedAssignedSeats[seatId] = {
                                ...studentInfo,
                                accommodations: decryptText(studentInfo.accommodations || '')
                            };
                        });
                    }

                    myAssignments.push({
                        id: doc.id,
                        ...data,
                        assignedSeats: decryptedAssignedSeats,
                        myRole: isProctor ? 'Proctor' : 'Monitor'
                    });
                }
            });

            myAssignments.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            setAssignments(myAssignments);
            setLoading(false);
        });

        const unsubMaster = onSnapshot(collection(db, 'master_students'), snap => {
            setMasterStudents(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    accommodations: decryptText(data.accommodations || ''),
                    accommodationNotes: decryptText(data.accommodationNotes || ''),
                    collectionSource: 'master_students'
                };
            }));
        });
        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), snap => {
            setApRegistrations(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    accommodations: decryptText(data.accommodations || ''),
                    collectionSource: 'ap_registrations'
                };
            }));
        });
        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), snap => {
            setSatRegistrations(snap.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    accommodations: decryptText(data.accommodations || ''),
                    collectionSource: 'sat_registrations'
                };
            }));
        });

        return () => {
            unsubscribe();
            unsubMaster();
            unsubAP();
            unsubSAT();
        };
    }, [user?.email]);

    // Handle toggling attendance and saving to Firebase
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

    const handlePrint = (chartId) => {
        window.print();
    };

    const [viewTab, setViewTab] = useState('upcoming');
    const [dateFilter, setDateFilter] = useState('');
    const todayStr = new Date().toISOString().split('T')[0];

    const filteredAssignments = assignments.filter(chart => {
        const cDate = chart.date || '';
        
        if (dateFilter) {
            return cDate === dateFilter;
        }

        if (viewTab === 'upcoming') {
            return cDate >= todayStr || cDate === '';
        } else if (viewTab === 'past') {
            return cDate < todayStr && cDate !== '';
        }
        
        return true; // 'all'
    });

    if (loading) {
        return (
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
                <div style={{ color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>Loading proctor assignments...</div>
            </div>
        );
    }

    return (
        <div style={{ padding: '8px 0', maxWidth: '900px', margin: '0 auto' }}>
            <div style={{
                marginBottom: '24px',
                borderBottom: '1px solid var(--glass-border)',
                paddingBottom: '20px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px'
            }}>
                <div>
                    <h1 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '26px', fontWeight: 'bold' }}>📋 Proctor & Monitor Dashboard</h1>
                    <p style={{ margin: '6px 0 0', color: 'var(--fa-warm-gray)', fontSize: '13px' }}>
                        Welcome, <b>{user?.displayName || user?.email}</b>. Track your active testing room responsibilities.
                    </p>
                </div>
                <button
                    onClick={() => setShowHelp(true)}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: 'white',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '20px',
                        color: 'var(--fa-blue)',
                        fontWeight: 'bold',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    ❓ Help Guide
                </button>
            </div>

            {showHelp && <HelpGuide role="proctor" onClose={() => setShowHelp(false)} />}

            {assignments.length > 0 && (
                <div className="glass-panel" style={{
                    padding: '16px 24px',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '16px',
                    background: 'rgba(255,255,255,0.7)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: '12px'
                }}>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={() => { setViewTab('upcoming'); setDateFilter(''); }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: viewTab === 'upcoming' && !dateFilter ? 'var(--fa-blue)' : 'transparent',
                                color: viewTab === 'upcoming' && !dateFilter ? 'white' : 'var(--fa-dark-blue)',
                                border: 'none',
                                borderRadius: '20px',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            📅 Today & Upcoming
                        </button>
                        <button
                            onClick={() => { setViewTab('past'); setDateFilter(''); }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: viewTab === 'past' && !dateFilter ? 'var(--fa-blue)' : 'transparent',
                                color: viewTab === 'past' && !dateFilter ? 'white' : 'var(--fa-dark-blue)',
                                border: 'none',
                                borderRadius: '20px',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            ⏱️ Past Sessions
                        </button>
                        <button
                            onClick={() => { setViewTab('all'); setDateFilter(''); }}
                            style={{
                                padding: '8px 16px',
                                backgroundColor: viewTab === 'all' && !dateFilter ? 'var(--fa-blue)' : 'transparent',
                                color: viewTab === 'all' && !dateFilter ? 'white' : 'var(--fa-dark-blue)',
                                border: 'none',
                                borderRadius: '20px',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            🌐 Show All
                        </button>
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Find Specific Date:</label>
                        <input
                            type="date"
                            value={dateFilter}
                            onChange={(e) => setDateFilter(e.target.value)}
                            style={{
                                padding: '6px 12px',
                                borderRadius: '8px',
                                border: '1px solid var(--glass-border)',
                                outline: 'none',
                                fontSize: '13px',
                                fontWeight: 'bold',
                                color: 'var(--fa-blue)',
                                backgroundColor: 'white'
                            }}
                        />
                        {dateFilter && (
                            <button
                                onClick={() => setDateFilter('')}
                                style={{
                                    padding: '6px 10px',
                                    backgroundColor: 'var(--fa-red)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '6px',
                                    fontWeight: 'bold',
                                    fontSize: '12px',
                                    cursor: 'pointer'
                                }}
                            >
                                Clear
                            </button>
                        )}
                    </div>
                </div>
            )}

            {assignments.length === 0 ? (
                <div className="glass-panel" style={{
                    textAlign: 'center',
                    padding: '64px 32px',
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    border: '1.5px dashed var(--glass-border)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🛡️</div>
                    <h2 style={{ color: 'var(--fa-dark-blue)', marginBottom: '8px', fontWeight: 'bold' }}>No Assigned Sessions</h2>
                    <p style={{ color: 'var(--fa-warm-gray)', fontSize: '13px', maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
                        You are not currently designated as a Proctor or Monitor in any saved seating charts. Please contact the testing registrar if this is incorrect.
                    </p>
                </div>
            ) : filteredAssignments.length === 0 ? (
                <div className="glass-panel" style={{
                    textAlign: 'center',
                    padding: '48px 32px',
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    border: '1.5px dashed var(--glass-border)'
                }}>
                    <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔍</div>
                    <h3 style={{ color: 'var(--fa-dark-blue)', marginBottom: '8px', fontWeight: 'bold' }}>No Matching Sessions</h3>
                    <p style={{ color: 'var(--fa-warm-gray)', fontSize: '13px', maxWidth: '400px', margin: '0 auto', lineHeight: '1.5' }}>
                        No testing sessions found matching your selected date or tab filter. Try changing your filters.
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {filteredAssignments.map(chart => (
                        <div
                            key={chart.id}
                            className="glass-panel"
                            style={{
                                overflow: 'hidden',
                                padding: '0',
                                border: '1px solid var(--glass-border)',
                                background: 'rgba(255, 255, 255, 0.55)',
                                borderRadius: '12px'
                            }}
                        >
                            {/* Card Header */}
                            <div style={{
                                padding: '16px 24px',
                                backgroundColor: chart.myRole === 'Proctor' ? 'rgba(52, 168, 83, 0.06)' : 'rgba(0, 70, 139, 0.05)',
                                borderBottom: '1px solid var(--glass-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: '12px'
                            }}>
                                <div>
                                    <span style={{
                                        fontSize: '11px',
                                        fontWeight: '800',
                                        color: chart.myRole === 'Proctor' ? '#2e7d32' : 'var(--fa-blue)',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.8px',
                                        backgroundColor: chart.myRole === 'Proctor' ? 'rgba(52, 168, 83, 0.08)' : 'rgba(0, 70, 139, 0.08)',
                                        padding: '3px 8px',
                                        borderRadius: '4px'
                                    }}>
                                        {chart.myRole}
                                    </span>
                                    <h3 style={{ margin: '8px 0 0', fontSize: '18px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>
                                        {chart.apSubject || chart.testType}
                                    </h3>
                                </div>
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <button
                                        onClick={() => {
                                            const studentNames = chart.assignedSeats
                                                ? Object.values(chart.assignedSeats).map(s => `${s.lastName || s.name?.split(' ').pop() || ''}, ${s.firstName || s.name?.split(' ')[0] || ''}${s.hasAccommodations ? ' ⭐' : ''}`).sort().join('<br/>')
                                                : 'No students assigned';
                                            const signHtml = `
                                                <html>
                                                <head><title>Door Sign - ${chart.roomId}</title>
                                                <style>
                                                    body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
                                                    .room { font-size: 72px; font-weight: bold; margin-bottom: 20px; }
                                                    .test { font-size: 36px; color: #00468B; margin-bottom: 10px; }
                                                    .date { font-size: 28px; color: #666; margin-bottom: 30px; }
                                                    .staff { font-size: 20px; margin-bottom: 20px; }
                                                    .count { font-size: 24px; font-weight: bold; background: #e8f0fe; padding: 10px 20px; border-radius: 8px; display: inline-block; margin-bottom: 20px; }
                                                    .students { font-size: 14px; text-align: left; column-count: 2; column-gap: 40px; margin-top: 20px; border-top: 2px solid #eee; padding-top: 20px; }
                                                    @media print { body { padding: 20px; } }
                                                </style>
                                                </head>
                                                <body>
                                                    <div class="room">${chart.roomId}</div>
                                                    <div class="test">${chart.apSubject || chart.testType}</div>
                                                    <div class="date">${chart.date} • ${chart.session}</div>
                                                    <div class="staff">
                                                        <strong>Proctor:</strong> ${chart.proctor || 'TBD'}<br/>
                                                        <strong>Monitor:</strong> ${chart.monitor || 'TBD'}
                                                    </div>
                                                    <div class="count">${chart.studentCount || 0} Students</div>
                                                    <div class="students">${studentNames}</div>
                                                </body>
                                                </html>
                                            `;
                                            const printWindow = window.open('', '_blank', 'width=800,height=600');
                                            printWindow.document.write(signHtml);
                                            printWindow.document.close();
                                            printWindow.focus();
                                            setTimeout(() => printWindow.print(), 250);
                                        }}
                                        style={{
                                            padding: '6px 14px',
                                            backgroundColor: 'white',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '12px',
                                            color: 'var(--fa-dark-blue)'
                                        }}
                                    >
                                        🚪 Door Sign
                                    </button>
                                    <button
                                        onClick={() => handlePrint(chart.id)}
                                        style={{
                                            padding: '6px 14px',
                                            backgroundColor: 'white',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            fontSize: '12px',
                                            color: 'var(--fa-dark-blue)'
                                        }}
                                    >
                                        🖨️ Print Roster
                                    </button>
                                </div>
                            </div>

                            {/* Details Grid */}
                            <div style={{ padding: '20px 24px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginBottom: '3px', fontWeight: 'bold' }}>DATE</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--fa-dark-blue)' }}>{chart.date || 'TBD'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginBottom: '3px', fontWeight: 'bold' }}>SESSION</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--fa-dark-blue)' }}>{chart.session || 'All Day'}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginBottom: '3px', fontWeight: 'bold' }}>ROOM</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--fa-blue)' }}>{chart.roomId}</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginBottom: '3px', fontWeight: 'bold' }}>TOTAL STUDENTS</div>
                                        <div style={{ fontWeight: 'bold', fontSize: '15px', color: 'var(--fa-dark-blue)' }}>{chart.studentCount || 0}</div>
                                    </div>
                                </div>

                                {/* Assigned Students Roster */}
                                {chart.assignedSeats && Object.keys(chart.assignedSeats).length > 0 && (
                                    <div style={{ marginTop: '16px' }}>
                                        <div style={{ fontSize: '11px', color: 'var(--fa-dark-blue)', marginBottom: '8px', fontWeight: '800', letterSpacing: '0.3px' }}>ASSIGNED STUDENTS & LIVE ATTENDANCE</div>
                                        <div style={{
                                            display: 'grid',
                                            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                                            gap: '12px',
                                            padding: '16px',
                                            backgroundColor: 'rgba(255,255,255,0.4)',
                                            borderRadius: '8px',
                                            border: '1px solid var(--glass-border)'
                                        }}>
                                            {Object.values(chart.assignedSeats)
                                                .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
                                                .map((student, idx) => {
                                                    const sFirst = student.firstName || student.name?.split(' ')[0] || '';
                                                    const sLast = student.lastName || student.name?.split(' ').pop() || '';
                                                    
                                                    const matches = [
                                                        ...masterStudents,
                                                        ...apRegistrations,
                                                        ...satRegistrations
                                                    ].filter(record => 
                                                        record.id === student.id || 
                                                        (record.email && student.email && record.email.toLowerCase() === student.email.toLowerCase()) ||
                                                        (record.firstName?.toLowerCase() === sFirst.toLowerCase() && record.lastName?.toLowerCase() === sLast.toLowerCase())
                                                    );
                                                    
                                                    const isPresent = matches.some(m => m.attendanceStatus === 'Present');
                                                    const isAbsent = matches.some(m => m.attendanceStatus === 'Absent');
                                                    const sourceRecords = matches.map(m => ({ id: m.id, source: m.collectionSource }));

                                                    return (
                                                        <div
                                                            key={idx}
                                                            style={{
                                                                padding: '10px 14px',
                                                                backgroundColor: isPresent ? 'rgba(52, 168, 83, 0.05)' : isAbsent ? 'rgba(217, 48, 37, 0.05)' : 'white',
                                                                borderRadius: '8px',
                                                                border: isPresent ? '1px solid rgba(52, 168, 83, 0.3)' : isAbsent ? '1px solid rgba(217, 48, 37, 0.3)' : '1px solid rgba(0,0,0,0.06)',
                                                                fontSize: '13px',
                                                                display: 'flex',
                                                                flexDirection: 'column',
                                                                justifyContent: 'space-between',
                                                                gap: '8px',
                                                                boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                                                <span style={{ fontWeight: '600', color: 'var(--fa-dark-blue)' }}>{student.name}</span>
                                                                {student.hasAccommodations && (
                                                                    <span
                                                                        title={student.accommodations}
                                                                        style={{
                                                                            backgroundColor: 'rgba(234, 176, 16, 0.08)',
                                                                            color: 'var(--fa-gold)',
                                                                            padding: '2px 6px',
                                                                            borderRadius: '4px',
                                                                            fontSize: '10px',
                                                                            fontWeight: '800',
                                                                            cursor: 'help'
                                                                        }}
                                                                    >
                                                                        ACC
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {student.hasAccommodations && student.accommodations && (
                                                                <div style={{ fontSize: '11px', color: '#b45309', backgroundColor: 'rgba(251, 191, 36, 0.08)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(251, 191, 36, 0.15)', marginTop: '2px' }}>
                                                                    💡 <b>Accommodations:</b> {student.accommodations}
                                                                </div>
                                                            )}
                                                            <div style={{ display: 'flex', gap: '6px', width: '100%', marginTop: '4px' }}>
                                                                <button
                                                                    disabled={sourceRecords.length === 0}
                                                                    onClick={() => handleToggleAttendance(student.id, isPresent ? 'Not Checked' : 'Present', sourceRecords)}
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: '6px 0',
                                                                        backgroundColor: isPresent ? '#34a853' : '#f1f3f4',
                                                                        color: isPresent ? 'white' : '#5f6368',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        fontWeight: 'bold',
                                                                        cursor: sourceRecords.length === 0 ? 'not-allowed' : 'pointer',
                                                                        fontSize: '11px',
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                >
                                                                    {isPresent ? '✅ Present' : 'Present'}
                                                                </button>
                                                                <button
                                                                    disabled={sourceRecords.length === 0}
                                                                    onClick={() => handleToggleAttendance(student.id, isAbsent ? 'Not Checked' : 'Absent', sourceRecords)}
                                                                    style={{
                                                                        flex: 1,
                                                                        padding: '6px 0',
                                                                        backgroundColor: isAbsent ? '#d93025' : '#f1f3f4',
                                                                        color: isAbsent ? 'white' : '#5f6368',
                                                                        border: 'none',
                                                                        borderRadius: '4px',
                                                                        fontWeight: 'bold',
                                                                        cursor: sourceRecords.length === 0 ? 'not-allowed' : 'pointer',
                                                                        fontSize: '11px',
                                                                        transition: 'all 0.15s ease'
                                                                    }}
                                                                >
                                                                    {isAbsent ? '❌ Absent' : 'Absent'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            }
                                        </div>
                                    </div>
                                )}

                                {/* Co-Worker details */}
                                <div style={{ marginTop: '16px', padding: '12px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px', fontSize: '13px', color: 'var(--fa-dark-blue)' }}>
                                    {chart.myRole === 'Proctor' && chart.monitor && (
                                        <span>Testing Monitor Partner: <strong>{chart.monitor}</strong> ({chart.monitorEmail})</span>
                                    )}
                                    {chart.myRole === 'Monitor' && chart.proctor && (
                                        <span>Proctor Partner: <strong>{chart.proctor}</strong> ({chart.proctorEmail})</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ProctorDashboard;

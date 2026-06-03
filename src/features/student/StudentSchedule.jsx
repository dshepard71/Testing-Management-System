import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../context/AuthContext';

const StudentSchedule = ({ email: propEmail = null }) => {
    const { user, userProfile } = useAuth();
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [studentData, setStudentData] = useState(null);

    // Prioritize passed prop email (for admin previews) over logged in user email
    const activeEmail = propEmail || user?.email;

    useEffect(() => {
        if (!activeEmail) {
            setLoading(false);
            return;
        }

        const normalizedEmail = activeEmail.toLowerCase().trim();

        // Subscriptions setup
        const qMaster = query(collection(db, 'master_students'), where('email', '==', normalizedEmail));
        const qAP = query(collection(db, 'ap_registrations'), where('schoolEmail', '==', normalizedEmail));
        const qAP_CB = query(collection(db, 'ap_registrations'), where('email', '==', normalizedEmail));
        const qSAT = query(collection(db, 'sat_registrations'), where('email', '==', normalizedEmail));
        const qCharts = query(collection(db, 'seating_charts'));

        const state = {
            master: null,
            ap: [],
            sat: [],
            charts: []
        };

        const updateState = () => {
            if (!state.master) return;

            const items = [];
            const data = state.master;

            // 1. Maine Science Test
            if (data.maine_science_room) {
                items.push({
                    id: 'ms',
                    type: 'Maine Science Test',
                    date: data.maine_science_date,
                    session: data.maine_science_session || 'Morning',
                    room: data.maine_science_room,
                    icon: '🧪'
                });
            }

            // 2. Maine Through Year Reading
            if (data.maine_ty_reading_room) {
                items.push({
                    id: 'mty_r',
                    type: 'Maine Through Year - Reading',
                    date: data.maine_ty_reading_date,
                    session: data.maine_ty_reading_session || 'Morning',
                    room: data.maine_ty_reading_room,
                    icon: '📖'
                });
            }

            // 3. Maine Through Year Math
            if (data.maine_ty_math_room) {
                items.push({
                    id: 'mty_m',
                    type: 'Maine Through Year - Math',
                    date: data.maine_ty_math_date,
                    session: data.maine_ty_math_session || 'Morning',
                    room: data.maine_ty_math_room,
                    icon: '➗'
                });
            }

            // 4. SAT/PSAT legacy records in Master student
            const satRoom = data.assignedRoom && (data.testType === 'SAT' || data.testType === 'PSAT') ? data.assignedRoom : data.sat_room;
            if (satRoom) {
                items.push({
                    id: 'sat_master',
                    type: data.sat_type || data.testType || 'SAT/PSAT',
                    date: data.assignedDate || data.sat_date,
                    session: data.session || 'Morning',
                    room: satRoom,
                    icon: '✏️'
                });
            }

            // 5. SAT Registrations from SAT database collection
            state.sat.forEach((s, idx) => {
                if (s.assignedRoom) {
                    items.push({
                        id: `sat_reg_${idx}`,
                        type: s.testType || 'SAT',
                        date: s.assignedDate || 'TBD',
                        session: s.session || 'Morning',
                        room: s.assignedRoom,
                        icon: '✏️'
                    });
                }
            });

            // 6. AP Testing with direct chart layout lookups
            state.ap.forEach((s, idx) => {
                const matchingChart = state.charts.find(c => {
                    if (!c.assignedSeats) return false;
                    return Object.values(c.assignedSeats).some(seat => seat.id === s.id);
                });

                const courseName = s.course || 'AP Testing';
                const displayType = (courseName.toUpperCase().startsWith('AP ') || courseName.toUpperCase() === 'AP')
                    ? courseName
                    : `AP ${courseName}`;

                items.push({
                    id: `ap_${s.id || idx}`,
                    type: displayType,
                    date: matchingChart?.date || s.assignedDate || s.examDate || s.isoDate || s.originalDate || 'TBD',
                    session: matchingChart?.session || s.session || 'Morning',
                    room: matchingChart?.roomId || s.assignedRoom || s.roomId || 'TBD',
                    proctor: matchingChart?.proctor || '',
                    icon: '📦'
                });
            });

            // 7. Spring Maine State Tests
            if (data.spring_maine_math_group) {
                items.push({ id: 's_mty_m', type: 'Spring Maine Math', date: data.spring_maine_math_date, session: data.spring_maine_math_session || 'Morning', room: data.spring_maine_math_group, icon: '📐' });
            }
            if (data.spring_maine_reading_group) {
                items.push({ id: 's_mty_r', type: 'Spring Maine Reading', date: data.spring_maine_reading_date, session: data.spring_maine_reading_session || 'Morning', room: data.spring_maine_reading_group, icon: '📚' });
            }

            // 8. Makeup schedules
            if (data.makeupRoom && data.makeupDate) {
                items.push({
                    id: 'makeup',
                    type: 'Makeup Testing',
                    date: data.makeupDate,
                    session: data.makeupSession || 'Morning',
                    room: data.makeupRoom,
                    icon: '🔄',
                    isMakeup: true
                });
            }

            // Missed room filter
            let finalItems = items;
            if (data.makeupRoom && data.originalRoom) {
                finalItems = items.filter(item => item.isMakeup || item.room !== data.originalRoom);
            }

            finalItems.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
            setSchedule(finalItems);
        };

        const unsubMaster = onSnapshot(qMaster, (snap) => {
            if (!snap.empty) {
                state.master = snap.docs[0].data();
                setStudentData(state.master);
                updateState();
            }
            setLoading(false);
        }, (err) => console.error("Error subscribing to student profile:", err));

        const unsubCharts = onSnapshot(qCharts, (snap) => {
            const allCharts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const myCharts = allCharts.filter(chart => {
                if (!chart.assignedSeats) return false;
                return Object.values(chart.assignedSeats).some(s => 
                    (s.email || '').toLowerCase().trim() === normalizedEmail
                );
            });
            state.charts = myCharts;
            updateState();
        }, (err) => console.error("Error subscribing to seating charts:", err));

        const unsubAP = onSnapshot(qAP, (snap) => {
            const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const currentApMap = new Map(state.ap.map(a => [a.id, a]));
            newDocs.forEach(d => currentApMap.set(d.id, d));
            state.ap = Array.from(currentApMap.values());
            updateState();
        }, (err) => console.error("Error subscribing to AP Registrations:", err));

        const unsubAP_CB = onSnapshot(qAP_CB, (snap) => {
            const newDocs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            const currentApMap = new Map(state.ap.map(a => [a.id, a]));
            newDocs.forEach(d => currentApMap.set(d.id, d));
            state.ap = Array.from(currentApMap.values());
            updateState();
        }, (err) => console.error("Error subscribing to AP CB registrations:", err));

        const unsubSAT = onSnapshot(qSAT, (snap) => {
            state.sat = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            updateState();
        }, (err) => console.error("Error subscribing to SAT registrations:", err));

        return () => {
            unsubMaster();
            unsubCharts();
            unsubAP();
            unsubAP_CB();
            unsubSAT();
        };
    }, [activeEmail]);

    if (loading) return <div className="glass-panel" style={{ padding: '32px', textAlign: 'center' }}>Loading testing profile...</div>;
    if (!studentData) return <div className="glass-panel" style={{ padding: '32px', color: 'var(--fa-warm-gray)' }}>No active testing profile found. Please contact the testing registrar.</div>;

    return (
        <div className="glass-panel" style={{ padding: '32px', maxWidth: '850px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '16px' }}>
                <div>
                    <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold' }}>📅 Testing Schedule Card</h2>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--fa-warm-gray)', fontSize: '13px' }}>
                         Roster record for: <b>{studentData.firstName} {studentData.lastName}</b> ({activeEmail})
                    </p>
                </div>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: '8px 16px', backgroundColor: 'white', border: '1px solid #dadce0',
                        borderRadius: '6px', fontSize: '13px', cursor: 'pointer', fontWeight: 'bold',
                        color: 'var(--fa-blue)', display: 'flex', alignItems: 'center', gap: '6px'
                    }}
                >
                    🖨️ Print Slip
                </button>
            </div>

            {/* Timetable Slots */}
            {schedule.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: '12px', border: '1.5px dashed var(--glass-border)' }}>
                    <div style={{ fontSize: '36px', marginBottom: '12px' }}>🎉</div>
                    <div style={{ fontWeight: 'bold', color: 'var(--fa-green)', fontSize: '15px' }}>No active testing schedules scheduled.</div>
                    <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>Enjoy your testing-free block!</div>
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    {schedule.map(item => (
                        <div key={item.id} style={{
                            display: 'flex', alignItems: 'center', gap: '16px', padding: '18px 24px',
                            backgroundColor: item.isMakeup ? 'rgba(234, 176, 16, 0.08)' : 'white',
                            border: item.isMakeup ? '2px solid var(--fa-gold)' : '1px solid #eef0f2',
                            borderRadius: '12px', boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                            transition: 'transform 0.15s, box-shadow 0.15s'
                        }}>
                            <span style={{ fontSize: '28px' }}>{item.icon}</span>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', fontSize: '15px', color: item.isMakeup ? 'var(--fa-gold)' : 'var(--fa-dark-blue)' }}>
                                    {item.type} {item.isMakeup && '(MAKEUP)'}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '3px' }}>
                                    📅 {item.date} • {item.session} {item.proctor && `(Proctor: ${item.proctor})`}
                                </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '10px', color: 'var(--fa-warm-gray)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned Room</div>
                                <div style={{ fontSize: '20px', fontWeight: '800', color: 'var(--fa-blue)', marginTop: '2px' }}>{item.room}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Custom Accommodation Alert Block */}
            {studentData.accommodations && (
                <div style={{
                    marginTop: '24px', padding: '16px', borderRadius: '12px',
                    border: '1.5px solid var(--fa-gold)', backgroundColor: 'rgba(234, 176, 16, 0.06)',
                    color: 'var(--fa-dark-blue)', display: 'flex', gap: '10px', alignItems: 'flex-start'
                }}>
                    <span style={{ fontSize: '20px' }}>⚡</span>
                    <div>
                        <div style={{ fontWeight: 'bold', fontSize: '13px' }}>Approved Special Testing Accommodations:</div>
                        <div style={{ fontSize: '12px', marginTop: '3px', fontWeight: '600' }}>{studentData.accommodations}</div>
                        {studentData.accommodationNotes && (
                            <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '3px', fontStyle: 'italic' }}>
                                Notes: {studentData.accommodationNotes}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Terms Footer */}
            <div style={{
                marginTop: '24px', padding: '14px 18px', backgroundColor: 'rgba(0, 70, 139, 0.05)',
                borderRadius: '8px', fontSize: '11px', color: 'var(--fa-blue)', lineHeight: '1.5'
            }}>
                💡 <b>IMPORTANT DIRECTIVE:</b> Please arrive at your designated testing room at least <b>10 minutes before</b> the scheduled session. Ensure you have your student ID card, a graphical calculator, and school-approved pencils.
            </div>
        </div>
    );
};

export default StudentSchedule;

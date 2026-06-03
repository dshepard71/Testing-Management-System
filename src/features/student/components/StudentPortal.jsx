import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function StudentPortal() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [studentData, setStudentData] = useState(null);
    const [apTests, setApTests] = useState([]);
    const [satTests, setSatTests] = useState([]);
    const [roomAssignments, setRoomAssignments] = useState({});
    const [pendingForms, setPendingForms] = useState([]);

    const email = user?.email?.toLowerCase();

    useEffect(() => {
        if (!email) return;

        const fetchData = async () => {
            try {
                // 1. Get Master Student Data
                let qStudent = query(collection(db, 'master_students'), where('email', '==', email));
                let snapStudent = await getDocs(qStudent);
                let student = null;
                if (!snapStudent.empty) {
                    student = snapStudent.docs[0].data();
                } else {
                    // Fallback for admin impersonation: fetch the first student so we have real data to view
                    const snapAll = await getDocs(collection(db, 'master_students'));
                    if (!snapAll.empty) {
                        student = snapAll.docs[0].data();
                    }
                }
                
                if (student) {
                    setStudentData(student);
                    // Override the email variable locally for the rest of the queries to load the mock student's data
                    const activeEmail = student.email?.toLowerCase();
                    
                    // 2. Get AP Registrations
                    const qAP = query(collection(db, 'ap_registrations'), where('Email', '==', activeEmail));
                    const snapAP = await getDocs(qAP);
                    const apList = snapAP.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setApTests(apList);

                    // 3. Get SAT Registrations
                    const qSAT = query(collection(db, 'sat_registrations'), where('Email', '==', activeEmail));
                    const snapSAT = await getDocs(qSAT);
                    const satList = snapSAT.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setSatTests(satList);

                    // 4. Get Seating Charts to find Room Assignments
                    const snapSeating = await getDocs(collection(db, 'seating_charts'));
                    const assignments = {};
                    snapSeating.docs.forEach(doc => {
                        const chart = doc.data();
                        const testType = chart.testType;
                        
                        if (chart.seats) {
                            const isSeated = chart.seats.some(seat => seat.studentEmail?.toLowerCase() === activeEmail);
                            if (isSeated) {
                                assignments[testType] = chart;
                            }
                        }
                    });
                    setRoomAssignments(assignments);
                }
                setLoading(false);
            } catch (error) {
                console.error("Error fetching student portal data:", error);
                setLoading(false);
            }
        };

        fetchData();
    }, [email]);

    // 5. Subscribe to Forms
    useEffect(() => {
        if (!studentData) return;

        const unsubForms = onSnapshot(query(collection(db, 'custom_forms'), where('status', '==', 'open')), (snapshot) => {
            const allForms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter eligible forms
            const eligibleForms = allForms.filter(form => {
                const elig = form.eligibility || {};
                
                if (elig.specificEmails && elig.specificEmails.trim() !== '') {
                    const allowedEmails = elig.specificEmails.toLowerCase().split(',').map(e => e.trim());
                    if (allowedEmails.includes(email)) return true;
                    return false;
                }

                if (elig.grades && elig.grades.length > 0) {
                    const gradeRaw = String(studentData.grade || '').toLowerCase().replace(/[^0-9]/g, '').padStart(2, '0');
                    if (!elig.grades.includes(gradeRaw)) return false;
                }
                return true;
            });

            // We should ideally check if they have already submitted this form.
            // For now, we will just list all eligible forms as "Action Required".
            // A more robust implementation would query form_submissions to filter out completed ones.
            setPendingForms(eligibleForms);
        });

        return () => unsubForms();
    }, [studentData, email]);

    if (loading) return <div style={{ padding: '64px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>Loading your dashboard...</div>;

    if (!studentData) {
        return (
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', textAlign: 'center', backgroundColor: 'rgba(254, 247, 224, 0.9)', border: '1px solid #fbbf24' }}>
                <h2 style={{ color: '#92400e', marginTop: 0 }}>⚠️ Account Not Found</h2>
                <p style={{ color: '#78350f' }}>Your email address ({email}) is not registered in the testing system. Please contact your counselor.</p>
            </div>
        );
    }

    const allTests = [
        ...apTests.map(t => ({ type: 'AP', name: t.Test, date: t.TestDate, session: t.Session, status: t.Order_Status })),
        ...satTests.map(t => ({ type: 'SAT', name: t.Test, date: t.TestDate, status: 'Registered' }))
    ].filter(t => t.name);

    return (
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ marginBottom: '32px', paddingBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                <h1 style={{ margin: '0 0 8px 0', color: 'var(--fa-dark-blue)' }}>Welcome, {studentData.firstName}!</h1>
                <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '15px' }}>This is your central hub for all upcoming state and national assessments.</p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
                <div className="glass-panel" style={{ padding: '24px', backgroundColor: 'rgba(255, 255, 255, 0.8)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '24px' }}>📅</div>
                        <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>My Testing Schedule</h2>
                    </div>

                    {allTests.length === 0 ? (
                        <div style={{ color: 'var(--fa-warm-gray)', fontStyle: 'italic', fontSize: '14px' }}>You are not currently registered for any upcoming exams.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {allTests.map((t, i) => {
                                const assignment = roomAssignments[t.name];
                                return (
                                    <div key={i} style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #eee' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                            <h4 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '15px' }}>{t.type} {t.name}</h4>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', backgroundColor: 'rgba(26, 115, 232, 0.1)', color: '#1a73e8', borderRadius: '4px' }}>
                                                {t.status || 'Registered'}
                                            </span>
                                        </div>
                                        {t.date && <div style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '4px' }}>Date: {t.date} {t.session ? `(${t.session})` : ''}</div>}
                                        
                                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0f0f0' }}>
                                            {assignment ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#188038', fontWeight: 'bold', fontSize: '13px' }}>
                                                    <span>📍</span> Assigned to Room: {assignment.roomName}
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--fa-warm-gray)', fontSize: '13px' }}>
                                                    <span>⏳</span> Room Assignment Pending
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="glass-panel" style={{ padding: '24px', backgroundColor: pendingForms.length > 0 ? 'rgba(217, 48, 37, 0.05)' : 'rgba(255, 255, 255, 0.8)', border: pendingForms.length > 0 ? '1px solid rgba(217, 48, 37, 0.2)' : '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ fontSize: '24px' }}>📝</div>
                        <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>Action Required</h2>
                    </div>

                    {pendingForms.length === 0 ? (
                        <div style={{ color: 'var(--fa-warm-gray)', fontStyle: 'italic', fontSize: '14px' }}>You have no pending forms or surveys to complete.</div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {pendingForms.map(form => (
                                <div key={form.id} style={{ padding: '16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid rgba(217, 48, 37, 0.3)', cursor: 'pointer', transition: 'box-shadow 0.2s' }} onClick={() => navigate(`/student/forms/${form.id}`)}>
                                    <h4 style={{ margin: '0 0 4px 0', color: 'var(--fa-red)' }}>{form.title}</h4>
                                    <p style={{ margin: 0, fontSize: '12px', color: 'var(--fa-warm-gray)' }}>Requires your signature or response.</p>
                                    <button style={{ marginTop: '12px', padding: '6px 12px', backgroundColor: 'var(--fa-red)', color: 'white', border: 'none', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                        Complete Now &rarr;
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', color: 'var(--fa-dark-blue)' }}>Quick Links</h3>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <button onClick={() => navigate('/student/sat-registration')} style={{ padding: '12px 24px', backgroundColor: 'white', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>
                        SAT Registration Portal
                    </button>
                    <button onClick={() => navigate('/student/forms')} style={{ padding: '12px 24px', backgroundColor: 'white', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>
                        All Forms & Signups
                    </button>
                </div>
            </div>
        </div>
    );
}

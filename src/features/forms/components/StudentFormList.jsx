import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { useAuth } from '../../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const StudentFormList = ({ email: impersonatedEmail }) => {
    const { user, userProfile } = useAuth();
    const effectiveEmail = impersonatedEmail || user?.email;
    const navigate = useNavigate();

    const [forms, setForms] = useState([]);
    const [studentData, setStudentData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!effectiveEmail) return;

        const fetchStudentData = async () => {
            try {
                let q = query(collection(db, 'master_students'), where('email', '==', effectiveEmail));
                let snap = await getDocs(q);
                if (snap.empty) {
                    q = query(collection(db, 'master_students'), where('email', '==', effectiveEmail.toLowerCase()));
                    snap = await getDocs(q);
                }
                if (!snap.empty) {
                    setStudentData(snap.docs[0].data());
                }
            } catch (err) {
                console.error("Error fetching student data:", err);
            }
        };

        fetchStudentData();
    }, [effectiveEmail]);

    useEffect(() => {
        if (!studentData) {
            // Only stop loading if we've tried to fetch and failed, otherwise wait for student data
            const timer = setTimeout(() => setLoading(false), 2000);
            return () => clearTimeout(timer);
        }

        const unsub = onSnapshot(query(collection(db, 'custom_forms'), where('status', '==', 'open')), (snapshot) => {
            const allForms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Filter forms based on eligibility
            const eligibleForms = allForms.filter(form => {
                const elig = form.eligibility || {};
                
                // 1. Whitelist check (overrides everything if it exists)
                if (elig.specificEmails && elig.specificEmails.trim() !== '') {
                    const allowedEmails = elig.specificEmails.toLowerCase().split(',').map(e => e.trim());
                    if (allowedEmails.includes(effectiveEmail.toLowerCase())) return true;
                    // If whitelist exists and they aren't on it, they don't get access.
                    return false;
                }

                // 2. Grade Check
                if (elig.grades && elig.grades.length > 0) {
                    const gradeRaw = String(studentData.grade || '').toLowerCase().replace(/[^0-9]/g, '').padStart(2, '0');
                    if (!elig.grades.includes(gradeRaw)) return false;
                }

                // 3. Student Type Check
                if (elig.studentTypes && elig.studentTypes.length > 0) {
                    // This assumes student type is stored or derived, we might not have it in master_students perfectly.
                    // For now, if we restrict by student type, we assume it's checked loosely or we skip if unknown.
                    const type = (studentData.studentType || studentData.type || '').toLowerCase();
                    if (type && !elig.studentTypes.includes(type)) return false;
                }

                return true;
            });

            setForms(eligibleForms);
            setLoading(false);
        });

        return () => unsub();
    }, [studentData, effectiveEmail]);

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading available forms...</div>;

    if (!studentData) {
        return (
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', textAlign: 'center', backgroundColor: 'rgba(254, 247, 224, 0.9)', border: '1px solid #fbbf24' }}>
                <h2 style={{ color: '#92400e', marginTop: 0 }}>⚠️ Student Record Not Found</h2>
                <p style={{ color: '#78350f' }}>Please log in with your school email account.</p>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px' }}>
            <div style={{ marginBottom: '32px' }}>
                <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '24px', fontWeight: 'bold' }}>Available Forms</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)' }}>Forms and sign-ups you are eligible for.</p>
            </div>

            {forms.length === 0 ? (
                <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>
                    There are currently no open forms available for you.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {forms.map(form => (
                        <div key={form.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '24px', cursor: 'pointer', transition: 'transform 0.2s, box-shadow 0.2s' }}
                            onClick={() => navigate(`/student/forms/${form.id}`)}
                            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(0,0,0,0.1)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                        >
                            <div>
                                <h3 style={{ margin: '0 0 8px 0', color: 'var(--fa-dark-blue)' }}>{form.title}</h3>
                                {form.description && <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '14px' }}>{form.description}</p>}
                                {form.fee > 0 && <div style={{ marginTop: '8px', fontSize: '13px', fontWeight: 'bold', color: 'var(--fa-blue)' }}>Fee: ${form.fee}</div>}
                            </div>
                            <div>
                                <button style={{ padding: '10px 20px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', pointerEvents: 'none' }}>
                                    Open &rarr;
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default StudentFormList;

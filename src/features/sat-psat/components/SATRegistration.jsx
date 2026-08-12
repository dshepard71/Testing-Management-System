import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';

const SATRegistration = ({ email: impersonatedEmail }) => {
    const { user, userProfile } = useAuth();
    const effectiveEmail = impersonatedEmail || user?.email;
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [error, setError] = useState('');
    const [registrations, setRegistrations] = useState([]);
    const [gradeMappings, setGradeMappings] = useState({});
    const [view, setView] = useState('register'); // 'register' or 'my-registrations'
    const [studentGrade, setStudentGrade] = useState(null);
    const [registrationSettings, setRegistrationSettings] = useState(null);
    const [eligibleTest, setEligibleTest] = useState(null);
    const [masterWaiver, setMasterWaiver] = useState('No');

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        grade: '',
        counselor: '',
        testType: '',
        studentType: ''
    });

    useEffect(() => {
        if (user || impersonatedEmail) {
            setFormData(prev => ({
                ...prev,
                firstName: impersonatedEmail ? '' : (userProfile?.firstName || user?.displayName?.split(' ')[0] || ''),
                lastName: impersonatedEmail ? '' : (userProfile?.lastName || user?.displayName?.split(' ').slice(1).join(' ') || ''),
                email: effectiveEmail
            }));
            fetchRegistrations();
        }
    }, [user, userProfile, impersonatedEmail]);

    useEffect(() => {
        const unsubSettings = onSnapshot(doc(db, 'settings', 'system'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.gradeMappings) setGradeMappings(data.gradeMappings);
            }
        });

        const unsubRegistration = onSnapshot(doc(db, 'settings', 'sat_registration'), (docSnap) => {
            if (docSnap.exists()) {
                setRegistrationSettings(docSnap.data());
            } else {
                setRegistrationSettings({ registrationOpen: false });
            }
        });

        return () => {
            unsubSettings();
            unsubRegistration();
        };
    }, []);

    const fetchRegistrations = async () => {
        if (!effectiveEmail) return;
        try {
            const q = query(collection(db, 'sat_registrations'), where('email', '==', effectiveEmail));
            const snapshot = await getDocs(q);
            setRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (err) {
            console.error("Error fetching registrations:", err);
        }
    };

    useEffect(() => {
        const fetchStudentGrade = async () => {
            if (!effectiveEmail) return;
            try {
                let q = query(collection(db, 'master_students'), where('email', '==', effectiveEmail));
                let snapshot = await getDocs(q);

                if (snapshot.empty) {
                    q = query(collection(db, 'master_students'), where('email', '==', effectiveEmail.toLowerCase()));
                    snapshot = await getDocs(q);
                }

                if (!snapshot.empty) {
                    const studentData = snapshot.docs[0].data();
                    const gradeRaw = String(studentData.grade || '').toLowerCase().replace(/[^0-9]/g, '');
                    const normalizedGrade = gradeRaw.padStart(2, '0');
                    setStudentGrade(normalizedGrade);
                    setMasterWaiver(studentData.waiverEligible || 'No');

                    const advisorToCounselor = (advisor) => {
                        if (!advisor) return '';
                        const name = advisor.toLowerCase();
                        if (name.includes('mcdonnell')) return 'Ms. McDonnell';
                        if (name.includes('bazanchuk')) return 'Ms. Bazanchuk';
                        if (name.includes('umphrey')) return 'Mr. Umphrey';
                        if (name.includes('sturdevant') || name.includes('shepard')) return 'Mr. Sturdevant';
                        return '';
                    };

                    setFormData(prev => ({
                        ...prev,
                        firstName: studentData.firstName || prev.firstName,
                        lastName: studentData.lastName || prev.lastName,
                        grade: normalizedGrade,
                        counselor: advisorToCounselor(studentData.advisor || studentData.counselor) || prev.counselor
                    }));
                }
            } catch (err) {
                console.error("Error fetching student grade:", err);
            }
        };
        fetchStudentGrade();
    }, [user, effectiveEmail]);

    useEffect(() => {
        if (registrationSettings && studentGrade) {
            const testForGrade = registrationSettings.gradeEligibility?.[studentGrade];
            if (testForGrade && testForGrade !== 'none') {
                setEligibleTest(testForGrade);
                setFormData(prev => ({ ...prev, testType: testForGrade }));
            } else {
                setEligibleTest(null);
            }
        }
    }, [registrationSettings, studentGrade]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const q = query(
                collection(db, 'sat_registrations'),
                where('email', '==', effectiveEmail),
                where('testType', '==', formData.testType)
            );
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                setError(`You have already submitted a registration for the ${formData.testType}.`);
                setLoading(false);
                return;
            }

            await addDoc(collection(db, 'sat_registrations'), {
                ...formData,
                uid: user?.uid || 'impersonated',
                status: 'Pending',
                feeAmount: masterWaiver === 'Yes' ? 0 : (formData.testType === 'SAT' ? 60 : 18),
                waiverEligible: masterWaiver,
                testingCycle: `${registrationSettings.currentSeason || 'Fall'} ${registrationSettings.testingYear || new Date().getFullYear()}`,
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
            });

            setSubmitted(true);
            fetchRegistrations();
        } catch (err) {
            console.error("Error submitting registration:", err);
            setError('Failed to submit registration. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', textAlign: 'center', backgroundColor: 'rgba(230, 255, 250, 0.9)', border: '1px solid #38b2ac' }}>
                <h2 style={{ color: '#2c7a7b', marginTop: 0 }}>Registration Received!</h2>
                <p>Thank you, {formData.firstName}. Your {formData.testType} registration has been submitted successfully.</p>
                <button
                    onClick={() => { setSubmitted(false); setView('my-registrations'); }}
                    style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#38b2ac', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    View My Registrations
                </button>
            </div>
        );
    }

    if (!registrationSettings) {
        return <div style={{ padding: '40px', textAlign: 'center' }}>Loading registration settings...</div>;
    }

    const isPastDeadline = registrationSettings.registrationDeadline && new Date() > new Date(registrationSettings.registrationDeadline + 'T23:59:59');
    
    if (!registrationSettings.registrationOpen || isPastDeadline) {
        return (
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', textAlign: 'center', backgroundColor: 'rgba(254, 242, 242, 0.9)', border: '1px solid #fecaca' }}>
                <h2 style={{ color: '#991b1b', marginTop: 0 }}>🚫 Registration {isPastDeadline ? 'Ended' : 'Closed'}</h2>
                <p style={{ color: '#7f1d1d' }}>
                    {isPastDeadline 
                        ? `The registration deadline for the ${registrationSettings.currentSeason} testing cycle has passed (${new Date(registrationSettings.registrationDeadline + 'T12:00:00').toLocaleDateString()}).`
                        : 'SAT/PSAT registration is currently not open.'}
                </p>
                <p style={{ color: '#7f1d1d', marginTop: '8px' }}>Please contact your counselor for more information.</p>

                {registrations.length > 0 && (
                    <button
                        onClick={() => setView('my-registrations')}
                        style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        View My Previous Registrations
                    </button>
                )}
            </div>
        );
    }

    if (!studentGrade) {
        return (
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', textAlign: 'center', backgroundColor: 'rgba(254, 247, 224, 0.9)', border: '1px solid #fbbf24' }}>
                <h2 style={{ color: '#92400e', marginTop: 0 }}>⚠️ Student Record Not Found</h2>
                <p style={{ color: '#78350f' }}>Please log in with your school email account (@fryeburgacademy.org or @myfryeburg.org).</p>
                <p style={{ color: '#78350f', marginTop: '8px' }}>If you are logged in with your school email account, please check with Mr. Shepard to see what the issue is.</p>
            </div>
        );
    }

    if (!eligibleTest) {
        const eligibilityText = Object.entries(registrationSettings.gradeEligibility || {})
            .filter(([_, test]) => test && test !== 'none')
            .map(([grade, test]) => `Grade ${parseInt(grade)} for ${test}`)
            .join(', ');

        return (
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '32px', textAlign: 'center' }}>
                <h2 style={{ color: 'var(--fa-dark-blue)', marginTop: 0 }}>Not Eligible for Registration</h2>
                <p style={{ color: 'var(--fa-warm-gray)', fontSize: '16px', lineHeight: '1.5' }}>
                    Hello <strong>{formData.firstName}</strong>, you are in <strong>Grade {parseInt(studentGrade)}</strong> and not eligible to register at this time.
                </p>
                <p style={{ color: 'var(--fa-warm-gray)', marginTop: '12px' }}>
                    Only {eligibilityText || 'specific grades'} are currently registering this {registrationSettings.currentSeason}.
                </p>

                {registrations.length > 0 && (
                    <button
                        onClick={() => setView('my-registrations')}
                        style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        View My Previous Registrations
                    </button>
                )}
            </div>
        );
    }

    const isAlreadyRegistered = registrations.some(r =>
        r.testType === eligibleTest ||
        (r.testType === 'SAT' && eligibleTest === 'SAT') ||
        (r.testType === 'PSAT/NMSQT' && eligibleTest?.includes('PSAT')) ||
        (r.testType === 'PSAT 10' && eligibleTest?.includes('PSAT'))
    );

    if (loading && registrations.length === 0) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;

    if (view === 'my-registrations' || isAlreadyRegistered) {
        return (
            <div style={{ padding: '24px', maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <h1 style={{ color: 'var(--fa-dark-blue)', marginBottom: '8px' }}>My Registrations</h1>
                    {isAlreadyRegistered && view === 'register' && (
                        <div style={{ padding: '12px', backgroundColor: '#e6f4ea', color: '#137333', borderRadius: '8px', marginBottom: '16px', border: '1px solid #ceead6' }}>
                            ✅ You are already registered for the {eligibleTest}.
                        </div>
                    )}
                    <button onClick={() => setView('register')} style={{ display: isAlreadyRegistered ? 'none' : 'inline-block', padding: '8px 16px', backgroundColor: '#fff', border: '1px solid #dadce0', borderRadius: '4px', cursor: 'pointer' }}>
                        &larr; Back to Registration
                    </button>
                </div>
                <div className="glass-panel" style={{ padding: '32px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid var(--fa-blue)', paddingBottom: '10px' }}>
                        <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>History</h2>
                        <button onClick={() => setView('register')} style={{ padding: '6px 12px', backgroundColor: '#f7fafc', border: '1px solid #cbd5e0', borderRadius: '6px', cursor: 'pointer' }}>+ New</button>
                    </div>

                    {registrations.length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--fa-warm-gray)', padding: '40px 0' }}>You haven't registered for any tests yet.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            {registrations.map(reg => (
                                <div key={reg.id} style={{ padding: '16px', border: '1px solid #e2e8f0', borderRadius: '8px', backgroundColor: 'rgba(255,255,255,0.7)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                                        <span style={{ fontSize: '16px', color: 'var(--fa-dark-blue)' }}>{reg.testType}</span>
                                        <span style={{
                                            fontSize: '11px',
                                            padding: '4px 10px',
                                            borderRadius: '20px',
                                            backgroundColor: reg.paymentRecd === 'Yes' ? '#e6f4ea' : '#fff8e1',
                                            color: reg.paymentRecd === 'Yes' ? '#1e8e3e' : '#f57f17'
                                        }}>
                                            {reg.paymentRecd === 'Yes' ? 'PAID' : 'PAYMENT PENDING'}
                                        </span>
                                    </div>
                                    <div style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginTop: '6px' }}>
                                        Status: {reg.status || 'Pending'} | Counselor: {reg.counselor}
                                    </div>
                                    {reg.accommodations && (
                                        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--fa-blue)', fontWeight: '600' }}>
                                            Accomm: {reg.accommodations} {reg.accommodationNotes && `(${reg.accommodationNotes})`}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '600px', margin: '40px auto', padding: '0 20px' }}>
            <div className="glass-panel" style={{ padding: '32px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid var(--fa-blue)', paddingBottom: '12px', marginBottom: '24px' }}>
                    <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>SAT / PSAT Registration</h2>
                    {registrations.length > 0 && (
                        <button onClick={() => setView('my-registrations')} style={{ fontSize: '13px', border: 'none', background: 'none', color: 'var(--fa-blue)', cursor: 'pointer', fontWeight: 'bold' }}>
                            View My Registrations ({registrations.length})
                        </button>
                    )}
                </div>

                {error && (
                    <div style={{ padding: '12px', backgroundColor: '#fff5f5', color: '#c53030', borderRadius: '6px', marginBottom: '20px', fontSize: '14px', border: '1px solid #feb2b2' }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>First Name</label>
                            <input
                                required
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Last Name</label>
                            <input
                                required
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Email Address</label>
                        <input
                            readOnly
                            value={formData.email}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', backgroundColor: '#f8f9fa', color: '#5f6368', outline: 'none' }}
                        />
                        <p style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>Academy email required for registration.</p>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Grade Level</label>
                        <select
                            value={formData.grade}
                            onChange={e => setFormData({ ...formData, grade: e.target.value })}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                            required
                        >
                            <option value="">Select Grade</option>
                            <option value="12">12th Grade</option>
                            <option value="11">11th Grade</option>
                            <option value="10">10th Grade</option>
                            <option value="09">9th Grade</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>School Counselor</label>
                        <select
                            required
                            value={formData.counselor}
                            onChange={e => setFormData({ ...formData, counselor: e.target.value })}
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                        >
                            <option value="">Select your counselor...</option>
                            <option value="Ms. McDonnell">Ms. McDonnell</option>
                            <option value="Ms. Bazanchuk">Ms. Bazanchuk</option>
                            <option value="Mr. Umphrey">Mr. Umphrey</option>
                            <option value="Mr. Sturdevant">Mr. Sturdevant</option>
                        </select>
                    </div>

                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '6px', color: 'var(--fa-dark-blue)' }}>Exam Type</label>
                        <div style={{
                            padding: '14px',
                            borderRadius: '8px',
                            border: '2px solid var(--fa-blue)',
                            backgroundColor: 'rgba(0, 70, 139, 0.05)',
                            fontSize: '16px',
                            fontWeight: 'bold',
                            color: 'var(--fa-blue)'
                        }}>
                            {eligibleTest} (${eligibleTest === 'SAT' ? '60' : '18'})
                        </div>
                        <p style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>Based on your grade level and current registration period.</p>
                    </div>

                    <div style={{ marginBottom: '24px' }}>
                        <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', marginBottom: '10px', color: 'var(--fa-dark-blue)' }}>I am...</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', fontSize: '13px', color: 'var(--fa-dark-blue)' }}>
                                <input
                                    type="radio"
                                    name="studentType"
                                    value="waiver"
                                    required
                                    onChange={e => setFormData({ ...formData, studentType: e.target.value })}
                                    style={{ marginRight: '12px', marginTop: '4px', accentColor: 'var(--fa-blue)' }}
                                />
                                <div>
                                    <strong style={{ fontWeight: '600' }}>Possibly eligible for a waiver</strong>
                                    <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>I will check with my school counselor. (Note: Waivers not available for 10th grade per Collegeboard)</div>
                                </div>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', fontSize: '13px', color: 'var(--fa-dark-blue)' }}>
                                <input
                                    type="radio"
                                    name="studentType"
                                    value="commuter"
                                    onChange={e => setFormData({ ...formData, studentType: e.target.value })}
                                    style={{ marginRight: '12px', marginTop: '4px', accentColor: 'var(--fa-blue)' }}
                                />
                                <div>
                                    <strong style={{ fontWeight: '600' }}>A commuter day student</strong>
                                    <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>I will submit payment to the Business Office.</div>
                                </div>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', fontSize: '13px', color: 'var(--fa-dark-blue)' }}>
                                <input
                                    type="radio"
                                    name="studentType"
                                    value="day"
                                    onChange={e => setFormData({ ...formData, studentType: e.target.value })}
                                    style={{ marginRight: '12px', marginTop: '4px', accentColor: 'var(--fa-blue)' }}
                                />
                                <div>
                                    <strong style={{ fontWeight: '600' }}>A district day student</strong>
                                    <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>I will submit payment to the Business Office.</div>
                                </div>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'flex-start', cursor: 'pointer', fontSize: '13px', color: 'var(--fa-dark-blue)' }}>
                                <input
                                    type="radio"
                                    name="studentType"
                                    value="boarding"
                                    onChange={e => setFormData({ ...formData, studentType: e.target.value })}
                                    style={{ marginRight: '12px', marginTop: '4px', accentColor: 'var(--fa-blue)' }}
                                />
                                <div>
                                    <strong style={{ fontWeight: '600' }}>A boarding student</strong>
                                    <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>I will be billed through my student account.</div>
                                </div>
                            </label>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%',
                            padding: '14px',
                            backgroundColor: loading ? 'var(--fa-warm-gray)' : 'var(--fa-blue)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'background-color 0.2s',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                        }}
                    >
                        {loading ? 'Submitting...' : 'Submit Registration'}
                    </button>

                    <p style={{ textAlign: 'center', fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '16px' }}>
                        By submitting, you agree to these details being shared with the FA Business Office and Counseling department.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default SATRegistration;

import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';

const StudentFormView = ({ email: impersonatedEmail }) => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user, userProfile } = useAuth();
    const effectiveEmail = impersonatedEmail || user?.email;

    const [formSchema, setFormSchema] = useState(null);
    const [studentData, setStudentData] = useState(null);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [alreadySubmitted, setAlreadySubmitted] = useState(false);

    useEffect(() => {
        if (!effectiveEmail) return;

        const fetchData = async () => {
            try {
                // Fetch form schema
                const schemaDoc = await getDoc(doc(db, 'custom_forms', id));
                if (schemaDoc.exists()) {
                    setFormSchema(schemaDoc.data());
                } else {
                    alert("Form not found.");
                    navigate('/student/forms');
                    return;
                }

                // Check if already submitted
                const subQ = query(
                    collection(db, 'form_submissions'), 
                    where('formId', '==', id),
                    where('studentEmail', '==', effectiveEmail)
                );
                const subSnap = await getDocs(subQ);
                if (!subSnap.empty) {
                    setAlreadySubmitted(true);
                    setLoading(false);
                    return;
                }

                // Fetch student data
                let q = query(collection(db, 'master_students'), where('email', '==', effectiveEmail));
                let snap = await getDocs(q);
                if (snap.empty) {
                    q = query(collection(db, 'master_students'), where('email', '==', effectiveEmail.toLowerCase()));
                    snap = await getDocs(q);
                }
                
                if (!snap.empty) {
                    setStudentData(snap.docs[0].data());
                }
                
                setLoading(false);
            } catch (err) {
                console.error("Error fetching data:", err);
                setLoading(false);
            }
        };

        fetchData();
    }, [id, effectiveEmail, navigate]);

    const handleChange = (fieldId, value, isArray = false) => {
        if (isArray) {
            setAnswers(prev => {
                const current = prev[fieldId] || [];
                if (current.includes(value)) {
                    return { ...prev, [fieldId]: current.filter(v => v !== value) };
                } else {
                    return { ...prev, [fieldId]: [...current, value] };
                }
            });
        } else {
            setAnswers(prev => ({ ...prev, [fieldId]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const gradeRaw = studentData ? String(studentData.grade || '').toLowerCase().replace(/[^0-9]/g, '').padStart(2, '0') : '';

            await addDoc(collection(db, 'form_submissions'), {
                formId: id,
                studentEmail: effectiveEmail,
                studentFirstName: studentData?.firstName || userProfile?.firstName || user?.displayName?.split(' ')[0] || '',
                studentLastName: studentData?.lastName || userProfile?.lastName || user?.displayName?.split(' ').slice(1).join(' ') || '',
                studentGrade: gradeRaw,
                answers,
                paid: false,
                submittedAt: serverTimestamp()
            });
            setAlreadySubmitted(true);
        } catch (error) {
            console.error("Error submitting form:", error);
            alert("Failed to submit form.");
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div style={{ padding: '40px', textAlign: 'center' }}>Loading form...</div>;

    if (alreadySubmitted) {
        return (
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '40px', textAlign: 'center' }}>
                <div style={{ fontSize: '40px', marginBottom: '16px' }}>✅</div>
                <h2 style={{ color: 'var(--fa-dark-blue)', marginTop: 0 }}>Submission Received</h2>
                <p style={{ color: 'var(--fa-warm-gray)', marginBottom: '24px' }}>Thank you. Your response has been recorded successfully.</p>
                <button onClick={() => navigate('/student/forms')} style={{ padding: '10px 20px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    &larr; Back to Forms
                </button>
            </div>
        );
    }

    if (!formSchema) return null;

    if (formSchema.status !== 'open') {
        return (
            <div className="glass-panel" style={{ maxWidth: '600px', margin: '40px auto', padding: '40px', textAlign: 'center', backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                <h2 style={{ color: '#991b1b', marginTop: 0 }}>Form Closed</h2>
                <p style={{ color: '#7f1d1d' }}>This form is no longer accepting submissions.</p>
                <button onClick={() => navigate('/student/forms')} style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                    &larr; Back to Forms
                </button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '40px auto', padding: '0 20px', paddingBottom: '100px' }}>
            <button onClick={() => navigate('/student/forms')} style={{ border: 'none', background: 'none', color: 'var(--fa-blue)', cursor: 'pointer', marginBottom: '16px', padding: 0, fontWeight: 'bold' }}>
                &larr; Back
            </button>
            
            <div className="glass-panel" style={{ padding: '32px' }}>
                <h1 style={{ margin: '0 0 12px 0', color: 'var(--fa-dark-blue)' }}>{formSchema.title}</h1>
                {formSchema.description && (
                    <p style={{ color: 'var(--fa-warm-gray)', marginBottom: '24px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {formSchema.description}
                    </p>
                )}
                
                {formSchema.fee > 0 && (
                    <div style={{ padding: '16px', backgroundColor: 'rgba(0, 70, 139, 0.05)', borderLeft: '4px solid var(--fa-blue)', borderRadius: '4px', marginBottom: '32px' }}>
                        <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>Fee: ${formSchema.fee}</div>
                        <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)' }}>Payment will be handled after submission.</div>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)', marginBottom: '16px' }}>Basic Info</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                            <div>
                                <label style={labelStyle}>First Name</label>
                                <input readOnly value={studentData?.firstName || userProfile?.firstName || user?.displayName?.split(' ')[0] || ''} style={readOnlyInputStyle} />
                            </div>
                            <div>
                                <label style={labelStyle}>Last Name</label>
                                <input readOnly value={studentData?.lastName || userProfile?.lastName || user?.displayName?.split(' ').slice(1).join(' ') || ''} style={readOnlyInputStyle} />
                            </div>
                        </div>
                        <div>
                            <label style={labelStyle}>Email</label>
                            <input readOnly value={effectiveEmail} style={readOnlyInputStyle} />
                        </div>
                    </div>

                    {formSchema.fields && formSchema.fields.length > 0 && (
                        <div style={{ marginBottom: '32px' }}>
                            <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)', marginBottom: '16px' }}>Additional Questions</h3>
                            
                            {formSchema.fields.map(field => (
                                <div key={field.id} style={{ marginBottom: '24px' }}>
                                    <label style={labelStyle}>
                                        {field.label} {field.required && <span style={{ color: 'var(--fa-red)' }}>*</span>}
                                    </label>
                                    {field.description && <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginBottom: '8px' }}>{field.description}</div>}
                                    
                                    {field.type === 'text' && (
                                        <input
                                            type="text"
                                            required={field.required}
                                            value={answers[field.id] || ''}
                                            onChange={(e) => handleChange(field.id, e.target.value)}
                                            style={inputStyle}
                                        />
                                    )}
                                    {field.type === 'textarea' && (
                                        <textarea
                                            required={field.required}
                                            value={answers[field.id] || ''}
                                            onChange={(e) => handleChange(field.id, e.target.value)}
                                            style={{ ...inputStyle, minHeight: '100px', fontFamily: 'inherit' }}
                                        />
                                    )}
                                    {field.type === 'select' && (
                                        <select
                                            required={field.required}
                                            value={answers[field.id] || ''}
                                            onChange={(e) => handleChange(field.id, e.target.value)}
                                            style={inputStyle}
                                        >
                                            <option value="">Select an option...</option>
                                            {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                        </select>
                                    )}
                                    {field.type === 'radio' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {field.options?.map((opt, i) => (
                                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                                    <input
                                                        type="radio"
                                                        name={`field_${field.id}`}
                                                        value={opt}
                                                        required={field.required}
                                                        checked={answers[field.id] === opt}
                                                        onChange={(e) => handleChange(field.id, e.target.value)}
                                                    />
                                                    {opt}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {field.type === 'checkboxGroup' && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {field.options?.map((opt, i) => (
                                                <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                                    <input
                                                        type="checkbox"
                                                        value={opt}
                                                        checked={(answers[field.id] || []).includes(opt)}
                                                        onChange={(e) => handleChange(field.id, e.target.value, true)}
                                                    />
                                                    {opt}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {field.type === 'checkbox' && (
                                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
                                            <input
                                                type="checkbox"
                                                required={field.required && !answers[field.id]}
                                                checked={answers[field.id] || false}
                                                onChange={(e) => handleChange(field.id, e.target.checked)}
                                            />
                                            {field.label}
                                        </label>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting}
                        style={{
                            width: '100%',
                            padding: '14px',
                            backgroundColor: submitting ? '#ccc' : 'var(--fa-blue)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontWeight: 'bold',
                            fontSize: '16px',
                            cursor: submitting ? 'not-allowed' : 'pointer'
                        }}
                    >
                        {submitting ? 'Submitting...' : 'Submit Response'}
                    </button>
                </form>
            </div>
        </div>
    );
};

const labelStyle = { display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px', color: 'var(--fa-dark-blue)' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', outline: 'none' };
const readOnlyInputStyle = { ...inputStyle, backgroundColor: '#f8f9fa', color: '#5f6368', border: '1px solid #e0e0e0' };

export default StudentFormView;

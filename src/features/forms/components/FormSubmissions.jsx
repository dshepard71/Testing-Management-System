import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';
import Papa from 'papaparse';

const FormSubmissions = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [formSchema, setFormSchema] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const schemaDoc = await getDoc(doc(db, 'custom_forms', id));
                if (schemaDoc.exists()) {
                    setFormSchema(schemaDoc.data());
                } else {
                    alert("Form not found");
                    navigate('/admin/forms');
                    return;
                }

                const q = query(collection(db, 'form_submissions'), where('formId', '==', id));
                const snap = await getDocs(q);
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // sort by date
                data.sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0));
                setSubmissions(data);
            } catch (error) {
                console.error("Error fetching submissions:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, navigate]);

    const togglePayment = async (subId, currentStatus) => {
        try {
            await updateDoc(doc(db, 'form_submissions', subId), {
                paid: !currentStatus
            });
            setSubmissions(prev => prev.map(s => s.id === subId ? { ...s, paid: !currentStatus } : s));
        } catch (error) {
            console.error("Error updating payment:", error);
        }
    };

    const exportToCSV = () => {
        if (!formSchema) return;
        
        const data = submissions.map(sub => {
            const row = {
                'First Name': sub.studentFirstName,
                'Last Name': sub.studentLastName,
                'Email': sub.studentEmail,
                'Grade': sub.studentGrade,
                'Submitted Date': sub.submittedAt?.toDate().toLocaleString() || 'N/A'
            };
            
            if (formSchema.fee > 0) {
                row['Paid?'] = sub.paid ? 'Yes' : 'No';
            }

            formSchema.fields.forEach(field => {
                let answer = sub.answers[field.id];
                if (Array.isArray(answer)) {
                    answer = answer.join(', ');
                } else if (typeof answer === 'boolean') {
                    answer = answer ? 'Yes' : 'No';
                }
                row[field.label] = answer || '';
            });

            return row;
        });

        const csv = Papa.unparse(data);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `${formSchema.title.replace(/[^a-z0-9]/gi, '_')}_Submissions.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading submissions...</div>;
    if (!formSchema) return null;

    return (
        <div style={{ padding: '0 20px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <button onClick={() => navigate('/admin/forms')} style={{ border: 'none', background: 'none', color: 'var(--fa-blue)', cursor: 'pointer', marginBottom: '8px', padding: 0, fontWeight: 'bold' }}>
                        &larr; Back to Forms
                    </button>
                    <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '24px', fontWeight: 'bold' }}>{formSchema.title}</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)', fontSize: '14px' }}>{submissions.length} total submissions</p>
                </div>
                <button
                    onClick={exportToCSV}
                    disabled={submissions.length === 0}
                    style={{ padding: '10px 20px', backgroundColor: 'white', color: 'var(--fa-blue)', border: '1px solid var(--fa-blue)', borderRadius: '8px', cursor: submissions.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', fontSize: '14px' }}
                >
                    Export to CSV
                </button>
            </div>

            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', overflowX: 'auto' }}>
                {submissions.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>
                        No submissions yet.
                    </div>
                ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(0, 70, 139, 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontSize: '13px' }}>Student</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontSize: '13px' }}>Grade</th>
                                {formSchema.fee > 0 && (
                                    <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontSize: '13px' }}>Payment (${formSchema.fee})</th>
                                )}
                                {formSchema.fields.map(field => (
                                    <th key={field.id} style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontSize: '13px' }}>{field.label}</th>
                                ))}
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontSize: '13px' }}>Date</th>
                            </tr>
                        </thead>
                        <tbody>
                            {submissions.map(sub => (
                                <tr key={sub.id} style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: 'white' }}>
                                    <td style={{ padding: '12px 16px' }}>
                                        <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{sub.studentLastName}, {sub.studentFirstName}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)' }}>{sub.studentEmail}</div>
                                    </td>
                                    <td style={{ padding: '12px 16px', fontSize: '13px' }}>{sub.studentGrade}</td>
                                    {formSchema.fee > 0 && (
                                        <td style={{ padding: '12px 16px' }}>
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', color: sub.paid ? '#1e8e3e' : '#f57f17' }}>
                                                <input 
                                                    type="checkbox" 
                                                    checked={sub.paid || false} 
                                                    onChange={() => togglePayment(sub.id, sub.paid || false)}
                                                />
                                                {sub.paid ? 'PAID' : 'PENDING'}
                                            </label>
                                        </td>
                                    )}
                                    {formSchema.fields.map(field => {
                                        let answerText = sub.answers[field.id];
                                        if (Array.isArray(answerText)) {
                                            answerText = answerText.join(', ');
                                        } else if (typeof answerText === 'boolean') {
                                            answerText = answerText ? 'Yes' : 'No';
                                        }
                                        return (
                                            <td key={field.id} style={{ padding: '12px 16px', fontSize: '13px', maxWidth: '200px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={answerText}>
                                                {answerText}
                                            </td>
                                        );
                                    })}
                                    <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--fa-warm-gray)' }}>
                                        {sub.submittedAt?.toDate().toLocaleDateString() || ''}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export default FormSubmissions;

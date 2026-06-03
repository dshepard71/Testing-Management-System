import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';

const FormManager = () => {
    const [forms, setForms] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const unsub = onSnapshot(collection(db, 'custom_forms'), (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // Sort by createdAt, newest first
            data.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
            setForms(data);
            setLoading(false);
        });
        return () => unsub();
    }, []);

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this form? All submissions will still exist in the database but the form will be gone.')) {
            await deleteDoc(doc(db, 'custom_forms', id));
        }
    };

    const toggleStatus = async (form) => {
        await updateDoc(doc(db, 'custom_forms', form.id), {
            status: form.status === 'open' ? 'closed' : 'open'
        });
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading forms...</div>;

    return (
        <div style={{ padding: '0 20px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '24px', fontWeight: 'bold' }}>Registration Forms</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)', fontSize: '14px' }}>Manage all built-in and custom registration forms.</p>
                </div>
                <button
                    onClick={() => navigate('/admin/forms/build')}
                    style={{ padding: '10px 20px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}
                >
                    + Create Custom Form
                </button>
            </div>

            <div style={{ marginBottom: '32px' }}>
                <h3 style={{ color: 'var(--fa-dark-blue)', marginBottom: '16px', fontSize: '16px' }}>System Forms</h3>
                <div 
                    className="glass-panel" 
                    style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                    onClick={() => navigate('/admin/testing-settings')}
                    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
                >
                    <div>
                        <h4 style={{ margin: '0 0 4px 0', color: 'var(--fa-dark-blue)', fontSize: '16px' }}>SAT/PSAT Registration</h4>
                        <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '13px' }}>Configure deadlines, eligibility, and toggle the official SAT/PSAT registration form.</p>
                    </div>
                    <button style={{ padding: '8px 16px', backgroundColor: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '6px', color: 'var(--fa-dark-blue)', fontWeight: 'bold', fontSize: '12px' }}>
                        Configure ⚙️
                    </button>
                </div>
            </div>

            <div>
                <h3 style={{ color: 'var(--fa-dark-blue)', marginBottom: '16px', fontSize: '16px' }}>Custom Forms</h3>
                <div className="glass-panel" style={{ padding: 0, overflow: 'hidden' }}>
                    {forms.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>
                            No custom forms created yet. Click "Create Custom Form" to get started!
                        </div>
                    ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(0, 70, 139, 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={{ padding: '16px', color: 'var(--fa-dark-blue)' }}>Form Title</th>
                                <th style={{ padding: '16px', color: 'var(--fa-dark-blue)' }}>Status</th>
                                <th style={{ padding: '16px', color: 'var(--fa-dark-blue)' }}>Fee</th>
                                <th style={{ padding: '16px', color: 'var(--fa-dark-blue)' }}>Created</th>
                                <th style={{ padding: '16px', color: 'var(--fa-dark-blue)' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {forms.map(form => (
                                <tr key={form.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{form.title}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>{form.description}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <button
                                            onClick={() => toggleStatus(form)}
                                            style={{
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                border: 'none',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                backgroundColor: form.status === 'open' ? '#e6f4ea' : '#fef2f2',
                                                color: form.status === 'open' ? '#1e8e3e' : '#991b1b'
                                            }}
                                        >
                                            {form.status === 'open' ? 'OPEN' : 'CLOSED'}
                                        </button>
                                    </td>
                                    <td style={{ padding: '16px', fontWeight: 'bold' }}>
                                        {form.fee > 0 ? `$${form.fee}` : 'Free'}
                                    </td>
                                    <td style={{ padding: '16px', fontSize: '13px', color: 'var(--fa-warm-gray)' }}>
                                        {form.createdAt?.toDate().toLocaleDateString() || 'N/A'}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => navigate(`/admin/forms/${form.id}/submissions`)} style={{ padding: '6px 12px', backgroundColor: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '6px', cursor: 'pointer', color: 'var(--fa-blue)', fontWeight: 'bold', fontSize: '12px' }}>
                                                View Submissions
                                            </button>
                                            <button onClick={() => navigate(`/admin/forms/build/${form.id}`)} style={{ padding: '6px 12px', backgroundColor: '#f8f9fa', border: '1px solid #dadce0', borderRadius: '6px', cursor: 'pointer', color: 'var(--fa-dark-blue)', fontWeight: 'bold', fontSize: '12px' }}>
                                                Edit
                                            </button>
                                            <button onClick={() => handleDelete(form.id)} style={{ padding: '6px 12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', cursor: 'pointer', color: 'var(--fa-red)', fontWeight: 'bold', fontSize: '12px' }}>
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
                </div>
            </div>
        </div>
    );
};

export default FormManager;

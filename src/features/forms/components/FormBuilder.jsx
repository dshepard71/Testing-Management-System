import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, doc, getDoc, setDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useParams, useNavigate } from 'react-router-dom';

const generateId = () => Math.random().toString(36).substr(2, 9);

const FormBuilder = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(id ? true : false);
    const [saving, setSaving] = useState(false);
    const [showPreview, setShowPreview] = useState(false);

    const [formData, setFormData] = useState({
        title: '',
        description: '',
        fee: 0,
        status: 'open',
        eligibility: {
            grades: [], // e.g. ['09', '10', '11', '12']
            studentTypes: [], // e.g. ['boarding', 'day', 'commuter']
            specificEmails: '' // comma separated whitelist
        },
        fields: []
    });

    useEffect(() => {
        if (id) {
            const fetchForm = async () => {
                const docSnap = await getDoc(doc(db, 'custom_forms', id));
                if (docSnap.exists()) {
                    setFormData(docSnap.data());
                }
                setLoading(false);
            };
            fetchForm();
        }
    }, [id]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.title) return alert("Title is required");
        setSaving(true);
        try {
            if (id) {
                await setDoc(doc(db, 'custom_forms', id), {
                    ...formData,
                    updatedAt: serverTimestamp()
                }, { merge: true });
            } else {
                await addDoc(collection(db, 'custom_forms'), {
                    ...formData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            }
            navigate('/admin/forms');
        } catch (error) {
            console.error("Error saving form:", error);
            alert("Failed to save form.");
        } finally {
            setSaving(false);
        }
    };

    const addField = (type) => {
        setFormData({
            ...formData,
            fields: [
                ...formData.fields,
                {
                    id: generateId(),
                    type,
                    label: `New ${type} field`,
                    description: '',
                    required: false,
                    options: type === 'select' || type === 'radio' || type === 'checkboxGroup' ? ['Option 1', 'Option 2'] : []
                }
            ]
        });
    };

    const updateField = (index, key, value) => {
        const newFields = [...formData.fields];
        newFields[index][key] = value;
        setFormData({ ...formData, fields: newFields });
    };

    const updateFieldOption = (fieldIndex, optionIndex, value) => {
        const newFields = [...formData.fields];
        newFields[fieldIndex].options[optionIndex] = value;
        setFormData({ ...formData, fields: newFields });
    };

    const addFieldOption = (fieldIndex) => {
        const newFields = [...formData.fields];
        newFields[fieldIndex].options.push(`Option ${newFields[fieldIndex].options.length + 1}`);
        setFormData({ ...formData, fields: newFields });
    };

    const removeFieldOption = (fieldIndex, optionIndex) => {
        const newFields = [...formData.fields];
        newFields[fieldIndex].options.splice(optionIndex, 1);
        setFormData({ ...formData, fields: newFields });
    };

    const removeField = (index) => {
        const newFields = [...formData.fields];
        newFields.splice(index, 1);
        setFormData({ ...formData, fields: newFields });
    };

    const toggleEligibility = (category, value) => {
        const current = formData.eligibility[category] || [];
        const updated = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
        setFormData({ ...formData, eligibility: { ...formData.eligibility, [category]: updated } });
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading form builder...</div>;

    return (
        <div style={{ padding: '0 20px', maxWidth: '1000px', margin: '0 auto', paddingBottom: '100px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '24px', fontWeight: 'bold' }}>
                    {id ? 'Edit Form' : 'Create New Form'}
                </h2>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => setShowPreview(true)} style={{ padding: '10px 20px', backgroundColor: 'white', color: 'var(--fa-blue)', border: '1px solid var(--fa-blue)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        👁️ Preview
                    </button>
                    <button onClick={() => navigate('/admin/forms')} style={{ padding: '10px 20px', backgroundColor: '#f8f9fa', color: '#333', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
                        Cancel
                    </button>
                    <button onClick={handleSave} disabled={saving} style={{ padding: '10px 20px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 'bold' }}>
                        {saving ? 'Saving...' : 'Save Form'}
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Basic Info */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)' }}>Basic Information</h3>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', color: 'var(--fa-dark-blue)' }}>Form Title *</label>
                            <input
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '16px' }}
                                placeholder="e.g. SAT Prep Course Registration"
                                required
                            />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', color: 'var(--fa-dark-blue)' }}>Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', minHeight: '80px', fontFamily: 'inherit' }}
                                placeholder="Provide instructions or details about this form..."
                            />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', color: 'var(--fa-dark-blue)' }}>Fee Amount ($)</label>
                                <input
                                    type="number"
                                    value={formData.fee}
                                    onChange={(e) => setFormData({ ...formData, fee: Number(e.target.value) })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
                                />
                                <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>Set to 0 if free.</div>
                            </div>
                            <div>
                                <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '8px', fontSize: '14px', color: 'var(--fa-dark-blue)' }}>Status</label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px' }}
                                >
                                    <option value="open">Open (Accepting Submissions)</option>
                                    <option value="closed">Closed (Hidden from students)</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Eligibility */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)', marginBottom: '8px' }}>Eligibility Rules</h3>
                        <p style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '20px' }}>Leave unchecked to allow all. Check specific boxes to restrict access.</p>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                            <div>
                                <strong style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--fa-dark-blue)' }}>Allowed Grades</strong>
                                {['09', '10', '11', '12'].map(grade => (
                                    <label key={grade} style={{ display: 'block', marginBottom: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={(formData.eligibility.grades || []).includes(grade)}
                                            onChange={() => toggleEligibility('grades', grade)}
                                            style={{ marginRight: '8px' }}
                                        />
                                        Grade {grade}
                                    </label>
                                ))}
                            </div>
                            <div>
                                <strong style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--fa-dark-blue)' }}>Allowed Student Types</strong>
                                {['boarding', 'day', 'commuter'].map(type => (
                                    <label key={type} style={{ display: 'block', marginBottom: '6px', fontSize: '13px', cursor: 'pointer', textTransform: 'capitalize' }}>
                                        <input 
                                            type="checkbox" 
                                            checked={(formData.eligibility.studentTypes || []).includes(type)}
                                            onChange={() => toggleEligibility('studentTypes', type)}
                                            style={{ marginRight: '8px' }}
                                        />
                                        {type}
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div>
                            <strong style={{ display: 'block', fontSize: '14px', marginBottom: '8px', color: 'var(--fa-dark-blue)' }}>Specific Student Whitelist (Optional)</strong>
                            <textarea
                                value={formData.eligibility.specificEmails || ''}
                                onChange={(e) => setFormData({ ...formData, eligibility: { ...formData.eligibility, specificEmails: e.target.value } })}
                                placeholder="Enter specific student emails separated by commas..."
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '13px', minHeight: '60px', fontFamily: 'inherit' }}
                            />
                            <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>If emails are provided, ONLY these students can see the form (grade/type rules are ignored).</div>
                        </div>
                    </div>

                    {/* Form Builder */}
                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>Custom Questions</h3>
                        </div>

                        {formData.fields.length === 0 ? (
                            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--fa-warm-gray)', border: '2px dashed #ccc', borderRadius: '8px' }}>
                                No custom fields added yet. Students will only be asked for their basic info (Name/Email) if you don't add any.
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {formData.fields.map((field, index) => (
                                    <div key={field.id} style={{ padding: '20px', border: '1px solid #dadce0', borderRadius: '8px', backgroundColor: '#f8f9fa' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flex: 1 }}>
                                                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'white', backgroundColor: 'var(--fa-blue)', padding: '4px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                                    {field.type}
                                                </span>
                                                <input
                                                    type="text"
                                                    value={field.label}
                                                    onChange={(e) => updateField(index, 'label', e.target.value)}
                                                    style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc', fontWeight: 'bold', fontSize: '14px' }}
                                                    placeholder="Question label..."
                                                />
                                            </div>
                                            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginLeft: '16px' }}>
                                                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                                                    <input type="checkbox" checked={field.required} onChange={(e) => updateField(index, 'required', e.target.checked)} />
                                                    Required
                                                </label>
                                                <button onClick={() => removeField(index)} style={{ padding: '6px', backgroundColor: '#fef2f2', color: 'var(--fa-red)', border: 'none', borderRadius: '4px', cursor: 'pointer' }} title="Remove Field">
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>

                                        <input
                                            type="text"
                                            value={field.description || ''}
                                            onChange={(e) => updateField(index, 'description', e.target.value)}
                                            style={{ width: '100%', padding: '6px 8px', borderRadius: '4px', border: '1px solid #e0e0e0', fontSize: '12px', marginBottom: '16px' }}
                                            placeholder="Optional hint or directions for this question..."
                                        />

                                        {(field.type === 'select' || field.type === 'radio' || field.type === 'checkboxGroup') && (
                                            <div style={{ paddingLeft: '12px', borderLeft: '2px solid var(--fa-blue)' }}>
                                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)', marginBottom: '8px' }}>Options:</div>
                                                {field.options.map((opt, optIdx) => (
                                                    <div key={optIdx} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                        <input
                                                            type="text"
                                                            value={opt}
                                                            onChange={(e) => updateFieldOption(index, optIdx, e.target.value)}
                                                            style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px' }}
                                                        />
                                                        <button onClick={() => removeFieldOption(index, optIdx)} style={{ padding: '0 8px', backgroundColor: 'transparent', color: 'var(--fa-red)', border: 'none', cursor: 'pointer' }}>✕</button>
                                                    </div>
                                                ))}
                                                <button onClick={() => addFieldOption(index)} style={{ padding: '4px 12px', fontSize: '12px', backgroundColor: 'white', border: '1px dashed #ccc', borderRadius: '4px', cursor: 'pointer', marginTop: '4px' }}>
                                                    + Add Option
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Toolbar */}
                <div style={{ position: 'sticky', top: '24px' }}>
                    <div className="glass-panel" style={{ padding: '20px' }}>
                        <h3 style={{ marginTop: 0, fontSize: '16px', color: 'var(--fa-dark-blue)' }}>Add Question</h3>
                        <p style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginBottom: '16px' }}>
                            Basic info (Name, Email, Grade) is automatically collected for all forms.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button type="button" onClick={() => addField('text')} style={toolbarButtonStyle}>➕ Short Text</button>
                            <button type="button" onClick={() => addField('textarea')} style={toolbarButtonStyle}>➕ Paragraph</button>
                            <button type="button" onClick={() => addField('select')} style={toolbarButtonStyle}>➕ Dropdown</button>
                            <button type="button" onClick={() => addField('radio')} style={toolbarButtonStyle}>➕ Radio (Single Choice)</button>
                            <button type="button" onClick={() => addField('checkboxGroup')} style={toolbarButtonStyle}>➕ Checkbox List (Multiple Choice)</button>
                            <button type="button" onClick={() => addField('checkbox')} style={toolbarButtonStyle}>➕ Single Checkbox (Waiver)</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preview Modal */}
            {showPreview && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '40px' }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto', padding: '32px', position: 'relative' }}>
                        <button onClick={() => setShowPreview(false)} style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--fa-warm-gray)' }}>
                            &times;
                        </button>
                        
                        <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                            <h2 style={{ color: 'var(--fa-blue)', marginTop: 0 }}>Student Preview Mode</h2>
                            <p style={{ color: 'var(--fa-warm-gray)', fontSize: '13px' }}>This is exactly how your form will look to students. Data entered here will not be saved.</p>
                        </div>

                        <h1 style={{ margin: '0 0 12px 0', color: 'var(--fa-dark-blue)' }}>{formData.title || 'Untitled Form'}</h1>
                        {formData.description && (
                            <p style={{ color: 'var(--fa-warm-gray)', marginBottom: '24px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                                {formData.description}
                            </p>
                        )}
                        
                        {formData.fee > 0 && (
                            <div style={{ padding: '16px', backgroundColor: 'rgba(0, 70, 139, 0.05)', borderLeft: '4px solid var(--fa-blue)', borderRadius: '4px', marginBottom: '32px' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>Fee: ${formData.fee}</div>
                                <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)' }}>Payment will be handled after submission.</div>
                            </div>
                        )}

                        <div style={{ marginBottom: '24px', paddingBottom: '24px', borderBottom: '1px solid var(--glass-border)' }}>
                            <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)', marginBottom: '16px' }}>Basic Info</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                                <div>
                                    <label style={labelStyle}>First Name</label>
                                    <input readOnly value="John" style={readOnlyInputStyle} />
                                </div>
                                <div>
                                    <label style={labelStyle}>Last Name</label>
                                    <input readOnly value="Doe" style={readOnlyInputStyle} />
                                </div>
                            </div>
                            <div>
                                <label style={labelStyle}>Email</label>
                                <input readOnly value="student@example.com" style={readOnlyInputStyle} />
                            </div>
                        </div>

                        {formData.fields && formData.fields.length > 0 && (
                            <div style={{ marginBottom: '32px' }}>
                                <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)', marginBottom: '16px' }}>Additional Questions</h3>
                                
                                {formData.fields.map(field => (
                                    <div key={field.id} style={{ marginBottom: '24px' }}>
                                        <label style={labelStyle}>
                                            {field.label || 'Untitled Question'} {field.required && <span style={{ color: 'var(--fa-red)' }}>*</span>}
                                        </label>
                                        {field.description && <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginBottom: '8px' }}>{field.description}</div>}
                                        
                                        {field.type === 'text' && (
                                            <input type="text" style={inputStyle} placeholder="Student answer..." disabled />
                                        )}
                                        {field.type === 'textarea' && (
                                            <textarea style={{ ...inputStyle, minHeight: '100px', fontFamily: 'inherit' }} placeholder="Student answer..." disabled />
                                        )}
                                        {field.type === 'select' && (
                                            <select style={inputStyle} disabled>
                                                <option value="">Select an option...</option>
                                                {field.options?.map((opt, i) => <option key={i} value={opt}>{opt}</option>)}
                                            </select>
                                        )}
                                        {field.type === 'radio' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {field.options?.map((opt, i) => (
                                                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', fontSize: '14px', color: '#666' }}>
                                                        <input type="radio" disabled />
                                                        {opt}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        {field.type === 'checkboxGroup' && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                {field.options?.map((opt, i) => (
                                                    <label key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', fontSize: '14px', color: '#666' }}>
                                                        <input type="checkbox" disabled />
                                                        {opt}
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        {field.type === 'checkbox' && (
                                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'not-allowed', fontSize: '14px', color: '#666' }}>
                                                <input type="checkbox" disabled />
                                                {field.label}
                                            </label>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            disabled
                            style={{
                                width: '100%',
                                padding: '14px',
                                backgroundColor: 'var(--fa-blue)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '16px',
                                cursor: 'not-allowed',
                                opacity: 0.7
                            }}
                        >
                            Submit Response (Preview)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const labelStyle = { display: 'block', fontWeight: 'bold', marginBottom: '6px', fontSize: '14px', color: 'var(--fa-dark-blue)' };
const inputStyle = { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', fontSize: '14px', outline: 'none' };
const readOnlyInputStyle = { ...inputStyle, backgroundColor: '#f8f9fa', color: '#5f6368', border: '1px solid #e0e0e0' };

const toolbarButtonStyle = {
    padding: '10px',
    textAlign: 'left',
    backgroundColor: 'white',
    border: '1px solid #dadce0',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold',
    color: 'var(--fa-dark-blue)',
    fontSize: '13px',
    transition: 'background 0.2s'
};

export default FormBuilder;

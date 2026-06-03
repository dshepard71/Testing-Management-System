import React, { useState } from 'react';

const StaffManagementModal = ({ isOpen, onClose, staffList, onAddStaff, onUpdateStaff, onDeleteStaff }) => {
    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffEmail, setNewStaffEmail] = useState('');
    const [editingStaff, setEditingStaff] = useState(null);

    if (!isOpen) return null;

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newStaffName.trim()) return;
        try {
            await onAddStaff(newStaffName, newStaffEmail);
            setNewStaffName('');
            setNewStaffEmail('');
        } catch (err) {
            alert(err.message || "Failed to add staff member.");
        }
    };

    const handleStartEdit = (staff) => {
        setEditingStaff(staff);
        setNewStaffName(typeof staff === 'string' ? staff : (staff.name || ''));
        setNewStaffEmail(typeof staff === 'string' ? '' : (staff.email || ''));
    };

    const handleUpdate = async () => {
        if (!newStaffName.trim() || !editingStaff) return;
        try {
            await onUpdateStaff(editingStaff, newStaffName, newStaffEmail);
            setEditingStaff(null);
            setNewStaffName('');
            setNewStaffEmail('');
        } catch (err) {
            alert(err.message || "Failed to update staff member.");
        }
    };

    const handleCancelEdit = () => {
        setEditingStaff(null);
        setNewStaffName('');
        setNewStaffEmail('');
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center',
            zIndex: 1000, backdropFilter: 'blur(4px)'
        }} className="no-print">
            <div className="glass-panel" style={{
                padding: '28px', width: '450px', maxWidth: '95%',
                backgroundColor: 'rgba(255, 255, 255, 0.95)', display: 'flex', flexDirection: 'column'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '20px' }}>Staff Registry</h3>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer' }}>✕</button>
                </div>

                {/* Form area */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                    <input
                        type="text"
                        placeholder="Name (e.g. Mr. Smith)"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                    />
                    <input
                        type="email"
                        placeholder="Email (e.g. msmith@fryeburgacademy.org)"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        style={{ padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                    />
                    
                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        {editingStaff ? (
                            <>
                                <button onClick={handleUpdate} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--fa-green)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>💾 Update</button>
                                <button onClick={handleCancelEdit} style={{ padding: '10px 14px', backgroundColor: '#f1f3f4', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                            </>
                        ) : (
                            <button onClick={handleAdd} style={{ flex: 1, padding: '10px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>Add Staff Member</button>
                        )}
                    </div>
                </div>

                {/* List registry */}
                <div style={{ maxHeight: '250px', overflowY: 'auto', border: '1px solid #eee', borderRadius: '6px', backgroundColor: 'white' }}>
                    {staffList.map((staff, idx) => (
                        <div key={idx} style={{
                            padding: '12px', borderBottom: '1px solid #eee', display: 'flex',
                            justifyContent: 'space-between', alignItems: 'center',
                            backgroundColor: editingStaff === staff ? 'rgba(234,176,16,0.06)' : 'transparent'
                        }}>
                            <div>
                                <div style={{ fontWeight: '600', color: 'var(--fa-dark-blue)', fontSize: '13px' }}>{staff.name}</div>
                                <div style={{ fontSize: '11px', color: staff.email ? 'var(--fa-blue)' : '#999' }}>{staff.email || 'No email configured'}</div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => handleStartEdit(staff)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Edit">✏️</button>
                                <button onClick={() => onDeleteStaff(staff)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }} title="Delete">🗑️</button>
                            </div>
                        </div>
                    ))}
                    {staffList.length === 0 && (
                        <div style={{ padding: '24px', color: '#888', textAlign: 'center', fontSize: '12px' }}>No staff registered yet.</div>
                    )}
                </div>

                <button onClick={onClose} style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f1f3f4', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Close Registry</button>
            </div>
        </div>
    );
};

export default StaffManagementModal;

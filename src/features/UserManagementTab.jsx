import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, writeBatch, deleteField } from 'firebase/firestore';
import { db } from '../firebase'; // Fixed import path

const CaseloadInput = ({ u, handleUpdateCaseloadName }) => {
    const [val, setVal] = useState(u.caseloadName || '');

    useEffect(() => {
        setVal(u.caseloadName || '');
    }, [u.caseloadName]);

    return (
        <input 
            type="text"
            placeholder="e.g. Johnson"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onBlur={() => {
                if (val !== (u.caseloadName || '')) {
                    handleUpdateCaseloadName(u.id, val);
                }
            }}
            onKeyDown={(e) => {
                if (e.key === 'Enter') {
                    e.target.blur();
                }
            }}
            style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '13px', width: '120px', outline: 'none' }}
        />
    );
};

const UserManagementTab = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newMemberEmail, setNewMemberEmail] = useState('');
    const [newMemberRole, setNewMemberRole] = useState('student');
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [impersonatedCaseload, setImpersonatedCaseload] = useState(null);

    const [adminEmails, setAdminEmails] = useState([]);
    const [newAdminEmail, setNewAdminEmail] = useState('');

    useEffect(() => {
        const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
            const usersData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setUsers(usersData);
            setLoading(false);
        }, (error) => {
            console.error("Firestore error:", error);
            setLoading(false);
        });

        const adminEmailsUnsub = onSnapshot(doc(db, 'settings', 'admin_users'), (docSnap) => {
            if (docSnap.exists()) {
                setAdminEmails(docSnap.data().emails || []);
            }
        });

        return () => {
            unsubscribeUsers();
            adminEmailsUnsub();
        };
    }, []);

    const handleUpdateUserRole = async (userId, newRole) => {
        try {
            await updateDoc(doc(db, 'users', userId), {
                role: newRole,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating user role:", error);
            alert("Failed to update user role");
        }
    };

    const handleUpdateCaseloadName = async (userId, caseloadName) => {
        try {
            await updateDoc(doc(db, 'users', userId), {
                caseloadName: caseloadName,
                updatedAt: serverTimestamp()
            });
        } catch (error) {
            console.error("Error updating caseload name:", error);
        }
    };

    const handleAddMember = async (e) => {
        e.preventDefault();
        if (!newMemberEmail) return;

        try {
            const userId = newMemberEmail.toLowerCase();
            await setDoc(doc(db, 'users', userId), {
                email: userId,
                role: newMemberRole,
                createdAt: serverTimestamp()
            });
            setNewMemberEmail('');
        } catch (error) {
            console.error("Error adding member:", error);
            alert("Failed to add member");
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm("Are you sure you want to delete this user?")) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
        } catch (error) {
            console.error("Error deleting user:", error);
            alert("Failed to delete user");
        }
    };

    const handleAddAdminEmail = async (e) => {
        e.preventDefault();
        if (!newAdminEmail) return;
        const emailToAdd = newAdminEmail.toLowerCase().trim();
        if (adminEmails.includes(emailToAdd)) {
            alert("Email is already in the admin list.");
            return;
        }
        try {
            const updatedEmails = [...adminEmails, emailToAdd];
            await setDoc(doc(db, 'settings', 'admin_users'), { emails: updatedEmails }, { merge: true });
            setNewAdminEmail('');
        } catch (error) {
            console.error("Error adding admin email:", error);
            alert("Failed to add admin email");
        }
    };

    const handleRemoveAdminEmail = async (emailToRemove) => {
        if (!window.confirm(`Remove ${emailToRemove} from admins?`)) return;
        try {
            const updatedEmails = adminEmails.filter(e => e !== emailToRemove);
            await setDoc(doc(db, 'settings', 'admin_users'), { emails: updatedEmails }, { merge: true });
        } catch (error) {
            console.error("Error removing admin email:", error);
        }
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading User Data...</div>;

    return (
        <div className="glass-panel" style={{ padding: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h2 style={{ margin: 0, fontSize: '26px', fontWeight: '600' }}>User Management</h2>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
                {/* Add Member Form */}
                <div style={{ padding: '24px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                    <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '20px' }}>Add System Member</h3>
                    <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '6px' }}>Email Address</label>
                            <input
                                type="email"
                                value={newMemberEmail}
                                onChange={(e) => setNewMemberEmail(e.target.value)}
                                placeholder="user@fryeburgacademy.org"
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                                required
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '6px' }}>System Role</label>
                            <select
                                value={newMemberRole}
                                onChange={(e) => setNewMemberRole(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                            >
                                <option value="student">Student</option>
                                <option value="proctor">Proctor</option>
                                <option value="counselor">Counselor</option>
                                <option value="case_manager">Case Manager</option>
                                <option value="business">Business Office</option>
                                <option value="attendance">Attendance Clerk</option>
                                <option value="accommodations_director">Accommodations Director</option>
                                <option value="admin">System Admin</option>
                            </select>
                        </div>
                        <button type="submit" style={{ padding: '12px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', marginTop: '8px', transition: 'background 0.2s' }}>
                            Add Member
                        </button>
                    </form>
                </div>

                {/* Admin Access Control */}
                <div style={{ padding: '24px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                    <h3 style={{ marginTop: 0, fontSize: '18px', marginBottom: '20px' }}>Global Administrative Access</h3>
                    <p style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', lineHeight: '1.5', marginBottom: '20px' }}>
                        Users listed here have total system control including student data export, financial summaries, and full proctor assignments.
                    </p>
                    <form onSubmit={handleAddAdminEmail} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                        <input
                            type="email"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            placeholder="Add admin email..."
                            style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                        />
                        <button type="submit" style={{ padding: '10px 16px', backgroundColor: 'white', border: '1px solid #dadce0', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Add</button>
                    </form>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {adminEmails.map(email => (
                            <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px', backgroundColor: 'white', borderRadius: '6px', border: '1px solid #eee' }}>
                                <span style={{ fontSize: '14px', fontWeight: '500' }}>{email}</span>
                                <button onClick={() => handleRemoveAdminEmail(email)} style={{ color: 'var(--fa-red)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', padding: '4px', fontWeight: '600' }}>Remove</button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* User List Table */}
            <div style={{ marginTop: '40px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <div>
                        <h3 style={{ fontSize: '20px', margin: 0 }}>Active User Directory</h3>
                        {impersonatedCaseload && (
                            <div style={{ fontSize: '13px', color: 'var(--fa-red)', fontWeight: 'bold', marginTop: '4px' }}>
                                👁️ Currently Viewing As Case Manager: "{impersonatedCaseload}" 
                                <button onClick={() => setImpersonatedCaseload(null)} style={{ marginLeft: '10px', padding: '2px 8px', borderRadius: '4px', border: '1px solid var(--fa-red)', backgroundColor: 'white', color: 'var(--fa-red)', cursor: 'pointer', fontSize: '11px' }}>Stop View As</button>
                            </div>
                        )}
                    </div>
                    <div style={{ display: 'flex', gap: '12px' }}>
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #dadce0', fontSize: '14px', outline: 'none', backgroundColor: 'white', cursor: 'pointer', color: 'var(--fa-dark-blue)', fontWeight: '500' }}
                        >
                            <option value="all">All Roles</option>
                            <option value="student">Student</option>
                            <option value="proctor">Proctor</option>
                            <option value="counselor">Counselor</option>
                            <option value="case_manager">Case Manager</option>
                            <option value="business">Business Office</option>
                            <option value="attendance">Attendance Clerk</option>
                            <option value="accommodations_director">Accommodations Director</option>
                            <option value="admin">System Admin</option>
                        </select>
                        <input 
                            type="text" 
                            placeholder="Search directory by name or email..." 
                            value={userSearchTerm}
                            onChange={(e) => setUserSearchTerm(e.target.value)}
                            style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #dadce0', width: '300px', fontSize: '14px', outline: 'none' }}
                        />
                    </div>
                </div>
                
                <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #dadce0', backgroundColor: 'white' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #dadce0' }}>
                                <th style={{ textAlign: 'left', padding: '16px', fontSize: '13px', color: 'var(--fa-warm-gray)' }}>Email & Name</th>
                                <th style={{ textAlign: 'left', padding: '16px', fontSize: '13px', color: 'var(--fa-warm-gray)' }}>Status</th>
                                <th style={{ textAlign: 'left', padding: '16px', fontSize: '13px', color: 'var(--fa-warm-gray)' }}>Permissions Role</th>
                                <th style={{ textAlign: 'left', padding: '16px', fontSize: '13px', color: 'var(--fa-warm-gray)' }}>Caseload Link</th>
                                <th style={{ textAlign: 'right', padding: '16px', fontSize: '13px', color: 'var(--fa-warm-gray)' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.filter(u => {
                                const term = userSearchTerm.toLowerCase();
                                const matchesSearch = (u.email || '').toLowerCase().includes(term) || (u.displayName || '').toLowerCase().includes(term);
                                const matchesRole = roleFilter === 'all' || (u.role || 'student').toLowerCase().trim() === roleFilter;
                                return matchesSearch && matchesRole;
                            }).map((u) => (
                                <tr key={u.id} style={{ borderBottom: '1px solid #eee', backgroundColor: impersonatedCaseload && u.caseloadName === impersonatedCaseload ? '#fff5f5' : 'transparent', transition: 'background 0.2s' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: '600', color: 'var(--fa-dark-blue)' }}>{u.email}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)' }}>{u.displayName || 'Pending Sign-in'}</div>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {u.displayName ? (
                                            <span style={{ fontSize: '12px', color: 'var(--fa-green)', backgroundColor: '#eefcf1', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>Verified</span>
                                        ) : (
                                            <span style={{ fontSize: '12px', color: 'var(--fa-gold)', backgroundColor: '#fffbe6', padding: '4px 12px', borderRadius: '12px', fontWeight: '600' }}>Imported</span>
                                        )}
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        <select
                                            value={u.role || 'student'}
                                            onChange={(e) => handleUpdateUserRole(u.id, e.target.value)}
                                            style={{ border: '1px solid #dadce0', borderRadius: '6px', padding: '6px 10px', fontSize: '13px', outline: 'none' }}
                                        >
                                            <option value="student">Student</option>
                                            <option value="proctor">Proctor</option>
                                            <option value="counselor">Counselor</option>
                                            <option value="case_manager">Case Manager</option>
                                            <option value="business">Business Office</option>
                                            <option value="attendance">Attendance Clerk</option>
                                            <option value="accommodations_director">Accommodations Director</option>
                                            <option value="admin">System Admin</option>
                                        </select>
                                    </td>
                                    <td style={{ padding: '16px' }}>
                                        {(((u.role || '').toLowerCase().trim() === 'case_manager') || ((u.role || '').toLowerCase().trim() === 'counselor')) && (
                                            <CaseloadInput u={u} handleUpdateCaseloadName={handleUpdateCaseloadName} />
                                        )}
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', alignItems: 'center' }}>
                                            {u.role === 'case_manager' && u.caseloadName && (
                                                <button
                                                    onClick={() => setImpersonatedCaseload(u.caseloadName)}
                                                    title="View As this Case Manager"
                                                    style={{ border: '1px solid var(--fa-blue)', backgroundColor: impersonatedCaseload === u.caseloadName ? 'var(--fa-blue)' : 'white', color: impersonatedCaseload === u.caseloadName ? 'white' : 'var(--fa-blue)', borderRadius: '6px', padding: '4px 12px', fontSize: '12px', cursor: 'pointer', fontWeight: '600', transition: 'all 0.2s' }}
                                                >
                                                    👁️ View As
                                                </button>
                                            )}
                                            <button 
                                                onClick={() => handleDeleteUser(u.id)}
                                                style={{ color: 'var(--fa-red)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default UserManagementTab;

import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, updateDoc, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../firebase';
import { useAuth } from '../../../context/AuthContext';
import { encryptText, decryptText } from '../../../utils/crypto';

export default function AccommodationsHub() {
    const { user, userProfile } = useAuth();
    const adminEmail = 'dshepard@fryeburgacademy.org';
    const effectiveRole = (user?.email?.toLowerCase() === adminEmail) ? 'admin' : (userProfile?.role || 'student');

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [migrating, setMigrating] = useState(false);

    useEffect(() => {
        // Only load if authorized (admin or accommodations_director)
        if (effectiveRole !== 'admin' && effectiveRole !== 'accommodations_director') {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(collection(db, 'master_students'), (snapshot) => {
            const studentData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    stateId: decryptText(data.stateId || ''),
                    dob: decryptText(data.dob || ''),
                    accommodations: decryptText(data.accommodations || ''),
                    accommodationNotes: decryptText(data.accommodationNotes || '')
                };
            });
            setStudents(studentData);
            setLoading(false);
        }, (error) => {
            console.error("Firestore error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [effectiveRole]);

    const handleMigrateToEncrypted = async () => {
        if (!window.confirm("Are you sure you want to encrypt all plain-text accommodations in the database? This is completely safe and won't disrupt users.")) return;
        setMigrating(true);
        try {
            let count = 0;
            const batch = writeBatch(db);
            
            // 1. Migrate master_students
            const snapMaster = await getDocs(collection(db, 'master_students'));
            snapMaster.docs.forEach(docSnap => {
                const data = docSnap.data();
                const rawAcc = data.accommodations || '';
                const rawNotes = data.accommodationNotes || '';
                
                const needsAccEncrypt = rawAcc && !rawAcc.startsWith('U2FsdGVkX1');
                const needsNotesEncrypt = rawNotes && !rawNotes.startsWith('U2FsdGVkX1');
                
                if (needsAccEncrypt || needsNotesEncrypt) {
                    batch.update(docSnap.ref, {
                        accommodations: encryptText(rawAcc),
                        accommodationNotes: encryptText(rawNotes),
                        lastUpdated: serverTimestamp()
                    });
                    count++;
                }
            });

            // 2. Migrate ap_registrations
            const snapAP = await getDocs(collection(db, 'ap_registrations'));
            snapAP.docs.forEach(docSnap => {
                const data = docSnap.data();
                const rawAcc = data.accommodations || '';
                const rawSSD = data.ssdAccommodations || '';
                
                const needsAccEncrypt = rawAcc && !rawAcc.startsWith('U2FsdGVkX1');
                const needsSSDEncrypt = rawSSD && !rawSSD.startsWith('U2FsdGVkX1');
                
                if (needsAccEncrypt || needsSSDEncrypt) {
                    batch.update(docSnap.ref, {
                        accommodations: encryptText(rawAcc),
                        ssdAccommodations: encryptText(rawSSD)
                    });
                    count++;
                }
            });

            // 3. Migrate sat_registrations
            const snapSAT = await getDocs(collection(db, 'sat_registrations'));
            snapSAT.docs.forEach(docSnap => {
                const data = docSnap.data();
                const rawAcc = data.accommodations || '';
                
                const needsAccEncrypt = rawAcc && !rawAcc.startsWith('U2FsdGVkX1');
                
                if (needsAccEncrypt) {
                    batch.update(docSnap.ref, {
                        accommodations: encryptText(rawAcc)
                    });
                    count++;
                }
            });

            // 4. Migrate seating_charts
            const snapCharts = await getDocs(collection(db, 'seating_charts'));
            snapCharts.docs.forEach(docSnap => {
                const data = docSnap.data();
                let chartModified = false;
                const encryptedAssignedSeats = {};
                
                if (data.assignedSeats) {
                    Object.entries(data.assignedSeats).forEach(([seatId, studentInfo]) => {
                        const rawAcc = studentInfo.accommodations || '';
                        if (rawAcc && !rawAcc.startsWith('U2FsdGVkX1')) {
                            encryptedAssignedSeats[seatId] = {
                                ...studentInfo,
                                accommodations: encryptText(rawAcc)
                            };
                            chartModified = true;
                        } else {
                            encryptedAssignedSeats[seatId] = studentInfo;
                        }
                    });
                }
                
                if (chartModified) {
                    batch.update(docSnap.ref, {
                        assignedSeats: encryptedAssignedSeats
                    });
                    count++;
                }
            });
            
            if (count > 0) {
                await batch.commit();
            }
            alert(`Migration Complete! Successfully encrypted ${count} database documents in Firestore.`);
        } catch (err) {
            console.error("Migration error:", err);
            alert(`Migration failed: ${err.message}`);
        } finally {
            setMigrating(false);
        }
    };

    const handleEdit = (student) => {
        setEditingId(student.id);
        setEditData({ ...student });
    };

    const handleSaveEdit = async (id) => {
        try {
            const docRef = doc(db, 'master_students', id);
            await updateDoc(docRef, {
                accommodations: encryptText(editData.accommodations || ''),
                accommodationNotes: encryptText(editData.accommodationNotes || ''),
                caseManager: editData.caseManager || '',
                lastUpdated: serverTimestamp()
            });
            setEditingId(null);
        } catch (error) {
            console.error("Error saving accommodations:", error);
            alert("Failed to save changes.");
        }
    };

    if (loading) return <div style={{ padding: '48px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>Loading Accommodations Data...</div>;

    if (effectiveRole !== 'admin' && effectiveRole !== 'accommodations_director') {
        return (
            <div className="glass-panel" style={{ padding: '64px', textAlign: 'center' }}>
                <span style={{ fontSize: '64px', display: 'block', marginBottom: '16px' }}>🔒</span>
                <h2 style={{ margin: '0 0 8px 0', color: 'var(--fa-dark-blue)' }}>Access Denied</h2>
                <p style={{ margin: 0, color: 'var(--fa-warm-gray)' }}>You do not have permission to view the global Accommodations Hub.</p>
            </div>
        );
    }

    // Filter students: if searching, show anyone. If not searching, only show students with accommodations.
    const accommodationStudents = students.filter(s => {
        if (s.status === 'Inactive') return false;

        const hasAccoms = !!(s.accommodations || s.hasAccommodations || s.accommodationsNeeded);

        if (searchTerm.length >= 2) {
            const term = searchTerm.toLowerCase();
            const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
            const matchesSearch = fullName.includes(term) || (s.stateId && String(s.stateId).includes(term)) || (s.schoolId && String(s.schoolId).includes(term));
            
            // If actively searching, show ANY matching student in the school
            return matchesSearch;
        }

        // If not searching, only show students who already have accommodations
        return hasAccoms;
    }).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--fa-dark-blue)' }}>Accommodations Hub</h2>
                    <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '14px' }}>
                        Global registry of all student accommodations and 504/IEP plans.
                    </p>
                </div>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    {effectiveRole === 'admin' && (
                        <button
                            onClick={handleMigrateToEncrypted}
                            disabled={migrating}
                            style={{
                                padding: '10px 16px',
                                backgroundColor: migrating ? 'var(--fa-warm-gray)' : 'var(--fa-blue)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '8px',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                cursor: migrating ? 'not-allowed' : 'pointer',
                                transition: 'all 0.2s',
                                marginRight: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            <span>🔒</span> {migrating ? 'Securing Firestore...' : 'Secure Database Records'}
                        </button>
                    )}
                    <div style={{ padding: '8px 16px', background: 'rgba(26, 115, 232, 0.1)', color: '#1a73e8', borderRadius: '8px', fontWeight: 'bold' }}>
                        {accommodationStudents.length} Students
                    </div>
                    <input
                        type="text"
                        placeholder="Search ANY student in school..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid var(--glass-border)', width: '280px', fontSize: '14px', outline: 'none' }}
                    />
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 0, overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--glass-bg)', zIndex: 1, backdropFilter: 'blur(10px)' }}>
                            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={{ padding: '16px 24px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Student</th>
                                <th style={{ padding: '16px 24px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Grade</th>
                                <th style={{ padding: '16px 24px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Case Manager</th>
                                <th style={{ padding: '16px 24px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Accommodations</th>
                                <th style={{ padding: '16px 24px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Notes</th>
                                <th style={{ padding: '16px 24px', color: 'var(--fa-dark-blue)', fontWeight: 'bold', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {accommodationStudents.map(s => {
                                const inferredCaseManager = s.caseManager || (s.advisor ? s.advisor.split(',')[0].trim() : 'Unassigned');
                                
                                return (
                                    <tr key={s.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s', backgroundColor: editingId === s.id ? 'rgba(0, 70, 139, 0.05)' : 'transparent' }}>
                                        {editingId === s.id ? (
                                            <td colSpan="6" style={{ padding: '24px' }}>
                                                <div style={{ background: '#fff', borderRadius: '12px', padding: '24px', border: '1px solid var(--glass-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                                                        <div>
                                                            <h3 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>Editing Accommodations: {s.firstName} {s.lastName}</h3>
                                                            <div style={{ fontSize: '13px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>State ID: {s.stateId || 'N/A'} • Grade {s.grade}</div>
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <button onClick={() => setEditingId(null)} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', background: 'white' }}>Cancel</button>
                                                            <button onClick={() => handleSaveEdit(s.id)} style={{ padding: '8px 24px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save Changes</button>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '32px' }}>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '8px', fontWeight: 'bold' }}>Case Manager (Override)</label>
                                                            <input 
                                                                type="text"
                                                                value={editData.caseManager || ''}
                                                                onChange={e => setEditData({...editData, caseManager: e.target.value})}
                                                                placeholder={s.advisor ? `Defaults to: ${s.advisor.split(',')[0].trim()}` : "Enter Case Manager Name"}
                                                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none' }}
                                                            />
                                                            <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '6px' }}>
                                                                If left blank, the system automatically uses the first advisor listed in the master data.
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <label style={{ display: 'block', fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '8px', fontWeight: 'bold' }}>Standard Accommodations</label>
                                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', padding: '16px', backgroundColor: '#f8f9fa', borderRadius: '8px', border: '1px solid #eee' }}>
                                                                {['Small Group', 'Extended Time', 'Extra Breaks', 'ESOL', 'Other'].map(opt => {
                                                                    const currentAccom = editData.accommodations || '';
                                                                    const isChecked = currentAccom.includes(opt);
                                                                    return (
                                                                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '13px' }}>
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={isChecked}
                                                                                onChange={(e) => {
                                                                                    let accoms = currentAccom.split(',').map(a => a.trim()).filter(a => a);
                                                                                    if (e.target.checked) {
                                                                                        if (!accoms.includes(opt)) accoms.push(opt);
                                                                                    } else {
                                                                                        accoms = accoms.filter(a => a !== opt);
                                                                                    }
                                                                                    setEditData({ ...editData, accommodations: accoms.join(', ') });
                                                                                }}
                                                                                style={{ width: '16px', height: '16px', accentColor: 'var(--fa-blue)' }}
                                                                            />
                                                                            {opt}
                                                                        </label>
                                                                    );
                                                                })}
                                                            </div>
                                                            <div style={{ marginTop: '16px' }}>
                                                                <label style={{ display: 'block', fontSize: '13px', color: 'var(--fa-warm-gray)', marginBottom: '8px', fontWeight: 'bold' }}>Specific Details & SSD Notes</label>
                                                                <textarea
                                                                    placeholder="e.g. SSD# 1234567, 50% Extended Time on Reading only, Tests read aloud."
                                                                    value={editData.accommodationNotes || ''}
                                                                    onChange={e => setEditData({ ...editData, accommodationNotes: e.target.value })}
                                                                    style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #ccc', outline: 'none', minHeight: '80px', fontFamily: 'inherit' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        ) : (
                                            <>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', fontSize: '15px' }}>{s.lastName}, {s.firstName}</div>
                                                    <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)' }}>{s.email}</div>
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>{s.grade || '—'}</td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    <div style={{ fontWeight: '500' }}>{inferredCaseManager}</div>
                                                    {s.caseManager && <div style={{ fontSize: '11px', color: 'var(--fa-blue)', marginTop: '2px' }}>(Explicit Override)</div>}
                                                </td>
                                                <td style={{ padding: '16px 24px' }}>
                                                    {s.accommodations ? (
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                            {s.accommodations.split(',').map((acc, i) => (
                                                                <span key={i} style={{ padding: '4px 8px', backgroundColor: 'rgba(26, 115, 232, 0.1)', color: '#1a73e8', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold' }}>
                                                                    {acc.trim()}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: 'var(--fa-red)', fontWeight: 'bold', fontSize: '12px' }}>Missing Data</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '16px 24px', maxWidth: '300px' }}>
                                                    <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.4' }}>
                                                        {s.accommodationNotes || <span style={{ color: '#ccc', fontStyle: 'italic' }}>No notes provided.</span>}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                    <button 
                                                        onClick={() => handleEdit(s)} 
                                                        style={{ padding: '6px 16px', border: '1px solid var(--fa-blue)', backgroundColor: 'transparent', color: 'var(--fa-blue)', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px', transition: 'all 0.2s' }}
                                                        onMouseOver={e => { e.target.style.backgroundColor = 'var(--fa-blue)'; e.target.style.color = 'white'; }}
                                                        onMouseOut={e => { e.target.style.backgroundColor = 'transparent'; e.target.style.color = 'var(--fa-blue)'; }}
                                                    >
                                                        Edit
                                                    </button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                            {accommodationStudents.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ padding: '48px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>
                                        No students with accommodations found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

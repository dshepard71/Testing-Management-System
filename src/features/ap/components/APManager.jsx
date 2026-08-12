import React, { useEffect, useState } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch, setDoc, getDocs } from 'firebase/firestore';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

const APManager = () => {
    const [registrations, setRegistrations] = useState([]);
    const [masterStudents, setMasterStudents] = useState([]);
    const [settings, setSettings] = useState({ fees: { standard: 99, reduced: 62, lateOrder: 40, lateTesting: 40, unused: 40 } });
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [uploadStatus, setUploadStatus] = useState('');
    const [uploadData, setUploadData] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [selectedIds, setSelectedIds] = useState([]);
    const [manualData, setManualData] = useState({
        firstName: '', lastName: '', email: '', course: '', feeStatus: 'Standard', orderExam: 'Yes',
        lateOrderFee: 'No', lateTestingFee: 'No', unusedFee: 'No'
    });

    useEffect(() => {
        const unsubReg = onSnapshot(collection(db, 'ap_registrations'), (snapshot) => {
            setRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        const unsubMaster = onSnapshot(collection(db, 'master_students'), (snapshot) => {
            setMasterStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubSettings = onSnapshot(doc(db, 'settings', 'ap_registration'), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSettings(prev => ({ ...prev, ...data, fees: { ...prev.fees, ...(data.fees || {}) } }));
            }
        });

        return () => {
            unsubReg();
            unsubMaster();
            unsubSettings();
        };
    }, []);

    const calculateCost = (s) => {
        let base = 0;
        if (s.orderExam === 'Yes') {
            base = s.feeStatus === 'Reduced' ? settings.fees.reduced : settings.fees.standard;
        }
        let extras = 0;
        if (s.lateOrderFee === 'Yes') extras += settings.fees.lateOrder;
        if (s.lateTestingFee === 'Yes') extras += settings.fees.lateTesting;
        if (s.unusedFee === 'Yes') extras += settings.fees.unused;
        return base + extras;
    };

    const handleEdit = (reg) => {
        setEditingId(reg.id);
        setEditData({ ...reg });
    };

    const handleSave = async (id) => {
        try {
            const docRef = doc(db, 'ap_registrations', id);
            await updateDoc(docRef, { ...editData, lastUpdated: serverTimestamp() });
            setEditingId(null);
        } catch (error) {
            console.error("Error saving:", error);
            alert("Failed to save changes.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this registration?")) {
            try {
                await deleteDoc(doc(db, 'ap_registrations', id));
            } catch (error) {
                console.error("Error deleting:", error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected AP registrations?`)) return;
        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, 'ap_registrations', id));
            });
            await batch.commit();
            setSelectedIds([]);
            alert(`Deleted ${selectedIds.length} AP registrations.`);
        } catch (error) {
            console.error("Bulk delete error:", error);
            alert("Failed to delete records.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map(r => r.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleExportCSV = () => {
        const dataToExport = filtered;
        if (dataToExport.length === 0) {
            alert('No AP registrations to export.');
            return;
        }
        const headers = ['Last Name', 'First Name', 'Email', 'Course', 'Fee Status', 'Order Exam', 'Late Order Fee', 'Late Testing Fee', 'Unused Fee', 'Cost'];
        const rows = dataToExport.map(r => [
            r.lastName || '',
            r.firstName || '',
            r.schoolEmail || r.email || '',
            r.course || '',
            r.feeStatus || 'Standard',
            r.orderExam || 'Yes',
            r.lateOrderFee || 'No',
            r.lateTestingFee || 'No',
            r.unusedFee || 'No',
            '$' + calculateCost(r)
        ]);
        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `AP_Registrations_Export_${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploadStatus('Parsing file...');
        const reader = new FileReader();

        if (file.name.endsWith('.csv')) {
            reader.onload = (event) => {
                const csvData = event.target.result;
                const lines = csvData.split('\n');
                const actualCsv = lines.slice(3).join('\n'); // Skip CB headers
                Papa.parse(actualCsv, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => processUploadData(results.data)
                });
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            reader.onload = (event) => {
                const workbook = XLSX.read(event.target.result, { type: 'binary' });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { range: 3 });
                processUploadData(jsonData);
            };
            reader.readAsBinaryString(file);
        }
    };

    const processUploadData = (rawData) => {
        const cleaned = rawData.map(row => {
            const firstName = row['Student First Name'] || '';
            const lastName = row['Student Last Name'] || '';
            let email = row['Email Address'] || '';
            
            // Try to find school email
            let schoolEmail = '';
            const master = masterStudents.find(m => m.firstName?.toLowerCase() === firstName.toLowerCase() && m.lastName?.toLowerCase() === lastName.toLowerCase());
            if (master && master.email) schoolEmail = master.email.toLowerCase();

            return {
                firstName,
                lastName,
                email,
                schoolEmail,
                course: row['Course Enrolled In'] || '',
                feeStatus: row['Fee Status'] || 'Standard',
                orderExam: row['Order Exam?'] || 'Yes',
                lateOrderFee: row['Late Order Fee'] || 'No',
                lateTestingFee: row['Late-Testing Fee'] || 'No',
                unusedFee: row['Unused/Canceled Exam Fee'] || 'No'
            };
        }).filter(s => s.email && s.course);
        
        setUploadData(cleaned);
        setUploadStatus(`Parsed ${cleaned.length} valid records.`);
    };

    const commitUpload = async () => {
        if (!uploadData.length) return;
        setUploadStatus('Saving to database...');
        try {
            const batch = writeBatch(db);
            uploadData.forEach(s => {
                const docId = `${s.email}_${s.course}`.replace(/[.#$/[\]]/g, '_');
                const docRef = doc(collection(db, 'ap_registrations'), docId);
                batch.set(docRef, { ...s, lastUpdated: serverTimestamp() }, { merge: true });
            });
            await batch.commit();
            alert(`Imported ${uploadData.length} registrations.`);
            setShowUploadModal(false);
            setUploadData([]);
            setUploadStatus('');
        } catch (error) {
            console.error(error);
            setUploadStatus(`Error: ${error.message}`);
        }
    };

    const handleManualAdd = async (e) => {
        e.preventDefault();
        try {
            const docId = `${manualData.email}_${manualData.course}`.replace(/[.#$/[\]]/g, '_');
            const docRef = doc(collection(db, 'ap_registrations'), docId);
            
            // Try to find school email
            let schoolEmail = manualData.email;
            if (!manualData.email.includes('@fryeburgacademy.org') && !manualData.email.includes('@myfryeburg.org')) {
                const master = masterStudents.find(m => m.firstName?.toLowerCase() === manualData.firstName.toLowerCase() && m.lastName?.toLowerCase() === manualData.lastName.toLowerCase());
                if (master && master.email) schoolEmail = master.email.toLowerCase();
            }

            await setDoc(docRef, {
                ...manualData,
                schoolEmail,
                lastUpdated: serverTimestamp()
            });

            setManualData({
                firstName: '', lastName: '', email: '', course: '', feeStatus: 'Standard', orderExam: 'Yes',
                lateOrderFee: 'No', lateTestingFee: 'No', unusedFee: 'No'
            });
            setShowManualModal(false);
            alert("Student added manually.");
        } catch (error) {
            console.error("Error adding student:", error);
            alert("Failed to add student.");
        }
    };

    const filtered = registrations.filter(r => 
        `${r.firstName} ${r.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.course?.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '') || (a.course || '').localeCompare(b.course || ''));

    if (loading) return <div style={{ padding: '20px', color: 'var(--fa-warm-gray)' }}>Loading AP data...</div>;

    return (
        <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '20px', fontWeight: 'bold' }}>AP Registration Manager</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)', fontSize: '12px' }}>Manage AP students and exam rosters.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectedIds.length > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            style={{ padding: '8px 16px', backgroundColor: 'var(--fa-red)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        >
                            Delete Selected ({selectedIds.length})
                        </button>
                    )}
                    <button onClick={() => setShowManualModal(true)} style={{ padding: '8px 16px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                        + Add Student
                    </button>
                    <button onClick={() => setShowUploadModal(true)} style={{ padding: '8px 16px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                        Import CollegeBoard Roster
                    </button>
                    <button onClick={handleExportCSV} style={{ padding: '8px 16px', backgroundColor: '#e8f0fe', color: 'var(--fa-blue)', border: '1px solid var(--fa-blue)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}>
                        📥 Export CSV
                    </button>
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '8px 12px', width: '200px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '13px' }} />
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 0, borderRadius: '12px', border: '1px solid var(--glass-border)', overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(0, 70, 139, 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={{ padding: '12px 16px', width: '30px' }}>
                                    <input
                                        type="checkbox"
                                        checked={filtered.length > 0 && selectedIds.length === filtered.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Student</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Course</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Fee Status</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Order?</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Penalties</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Cost</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => (
                                <tr key={r.id} style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: selectedIds.includes(r.id) ? 'rgba(0, 70, 139, 0.05)' : 'transparent' }}>
                                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                        <input
                                            type="checkbox"
                                            checked={selectedIds.includes(r.id)}
                                            onChange={() => toggleSelectOne(r.id)}
                                        />
                                    </td>
                                    {editingId === r.id ? (
                                        <>
                                            <td style={{ padding: '8px 16px' }}>
                                                <input style={{ width: '100%', padding: '4px', borderRadius: '4px' }} value={editData.firstName} onChange={e => setEditData({ ...editData, firstName: e.target.value })} />
                                                <input style={{ width: '100%', padding: '4px', borderRadius: '4px', marginTop: '4px' }} value={editData.lastName} onChange={e => setEditData({ ...editData, lastName: e.target.value })} />
                                            </td>
                                            <td style={{ padding: '8px 16px' }}>
                                                <input style={{ width: '100%', padding: '4px', borderRadius: '4px' }} value={editData.course} onChange={e => setEditData({ ...editData, course: e.target.value })} />
                                            </td>
                                            <td style={{ padding: '8px 16px' }}>
                                                <select value={editData.feeStatus || 'Standard'} onChange={e => setEditData({ ...editData, feeStatus: e.target.value })} style={{ padding: '4px', borderRadius: '4px' }}>
                                                    <option value="Standard">Standard</option>
                                                    <option value="Reduced">Reduced</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '8px 16px' }}>
                                                <select value={editData.orderExam || 'Yes'} onChange={e => setEditData({ ...editData, orderExam: e.target.value })} style={{ padding: '4px', borderRadius: '4px' }}>
                                                    <option value="Yes">Yes</option>
                                                    <option value="No">No</option>
                                                </select>
                                            </td>
                                            <td style={{ padding: '8px 16px', fontSize: '10px' }}>
                                                Late Ord: <select value={editData.lateOrderFee || 'No'} onChange={e => setEditData({ ...editData, lateOrderFee: e.target.value })}><option>No</option><option>Yes</option></select><br/>
                                                Late Test: <select value={editData.lateTestingFee || 'No'} onChange={e => setEditData({ ...editData, lateTestingFee: e.target.value })}><option>No</option><option>Yes</option></select><br/>
                                                Unused: <select value={editData.unusedFee || 'No'} onChange={e => setEditData({ ...editData, unusedFee: e.target.value })}><option>No</option><option>Yes</option></select>
                                            </td>
                                            <td style={{ padding: '8px 16px', fontWeight: 'bold' }}>${calculateCost(editData)}</td>
                                            <td style={{ padding: '8px 16px' }}>
                                                <button onClick={() => handleSave(r.id)} style={{ padding: '4px 8px', backgroundColor: '#1e8e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px', marginRight: '4px' }}>Save</button>
                                                <button onClick={() => setEditingId(null)} style={{ padding: '4px 8px', backgroundColor: '#ccc', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>Cancel</button>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td style={{ padding: '12px 16px' }}>
                                                <div style={{ fontWeight: '600', color: 'var(--fa-dark-blue)' }}>{r.lastName}, {r.firstName}</div>
                                                <div style={{ fontSize: '10px', color: 'var(--fa-warm-gray)' }}>{r.schoolEmail || r.email}</div>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontWeight: '500' }}>{r.course}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ color: r.feeStatus === 'Reduced' ? 'var(--fa-red)' : 'var(--fa-dark-blue)' }}>{r.feeStatus || 'Standard'}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <span style={{ color: r.orderExam === 'No' ? 'var(--fa-red)' : '#1e8e3e', fontWeight: 'bold' }}>{r.orderExam || 'Yes'}</span>
                                            </td>
                                            <td style={{ padding: '12px 16px', fontSize: '10px' }}>
                                                {r.lateOrderFee === 'Yes' && <div style={{ color: 'var(--fa-red)' }}>Late Ord</div>}
                                                {r.lateTestingFee === 'Yes' && <div style={{ color: 'var(--fa-red)' }}>Late Test</div>}
                                                {r.unusedFee === 'Yes' && <div style={{ color: 'var(--fa-red)' }}>Unused</div>}
                                                {r.lateOrderFee !== 'Yes' && r.lateTestingFee !== 'Yes' && r.unusedFee !== 'Yes' && <span style={{ color: '#ccc' }}>None</span>}
                                            </td>
                                            <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>${calculateCost(r)}</td>
                                            <td style={{ padding: '12px 16px' }}>
                                                <button onClick={() => handleEdit(r)} style={{ border: 'none', background: 'none', color: 'var(--fa-blue)', cursor: 'pointer', marginRight: '10px', fontWeight: 'bold', fontSize: '12px' }}>Edit</button>
                                                <button onClick={() => handleDelete(r.id)} style={{ border: 'none', background: 'none', color: 'var(--fa-red)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Delete</button>
                                            </td>
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {showUploadModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
                    <div className="glass-panel" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '600px' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)' }}>Import AP Roster</h3>
                        <p style={{ fontSize: '13px', color: 'var(--fa-warm-gray)' }}>Upload the Excel or CSV export directly from CollegeBoard.</p>
                        
                        <input type="file" accept=".csv, .xlsx" onChange={handleFileUpload} style={{ width: '100%', padding: '10px', border: '1px dashed #ccc', borderRadius: '8px', marginBottom: '15px' }} />
                        
                        {uploadStatus && (
                            <div style={{ padding: '10px', backgroundColor: uploadStatus.includes('Error') ? '#fef2f2' : '#e6f4ea', color: uploadStatus.includes('Error') ? 'var(--fa-red)' : '#1e8e3e', borderRadius: '6px', fontSize: '13px', marginBottom: '15px' }}>
                                {uploadStatus}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button onClick={() => { setShowUploadModal(false); setUploadData([]); setUploadStatus(''); }} style={{ padding: '10px 20px', backgroundColor: '#f1f3f4', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                            <button onClick={commitUpload} disabled={uploadData.length === 0} style={{ padding: '10px 20px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: uploadData.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: uploadData.length === 0 ? 0.5 : 1 }}>
                                Confirm Import
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showManualModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
                    <div className="glass-panel" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '600px' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)' }}>Add AP Student Manually</h3>
                        <form onSubmit={handleManualAdd}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                <input placeholder="First Name" required value={manualData.firstName} onChange={e => setManualData({ ...manualData, firstName: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
                                <input placeholder="Last Name" required value={manualData.lastName} onChange={e => setManualData({ ...manualData, lastName: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
                            </div>
                            <input type="email" placeholder="Student Email (CollegeBoard Email)" required value={manualData.email} onChange={e => setManualData({ ...manualData, email: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '15px' }} />
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '15px', marginBottom: '15px' }}>
                                <input placeholder="Course Name (e.g. AP Biology)" required value={manualData.course} onChange={e => setManualData({ ...manualData, course: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>Fee Status</label>
                                    <select value={manualData.feeStatus} onChange={e => setManualData({ ...manualData, feeStatus: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                                        <option value="Standard">Standard</option>
                                        <option value="Reduced">Reduced</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>Order Exam?</label>
                                    <select value={manualData.orderExam} onChange={e => setManualData({ ...manualData, orderExam: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                                        <option value="Yes">Yes</option>
                                        <option value="No">No</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '20px' }}>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>Late Ord Fee</label>
                                    <select value={manualData.lateOrderFee} onChange={e => setManualData({ ...manualData, lateOrderFee: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>Late Test Fee</label>
                                    <select value={manualData.lateTestingFee} onChange={e => setManualData({ ...manualData, lateTestingFee: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </div>
                                <div>
                                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>Unused Fee</label>
                                    <select value={manualData.unusedFee} onChange={e => setManualData({ ...manualData, unusedFee: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                                        <option value="No">No</option>
                                        <option value="Yes">Yes</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={() => setShowManualModal(false)} style={{ padding: '10px 20px', backgroundColor: '#f1f3f4', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Cancel</button>
                                <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>Add Student</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default APManager;

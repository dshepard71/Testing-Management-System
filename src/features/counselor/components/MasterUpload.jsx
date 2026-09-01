import React, { useState, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { db } from '../../../firebase';
import { useAuth } from '../../../context/AuthContext';
import { collection, writeBatch, doc, serverTimestamp, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { decryptText, encryptText } from '../../../utils/crypto';

const normalizeDOB = (dob) => {
    if (!dob) return '';
    const parts = dob.trim().split(/[/.-]/);
    if (parts.length !== 3) return dob;

    let [m, d, y] = parts;
    if (m.length === 1) m = `0${m}`;
    if (d.length === 1) d = `0${d}`;
    if (y.length === 2) {
        const yr = parseInt(y);
        y = yr > 50 ? `19${y}` : `20${y}`;
    }
    return `${m}/${d}/${y}`;
};

const MasterUpload = ({ filterByCaseload = false, staffName = '', impersonatedCaseload = null }) => {
    const { user, userProfile } = useAuth();
    const adminEmail = 'dshepard@fryeburgacademy.org';
    const effectiveRole = (user?.email?.toLowerCase() === adminEmail) ? 'admin' : (userProfile?.role || 'student');

    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterGrade, setFilterGrade] = useState('All');
    const [filterProgram, setFilterProgram] = useState('All');
    const [filterAdvisor, setFilterAdvisor] = useState('All');
    const [filterAccom, setFilterAccom] = useState('All');
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [selectedIds, setSelectedIds] = useState([]);
    const [validationWarnings, setValidationWarnings] = useState([]);
    const [syncMode, setSyncMode] = useState(false);
    const [overwriteAccommodations, setOverwriteAccommodations] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const [importing, setImporting] = useState(false);
    const [status, setStatus] = useState('');

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'master_students'), (snapshot) => {
            const studentData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dob: decryptText(data.dob || ''),
                    stateId: decryptText(data.stateId || ''),
                    accommodations: decryptText(data.accommodations || ''),
                    accommodationNotes: decryptText(data.accommodationNotes || '')
                };
            });
            setStudents(studentData);
            setLoading(false);
        }, (error) => {
            console.error("Firestore error in MasterUpload:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStatus('Parsing file...');
        const reader = new FileReader();

        if (file.name.endsWith('.csv')) {
            reader.onload = (event) => {
                const csvData = event.target.result;
                Papa.parse(csvData, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        processData(results.data);
                    }
                });
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            reader.onload = (event) => {
                const workbook = XLSX.read(event.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                processData(jsonData);
            };
            reader.readAsBinaryString(file);
        }
    };

    // Helper to check if a cell represents a truthy checkbox
    const isTruthy = (val) => {
        if (!val) return false;
        const str = String(val).trim().toLowerCase();
        return str === 'true' || str === 'yes' || str === 'y' || str === 'x' || str === '1';
    };

    const processData = (rawData) => {
        const cleaned = rawData.map((row, index) => {
            const email = (row['Email'] || row['email'] || '').trim().toLowerCase();
            
            // Check if the uploaded file has dedicated accommodation checkbox columns
            const hasCheckboxAccommodations = (
                'Small Group' in row || 'small_group' in row ||
                'Extended Time' in row || 'extended_time' in row ||
                'Extra Breaks' in row || 'extra_breaks' in row ||
                'ESOL' in row || 'esol' in row ||
                'Other' in row || 'other' in row
            );

            let accommodations = row['Accommodations'] || row['accommodations'] || '';
            if (hasCheckboxAccommodations) {
                const accomList = [];
                if (isTruthy(row['Small Group'] || row['small_group'])) accomList.push('Small Group');
                if (isTruthy(row['Extended Time'] || row['extended_time'])) accomList.push('Extended Time');
                if (isTruthy(row['Extra Breaks'] || row['extra_breaks'])) accomList.push('Extra Breaks');
                if (isTruthy(row['ESOL'] || row['esol'])) accomList.push('ESOL');
                if (isTruthy(row['Other'] || row['other'])) accomList.push('Other');
                accommodations = accomList.join(', ');
            }

            const waiverVal = row['Waiver Eligible'] || row['waiver_eligible'] || row['Waiver'] || row['waiver'];
            let waiverEligible = undefined;
            if (waiverVal !== undefined) {
                waiverEligible = isTruthy(waiverVal) || String(waiverVal).toLowerCase() === 'yes' ? 'Yes' : 'No';
            }

            return {
                rowIndex: index + 2,
                stateId: String(row['State ID'] || row['state_id'] || ''),
                schoolId: String(row['School Student ID'] || row['School ID'] || row['student_id'] || row['User ID'] || row['user_id'] || ''),
                firstName: row['First name'] || row['First Name'] || row['first_name'] || '',
                middleName: row['Middle name'] || row['Middle Name'] || row['middle_name'] || '',
                lastName: row['Last name'] || row['Last Name'] || row['last_name'] || '',
                dob: normalizeDOB(row['Date of birth'] || row['Date Of Birth'] || row['date_of_birth'] || ''),
                gender: row['Gender'] || row['gender'] || '',
                grade: row['Student grade level'] || row['Grade'] || row['grade_level'] || '',
                email: email,
                accommodations: accommodations,
                accommodationNotes: row['Accommodation Notes'] || row['accommodation_notes'] || '',
                hasAccommodationData: hasCheckboxAccommodations || 'Accommodations' in row || 'accommodations' in row || 'Accommodation Notes' in row || 'accommodation_notes' in row,
                advisor: row['Advisors'] || row['Advisor'] || row['advisor'] || row['Counselor'] || row['counselor'] || '',
                caseManager: row['Case Manager'] || row['case_manager'] || '',
                schoolProgram: row['School Program'] || row['School program'] || row['school_program'] || row['Program'] || '',
                waiverEligible: waiverEligible,
                uploadedAt: new Date()
            };
        }).filter(s => s.email || s.lastName);

        const warnings = [];
        const emailCounts = {};

        cleaned.forEach(student => {
            if (!student.firstName || !student.lastName) {
                warnings.push({ row: student.rowIndex, type: 'Missing Name', message: `Row ${student.rowIndex}: Missing first or last name` });
            }
            if (!student.email) {
                warnings.push({ row: student.rowIndex, type: 'Missing Email', message: `Row ${student.rowIndex}: ${student.firstName} ${student.lastName} - No email` });
            } else {
                if (!student.email.includes('@') || !student.email.includes('.')) {
                    warnings.push({ row: student.rowIndex, type: 'Invalid Email', message: `Row ${student.rowIndex}: "${student.email}" is not a valid email` });
                }
                emailCounts[student.email] = (emailCounts[student.email] || 0) + 1;
            }
        });

        Object.entries(emailCounts).forEach(([email, count]) => {
            if (count > 1) {
                warnings.push({ row: 0, type: 'Duplicate Email', message: `Email "${email}" appears ${count} times in import file` });
            }
        });

        setValidationWarnings(warnings);
        setData(cleaned);
        setStatus(`Parsed ${cleaned.length} records.${warnings.length > 0 ? ` ⚠️ ${warnings.length} warning(s) found.` : ' ✅ No issues detected.'}`);
    };

    const saveToFirestore = async () => {
        if (data.length === 0) return;
        setImporting(true);
        setStatus('Saving to Firestore...');

        let importedCount = 0;
        let skippedCount = 0;

        try {
            const batch = writeBatch(db);
            const uploadedEmails = new Set(data.filter(s => s.email).map(s => s.email.toLowerCase()));

            if (syncMode && uploadedEmails.size > 10) {
                const allCurrentEmails = students.map(s => s.email?.toLowerCase()).filter(Boolean);
                const missingEmails = allCurrentEmails.filter(email => !uploadedEmails.has(email));

                missingEmails.forEach(email => {
                    const studentKey = email.replace(/[.#$/[\]]/g, '_');
                    const docRef = doc(collection(db, 'master_students'), studentKey);
                    batch.update(docRef, { status: 'Inactive', lastUpdated: serverTimestamp() });
                });
            }

            data.forEach((student) => {
                const studentKey = student.email ? student.email.replace(/[.#$/[\]]/g, '_') : doc(collection(db, 'master_students')).id;
                const updateData = { status: 'Active' };

                // Generic SIS protected fields unless this import specifically includes accommodation data and user allows it
                const protectedFields = ['paymentInfo', 'paymentRecd', 'billingNotes'];
                if (!student.hasAccommodationData || !overwriteAccommodations) {
                    protectedFields.push('accommodations', 'accommodationNotes');
                }
                if (student.waiverEligible === undefined) {
                    protectedFields.push('waiverEligible', 'waiverStatus');
                }

                Object.entries(student).forEach(([key, value]) => {
                    if (protectedFields.includes(key) || key === 'hasAccommodationData' || key === 'rowIndex') return;
                    if (value !== '' && value !== null && value !== undefined) {
                        if (key === 'dob' || key === 'stateId' || key === 'accommodations' || key === 'accommodationNotes') {
                            updateData[key] = encryptText(value);
                        } else {
                            updateData[key] = value;
                        }
                    }
                });

                if (Object.keys(updateData).length > 0) {
                    updateData.lastUpdated = serverTimestamp();
                    const docRef = doc(collection(db, 'master_students'), studentKey);
                    batch.set(docRef, updateData, { merge: true });
                    importedCount++;
                } else {
                    skippedCount++;
                }
            });

            await batch.commit();
            setStatus(`Successfully imported ${importedCount} records. Database updated and encrypted.`);
            setData([]);
            setIsImportModalOpen(false);
        } catch (error) {
            console.error("Error saving data:", error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setImporting(false);
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
                ...editData,
                dob: encryptText(normalizeDOB(editData.dob)),
                stateId: encryptText(editData.stateId || ''),
                accommodations: editData.accommodations || '',
                accommodationNotes: editData.accommodationNotes || '',
                waiverEligible: editData.waiverEligible || 'No',
                advisor: editData.advisor || '',
                caseManager: editData.caseManager || '',
                lastUpdated: serverTimestamp()
            });
            setEditingId(null);
        } catch (error) {
            console.error("Error saving student:", error);
            alert("Failed to save changes.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Are you sure you want to remove this student from the Master List?")) {
            try {
                await deleteDoc(doc(db, 'master_students', id));
            } catch (error) {
                console.error("Error deleting student:", error);
            }
        }
    };

    const handleReactivate = async (id) => {
        try {
            await updateDoc(doc(db, 'master_students', id), {
                status: 'Active',
                lastUpdated: serverTimestamp()
            });
        } catch (error) {
            console.error("Error reactivating student:", error);
            alert("Failed to reactivate student.");
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected students?`)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, 'master_students', id));
            });
            await batch.commit();
            setSelectedIds([]);
            alert(`Deleted ${selectedIds.length} students.`);
        } catch (error) {
            console.error("Bulk delete error:", error);
            alert("Failed to delete records.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredStudents.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filteredStudents.map(s => s.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const filteredStudents = students.filter(s => {
        if (searchTerm.length < 2 && !showInactive && s.status === 'Inactive') return false;

        if (searchTerm.length >= 2) {
            const term = searchTerm.toLowerCase();
            const fullName = `${s.firstName} ${s.lastName}`.toLowerCase();
            const matchesSearch = fullName.includes(term) ||
                (s.email && s.email.toLowerCase().includes(term)) ||
                (s.stateId && String(s.stateId).includes(term)) ||
                (s.schoolId && String(s.schoolId).includes(term));

            if (!matchesSearch) return false;
        }

        if (filterGrade !== 'All' && String(s.grade) !== filterGrade) return false;
        if (filterProgram !== 'All' && s.schoolProgram !== filterProgram) return false;
        
        // Match individual advisor substring
        if (filterAdvisor !== 'All') {
            const advStr = (s.advisor || '').toLowerCase();
            if (!advStr.includes(filterAdvisor.toLowerCase())) return false;
        }

        if (filterAccom === 'Has Accommodations' && !s.accommodations) return false;
        if (filterAccom === 'No Accommodations' && s.accommodations) return false;

        const activeCaseload = impersonatedCaseload || (userProfile?.role === 'case_manager' ? userProfile.caseloadName : null);
        if (filterByCaseload && activeCaseload) {
            const caseloadTerm = (activeCaseload || '').toLowerCase().trim();
            const studentAdvisor = (s.advisor || '').toLowerCase();
            if (!studentAdvisor.includes(caseloadTerm)) return false;
        }

        if (!showInactive && s.status === 'Inactive') return false;

        if (effectiveRole === 'advisor') {
            const staffName = user?.displayName || '';
            const staffLastName = getLastName(staffName);
            const advisorLastName = getLastName(s.advisor);
            return staffLastName === advisorLastName;
        }

        return true;
    }).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

    // Extract unique individual advisors from comma-separated strings
    const individualAdvisors = useMemo(() => {
        const set = new Set();
        students.forEach(s => {
            if (s.advisor) {
                s.advisor.split(',').forEach(name => {
                    const cleanName = name.trim();
                    if (cleanName) set.add(cleanName);
                });
            }
        });
        return ['All', ...Array.from(set).sort()];
    }, [students]);

    const grades = ['All', ...new Set(students.map(s => String(s.grade)).filter(Boolean))].sort();
    const programs = ['All', ...new Set(students.map(s => s.schoolProgram).filter(Boolean))].sort();

    // Export current filtered list as CSV
    const handleExportCSV = () => {
        const rowsToExport = filteredStudents.map(s => {
            const accom = s.accommodations || '';
            return {
                'State ID': s.stateId || '',
                'School ID': s.schoolId || '',
                'Last Name': s.lastName || '',
                'First Name': s.firstName || '',
                'Middle Name': s.middleName || '',
                'Email': s.email || '',
                'Grade': s.grade || '',
                'Gender': s.gender || '',
                'Advisors': s.advisor || '',
                'Case Manager': s.caseManager || '',
                'School Program': s.schoolProgram || '',
                'Small Group': accom.includes('Small Group') ? 'Yes' : 'No',
                'Extended Time': accom.includes('Extended Time') ? 'Yes' : 'No',
                'Extra Breaks': accom.includes('Extra Breaks') ? 'Yes' : 'No',
                'ESOL': accom.includes('ESOL') ? 'Yes' : 'No',
                'Other': accom.includes('Other') ? 'Yes' : 'No',
                'Accommodation Notes': s.accommodationNotes || '',
                'Waiver Eligible': s.waiverEligible || 'No'
            };
        });

        const csv = Papa.unparse(rowsToExport);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const fileName = filterAdvisor !== 'All' 
            ? `Accommodations_${filterAdvisor.replace(/\s+/g, '_')}.csv` 
            : `Master_Accommodations_Roster_${new Date().toISOString().split('T')[0]}.csv`;
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) return <div style={{ padding: '20px', color: 'var(--fa-warm-gray)' }}>Loading Master Student List...</div>;

    return (
        <div style={{ padding: '8px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '20px', fontWeight: 'bold' }}>All Students Testing Master List</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)', fontSize: '12px' }}>Source of truth for state-wide testing and student accommodation profiles.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectedIds.length > 0 && effectiveRole === 'admin' && (
                        <button
                            onClick={handleBulkDelete}
                            style={{ padding: '8px 16px', backgroundColor: 'var(--fa-red)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                        >
                            Delete Selected ({selectedIds.length})
                        </button>
                    )}
                    
                    <div className="glass-panel" style={{ display: 'flex', gap: '8px', padding: '4px 8px', borderRadius: '8px', background: 'rgba(255,255,255,0.4)', border: '1px solid var(--glass-border)' }}>
                        <select value={filterGrade} onChange={e => setFilterGrade(e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', fontSize: '12px', backgroundColor: 'transparent', outline: 'none', fontWeight: '600', color: 'var(--fa-dark-blue)' }}>
                            <option value="All">All Grades</option>
                            {grades.filter(g => g !== 'All').map(g => <option key={g} value={g}>Grade {g}</option>)}
                        </select>
                        <select value={filterProgram} onChange={e => setFilterProgram(e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', fontSize: '12px', backgroundColor: 'transparent', outline: 'none', fontWeight: '600', color: 'var(--fa-dark-blue)', maxWidth: '110px' }}>
                            <option value="All">All Programs</option>
                            {programs.filter(p => p !== 'All').map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                        <select value={filterAdvisor} onChange={e => setFilterAdvisor(e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', fontSize: '12px', backgroundColor: 'transparent', outline: 'none', fontWeight: '600', color: 'var(--fa-dark-blue)', maxWidth: '140px' }}>
                            <option value="All">All Advisors</option>
                            {individualAdvisors.filter(a => a !== 'All').map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                        <select value={filterAccom} onChange={e => setFilterAccom(e.target.value)} style={{ padding: '4px 8px', borderRadius: '6px', border: 'none', fontSize: '12px', backgroundColor: 'transparent', outline: 'none', fontWeight: '600', color: 'var(--fa-dark-blue)' }}>
                            <option value="All">Accommodations...</option>
                            <option value="Has Accommodations">Has Accommodations</option>
                            <option value="No Accommodations">None</option>
                        </select>
                    </div>

                    <input
                        type="text"
                        placeholder="Search Name/ID..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', width: '180px', fontSize: '13px', outline: 'none' }}
                    />
                    
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--fa-dark-blue)', cursor: 'pointer', fontWeight: '500' }}>
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            style={{ marginRight: '6px', width: '15px', height: '15px', accentColor: 'var(--fa-blue)' }}
                        />
                        Show Inactive
                    </label>

                    <button
                        onClick={handleExportCSV}
                        style={{ padding: '8px 16px', backgroundColor: 'white', color: 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                        title="Export current view with accommodation checkboxes to Excel/CSV"
                    >
                        📥 Export CSV ({filteredStudents.length})
                    </button>

                    {effectiveRole === 'admin' && (
                        <button
                            onClick={() => setIsImportModalOpen(true)}
                            style={{ padding: '8px 16px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '13px' }}
                        >
                            Import
                        </button>
                    )}
                </div>
            </div>

            <div className="glass-panel" style={{ padding: 0, borderRadius: '12px', border: '1px solid var(--glass-border)', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.45)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(0, 70, 139, 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={{ padding: '12px 16px', width: '30px' }}>
                                    <input
                                        type="checkbox"
                                        checked={filteredStudents.length > 0 && selectedIds.length === filteredStudents.length}
                                        onChange={toggleSelectAll}
                                    />
                                </th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Student Name</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>IDs (State / School)</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>DOB</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Gender</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Grade</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Program</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Advisor</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Accommodations</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Waiver</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredStudents.map(s => {
                                const isInactive = s.status === 'Inactive';
                                return (
                                    <tr key={s.id} style={{
                                        borderBottom: '1px solid var(--glass-border)',
                                        backgroundColor: selectedIds.includes(s.id) ? 'rgba(0, 70, 139, 0.05)' : 'transparent',
                                        opacity: isInactive ? 0.6 : 1
                                    }}>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(s.id)}
                                                onChange={() => toggleSelectOne(s.id)}
                                            />
                                        </td>
                                        {editingId === s.id ? (
                                            <td colSpan="10" style={{ padding: '20px', backgroundColor: 'rgba(255, 255, 255, 0.9)' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <h4 style={{ margin: '0 0 5px 0', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Student Identity</h4>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <input value={editData.firstName} onChange={e => setEditData({ ...editData, firstName: e.target.value })} style={{ width: '40%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} placeholder="First" />
                                                            <input value={editData.lastName} onChange={e => setEditData({ ...editData, lastName: e.target.value })} style={{ width: '60%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} placeholder="Last" />
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <input placeholder="State ID" value={editData.stateId} onChange={e => setEditData({ ...editData, stateId: e.target.value })} style={{ width: '50%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                                            <input placeholder="School ID" value={editData.schoolId} onChange={e => setEditData({ ...editData, schoolId: e.target.value })} style={{ width: '50%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <h4 style={{ margin: '0 0 5px 0', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Academic Profile</h4>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <input placeholder="Grade" value={editData.grade} onChange={e => setEditData({ ...editData, grade: e.target.value })} style={{ width: '30%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                                            <input placeholder="Advisor(s)" value={editData.advisor || ''} onChange={e => setEditData({ ...editData, advisor: e.target.value })} style={{ width: '70%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                                        </div>
                                                        <div style={{ display: 'flex', gap: '5px' }}>
                                                            <input placeholder="Case Manager (Optional Override)" value={editData.caseManager || ''} onChange={e => setEditData({ ...editData, caseManager: e.target.value })} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} title="If left blank, the first Advisor will be used as the Case Manager." />
                                                        </div>
                                                        <select
                                                            value={editData.waiverEligible || 'No'}
                                                            onChange={e => setEditData({ ...editData, waiverEligible: e.target.value })}
                                                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}
                                                        >
                                                            <option value="No">No Waiver</option>
                                                            <option value="Yes">Waiver Eligible</option>
                                                        </select>
                                                    </div>

                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        <h4 style={{ margin: '0 0 5px 0', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Accommodations</h4>
                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px', backgroundColor: 'white', borderRadius: '8px', border: '1px solid #ccc' }}>
                                                            {['Small Group', 'Extended Time', 'Extra Breaks', 'ESOL', 'Other'].map(opt => {
                                                                const currentAccom = editData.accommodations || '';
                                                                const isChecked = currentAccom.includes(opt);
                                                                return (
                                                                    <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '11px', minWidth: '100px' }}>
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
                                                                        />
                                                                        {opt}
                                                                    </label>
                                                                );
                                                            })}
                                                        </div>
                                                        <textarea
                                                            placeholder="Accommodation detailed notes..."
                                                            value={editData.accommodationNotes || ''}
                                                            onChange={e => setEditData({ ...editData, accommodationNotes: e.target.value })}
                                                            style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '11px', minHeight: '40px' }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '6px' }}>
                                                            <button onClick={() => setEditingId(null)} style={{ padding: '6px 12px', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Cancel</button>
                                                            <button onClick={() => handleSaveEdit(s.id)} style={{ padding: '6px 16px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Save</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                        ) : (
                                            <>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--fa-dark-blue)' }}>
                                                        {s.lastName}, {s.firstName} {s.middleName}
                                                        {isInactive && <span style={{ marginLeft: '6px', fontSize: '9px', backgroundColor: '#ccc', color: '#666', padding: '1px 5px', borderRadius: '4px', fontWeight: 'bold' }}>INACTIVE</span>}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)' }}>{s.email}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '500' }}>{s.stateId || '—'}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)' }}>{s.schoolId || '—'}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>{s.dob || '—'}</td>
                                                <td style={{ padding: '12px 16px' }}>{s.gender || '—'}</td>
                                                <td style={{ padding: '12px 16px', fontWeight: 'bold' }}>{s.grade || '—'}</td>
                                                <td style={{ padding: '12px 16px' }}>{s.schoolProgram || '—'}</td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div>{s.advisor || 'Not assigned'}</div>
                                                    {s.caseManager && <div style={{ fontSize: '10px', color: 'var(--fa-blue)', fontWeight: 'bold', marginTop: '2px' }}>CM: {s.caseManager}</div>}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {s.accommodations ? (
                                                        <div>
                                                            <span style={{ padding: '2px 6px', backgroundColor: 'rgba(0, 70, 139, 0.08)', color: 'var(--fa-blue)', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                                                {s.accommodations}
                                                            </span>
                                                            {s.accommodationNotes && <div style={{ fontSize: '10px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>{s.accommodationNotes}</div>}
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#ccc' }}>None</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ color: s.waiverEligible === 'Yes' ? '#2e7d32' : '#ccc', fontWeight: s.waiverEligible === 'Yes' ? 'bold' : 'normal' }}>
                                                        {s.waiverEligible === 'Yes' ? 'YES' : 'No'}
                                                    </span>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <button onClick={() => handleEdit(s)} style={{ border: 'none', background: 'none', color: 'var(--fa-blue)', cursor: 'pointer', marginRight: '10px', fontWeight: 'bold' }}>Edit</button>
                                                    {isInactive ? (
                                                        <button onClick={() => handleReactivate(s.id)} style={{ border: 'none', background: 'none', color: '#2e7d32', cursor: 'pointer', fontWeight: 'bold' }}>Reactivate</button>
                                                    ) : (
                                                        effectiveRole === 'admin' && (
                                                            <button onClick={() => handleDelete(s.id)} style={{ border: 'none', background: 'none', color: 'var(--fa-red)', cursor: 'pointer', fontWeight: 'bold' }}>Delete</button>
                                                        )
                                                    )}
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Import Modal */}
            {isImportModalOpen && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000,
                    backdropFilter: 'blur(3px)'
                }}>
                    <div className="glass-panel" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '700px', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                            <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Import Master Student List</h2>
                            <button onClick={() => setIsImportModalOpen(false)} style={{ border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--fa-warm-gray)' }}>&times;</button>
                        </div>

                        <div style={{ padding: '32px 16px', border: '2px dashed var(--glass-border)', borderRadius: '12px', textAlign: 'center', backgroundColor: '#f8f9fa', marginBottom: '20px' }}>
                            <input
                                type="file"
                                accept=".csv, .xlsx"
                                onChange={handleFileUpload}
                                style={{ display: 'none' }}
                                id="master-file-upload"
                            />
                            <label htmlFor="master-file-upload" style={{ cursor: 'pointer' }}>
                                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📁</div>
                                <div style={{ color: 'var(--fa-blue)', fontWeight: 'bold', fontSize: '15px' }}>Click to select CSV or XLSX spreadsheet</div>
                                <div style={{ fontSize: '12px', color: 'var(--fa-dark-blue)', marginTop: '6px', fontWeight: 'bold' }}>
                                    💡 Recommended SIS Export: <span style={{ color: 'var(--fa-red)' }}>"All Testing WDS"</span>
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '4px' }}>Expects columns: State ID, Student grade level, Email, First name, Last name, Advisors</div>
                            </label>
                        </div>

                        {status && (
                            <div style={{ padding: '12px', backgroundColor: 'rgba(0, 70, 139, 0.05)', borderRadius: '8px', marginBottom: '20px', fontSize: '13px', color: 'var(--fa-dark-blue)', fontWeight: '600' }}>
                                {status}
                            </div>
                        )}

                        {validationWarnings.length > 0 && (
                            <div style={{ padding: '16px', backgroundColor: 'rgba(158, 36, 50, 0.05)', borderRadius: '8px', border: '1.5px solid rgba(158,36,50,0.15)', marginBottom: '20px', maxHeight: '200px', overflowY: 'auto' }}>
                                <div style={{ fontWeight: 'bold', color: 'var(--fa-red)', fontSize: '13px', marginBottom: '8px' }}>⚠️ Validation Warnings:</div>
                                {validationWarnings.map((w, idx) => (
                                    <div key={idx} style={{ fontSize: '12px', color: 'var(--fa-dark-blue)', marginBottom: '4px' }}>• {w.message}</div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '20px', flexWrap: 'wrap', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--fa-dark-blue)', cursor: 'pointer', fontWeight: '600' }}>
                                    <input
                                        type="checkbox"
                                        checked={overwriteAccommodations}
                                        onChange={(e) => setOverwriteAccommodations(e.target.checked)}
                                        style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: 'var(--fa-blue)' }}
                                    />
                                    ⚡ Update / Overwrite Accommodations from this file (if columns present)
                                </label>

                                <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'var(--fa-dark-blue)', cursor: 'pointer', fontWeight: '600' }}>
                                    <input
                                        type="checkbox"
                                        checked={syncMode}
                                        onChange={(e) => setSyncMode(e.target.checked)}
                                        style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: 'var(--fa-blue)' }}
                                    />
                                    🔄 Inactive Sync Mode (Mark omitted students as Inactive)
                                </label>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button onClick={() => setIsImportModalOpen(false)} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
                                <button
                                    onClick={saveToFirestore}
                                    disabled={data.length === 0 || importing}
                                    style={{
                                        padding: '8px 24px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px',
                                        cursor: (data.length === 0 || importing) ? 'not-allowed' : 'pointer', fontWeight: 'bold', fontSize: '13px', opacity: (data.length === 0 || importing) ? 0.6 : 1
                                    }}
                                >
                                    {importing ? 'Saving...' : `Import & Save (${data.length} Records)`}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MasterUpload;

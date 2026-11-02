import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../context/AuthContext';
import { decryptText } from '../../../utils/crypto';

const MaineThroughYear = ({ grade = '10', impersonatedCaseload = null }) => {
    const { user, userProfile } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterRoom, setFilterRoom] = useState('');
    const [filterSubject, setFilterSubject] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [testingRooms, setTestingRooms] = useState([]);
    const [isRoomAssignOpen, setIsRoomAssignOpen] = useState(false);
    const [roomAssignTargetRoom, setRoomAssignTargetRoom] = useState('');
    const [roomAssignTargetDate, setRoomAssignTargetDate] = useState('');
    const [roomAssignTargetSession, setRoomAssignTargetSession] = useState('');
    const [roomAssignSubject, setRoomAssignSubject] = useState('Both'); // Both, Reading, Math
    const [showInactive, setShowInactive] = useState(false);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const academicYear = currentMonth >= 6 ? currentYear + 1 : currentYear;

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'master_students'), (snapshot) => {
            const rawData = snapshot.docs.map(doc => {
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

            // Filter logic:
            const filteredData = rawData.filter(s => {
                const g = String(s.grade || '').toLowerCase().replace(/[^0-9]/g, '');
                const targetGrade = grade.padStart(2, '0');
                const studentGrade = g.padStart(2, '0');

                // Support Graduation Year mapping
                const gradYearMap = {
                    '12': String(academicYear),
                    '11': String(academicYear + 1),
                    '10': String(academicYear + 2),
                    '09': String(academicYear + 3),
                    '08': String(academicYear + 4)
                };
                const expectedGradYear = gradYearMap[targetGrade] || '';
                
                const isCorrectGrade = 
                    studentGrade === targetGrade || 
                    (expectedGradYear && (studentGrade === expectedGradYear || s.gradYear === expectedGradYear)) ||
                    s.maine_ty_include === true;

                if (!isCorrectGrade) return false;

                // Caseload Link Filtering
                const activeCaseload = impersonatedCaseload || (userProfile?.role === 'case_manager' ? userProfile.caseloadName : null);
                if (activeCaseload) {
                    const term = activeCaseload.toLowerCase().trim();
                    if (!(s.advisor || '').toLowerCase().includes(term)) return false;
                }

                if (!showInactive && s.status === 'Inactive') return false;

                return true;
            });

            // Flatten into rows (Reading and Math for each student)
            let processedRows = [];
            filteredData.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')).forEach(s => {
                // Reading Row
                processedRows.push({
                    studentId: s.id,
                    student: s,
                    rowId: `${s.id}_reading`,
                    lastName: s.lastName,
                    firstName: s.firstName,
                    middleName: s.middleName || '',
                    grade: s.grade || grade,
                    stateId: s.stateId || '',
                    schoolProgram: s.schoolProgram || '',
                    accommodations: s.accommodations || '',
                    subject: 'Reading',
                    room: s.maine_ty_reading_room || '',
                    date: s.maine_ty_reading_date || '',
                    session: s.maine_ty_reading_session || ''
                });

                // Math Row
                processedRows.push({
                    studentId: s.id,
                    student: s,
                    rowId: `${s.id}_math`,
                    lastName: s.lastName,
                    firstName: s.firstName,
                    middleName: s.middleName || '',
                    grade: s.grade || grade,
                    stateId: s.stateId || '',
                    schoolProgram: s.schoolProgram || '',
                    accommodations: s.accommodations || '',
                    subject: 'Math',
                    room: s.maine_ty_math_room || '',
                    date: s.maine_ty_math_date || '',
                    session: s.maine_ty_math_session || ''
                });
            });

            setStudents(processedRows);
            setRawStudentsList(filteredData);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [grade, showInactive]);

    useEffect(() => {
        const unsubRooms = onSnapshot(collection(db, 'testing_rooms'), (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTestingRooms(rooms);
        });
        return () => unsubRooms();
    }, []);

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesSearch = 
                (s.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.stateId || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesDate = !filterDate || s.date === filterDate;
            const matchesRoom = !filterRoom || s.room === filterRoom;
            const matchesSubject = !filterSubject || s.subject === filterSubject;
            
            return matchesSearch && matchesDate && matchesRoom && matchesSubject;
        });
    }, [students, searchTerm, filterDate, filterRoom, filterSubject]);

    const handleRoomAssignment = async () => {
        if (!roomAssignTargetRoom || !roomAssignTargetDate || !roomAssignTargetSession) {
            alert("Please fill in all fields (Room, Date, and Session)");
            return;
        }

        const batch = writeBatch(db);
        // We need to be careful: selectedIds contains rowIds (e.g. ID_reading).
        // We need to group by studentId and only update the requested subjects.
        const updateMap = new Map();

        selectedIds.forEach(rowId => {
            const [studentId, subject] = rowId.split('_');
            if (!updateMap.has(studentId)) updateMap.set(studentId, {});
            
            if (subject === 'reading') {
                updateMap.get(studentId).maine_ty_reading_room = roomAssignTargetRoom;
                updateMap.get(studentId).maine_ty_reading_date = roomAssignTargetDate;
                updateMap.get(studentId).maine_ty_reading_session = roomAssignTargetSession;
            } else if (subject === 'math') {
                updateMap.get(studentId).maine_ty_math_room = roomAssignTargetRoom;
                updateMap.get(studentId).maine_ty_math_date = roomAssignTargetDate;
                updateMap.get(studentId).maine_ty_math_session = roomAssignTargetSession;
            }
        });

        updateMap.forEach((updates, studentId) => {
            batch.update(doc(db, 'master_students', studentId), updates);
        });

        try {
            await batch.commit();
            setSelectedIds([]);
            setIsRoomAssignOpen(false);
        } catch (error) {
            console.error("Batch update failed:", error);
            alert("Failed to update rooms");
        }
    };

    const handleClearRoom = async (rowId) => {
        const [studentId, subject] = rowId.split('_');
        const fieldPrefix = subject === 'reading' ? 'maine_ty_reading' : 'maine_ty_math';
        try {
            await updateDoc(doc(db, 'master_students', studentId), {
                [`${fieldPrefix}_room`]: '',
                [`${fieldPrefix}_date`]: '',
                [`${fieldPrefix}_session`]: ''
            });
        } catch (error) {
            console.error("Clear room failed:", error);
        }
    };

    const handleBulkClearRoom = async () => {
        if (!window.confirm(`Clear room assignments for ${selectedIds.length} items?`)) return;
        const batch = writeBatch(db);
        selectedIds.forEach(rowId => {
            const [studentId, subject] = rowId.split('_');
            const fieldPrefix = subject === 'reading' ? 'maine_ty_reading' : 'maine_ty_math';
            batch.update(doc(db, 'master_students', studentId), {
                [`${fieldPrefix}_room`]: '',
                [`${fieldPrefix}_date`]: '',
                [`${fieldPrefix}_session`]: ''
            });
        });
        await batch.commit();
        setSelectedIds([]);
    };

    const [rawStudentsList, setRawStudentsList] = useState([]);

    const handleExport = () => {
        const exportData = filteredStudents.map(s => ({
            'Last Name': s.lastName,
            'First Name': s.firstName,
            'State ID': s.stateId,
            'Subject': s.subject,
            'Room': s.room,
            'Date': s.date,
            'Session': s.session,
            'Accommodations': s.accommodations
        }));
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Maine Through Year");
        XLSX.writeFile(wb, `Maine_Through_Year_${grade}.xlsx`);
    };

    const handleStateRosterExport = () => {
        if (!rawStudentsList.length) {
            alert('No 10th grade students found to export.');
            return;
        }

        // Format DOB as MM/DD/YYYY
        const formatDOB = (dobStr) => {
            if (!dobStr) return '';
            const parts = String(dobStr).trim().split(/[/.-]/);
            if (parts.length === 3) {
                let [m, d, y] = parts;
                if (m.length === 1) m = `0${m}`;
                if (d.length === 1) d = `0${d}`;
                if (y.length === 2) y = `20${y}`;
                return `${m}/${d}/${y}`;
            }
            return dobStr;
        };

        // Normalize Gender to M, F, or X
        const formatGender = (g) => {
            if (!g) return '';
            const str = String(g).trim().toUpperCase();
            if (str.startsWith('M')) return 'M';
            if (str.startsWith('F')) return 'F';
            if (str.startsWith('X') || str.startsWith('N')) return 'X';
            return str.charAt(0);
        };

        // Build exact 29-column NWEA Maine Through Year combined roster format
        const rosterRows = rawStudentsList
            .slice()
            .sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''))
            .map(s => ({
                'School State Code': '1181',
                'School Name': 'Fryeburg Academy',
                'Previous Instructor ID': '',
                'Instructor ID': '238303',
                'Instructor State ID': '',
                'Instructor Last Name': 'Shepard',
                'Instructor First Name': 'David',
                'Instructor Middle Initial': '',
                'User Name': 'dshepard@fryeburgacademy.org',
                'Email Address': 'dshepard@fryeburgacademy.org',
                'Class Name': 'FA-10',
                'Subject': '',
                'Previous Student ID': '',
                'Student ID': s.schoolId || '',
                'Student State ID': s.stateId || '',
                'Clever ID': '',
                'Ed-Fi ID': '',
                'ClassLink ID': '',
                'OneRoster ID': '',
                'Student Information System ID': '',
                'Student Last Name': s.lastName || '',
                'Student First Name': s.firstName || '',
                'Student Middle Initial': s.middleName ? s.middleName.trim().charAt(0) : '',
                'Student Date Of Birth': formatDOB(s.dob),
                'Student Gender': formatGender(s.gender),
                'Student Grade': '10',
                'Student Ethnic Group Name': s.ethnicGroup || 'Not Specified',
                'Student User Name': '',
                'Student Email': ''
            }));

        const ws = XLSX.utils.json_to_sheet(rosterRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Maine Through Year");
        XLSX.writeFile(wb, `Maine_Through_Year_Roster_Grade_${grade}.xlsx`);
    };

    // Modal state for Test Administration & Reporting export
    const [isAdminExportModalOpen, setIsAdminExportModalOpen] = useState(false);
    const [adminExportConfig, setAdminExportConfig] = useState({
        schoolYear: '2027',
        testAdminCode: 'MET0427R00',
        roomMapping: {} // maps room name -> customized online group name
    });

    const openAdminExportModal = () => {
        // Collect all distinct rooms assigned to students
        const distinctRooms = Array.from(new Set(students.map(s => s.room || 'Unassigned')));
        const initialMapping = {};
        distinctRooms.forEach(rm => {
            // Default: if room contains "arena", default to "Arena", otherwise room name
            let defaultName = rm;
            if (rm.toLowerCase().includes('arena')) {
                defaultName = 'Arena';
            }
            initialMapping[rm] = defaultName;
        });

        setAdminExportConfig(prev => ({
            ...prev,
            roomMapping: initialMapping
        }));
        setIsAdminExportModalOpen(true);
    };

    const handleExecuteAdminExport = () => {
        if (!students.length) {
            alert('No student records found to export.');
            return;
        }

        // Helper to normalize grade digits
        const normalizeGradeNum = (gr) => {
            const num = String(gr || '').replace(/[^0-9]/g, '');
            return num || grade || '10';
        };

        // Helper to format reporting group based on student program
        const getReportingGroup = (program) => {
            const p = String(program || '').trim();
            return p || 'District Resident';
        };

        // Construct 15-column Maine Assessment Session Export (Math & Reading rows)
        const exportRows = students.map(s => {
            const rawRoom = s.room || 'Unassigned';
            const onlineTestingGroup = adminExportConfig.roomMapping[rawRoom] || rawRoom;
            const reportingGroup = getReportingGroup(s.schoolProgram);
            const studentGrade = normalizeGradeNum(s.grade);

            return {
                'School Year': adminExportConfig.schoolYear || '2026',
                'Test Administration Code': adminExportConfig.testAdminCode || 'MET0426R00',
                'Student State ID': s.stateId || '',
                'Student Last Name': s.lastName || '',
                'Student First Name': s.firstName || '',
                'Student Middle Name': s.middleName || '',
                'Reporting District Code': '1180',
                'Reporting District Name': 'FRYEBURG ACADEMY',
                'Reporting School Code': '1181',
                'Reporting School Name': 'FRYEBURG ACADEMY',
                'Instructor': '',
                'Test Content Area Academic Subject Code': s.subject || '',
                'Student Grade': studentGrade,
                'Online Testing Group Name': onlineTestingGroup,
                'Reporting Group Name': reportingGroup
            };
        });

        const ws = XLSX.utils.json_to_sheet(exportRows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Session_Admin");
        XLSX.writeFile(wb, `Maine_Through_Year_Admin_Reporting_${grade}.xlsx`);
        setIsAdminExportModalOpen(false);
    };

    const stats = useMemo(() => {
        const total = students.length;
        const assigned = students.filter(s => s.room).length;
        const unassigned = total - assigned;
        return { total, assigned, unassigned };
    }, [students]);

    if (loading) return <div style={{ padding: '20px' }}>Loading Students...</div>;

    return (
        <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#1a73e8' }}>Maine Through Year Assessment Dashboard</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#5f6368' }}>Grade {grade} Mapping (Grad {students[0]?.gradYear || academicYear+1})</p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowInactive(!showInactive)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #dadce0', backgroundColor: showInactive ? '#e8f0fe' : 'white', color: showInactive ? '#1a73e8' : '#5f6368', cursor: 'pointer' }}>
                        {showInactive ? 'Showing Inactive' : 'Show Inactive'}
                    </button>
                    <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #dadce0', backgroundColor: 'white', cursor: 'pointer' }}>
                        📥 Export Schedule
                    </button>
                    <button onClick={handleStateRosterExport} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #dadce0', backgroundColor: 'white', color: '#1a73e8', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📤 Export NWEA Roster
                    </button>
                    <button onClick={openAdminExportModal} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        📊 Export Admin & Reporting
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #1a73e8' }}>
                    <div style={{ color: '#5f6368', fontSize: '14px' }}>Total Slots (Math + Reading)</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #34a853' }}>
                    <div style={{ color: '#5f6368', fontSize: '14px' }}>Assigned</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.assigned}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ea4335' }}>
                    <div style={{ color: '#5f6368', fontSize: '14px' }}>Unassigned</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.unassigned}</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', alignItems: 'center' }}>
                <input 
                    type="text" 
                    placeholder="Search name or ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #dadce0' }}
                />
                <select value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #dadce0' }}>
                    <option value="">All Subjects</option>
                    <option value="Reading">Reading</option>
                    <option value="Math">Math</option>
                </select>
                <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)} style={{ padding: '10px', borderRadius: '6px', border: '1px solid #dadce0' }}>
                    <option value="">All Rooms</option>
                    {[...new Set(students.map(s => s.room))].filter(Boolean).sort().map(r => (
                        <option key={r} value={r}>{r}</option>
                    ))}
                </select>
                <input 
                    type="date" 
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    style={{ padding: '10px', borderRadius: '6px', border: '1px solid #dadce0' }}
                />
                
                {selectedIds.length > 0 && (
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                        <button 
                            onClick={handleBulkClearRoom}
                            style={{ padding: '10px 16px', backgroundColor: '#fff5f5', color: '#c53030', border: '1px solid #feb2b2', borderRadius: '6px', cursor: 'pointer' }}
                        >
                            Clear {selectedIds.length} Slots
                        </button>
                        <button 
                            onClick={() => setIsRoomAssignOpen(true)}
                            style={{ padding: '10px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Assign {selectedIds.length} Slots...
                        </button>
                    </div>
                )}
            </div>

            {/* Table */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ backgroundColor: '#f8f9fa', borderBottom: '1px solid #eee' }}>
                            <th style={{ padding: '16px', textAlign: 'left' }}>
                                <input 
                                    type="checkbox" 
                                    onChange={(e) => {
                                        if (e.target.checked) setSelectedIds(filteredStudents.map(s => s.rowId));
                                        else setSelectedIds([]);
                                    }}
                                    checked={selectedIds.length === filteredStudents.length && filteredStudents.length > 0}
                                />
                            </th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>Subject</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>Student Name</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>State ID</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>Room / Slot</th>
                            <th style={{ padding: '16px', textAlign: 'right', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredStudents.map(s => (
                            <tr key={s.rowId} style={{ borderBottom: '1px solid #f1f3f4', backgroundColor: selectedIds.includes(s.rowId) ? '#f8faff' : 'transparent' }}>
                                <td style={{ padding: '16px' }}>
                                    <input 
                                        type="checkbox" 
                                        checked={selectedIds.includes(s.rowId)}
                                        onChange={(e) => {
                                            if (e.target.checked) setSelectedIds(prev => [...prev, s.rowId]);
                                            else setSelectedIds(prev => prev.filter(id => id !== s.rowId));
                                        }}
                                    />
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <span style={{ 
                                        padding: '4px 10px', 
                                        borderRadius: '20px', 
                                        fontSize: '11px', 
                                        fontWeight: '700', 
                                        backgroundColor: s.subject === 'Reading' ? '#e8f0fe' : '#e6fffa',
                                        color: s.subject === 'Reading' ? '#1967d2' : '#08805b'
                                    }}>
                                        {s.subject}
                                    </span>
                                </td>
                                <td style={{ padding: '16px' }}>
                                    <div style={{ fontWeight: '500' }}>{s.lastName}, {s.firstName}</div>
                                    <div style={{ fontSize: '11px', color: '#80868b' }}>{s.schoolProgram}</div>
                                </td>
                                <td style={{ padding: '16px', fontSize: '14px' }}>{s.stateId}</td>
                                <td style={{ padding: '16px' }}>
                                    {s.room ? (
                                        <div>
                                            <div style={{ fontWeight: 'bold', color: '#1a73e8' }}>{s.room}</div>
                                            <div style={{ fontSize: '11px', color: '#666' }}>{s.date} • {s.session}</div>
                                        </div>
                                    ) : (
                                        <span style={{ color: '#ccc', fontStyle: 'italic', fontSize: '13px' }}>Unassigned</span>
                                    )}
                                </td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                    {s.room ? (
                                        <button onClick={() => handleClearRoom(s.rowId)} style={{ color: '#d93025', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px' }}>Clear</button>
                                    ) : (
                                        <button onClick={() => { setSelectedIds([s.rowId]); setIsRoomAssignOpen(true); }} style={{ color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Assign</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Assign Modal */}
            {isRoomAssignOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '450px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)' }}>
                        <h2 style={{ marginTop: 0 }}>Assign {selectedIds.length} Slots</h2>
                        
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Room</label>
                            <select value={roomAssignTargetRoom} onChange={(e) => setRoomAssignTargetRoom(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}>
                                <option value="">Select Room...</option>
                                {testingRooms.map(r => <option key={r.id} value={r.id}>{r.id}</option>)}
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Date</label>
                                <input type="date" value={roomAssignTargetDate} onChange={(e) => setRoomAssignTargetDate(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '4px' }}>Session</label>
                                <select value={roomAssignTargetSession} onChange={(e) => setRoomAssignTargetSession(e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ddd' }}>
                                    <option value="">Select...</option>
                                    <option value="Morning">Morning</option>
                                    <option value="Afternoon">Afternoon</option>
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '32px' }}>
                            <button onClick={() => setIsRoomAssignOpen(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #ddd', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleRoomAssignment} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Apply Assignment</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin & Reporting Export Configuration Modal */}
            {isAdminExportModalOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '28px', width: '560px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 30px rgba(0,0,0,0.2)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h2 style={{ margin: 0, color: '#1a73e8', fontSize: '20px' }}>Export Maine Admin & Reporting (ADAM)</h2>
                            <button onClick={() => setIsAdminExportModalOpen(false)} style={{ border: 'none', background: 'transparent', fontSize: '20px', cursor: 'pointer', color: '#5f6368' }}>✕</button>
                        </div>

                        <div style={{ backgroundColor: '#e8f0fe', border: '1px solid #c2e7ff', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', color: '#174ea6', marginBottom: '20px', lineHeight: 1.5 }}>
                            ℹ️ <strong>Note:</strong> Check <strong>Groups under NWEA</strong> to ensure Online Testing Group Names match your NWEA roster setup. Each 10th grader generates two rows (Math & Reading).
                        </div>

                        {/* Test Administration Code */}
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#202124', marginBottom: '6px' }}>
                                Test Administration Code:
                            </label>
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setAdminExportConfig(prev => ({ ...prev, testAdminCode: 'MET0427R00', schoolYear: '2027' }))}
                                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #dadce0', backgroundColor: adminExportConfig.testAdminCode === 'MET0427R00' ? '#e8f0fe' : '#f8f9fa', color: adminExportConfig.testAdminCode === 'MET0427R00' ? '#1a73e8' : '#3c4043', cursor: 'pointer' }}
                                >
                                    Spring 2027 (MET0427R00)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAdminExportConfig(prev => ({ ...prev, testAdminCode: 'MET0127R00', schoolYear: '2027' }))}
                                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #dadce0', backgroundColor: adminExportConfig.testAdminCode === 'MET0127R00' ? '#e8f0fe' : '#f8f9fa', color: adminExportConfig.testAdminCode === 'MET0127R00' ? '#1a73e8' : '#3c4043', cursor: 'pointer' }}
                                >
                                    Winter 2027 (MET0127R00)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setAdminExportConfig(prev => ({ ...prev, testAdminCode: 'MET0926R00', schoolYear: '2027' }))}
                                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '4px', border: '1px solid #dadce0', backgroundColor: adminExportConfig.testAdminCode === 'MET0926R00' ? '#e8f0fe' : '#f8f9fa', color: adminExportConfig.testAdminCode === 'MET0926R00' ? '#1a73e8' : '#3c4043', cursor: 'pointer' }}
                                >
                                    Fall 2026 (MET0926R00)
                                </button>
                            </div>
                            <input
                                type="text"
                                value={adminExportConfig.testAdminCode}
                                onChange={(e) => setAdminExportConfig(prev => ({ ...prev, testAdminCode: e.target.value }))}
                                placeholder="e.g. MET0427R00"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '14px', fontFamily: 'monospace' }}
                            />
                        </div>

                        {/* School Year */}
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#202124', marginBottom: '6px' }}>
                                School Year:
                            </label>
                            <input
                                type="text"
                                value={adminExportConfig.schoolYear}
                                onChange={(e) => setAdminExportConfig(prev => ({ ...prev, schoolYear: e.target.value }))}
                                placeholder="2027"
                                style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '14px' }}
                            />
                        </div>

                        {/* Room to Online Testing Group Mapping */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#202124' }}>
                                    Online Testing Group Name (by Room):
                                </label>
                            </div>
                            <p style={{ fontSize: '12px', color: '#5f6368', margin: '0 0 10px 0' }}>
                                You can rename complex room setups (e.g. change "Arena with Pods" to "Arena"):
                            </p>

                            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #dadce0', borderRadius: '6px', padding: '8px 12px' }}>
                                {Object.keys(adminExportConfig.roomMapping).length === 0 ? (
                                    <div style={{ color: '#80868b', fontSize: '13px', padding: '8px 0' }}>No room assignments found.</div>
                                ) : (
                                    Object.keys(adminExportConfig.roomMapping).map(roomKey => (
                                        <div key={roomKey} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0', borderBottom: '1px solid #f1f3f4' }}>
                                            <span style={{ flex: '1', fontSize: '13px', color: '#3c4043', fontWeight: '500' }}>
                                                {roomKey}:
                                            </span>
                                            <span style={{ color: '#80868b', fontSize: '12px' }}>➔</span>
                                            <input
                                                type="text"
                                                value={adminExportConfig.roomMapping[roomKey] || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setAdminExportConfig(prev => ({
                                                        ...prev,
                                                        roomMapping: {
                                                            ...prev.roomMapping,
                                                            [roomKey]: val
                                                        }
                                                    }));
                                                }}
                                                placeholder="Online Group Name"
                                                style={{ flex: '1.4', padding: '6px 10px', borderRadius: '4px', border: '1px solid #dadce0', fontSize: '13px' }}
                                            />
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setIsAdminExportModalOpen(false)}
                                style={{ padding: '10px 18px', borderRadius: '6px', border: '1px solid #dadce0', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleExecuteAdminExport}
                                style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                📊 Generate & Download Excel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaineThroughYear;

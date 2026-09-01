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
                    stateId: decryptText(data.stateId || '')
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
                    rowId: `${s.id}_reading`,
                    lastName: s.lastName,
                    firstName: s.firstName,
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
                    rowId: `${s.id}_math`,
                    lastName: s.lastName,
                    firstName: s.firstName,
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
                        📥 Export Excel
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
        </div>
    );
};

export default MaineThroughYear;

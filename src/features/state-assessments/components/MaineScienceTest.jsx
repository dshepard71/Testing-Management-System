import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { useAuth } from '../../../context/AuthContext';
import { decryptText } from '../../../utils/crypto';

const MaineScienceTest = ({ grade = '11', impersonatedCaseload = null }) => {
    const { user, userProfile } = useAuth();
    const [students, setStudents] = useState([]);
    const [loading, setLoading] = useState(true);

    const [globalDate, setGlobalDate] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [testingRooms, setTestingRooms] = useState([]);
    const [targetRoom, setTargetRoom] = useState('');
    const [isManageRoomsOpen, setIsManageRoomsOpen] = useState(false);
    const [newTestingRoom, setNewTestingRoom] = useState('');
    const [allStudents, setAllStudents] = useState([]);
    const [roomAssignTargetDate, setRoomAssignTargetDate] = useState('');
    const [showInactive, setShowInactive] = useState(false); // Default: Hide inactive
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDate, setFilterDate] = useState('');
    const [filterRoom, setFilterRoom] = useState('');
    const [isRoomAssignOpen, setIsRoomAssignOpen] = useState(false);
    const [roomAssignSelectedIds, setRoomAssignSelectedIds] = useState([]);
    const [roomAssignTargetRoom, setRoomAssignTargetRoom] = useState('');
    const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
    const [studentSearchTerm, setStudentSearchTerm] = useState('');

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    const academicYear = currentMonth >= 6 ? currentYear + 1 : currentYear;

    useEffect(() => {
        // Subscribe to master_students
        const unsubscribe = onSnapshot(collection(db, 'master_students'), (snapshot) => {
            const rawData = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    stateId: decryptText(data.stateId || ''),
                    accommodations: decryptText(data.accommodations || ''),
                    accommodationNotes: decryptText(data.accommodationNotes || '')
                };
            });
            setAllStudents(rawData);

            // Filter logic:
            // 1. Must be Correct Grade (or manually included)
            // 2. Must NOT be Inactive (unless showInactive is true)
            const filteredData = rawData.filter(s => {
                const g = String(s.grade || '').toLowerCase().replace(/[^0-9]/g, '');
                const targetGrade = grade.padStart(2, '0');
                const studentGrade = g.padStart(2, '0');

                // Support Graduation Year mapping (e.g. 11th grade = 2027 for 2025-26 SY)
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
                    s.maine_science_include === true;

                if (!isCorrectGrade) return false;

                // Caseload Link Filtering
                const activeCaseload = impersonatedCaseload || (userProfile?.role === 'case_manager' ? userProfile.caseloadName : null);
                if (activeCaseload) {
                    const term = activeCaseload.toLowerCase().trim();
                    if (!(s.advisor || '').toLowerCase().includes(term)) return false;
                }

                // Hide Inactive unless toggled on
                if (!showInactive && s.status === 'Inactive') return false;

                return true;
            });

            // Transform into flat list of rows (Science only for each student)
            let processedRows = [];
            filteredData.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')).forEach(s => {
                processedRows.push({
                    studentId: s.id,
                    rowId: s.id,
                    lastName: s.lastName,
                    firstName: s.firstName,
                    stateId: s.stateId || '',
                    schoolProgram: s.schoolProgram || '',
                    accommodations: s.accommodations || '',
                    subject: 'Science',
                    room: s.maine_science_room || '',
                    internalDate: s.maine_science_date || ''
                });
            });

            setStudents(processedRows);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching students:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [grade, showInactive]);

    useEffect(() => {
        // Subscribe to centralized room layouts
        const unsubRooms = onSnapshot(collection(db, 'testing_rooms'), (snapshot) => {
            const rooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTestingRooms(rooms);
        });
        return () => unsubRooms();
    }, []);

    const handleRoomAssignment = async () => {
        if (!roomAssignTargetRoom || !roomAssignTargetDate) {
            alert("Please select both a room and a date");
            return;
        }

        const batch = writeBatch(db);
        roomAssignSelectedIds.forEach(studentId => {
            const studentRef = doc(db, 'master_students', studentId);
            batch.update(studentRef, {
                maine_science_room: roomAssignTargetRoom,
                maine_science_date: roomAssignTargetDate
            });
        });

        try {
            await batch.commit();
            setRoomAssignSelectedIds([]);
            setIsRoomAssignOpen(false);
        } catch (error) {
            console.error("Batch update failed:", error);
            alert("Failed to update rooms");
        }
    };

    const handleClearRoom = async (studentId) => {
        try {
            await updateDoc(doc(db, 'master_students', studentId), {
                maine_science_room: '',
                maine_science_date: ''
            });
        } catch (error) {
            console.error("Clear room failed:", error);
        }
    };

    const handleBulkClearRoom = async () => {
        if (!window.confirm(`Clear room assignments for ${selectedIds.length} students?`)) return;
        const batch = writeBatch(db);
        selectedIds.forEach(id => {
            batch.update(doc(db, 'master_students', id), {
                maine_science_room: '',
                maine_science_date: ''
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
            'Date': s.internalDate,
            'Accommodations': s.accommodations
        }));
        
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Maine Science");
        XLSX.writeFile(wb, `Maine_Science_Assignments_${grade}.xlsx`);
    };

    const filteredStudents = useMemo(() => {
        return students.filter(s => {
            const matchesSearch = 
                (s.lastName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.firstName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (s.stateId || '').toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesDate = !filterDate || s.internalDate === filterDate;
            const matchesRoom = !filterRoom || s.room === filterRoom;
            
            return matchesSearch && matchesDate && matchesRoom;
        });
    }, [students, searchTerm, filterDate, filterRoom]);

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
                    <h1 style={{ margin: 0, color: '#1a73e8' }}>Maine Science Assessment Dashboard</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#5f6368' }}>Grade {grade} Student Assignments</p>
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

            {/* Stats Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '32px' }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #1a73e8' }}>
                    <div style={{ color: '#5f6368', fontSize: '14px', marginBottom: '4px' }}>Total Students</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.total}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #34a853' }}>
                    <div style={{ color: '#5f6368', fontSize: '14px', marginBottom: '4px' }}>Assigned to Room</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.assigned}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: '4px solid #ea4335' }}>
                    <div style={{ color: '#5f6368', fontSize: '14px', marginBottom: '4px' }}>Unassigned</div>
                    <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{stats.unassigned}</div>
                </div>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', backgroundColor: 'white', padding: '16px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', alignItems: 'center' }}>
                <input 
                    type="text" 
                    placeholder="Search name or ID..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{ flex: 1, padding: '10px', borderRadius: '6px', border: '1px solid #dadce0' }}
                />
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
                            Wipe {selectedIds.length} Rooms
                        </button>
                        <button 
                            onClick={() => {
                                setRoomAssignSelectedIds(selectedIds);
                                setIsRoomAssignOpen(true);
                            }}
                            style={{ padding: '10px 16px', backgroundColor: '#1a73e8', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}
                        >
                            Assign {selectedIds.length} to Room...
                        </button>
                    </div>
                )}
            </div>

            {/* Students Table */}
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
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>Student Name</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>State ID</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>Testing Room</th>
                            <th style={{ padding: '16px', textAlign: 'left', fontSize: '12px', color: '#5f6368', textTransform: 'uppercase' }}>Assigned Date</th>
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
                                    <div style={{ fontWeight: '500' }}>{s.lastName}, {s.firstName}</div>
                                    <div style={{ fontSize: '11px', color: '#80868b' }}>{s.schoolProgram}</div>
                                </td>
                                <td style={{ padding: '16px', fontSize: '14px' }}>{s.stateId}</td>
                                <td style={{ padding: '16px' }}>
                                    {s.room ? (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ backgroundColor: '#e8f0fe', color: '#1967d2', padding: '4px 8px', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold' }}>{s.room}</span>
                                            <button onClick={() => handleClearRoom(s.studentId)} style={{ border: 'none', background: 'none', color: '#d93025', cursor: 'pointer', padding: '4px' }}>×</button>
                                        </div>
                                    ) : (
                                        <span style={{ color: '#ccc', fontStyle: 'italic', fontSize: '13px' }}>Unassigned</span>
                                    )}
                                </td>
                                <td style={{ padding: '16px', fontSize: '14px' }}>{s.internalDate || '-'}</td>
                                <td style={{ padding: '16px', textAlign: 'right' }}>
                                    <button 
                                        onClick={() => {
                                            setRoomAssignSelectedIds([s.studentId]);
                                            setIsRoomAssignOpen(true);
                                        }}
                                        style={{ color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}
                                    >
                                        Assign Room
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filteredStudents.length === 0 && (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#5f6368' }}>No students found matching filters.</div>
                )}
            </div>

            {/* Room Assignment Modal */}
            {isRoomAssignOpen && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', width: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                        <h2 style={{ marginTop: 0 }}>Assign Room</h2>
                        <p style={{ fontSize: '14px', color: '#666' }}>Assigning {roomAssignSelectedIds.length} students.</p>
                        
                        <div style={{ marginBottom: '16px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#5f6368', marginBottom: '4px' }}>Select Room</label>
                            <select 
                                value={roomAssignTargetRoom} 
                                onChange={(e) => setRoomAssignTargetRoom(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0' }}
                            >
                                <option value="">Choose Room...</option>
                                {testingRooms.map(r => (
                                    <option key={r.id} value={r.id}>{r.id} ({r.capacity || '?'})</option>
                                ))}
                            </select>
                        </div>

                        <div style={{ marginBottom: '24px' }}>
                            <label style={{ display: 'block', fontSize: '12px', color: '#5f6368', marginBottom: '4px' }}>Testing Date</label>
                            <input 
                                type="date"
                                value={roomAssignTargetDate}
                                onChange={(e) => setRoomAssignTargetDate(e.target.value)}
                                style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #dadce0' }}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button onClick={() => setIsRoomAssignOpen(false)} style={{ padding: '10px 20px', borderRadius: '6px', border: '1px solid #dadce0', backgroundColor: 'white', cursor: 'pointer' }}>Cancel</button>
                            <button onClick={handleRoomAssignment} style={{ padding: '10px 20px', borderRadius: '6px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>Assign Students</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MaineScienceTest;

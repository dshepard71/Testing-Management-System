import { useState, useEffect, useMemo } from 'react';
import { db } from '../../../firebase';
import { 
    doc, 
    onSnapshot, 
    collection, 
    query, 
    where, 
    getDoc, 
    setDoc, 
    deleteDoc, 
    updateDoc, 
    writeBatch, 
    serverTimestamp 
} from 'firebase/firestore';
import { encryptText, decryptText } from '../../../utils/crypto';

export const useSeatingChartData = (initialChart = null) => {
    // ------------------------------------
    // State Declarations
    // ------------------------------------
    const [selectedTest, setSelectedTest] = useState('Maine Science'); // 'Maine Science', 'Maine Through Year', 'AP Testing', 'SAT', 'PSAT', 'Makeups'
    const [selectedApSubject, setSelectedApSubject] = useState('');
    const [selectedDate, setSelectedDate] = useState('');
    const [selectedSession, setSelectedSession] = useState('All Day');
    const [selectedRoomId, setSelectedRoomId] = useState('');
    const [proctor, setProctor] = useState('');
    const [monitor, setMonitor] = useState('');

    // staff list
    const [staffList, setStaffList] = useState([]);
    
    // database states
    const [roomLayouts, setRoomLayouts] = useState({});
    const [savedCharts, setSavedCharts] = useState([]);
    const [allMasterStudents, setAllMasterStudents] = useState([]);
    const [masterStudentsMap, setMasterStudentsMap] = useState({});
    
    // registrations
    const [apRegistrations, setApRegistrations] = useState([]);
    const [satRegistrations, setSatRegistrations] = useState([]);
    const [currentTestStudents, setCurrentTestStudents] = useState([]);

    // active seating mappings
    const [assignedSeats, setAssignedSeats] = useState({}); // { "row-col-slot": studentObject }
    
    // UI Loading & Saving states
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draggedStudent, setDraggedStudent] = useState(null);

    // Derived Room layout helper
    const currentRoomLayout = useMemo(() => {
        if (!selectedRoomId || !roomLayouts[selectedRoomId]) return null;
        return roomLayouts[selectedRoomId];
    }, [selectedRoomId, roomLayouts]);

    // ------------------------------------
    // 1. Core Config Subscriptions (Staff & Layouts)
    // ------------------------------------
    useEffect(() => {
        // Subscribe to Room Layouts
        const unsubLayouts = onSnapshot(doc(db, 'settings', 'room_layouts'), (docSnap) => {
            if (docSnap.exists()) {
                setRoomLayouts(docSnap.data());
            }
            setLoading(false);
        }, (err) => console.error("Error subscribing to room layouts:", err));

        // Subscribe to Staff List
        const unsubStaff = onSnapshot(doc(db, 'settings', 'staff'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().names) {
                const rawList = docSnap.data().names;
                const normalized = rawList.map(item => {
                    if (typeof item === 'string') return { name: item, email: '' };
                    return item;
                });
                setStaffList(normalized.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
            } else {
                setStaffList([]);
            }
        }, (err) => console.error("Error subscribing to staff list:", err));

        // Subscribe to Saved Charts Registry
        const unsubSavedCharts = onSnapshot(collection(db, 'seating_charts'), (snap) => {
            const charts = snap.docs.map(doc => {
                const data = doc.data();
                const decryptedAssignedSeats = {};
                if (data.assignedSeats) {
                    Object.entries(data.assignedSeats).forEach(([seatId, studentInfo]) => {
                        decryptedAssignedSeats[seatId] = {
                            ...studentInfo,
                            accommodations: decryptText(studentInfo.accommodations || '')
                        };
                    });
                }
                return {
                    id: doc.id,
                    ...data,
                    assignedSeats: decryptedAssignedSeats
                };
            }).sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0));
            setSavedCharts(charts);
        }, (err) => console.error("Error subscribing to saved charts:", err));

        return () => {
            unsubLayouts();
            unsubStaff();
            unsubSavedCharts();
        };
    }, []);

    // ------------------------------------
    // 2. Student Repositories Subscriptions
    // ------------------------------------
    useEffect(() => {
        // Subscribe to Master Student List
        const qMaster = query(collection(db, 'master_students'), where('status', '!=', 'Inactive'));
        const unsubMaster = onSnapshot(qMaster, (snap) => {
            const map = {};
            const list = [];
            snap.forEach(d => {
                const data = d.data();
                const decryptedData = {
                    id: d.id,
                    ...data,
                    accommodations: decryptText(data.accommodations || ''),
                    accommodationNotes: decryptText(data.accommodationNotes || '')
                };
                if (decryptedData.email) map[decryptedData.email.toLowerCase().trim()] = decryptedData;
                list.push(decryptedData);
            });
            setMasterStudentsMap(map);
            setAllMasterStudents(list.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')));
        }, (err) => console.error("Error subscribing to master students:", err));

        // Subscribe to AP Registrations
        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), (snap) => {
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    accommodations: decryptText(data.accommodations || ''),
                    ssdAccommodations: decryptText(data.ssdAccommodations || '')
                };
            });
            setApRegistrations(list);
        }, (err) => console.error("Error subscribing to AP registrations:", err));

        // Subscribe to SAT / PSAT Registrations
        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), (snap) => {
            const list = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    accommodations: decryptText(data.accommodations || '')
                };
            });
            setSatRegistrations(list);
        }, (err) => console.error("Error subscribing to SAT/PSAT registrations:", err));

        return () => {
            unsubMaster();
            unsubAP();
            unsubSAT();
        };
    }, []);

    // ------------------------------------
    // 3. Dynamic Student Group Processing
    // ------------------------------------
    useEffect(() => {
        let studentData = [];

        if (selectedTest === 'AP Testing') {
            studentData = apRegistrations.map(d => {
                let parsedDate = d.examDate || '';
                let isoDate = '';
                if (d.examDate && d.examDate.includes(',')) {
                    const parts = d.examDate.split(',');
                    if (parts.length >= 2) {
                        const currentYear = new Date().getFullYear();
                        const dateObj = new Date(`${parts[0].trim()}, ${currentYear}`);
                        if (!isNaN(dateObj.getTime())) {
                            parsedDate = `${dateObj.toLocaleDateString()} ${parts[1].trim()}`;
                            const y = dateObj.getFullYear();
                            const m = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const day = String(dateObj.getDate()).padStart(2, '0');
                            isoDate = `${y}-${m}-${day}`;
                        }
                    }
                }

                let session = 'All Day';
                if (d.examDate) {
                    const dateUpper = d.examDate.toUpperCase();
                    if (dateUpper.includes('AM')) session = 'Morning';
                    else if (dateUpper.includes('PM')) session = 'Afternoon';
                }

                const acc = d.ssdAccommodations || '';
                return {
                    id: d.id,
                    name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown Student',
                    firstName: d.firstName || '',
                    lastName: d.lastName || '',
                    grade: d.grade || '',
                    test: d.course || '',
                    assignedRoom: d.assignedRoom || null,
                    assignedDate: parsedDate,
                    isoDate: isoDate,
                    session: session,
                    originalDate: d.examDate || '',
                    accommodations: acc,
                    hasAccommodations: !!(acc && acc.toLowerCase() !== 'none' && acc.trim() !== ''),
                    email: d.email || ''
                };
            });
        } else if (selectedTest === 'SAT' || selectedTest === 'PSAT') {
            studentData = satRegistrations
                .filter(d => d.testType === selectedTest)
                .map(d => {
                    const master = masterStudentsMap[d.email?.toLowerCase().trim()];
                    const acc = d.accommodations && d.accommodations !== 'None' ? d.accommodations : (master?.accommodations || '');

                    return {
                        id: d.id,
                        name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown Student',
                        firstName: d.firstName || '',
                        lastName: d.lastName || '',
                        grade: d.grade || '',
                        test: d.testType || selectedTest,
                        assignedRoom: d.assignedRoom || null,
                        assignedDate: d.assignedDate || '',
                        accommodations: acc,
                        hasAccommodations: !!(acc && acc.toLowerCase() !== 'none' && acc.trim() !== ''),
                        email: d.email || ''
                    };
                });
        } else if (selectedTest === 'Maine Science' || selectedTest === 'Maine Through Year') {
            studentData = allMasterStudents
                .filter(s => {
                    const sGrade = String(s.grade || '').toLowerCase().replace(/[^0-9]/g, '');
                    const currentYear = new Date().getFullYear();
                    const currentMonth = new Date().getMonth();
                    const academicYear = currentMonth >= 6 ? currentYear + 1 : currentYear;
                    const grad11 = String(academicYear + 1);
                    const grad10 = String(academicYear + 2);
                    const grad08 = String(academicYear + 4);

                    if (selectedTest === 'Maine Science') {
                        return sGrade === '11' || sGrade === '08' || sGrade === grad11 || sGrade === grad08 || s.maine_science_include === true;
                    } else if (selectedTest === 'Maine Through Year') {
                        return sGrade === '10' || sGrade === '08' || sGrade === grad10 || sGrade === grad08;
                    }
                    return false;
                })
                .map(d => {
                    const acc = d.accommodations || '';
                    const room = selectedTest === 'Maine Science' ? d.maine_science_room : (d.maine_ty_math_room || d.maine_ty_reading_room);
                    const date = selectedTest === 'Maine Science' ? d.maine_science_date : (d.maine_ty_math_date || d.maine_ty_reading_date);

                    return {
                        id: d.id,
                        name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown Student',
                        firstName: d.firstName || '',
                        lastName: d.lastName || '',
                        email: d.email || '',
                        grade: d.grade || '',
                        test: selectedTest,
                        assignedRoom: room || null,
                        assignedDate: date || '',
                        accommodations: acc,
                        hasAccommodations: !!(acc && acc.toLowerCase() !== 'none' && acc.trim() !== '')
                    };
                });
        } else if (selectedTest === 'Makeups') {
            studentData = allMasterStudents
                .filter(d => {
                    const status = (d.attendanceStatus || '').toLowerCase();
                    return status === 'absent' || status === 'makeup' || status === 'makeup_scheduled' || d.makeupRoom;
                })
                .map(d => ({
                    id: d.id,
                    name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown Student',
                    firstName: d.firstName || '',
                    lastName: d.lastName || '',
                    email: d.email || '',
                    grade: d.grade || '',
                    test: 'Make-up',
                    assignedRoom: d.makeupRoom || null,
                    assignedDate: d.makeupDate || '',
                    session: d.makeupSession || 'Morning',
                    accommodations: d.accommodations || '',
                    hasAccommodations: !!(d.accommodations && d.accommodations.toLowerCase() !== 'none')
                }));
        }

        // Auto-detect default selectedDate for non-AP tests if they exist
        if (selectedTest !== 'AP Testing') {
            const uniqueDates = [...new Set(studentData.map(s => s.assignedDate).filter(Boolean))];
            if (uniqueDates.length > 0 && !selectedDate) {
                setSelectedDate(uniqueDates[0]);
            }
        }

        setCurrentTestStudents(studentData);
    }, [selectedTest, allMasterStudents, apRegistrations, satRegistrations, masterStudentsMap]);

    // Derived AP Subjects list
    const apSubjects = useMemo(() => {
        if (selectedTest !== 'AP Testing') return [];
        return [...new Set(currentTestStudents.map(s => s.test))].sort();
    }, [selectedTest, currentTestStudents]);

    // Auto-detect Session and Date for AP Testing subject
    useEffect(() => {
        if (selectedTest === 'AP Testing' && currentTestStudents.length > 0 && selectedApSubject) {
            const exemplar = currentTestStudents.find(s => s.test === selectedApSubject);
            if (exemplar) {
                if (exemplar.originalDate) {
                    const dateStr = exemplar.originalDate.toUpperCase();
                    if (dateStr.includes('AM')) setSelectedSession('Morning');
                    else if (dateStr.includes('PM')) setSelectedSession('Afternoon');
                    else setSelectedSession('All Day');
                }
                if (exemplar.isoDate) {
                    setSelectedDate(exemplar.isoDate);
                }
            }
        }
    }, [selectedTest, selectedApSubject, currentTestStudents]);

    // ------------------------------------
    // 4. Auto Load Seating Charts on room select
    // ------------------------------------
    useEffect(() => {
        if (!selectedRoomId || !selectedTest) return;

        let expectedId = `${selectedTest.replace(/\s+/g, '_')}_${selectedRoomId.replace(/\s+/g, '_')}`;
        if (selectedDate) expectedId += `_${selectedDate}`;
        if (selectedSession && selectedSession !== 'All Day') expectedId += `_${selectedSession}`;
        expectedId += `_Chart`;

        const matchingChart = savedCharts.find(c => c.id === expectedId);
        if (matchingChart && matchingChart.assignedSeats) {
            setAssignedSeats(matchingChart.assignedSeats);
            setProctor(matchingChart.proctor || '');
            setMonitor(matchingChart.monitor || '');
            if (selectedTest === 'AP Testing' && matchingChart.apSubject) {
                setSelectedApSubject(matchingChart.apSubject);
            }
        } else {
            // If no exact match exists, clear proctors/monitors and assignments
            setAssignedSeats({});
            setProctor('');
            setMonitor('');
        }
    }, [selectedRoomId, selectedTest, selectedDate, selectedSession, savedCharts]);

    // Hook up logistics direct chart injection if supplied from logistics nav
    const handleLoadChartDirect = (chart) => {
        setSelectedTest(chart.testType || 'Maine Science');
        setSelectedRoomId(chart.roomId || '');
        if (chart.date) setSelectedDate(chart.date);
        if (chart.session) setSelectedSession(chart.session);
        if (chart.testType === 'AP Testing' && chart.apSubject) {
            setSelectedApSubject(chart.apSubject);
        }
        setProctor(chart.proctor || '');
        setMonitor(chart.monitor || '');
        if (chart.assignedSeats) {
            setAssignedSeats(chart.assignedSeats);
        }
    };

    useEffect(() => {
        if (initialChart) {
            handleLoadChartDirect(initialChart);
        }
    }, [initialChart]);

    // ------------------------------------
    // 5. Derived Filtered Available Students list
    // ------------------------------------
    const filteredStudents = useMemo(() => {
        let matches = currentTestStudents;

        if (selectedTest === 'AP Testing' && selectedApSubject) {
            matches = matches.filter(s => s.test === selectedApSubject);
        }

        return matches.sort((a, b) => {
            if (a.hasAccommodations && !b.hasAccommodations) return -1;
            if (!a.hasAccommodations && b.hasAccommodations) return 1;

            const aOther = a.assignedRoom && a.assignedRoom !== selectedRoomId;
            const bOther = b.assignedRoom && b.assignedRoom !== selectedRoomId;
            if (!aOther && bOther) return -1;
            if (aOther && !bOther) return 1;

            return a.name.localeCompare(b.name);
        });
    }, [currentTestStudents, selectedTest, selectedApSubject, selectedRoomId]);

    // ------------------------------------
    // 6. mutation actions
    // ------------------------------------

    const handleSave = async () => {
        if (!selectedTest || !selectedRoomId) return;
        setSaving(true);
        try {
            let chartId = `${selectedTest.replace(/\s+/g, '_')}_${selectedRoomId.replace(/\s+/g, '_')}`;
            if (selectedDate) chartId += `_${selectedDate}`;
            if (selectedSession && selectedSession !== 'All Day') chartId += `_${selectedSession}`;
            chartId += `_Chart`;

            const proctorEntry = staffList.find(s => s.name === proctor);
            const monitorEntry = staffList.find(s => s.name === monitor);
            const proctorEmail = proctorEntry?.email || '';
            const monitorEmail = monitorEntry?.email || '';

            // Conflict Check
            if (proctor || monitor) {
                const conflictingCharts = savedCharts.filter(c => {
                    if (c.id === chartId) return false;
                    if (c.date !== selectedDate) return false;
                    if (c.session !== selectedSession && c.session !== 'All Day' && selectedSession !== 'All Day') return false;
                    
                    const proctorConflict = proctor && (c.proctor === proctor || c.monitor === proctor);
                    const monitorConflict = monitor && (c.proctor === monitor || c.monitor === monitor);
                    return proctorConflict || monitorConflict;
                });

                if (conflictingCharts.length > 0) {
                    const conflicts = conflictingCharts.map(c => {
                        const conflictingPerson = (proctor && (c.proctor === proctor || c.monitor === proctor)) ? proctor : monitor;
                        return `• ${conflictingPerson} is also assigned in ${c.roomId} (${c.session || 'All Day'})`;
                    }).join('\n');

                    if (!window.confirm(`⚠️ Proctoring Conflict Detected:\n\n${conflicts}\n\nDo you wish to save anyway?`)) {
                        setSaving(false);
                        return;
                    }
                }
            }

            // Clean assignments (remove deleted students) and encrypt sensitive accommodations
            const cleanedSeats = {};
            Object.keys(assignedSeats).forEach(seatKey => {
                const s = assignedSeats[seatKey];
                if (currentTestStudents.some(stud => stud.id === s.id)) {
                    const studentCopy = {
                        ...s,
                        accommodations: encryptText(s.accommodations || '')
                    };
                    cleanedSeats[seatKey] = JSON.parse(JSON.stringify(studentCopy, (key, value) => {
                        return value === undefined ? null : value;
                    }));
                }
            });

            // Write Chart Document
            await setDoc(doc(db, 'seating_charts', chartId), {
                testType: selectedTest,
                apSubject: selectedApSubject,
                roomId: selectedRoomId,
                date: selectedDate,
                session: selectedSession,
                proctor: proctor,
                proctorEmail: proctorEmail,
                monitor: monitor,
                monitorEmail: monitorEmail,
                assignedSeats: cleanedSeats,
                updatedAt: serverTimestamp(),
                studentCount: Object.keys(cleanedSeats).length
            });

            setAssignedSeats(cleanedSeats);

            // Batch Update Student Database Assignments
            const batch = writeBatch(db);
            const studentsInChart = Object.values(cleanedSeats);
            const studentIdsInChart = studentsInChart.map(s => s.id);

            // Clean up duplicate assignments from other Seating Charts
            savedCharts.forEach(chart => {
                if (chart.id === chartId) return;
                if (chart.testType !== selectedTest) return;
                if (selectedTest === 'AP Testing' && chart.apSubject !== selectedApSubject) return;

                let chartModified = false;
                const otherChartSeats = { ...chart.assignedSeats };
                
                // If any newly assigned student is in this old chart, remove them
                Object.keys(otherChartSeats).forEach(seatKey => {
                    if (studentIdsInChart.includes(otherChartSeats[seatKey]?.id)) {
                        delete otherChartSeats[seatKey];
                        chartModified = true;
                    }
                });

                if (chartModified) {
                    batch.update(doc(db, 'seating_charts', chart.id), {
                        assignedSeats: otherChartSeats,
                        studentCount: Object.keys(otherChartSeats).length
                    });
                }
            });

            // Update assigned students
            studentsInChart.forEach(s => {
                let collectionName = 'master_students';
                if (selectedTest === 'AP Testing') collectionName = 'ap_registrations';
                else if (selectedTest === 'SAT' || selectedTest === 'PSAT') collectionName = 'sat_registrations';

                const docRef = doc(db, collectionName, s.id);
                const updates = {};

                if (selectedTest === 'Maine Science') {
                    updates.maine_science_room = selectedRoomId;
                    if (selectedDate) updates.maine_science_date = selectedDate;
                    if (selectedSession) updates.maine_science_session = selectedSession;
                } else if (selectedTest === 'Maine Through Year') {
                    updates.maine_ty_math_room = selectedRoomId;
                    updates.maine_ty_reading_room = selectedRoomId;
                    if (selectedDate) {
                        updates.maine_ty_math_date = selectedDate;
                        updates.maine_ty_reading_date = selectedDate;
                    }
                    if (selectedSession) {
                        updates.maine_ty_math_session = selectedSession;
                        updates.maine_ty_reading_session = selectedSession;
                    }
                } else if (selectedTest === 'Makeups') {
                    updates.makeupRoom = selectedRoomId;
                    if (selectedDate) updates.makeupDate = selectedDate;
                    if (selectedSession) updates.makeupSession = selectedSession;
                    updates.attendanceStatus = 'makeup_scheduled';
                } else {
                    updates.assignedRoom = selectedRoomId;
                    if (selectedDate) updates.assignedDate = selectedDate;
                    if (selectedSession) updates.session = selectedSession;
                }

                batch.update(docRef, updates);
            });

            // Clean up unassigned students (previously assigned here but removed)
            currentTestStudents.forEach(s => {
                const isMakeup = selectedTest === 'Makeups';
                const currentDBRoom = isMakeup ? s.assignedRoom : (selectedTest === 'Maine Science' ? s.maine_science_room : (selectedTest === 'Maine Through Year' ? s.maine_ty_math_room : s.assignedRoom));
                
                const matchesSelectedRoom = currentDBRoom === selectedRoomId;
                const notInChart = !studentIdsInChart.includes(s.id);

                let inScope = true;
                if (selectedTest === 'AP Testing' && selectedDate) {
                    if (s.isoDate !== selectedDate) inScope = false;
                    if (inScope && selectedSession && selectedSession !== 'All Day') {
                        if (s.session && s.session !== selectedSession) inScope = false;
                    }
                }

                if (matchesSelectedRoom && notInChart && inScope) {
                    let collectionName = 'master_students';
                    if (selectedTest === 'AP Testing') collectionName = 'ap_registrations';
                    else if (selectedTest === 'SAT' || selectedTest === 'PSAT') collectionName = 'sat_registrations';

                    const docRef = doc(db, collectionName, s.id);
                    if (selectedTest === 'Maine Science') {
                        batch.update(docRef, { maine_science_room: null });
                    } else if (selectedTest === 'Maine Through Year') {
                        batch.update(docRef, {
                            maine_ty_math_room: null,
                            maine_ty_reading_room: null
                        });
                    } else if (isMakeup) {
                        batch.update(docRef, { makeupRoom: null });
                    } else {
                        batch.update(docRef, { assignedRoom: null });
                    }
                }
            });

            await batch.commit();
            alert('Seating chart saved and student records updated successfully!');
        } catch (e) {
            console.error("Error saving seating chart:", e);
            alert("Failed to save seating chart.");
        } finally {
            setSaving(false);
        }
    };

    const handleAutoFill = () => {
        if (!currentRoomLayout) return;

        const availableSeats = [];
        const { rows, cols, grid } = currentRoomLayout;
        let grid2D = [];

        if (Array.isArray(grid) && grid.length === rows * cols) {
            for (let i = 0; i < rows; i++) {
                const r = [];
                for (let j = 0; j < cols; j++) r.push(grid[i * cols + j]);
                grid2D.push(r);
            }
        } else {
            grid2D = grid || [];
        }

        grid2D.forEach((row, rIndex) => {
            row.forEach((cell, cIndex) => {
                if (cell === 'desk') {
                    if (!assignedSeats[`${rIndex}-${cIndex}-0`]) availableSeats.push(`${rIndex}-${cIndex}-0`);
                } else if (cell === 'table') {
                    if (!assignedSeats[`${rIndex}-${cIndex}-0`]) availableSeats.push(`${rIndex}-${cIndex}-0`);
                    if (!assignedSeats[`${rIndex}-${cIndex}-1`]) availableSeats.push(`${rIndex}-${cIndex}-1`);
                }
            });
        });

        const currentAssignedIds = Object.values(assignedSeats).map(s => s.id);
        const unassignedStudents = filteredStudents.filter(s => !currentAssignedIds.includes(s.id));

        // Shuffle available unassigned students (Fisher-Yates)
        const shuffled = [...unassignedStudents];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        const newAssignments = { ...assignedSeats };
        shuffled.forEach((student, index) => {
            if (index < availableSeats.length) {
                newAssignments[availableSeats[index]] = student;
            }
        });

        setAssignedSeats(newAssignments);
    };

    const handleClearRoom = () => {
        if (window.confirm('Clear all assignments in this room layout? (You must click Save to persist)')) {
            setAssignedSeats({});
        }
    };

    const handleCopyEmails = () => {
        const finalEmails = new Set();
        const emailLookup = new Map();
        
        currentTestStudents.forEach(s => {
            if (s.id && s.email) emailLookup.set(s.id, s.email.toLowerCase().trim());
        });

        Object.values(assignedSeats).forEach(s => {
            const email = s.email?.toLowerCase().trim() || emailLookup.get(s.id);
            if (email) finalEmails.add(email);
        });

        if (finalEmails.size === 0) {
            alert('No student emails found for this room. Ensure students have emails in the master database.');
            return;
        }

        const emailList = Array.from(finalEmails).sort().join(', ');
        navigator.clipboard.writeText(emailList).then(() => {
            alert(`📋 Copied ${finalEmails.size} unique student emails to your clipboard!`);
        }).catch(err => {
            console.error('Failed to copy emails:', err);
            alert('Failed to copy emails. Verify clipboard permissions.');
        });
    };

    // ------------------------------------
    // 7. Staff Registry Management
    // ------------------------------------
    const handleAddStaff = async (name, email) => {
        if (!name.trim()) return;
        const ref = doc(db, 'settings', 'staff');
        const staffObj = { name: name.trim(), email: email.trim().toLowerCase() };
        try {
            const snap = await getDoc(ref);
            if (!snap.exists()) await setDoc(ref, { names: [] });
            await updateDoc(ref, { names: [...(snap.data()?.names || []), staffObj] });
        } catch (e) {
            console.error("Error adding staff member:", e);
            throw new Error("Failed to add staff member.");
        }
    };

    const handleUpdateStaff = async (oldStaff, newName, newEmail) => {
        if (!newName.trim() || !oldStaff) return;
        const ref = doc(db, 'settings', 'staff');
        try {
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const currentNames = snap.data().names || [];
                const filtered = currentNames.filter(item => {
                    if (typeof item === 'string' && typeof oldStaff === 'string') return item !== oldStaff;
                    if (typeof item === 'object' && typeof oldStaff === 'object') {
                        return item.name !== oldStaff.name || item.email !== oldStaff.email;
                    }
                    if (typeof item === 'string' && typeof oldStaff === 'object') return item !== oldStaff.name;
                    return true;
                });
                
                filtered.push({ name: newName.trim(), email: newEmail.trim().toLowerCase() });
                await updateDoc(ref, { names: filtered });
            }
        } catch (e) {
            console.error("Error updating staff member:", e);
            throw new Error("Failed to update staff member.");
        }
    };

    const handleDeleteStaff = async (staffObj) => {
        const staffName = typeof staffObj === 'string' ? staffObj : staffObj.name;
        const staffEmail = typeof staffObj === 'string' ? '' : (staffObj.email || '');
        
        if (!window.confirm(`Remove ${staffName}${staffEmail ? ` (${staffEmail})` : ''} from the staff registry?`)) return;
        
        try {
            const ref = doc(db, 'settings', 'staff');
            const snap = await getDoc(ref);
            if (snap.exists()) {
                const currentNames = snap.data().names || [];
                const filtered = currentNames.filter(item => {
                    if (typeof item === 'string') return !(item === staffName && staffEmail === '');
                    return !(item.name === staffName && (item.email || '') === staffEmail);
                });
                await updateDoc(ref, { names: filtered });
            }
        } catch (e) {
            console.error("Error removing staff member:", e);
            alert("Failed to delete staff member.");
        }
    };

    // Return custom hook interface
    return {
        // States & Selectors
        selectedTest,
        setSelectedTest,
        selectedApSubject,
        setSelectedApSubject,
        selectedDate,
        setSelectedDate,
        selectedSession,
        setSelectedSession,
        selectedRoomId,
        setSelectedRoomId,
        proctor,
        setProctor,
        monitor,
        setMonitor,
        staffList,
        roomLayouts,
        savedCharts,
        allMasterStudents,
        currentTestStudents,
        filteredStudents,
        assignedSeats,
        setAssignedSeats,
        currentRoomLayout,
        apSubjects,
        loading,
        saving,
        draggedStudent,
        setDraggedStudent,

        // Direct Load Action (Logistics panel integration)
        handleLoadChartDirect,

        // Core Seating Chart Operations
        handleSave,
        handleAutoFill,
        handleClearRoom,
        handleCopyEmails,

        // Staff Registry Mutators
        handleAddStaff,
        handleUpdateStaff,
        handleDeleteStaff
    };
};

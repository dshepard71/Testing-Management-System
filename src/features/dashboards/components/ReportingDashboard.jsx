import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../firebase';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

import { collection, onSnapshot, addDoc, serverTimestamp, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { decryptText } from '../../../utils/crypto';
import HelpGuide from './HelpGuide';

const ReportingDashboard = () => {
    const [apStudents, setApStudents] = useState([]);
    const [satRegistrations, setSatRegistrations] = useState([]);
    const [masterStudents, setMasterStudents] = useState([]);
    const [seatingCharts, setSeatingCharts] = useState([]);
    const [snapshots, setSnapshots] = useState([]); // Year-end summaries
    const [loading, setLoading] = useState(true);
    const [showHelp, setShowHelp] = useState(false);
    const [expandedAlert, setExpandedAlert] = useState(null);

    useEffect(() => {
        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), (snapshot) => {
            setApStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), (snapshot) => {
            setSatRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubMaster = onSnapshot(collection(db, 'master_students'), (snapshot) => {
            setMasterStudents(snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dob: decryptText(data.dob || ''),
                    stateId: decryptText(data.stateId || '')
                };
            }));
        });

        const unsubCharts = onSnapshot(collection(db, 'seating_charts'), (snapshot) => {
            setSeatingCharts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        const qSnapshots = query(collection(db, 'year_end_summaries'), orderBy('timestamp', 'desc'));
        const unsubSnapshots = onSnapshot(qSnapshots, (snapshot) => {
            setSnapshots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubAP();
            unsubSAT();
            unsubMaster();
            unsubCharts();
            unsubSnapshots();
        };
    }, []);

    // Calculate stats
    const apExamCount = apStudents.filter(s => s.orderExam === 'Yes').length;
    const apTotalCost = apStudents.reduce((sum, s) => {
        let cost = s.orderExam === 'Yes' ? (s.feeStatus === 'Reduced' ? 62 : 99) : 0;
        if (s.lateOrderFee === 'Yes') cost += 40;
        if (s.lateTestingFee === 'Yes') cost += 40;
        if (s.unusedFee === 'Yes') cost += 40;
        return sum + cost;
    }, 0);

    const satCount = satRegistrations.filter(r => r.testType === 'SAT').length;
    const psatCount = satRegistrations.filter(r => r.testType === 'PSAT').length;
    const satPaid = satRegistrations.filter(r => r.paymentRecd === 'Yes').length;
    const satPending = satRegistrations.length - satPaid;

    const studentsWithAccommodations = masterStudents.filter(s => s.accommodations).length;
    const totalRoomsScheduled = seatingCharts.length;
    const totalStudentsAssigned = seatingCharts.reduce((sum, c) => sum + (c.studentCount || 0), 0);

    // Helper to format any value for CSV (handles dates and strings)
    const formatCSVValue = (val) => {
        if (val === null || val === undefined) return '';

        // Handle Firestore Timestamps or Date objects
        if (val && typeof val === 'object') {
            if (val.seconds !== undefined) {
                return new Date(val.seconds * 1000).toLocaleDateString();
            }
            if (val instanceof Date) {
                return val.toLocaleDateString();
            }
            // Handle ISO strings or other date-like strings that look like dates
            if (typeof val.toString === 'function' && val.toString().includes('GMT')) {
                return new Date(val).toLocaleDateString();
            }
            return JSON.stringify(val).replace(/,/g, ';');
        }

        return String(val).replace(/,/g, ';').replace(/"/g, '""');
    };

    // Generic export function with specific header mapping
    const exportDataToCSV = (data, filename, headerMap) => {
        if (data.length === 0) {
            alert('No data to export');
            return;
        }

        const internalKeys = Object.keys(headerMap);
        const displayHeaders = Object.values(headerMap);

        const csvContent = [
            displayHeaders.join(','),
            ...data.map(row => internalKeys.map(key => formatCSVValue(row[key])).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    };

    const handleExportSAT = () => {
        const joinedData = satRegistrations.map(reg => {
            const master = masterStudents.find(m => m.email?.toLowerCase() === reg.email?.toLowerCase()) || {};
            return {
                ...reg,
                stateId: master.stateId || '',
                schoolId: master.schoolId || '',
                masterAccommodations: master.accommodations || '',
                masterNotes: master.accommodationNotes || ''
            };
        });

        const headerMap = {
            'lastName': 'Last Name',
            'firstName': 'First Name',
            'email': 'Email',
            'stateId': 'State ID',
            'schoolId': 'School ID',
            'grade': 'Grade',
            'testType': 'Test Type',
            'studentType': 'Student Type',
            'masterAccommodations': 'Accommodations',
            'masterNotes': 'Accommodation Notes',
            'paymentRecd': 'Paid',
            'paymentTender': 'Payment Method',
            'paymentAmount': 'Amount Paid',
            'paymentDate': 'Payment Date',
            'checkNumber': 'Check Number',
            'ccConfirmationCode': 'CC Confirmation',
            'counselor': 'Counselor',
            'submittedToBO': 'Submitted to BO'
        };

        exportDataToCSV(joinedData, 'SAT_PSAT_Registrations.csv', headerMap);
    };

    const handleExportMaster = () => {
        const headerMap = {
            'lastName': 'Last Name',
            'firstName': 'First Name',
            'email': 'Email',
            'stateId': 'State ID',
            'schoolId': 'School ID',
            'dob': 'DOB',
            'gender': 'Gender',
            'grade': 'Grade',
            'advisor': 'Advisor',
            'schoolProgram': 'Program',
            'accommodations': 'Accommodations',
            'accommodationNotes': 'Accommodation Notes',
            'waiverEligible': 'Waiver Eligible',
            'status': 'Status'
        };
        exportDataToCSV(masterStudents, 'Master_Student_List.csv', headerMap);
    };

    const handleExportAccommodations = () => {
        const filtered = masterStudents.filter(s => s.accommodations || s.accommodationNotes);
        const headerMap = {
            'lastName': 'Last Name',
            'firstName': 'First Name',
            'email': 'Email',
            'grade': 'Grade',
            'advisor': 'Advisor',
            'accommodations': 'Accommodations',
            'accommodationNotes': 'Accommodation Notes'
        };
        exportDataToCSV(filtered, 'Accommodations_Report.csv', headerMap);
    };

    const handleExportAP = () => {
        const headerMap = {
            'lastName': 'Last Name',
            'firstName': 'First Name',
            'email': 'Email',
            'course': 'Course',
            'teacher': 'Teacher',
            'orderExam': 'Ordered',
            'feeStatus': 'Fee Status',
            'ssdAccommodations': 'SSD Accommodations',
            'paymentRecd': 'Paid'
        };
        exportDataToCSV(apStudents, 'AP_Student_List.csv', headerMap);
    };

    const handleSaveSnapshot = async () => {
        if (!window.confirm("Are you sure you want to save a Year-End Snapshot?\nThis will save current statistics to the historical record.")) return;

        const snapshotData = {
            timestamp: serverTimestamp(),
            date: new Date().toISOString(),
            academicYear: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1), // Simple logic, can be improved
            stats: {
                apExamCount,
                apTotalCost,
                satCount,
                psatCount,
                studentsWithAccommodations,
                totalRoomsScheduled,
                totalStudentsAssigned
            }
        };

        try {
            await addDoc(collection(db, 'year_end_summaries'), snapshotData);
            alert("Snapshot saved successfully!");
        } catch (error) {
            console.error("Error saving snapshot:", error);
            alert("Error saving snapshot: " + error.message);
        }
    };

    const handleDeleteSnapshot = async (id) => {
        if (!window.confirm("Are you sure you want to delete this snapshot?")) return;
        try {
            await deleteDoc(doc(db, 'year_end_summaries', id));
        } catch (error) {
            console.error("Error deleting snapshot:", error);
        }
    };

    const StatCard = ({ title, value, subtitle, color = '#1a73e8', icon }) => (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            padding: '20px',
            border: '1px solid #dadce0',
            flex: '1',
            minWidth: '150px'
        }}>
            <div style={{ fontSize: '14px', color: '#5f6368', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                {icon} {title}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color }}>{value}</div>
            {subtitle && <div style={{ fontSize: '12px', color: '#80868b', marginTop: '4px' }}>{subtitle}</div>}
        </div>
    );

    if (loading) return <div style={{ padding: '20px' }}>Loading reports...</div>;

    const exportButtonStyle = {
        padding: '12px 20px',
        backgroundColor: '#e8f0fe',
        color: '#1a73e8',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: '500'
    };

    return (
        <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#202124' }}>📊 Reporting Dashboard</h1>
                    <p style={{ margin: '8px 0 0', color: '#5f6368' }}>Overview of testing statistics and logistics</p>
                </div>
                <button
                    onClick={() => setShowHelp(true)}
                    style={{
                        padding: '8px 16px',
                        backgroundColor: '#fff',
                        border: '1px solid #dadce0',
                        borderRadius: '20px',
                        color: '#1a73e8',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <span style={{ fontSize: '18px' }}>❓</span> Help
                </button>
            </div>

            {showHelp && <HelpGuide role="reports" onClose={() => setShowHelp(false)} />}

            {/* Stats Grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
                <StatCard icon="📘" title="AP Exams Ordered" value={apExamCount} subtitle={`$${apTotalCost.toLocaleString()} total billed`} color="#1a73e8" />
                <StatCard icon="📝" title="SAT Registrations" value={satCount} subtitle={`${satPaid} paid, ${satRegistrations.filter(r => r.testType === 'SAT' && r.paymentRecd !== 'Yes').length} pending`} color="#34a853" />
                <StatCard icon="📋" title="PSAT Registrations" value={psatCount} color="#fbbc04" />
                <StatCard icon="♿" title="Students w/ Accommodations" value={studentsWithAccommodations} subtitle="In Master List" color="#ea4335" />
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '32px' }}>
                <StatCard icon="🏫" title="Rooms Scheduled" value={totalRoomsScheduled} color="#5f6368" />
                <StatCard icon="👥" title="Students Assigned" value={totalStudentsAssigned} subtitle="To seating charts" color="#5f6368" />
                <StatCard icon="👤" title="Master List Total" value={masterStudents.length} color="#5f6368" />
            </div>

            {/* Smart Alerts & Validation Widget */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #dadce0', marginBottom: '32px' }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#202124', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '20px' }}>⚠️</span> Action Items & Alerts
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {satRegistrations.filter(r => r.paymentRecd !== 'Yes').length > 0 && (
                        <div style={{ backgroundColor: '#fef7e0', borderLeft: '4px solid #f9ab00', borderRadius: '4px', overflow: 'hidden' }}>
                            <div 
                                onClick={() => setExpandedAlert(expandedAlert === 'payments' ? null : 'payments')}
                                style={{ padding: '12px 16px', fontSize: '14px', color: '#b06000', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <span><strong>Pending Payments:</strong> {satRegistrations.filter(r => r.paymentRecd !== 'Yes').length} students have unpaid SAT/PSAT registrations.</span>
                                <span>{expandedAlert === 'payments' ? '▲' : '▼'}</span>
                            </div>
                            {expandedAlert === 'payments' && (
                                <div style={{ padding: '0 16px 16px 16px', fontSize: '13px', color: '#80868b' }}>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {satRegistrations.filter(r => r.paymentRecd !== 'Yes').map(r => (
                                            <li key={r.id}>{r.lastName}, {r.firstName} ({r.testType})</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    {seatingCharts.filter(c => !c.proctor || c.proctor === 'Unassigned').length > 0 && (
                        <div style={{ backgroundColor: '#fce8e6', borderLeft: '4px solid #ea4335', borderRadius: '4px', overflow: 'hidden' }}>
                            <div 
                                onClick={() => setExpandedAlert(expandedAlert === 'proctors' ? null : 'proctors')}
                                style={{ padding: '12px 16px', fontSize: '14px', color: '#c5221f', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                            >
                                <span><strong>Missing Proctors:</strong> {seatingCharts.filter(c => !c.proctor || c.proctor === 'Unassigned').length} testing sessions are missing an assigned proctor.</span>
                                <span>{expandedAlert === 'proctors' ? '▲' : '▼'}</span>
                            </div>
                            {expandedAlert === 'proctors' && (
                                <div style={{ padding: '0 16px 16px 16px', fontSize: '13px', color: '#80868b' }}>
                                    <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                        {seatingCharts.filter(c => !c.proctor || c.proctor === 'Unassigned').map(c => (
                                            <li key={c.id}>{c.apSubject || c.testType || c.category} - Room {c.roomId} ({c.date || 'No Date'})</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    {/* Add more alerts here as needed */}
                    {satRegistrations.filter(r => r.paymentRecd === 'Yes').length === satRegistrations.length && seatingCharts.filter(c => !c.proctor || c.proctor === 'Unassigned').length === 0 && (
                        <div style={{ padding: '12px 16px', backgroundColor: '#e6f4ea', borderLeft: '4px solid #34a853', borderRadius: '4px', fontSize: '14px', color: '#137333' }}>
                            <strong>All Caught Up!</strong> No urgent action items at this time.
                        </div>
                    )}
                </div>
            </div>

            {/* Export Section */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #dadce0'
            }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#202124' }}>📥 Export Data</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginTop: '20px' }}>
                    <button onClick={handleExportAP} style={exportButtonStyle}>📥 Export AP Data</button>
                    <button onClick={handleExportSAT} style={exportButtonStyle}>📥 Export SAT/PSAT</button>
                    <button onClick={handleExportMaster} style={exportButtonStyle}>📥 Export Master List</button>
                    <button onClick={handleExportAccommodations} style={exportButtonStyle}>📥 Export Accommodations</button>
                    <button onClick={handleSaveSnapshot} style={{ ...exportButtonStyle, backgroundColor: '#e8f0fe', color: '#1a73e8', border: '1px solid #1a73e8' }}>📸 Save Year-End Snapshot</button>
                </div>
            </div>

            {/* Year-End Snapshots History */}
            {snapshots.length > 0 && (
                <div style={{
                    backgroundColor: 'white',
                    borderRadius: '12px',
                    padding: '24px',
                    border: '1px solid #dadce0',
                    marginBottom: '24px'
                }}>
                    <h3 style={{ margin: '0 0 16px 0', color: '#202124' }}>📜 Historical Snapshots</h3>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                            <thead>
                                <tr style={{ borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>
                                    <th style={{ padding: '8px' }}>Date</th>
                                    <th style={{ padding: '8px' }}>Academic Year</th>
                                    <th style={{ padding: '8px' }}>AP Exams</th>
                                    <th style={{ padding: '8px' }}>SAT Count</th>
                                    <th style={{ padding: '8px' }}>PSAT Count</th>
                                    <th style={{ padding: '8px' }}>Total Assigned</th>
                                    <th style={{ padding: '8px' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {snapshots.map(snap => (
                                    <tr key={snap.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                        <td style={{ padding: '8px', color: '#5f6368' }}>{new Date(snap.date).toLocaleDateString()}</td>
                                        <td style={{ padding: '8px', fontWeight: '500' }}>{snap.academicYear}</td>
                                        <td style={{ padding: '8px' }}>{snap.stats?.apExamCount || 0}</td>
                                        <td style={{ padding: '8px' }}>{snap.stats?.satCount || 0}</td>
                                        <td style={{ padding: '8px' }}>{snap.stats?.psatCount || 0}</td>
                                        <td style={{ padding: '8px' }}>{snap.stats?.totalStudentsAssigned || 0}</td>
                                        <td style={{ padding: '8px' }}>
                                            <button
                                                onClick={() => handleDeleteSnapshot(snap.id)}
                                                style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}
                                                title="Delete Snapshot"
                                            >
                                                🗑️
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Visual Charts Section */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginTop: '24px' }}>
                {/* AP Subject Popularity */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #dadce0' }}>
                    <h3 style={{ margin: '0 0 16px 0', color: '#202124' }}>📘 AP Subject Popularity</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={Object.entries(
                                    apStudents
                                        .filter(s => s.orderExam === 'Yes')
                                        .reduce((acc, s) => {
                                            const course = s.course || 'Unknown';
                                            acc[course] = (acc[course] || 0) + 1;
                                            return acc;
                                        }, {})
                                )
                                .map(([name, count]) => ({ name, count }))
                                .sort((a, b) => b.count - a.count)
                                .slice(0, 10)} // Top 10 AP subjects
                                layout="vertical"
                                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                            >
                                <XAxis type="number" />
                                <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 12 }} />
                                <Tooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="count" fill="#1a73e8" radius={[0, 4, 4, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Overall Testing Distribution */}
                <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '24px', border: '1px solid #dadce0' }}>
                    <h3 style={{ margin: '0 0 16px 0', color: '#202124' }}>🥧 Registration Distribution</h3>
                    <div style={{ height: '300px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'AP Exams', value: apExamCount },
                                        { name: 'SAT', value: satCount },
                                        { name: 'PSAT', value: psatCount }
                                    ]}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#1a73e8" />
                                    <Cell fill="#34a853" />
                                    <Cell fill="#fbbc04" />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Proctor Workload Stats */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                padding: '24px',
                border: '1px solid #dadce0',
                marginTop: '24px'
            }}>
                <h3 style={{ margin: '0 0 16px 0', color: '#202124' }}>👤 Proctor Workload</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
                    {Object.entries(
                        seatingCharts.reduce((acc, chart) => {
                            // Helper to process a staff member
                            const processStaff = (name, role) => {
                                const staffName = name || 'Unassigned';
                                if (!acc[staffName]) {
                                    acc[staffName] = {
                                        sessions: 0,
                                        students: 0,
                                        dates: new Set(),
                                        byType: { AP: 0, SAT: 0, PSAT: 0, MaineTY: 0, MaineSci: 0, Other: 0 },
                                        tests: [],
                                        roles: { Proctor: 0, Monitor: 0 }
                                    };
                                }
                                acc[staffName].sessions++;
                                acc[staffName].students += chart.studentCount || 0;
                                if (chart.date) acc[staffName].dates.add(chart.date);
                                if (role) acc[staffName].roles[role]++;

                                // Categorize by test type
                                const category = chart.category || '';
                                const testType = chart.testType || '';
                                const testName = chart.apSubject || chart.testType || 'Unknown';

                                if (category.includes('AP') || chart.apSubject) {
                                    acc[staffName].byType.AP++;
                                } else if (testType === 'SAT' || category.includes('SAT')) {
                                    acc[staffName].byType.SAT++;
                                } else if (testType === 'PSAT' || category.includes('PSAT')) {
                                    acc[staffName].byType.PSAT++;
                                } else if (category.includes('Maine') || testName.includes('Maine')) {
                                    if (testName.toLowerCase().includes('science')) {
                                        acc[staffName].byType.MaineSci++;
                                    } else {
                                        acc[staffName].byType.MaineTY++;
                                    }
                                } else {
                                    acc[staffName].byType.Other++;
                                }

                                // Store test names for unassigned
                                if (staffName === 'Unassigned') {
                                    acc[staffName].tests.push({
                                        name: testName,
                                        room: chart.roomId,
                                        date: chart.date,
                                        missingRole: role || 'Proctor'
                                    });
                                }
                            };

                            // Process Proctor
                            processStaff(chart.proctor, 'Proctor');

                            // Process Monitor (if exists)
                            if (chart.monitor) {
                                processStaff(chart.monitor, 'Monitor');
                            }

                            return acc;
                        }, {})
                    )
                        .sort((a, b) => {
                            if (a[0] === 'Unassigned') return -1;
                            if (b[0] === 'Unassigned') return 1;
                            return b[1].sessions - a[1].sessions;
                        })
                        .map(([proctor, data]) => (
                            <div key={proctor} style={{
                                padding: '16px',
                                backgroundColor: proctor === 'Unassigned' ? '#fef7e0' : '#f8f9fa',
                                borderRadius: '8px',
                                border: proctor === 'Unassigned' ? '2px solid #f9ab00' : 'none'
                            }}>
                                <div style={{ fontWeight: '600', fontSize: '14px', marginBottom: '8px', color: proctor === 'Unassigned' ? '#b06000' : '#202124' }}>
                                    {proctor === 'Unassigned' ? '⚠️ Unassigned Sessions' : proctor}
                                </div>
                                <div style={{ display: 'flex', gap: '16px', fontSize: '12px', color: '#5f6368', marginBottom: '8px' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                        <span><strong>{data.sessions}</strong> total assignments</span>
                                        <span style={{ fontSize: '11px', color: '#80868b' }}>
                                            ({data.roles.Proctor} Proctor, {data.roles.Monitor} Monitor)
                                        </span>
                                    </div>
                                    <span><strong>{data.students}</strong> students</span>
                                    <span><strong>{data.dates.size}</strong> days</span>
                                </div>

                                {/* Test type breakdown */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                    {data.byType.AP > 0 && (
                                        <span style={{ padding: '3px 8px', backgroundColor: '#e8f0fe', color: '#1a73e8', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                            AP: {data.byType.AP}
                                        </span>
                                    )}
                                    {data.byType.SAT > 0 && (
                                        <span style={{ padding: '3px 8px', backgroundColor: '#e6f4ea', color: '#137333', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                            SAT: {data.byType.SAT}
                                        </span>
                                    )}
                                    {data.byType.PSAT > 0 && (
                                        <span style={{ padding: '3px 8px', backgroundColor: '#fce8e6', color: '#c5221f', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                            PSAT: {data.byType.PSAT}
                                        </span>
                                    )}
                                    {data.byType.MaineTY > 0 && (
                                        <span style={{ padding: '3px 8px', backgroundColor: '#fff3e0', color: '#e65100', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                            Maine TY: {data.byType.MaineTY}
                                        </span>
                                    )}
                                    {data.byType.MaineSci > 0 && (
                                        <span style={{ padding: '3px 8px', backgroundColor: '#e0f7fa', color: '#006064', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                            Maine Sci: {data.byType.MaineSci}
                                        </span>
                                    )}
                                    {data.byType.Other > 0 && (
                                        <span style={{ padding: '3px 8px', backgroundColor: '#f1f3f4', color: '#5f6368', borderRadius: '4px', fontSize: '11px', fontWeight: '500' }}>
                                            Other: {data.byType.Other}
                                        </span>
                                    )}
                                </div>

                                {/* List unassigned tests */}
                                {proctor === 'Unassigned' && data.tests.length > 0 && (
                                    <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #f0c36c' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: '#b06000', marginBottom: '6px' }}>Tests needing proctors:</div>
                                        {data.tests.slice(0, 5).map((test, idx) => (
                                            <div key={idx} style={{ fontSize: '11px', color: '#5f6368', marginBottom: '2px' }}>
                                                • {test.name} - {test.room} ({test.date || 'No date'})
                                            </div>
                                        ))}
                                        {data.tests.length > 5 && (
                                            <div style={{ fontSize: '10px', color: '#80868b', fontStyle: 'italic' }}>
                                                +{data.tests.length - 5} more sessions
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    {seatingCharts.length === 0 && (
                        <div style={{ padding: '20px', color: '#5f6368', fontStyle: 'italic' }}>
                            No seating charts created yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportingDashboard;

import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getDocs, updateDoc, setDoc } from 'firebase/firestore';
import AttendanceCheckin from './AttendanceCheckin';

export default function LogisticsHub() {
    const [charts, setCharts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [category, setCategory] = useState('AP Testing'); // Default category
    const [activeTab, setActiveTab] = useState('Logistics'); // 'Logistics' or 'Attendance'

    // Calculates the academic school year (e.g. '25-26') from a calendar date
    const getAcademicYearFromDate = (dateStr) => {
        if (!dateStr) return 'Other';
        const match = dateStr.match(/\b(20\d{2})\b/);
        if (!match) return 'Other';
        
        const calendarYear = parseInt(match[1]);
        let month = 5; // default to June (5) if unparseable
        
        const dateMatch = dateStr.match(/\b20\d{2}-(\d{2})-\d{2}\b/);
        if (dateMatch) {
            month = parseInt(dateMatch[1]) - 1;
        } else {
            const upper = dateStr.toUpperCase();
            if (upper.includes('JAN') || upper.includes('FEB') || upper.includes('MAR') || upper.includes('APR') || upper.includes('MAY') || upper.includes('JUN')) {
                month = 4;
            } else if (upper.includes('JUL') || upper.includes('AUG') || upper.includes('SEP') || upper.includes('OCT') || upper.includes('NOV') || upper.includes('DEC')) {
                month = 8;
            }
        }
        
        const startYear = month >= 6 ? calendarYear : calendarYear - 1;
        const endYearShort = (startYear + 1) % 100;
        const startYearShort = startYear % 100;
        return `${startYearShort}-${endYearShort.toString().padStart(2, '0')}`;
    };

    const currentAcademicYear = (() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const month = today.getMonth();
        const startYear = month >= 6 ? currentYear : currentYear - 1;
        const endYearShort = (startYear + 1) % 100;
        const startYearShort = startYear % 100;
        return `${startYearShort}-${endYearShort.toString().padStart(2, '0')}`;
    })();

    const [selectedYear, setSelectedYear] = useState('All');

    const testCategories = ['AP Testing', 'Maine Science', 'Maine Through Year', 'SAT', 'Makeups'];

    useEffect(() => {
        setLoading(true);
        let q = collection(db, 'seating_charts');

        if (category === 'SAT') {
            q = query(collection(db, 'seating_charts'), where('testType', 'in', ['SAT', 'PSAT']));
        } else {
            q = query(collection(db, 'seating_charts'), where('testType', '==', category));
        }

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // Sort by Date, then Session, then Room
            fetched.sort((a, b) => {
                const dateA = a.date || '9999-99-99';
                const dateB = b.date || '9999-99-99';
                if (dateA !== dateB) return dateA.localeCompare(dateB);

                const sessA = a.session || 'Z'; 
                const sessB = b.session || 'Z';

                const order = { 'Morning': 1, 'Afternoon': 2, 'All Day': 3 };
                const orderA = order[sessA] || 99;
                const orderB = order[sessB] || 99;

                if (orderA !== orderB) return orderA - orderB;

                return (a.roomId || '').localeCompare(b.roomId || '');
            });

            setCharts(fetched);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [category]);

    // Mass Sync Proctor Emails from Staff List (auto-creates proctor users)
    const handleSyncEmails = async () => {
        if (!window.confirm('This will:\n1. Update all charts with proctor/monitor emails\n2. Auto-create user accounts for new proctors\n\nContinue?')) return;
        setSyncing(true);
        try {
            const staffSnap = await getDoc(doc(db, 'settings', 'staff'));
            const staffList = staffSnap.exists() && staffSnap.data().names ? staffSnap.data().names : [];

            const staffMap = {};
            staffList.forEach(item => {
                const name = typeof item === 'string' ? item : item.name;
                const email = typeof item === 'string' ? '' : (item.email || '');
                if (name) staffMap[name] = email;
            });

            let updated = 0;
            for (const chart of charts) {
                const proctorEmail = staffMap[chart.proctor] || '';
                const monitorEmail = staffMap[chart.monitor] || '';

                if (proctorEmail !== (chart.proctorEmail || '') || monitorEmail !== (chart.monitorEmail || '')) {
                    await updateDoc(doc(db, 'seating_charts', chart.id), { proctorEmail, monitorEmail });
                    updated++;
                }
            }

            let usersCreated = 0;
            for (const item of staffList) {
                if (typeof item === 'object' && item.email) {
                    const email = item.email.toLowerCase();
                    const usersQuery = query(collection(db, 'users'), where('email', '==', email));
                    const existingUsers = await getDocs(usersQuery);

                    if (existingUsers.empty) {
                        await setDoc(doc(db, 'users', email), {
                            email: email,
                            displayName: item.name,
                            role: 'proctor',
                            createdAt: new Date().toISOString(),
                            autoCreated: true
                        });
                        usersCreated++;
                    }
                }
            }

            alert(`✅ Sync Complete!\n• Updated ${updated} chart(s)\n• Created ${usersCreated} new proctor accounts`);
        } catch (e) {
            console.error('Sync error:', e);
            alert('Error syncing. Check console for details.');
        } finally {
            setSyncing(false);
        }
    };

    const handlePrintDoorSign = (chart) => {
        const studentNames = chart.assignedSeats
            ? Object.values(chart.assignedSeats).map(s => `${s.lastName}, ${s.firstName}${s.hasAccommodations ? ' ⚡' : ''}`).sort().join('<br/>')
            : 'No students assigned';

        const signHtml = `
            <html>
            <head>
                <title>Door Sign - ${chart.roomId}</title>
                <style>
                    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; text-align: center; color: #1a1a1a; }
                    .header-banner { background: #00468b; color: white; padding: 20px; border-radius: 12px; margin-bottom: 30px; }
                    .room { font-size: 80px; font-weight: 800; letter-spacing: -2px; line-height: 1; }
                    .test { font-size: 32px; font-weight: 600; margin-top: 10px; opacity: 0.9; }
                    .date { font-size: 24px; color: #666; margin-bottom: 30px; font-weight: 500; }
                    .staff-card { border: 2px solid #e0e0e0; border-radius: 12px; padding: 20px; display: inline-block; min-width: 400px; margin-bottom: 30px; background: #fafafa; }
                    .staff { font-size: 20px; text-align: left; line-height: 1.6; }
                    .count { font-size: 22px; font-weight: bold; background: rgba(0, 70, 139, 0.1); color: #00468b; padding: 12px 24px; border-radius: 30px; display: inline-block; margin-bottom: 30px; }
                    .students { font-size: 15px; text-align: left; column-count: 2; column-gap: 60px; margin-top: 20px; border-top: 2px solid #eee; padding-top: 30px; line-height: 1.8; }
                    @media print { body { padding: 20px; } }
                </style>
            </head>
            <body>
                <div class="header-banner">
                    <div class="room">${chart.roomId}</div>
                    <div class="test">${chart.apSubject || chart.testType}</div>
                </div>
                <div class="date">${chart.date} • ${chart.session}</div>
                <div class="staff-card">
                    <div class="staff">
                        <div style="color: #666; font-size: 14px; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Testing Staff</div>
                        <div><strong style="color: #00468b">Proctor:</strong> ${chart.proctor || 'TBD'}</div>
                        <div><strong style="color: #00468b">Monitor:</strong> ${chart.monitor || 'TBD'}</div>
                    </div>
                </div>
                <br/>
                <div class="count">${chart.studentCount} Students Assigned</div>
                <div class="students">${studentNames}</div>
            </body>
            </html>
        `;
        const printWindow = window.open('', '_blank', 'width=900,height=700');
        printWindow.document.write(signHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    const handlePrintMasterSchedule = () => {
        const rowsHtml = sortedGroups.map(group => {
            let groupHtml = `<div class="group-header">${group.date} • ${group.session} Session</div>
                             <table class="schedule-table">
                                <thead>
                                    <tr>
                                        <th>Test Subject</th>
                                        <th>Room</th>
                                        <th>Staffing</th>
                                        <th>Capacity</th>
                                    </tr>
                                </thead>
                                <tbody>`;
            group.charts.forEach(chart => {
                groupHtml += `
                    <tr>
                        <td><strong>${chart.apSubject || chart.testType}</strong></td>
                        <td>${chart.roomId}</td>
                        <td>
                            Proctor: ${chart.proctor || 'TBD'}<br/>
                            Monitor: ${chart.monitor || 'None'}
                        </td>
                        <td>${chart.studentCount}</td>
                    </tr>
                `;
            });
            groupHtml += `</tbody></table>`;
            return groupHtml;
        }).join('');

        const reportHtml = `
            <html>
            <head>
                <title>Master Logistics Report - ${category}</title>
                <style>
                    body { font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; color: #1a1a1a; }
                    .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #00468b; padding-bottom: 20px; margin-bottom: 30px; }
                    .title { font-size: 32px; font-weight: 800; color: #00468b; margin: 0; }
                    .subtitle { font-size: 18px; color: #666; margin-top: 8px; }
                    .timestamp { font-size: 14px; color: #888; }
                    .group-header { font-size: 20px; font-weight: bold; background: #f0f4f8; color: #00468b; padding: 12px 20px; margin-top: 30px; border-radius: 8px 8px 0 0; border: 1px solid #e0e0e0; border-bottom: none; }
                    .schedule-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px; border: 1px solid #e0e0e0; }
                    .schedule-table th { text-align: left; background: #fafafa; padding: 12px 20px; border-bottom: 2px solid #e0e0e0; color: #555; text-transform: uppercase; font-size: 12px; }
                    .schedule-table td { padding: 16px 20px; border-bottom: 1px solid #eee; }
                    @media print { body { padding: 0; } }
                </style>
            </head>
            <body>
                <div class="header">
                    <div>
                        <h1 class="title">Master Logistics Report</h1>
                        <div class="subtitle">Category: ${category}</div>
                    </div>
                    <div class="timestamp">Printed: ${new Date().toLocaleDateString()}</div>
                </div>
                ${sortedGroups.length === 0 ? '<p>No charts found for this category.</p>' : rowsHtml}
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank', 'width=1000,height=800');
        printWindow.document.write(reportHtml);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 500);
    };

    // Derived unique academic years from all charts
    const uniqueYears = Array.from(new Set(charts.map(c => getAcademicYearFromDate(c.date)))).sort((a, b) => b.localeCompare(a));

    // Filter charts by selected academic year
    const displayedCharts = charts.filter(chart => {
        if (selectedYear === 'All') return true;
        return getAcademicYearFromDate(chart.date) === selectedYear;
    });

    // Group by Date + Session
    const groupedMap = {};
    displayedCharts.forEach(chart => {
        const date = chart.date || 'Undated';
        const session = chart.session || 'All Day';
        const key = `${date}|${session}`;
        if (!groupedMap[key]) {
            groupedMap[key] = { date, session, charts: [] };
        }
        groupedMap[key].charts.push(chart);
    });

    const sortedGroups = Object.values(groupedMap).sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        const order = { 'Morning': 1, 'Afternoon': 2, 'All Day': 3 };
        return (order[a.session] || 99) - (order[b.session] || 99);
    });

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto' }}>
            
            {/* Header Area */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: 'var(--fa-dark-blue)' }}>Logistics Hub</h2>
                    <p style={{ margin: '0 0 16px 0', color: 'var(--fa-warm-gray)', fontSize: '14px' }}>
                        View seating arrangements, print door signs, and track live attendance for Test Day.
                    </p>
                    
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button 
                            onClick={() => setActiveTab('Logistics')}
                            style={{ 
                                padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', border: 'none', cursor: 'pointer',
                                backgroundColor: activeTab === 'Logistics' ? 'var(--fa-blue)' : '#f1f3f4',
                                color: activeTab === 'Logistics' ? 'white' : '#5f6368'
                            }}
                        >
                            📋 Seating & Door Signs
                        </button>
                        <button 
                            onClick={() => setActiveTab('Attendance')}
                            style={{ 
                                padding: '8px 16px', borderRadius: '8px', fontWeight: 'bold', fontSize: '13px', border: 'none', cursor: 'pointer',
                                backgroundColor: activeTab === 'Attendance' ? 'var(--fa-blue)' : '#f1f3f4',
                                color: activeTab === 'Attendance' ? 'white' : '#5f6368'
                            }}
                        >
                            ✅ Live Attendance
                        </button>
                    </div>
                </div>
                
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {/* Academic Year Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.7)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>YEAR</label>
                        <select 
                            value={selectedYear} 
                            onChange={(e) => setSelectedYear(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 'bold', color: 'var(--fa-blue)', cursor: 'pointer', fontSize: '13px' }}
                        >
                            <option value="All">All Years</option>
                            {uniqueYears.map(yr => (
                                <option key={yr} value={yr}>
                                    {yr === currentAcademicYear ? `${yr} (Current)` : yr}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Test Category Filter */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.7)', padding: '6px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>TEST</label>
                        <select 
                            value={category} 
                            onChange={(e) => setCategory(e.target.value)}
                            style={{ border: 'none', background: 'transparent', outline: 'none', fontWeight: 'bold', color: 'var(--fa-blue)', cursor: 'pointer', fontSize: '13px' }}
                        >
                            {testCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>

                    <button 
                        onClick={handleSyncEmails} 
                        disabled={syncing}
                        style={{ 
                            padding: '10px 16px', backgroundColor: syncing ? '#ccc' : 'var(--fa-mint)', 
                            color: 'white', border: 'none', borderRadius: '8px', cursor: syncing ? 'default' : 'pointer', 
                            fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px',
                            boxShadow: syncing ? 'none' : '0 2px 4px rgba(109, 196, 188, 0.3)'
                        }}
                    >
                        {syncing ? '⏳ Syncing...' : '🔄 Sync Proctor Access'}
                    </button>
                    
                    <button 
                        onClick={handlePrintMasterSchedule}
                        style={{ padding: '10px 16px', backgroundColor: 'white', color: 'var(--fa-dark-blue)', border: '1px solid var(--glass-border)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        🖨️ Print Report
                    </button>
                </div>
            </div>

            {activeTab === 'Logistics' && (
                <>
                    {loading ? (
                        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>
                            Loading Logistics Data...
                        </div>
                    ) : charts.length === 0 ? (
                        <div className="glass-panel" style={{ padding: '48px', textAlign: 'center' }}>
                            <span style={{ fontSize: '32px', display: 'block', marginBottom: '16px' }}>📋</span>
                            <h3 style={{ color: 'var(--fa-dark-blue)', margin: '0 0 8px 0' }}>No Charts Generated</h3>
                            <p style={{ color: 'var(--fa-warm-gray)', margin: 0, fontSize: '14px' }}>
                                There are no seating charts saved for <strong>{category}</strong> yet. Head over to the Seating Charts manager to build them.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {sortedGroups.map((group, idx) => (
                                <div key={idx} className="glass-panel" style={{ overflow: 'hidden' }}>
                                    <div style={{ padding: '16px 24px', backgroundColor: 'rgba(0, 70, 139, 0.03)', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <span style={{ fontSize: '18px' }}>📅</span>
                                        <div>
                                            <h3 style={{ margin: 0, fontSize: '16px', color: 'var(--fa-dark-blue)' }}>{group.date}</h3>
                                            <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', fontWeight: 'bold', textTransform: 'uppercase' }}>{group.session} Session</div>
                                        </div>
                                    </div>
                                    
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead>
                                            <tr>
                                                <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--glass-border)' }}>Test Subject</th>
                                                <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--glass-border)' }}>Room</th>
                                                <th style={{ textAlign: 'left', padding: '12px 24px', color: 'var(--fa-warm-gray)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--glass-border)' }}>Staffing</th>
                                                <th style={{ textAlign: 'center', padding: '12px 24px', color: 'var(--fa-warm-gray)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--glass-border)' }}>Capacity</th>
                                                <th style={{ textAlign: 'right', padding: '12px 24px', color: 'var(--fa-warm-gray)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '1px solid var(--glass-border)' }}>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {group.charts.map(chart => (
                                                <tr key={chart.id} style={{ borderBottom: '1px solid rgba(0,0,0,0.03)', transition: 'background 0.2s' }} onMouseOver={e => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.4)'} onMouseOut={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                                                    <td style={{ padding: '16px 24px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>
                                                        {chart.apSubject || chart.testType}
                                                    </td>
                                                    <td style={{ padding: '16px 24px' }}>
                                                        <span style={{ background: 'rgba(0, 70, 139, 0.08)', color: 'var(--fa-blue)', padding: '4px 10px', borderRadius: '6px', fontSize: '13px', fontWeight: 'bold' }}>
                                                            {chart.roomId}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', fontSize: '13px' }}>
                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                            <div><span style={{ color: 'var(--fa-warm-gray)' }}>Proctor:</span> {chart.proctor ? <span style={{ fontWeight: '500' }}>{chart.proctor}</span> : <span style={{ color: 'var(--fa-red)', fontStyle: 'italic' }}>TBD</span>}</div>
                                                            <div><span style={{ color: 'var(--fa-warm-gray)' }}>Monitor:</span> {chart.monitor || <span style={{ color: '#ccc' }}>None</span>}</div>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'center' }}>
                                                        <div style={{ display: 'inline-block', background: '#f8f9fa', padding: '4px 12px', borderRadius: '20px', border: '1px solid #e0e0e0', fontWeight: 'bold', color: '#555' }}>
                                                            {chart.studentCount}
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                                                        <button
                                                            onClick={() => handlePrintDoorSign(chart)}
                                                            style={{ background: 'white', border: '1px solid var(--glass-border)', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', color: 'var(--fa-blue)', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
                                                            onMouseOver={e => e.currentTarget.style.borderColor = 'var(--fa-blue)'}
                                                            onMouseOut={e => e.currentTarget.style.borderColor = 'var(--glass-border)'}
                                                        >
                                                            🚪 Print Door Sign
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}
            
            {activeTab === 'Attendance' && (
                <div style={{ marginTop: '24px' }}>
                    <AttendanceCheckin />
                </div>
            )}
        </div>
    );
}

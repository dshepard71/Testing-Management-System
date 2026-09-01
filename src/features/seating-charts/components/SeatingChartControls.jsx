import React, { useState, useMemo } from 'react';
import { db } from '../../../firebase';
import { doc, getDoc, deleteDoc, writeBatch, deleteField } from 'firebase/firestore';

const SeatingChartControls = ({
    selectedTest, setSelectedTest,
    selectedApSubject, setSelectedApSubject,
    selectedDate, setSelectedDate,
    selectedSession, setSelectedSession,
    selectedRoomId, setSelectedRoomId,
    proctor, setProctor,
    monitor, setMonitor,
    roomLayouts,
    savedCharts,
    filteredStudents,
    assignedSeats,
    staffList,
    onAutoFill,
    onSave,
    onClearRoom,
    onCopyEmails,
    onLoadChartDirect,
    onManageStaffTrigger,
    saving,
    currentRoomLayout
}) => {
    const [showSavedCharts, setShowSavedCharts] = useState(false);
    const [savedChartFilter, setSavedChartFilter] = useState('All');
    
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
        
        // Academic year boundary starts in July (month 6)
        const startYear = month >= 6 ? calendarYear : calendarYear - 1;
        const endYearShort = (startYear + 1) % 100;
        const startYearShort = startYear % 100;
        return `${startYearShort}-${endYearShort.toString().padStart(2, '0')}`;
    };

    const [selectedYearFilter, setSelectedYearFilter] = useState(() => {
        const today = new Date();
        const currentYear = today.getFullYear();
        const month = today.getMonth();
        const startYear = month >= 6 ? currentYear : currentYear - 1;
        const endYearShort = (startYear + 1) % 100;
        const startYearShort = startYear % 100;
        return `${startYearShort}-${endYearShort.toString().padStart(2, '0')}`;
    });

    // Derived unique academic years from all charts in the database registry
    const uniqueYears = useMemo(() => {
        const years = new Set();
        savedCharts.forEach(c => {
            const y = getAcademicYearFromDate(c.date);
            years.add(y);
        });
        return Array.from(years).sort((a, b) => b.localeCompare(a));
    }, [savedCharts]);

    // Extract AP Subjects from active database list
    const apSubjects = useMemo(() => {
        return [...new Set(savedCharts.filter(c => c.testType === 'AP Testing' && c.apSubject).map(c => c.apSubject))].sort();
    }, [savedCharts]);

    // Handle Delete of a Saved Chart from database
    const handleDeleteSavedChart = async (e, chart) => {
        e.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete this saved seating chart?\n\nThis will also unassign all students assigned to this room in the database.`)) return;

        try {
            const chartDocRef = doc(db, 'seating_charts', chart.id);
            const chartDoc = await getDoc(chartDocRef);
            
            if (chartDoc.exists()) {
                const chartData = chartDoc.data();
                const assignedStudents = chartData.assignedSeats ? Object.values(chartData.assignedSeats) : [];
                
                if (assignedStudents.length > 0) {
                    const batch = writeBatch(db);
                    const collectionName = chartData.testType === 'AP Testing' ? 'ap_registrations' :
                        ['SAT', 'PSAT'].includes(chartData.testType) ? 'sat_registrations' : 'master_students';

                    for (const student of assignedStudents) {
                        if (student.id) {
                            const updates = { assignedSeat: deleteField() };
                            if (chartData.testType === 'Maine Science') {
                                updates.maine_science_room = deleteField();
                            } else if (chartData.testType === 'Maine Through Year') {
                                updates.maine_ty_math_room = deleteField();
                                updates.maine_ty_reading_room = deleteField();
                            } else if (chartData.testType === 'Makeups') {
                                updates.makeupRoom = deleteField();
                            } else {
                                updates.assignedRoom = deleteField();
                            }
                            batch.update(doc(db, collectionName, student.id), updates);
                        }
                    }
                    await batch.commit();
                }
            }

            await deleteDoc(chartDocRef);

            // If deleted the currently opened chart, clear UI state
            if (selectedRoomId === chart.roomId && selectedTest === chart.testType) {
                onClearRoom();
            }
            alert('Saved seating chart deleted successfully!');
        } catch (err) {
            console.error('Error deleting saved chart:', err);
            alert('Failed to delete saved chart.');
        }
    };

    // Derived Grouped Saved Charts with category and year filters applied
    const groupedSavedCharts = useMemo(() => {
        const filtered = savedCharts.filter(c => {
            const matchesCat = savedChartFilter === 'All' || c.testType === savedChartFilter;
            const matchesYear = selectedYearFilter === 'All' || getAcademicYearFromDate(c.date) === selectedYearFilter;
            return matchesCat && matchesYear;
        });
        return filtered.reduce((acc, chart) => {
            const cat = chart.testType || 'Other';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(chart);
            return acc;
        }, {});
    }, [savedCharts, savedChartFilter, selectedYearFilter]);

    return (
        <div className="glass-panel no-print" style={{ padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            
            {/* Prominent Header / Registry Drawer Toggle */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <button
                    onClick={() => setShowSavedCharts(!showSavedCharts)}
                    style={{
                        padding: '8px 16px', borderRadius: '8px', border: '1px solid var(--fa-blue)',
                        backgroundColor: showSavedCharts ? 'var(--fa-blue)' : 'rgba(0, 70, 139, 0.08)',
                        color: showSavedCharts ? 'white' : 'var(--fa-dark-blue)',
                        cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                        display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
                    }}
                >
                    <span>{showSavedCharts ? '📂' : '📁'}</span>
                    <span>{showSavedCharts ? 'Hide Saved Charts Registry' : 'View Saved Charts & Archive Registry'}</span>
                    <span style={{ fontSize: '11px', background: showSavedCharts ? 'rgba(255,255,255,0.25)' : 'var(--fa-blue)', color: 'white', padding: '2px 6px', borderRadius: '10px' }}>
                        {savedCharts.length} Saved
                    </span>
                </button>

                <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', fontStyle: 'italic' }}>
                    💡 To start a new chart, select test details below and click Save.
                </div>
            </div>

            {showSavedCharts && (
                    <div style={{
                        marginTop: '12px', maxHeight: '350px', overflowY: 'auto',
                        border: '1px solid #dadce0', padding: '16px', borderRadius: '8px',
                        backgroundColor: 'rgba(255, 255, 255, 0.65)', backdropFilter: 'blur(8px)'
                    }}>
                        <div style={{ marginBottom: '12px', display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>School Year:</span>
                                <select
                                    value={selectedYearFilter}
                                    onChange={(e) => setSelectedYearFilter(e.target.value)}
                                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #dadce0', fontSize: '12px', outline: 'none', backgroundColor: 'white', cursor: 'pointer', fontWeight: '500', color: 'var(--fa-dark-blue)' }}
                                >
                                    <option value="All">All Years</option>
                                    {uniqueYears.map(yr => (
                                        <option key={yr} value={yr}>{yr}</option>
                                    ))}
                                </select>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Category:</span>
                                {['All', 'Maine Science', 'Maine Through Year', 'AP Testing', 'SAT', 'PSAT', 'Makeups'].map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setSavedChartFilter(cat)}
                                        style={{
                                            padding: '4px 8px', fontSize: '11px', borderRadius: '4px',
                                            border: '1px solid #dadce0', cursor: 'pointer',
                                            backgroundColor: savedChartFilter === cat ? 'var(--fa-blue)' : 'white',
                                            color: savedChartFilter === cat ? 'white' : '#5f6368',
                                            fontWeight: '500'
                                        }}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {Object.keys(groupedSavedCharts).sort().map(category => (
                            <div key={category} style={{ marginBottom: '16px' }}>
                                <div style={{
                                    fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase',
                                    color: 'var(--fa-dark-blue)', borderBottom: '1px solid var(--glass-border)',
                                    paddingBottom: '4px', marginBottom: '6px'
                                }}>
                                    {category} ({groupedSavedCharts[category].length})
                                </div>
                                {groupedSavedCharts[category].map(chart => (
                                    <div key={chart.id}
                                        onClick={() => { onLoadChartDirect(chart); setShowSavedCharts(false); }}
                                        style={{
                                            padding: '8px 12px', borderBottom: '1px solid #eee',
                                            display: 'flex', justifyContent: 'space-between', fontSize: '13px',
                                            backgroundColor: 'white', alignItems: 'center', borderRadius: '4px',
                                            cursor: 'pointer', transition: 'background 0.2s', marginBottom: '4px'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                    >
                                        <div>
                                            <span style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>
                                                {chart.apSubject || chart.roomId}
                                            </span>
                                            {chart.apSubject && <span style={{ color: 'var(--fa-warm-gray)' }}> - {chart.roomId}</span>}
                                            <div style={{ color: '#666', fontSize: '11px', marginTop: '2px' }}>
                                                📅 {chart.date} {chart.session && chart.session !== 'All Day' ? `(${chart.session})` : ''} • {chart.studentCount} students
                                            </div>
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteSavedChart(e, chart)}
                                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px' }}
                                            title="Delete Saved Chart"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ))}

                        {Object.keys(groupedSavedCharts).length === 0 && (
                            <div style={{ padding: '16px', color: '#888', textAlign: 'center', fontSize: '12px' }}>No saved charts match the filter.</div>
                        )}
                    </div>
                )}

            {/* Selector Grid */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                
                {/* Test Type Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Test Type</label>
                    <select
                        value={selectedTest}
                        onChange={(e) => { setSelectedTest(e.target.value); setProctor(''); setMonitor(''); }}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dadce0', minWidth: '150px', outline: 'none' }}
                    >
                        <option value="Maine Science">Maine Science</option>
                        <option value="Maine Through Year">Maine Through Year</option>
                        <option value="AP Testing">AP Testing</option>
                        <option value="SAT">SAT</option>
                        <option value="PSAT">PSAT</option>
                        <option value="Makeups">Makeups (from tracker)</option>
                    </select>
                </div>

                {/* Optional AP Subject selection */}
                {selectedTest === 'AP Testing' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>AP Subject</label>
                        <select
                            value={selectedApSubject}
                            onChange={(e) => setSelectedApSubject(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dadce0', minWidth: '180px', outline: 'none' }}
                        >
                            <option value="">All Subjects...</option>
                            {apSubjects.map(sub => (
                                <option key={sub} value={sub}>{sub}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Date Picker */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Exam Date</label>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => { setSelectedDate(e.target.value); setProctor(''); setMonitor(''); }}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                    />
                </div>

                {/* Session Select */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Session</label>
                    <select
                        value={selectedSession}
                        onChange={(e) => { setSelectedSession(e.target.value); setProctor(''); setMonitor(''); }}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dadce0', outline: 'none' }}
                    >
                        <option value="All Day">All Day</option>
                        <option value="Morning">Morning (AM)</option>
                        <option value="Afternoon">Afternoon (PM)</option>
                    </select>
                </div>

                {/* Room Layouts Dropdown */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Testing Room</label>
                    <select
                        value={selectedRoomId}
                        onChange={(e) => { setSelectedRoomId(e.target.value); setProctor(''); setMonitor(''); }}
                        style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dadce0', minWidth: '150px', outline: 'none' }}
                    >
                        <option value="">Select a Room...</option>
                        {Object.keys(roomLayouts).filter(k => k !== 'updatedAt').sort().map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                    </select>
                </div>

                {/* Proctors and Staff Section */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Proctor</label>
                        <input
                            list="controls-staff-list"
                            type="text"
                            placeholder="Proctor Name"
                            value={proctor}
                            onChange={(e) => setProctor(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dadce0', width: '130px', outline: 'none' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>Monitor</label>
                        <input
                            list="controls-staff-list"
                            type="text"
                            placeholder="Monitor Name"
                            value={monitor}
                            onChange={(e) => setMonitor(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #dadce0', width: '130px', outline: 'none' }}
                        />
                    </div>
                    <button
                        onClick={onManageStaffTrigger}
                        title="Manage Staff Registry"
                        style={{
                            padding: '8px', height: '37px', backgroundColor: '#f1f3f4',
                            border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '16px'
                        }}
                    >
                        ⚙️
                    </button>

                    <datalist id="controls-staff-list">
                        {staffList.map((staff, idx) => <option key={idx} value={staff.name} />)}
                    </datalist>
                </div>
            </div>

            {/* Action Bar */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderTop: '1px solid var(--glass-border)', paddingTop: '16px', marginTop: '4px' }}>
                
                {/* Dynamic Capacity Meter */}
                {currentRoomLayout && (() => {
                    const grid = currentRoomLayout.grid || [];
                    let totalCapacity = 0;
                    grid.forEach(cell => {
                        if (cell === 'desk') totalCapacity += 1;
                        else if (cell === 'table') totalCapacity += 2;
                    });
                    const assignedCount = Object.keys(assignedSeats).length;
                    const percent = totalCapacity > 0 ? Math.min(100, Math.round((assignedCount / totalCapacity) * 100)) : 0;
                    const meterColor = percent > 90 ? 'var(--fa-red)' : percent > 75 ? 'var(--fa-gold)' : 'var(--fa-green)';

                    return (
                        <div style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <div style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)' }}>
                                    ROOM CAPACITY: <span style={{ color: 'var(--fa-dark-blue)' }}>{assignedCount} / {totalCapacity} seats filled</span>
                                </div>
                                <div style={{ width: '150px', height: '6px', backgroundColor: '#e4e7eb', borderRadius: '3px', overflow: 'hidden', marginTop: '4px' }}>
                                    <div style={{ width: `${percent}%`, height: '100%', backgroundColor: meterColor, transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)' }} />
                                </div>
                            </div>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: meterColor }}>{percent}%</span>
                        </div>
                    );
                })()}

                <button
                    onClick={onClearRoom}
                    disabled={!currentRoomLayout || Object.keys(assignedSeats).length === 0}
                    style={{
                        padding: '8px 16px', backgroundColor: '#fce8e6', color: '#c5221f',
                        border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
                        transition: 'opacity 0.2s', opacity: (!currentRoomLayout || Object.keys(assignedSeats).length === 0) ? 0.5 : 1
                    }}
                >
                    ❌ Clear Room
                </button>
                <button
                    onClick={onAutoFill}
                    disabled={!currentRoomLayout || filteredStudents.length === 0}
                    style={{
                        padding: '8px 16px', backgroundColor: 'rgba(0, 70, 139, 0.08)', color: 'var(--fa-blue)',
                        border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
                        transition: 'opacity 0.2s', opacity: (!currentRoomLayout || filteredStudents.length === 0) ? 0.5 : 1
                    }}
                >
                    ✨ Auto-Fill
                </button>
                <button
                    onClick={onSave}
                    disabled={saving || !currentRoomLayout}
                    style={{
                        padding: '8px 16px', backgroundColor: '#e6f4ea', color: '#137333',
                        border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
                        transition: 'opacity 0.2s', opacity: (saving || !currentRoomLayout) ? 0.5 : 1
                    }}
                >
                    {saving ? 'Saving...' : '💾 Save & Assign'}
                </button>
                <button
                    onClick={onCopyEmails}
                    disabled={Object.keys(assignedSeats).length === 0}
                    style={{
                        padding: '8px 16px', backgroundColor: 'white', color: 'var(--fa-blue)',
                        border: '1px solid var(--fa-blue)', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer',
                        transition: 'opacity 0.2s', opacity: Object.keys(assignedSeats).length === 0 ? 0.5 : 1
                    }}
                >
                    📋 Copy Emails
                </button>
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: '8px 16px', backgroundColor: '#f1f3f4', color: 'var(--fa-warm-gray)',
                        border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer'
                    }}
                >
                    🖨️ Print Layout
                </button>
            </div>

        </div>
    );
};

export default SeatingChartControls;

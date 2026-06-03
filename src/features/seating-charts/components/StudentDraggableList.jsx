import React, { useState } from 'react';

const StudentDraggableList = ({
    filteredStudents,
    assignedSeats,
    allMasterStudents,
    selectedRoomId,
    selectedTest,
    onDragStart,
    onDragOver,
    onDropList,
    onAddGuestStudent
}) => {
    const [studentSearchTerm, setStudentSearchTerm] = useState('');
    const [showAccommodationsOnly, setShowAccommodationsOnly] = useState(false);

    // Compute unassigned count & apply quick filter
    const unassignedStudents = filteredStudents.filter(
        s => {
            const isUnassigned = !Object.values(assignedSeats).some(as => as.id === s.id);
            if (showAccommodationsOnly) {
                return isUnassigned && s.hasAccommodations;
            }
            return isUnassigned;
        }
    );

    const handleAddGuestClick = (student) => {
        onAddGuestStudent(student);
        setStudentSearchTerm('');
    };

    return (
        <div
            className="glass-panel no-print"
            style={{
                width: '260px', minWidth: '260px', padding: '16px',
                maxHeight: '75vh', overflowY: 'auto', display: 'flex',
                flexDirection: 'column', gap: '12px'
            }}
            onDragOver={onDragOver}
            onDrop={onDropList}
        >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>
                    Available Students ({unassignedStudents.length})
                </h3>
            </div>
            
            {/* Quick Filter Toggle for Accommodations */}
            <button
                onClick={() => setShowAccommodationsOnly(!showAccommodationsOnly)}
                style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1.5px solid var(--fa-gold)',
                    backgroundColor: showAccommodationsOnly ? 'rgba(234, 176, 16, 0.15)' : 'white',
                    color: 'var(--fa-dark-blue)',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    transition: 'all 0.2s',
                    boxShadow: showAccommodationsOnly ? 'inset 0 2px 4px rgba(0,0,0,0.05)' : 'none'
                }}
            >
                ⚡ {showAccommodationsOnly ? "Showing Accommodations Only" : "Show Accommodations Only"}
            </button>

            {/* Guest Student Search Autocomplete */}
            <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                        type="text"
                        placeholder="🔍 Find Guest Student..."
                        value={studentSearchTerm}
                        onChange={(e) => setStudentSearchTerm(e.target.value)}
                        style={{
                            flex: 1, padding: '8px 10px', fontSize: '12px',
                            border: '1px solid #dadce0', borderRadius: '6px', outline: 'none'
                        }}
                    />
                    {studentSearchTerm && (
                        <button
                            onClick={() => setStudentSearchTerm('')}
                            style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '13px' }}
                        >
                            ✕
                        </button>
                    )}
                </div>

                {studentSearchTerm && (
                    <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0,
                        backgroundColor: 'white', border: '1px solid #dadce0',
                        borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        zIndex: 10, marginTop: '4px', maxHeight: '250px', overflowY: 'auto'
                    }}>
                        {allMasterStudents
                            .filter(s => {
                                const name = `${s.firstName} ${s.lastName}`.toLowerCase();
                                const term = studentSearchTerm.toLowerCase();
                                return name.includes(term) && !filteredStudents.some(cur => cur.id === s.id);
                            })
                            .slice(0, 8)
                            .map(s => (
                                <div
                                    key={s.id}
                                    onClick={() => handleAddGuestClick(s)}
                                    style={{
                                        padding: '8px 12px', fontSize: '12px', cursor: 'pointer',
                                        borderBottom: '1px solid #eee', transition: 'background 0.2s'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                                >
                                    <div style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{s.lastName}, {s.firstName}</div>
                                    <div style={{ fontSize: '10px', color: 'var(--fa-warm-gray)' }}>Grade: {s.grade}</div>
                                </div>
                            ))}
                        {allMasterStudents.filter(s => {
                            const name = `${s.firstName} ${s.lastName}`.toLowerCase();
                            const term = studentSearchTerm.toLowerCase();
                            return name.includes(term) && !filteredStudents.some(cur => cur.id === s.id);
                        }).length === 0 && (
                            <div style={{ padding: '12px', fontSize: '11px', color: '#888', textAlign: 'center' }}>
                                No matching unlisted students.
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* List of cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                {unassignedStudents.map(student => {
                    const isAssignedElsewhere = student.assignedRoom && student.assignedRoom !== selectedRoomId;

                    return (
                        <div
                            key={student.id}
                            draggable
                            onDragStart={(e) => onDragStart(e, student)}
                            style={{
                                padding: '10px',
                                backgroundColor: student.hasAccommodations ? 'rgba(234, 176, 16, 0.08)' : 'white',
                                border: student.hasAccommodations ? '1.5px solid var(--fa-gold)' : '1px solid #dadce0',
                                borderRadius: '8px',
                                cursor: 'grab',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                transition: 'transform 0.15s, box-shadow 0.15s',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}
                            onDragEnd={(e) => e.target.style.opacity = '1'}
                            onDrag={(e) => e.target.style.opacity = '0.5'}
                        >
                            <div style={{ width: '100%' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '13px', color: 'var(--fa-dark-blue)' }}>
                                    {student.lastName}, {student.firstName}
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>
                                    {student.grade ? `Grade ${student.grade}` : ''}
                                </div>
                                
                                {student.hasAccommodations && (
                                    <div style={{
                                        fontSize: '10px', color: 'var(--fa-red)', fontStyle: 'italic',
                                        marginTop: '4px', borderTop: '1.5px solid rgba(234, 176, 16, 0.25)',
                                        paddingTop: '4px', lineHeight: '1.2'
                                    }}>
                                        ⚠️ {student.accommodations}
                                    </div>
                                )}

                                {isAssignedElsewhere && (
                                    <div style={{
                                        fontSize: '10px', color: 'var(--fa-red)', fontWeight: 'bold',
                                        marginTop: '6px', backgroundColor: 'rgba(158,36,50,0.06)',
                                        padding: '3px 6px', borderRadius: '4px', display: 'inline-block'
                                    }}>
                                        📍 Room: {student.assignedRoom}
                                    </div>
                                )}
                            </div>
                            
                            {student.hasAccommodations && (
                                <span title={student.accommodations} style={{ fontSize: '14px', marginLeft: '6px' }}>⚡</span>
                            )}
                        </div>
                    );
                })}

                {filteredStudents.length === 0 && (
                    <div style={{ padding: '24px', color: '#888', textAlign: 'center', fontSize: '12px' }}>
                        No students match active filters.
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentDraggableList;

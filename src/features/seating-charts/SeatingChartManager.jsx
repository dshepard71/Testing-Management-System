import React, { useState } from 'react';
import { useSeatingChartData } from './hooks/useSeatingChartData';
import SeatingChartControls from './components/SeatingChartControls';
import StaffManagementModal from './components/StaffManagementModal';
import StudentDraggableList from './components/StudentDraggableList';
import RoomSeatingGrid from './components/RoomSeatingGrid';

const SeatingChartManager = ({ initialChart = null }) => {
    const data = useSeatingChartData(initialChart);
    const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);

    // ------------------------------------
    // Drag & Drop Handlers
    // ------------------------------------
    const handleDragStart = (e, student, sourceSeatId = null) => {
        data.setDraggedStudent({ ...student, sourceSeatId });
        e.dataTransfer.setData('text/plain', JSON.stringify(student));
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDropSeat = (e, targetSeatId, seatType, specificSlotIndex = null) => {
        e.preventDefault();
        const dragged = data.draggedStudent;
        if (!dragged || !data.currentRoomLayout) return;
        if (['blocked', 'empty', 'teacher'].includes(seatType)) return;

        let finalSeatKey = `${targetSeatId}-0`;

        if (seatType === 'table') {
            if (specificSlotIndex !== null) {
                finalSeatKey = `${targetSeatId}-${specificSlotIndex}`;
            } else {
                // Default table slot allocation
                if (data.assignedSeats[`${targetSeatId}-0`]) {
                    finalSeatKey = `${targetSeatId}-1`;
                }
            }
        }

        const newAssignments = { ...data.assignedSeats };

        // Clean from previous assigned seat if swapping
        if (dragged.sourceSeatId) {
            delete newAssignments[dragged.sourceSeatId];
        }

        // Apply new seat assignment
        newAssignments[finalSeatKey] = dragged;
        data.setAssignedSeats(newAssignments);
        data.setDraggedStudent(null);
    };

    const handleDropList = (e) => {
        e.preventDefault();
        const dragged = data.draggedStudent;
        if (!dragged || !dragged.sourceSeatId) return;

        // Unassign and return student to sidebar
        const newAssignments = { ...data.assignedSeats };
        delete newAssignments[dragged.sourceSeatId];
        data.setAssignedSeats(newAssignments);
        data.setDraggedStudent(null);
    };

    const handleAddGuestStudent = (student) => {
        const guest = {
            id: student.id,
            name: `${student.firstName || ''} ${student.lastName || ''}`.trim(),
            firstName: student.firstName || '',
            lastName: student.lastName || '',
            email: student.email || '',
            grade: student.grade || '',
            test: data.selectedApSubject || data.selectedTest,
            assignedRoom: null,
            assignedDate: '',
            accommodations: student.accommodations || '',
            hasAccommodations: !!(student.accommodations && student.accommodations.toLowerCase() !== 'none'),
            isGuest: true
        };
        
        // Push guest student into active memory
        data.setAssignedSeats(prev => {
            return prev; // Guest is available in lists
        });

        // Add guest student to list
        const updatedList = [...data.currentTestStudents, guest];
        data.handleLoadChartDirect({
            testType: data.selectedTest,
            apSubject: data.selectedApSubject,
            roomId: data.selectedRoomId,
            date: data.selectedDate,
            session: data.selectedSession,
            proctor: data.proctor,
            monitor: data.monitor,
            assignedSeats: data.assignedSeats
        });
    };

    if (data.loading) {
        return (
            <div className="glass-panel" style={{ padding: '48px', textAlign: 'center', fontFamily: 'Myriad Pro, sans-serif' }}>
                Loading Room Configuration and Student Lists...
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
            
            {/* Inject CSS styling for standard physical prints */}
            <style>
                {`
                    @media print {
                        body * { visibility: hidden !important; }
                        .print-only, .print-only * { visibility: visible !important; display: block !important; }
                        .print-seating-grid-canvas, .print-seating-grid-canvas * { visibility: visible !important; }
                        .print-seating-grid-canvas { 
                            position: absolute !important; 
                            left: 0 !important; 
                            top: 0 !important; 
                            width: 100% !important; 
                            padding: 0 !important; 
                            margin: 0 !important;
                            border: none !important;
                            box-shadow: none !important;
                        }
                        .no-print { display: none !important; }
                    }
                    .print-only { display: none; }
                `}
            </style>

            {/* Print Only Header details */}
            <div className="print-only" style={{ marginBottom: '24px', textAlign: 'center', borderBottom: '1.5px solid #000', paddingBottom: '12px' }}>
                <h1 style={{ fontSize: '26px', margin: '0 0 6px 0', fontFamily: 'Adobe Garamond Pro, serif', color: 'var(--fa-dark-blue)' }}>
                    {data.selectedApSubject || data.selectedTest}
                </h1>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', fontSize: '15px', fontWeight: 'bold' }}>
                    <span>Room: {data.selectedRoomId}</span>
                    <span>Date: {data.selectedDate}</span>
                    <span>Session: {data.selectedSession}</span>
                </div>
                {(data.proctor || data.monitor) && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '36px', fontSize: '13px', marginTop: '6px', color: '#555' }}>
                        {data.proctor && <span>Proctor: {data.proctor}</span>}
                        {data.monitor && <span>Monitor: {data.monitor}</span>}
                    </div>
                )}
            </div>

            {/* Main title */}
            <div className="no-print" style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '600' }}>Seating Chart Manager</h2>
            </div>

            {/* Controller Panel */}
            <SeatingChartControls
                {...data}
                onAutoFill={data.handleAutoFill}
                onSave={data.handleSave}
                onClearRoom={data.handleClearRoom}
                onCopyEmails={data.handleCopyEmails}
                onLoadChartDirect={data.handleLoadChartDirect}
                onManageStaffTrigger={() => setIsStaffModalOpen(true)}
                currentRoomLayout={data.currentRoomLayout}
            />

            {/* Canvas Flex row */}
            <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
                
                {/* Available Student Sidebar */}
                <StudentDraggableList
                    filteredStudents={data.filteredStudents}
                    assignedSeats={data.assignedSeats}
                    allMasterStudents={data.allMasterStudents}
                    selectedRoomId={data.selectedRoomId}
                    selectedTest={data.selectedTest}
                    onDragStart={handleDragStart}
                    onDragOver={handleDragOver}
                    onDropList={handleDropList}
                    onAddGuestStudent={handleAddGuestStudent}
                />

                {/* 2D Interactive Seating Canvas */}
                <div className="print-seating-grid-canvas" style={{ flex: 1 }}>
                    <RoomSeatingGrid
                        currentRoomLayout={data.currentRoomLayout}
                        assignedSeats={data.assignedSeats}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDropSeat={handleDropSeat}
                    />
                </div>
            </div>

            {/* Staff Registry Modal popup */}
            <StaffManagementModal
                isOpen={isStaffModalOpen}
                onClose={() => setIsStaffModalOpen(false)}
                staffList={data.staffList}
                onAddStaff={data.handleAddStaff}
                onUpdateStaff={data.handleUpdateStaff}
                onDeleteStaff={data.handleDeleteStaff}
            />

        </div>
    );
};

export default SeatingChartManager;

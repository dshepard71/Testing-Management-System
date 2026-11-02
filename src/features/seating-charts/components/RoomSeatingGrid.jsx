import React from 'react';

const RoomSeatingGrid = ({
    currentRoomLayout,
    assignedSeats,
    onDragStart,
    onDragOver,
    onDropSeat,
    hideAccommodations = false
}) => {

    const getCellColor = (type) => {
        switch (type) {
            case 'desk': return '#ffffff';
            case 'table': return 'rgba(0, 70, 139, 0.04)'; // Light blue tint
            case 'pod': return 'rgba(142, 36, 170, 0.03)'; // Pod container
            case 'teacher': return 'rgba(109, 196, 188, 0.15)'; // Mint tint
            case 'blocked': return '#e4e7eb';
            case 'empty': return 'transparent';
            default: return '#ffffff';
        }
    };

    const getCellBorder = (type) => {
        if (type === 'empty') return 'none';
        if (type === 'teacher') return '1.5px solid var(--fa-mint)';
        if (type === 'table') return '1.5px dashed var(--fa-blue)';
        if (type === 'pod') return '1.5px solid rgba(142, 36, 170, 0.4)';
        if (type === 'blocked') return '1px solid #c4c7cc';
        return '1px solid #dadce0';
    };

    const getGrid2D = () => {
        if (!currentRoomLayout) return [];
        const { rows, cols } = currentRoomLayout;
        let grid = currentRoomLayout.grid;
        
        if (typeof grid === 'string') {
            try { grid = JSON.parse(grid); } catch (e) { grid = null; }
        }

        const rRows = parseInt(rows, 10) || 0;
        const rCols = parseInt(cols, 10) || 0;

        if (Array.isArray(grid)) {
            // Flat 1D array
            if (grid.length === rRows * rCols && rRows > 0 && rCols > 0) {
                const reconstructed = [];
                for (let i = 0; i < rRows; i++) {
                    const row = [];
                    for (let j = 0; j < rCols; j++) {
                        row.push(grid[i * rCols + j]);
                    }
                    reconstructed.push(row);
                }
                return reconstructed;
            }
            // Already 2D array
            if (grid.length > 0 && Array.isArray(grid[0])) {
                return grid;
            }
        }
        return [];
    };

    if (!currentRoomLayout) {
        return (
            <div style={{
                flex: 1, padding: '48px', textAlign: 'center', color: 'var(--fa-warm-gray)',
                border: '1.5px dashed var(--glass-border)', borderRadius: '12px',
                display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '350px'
            }}>
                <span style={{ fontSize: '32px', marginBottom: '12px' }}>🏫</span>
                <div style={{ fontWeight: 'bold', fontSize: '15px' }}>No Testing Room Selected</div>
                <div style={{ fontSize: '12px', marginTop: '6px' }}>Choose a room from the dropdown to load and edit its seating configuration.</div>
            </div>
        );
    }

    const grid2D = getGrid2D();
    
    // Check if this layout contains any pods to size cells comfortably
    const hasAnyPods = Array.isArray(grid2D) && grid2D.some(row => Array.isArray(row) && row.includes('pod'));
    const cellSize = hasAnyPods ? '140px' : '80px';

    // Track Pod numbering across the room sequentially
    let podCounter = 0;

    return (
        <div className="glass-panel" style={{ flex: 1, padding: '32px', overflowX: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{
                marginBottom: '20px', fontWeight: 'bold', color: 'var(--fa-warm-gray)',
                textTransform: 'uppercase', letterSpacing: '1px', fontSize: '12px',
                borderBottom: '2px solid var(--fa-warm-gray)', paddingBottom: '4px'
            }}>
                Front of Room / Whiteboard
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${currentRoomLayout.cols}, ${cellSize})`,
                gap: '12px',
                padding: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.45)',
                borderRadius: '12px',
                border: '1.5px dashed var(--glass-border)'
            }}>
                {Array.isArray(grid2D) && grid2D.map((row, rIndex) => (
                    Array.isArray(row) ? row.map((cellType, cIndex) => {
                        const seatId = `${rIndex}-${cIndex}`;
                        
                        if (cellType === 'pod') {
                            podCounter += 1;
                            const thisPodNum = podCounter;

                            // Render seat slot helper for Pods
                            const renderPodSeat = (slotIndex, label) => {
                                const s = assignedSeats[`${seatId}-${slotIndex}`];
                                const showAcc = !hideAccommodations && s?.hasAccommodations;

                                return (
                                    <div
                                        key={slotIndex}
                                        onDragOver={onDragOver}
                                        onDrop={(e) => { e.stopPropagation(); onDropSeat(e, seatId, 'pod', slotIndex); }}
                                        style={{
                                            flex: 1, height: '22px', backgroundColor: s ? (showAcc ? 'rgba(234, 176, 16, 0.15)' : '#ffffff') : '#f8f9fa',
                                            border: s ? (showAcc ? '1px solid var(--fa-gold)' : '1px solid var(--fa-blue)') : '1px dashed #ced4da',
                                            borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            padding: '1px 2px', fontSize: '8px', cursor: s ? 'grab' : 'pointer', overflow: 'hidden',
                                            boxShadow: s ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'
                                        }}
                                        draggable={!!s}
                                        onDragStart={(e) => { if (s) { e.stopPropagation(); onDragStart(e, s, `${seatId}-${slotIndex}`); } }}
                                        title={s ? `${s.lastName}, ${s.firstName} (${s.grade || 'N/A'})${showAcc ? ' - ' + s.accommodations : ''}` : `Empty Seat (${label})`}
                                    >
                                        {s ? (
                                            <span style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {s.lastName} {showAcc ? '⚡' : ''}
                                            </span>
                                        ) : (
                                            <span style={{ color: '#adb5bd', fontSize: '7px' }}>{label}</span>
                                        )}
                                    </div>
                                );
                            };

                            return (
                                <div
                                    key={seatId}
                                    style={{
                                        width: cellSize, height: cellSize,
                                        backgroundColor: '#ffffff',
                                        border: '1.5px solid rgba(142, 36, 170, 0.35)',
                                        borderRadius: '10px',
                                        padding: '4px',
                                        boxSizing: 'border-box',
                                        display: 'flex', flexDirection: 'column',
                                        justifyContent: 'space-between',
                                        boxShadow: '0 2px 8px rgba(142, 36, 170, 0.08)',
                                        position: 'relative'
                                    }}
                                    onDragOver={onDragOver}
                                    onDrop={(e) => onDropSeat(e, seatId, 'pod')}
                                >
                                    {/* TOP SIDE: 2 Seats (Seat 0 & Seat 1) */}
                                    <div style={{ display: 'flex', gap: '3px', width: '100%' }}>
                                        {renderPodSeat(0, 'Top 1')}
                                        {renderPodSeat(1, 'Top 2')}
                                    </div>

                                    {/* MIDDLE ROW: Left 2 Seats, 2 Joined Tables (Rotated Horizontally), Right 2 Seats */}
                                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flex: 1, margin: '2px 0' }}>
                                        {/* Left Side: 2 Seats stacked (Seat 2 & Seat 3) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '38px', height: '100%', justifyContent: 'center' }}>
                                            {renderPodSeat(2, 'L 1')}
                                            {renderPodSeat(3, 'L 2')}
                                        </div>

                                        {/* Center: 2 HORIZONTAL TABLES PUSHED TOGETHER (seam in middle) */}
                                        <div style={{
                                            flex: 1, height: '100%',
                                            display: 'flex', flexDirection: 'column',
                                            borderRadius: '6px',
                                            overflow: 'hidden',
                                            border: '1.5px solid #8e24aa',
                                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)'
                                        }}>
                                            {/* Table 1 (Top Table) */}
                                            <div style={{
                                                flex: 1, backgroundColor: 'rgba(142, 36, 170, 0.12)',
                                                borderBottom: '1px dashed #8e24aa',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '7px', fontWeight: 'bold', color: '#6a1b9a', textTransform: 'uppercase'
                                            }}>
                                                TABLE A
                                            </div>
                                            {/* Table 2 (Bottom Table) */}
                                            <div style={{
                                                flex: 1, backgroundColor: 'rgba(142, 36, 170, 0.12)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '7px', fontWeight: 'bold', color: '#6a1b9a', textTransform: 'uppercase'
                                            }}>
                                                TABLE B
                                            </div>
                                            {/* Pod Label Floating Badge */}
                                            <div style={{
                                                position: 'absolute', top: '50%', left: '50%',
                                                transform: 'translate(-50%, -50%)',
                                                backgroundColor: '#8e24aa', color: 'white',
                                                padding: '1px 6px', borderRadius: '8px',
                                                fontSize: '8px', fontWeight: 'bold',
                                                boxShadow: '0 1px 3px rgba(0,0,0,0.2)', pointerEvents: 'none'
                                            }}>
                                                POD {thisPodNum}
                                            </div>
                                        </div>

                                        {/* Right Side: 2 Seats stacked (Seat 4 & Seat 5) */}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', width: '38px', height: '100%', justifyContent: 'center' }}>
                                            {renderPodSeat(4, 'R 1')}
                                            {renderPodSeat(5, 'R 2')}
                                        </div>
                                    </div>

                                    {/* BOTTOM SIDE: 2 Seats (Seat 6 & Seat 7) */}
                                    <div style={{ display: 'flex', gap: '3px', width: '100%' }}>
                                        {renderPodSeat(6, 'Btm 1')}
                                        {renderPodSeat(7, 'Btm 2')}
                                    </div>
                                </div>
                            );
                        }

                        // STANDARD DESK / TABLE / TEACHER / BLOCKED CELLS
                        const s0 = assignedSeats[`${seatId}-0`];
                        const s1 = assignedSeats[`${seatId}-1`];
                        const hasAccStudent = !hideAccommodations && ((s0 && s0.hasAccommodations) || (s1 && s1.hasAccommodations));

                        const borderStyle = hasAccStudent 
                            ? '1.5px solid var(--fa-gold)' 
                            : getCellBorder(cellType);

                        const shadowStyle = hasAccStudent 
                            ? '0 0 10px rgba(234, 176, 16, 0.45)' 
                            : ((cellType === 'desk' || cellType === 'table') ? '0 2px 4px rgba(0,0,0,0.03)' : 'none');

                        return (
                            <div
                                key={seatId}
                                style={{
                                    width: cellSize, height: cellSize,
                                    backgroundColor: getCellColor(cellType),
                                    border: borderStyle,
                                    borderRadius: '8px',
                                    display: 'flex',
                                    flexDirection: cellType === 'table' ? 'row' : 'column',
                                    justifyContent: 'center', alignItems: 'center',
                                    fontSize: '10px', textAlign: 'center',
                                    position: 'relative',
                                    boxShadow: shadowStyle,
                                    overflow: 'hidden'
                                }}
                                onDragOver={onDragOver}
                                onDrop={(e) => onDropSeat(e, seatId, cellType)}
                            >
                                {cellType === 'teacher' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'center' }}>
                                        <span style={{ fontSize: '20px' }}>👩‍🏫</span>
                                        <span style={{ fontSize: '9px', fontWeight: 'bold', color: 'var(--fa-mint)' }}>PROCTOR</span>
                                    </div>
                                )}

                                {/* Blocked Space */}
                                {cellType === 'blocked' && (
                                    <span style={{ color: '#888', fontWeight: 'bold', fontSize: '8px' }}>BLOCKED</span>
                                )}

                                {/* SINGLE DESK */}
                                {cellType === 'desk' && (() => {
                                    const s = assignedSeats[`${seatId}-0`];
                                    const showAcc = !hideAccommodations && s?.hasAccommodations;

                                    return s ? (
                                        <div
                                            draggable
                                            onDragStart={(e) => onDragStart(e, s, `${seatId}-0`)}
                                            style={{
                                                padding: '4px', lineHeight: '1.2', width: '100%', height: '100%',
                                                cursor: 'grab', display: 'flex', flexDirection: 'column',
                                                justifyContent: 'center', wordBreak: 'break-word',
                                                backgroundColor: showAcc ? 'rgba(234, 176, 16, 0.08)' : 'transparent'
                                            }}
                                        >
                                            <div style={{ fontWeight: 'bold', color: 'var(--fa-blue)', fontSize: '11px' }}>{s.lastName}</div>
                                            <div style={{ color: 'var(--fa-dark-blue)', fontSize: '10px' }}>{s.firstName}</div>
                                            {showAcc && (
                                                <div
                                                    title={s.accommodations}
                                                    style={{
                                                        fontSize: '8px', color: 'var(--fa-red)', fontStyle: 'italic',
                                                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '2px'
                                                    }}
                                                >
                                                    ⚡ {s.accommodations}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span style={{ color: '#dadce0', fontSize: '18px' }}>🪑</span>
                                    );
                                })()}

                                {/* DUAL TABLE */}
                                {cellType === 'table' && (
                                    <>
                                        {/* Left/Top Slot 0 */}
                                        <div
                                            style={{ flex: 1, height: '100%', borderRight: '1px solid #dee2e6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onDragOver={onDragOver}
                                            onDrop={(e) => { e.stopPropagation(); onDropSeat(e, seatId, 'table', 0); }}
                                        >
                                            {(() => {
                                                const s = assignedSeats[`${seatId}-0`];
                                                const showAcc = !hideAccommodations && s?.hasAccommodations;

                                                return s ? (
                                                    <div
                                                        draggable
                                                        onDragStart={(e) => { e.stopPropagation(); onDragStart(e, s, `${seatId}-0`); }}
                                                        style={{
                                                            fontSize: '9px', lineHeight: '1.1', fontWeight: 'bold',
                                                            color: 'var(--fa-blue)', overflow: 'hidden', cursor: 'grab',
                                                            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                                                            justifyContent: 'center', wordBreak: 'break-word',
                                                            backgroundColor: showAcc ? 'rgba(234, 176, 16, 0.08)' : 'transparent'
                                                        }}
                                                    >
                                                        <div>{s.lastName}</div>
                                                        <div style={{ fontSize: '8px', opacity: 0.85 }}>{s.firstName?.[0]}.</div>
                                                        {showAcc && <div style={{ fontSize: '7px', color: 'var(--fa-red)' }}>⚡</div>}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#dadce0', fontSize: '10px' }}>A</span>
                                                );
                                            })()}
                                        </div>

                                        {/* Right/Bottom Slot 1 */}
                                        <div
                                            style={{ flex: 1, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                            onDragOver={onDragOver}
                                            onDrop={(e) => { e.stopPropagation(); onDropSeat(e, seatId, 'table', 1); }}
                                        >
                                            {(() => {
                                                const s = assignedSeats[`${seatId}-1`];
                                                const showAcc = !hideAccommodations && s?.hasAccommodations;

                                                return s ? (
                                                    <div
                                                        draggable
                                                        onDragStart={(e) => { e.stopPropagation(); onDragStart(e, s, `${seatId}-1`); }}
                                                        style={{
                                                            fontSize: '9px', lineHeight: '1.1', fontWeight: 'bold',
                                                            color: 'var(--fa-blue)', overflow: 'hidden', cursor: 'grab',
                                                            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                                                            justifyContent: 'center', wordBreak: 'break-word',
                                                            backgroundColor: showAcc ? 'rgba(234, 176, 16, 0.08)' : 'transparent'
                                                        }}
                                                    >
                                                        <div>{s.lastName}</div>
                                                        <div style={{ fontSize: '8px', opacity: 0.85 }}>{s.firstName?.[0]}.</div>
                                                        {showAcc && <div style={{ fontSize: '7px', color: 'var(--fa-red)' }}>⚡</div>}
                                                    </div>
                                                ) : (
                                                    <span style={{ color: '#dadce0', fontSize: '10px' }}>B</span>
                                                );
                                            })()}
                                        </div>
                                    </>
                                )}

                            </div>
                        );
                    }) : null
                ))}
            </div>
        </div>
    );
};

export default RoomSeatingGrid;

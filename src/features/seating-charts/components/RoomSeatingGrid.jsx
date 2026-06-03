import React from 'react';

const RoomSeatingGrid = ({
    currentRoomLayout,
    assignedSeats,
    onDragStart,
    onDragOver,
    onDropSeat
}) => {

    const getCellColor = (type) => {
        switch (type) {
            case 'desk': return '#ffffff';
            case 'table': return 'rgba(0, 70, 139, 0.04)'; // Light blue tint
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
        if (type === 'blocked') return '1px solid #c4c7cc';
        return '1px solid #dadce0';
    };

    const getGrid2D = () => {
        if (!currentRoomLayout) return [];
        const { rows, cols, grid } = currentRoomLayout;
        if (Array.isArray(grid) && grid.length === rows * cols) {
            const reconstructed = [];
            for (let i = 0; i < rows; i++) {
                const row = [];
                for (let j = 0; j < cols; j++) {
                    row.push(grid[i * cols + j]);
                }
                reconstructed.push(row);
            }
            return reconstructed;
        }
        return grid || [];
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
                gridTemplateColumns: `repeat(${currentRoomLayout.cols}, 80px)`,
                gap: '10px',
                padding: '24px',
                backgroundColor: 'rgba(255, 255, 255, 0.45)',
                borderRadius: '12px',
                border: '1.5px dashed var(--glass-border)'
            }}>
                {grid2D.map((row, rIndex) => (
                    row.map((cellType, cIndex) => {
                        const seatId = `${rIndex}-${cIndex}`;
                        const s0 = assignedSeats[`${seatId}-0`];
                        const s1 = assignedSeats[`${seatId}-1`];
                        const hasAccStudent = (s0 && s0.hasAccommodations) || (s1 && s1.hasAccommodations);

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
                                    width: '80px', height: '80px',
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
                                    return s ? (
                                        <div
                                            draggable
                                            onDragStart={(e) => onDragStart(e, s, `${seatId}-0`)}
                                            style={{
                                                padding: '4px', lineHeight: '1.2', width: '100%', height: '100%',
                                                cursor: 'grab', display: 'flex', flexDirection: 'column',
                                                justifyContent: 'center', wordBreak: 'break-word',
                                                backgroundColor: s.hasAccommodations ? 'rgba(234, 176, 16, 0.08)' : 'transparent'
                                            }}
                                        >
                                            <div style={{ fontWeight: 'bold', color: 'var(--fa-blue)', fontSize: '11px' }}>{s.lastName}</div>
                                            <div style={{ color: 'var(--fa-dark-blue)', fontSize: '10px' }}>{s.firstName}</div>
                                            {s.hasAccommodations && (
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
                                                return s ? (
                                                    <div
                                                        draggable
                                                        onDragStart={(e) => { e.stopPropagation(); onDragStart(e, s, `${seatId}-0`); }}
                                                        style={{
                                                            fontSize: '9px', lineHeight: '1.1', fontWeight: 'bold',
                                                            color: 'var(--fa-blue)', overflow: 'hidden', cursor: 'grab',
                                                            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                                                            justifyContent: 'center', wordBreak: 'break-word',
                                                            backgroundColor: s.hasAccommodations ? 'rgba(234, 176, 16, 0.08)' : 'transparent'
                                                        }}
                                                    >
                                                        <div>{s.lastName}</div>
                                                        <div style={{ fontSize: '8px', opacity: 0.85 }}>{s.firstName?.[0]}.</div>
                                                        {s.hasAccommodations && <div style={{ fontSize: '7px', color: 'var(--fa-red)' }}>⚡</div>}
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
                                                return s ? (
                                                    <div
                                                        draggable
                                                        onDragStart={(e) => { e.stopPropagation(); onDragStart(e, s, `${seatId}-1`); }}
                                                        style={{
                                                            fontSize: '9px', lineHeight: '1.1', fontWeight: 'bold',
                                                            color: 'var(--fa-blue)', overflow: 'hidden', cursor: 'grab',
                                                            width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                                                            justifyContent: 'center', wordBreak: 'break-word',
                                                            backgroundColor: s.hasAccommodations ? 'rgba(234, 176, 16, 0.08)' : 'transparent'
                                                        }}
                                                    >
                                                        <div>{s.lastName}</div>
                                                        <div style={{ fontSize: '8px', opacity: 0.85 }}>{s.firstName?.[0]}.</div>
                                                        {s.hasAccommodations && <div style={{ fontSize: '7px', color: 'var(--fa-red)' }}>⚡</div>}
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
                    })
                ))}
            </div>
        </div>
    );
};

export default RoomSeatingGrid;

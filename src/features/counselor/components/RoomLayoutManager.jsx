import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { doc, onSnapshot, setDoc, updateDoc, deleteField, deleteDoc, serverTimestamp, collection, getDocs, writeBatch } from 'firebase/firestore';

export default function RoomLayoutManager() {
  const [layouts, setLayouts] = useState([]);
  const [selectedLayoutId, setSelectedLayoutId] = useState('new');
  
  // Editor State
  const [roomName, setRoomName] = useState('New Room');
  const [gridSize, setGridSize] = useState({ rows: 10, cols: 10 });
  const [gridData, setGridData] = useState([]);
  const [currentTool, setCurrentTool] = useState('seat');
  const [isPainting, setIsPainting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [statusMsg, setStatusMsg] = useState('');

  // Tools definition
  const tools = [
    { id: 'seat', icon: '🪑', label: 'Desk', color: 'rgba(0, 70, 139, 0.15)', border: 'var(--fa-blue)' },
    { id: 'table', icon: '🟦', label: 'Table (2)', color: 'rgba(52, 168, 83, 0.15)', border: '#34a853' },
    { id: 'pod', icon: '🟪', label: 'Pod (8)', color: 'rgba(142, 36, 170, 0.15)', border: '#8e24aa' },
    { id: 'empty', icon: '⬜', label: 'Empty', color: 'rgba(255, 255, 255, 0.4)', border: 'var(--glass-border)' },
    { id: 'door', icon: '🚪', label: 'Door', color: 'rgba(158, 36, 50, 0.15)', border: 'var(--fa-red)' },
    { id: 'teacher_desk', icon: '👨‍🏫', label: 'Teacher', color: 'rgba(156, 39, 176, 0.15)', border: '#9c27b0' }
  ];

  // Load layouts from Firestore
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'room_layouts'), (docSnap) => {
      if (docSnap.exists()) {
          const data = docSnap.data();
          const loaded = Object.keys(data).map(key => ({ id: key, roomName: key, ...data[key] }));
          setLayouts(loaded);
      } else {
          setLayouts([]);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error loading rooms:", error);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Initialize empty grid when size changes, ONLY if we aren't loading an existing room
  useEffect(() => {
    if (selectedLayoutId === 'new') {
        const newGrid = Array(gridSize.rows).fill(null).map(() => Array(gridSize.cols).fill('empty'));
        setGridData(newGrid);
    }
  }, [gridSize.rows, gridSize.cols, selectedLayoutId]);

  // Handle selecting a room to edit
  const handleSelectRoom = (id) => {
    setSelectedLayoutId(id);
    if (id === 'new') {
      setRoomName('New Room');
      setGridSize({ rows: 10, cols: 10 });
      // The useEffect above will handle generating the empty grid
    } else {
      const room = layouts.find(r => r.id === id);
      if (room) {
        const rName = room.roomName || room.id;
        const rRows = parseInt(room.rows) || 10;
        const rCols = parseInt(room.cols) || 10;

        setRoomName(rName);
        setGridSize({ rows: rRows, cols: rCols });
        
        // Reconstruct 2D grid from V1 flat array, or fallback to empty
        let parsedGrid = room.grid;
        if (typeof parsedGrid === 'string') {
            try { parsedGrid = JSON.parse(parsedGrid); } catch (e) { parsedGrid = null; }
        }
        
        if (Array.isArray(parsedGrid) && parsedGrid.length === (rRows * rCols)) {
            // It's a flat V1 grid, convert to 2D
            const reconstructedGrid = [];
            for (let i = 0; i < rRows; i++) {
                const row = [];
                for (let j = 0; j < rCols; j++) {
                    let cell = parsedGrid[i * rCols + j] || 'empty';
                    if (cell === 'desk') cell = 'seat';
                    if (cell === 'teacher') cell = 'teacher_desk';
                    if (cell === 'blocked') cell = 'door';
                    row.push(cell);
                }
                reconstructedGrid.push(row);
            }
            setGridData(reconstructedGrid);
        } else if (Array.isArray(parsedGrid) && parsedGrid.length === rRows && parsedGrid[0]?.length === rCols) {
            setGridData(parsedGrid);
        } else {
            // Generate empty grid if missing or size mismatch
            setGridData(Array(rRows).fill(null).map(() => Array(rCols).fill('empty')));
        }
      }
    }
  };

  // Resizes existing 2D grid preserving existing cells
  const handleGridResize = (newRows, newCols) => {
    const validRows = Math.max(1, Math.min(50, parseInt(newRows) || 1));
    const validCols = Math.max(1, Math.min(50, parseInt(newCols) || 1));
    
    setGridSize({ rows: validRows, cols: validCols });
    setGridData(prev => {
      const resized = [];
      for (let r = 0; r < validRows; r++) {
        const row = [];
        for (let c = 0; c < validCols; c++) {
          if (prev[r] && prev[r][c] !== undefined) {
            row.push(prev[r][c]);
          } else {
            row.push('empty');
          }
        }
        resized.push(row);
      }
      return resized;
    });
  };

  // Painting logic
  const handleMouseDown = (r, c) => {
    setIsPainting(true);
    updateCell(r, c);
  };

  const handleMouseEnter = (r, c) => {
    if (isPainting) updateCell(r, c);
  };

  const handleMouseUp = () => {
    setIsPainting(false);
  };

  const updateCell = (r, c) => {
    setGridData(prev => {
      if (!prev[r]) return prev;
      const newGrid = [...prev];
      newGrid[r] = [...newGrid[r]];
      newGrid[r][c] = currentTool;
      return newGrid;
    });
  };

  const handleSave = async () => {
    const trimmedName = roomName.trim();
    if (!trimmedName) {
      alert("Please provide a room name.");
      return;
    }
    
    setStatusMsg('Saving...');
    try {
      const roomRef = doc(db, 'settings', 'room_layouts');
      const isRename = selectedLayoutId !== 'new' && selectedLayoutId !== trimmedName;
        
      const payload = {
        [trimmedName]: {
          rows: gridSize.rows,
          cols: gridSize.cols,
          grid: gridData.flat().map(c => {
              if (c === 'seat') return 'desk';
              if (c === 'teacher_desk') return 'teacher';
              if (c === 'door') return 'blocked';
              return c;
          }), // Save as flat array mapped back to V1 terminology
          lastUpdated: serverTimestamp()
        }
      };

      if (isRename) {
        payload[selectedLayoutId] = deleteField();
      }

      await setDoc(roomRef, payload, { merge: true });

      // If renamed, migrate all saved seating charts referencing the old room name
      if (isRename) {
        try {
          const chartsSnap = await getDocs(collection(db, 'seating_charts'));
          for (const chartDoc of chartsSnap.docs) {
            const data = chartDoc.data();
            if (data.roomId === selectedLayoutId) {
              const oldChartId = chartDoc.id;
              // Generate new chart ID replacing old room name
              const newChartId = oldChartId.replace(
                `_${selectedLayoutId.replace(/\s+/g, '_')}_`,
                `_${trimmedName.replace(/\s+/g, '_')}_`
              );

              const updatedChartData = {
                ...data,
                roomId: trimmedName,
                lastUpdated: serverTimestamp()
              };

              // Write new chart doc
              await setDoc(doc(db, 'seating_charts', newChartId), updatedChartData);
              // Delete old chart doc if ID changed
              if (newChartId !== oldChartId) {
                await deleteDoc(doc(db, 'seating_charts', oldChartId));
              }

              // Update any students assigned to this room
              if (data.assignedSeats) {
                const studentIds = Object.values(data.assignedSeats).map(s => s.id).filter(Boolean);
                if (studentIds.length > 0) {
                  const studentBatch = writeBatch(db);
                  let collectionName = 'master_students';
                  if (data.testType === 'AP Testing') collectionName = 'ap_registrations';
                  else if (data.testType === 'SAT' || data.testType === 'PSAT') collectionName = 'sat_registrations';

                  studentIds.forEach(sId => {
                    const sRef = doc(db, collectionName, sId);
                    if (data.testType === 'Maine Science') {
                      studentBatch.update(sRef, { maine_science_room: trimmedName });
                    } else if (data.testType === 'Maine Through Year') {
                      studentBatch.update(sRef, { maine_ty_math_room: trimmedName, maine_ty_reading_room: trimmedName });
                    } else if (data.testType === 'Makeups') {
                      studentBatch.update(sRef, { makeupRoom: trimmedName });
                    } else {
                      studentBatch.update(sRef, { assignedRoom: trimmedName });
                    }
                  });
                  await studentBatch.commit();
                }
              }
            }
          }
        } catch (chartErr) {
          console.warn("Could not migrate seating charts for renamed room:", chartErr);
        }
      }
      
      setSelectedLayoutId(trimmedName);
      setStatusMsg('✅ Layout saved successfully!');
      setTimeout(() => setStatusMsg(''), 3000);
    } catch (error) {
      console.error("Error saving room:", error);
      setStatusMsg('❌ Error saving layout.');
      setTimeout(() => setStatusMsg(''), 3000);
    }
  };

  const handleDelete = async () => {
    if (selectedLayoutId === 'new') return;
    if (window.confirm(`Are you sure you want to delete ${roomName}?`)) {
      try {
        await updateDoc(doc(db, 'settings', 'room_layouts'), {
            [selectedLayoutId]: deleteField()
        });
        handleSelectRoom('new');
        setStatusMsg('🗑️ Layout deleted.');
        setTimeout(() => setStatusMsg(''), 3000);
      } catch (error) {
        console.error("Error deleting room:", error);
      }
    }
  };

  // Helper to get tool styling for rendering grid cells
  const getCellRendering = (cellType) => {
    const tool = tools.find(t => t.id === cellType) || tools.find(t => t.id === 'empty');
    return {
        icon: tool.icon,
        background: tool.color,
        borderColor: tool.border
    };
  };

  // Calculate capacities
  const flatData = gridData.flat();
  const deskCount = flatData.filter(c => c === 'seat').length;
  const tableCount = flatData.filter(c => c === 'table').length;
  const podCount = flatData.filter(c => c === 'pod').length;
  const totalCapacity = deskCount + (tableCount * 2) + (podCount * 8);

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>Loading room designer...</div>;

  return (
    <div style={{ padding: '8px 0', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '20px' }}>
        <div>
          <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '24px', fontWeight: 'bold' }}>🏫 Room Layout Designer</h2>
          <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)', fontSize: '14px' }}>
            Paint room dimensions and seat locations for automatic seating chart generation.
          </p>
        </div>
        
        {/* Load Room Dropdown */}
        <div className="glass-panel" style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255, 255, 255, 0.4)' }}>
            <span style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', fontSize: '13px' }}>Load Room:</span>
            <select 
                value={selectedLayoutId} 
                onChange={(e) => handleSelectRoom(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '13px', minWidth: '200px' }}
            >
                <option value="new">✨ Create New Room...</option>
                <optgroup label="Saved Layouts">
                    {layouts.length === 0 ? (
                        <option value="none" disabled>No saved rooms yet</option>
                    ) : (
                        layouts.map(l => (
                            <option key={l.id} value={l.id}>{l.roomName || l.id} ({l.rows || 10}x{l.cols || 10})</option>
                        ))
                    )}
                </optgroup>
            </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: '24px' }}>
        
        {/* Left Sidebar: Controls & Tools */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Room Settings */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--fa-dark-blue)' }}>Room Settings</h3>
                
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--fa-warm-gray)', marginBottom: '4px', fontWeight: 'bold' }}>Room Name</label>
                    <input 
                        type="text" 
                        value={roomName}
                        onChange={(e) => setRoomName(e.target.value)}
                        placeholder="e.g. Gym, Library..."
                        style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', boxSizing: 'border-box' }}
                    />
                </div>
                
                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--fa-warm-gray)', marginBottom: '4px', fontWeight: 'bold' }}>Rows</label>
                        <input 
                            type="number" 
                            min="1" max="50"
                            value={gridSize.rows}
                            onChange={(e) => handleGridResize(e.target.value, gridSize.cols)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                    <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '12px', color: 'var(--fa-warm-gray)', marginBottom: '4px', fontWeight: 'bold' }}>Columns</label>
                        <input 
                            type="number" 
                            min="1" max="50"
                            value={gridSize.cols}
                            onChange={(e) => handleGridResize(gridSize.rows, e.target.value)}
                            style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', boxSizing: 'border-box' }}
                        />
                    </div>
                </div>

                {/* Capacity Stats */}
                <div style={{ padding: '12px', backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px dashed var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--fa-warm-gray)' }}>Desks (1 seat):</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{deskCount}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '4px' }}>
                        <span style={{ color: 'var(--fa-warm-gray)' }}>Tables (2 seats):</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{tableCount}</span>
                    </div>
                    {podCount > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '8px' }}>
                            <span style={{ color: '#8e24aa' }}>Pods (8 seats):</span>
                            <span style={{ fontWeight: 'bold', color: '#8e24aa' }}>{podCount} ({podCount * 8} seats)</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', paddingTop: '8px', borderTop: '1px solid var(--glass-border)' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>Total Capacity:</span>
                        <span style={{ fontWeight: 'bold', color: 'var(--fa-blue)' }}>{totalCapacity}</span>
                    </div>
                </div>
            </div>

            {/* Paint Tools */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: 'var(--fa-dark-blue)' }}>Painter Tools</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    {tools.map(tool => (
                        <button
                            key={tool.id}
                            onClick={() => setCurrentTool(tool.id)}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '16px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                border: currentTool === tool.id ? `2px solid ${tool.border}` : '1px solid transparent',
                                backgroundColor: currentTool === tool.id ? tool.color : 'white',
                                boxShadow: currentTool === tool.id ? '0 4px 12px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                        >
                            <span style={{ fontSize: '24px' }}>{tool.icon}</span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>{tool.label}</span>
                        </button>
                    ))}
                </div>
                <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--fa-warm-gray)', textAlign: 'center', lineHeight: '1.4' }}>
                    Select a tool and click & drag on the grid to paint your room layout.
                </p>
            </div>

            {/* Actions */}
            <div className="glass-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                    onClick={handleSave}
                    style={{
                        padding: '12px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer',
                        display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px'
                    }}
                >
                    💾 Save Room Layout
                </button>
                {selectedLayoutId !== 'new' && (
                    <button 
                        onClick={handleDelete}
                        style={{
                            padding: '12px', backgroundColor: 'transparent', color: 'var(--fa-red)', border: '1px solid var(--fa-red)', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'
                        }}
                    >
                        🗑️ Delete Layout
                    </button>
                )}
                {statusMsg && (
                    <div style={{ textAlign: 'center', fontSize: '13px', fontWeight: 'bold', color: statusMsg.includes('❌') ? 'var(--fa-red)' : 'var(--fa-blue)', marginTop: '8px' }}>
                        {statusMsg}
                    </div>
                )}
            </div>
            
        </div>

        {/* Right Side: Canvas */}
        <div className="glass-panel" style={{ padding: '32px', display: 'flex', justifyContent: 'center', alignItems: 'center', background: 'rgba(255, 255, 255, 0.4)', overflow: 'auto' }}>
            <div 
                onMouseLeave={handleMouseUp}
                style={{
                    display: 'inline-grid',
                    gridTemplateRows: `repeat(${gridSize.rows}, 30px)`,
                    gridTemplateColumns: `repeat(${gridSize.cols}, 30px)`,
                    gap: '2px',
                    padding: '16px',
                    backgroundColor: 'rgba(0,0,0,0.02)',
                    borderRadius: '12px',
                    border: '1px solid var(--glass-border)',
                    userSelect: 'none'
                }}
            >
                {gridData.map((row, r) => (
                    row.map((cellType, c) => {
                        const style = getCellRendering(cellType);
                        return (
                            <div
                                key={`${r}-${c}`}
                                onClick={() => updateCell(r, c)}
                                onMouseDown={() => handleMouseDown(r, c)}
                                onMouseEnter={() => handleMouseEnter(r, c)}
                                onMouseUp={handleMouseUp}
                                style={{
                                    backgroundColor: style.background,
                                    border: `1px solid ${style.borderColor}`,
                                    borderRadius: '4px',
                                    display: 'flex',
                                    justifyContent: 'center',
                                    alignItems: 'center',
                                    fontSize: '14px',
                                    cursor: 'pointer',
                                    transition: 'background-color 0.1s'
                                }}
                            >
                                {cellType !== 'empty' && style.icon}
                            </div>
                        )
                    })
                ))}
            </div>
        </div>

      </div>
    </div>
  );
}

import React, { useState } from 'react';

export default function PodRosterModal({
    isOpen,
    onClose,
    currentRoomLayout,
    assignedSeats,
    roomName,
    testName,
    date,
    session,
    senderEmail = 'dshepard@fryeburgacademy.org'
}) {
    if (!isOpen) return null;

    // View tab: 'roster' | 'email'
    const [activeTab, setActiveTab] = useState('roster');

    // Email configuration state
    const [displayLocation, setDisplayLocation] = useState(roomName || 'Arena');
    const [reportTime, setReportTime] = useState('7:50 AM');
    const [customNote, setCustomNote] = useState('Please bring your fully charged school Chromebook and a pencil.');
    const [copiedPod, setCopiedPod] = useState(null);

    // Extract pods from layout
    const getPodsData = () => {
        if (!currentRoomLayout) return [];
        const { rows, cols, grid } = currentRoomLayout;
        let grid2D = [];
        let rawGrid = grid;
        if (typeof rawGrid === 'string') {
            try { rawGrid = JSON.parse(rawGrid); } catch (e) { rawGrid = []; }
        }
        const rRows = parseInt(rows, 10) || 0;
        const rCols = parseInt(cols, 10) || 0;

        if (Array.isArray(rawGrid)) {
            if (rawGrid.length === rRows * rCols && rRows > 0 && rCols > 0) {
                for (let i = 0; i < rRows; i++) {
                    const r = [];
                    for (let j = 0; j < rCols; j++) r.push(rawGrid[i * rCols + j]);
                    grid2D.push(r);
                }
            } else if (rawGrid.length > 0 && Array.isArray(rawGrid[0])) {
                grid2D = rawGrid;
            }
        }

        const slotLabels = ['Top 1', 'Top 2', 'Left 1', 'Left 2', 'Right 1', 'Right 2', 'Bottom 1', 'Bottom 2'];
        const pods = [];
        let podIndex = 1;

        if (Array.isArray(grid2D)) {
            grid2D.forEach((row, rIndex) => {
                if (!Array.isArray(row)) return;
                row.forEach((cell, cIndex) => {
                    if (cell === 'pod') {
                        const seatKeyBase = `${rIndex}-${cIndex}`;
                        const students = [];
                        for (let slot = 0; slot < 8; slot++) {
                            const stud = assignedSeats[`${seatKeyBase}-${slot}`];
                            students.push({
                                slot,
                                label: slotLabels[slot] || `Seat ${slot + 1}`,
                                student: stud || null
                            });
                        }
                        pods.push({
                            podNumber: podIndex++,
                            seatKeyBase,
                            students
                        });
                    }
                });
            });
        }

        return pods;
    };

    const pods = getPodsData();

    // Helper: generate email text for a pod
    const getPodEmailContent = (pod) => {
        const studentEmails = pod.students
            .map(s => s.student?.email?.trim().toLowerCase())
            .filter(Boolean);

        const subject = `${testName} Testing: ${displayLocation} - POD ${pod.podNumber} Assignment`;
        const body = [
            `Hi Students,`,
            ``,
            `Tomorrow you will be testing for ${testName} in the ${displayLocation}.`,
            `Please report to the ${displayLocation} by ${reportTime}.`,
            ``,
            `Your assigned table cluster is: POD ${pod.podNumber}.`,
            `When you enter, please look for the "POD ${pod.podNumber}" sign on your table.`,
            ``,
            customNote ? `${customNote}\n` : ``,
            `Best,`,
            `Testing Department`
        ].join('\n');

        return {
            to: senderEmail,
            bcc: studentEmails.join(','),
            studentCount: studentEmails.length,
            subject,
            body
        };
    };

    // Open direct Gmail compose tab
    const handleOpenGmail = (pod) => {
        const { to, bcc, subject, body } = getPodEmailContent(pod);
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&bcc=${encodeURIComponent(bcc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Also copy BCC to clipboard as immediate convenience
        try {
            navigator.clipboard.writeText(bcc);
        } catch (e) {}

        const win = window.open(gmailUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = `mailto:${to}?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
    };

    // Copy BCC & Body to clipboard
    const handleCopyPodEmail = (pod) => {
        const { to, bcc, subject, body } = getPodEmailContent(pod);
        const fullText = `To: ${to}\nBCC: ${bcc}\nSubject: ${subject}\n\n${body}`;
        navigator.clipboard.writeText(fullText).then(() => {
            setCopiedPod(pod.podNumber);
            setTimeout(() => setCopiedPod(null), 3000);
        }).catch(() => {
            alert("Could not copy automatically.");
        });
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
            <div className="glass-panel" style={{
                backgroundColor: '#ffffff', width: '100%', maxWidth: '900px',
                maxHeight: '90vh', display: 'flex', flexDirection: 'column',
                borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflow: 'hidden'
            }}>
                {/* Header (hidden on print) */}
                <div className="no-print" style={{
                    padding: '16px 24px', borderBottom: '1px solid var(--glass-border)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    backgroundColor: 'rgba(0, 70, 139, 0.04)'
                }}>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '18px' }}>
                            🟪 Pod Manager: {roomName}
                        </h3>
                        <p style={{ margin: '2px 0 0', color: 'var(--fa-warm-gray)', fontSize: '12px' }}>
                            {testName} • {date} ({session}) • Sent from: <strong>{senderEmail}</strong>
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {/* Tab Switcher */}
                        <div style={{ display: 'flex', backgroundColor: '#e4e7eb', borderRadius: '6px', padding: '2px', marginRight: '8px' }}>
                            <button
                                onClick={() => setActiveTab('roster')}
                                style={{
                                    padding: '6px 12px', borderRadius: '4px', border: 'none',
                                    backgroundColor: activeTab === 'roster' ? '#ffffff' : 'transparent',
                                    color: activeTab === 'roster' ? 'var(--fa-dark-blue)' : '#5f6368',
                                    fontWeight: 'bold', fontSize: '12px', cursor: 'pointer'
                                }}
                            >
                                📋 Table Roster
                            </button>
                            <button
                                onClick={() => setActiveTab('email')}
                                style={{
                                    padding: '6px 12px', borderRadius: '4px', border: 'none',
                                    backgroundColor: activeTab === 'email' ? '#ffffff' : 'transparent',
                                    color: activeTab === 'email' ? '#8e24aa' : '#5f6368',
                                    fontWeight: 'bold', fontSize: '12px', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '4px'
                                }}
                            >
                                📧 Email by Pod (BCC)
                            </button>
                        </div>

                        {activeTab === 'roster' && (
                            <button
                                onClick={() => window.print()}
                                style={{
                                    padding: '8px 14px', backgroundColor: 'var(--fa-blue)', color: 'white',
                                    border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px'
                                }}
                            >
                                🖨️ Print Sheets
                            </button>
                        )}

                        <button
                            onClick={onClose}
                            style={{
                                padding: '8px 12px', backgroundColor: '#f1f3f4', color: '#5f6368',
                                border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px'
                            }}
                        >
                            ✕ Close
                        </button>
                    </div>
                </div>

                {/* Body */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    {pods.length === 0 ? (
                        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--fa-warm-gray)' }}>
                            No 8-Seat Pods found in this room layout. Paint Pods in <strong>Room Layouts</strong> to use this view!
                        </div>
                    ) : activeTab === 'roster' ? (
                        /* TAB 1: Roster View */
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '16px' }}>
                            {pods.map(pod => {
                                const filledCount = pod.students.filter(s => s.student).length;
                                return (
                                    <div
                                        key={pod.podNumber}
                                        style={{
                                            border: '1.5px solid rgba(142, 36, 170, 0.3)',
                                            borderRadius: '8px', padding: '14px',
                                            backgroundColor: '#fcfaff', pageBreakInside: 'avoid'
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(142, 36, 170, 0.2)', paddingBottom: '8px', marginBottom: '8px' }}>
                                            <span style={{ fontWeight: 'bold', color: '#6a1b9a', fontSize: '15px' }}>
                                                POD {pod.podNumber}
                                            </span>
                                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: filledCount === 8 ? '#188038' : '#e37400' }}>
                                                {filledCount} / 8 Seats Filled
                                            </span>
                                        </div>

                                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                                            <tbody>
                                                {pod.students.map(item => (
                                                    <tr key={item.slot} style={{ borderBottom: '1px dashed #eee' }}>
                                                        <td style={{ padding: '4px 6px', color: '#888', width: '60px', fontWeight: '600' }}>
                                                            {item.label}
                                                        </td>
                                                        <td style={{ padding: '4px 6px', color: item.student ? 'var(--fa-dark-blue)' : '#adb5bd', fontWeight: item.student ? 'bold' : 'normal' }}>
                                                            {item.student ? `${item.student.lastName}, ${item.student.firstName}` : '— Empty Seat —'}
                                                        </td>
                                                        <td style={{ padding: '4px 6px', textAlign: 'right', color: 'var(--fa-warm-gray)', fontSize: '10px' }}>
                                                            {item.student?.grade ? `Gr ${item.student.grade}` : ''}
                                                            {item.student?.hasAccommodations && <span style={{ color: 'var(--fa-red)', marginLeft: '4px' }}>⚡</span>}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        /* TAB 2: Email by Pod View (BCC) */
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            
                            {/* Message Customizer Box */}
                            <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0, 70, 139, 0.03)' }}>
                                <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--fa-dark-blue)', marginBottom: '12px' }}>
                                    ✏️ Customize Email Details
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)', marginBottom: '4px' }}>
                                            LOCATION TO DISPLAY (e.g. "Arena")
                                        </label>
                                        <input
                                            type="text"
                                            value={displayLocation}
                                            onChange={e => setDisplayLocation(e.target.value)}
                                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '12px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)', marginBottom: '4px' }}>
                                            REPORT TIME
                                        </label>
                                        <input
                                            type="text"
                                            value={reportTime}
                                            onChange={e => setReportTime(e.target.value)}
                                            style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '12px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)', marginBottom: '4px' }}>
                                        CUSTOM NOTE / INSTRUCTIONS FOR STUDENTS
                                    </label>
                                    <input
                                        type="text"
                                        value={customNote}
                                        onChange={e => setCustomNote(e.target.value)}
                                        placeholder="e.g. Bring your fully charged Chromebook and a pencil."
                                        style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid #dadce0', fontSize: '12px', boxSizing: 'border-box' }}
                                    />
                                </div>
                            </div>

                            {/* Pod Dispatch Cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {pods.map(pod => {
                                    const { studentCount } = getPodEmailContent(pod);
                                    const isCopied = copiedPod === pod.podNumber;

                                    return (
                                        <div
                                            key={pod.podNumber}
                                            style={{
                                                padding: '12px 16px', borderRadius: '8px',
                                                border: '1px solid var(--glass-border)',
                                                backgroundColor: '#ffffff',
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                                            }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 'bold', fontSize: '14px', color: '#6a1b9a' }}>
                                                    POD {pod.podNumber}
                                                    <span style={{ fontSize: '12px', fontWeight: 'normal', color: 'var(--fa-warm-gray)', marginLeft: '10px' }}>
                                                        {studentCount} student email(s) found
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                                    Subject: {testName} Testing: {displayLocation} - POD {pod.podNumber} Assignment
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleCopyPodEmail(pod)}
                                                    disabled={studentCount === 0}
                                                    style={{
                                                        padding: '6px 12px', borderRadius: '6px',
                                                        border: '1px solid var(--glass-border)',
                                                        backgroundColor: isCopied ? '#188038' : '#ffffff',
                                                        color: isCopied ? '#ffffff' : 'var(--fa-dark-blue)',
                                                        fontWeight: 'bold', fontSize: '11px', cursor: 'pointer'
                                                    }}
                                                >
                                                    {isCopied ? '✓ Copied' : '📋 Copy BCC & Body'}
                                                </button>

                                                <button
                                                    onClick={() => handleOpenGmail(pod)}
                                                    disabled={studentCount === 0}
                                                    style={{
                                                        padding: '6px 14px', borderRadius: '6px', border: 'none',
                                                        backgroundColor: '#8e24aa', color: '#ffffff',
                                                        fontWeight: 'bold', fontSize: '11px', cursor: studentCount === 0 ? 'default' : 'pointer',
                                                        opacity: studentCount === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px'
                                                    }}
                                                >
                                                    ✉️ Open Gmail (BCC)
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

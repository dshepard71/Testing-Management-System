import React, { useState, useEffect } from 'react';

export default function StudentNotificationModal({
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

    // Extract pods from layout if any
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
    const hasPods = pods.length > 0;

    // View tab: for pod rooms: 'email' | 'roster'; for standard rooms: 'email'
    const [activeTab, setActiveTab] = useState('email');

    // Clean initial room name (strip extra labels like " (updated)" or " with Pods")
    const cleanInitialRoomName = (roomName || 'Testing Room')
        .replace(/\s*\([^)]*\)/g, '')
        .replace(/\s+with\s+pods/gi, '')
        .trim();

    const [displayLocation, setDisplayLocation] = useState(cleanInitialRoomName);
    const [reportTime, setReportTime] = useState(session === 'Afternoon' ? '11:45 AM' : '7:45 AM');
    const [customNote, setCustomNote] = useState('Please bring your fully charged school Chromebook and a pencil.');
    const [copiedKey, setCopiedKey] = useState(null);
    const [printWithAccommodations, setPrintWithAccommodations] = useState(false); // Default to clean/student-facing (no accommodations)

    // Keep displayLocation updated if roomName changes
    useEffect(() => {
        if (roomName) {
            setDisplayLocation(
                roomName.replace(/\s*\([^)]*\)/g, '').replace(/\s+with\s+pods/gi, '').trim()
            );
        }
    }, [roomName]);

    // Format date string to MM-DD-YYYY
    const formatUsDate = (dStr) => {
        if (!dStr) return '';
        // If YYYY-MM-DD
        const matchIso = dStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
        if (matchIso) {
            const [, y, m, d] = matchIso;
            return `${m.padStart(2, '0')}-${d.padStart(2, '0')}-${y}`;
        }
        return dStr;
    };

    const formattedDisplayDate = formatUsDate(date);

    // All assigned student emails across this entire room
    const allAssignedStudents = Object.values(assignedSeats).filter(Boolean);
    const allRoomEmails = Array.from(
        new Set(allAssignedStudents.map(s => s.email?.trim().toLowerCase()).filter(Boolean))
    );

    // Generate whole-room email content (used for standard rooms OR broadcast option)
    const getWholeRoomEmailContent = () => {
        const subject = `${testName} Testing Location: ${displayLocation} - ${formattedDisplayDate}`;
        const body = [
            `Hi Students,`,
            ``,
            `You are scheduled to take the ${testName} in the ${displayLocation} on ${formattedDisplayDate} (${session} session).`,
            `Please report to the ${displayLocation} by ${reportTime}.`,
            ``,
            customNote ? `${customNote}\n` : ``,
            `Thanks,`,
            `Mr. Shepard`
        ].join('\n');

        return {
            to: senderEmail,
            bcc: allRoomEmails.join(','),
            studentCount: allRoomEmails.length,
            subject,
            body
        };
    };

    // Generate Pod-specific email content
    const getPodEmailContent = (pod) => {
        const studentEmails = pod.students
            .map(s => s.student?.email?.trim().toLowerCase())
            .filter(Boolean);

        const subject = `${testName} Testing: ${displayLocation} - POD ${pod.podNumber} Assignment`;
        const body = [
            `Hi Students,`,
            ``,
            `You are scheduled to take the ${testName} in the ${displayLocation} on ${formattedDisplayDate} (${session} session).`,
            `Please report to the ${displayLocation} by ${reportTime}.`,
            ``,
            `Your assigned table cluster is: POD ${pod.podNumber}.`,
            `When you enter, please look for the "POD ${pod.podNumber}" sign on your table.`,
            ``,
            customNote ? `${customNote}\n` : ``,
            `Thanks,`,
            `Mr. Shepard`
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
    const handleOpenGmail = (emailObj) => {
        const { to, bcc, subject, body } = emailObj;
        const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&bcc=${encodeURIComponent(bcc)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        try {
            navigator.clipboard.writeText(bcc);
        } catch (e) {}

        const win = window.open(gmailUrl, '_blank');
        if (!win || win.closed || typeof win.closed === 'undefined') {
            window.location.href = `mailto:${to}?bcc=${encodeURIComponent(bcc)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        }
    };

    // Copy to clipboard
    const handleCopyEmail = (emailObj, key) => {
        const { to, bcc, subject, body } = emailObj;
        const fullText = `To: ${to}\nBCC: ${bcc}\nSubject: ${subject}\n\n${body}`;
        navigator.clipboard.writeText(fullText).then(() => {
            setCopiedKey(key);
            setTimeout(() => setCopiedKey(null), 3000);
        }).catch(() => {
            alert("Could not copy automatically.");
        });
    };

    const handlePrintPodSheets = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) {
            alert('Please allow popups to print pod sheets.');
            return;
        }

        const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Pod Roster Sheets - ${roomName}</title>
    <style>
        @page {
            size: letter portrait;
            margin: 0.5in;
        }
        * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
            margin: 0;
            padding: 0;
            color: #1a1a1a;
            background: #fff;
        }
        .pod-page {
            page-break-after: always;
            break-after: page;
            min-height: 9.8in;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            padding: 10px;
        }
        .pod-page:last-child {
            page-break-after: avoid;
            break-after: avoid;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #00468b;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }
        .school-title {
            font-size: 14px;
            text-transform: uppercase;
            letter-spacing: 2px;
            color: #555;
            font-weight: 600;
            margin-bottom: 4px;
        }
        .test-title {
            font-size: 26px;
            font-weight: 800;
            color: #00468b;
            margin: 0 0 6px 0;
        }
        .meta-info {
            font-size: 14px;
            color: #333;
            font-weight: 500;
            display: flex;
            justify-content: center;
            gap: 20px;
        }
        .pod-banner {
            background-color: #8e24aa;
            color: white;
            padding: 16px 20px;
            border-radius: 8px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }
        .pod-title {
            font-size: 32px;
            font-weight: 900;
            letter-spacing: 1px;
            margin: 0;
        }
        .pod-count {
            font-size: 18px;
            font-weight: 600;
            background: rgba(255,255,255,0.25);
            padding: 6px 14px;
            border-radius: 6px;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
        }
        th {
            background-color: #f1f3f4;
            color: #202124;
            font-size: 13px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 10px 14px;
            text-align: left;
            border-bottom: 2px solid #dadce0;
        }
        td {
            padding: 12px 14px;
            border-bottom: 1px solid #e0e0e0;
            font-size: 15px;
        }
        tr:nth-child(even) {
            background-color: #fafafa;
        }
        .seat-badge {
            font-weight: 700;
            color: #8e24aa;
            display: inline-block;
            width: 80px;
            font-size: 13px;
            background: #f3e5f5;
            padding: 4px 8px;
            border-radius: 4px;
            text-align: center;
        }
        .student-name {
            font-weight: 700;
            color: #1a1a1a;
            font-size: 16px;
        }
        .empty-seat {
            color: #9aa0a6;
            font-style: italic;
        }
        .grade-badge {
            color: #5f6368;
            font-size: 13px;
            font-weight: 600;
        }
        .notes-box {
            border: 1.5px dashed #00468b;
            background-color: #f8fbff;
            border-radius: 8px;
            padding: 14px 18px;
            margin-top: 10px;
        }
        .notes-box h4 {
            margin: 0 0 6px 0;
            color: #00468b;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .notes-box p {
            margin: 0;
            font-size: 13px;
            color: #333;
            line-height: 1.4;
        }
        .footer {
            text-align: center;
            font-size: 11px;
            color: #888;
            border-top: 1px solid #eee;
            padding-top: 10px;
            margin-top: 10px;
        }
    </style>
</head>
<body>
    ${pods.map(pod => {
        const filledSeats = pod.students.filter(s => s.student).length;
        return `
        <div class="pod-page">
            <div>
                <div class="header">
                    <div class="school-title">Fryeburg Academy • Testing Roster</div>
                    <div class="test-title">${testName}</div>
                    <div class="meta-info">
                        <span><strong>Location:</strong> ${displayLocation}</span>
                        <span><strong>Date:</strong> ${formattedDisplayDate}</span>
                        <span><strong>Session:</strong> ${session}</span>
                    </div>
                </div>

                <div class="pod-banner">
                    <div class="pod-title">POD ${pod.podNumber}</div>
                    <div class="pod-count">${filledSeats} / 8 Seats Assigned</div>
                </div>

                <table>
                    <thead>
                        <tr>
                            <th style="width: 100px;">Position</th>
                            <th>Student Name</th>
                            <th style="width: 90px; text-align: center;">Grade</th>
                            <th style="width: 130px; text-align: center;">Attendance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${pod.students.map(item => `
                            <tr>
                                <td>
                                    <span class="seat-badge">${item.label}</span>
                                </td>
                                <td>
                                    ${item.student 
                                        ? `<span class="student-name">${item.student.lastName}, ${item.student.firstName}</span>
                                           ${(printWithAccommodations && item.student.hasAccommodations) ? '<span style="color:#d93025; margin-left:6px;" title="' + (item.student.accommodations || '') + '">⚡</span>' : ''}`
                                        : '<span class="empty-seat">— Empty Seat —</span>'}
                                </td>
                                <td style="text-align: center;">
                                    ${item.student ? `<span class="grade-badge">Gr ${item.student.grade || '10'}</span>` : ''}
                                </td>
                                <td style="text-align: center;">
                                    ${item.student ? '<span style="display:inline-block; width:18px; height:18px; border:1.5px solid #5f6368; border-radius:3px;"></span>' : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <div>
                ${customNote ? `
                    <div class="notes-box">
                        <h4>Instructions / Notes</h4>
                        <p>${customNote}</p>
                    </div>
                ` : ''}

                <div class="footer">
                    Printed from Testing Management System • Fryeburg Academy
                </div>
            </div>
        </div>
        `;
    }).join('')}
    <script>
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>
        `;

        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
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
                            📧 Student Test Notifications (BCC)
                        </h3>
                        <p style={{ margin: '2px 0 0', color: 'var(--fa-warm-gray)', fontSize: '12px' }}>
                            {roomName} • {testName} • {date} ({session}) • From: <strong>{senderEmail}</strong>
                        </p>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {hasPods && (
                            <div style={{ display: 'flex', backgroundColor: '#e4e7eb', borderRadius: '6px', padding: '2px', marginRight: '8px' }}>
                                <button
                                    onClick={() => setActiveTab('email')}
                                    style={{
                                        padding: '6px 12px', borderRadius: '4px', border: 'none',
                                        backgroundColor: activeTab === 'email' ? '#ffffff' : 'transparent',
                                        color: activeTab === 'email' ? '#8e24aa' : '#5f6368',
                                        fontWeight: 'bold', fontSize: '12px', cursor: 'pointer'
                                    }}
                                >
                                    📧 Email by Pod (BCC)
                                </button>
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
                            </div>
                        )}

                        {hasPods && activeTab === 'roster' && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#5f6368', cursor: 'pointer', userSelect: 'none' }}>
                                    <input
                                        type="checkbox"
                                        checked={printWithAccommodations}
                                        onChange={(e) => setPrintWithAccommodations(e.target.checked)}
                                        style={{ cursor: 'pointer' }}
                                    />
                                    <span>Show ⚡ Accommodations</span>
                                </label>
                                <button
                                    onClick={handlePrintPodSheets}
                                    style={{
                                        padding: '8px 14px', backgroundColor: 'var(--fa-blue)', color: 'white',
                                        border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '12px'
                                    }}
                                >
                                    🖨️ Print Sheets
                                </button>
                            </div>
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
                    
                    {/* TOP SETTINGS: Editable Location, Time, Note */}
                    {activeTab === 'email' && (
                        <div style={{ padding: '16px', borderRadius: '8px', border: '1px solid var(--glass-border)', backgroundColor: 'rgba(0, 70, 139, 0.03)', marginBottom: '20px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--fa-dark-blue)', marginBottom: '12px' }}>
                                ✏️ Customize Notification Details
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 'bold', color: 'var(--fa-warm-gray)', marginBottom: '4px' }}>
                                        LOCATION TO DISPLAY (What students see)
                                    </label>
                                    <input
                                        type="text"
                                        value={displayLocation}
                                        onChange={e => setDisplayLocation(e.target.value)}
                                        placeholder="e.g. Arena, Student Union, Library"
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
                    )}

                    {/* VIEW 1: STANDARD ROOM (Single BCC Broadcast for All Students in this room) */}
                    {!hasPods && (
                        <div>
                            {(() => {
                                const wholeRoomObj = getWholeRoomEmailContent();
                                const isCopied = copiedKey === 'whole_room';

                                return (
                                    <div style={{
                                        padding: '20px', borderRadius: '10px',
                                        border: '1.5px solid var(--fa-blue)',
                                        backgroundColor: '#ffffff',
                                        boxShadow: '0 4px 12px rgba(0, 70, 139, 0.08)'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                                            <div>
                                                <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--fa-dark-blue)' }}>
                                                    Room Broadcast ({displayLocation})
                                                </h4>
                                                <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)', fontSize: '12px' }}>
                                                    Send <strong>1 email</strong> to yourself with all <strong>{wholeRoomObj.studentCount} assigned students in BCC</strong>. No student emails will be visible to each other.
                                                </p>
                                            </div>

                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleCopyEmail(wholeRoomObj, 'whole_room')}
                                                    disabled={wholeRoomObj.studentCount === 0}
                                                    style={{
                                                        padding: '8px 14px', borderRadius: '6px',
                                                        border: '1px solid var(--glass-border)',
                                                        backgroundColor: isCopied ? '#188038' : '#ffffff',
                                                        color: isCopied ? '#ffffff' : 'var(--fa-dark-blue)',
                                                        fontWeight: 'bold', fontSize: '12px', cursor: 'pointer'
                                                    }}
                                                >
                                                    {isCopied ? '✓ Copied' : '📋 Copy BCC & Body'}
                                                </button>

                                                <button
                                                    onClick={() => handleOpenGmail(wholeRoomObj)}
                                                    disabled={wholeRoomObj.studentCount === 0}
                                                    style={{
                                                        padding: '8px 18px', borderRadius: '6px', border: 'none',
                                                        backgroundColor: 'var(--fa-blue)', color: '#ffffff',
                                                        fontWeight: 'bold', fontSize: '12px', cursor: wholeRoomObj.studentCount === 0 ? 'default' : 'pointer',
                                                        opacity: wholeRoomObj.studentCount === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '6px'
                                                    }}
                                                >
                                                    ✉️ Open in Gmail (BCC)
                                                </button>
                                            </div>
                                        </div>

                                        {/* Email Preview */}
                                        <div style={{ backgroundColor: '#f8f9fa', padding: '14px', borderRadius: '8px', border: '1px solid #e9ecef', fontSize: '12px' }}>
                                            <div style={{ marginBottom: '6px' }}><strong>To:</strong> {wholeRoomObj.to}</div>
                                            <div style={{ marginBottom: '6px', color: 'var(--fa-blue)', wordBreak: 'break-all' }}>
                                                <strong>BCC ({wholeRoomObj.studentCount} students):</strong> {wholeRoomObj.bcc || 'No student emails found'}
                                            </div>
                                            <div style={{ marginBottom: '10px' }}><strong>Subject:</strong> {wholeRoomObj.subject}</div>
                                            <div style={{ whiteSpace: 'pre-line', borderTop: '1px solid #dee2e6', paddingTop: '10px', color: '#444' }}>
                                                {wholeRoomObj.body}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}

                    {/* VIEW 2: POD ROOMS (Grouped by Pod) */}
                    {hasPods && activeTab === 'email' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginBottom: '4px' }}>
                                Click <strong>✉️ Open Gmail (BCC)</strong> for each pod. Each email addresses you as the recipient and places that Pod's 8 students in BCC so they know their exact table without seeing each other's addresses:
                            </div>

                            {pods.map(pod => {
                                const emailObj = getPodEmailContent(pod);
                                const isCopied = copiedKey === `pod_${pod.podNumber}`;

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
                                                    {emailObj.studentCount} student email(s)
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>
                                                Subject: {emailObj.subject}
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button
                                                onClick={() => handleCopyEmail(emailObj, `pod_${pod.podNumber}`)}
                                                disabled={emailObj.studentCount === 0}
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
                                                onClick={() => handleOpenGmail(emailObj)}
                                                disabled={emailObj.studentCount === 0}
                                                style={{
                                                    padding: '6px 14px', borderRadius: '6px', border: 'none',
                                                    backgroundColor: '#8e24aa', color: '#ffffff',
                                                    fontWeight: 'bold', fontSize: '11px', cursor: emailObj.studentCount === 0 ? 'default' : 'pointer',
                                                    opacity: emailObj.studentCount === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: '4px'
                                                }}
                                            >
                                                ✉️ Open Gmail (BCC)
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* VIEW 3: POD TABLE ROSTER (Printable Table Sheets) */}
                    {hasPods && activeTab === 'roster' && (
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
                    )}

                </div>
            </div>
        </div>
    );
}

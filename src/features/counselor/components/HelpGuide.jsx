import React, { useState } from 'react';

const HelpGuide = ({ role = 'admin', onClose }) => {
    const [selectedTab, setSelectedTab] = useState(role === 'student' ? 'student' : 'admin_cheatsheet');
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSection, setExpandedSection] = useState('sis_import');

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const cheatSheetTopics = [
        {
            id: 'sis_import',
            badge: '📁 Step 1',
            title: 'Master Roster & SIS Upload ("All Testing WDS")',
            category: 'Roster Management',
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}><strong>Where to go:</strong> Sidebar → <strong>📁 Master Data Upload</strong> (<code>/admin/master-upload</code>).</p>
                    <p style={{ margin: 0 }}><strong>SIS Report to run:</strong> In PowerSchool/SIS, run the report named <span style={{ color: 'var(--fa-red)', fontWeight: 'bold' }}>"All Testing WDS"</span> and export to <code>.csv</code> or <code>.xlsx</code>.</p>
                    <div style={{ backgroundColor: 'rgba(0,70,139,0.06)', padding: '10px 14px', borderRadius: '8px', borderLeft: '4px solid var(--fa-blue)' }}>
                        <strong>How it works:</strong> Click <em>Import</em> and select the file. The system automatically extracts Student IDs, Grade Levels, First/Last Name, Email, and Advisors. Existing accommodations are protected and will not be erased!
                    </div>
                </div>
            )
        },
        {
            id: 'counselor_workflow',
            badge: '👥 Step 2',
            title: 'Counselor Accommodations (Google Sheet Sync)',
            category: 'Accommodations',
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}><strong>Goal:</strong> Get student accommodations reviewed by counselors without requiring them to log into the database.</p>
                    <ol style={{ paddingLeft: '20px', margin: '4px 0' }}>
                        <li>Go to <strong>📁 Master Data Upload</strong> and click <strong>📥 Export CSV</strong>.</li>
                        <li>Upload that CSV to Google Drive and open as a <strong>Google Sheet</strong>. Share with counselors.</li>
                        <li>Counselors filter by their name under <em>Advisors</em>, mark <code>Yes</code> or <code>X</code> under accommodation columns (<em>Extended Time, Small Group, Extra Breaks, ESOL, Other</em>), and type notes under <em>Accommodation Notes</em>.</li>
                        <li>When finished, download the sheet as CSV (<strong>File → Download → CSV</strong>).</li>
                        <li>Return to <strong>📁 Master Data Upload</strong>, click <strong>Import</strong>, select the file, and ensure <strong>⚡ Update / Overwrite Accommodations</strong> is checked!</li>
                    </ol>
                    <p style={{ margin: 0, fontSize: '11px', color: '#1e8e3e', fontWeight: 'bold' }}>🔒 The system automatically encrypts all accommodation notes with AES-256 upon import.</p>
                </div>
            )
        },
        {
            id: 'sat_psat_import',
            badge: '📝 Step 3',
            title: 'SAT & PSAT Google Form Registrations',
            category: 'Testing Registration',
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}><strong>Where to go:</strong> Sidebar → <strong>📚 Assessment Hub → SAT/PSAT Manager</strong> (<code>/admin/assessments</code>).</p>
                    <p style={{ margin: 0 }}><strong>How to import Google Form responses:</strong></p>
                    <ol style={{ paddingLeft: '20px', margin: '4px 0' }}>
                        <li>Open your Google Form response sheet in Google Sheets.</li>
                        <li>Highlight and copy (<code>Ctrl + C</code>) all the response rows.</li>
                        <li>In SAT/PSAT Manager, click the <strong>Bulk Paste Import</strong> button in the top toolbar.</li>
                        <li>Paste (<code>Ctrl + V</code>) into the box and click <strong>Import Registrations</strong>.</li>
                    </ol>
                    <div style={{ backgroundColor: '#e8f0fe', padding: '10px 14px', borderRadius: '8px', borderLeft: '4px solid #1a73e8' }}>
                        💡 <strong>Smart Lookup:</strong> The system matches students by <strong>Email</strong> and automatically pulls their official SIS legal name, grade, counselor, and accommodations from the Master List (even if the student typed their name backwards!).
                    </div>
                </div>
            )
        },
        {
            id: 'state_assessments',
            badge: '🌲 State Testing',
            title: 'Maine State Assessments & NWEA MAP',
            category: 'State Assessments',
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}><strong>Where to go:</strong> Sidebar → <strong>🌲 State & MAP Hub</strong> (<code>/admin/state-assessments</code>).</p>
                    <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>
                        <li><strong>Maine Through Year Assessment:</strong> Targets <strong style={{ color: 'var(--fa-blue)' }}>Grade 10</strong> (Reading & Math sessions).</li>
                        <li><strong>Maine Science Test:</strong> Targets <strong style={{ color: 'var(--fa-blue)' }}>Grade 11</strong>.</li>
                        <li><strong>MAP Growth Report & Upload:</strong> Upload NWEA MAP growth CSVs to view historical progress.</li>
                    </ul>
                    <p style={{ margin: 0, fontSize: '12px' }}>Use the batch room assignment tool at the top of each state testing dashboard to assign students to testing dates and rooms in bulk.</p>
                </div>
            )
        },
        {
            id: 'seating_logistics',
            badge: '🪑 Test Day',
            title: 'Seating Charts, Door Signs & Proctors',
            category: 'Logistics',
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}><strong>1. Build Room Layouts:</strong> Go to <strong>🏫 Room Layouts</strong> to define room grid dimensions and desk capacities.</p>
                    <p style={{ margin: 0 }}><strong>2. Assign Seating Charts:</strong> Go to <strong>🪑 Seating Charts</strong>, choose the Exam Type (SAT, AP, Maine Through Year, etc.), choose a room, and click <em>Auto-Fill Empty Desks</em> or drag students into seats.</p>
                    <p style={{ margin: 0 }}><strong>3. Door Signs & Schedules:</strong> Go to <strong>📋 Logistics Hub</strong> to print room door signs (with student rosters, proctors, and start times) and the master administrative schedule.</p>
                    <p style={{ margin: 0 }}><strong>4. Live Attendance:</strong> Go to <strong>✅ Live Check-in</strong> on test day to mark students present or absent.</p>
                </div>
            )
        },
        {
            id: 'billing_clearinghouse',
            badge: '💵 Finance',
            title: 'Fee Collection & Business Office Deposits',
            category: 'Billing',
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}><strong>Where to go:</strong> Sidebar → <strong>💵 Billing Clearinghouse</strong> (<code>/admin/billing</code>) or SAT/PSAT Manager.</p>
                    <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>
                        <li><strong>Marking Payments:</strong> In SAT/PSAT or AP Manager, click <em>Edit</em> on a student row to record Cash, Check, CC, or Account payments.</li>
                        <li><strong>Creating Deposit Sheets:</strong> In SAT/PSAT Manager, click <strong>Create Deposit Sheet</strong> to generate a clean, printable financial summary for the Business Office.</li>
                        <li><strong>Waivers:</strong> Students marked as <em>Waiver Eligible</em> in the Master List automatically have their fee adjusted to $0.</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'collegeboard_export',
            badge: '📦 Ordering',
            title: 'Exporting Orders for College Board',
            category: 'College Board',
            content: (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ margin: 0 }}>When student sign-ups are complete:</p>
                    <ol style={{ paddingLeft: '20px', margin: '4px 0' }}>
                        <li>Go to <strong>📚 Assessment Hub → SAT/PSAT Manager</strong>.</li>
                        <li>Click <strong>Export Collegeboard CSV</strong> in the top toolbar.</li>
                        <li>The system automatically formats the file with all required fields (Attending AI Code <code>200390</code>, State IDs, Date of Birth, Gender, Grade, and Fee Waiver status) ready to upload to College Board.</li>
                    </ol>
                </div>
            )
        }
    ];

    const filteredCheatSheet = cheatSheetTopics.filter(t => 
        t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.badge.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 9999,
            backdropFilter: 'blur(4px)'
        }} onClick={onClose}>
            <div className="glass-panel" style={{
                width: '100%',
                maxWidth: '780px',
                maxHeight: '88vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                margin: '20px',
                padding: 0,
                background: 'rgba(255, 255, 255, 0.98)',
                boxShadow: '0 12px 40px rgba(0, 0, 0, 0.3)',
                borderRadius: '16px'
            }} onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div style={{
                    padding: '18px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'var(--fa-dark-blue)',
                    color: 'white'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '22px' }}>📖</span>
                        <div>
                            <h2 style={{ margin: 0, color: 'white', fontSize: '18px', fontWeight: 'bold' }}>
                                Operations Quick Cheat Sheet & Guide
                            </h2>
                            <p style={{ margin: '2px 0 0', fontSize: '11px', color: 'rgba(255,255,255,0.75)' }}>
                                Step-by-step workflows, import instructions, and SOPs
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'rgba(255,255,255,0.15)',
                            border: 'none',
                            fontSize: '20px',
                            cursor: 'pointer',
                            color: 'white',
                            padding: '4px 10px',
                            borderRadius: '8px'
                        }}
                    >
                        &times;
                    </button>
                </div>

                {/* Search & Filter Bar */}
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--glass-border)', backgroundColor: '#f8f9fa', display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <input
                            type="text"
                            placeholder="🔍 Search workflows, imports, reports, SOPs..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: '1px solid #ccc',
                                fontSize: '13px',
                                outline: 'none',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                    {searchTerm && (
                        <button
                            onClick={() => setSearchTerm('')}
                            style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '6px', background: 'white', cursor: 'pointer', fontSize: '12px' }}
                        >
                            Clear
                        </button>
                    )}
                </div>

                {/* Main Content Area */}
                <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
                    {filteredCheatSheet.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--fa-warm-gray)' }}>
                            No cheat sheet topics found matching "<b>{searchTerm}</b>".
                        </div>
                    ) : (
                        filteredCheatSheet.map((topic) => (
                            <div key={topic.id} style={{
                                marginBottom: '14px',
                                borderRadius: '10px',
                                border: '1px solid var(--glass-border)',
                                overflow: 'hidden',
                                backgroundColor: 'white',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
                            }}>
                                <button
                                    onClick={() => toggleSection(topic.id)}
                                    style={{
                                        width: '100%',
                                        padding: '14px 18px',
                                        border: 'none',
                                        backgroundColor: expandedSection === topic.id ? 'rgba(0, 70, 139, 0.05)' : 'white',
                                        textAlign: 'left',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        gap: '12px'
                                    }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                        <span style={{
                                            padding: '3px 8px',
                                            borderRadius: '6px',
                                            backgroundColor: 'rgba(0, 70, 139, 0.1)',
                                            color: 'var(--fa-blue)',
                                            fontSize: '11px',
                                            fontWeight: 'bold'
                                        }}>
                                            {topic.badge}
                                        </span>
                                        <span style={{ fontWeight: 'bold', fontSize: '14px', color: 'var(--fa-dark-blue)' }}>
                                            {topic.title}
                                        </span>
                                    </div>
                                    <span style={{ color: 'var(--fa-warm-gray)', fontSize: '18px', fontWeight: 'bold' }}>
                                        {expandedSection === topic.id ? '−' : '+'}
                                    </span>
                                </button>
                                
                                {expandedSection === topic.id && (
                                    <div style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', fontSize: '13px', color: 'var(--fa-dark-blue)', lineHeight: '1.6', backgroundColor: '#fafbfc' }}>
                                        {topic.content}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div style={{ padding: '12px 24px', borderTop: '1px solid var(--glass-border)', backgroundColor: '#f8f9fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '11px', color: 'var(--fa-warm-gray)' }}>
                        💡 Tip: Click <b>? Cheat Sheet</b> anytime from the sidebar or header.
                    </span>
                    <button
                        onClick={onClose}
                        style={{
                            padding: '8px 20px',
                            backgroundColor: 'var(--fa-blue)',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px'
                        }}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelpGuide;

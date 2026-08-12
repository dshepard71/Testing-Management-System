import React, { useState } from 'react';

const HelpGuide = ({ role = 'student', onClose }) => {
    const [expandedSection, setExpandedSection] = useState(null);

    const toggleSection = (section) => {
        setExpandedSection(expandedSection === section ? null : section);
    };

    const Section = ({ id, title, children }) => (
        <div className="glass-panel" style={{
            marginBottom: '12px',
            overflow: 'hidden',
            padding: 0,
            background: 'rgba(255, 255, 255, 0.75)',
            border: '1px solid var(--glass-border)'
        }}>
            <button
                onClick={() => toggleSection(id)}
                style={{
                    width: '100%',
                    padding: '16px 20px',
                    border: 'none',
                    backgroundColor: expandedSection === id ? 'rgba(0, 70, 139, 0.08)' : 'transparent',
                    textAlign: 'left',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontWeight: 'bold',
                    fontSize: '15px',
                    color: 'var(--fa-dark-blue)',
                    outline: 'none'
                }}
            >
                {title}
                <span style={{ color: 'var(--fa-warm-gray)', fontSize: '18px' }}>{expandedSection === id ? '−' : '+'}</span>
            </button>
            {expandedSection === id && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--glass-border)', fontSize: '13px', color: 'var(--fa-dark-blue)', lineHeight: '1.6' }}>
                    {children}
                </div>
            )}
        </div>
    );

    const guides = {
        student: {
            title: '📚 Student Help Guide',
            sections: [
                {
                    id: 'schedule',
                    title: '📅 My Testing Schedule',
                    content: (
                        <>
                            <p><strong>What it shows:</strong> All tests you're assigned to, including room and seat assignments.</p>
                            <p><strong>What to do:</strong></p>
                            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                                <li>Check your schedule before each testing day</li>
                                <li>Note your room number and seat assignment</li>
                                <li>Arrive 10 minutes early to your assigned room</li>
                                <li>Bring required materials and photo ID</li>
                            </ul>
                            <p><strong>⭐ Accommodations:</strong> If you have testing accommodations, they'll be noted on your schedule.</p>
                        </>
                    )
                },
                {
                    id: 'registration',
                    title: '📝 SAT/PSAT Registration',
                    content: (
                        <>
                            <p><strong>When open:</strong> Registration opens during designated windows set by the testing coordinator.</p>
                            <p><strong>How to register:</strong></p>
                            <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>
                                <li>Select your test type (SAT or PSAT)</li>
                                <li>Confirm your grade and counselor</li>
                                <li>Submit your registration</li>
                            </ol>
                            <p><strong>Payment Status:</strong> Your payment status will show as "Pending" until fees are received. <strong>You cannot test until payment is made.</strong></p>
                        </>
                    )
                }
            ]
        },
        counselor: {
            title: '🎓 Counselor Help Guide',
            sections: [
                {
                    id: 'master',
                    title: '👥 Testing Master List',
                    content: (
                        <>
                            <p><strong>Purpose:</strong> View and manage student accommodations and testing information.</p>
                            <p><strong>Key features:</strong></p>
                            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                                <li>View all students or filter by your caseload</li>
                                <li>Add/edit accommodations for each student</li>
                                <li>See payment status and testing assignments</li>
                            </ul>
                            <p><strong>Tip:</strong> Use the "My Caseload Only" toggle to focus on your students.</p>
                        </>
                    )
                },
                {
                    id: 'sat',
                    title: '📝 SAT/PSAT Registrations',
                    content: (
                        <>
                            <p><strong>Purpose:</strong> Review student registrations and update accommodation status.</p>
                            <p><strong>Workflow:</strong></p>
                            <ol style={{ paddingLeft: '20px', margin: '8px 0' }}>
                                <li>Review new registrations (Status: Pending)</li>
                                <li>Add any accommodation notes</li>
                                <li>Coordinate with testing coordinator for room assignments</li>
                            </ol>
                        </>
                    )
                },
                {
                    id: 'search',
                    title: '🔍 Student Search',
                    content: (
                        <>
                            <p><strong>Purpose:</strong> Quickly find which tests a specific student is scheduled for.</p>
                            <p><strong>How to use:</strong> Enter any part of the student's name or email. Results show all their tests across AP, SAT/PSAT, and Maine testing.</p>
                        </>
                    )
                }
            ]
        },
        proctor: {
            title: '📋 Proctor Help Guide',
            sections: [
                {
                    id: 'assignments',
                    title: '📅 My Testing Assignments',
                    content: (
                        <>
                            <p><strong>What it shows:</strong> All testing sessions where you're assigned as proctor or monitor.</p>
                            <p><strong>For each assignment:</strong></p>
                            <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                                <li>Date, time, and session (AM/PM)</li>
                                <li>Room location</li>
                                <li>Test being administered</li>
                                <li>Number of students</li>
                                <li>Your role (Proctor or Monitor)</li>
                            </ul>
                        </>
                    )
                },
                {
                    id: 'doorsign',
                    title: '🚪 Door Signs',
                    content: (
                        <>
                            <p><strong>Purpose:</strong> Print a sign for your testing room door.</p>
                            <p><strong>How to use:</strong> Click the "🚪 Door Sign" button next to any assignment to generate a printable sign with room number, test, proctor name, and student list.</p>
                        </>
                    )
                },
                {
                    id: 'print',
                    title: '🖨️ Print Student List',
                    content: (
                        <>
                            <p><strong>Purpose:</strong> Get a printed roster of students for your room.</p>
                            <p><strong>How to use:</strong> Click "Print" on any assignment to generate a formatted list you can use during testing.</p>
                        </>
                    )
                }
            ]
        },
        admin: {
            title: '⚙️ Administrator Standard Operating Procedures & Guide',
            sections: [
                {
                    id: 'roster-mgmt',
                    title: '👥 Master Roster & Homeschool Student Management',
                    content: (
                        <>
                            <p><strong>Overview:</strong> The Master Student List (under Counselor/Admin Hub) is the single source of truth for student identity, accommodations, and program statuses.</p>
                            <p><strong>Importing Roster Data:</strong> Click <em>Import</em> and upload an XLSX/CSV file containing headers: First Name, Last Name, Email, DOB, State ID, Grade, Advisor, Program, Accommodations.</p>
                            <p><strong>Adding/Editing Homeschool Students:</strong> Click <em>Edit</em> next to any row to set their program to <em>Homeschool</em>, or set their student category to <em>Homeschool</em> when registering in SAT/PSAT Manager.</p>
                        </>
                    )
                },
                {
                    id: 'sat-psat-sop',
                    title: '📝 SAT & PSAT Administration & Annual Rollover',
                    content: (
                        <>
                            <p><strong>Location:</strong> Assessment Hub → SAT/PSAT Manager.</p>
                            <p><strong>Annual Rollover (Starting a New Year):</strong> First click <em>Export Collegeboard CSV</em> to back up last year's data. Next, click the top-left select-all header checkbox, then click red <em>Delete Selected</em> to clear old entries.</p>
                            <p><strong>Adding Students:</strong> Click <em>+ Add Student</em> (for individual signups) or <em>Bulk Paste Import</em>. Select Student Type as <em>Homeschool</em>, <em>Boarding</em>, <em>District Day</em>, or <em>Commuter Day</em>.</p>
                            <p><strong>Exporting:</strong> Click <em>Export Collegeboard CSV</em> for official uploads or <em>Create Deposit Sheet</em> for Business Office fee submissions.</p>
                        </>
                    )
                },
                {
                    id: 'ap-sop',
                    title: '📘 AP Exam Administration',
                    content: (
                        <>
                            <p><strong>Location:</strong> Assessment Hub → AP Manager.</p>
                            <p><strong>Roster Import:</strong> Click <em>Upload AP Roster</em> to import College Board CSV/XLSX export files. The system matches courses, fee status, and school emails.</p>
                            <p><strong>Fee Status:</strong> Update fee statuses (Standard vs. Reduced vs. Late Order). All balances flow directly to the Billing Clearinghouse.</p>
                        </>
                    )
                },
                {
                    id: 'calendar-seating-sop',
                    title: '📅 Testing Calendar & Seating Charts Scheduling',
                    content: (
                        <>
                            <p><strong>How Calendar Dates Get Added:</strong> Go to <em>Seating Charts</em>, create/select a room layout, assign a Test Type, and select the scheduled <em>Date</em>. Setting a date on any seating chart automatically publishes the event onto the <strong>Testing Calendar</strong>.</p>
                            <p><strong>Proctor Workloads:</strong> Assign proctors to room layouts to auto-calculate workloads on the Proctor Workload report.</p>
                        </>
                    )
                },
                {
                    id: 'logistics-checkin-sop',
                    title: '🏢 Attendance Check-in & Makeup Tracker',
                    content: (
                        <>
                            <p><strong>Live Check-in:</strong> Proctors mark student attendance during test sessions on the Live Check-in console.</p>
                            <p><strong>Makeup Tracker:</strong> Students absent from assigned sessions automatically flag in the Makeup Tracker for rescheduled sessions.</p>
                        </>
                    )
                },
                {
                    id: 'billing-sop',
                    title: '💼 Billing Clearinghouse & Financial Summary',
                    content: (
                        <>
                            <p><strong>Location:</strong> Data & Billing → Billing Clearinghouse.</p>
                            <p><strong>Fee Processing:</strong> Filter fees by Student Type (Boarding vs. Day vs. Homeschool). Track payment tenders (Cash, Check, CC, Account) and export financial reports.</p>
                        </>
                    )
                },
                {
                    id: 'setup-sop',
                    title: '⚙️ User Roles & System Settings',
                    content: (
                        <>
                            <p><strong>User Management:</strong> Assign roles (Admin, Counselor, Proctor, Student, Business) under System Settings.</p>
                            <p><strong>Graduation Year Mappings:</strong> Map graduation years (e.g. 2028 = Grade 11) for automated roll-over logic.</p>
                        </>
                    )
                }
            ]
        },
        business: {
            title: '💼 Business Office Help Guide',
            sections: [
                {
                    id: 'console',
                    title: '💼 Business Console',
                    content: (
                        <>
                            <p><strong>Purpose:</strong> Track payments for AP and SAT/PSAT testing fees.</p>
                            <p><strong>View:</strong> See all students with fees due and their payment status.</p>
                            <p><strong>Update:</strong> Mark payments as received when processed.</p>
                        </>
                    )
                },
                {
                    id: 'summary',
                    title: '📊 Financial Summary',
                    content: (
                        <>
                            <p><strong>Purpose:</strong> Overview of all testing-related finances.</p>
                            <p><strong>Includes:</strong> Total AP fees, SAT/PSAT fees, and collection status.</p>
                        </>
                    )
                }
            ]
        },
        reports: {
            title: '📊 Reports & Snapshots Help Guide',
            sections: [
                {
                    id: 'reports-overview',
                    title: '📊 Reports Overview',
                    content: (
                        <>
                            <p><strong>Statistics:</strong> Real-time count of AP exams ordered, SAT/PSAT registrations, and students with accommodations.</p>
                            <p><strong>Exports:</strong> Download CSV files for AP, SAT, Master List, or Accommodation lists.</p>
                        </>
                    )
                },
                {
                    id: 'snapshots',
                    title: '📸 Year-End Snapshots',
                    content: (
                        <>
                            <p><strong>Purpose:</strong> Save a permanent record of the current year's testing statistics.</p>
                            <p><strong>How to use:</strong> Click <em>Save Year-End Snapshot</em> at the bottom of the page to compare numbers year-over-year.</p>
                        </>
                    )
                }
            ]
        }
    };

    const guide = guides[role] || guides.admin || guides.student;

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
            backdropFilter: 'blur(3px)'
        }} onClick={onClose}>
            <div className="glass-panel" style={{
                width: '100%',
                maxWidth: '650px',
                maxHeight: '85vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                margin: '20px',
                padding: 0,
                background: 'rgba(245, 247, 250, 0.98)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)'
            }} onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div style={{
                    padding: '20px 24px',
                    borderBottom: '1px solid var(--glass-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    backgroundColor: 'rgba(0, 70, 139, 0.05)'
                }}>
                    <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '20px', fontWeight: 'bold' }}>{guide.title}</h2>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            fontSize: '24px',
                            cursor: 'pointer',
                            color: 'var(--fa-warm-gray)',
                            padding: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                    >
                        ×
                    </button>
                </div>

                {/* Content */}
                <div style={{ padding: '24px', overflowY: 'auto' }}>
                    <p style={{ margin: '0 0 20px 0', color: 'var(--fa-warm-gray)', fontSize: '13px' }}>
                        Click on any topic below to expand it and learn more.
                    </p>

                    {guide.sections.map(section => (
                        <Section key={section.id} id={section.id} title={section.title}>
                            {section.content}
                        </Section>
                    ))}

                    <div style={{
                        marginTop: '24px',
                        padding: '16px',
                        backgroundColor: 'rgba(0, 70, 139, 0.06)',
                        borderRadius: '8px',
                        fontSize: '13px',
                        color: 'var(--fa-blue)',
                        fontWeight: '600',
                        border: '1.5px solid rgba(0, 70, 139, 0.15)'
                    }}>
                        <strong>Need more help?</strong> Refer to the complete written SOP manual in <code>OPERATIONS_MANUAL.md</code>.
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HelpGuide;

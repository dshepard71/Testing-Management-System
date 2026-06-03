import React from 'react';
import StudentSchedule from '../../student/StudentSchedule';

const StudentViewPreview = ({ studentEmail, studentName, onClose }) => {
    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.65)', display: 'flex', justifyContent: 'center',
            alignItems: 'center', zIndex: 2000, padding: '20px', backdropFilter: 'blur(6px)'
        }}>
            <div className="glass-panel" style={{
                width: '100%', maxWidth: '900px', height: '90vh',
                overflow: 'hidden', display: 'flex', flexDirection: 'column',
                backgroundColor: 'rgba(244, 247, 249, 0.95)'
            }}>
                {/* Preview Header */}
                <div style={{
                    backgroundColor: 'var(--fa-blue)', color: 'white',
                    padding: '16px 24px', display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', flexShrink: 0
                }}>
                    <div>
                        <div style={{ fontSize: '10px', fontWeight: 'bold', opacity: 0.9, letterSpacing: '0.8px' }}>ADMIN IMPERSONATION MODE</div>
                        <div style={{ fontSize: '18px', fontWeight: 'bold', fontFamily: 'Adobe Garamond Pro, serif' }}>
                            Viewing Dashboard as: {studentName || 'Student'}
                        </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <span style={{ fontSize: '12px', opacity: 0.8, fontStyle: 'italic' }}>Real-time student perspective</span>
                        <button
                            onClick={onClose}
                            style={{
                                backgroundColor: 'rgba(255,255,255,0.2)', border: 'none',
                                color: 'white', padding: '8px 16px', borderRadius: '6px',
                                cursor: 'pointer', fontWeight: 'bold', fontSize: '12px'
                            }}
                        >
                            ✕ Close Preview
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                    <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* Student Schedule Card */}
                        <StudentSchedule email={studentEmail} />

                        {/* Informational Box */}
                        <div className="glass-panel" style={{ padding: '24px', backgroundColor: 'white' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'var(--fa-dark-blue)' }}>V2 Roster Verification</h3>
                            <p style={{ margin: 0, color: 'var(--fa-warm-gray)', fontSize: '13px', lineHeight: '1.4' }}>
                                This preview displays precisely what the student observes when accessing their personal dashboard. 
                                In V2, the portal automatically aggregates exam listings from standard registries, AP subjects, SAT registration rosters, and real-time seating assignments.
                            </p>
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentViewPreview;

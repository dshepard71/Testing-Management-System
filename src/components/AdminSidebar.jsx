import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AdminSidebar = () => {
    const { userProfile } = useAuth();
    const effectiveRole = userProfile?.role || 'student';

    const [isCollapsed, setIsCollapsed] = useState(window.innerWidth < 768);
    const location = useLocation();

    // Auto-collapse sidebar on smaller screens (mobile / tablets)
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setIsCollapsed(true);
            }
        };
        handleResize(); // Initial check
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const navItemStyle = (path) => {
        const isActive = location.pathname === path;
        return {
            width: isCollapsed ? 'calc(100% - 16px)' : '100%',
            padding: isCollapsed ? '10px 4px' : '12px 16px',
            margin: isCollapsed ? '0 8px 6px 8px' : '0 0 4px 0',
            textAlign: isCollapsed ? 'center' : 'left',
            backgroundColor: isActive ? 'var(--fa-blue)' : 'transparent',
            color: isActive ? 'white' : 'var(--fa-dark-blue)',
            border: 'none',
            borderRadius: isCollapsed ? '10px' : '0 20px 20px 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: isActive ? '600' : '400',
            display: 'flex',
            flexDirection: isCollapsed ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: isCollapsed ? 'center' : 'flex-start',
            gap: isCollapsed ? '4px' : '12px',
            transition: 'all 0.2s',
            textDecoration: 'none',
            whiteSpace: 'nowrap',
            overflow: 'hidden'
        };
    };

    const headerStyle = {
        padding: '16px 16px 8px 16px',
        fontSize: '11px',
        fontWeight: 'bold',
        color: 'var(--fa-warm-gray)',
        textTransform: 'uppercase',
        letterSpacing: '0.8px',
        marginTop: '8px'
    };

    const labelStyle = {
        fontSize: '9px',
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: '0.2px',
        opacity: 0.8,
        marginTop: '2px',
        textAlign: 'center',
        width: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap'
    };

    return (
        <aside className="glass-panel" style={{
            width: isCollapsed ? '80px' : '280px',
            height: '100%',
            borderRight: '1px solid var(--glass-border)',
            display: 'flex',
            flexDirection: 'column',
            transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            overflowX: 'hidden',
            zIndex: 10,
            borderRadius: '0', // Override the glass-panel radius for a full height sidebar
            borderTop: 'none',
            borderBottom: 'none',
            borderLeft: 'none'
        }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 0' }}>
                <button 
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    style={{ 
                        margin: isCollapsed ? '0 auto 16px auto' : '0 16px 16px 16px', 
                        padding: '8px', 
                        borderRadius: '50%', 
                        border: '1px solid var(--fa-warm-gray)', 
                        backgroundColor: 'transparent', 
                        cursor: 'pointer', 
                        width: '32px', 
                        height: '32px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        color: 'var(--fa-dark-blue)'
                    }}
                >
                    {isCollapsed ? '→' : '←'}
                </button>

                {effectiveRole === 'admin' && (
                    <>
                        {!isCollapsed && <div style={headerStyle}>SETUP & ROSTERS</div>}
                        <div>
                            <Link to="/admin/users" style={navItemStyle('/admin/users')} title="User Management">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>👤</span>
                                        <span style={labelStyle}>Users</span>
                                    </>
                                ) : '👤 User Management'}
                            </Link>
                            <Link to="/admin/accommodations" style={navItemStyle('/admin/accommodations')} title="Accommodations Hub">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>⚡</span>
                                        <span style={labelStyle}>Acc Hub</span>
                                    </>
                                ) : '⚡ Accommodations Hub'}
                            </Link>
                            <Link to="/admin/master-upload" style={navItemStyle('/admin/master-upload')} title="Master Data Upload">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>📁</span>
                                        <span style={labelStyle}>Upload</span>
                                    </>
                                ) : '📁 Master Data Upload'}
                            </Link>
                            <Link to="/admin/rooms" style={navItemStyle('/admin/rooms')} title="Room Layout Manager">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>🏫</span>
                                        <span style={labelStyle}>Rooms</span>
                                    </>
                                ) : '🏫 Room Layouts'}
                            </Link>
                        </div>

                        {!isCollapsed && <div style={headerStyle}>REGISTRATION & FORMS</div>}
                        <div>
                            <Link to="/admin/forms" style={navItemStyle('/admin/forms')} title="Registration Forms">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>📝</span>
                                        <span style={labelStyle}>Forms</span>
                                    </>
                                ) : '📝 Registration Forms'}
                            </Link>
                        </div>

                        {!isCollapsed && <div style={headerStyle}>TEST DAY EXECUTION</div>}
                        <div>
                            <Link to="/admin/action-items" style={navItemStyle('/admin/action-items')} title="Smart Data Audit">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>🚨</span>
                                        <span style={labelStyle}>Audit</span>
                                    </>
                                ) : '🚨 Smart Data Audit'}
                            </Link>
                            <Link to="/admin/logistics" style={navItemStyle('/admin/logistics')} title="Logistics Hub">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>📋</span>
                                        <span style={labelStyle}>Logistics</span>
                                    </>
                                ) : '📋 Logistics Hub'}
                            </Link>
                            <Link to="/admin/seating-charts" style={navItemStyle('/admin/seating-charts')} title="Seating Charts">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>🪑</span>
                                        <span style={labelStyle}>Charts</span>
                                    </>
                                ) : '🪑 Seating Charts'}
                            </Link>
                            <Link to="/admin/checkin" style={navItemStyle('/admin/checkin')} title="Attendance Check-in">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>✅</span>
                                        <span style={labelStyle}>Check-in</span>
                                    </>
                                ) : '✅ Live Check-in'}
                            </Link>
                            <Link to="/admin/makeups" style={navItemStyle('/admin/makeups')} title="Makeup Tracker">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>📅</span>
                                        <span style={labelStyle}>Makeups</span>
                                    </>
                                ) : '📅 Makeup Tracker'}
                            </Link>
                        </div>
                        
                        {!isCollapsed && <div style={headerStyle}>DATA & BILLING</div>}
                        <div>
                            <Link to="/admin/assessments" style={navItemStyle('/admin/assessments')} title="Assessment Hub">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>📚</span>
                                        <span style={labelStyle}>Assess Hub</span>
                                    </>
                                ) : '📚 Assessment Hub'}
                            </Link>
                            <Link to="/admin/state-assessments" style={navItemStyle('/admin/state-assessments')} title="State & MAP Hub">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>🌲</span>
                                        <span style={labelStyle}>State/MAP</span>
                                    </>
                                ) : '🌲 State & MAP Hub'}
                            </Link>
                            <Link to="/admin/analytics" style={navItemStyle('/admin/analytics')} title="Analytics Hub">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>📈</span>
                                        <span style={labelStyle}>Analytics</span>
                                    </>
                                ) : '📈 Analytics Hub'}
                            </Link>
                            <Link to="/admin/billing" style={navItemStyle('/admin/billing')} title="Billing Clearinghouse">
                                {isCollapsed ? (
                                    <>
                                        <span style={{ fontSize: '18px' }}>💵</span>
                                        <span style={labelStyle}>Billing</span>
                                    </>
                                ) : '💵 Billing Clearinghouse'}
                            </Link>
                        </div>
                    </>
                )}
                
                {!isCollapsed && <div style={headerStyle}>COUNSELORS & VIEWS</div>}
                <div>
                    <Link to="/counselor" style={navItemStyle('/counselor')} title="Counselor Dashboard">
                        {isCollapsed ? (
                            <>
                                <span style={{ fontSize: '18px' }}>🎓</span>
                                <span style={labelStyle}>Counselor</span>
                            </>
                        ) : '🎓 Counselor View (Admin)'}
                    </Link>
                </div>
            </div>
        </aside>
    );
};

export default AdminSidebar;

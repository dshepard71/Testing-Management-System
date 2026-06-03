import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';

const TestingCalendar = () => {
    const [seatingCharts, setSeatingCharts] = useState([]);
    const [apStudents, setApStudents] = useState([]);
    const [satRegistrations, setSatRegistrations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentMonth, setCurrentMonth] = useState(new Date());

    useEffect(() => {
        const unsubCharts = onSnapshot(collection(db, 'seating_charts'), (snapshot) => {
            setSeatingCharts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), (snapshot) => {
            setApStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), (snapshot) => {
            setSatRegistrations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => {
            unsubCharts();
            unsubAP();
            unsubSAT();
        };
    }, []);

    // Group events by date
    const eventsByDate = {};

    seatingCharts.forEach(chart => {
        if (!chart.date) return;
        const dateKey = chart.date;
        if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
        eventsByDate[dateKey].push({
            type: chart.category || 'Test',
            name: chart.apSubject || chart.testType || 'Testing Session',
            room: chart.roomId,
            session: chart.session,
            students: chart.studentCount || 0,
            proctor: chart.proctor
        });
    });

    // Calendar helpers
    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startDayOfWeek = firstDay.getDay();
        return { daysInMonth, startDayOfWeek };
    };

    const formatMonthYear = (date) => {
        return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const navigateMonth = (delta) => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + delta, 1));
    };

    const { daysInMonth, startDayOfWeek } = getDaysInMonth(currentMonth);

    const getDateKey = (day) => {
        const year = currentMonth.getFullYear();
        const month = String(currentMonth.getMonth() + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        return `${year}-${month}-${dayStr}`;
    };

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Generate calendar days
    const calendarDays = [];
    for (let i = 0; i < startDayOfWeek; i++) {
        calendarDays.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        calendarDays.push(day);
    }

    const getEventColor = (type) => {
        if (type.includes('AP')) return { bg: '#e8f0fe', border: '#1a73e8', text: '#1a73e8' };
        if (type.includes('SAT') || type.includes('PSAT')) return { bg: '#e6f4ea', border: '#34a853', text: '#137333' };
        if (type.includes('Maine')) return { bg: '#fef7e0', border: '#f9ab00', text: '#b06000' };
        return { bg: '#f8f9fa', border: '#5f6368', text: '#5f6368' };
    };

    if (loading) return <div style={{ padding: '20px' }}>Loading calendar...</div>;

    return (
        <div style={{ padding: '24px' }}>
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: 0, color: '#202124' }}>📅 Testing Calendar</h2>
                <p style={{ margin: '4px 0 0', color: '#5f6368', fontSize: '14px' }}>
                    Visual overview of all scheduled testing sessions
                </p>
            </div>

            {/* Calendar Navigation */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px',
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #dadce0'
            }}>
                <button
                    onClick={() => navigateMonth(-1)}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#f1f3f4',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '16px'
                    }}
                >
                    ← Previous
                </button>
                <h3 style={{ margin: 0, fontSize: '24px', color: '#1a73e8' }}>
                    {formatMonthYear(currentMonth)}
                </h3>
                <button
                    onClick={() => navigateMonth(1)}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#f1f3f4',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: '500',
                        fontSize: '16px'
                    }}
                >
                    Next →
                </button>
            </div>

            {/* Calendar Grid */}
            <div style={{
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #dadce0',
                overflow: 'hidden'
            }}>
                {/* Weekday Headers */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    backgroundColor: '#f8f9fa',
                    borderBottom: '1px solid #dadce0'
                }}>
                    {weekDays.map(day => (
                        <div key={day} style={{
                            padding: '12px',
                            textAlign: 'center',
                            fontWeight: '600',
                            fontSize: '13px',
                            color: '#5f6368'
                        }}>
                            {day}
                        </div>
                    ))}
                </div>

                {/* Calendar Days */}
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)'
                }}>
                    {calendarDays.map((day, idx) => {
                        const dateKey = day ? getDateKey(day) : null;
                        const events = dateKey ? (eventsByDate[dateKey] || []) : [];
                        const isToday = day && new Date().toDateString() === new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day).toDateString();

                        return (
                            <div key={idx} style={{
                                minHeight: '120px',
                                padding: '8px',
                                borderRight: '1px solid #eee',
                                borderBottom: '1px solid #eee',
                                backgroundColor: isToday ? '#e8f0fe' : 'white'
                            }}>
                                {day && (
                                    <>
                                        <div style={{
                                            fontSize: '14px',
                                            fontWeight: isToday ? 'bold' : '500',
                                            color: isToday ? '#1a73e8' : '#202124',
                                            marginBottom: '6px'
                                        }}>
                                            {day}
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            {events.slice(0, 3).map((event, eidx) => {
                                                const colors = getEventColor(event.type);
                                                return (
                                                    <div key={eidx} style={{
                                                        fontSize: '10px',
                                                        padding: '3px 6px',
                                                        backgroundColor: colors.bg,
                                                        borderLeft: `3px solid ${colors.border}`,
                                                        color: colors.text,
                                                        borderRadius: '3px',
                                                        whiteSpace: 'nowrap',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis'
                                                    }}>
                                                        {event.name}
                                                    </div>
                                                );
                                            })}
                                            {events.length > 3 && (
                                                <div style={{ fontSize: '10px', color: '#5f6368', fontStyle: 'italic' }}>
                                                    +{events.length - 3} more
                                                </div>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend */}
            <div style={{
                marginTop: '16px',
                padding: '16px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #dadce0',
                display: 'flex',
                gap: '24px',
                flexWrap: 'wrap'
            }}>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#5f6368' }}>Legend:</div>
                {[
                    { label: 'AP Testing', color: '#1a73e8' },
                    { label: 'SAT/PSAT', color: '#34a853' },
                    { label: 'Maine Testing', color: '#f9ab00' },
                    { label: 'Other', color: '#5f6368' }
                ].map(item => (
                    <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <div style={{ width: '16px', height: '16px', backgroundColor: item.color, borderRadius: '3px' }}></div>
                        <span style={{ fontSize: '13px', color: '#5f6368' }}>{item.label}</span>
                    </div>
                ))}
            </div>

            {/* Upcoming Events Summary */}
            <div style={{
                marginTop: '24px',
                backgroundColor: 'white',
                borderRadius: '12px',
                border: '1px solid #dadce0',
                padding: '20px'
            }}>
                <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', color: '#202124' }}>📋 Upcoming Test Sessions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                    {Object.entries(eventsByDate)
                        .filter(([date]) => new Date(date) >= new Date(new Date().toDateString()))
                        .sort(([a], [b]) => new Date(a) - new Date(b))
                        .slice(0, 6)
                        .map(([date, events]) => (
                            <div key={date} style={{
                                padding: '14px',
                                backgroundColor: '#f8f9fa',
                                borderRadius: '8px'
                            }}>
                                <div style={{ fontWeight: '600', fontSize: '14px', color: '#1a73e8', marginBottom: '8px' }}>
                                    {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                </div>
                                {events.slice(0, 2).map((event, idx) => (
                                    <div key={idx} style={{ fontSize: '12px', color: '#5f6368', marginBottom: '4px' }}>
                                        • {event.name} ({event.room})
                                    </div>
                                ))}
                                {events.length > 2 && (
                                    <div style={{ fontSize: '11px', color: '#80868b', fontStyle: 'italic' }}>
                                        +{events.length - 2} more sessions
                                    </div>
                                )}
                            </div>
                        ))}
                </div>
                {Object.keys(eventsByDate).length === 0 && (
                    <div style={{ textAlign: 'center', color: '#5f6368', padding: '20px' }}>
                        No testing sessions scheduled yet. Create seating charts to see them here.
                    </div>
                )}
            </div>
        </div>
    );
};

export default TestingCalendar;

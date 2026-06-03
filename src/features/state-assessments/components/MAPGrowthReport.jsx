import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, query, where, doc, updateDoc } from 'firebase/firestore';
import MAPUpload from './MAPUpload';

const cleanNum = (val) => {
    if (val === undefined || val === null || val === '') return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
};

const MAPGrowthReport = () => {
    const [scores, setScores] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filter, setFilter] = useState('all'); 
    const [subjectFilter, setSubjectFilter] = useState('All Subjects');
    const [gradeFilter, setGradeFilter] = useState('All Grades');
    const [growthFilter, setGrowthFilter] = useState('all'); 
    const [schoolYear, setSchoolYear] = useState('2025-2026');
    const [showUploadModal, setShowUploadModal] = useState(false);
    const [expandedStudent, setExpandedStudent] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'lastName', direction: 'asc' });

    useEffect(() => {
        setLoading(true);
        const timer = setTimeout(() => setLoading(false), 5000);
        const q = query(collection(db, 'nwea_map_scores'), where('schoolYear', '==', schoolYear));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setScores(data);
            setLoading(false);
            clearTimeout(timer);
        }, (error) => {
            setLoading(false);
            clearTimeout(timer);
        });
        return () => { unsubscribe(); clearTimeout(timer); };
    }, [schoolYear]);

    const rowData = useMemo(() => {
        const grouped = {};
        scores.forEach(score => {
            // Fuzzy Subject Grouping: "Reading (6+)" -> "Reading", "Math (K-2)" -> "Math"
            const subj = (score.subject || '').split(' ')[0] || 'Other';
            const studentId = score.studentEmail || score.studentId;
            const key = `${studentId}_${subj}`;
            if (!key || key.startsWith('undefined')) return;
            if (!grouped[key]) {
                const [ln, fn] = (score.studentName || '').split(',').map(s => s.trim());
                grouped[key] = {
                    id: key,
                    studentId: studentId,
                    lastName: (score.lastName || ln || '').toUpperCase(),
                    firstName: (score.firstName || fn || '').toUpperCase(),
                    grade: score.grade || 'N/A',
                    subject: subj,
                    fall: { rit: null, perc: null },
                    spring: { rit: null, perc: null, scaleScore: null, achievementLevel: '', scoreId: null, isExcluded: false, engagement: 'N/A', rapidGuessing: null }
                };
            }
            const data = { 
                rit: cleanNum(score.ritScore), 
                perc: cleanNum(score.achievementPercentile), 
                scaleScore: cleanNum(score.stateScaleScore), 
                achievementLevel: score.achievementLevel || '', 
                scoreId: score.id, 
                isExcluded: score.pizzaExcluded || false,
                isManual: score.pizzaManual || false,
                engagement: score.attemptInfo?.engagement || 'Medium',
                rapidGuessing: score.attemptInfo?.rapidGuessing || null
            };
            if (score.term === 'Fall') grouped[key].fall = data;
            else if (score.term === 'Spring') grouped[key].spring = data;
        });

        return Object.values(grouped).map(item => {
            const ritGrowth = (item.fall?.rit !== null && item.spring?.rit !== null) ? (item.spring.rit - item.fall.rit) : null;
            const lvl = (item.spring?.achievementLevel || '').toLowerCase();
            // Strict Proficiency: No "Below"
            const isProficient = (item.spring?.scaleScore >= 1500) || lvl.includes('at state expectations') || lvl.includes('above state expectations');
            
            const qualifiesForPizza = item.spring?.rit && (item.spring?.isManual || (!item.spring?.isExcluded && (
                (ritGrowth !== null && ritGrowth >= -5) || 
                (item.fall?.rit === null && item.spring?.scaleScore >= 1495) // Spring-only testers qualify if State Score >= 1495
            )));

            return { ...item, ritGrowth, isProficient, qualifiesForPizza };
        });
    }, [scores]);

    const reportData = useMemo(() => {
        const studentFlags = {};
        rowData.forEach(row => {
            if (!studentFlags[row.studentId]) studentFlags[row.studentId] = { anyPizza: false, anyProficient: false };
            if (row.qualifiesForPizza) studentFlags[row.studentId].anyPizza = true;
            if (row.isProficient) studentFlags[row.studentId].anyProficient = true;
        });

        return rowData.map(row => ({
            ...row,
            studentQualifiesForPizza: studentFlags[row.studentId].anyPizza,
            studentIsProficient: studentFlags[row.studentId].anyProficient
        }));
    }, [rowData]);

    const filteredData = useMemo(() => {
        let data = reportData.filter(item => {
            const fullName = `${item.lastName} ${item.firstName}`.toLowerCase();
            const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || String(item.studentId).includes(searchTerm);
            const matchesSubject = subjectFilter === 'All Subjects' || item.subject === subjectFilter;
            const matchesGrade = gradeFilter === 'All Grades' || String(item.grade) === gradeFilter;
            const matchesFilter = filter === 'all' || 
                                  (filter === 'pizza' && item.studentQualifiesForPizza) || 
                                  (filter === 'not_pizza' && !item.studentQualifiesForPizza);
            let matchesGrowth = true;
            if (growthFilter === 'positive') matchesGrowth = (item.ritGrowth ?? -999) >= 0;
            else if (growthFilter === 'negative') matchesGrowth = (item.ritGrowth ?? 0) < -5;
            return matchesSearch && matchesSubject && matchesGrade && matchesFilter && matchesGrowth;
        });
        data.sort((a, b) => {
            const direction = sortConfig.direction === 'asc' ? 1 : -1;
            if (sortConfig.key === 'lastName') return direction * a.lastName.localeCompare(b.lastName);
            if (sortConfig.key === 'growth') return direction * ((a.ritGrowth ?? -999) - (b.ritGrowth ?? -999));
            return direction * ((a[sortConfig.key] || '') > (b[sortConfig.key] || '') ? 1 : -1);
        });
        return data;
    }, [reportData, searchTerm, filter, subjectFilter, gradeFilter, growthFilter, sortConfig]);

    const stats = useMemo(() => {
        const isSubjectSpecific = subjectFilter !== 'All Subjects';
        const uniqueStudentsInView = new Set(filteredData.map(d => d.studentId));
        
        if (isSubjectSpecific) {
            // Diagnostic Mode: Count Subject Wins
            return {
                total: filteredData.length,
                met: filteredData.filter(d => (d.ritGrowth ?? -999) >= 0).length,
                pizza: filteredData.filter(d => d.qualifiesForPizza).length,
                proficient: filteredData.filter(d => d.isProficient).length
            };
        } else {
            // Planning Mode: Count Unique Invitations
            const pizzaSet = new Set(filteredData.filter(d => d.studentQualifiesForPizza).map(d => d.studentId));
            const profSet = new Set(filteredData.filter(d => d.studentIsProficient).map(d => d.studentId));
            return {
                total: uniqueStudentsInView.size,
                met: filteredData.filter(d => (d.ritGrowth ?? -999) >= 0).length,
                pizza: pizzaSet.size,
                proficient: profSet.size
            };
        }
    }, [filteredData, subjectFilter]);

    const subjects = ['All Subjects', ...new Set(reportData.map(d => d.subject).filter(Boolean))];
    const grades = ['All Grades', ...new Set(reportData.map(d => String(d.grade)).filter(g => g !== 'N/A'))].sort();

    const getScaleStyle = (score, lvlStr) => {
        const lvl = (lvlStr || '').toLowerCase();
        const isProf = (score >= 1500) || lvl.includes('at state expectations') || lvl.includes('above state expectations');
        if (!score) return { backgroundColor: 'transparent', label: '' };
        if (score >= 1536 || lvl.includes('above')) return { backgroundColor: '#e8f0fe', color: '#1967d2', label: '🌟 Above' };
        if (isProf) return { backgroundColor: '#e6f4ea', color: '#1e8e3e', label: '🎖️ At Level' };
        return { backgroundColor: '#fce8e6', color: '#d93025', label: 'Below' };
    };

    if (loading && scores.length === 0) return <div style={{ padding: '40px', textAlign: 'center' }}><h2>Loading Dashboard...</h2></div>;

    return (
        <div style={{ padding: '24px', backgroundColor: '#f8f9fa', minHeight: '100vh', fontFamily: 'Inter, sans-serif' }}>
            {/* Upload Modal */}
            {showUploadModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ backgroundColor: 'white', padding: '32px', borderRadius: '16px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', maxWidth: '500px', width: '90%', position: 'relative' }}>
                        <button onClick={() => setShowUploadModal(false)} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: 'none', fontSize: '24px', cursor: 'pointer', color: '#5f6368' }}>×</button>
                        <MAPUpload onComplete={() => setShowUploadModal(false)} />
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: 0, color: '#1a73e8', fontSize: '28px', fontWeight: '900', letterSpacing: '-0.5px' }}>MAP Growth Dashboard</h1>
                    <p style={{ margin: '4px 0 0 0', color: '#5f6368', fontSize: '15px', fontWeight: '500' }}>School Year: {schoolYear}</p>
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <select value={schoolYear} onChange={(e) => setSchoolYear(e.target.value)} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #dadce0', backgroundColor: 'white', fontWeight: '600', color: '#3c4043', cursor: 'pointer' }}>
                        <option value="2025-2026">2025-2026</option>
                        <option value="2024-2025">2024-2025</option>
                    </select>
                    <button onClick={() => setShowUploadModal(true)} style={{ padding: '10px 20px', borderRadius: '8px', border: 'none', backgroundColor: '#1a73e8', color: 'white', fontWeight: '700', cursor: 'pointer', boxShadow: '0 2px 4px rgba(26,115,232,0.3)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>☁️</span> Import Data
                    </button>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #1a73e8' }}>
                    <div style={{ color: '#5f6368', fontSize: '11px', fontWeight: '900' }}>{subjectFilter === 'All Subjects' ? 'TOTAL STUDENTS' : 'TOTAL ROWS'}</div>
                    <div style={{ fontSize: '32px', fontWeight: '900', margin: '4px 0' }}>{stats.total}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #34a853' }}>
                    <div style={{ color: '#5f6368', fontSize: '11px', fontWeight: '900' }}>📊 MET GROWTH TARGET</div>
                    <div style={{ fontSize: '32px', fontWeight: '900', margin: '4px 0' }}>{stats.met}</div>
                </div>
                <div onClick={() => {
                    if (filter === 'all') setFilter('pizza');
                    else if (filter === 'pizza') setFilter('not_pizza');
                    else setFilter('all');
                }} style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #faad14', cursor: 'pointer' }}>
                    <div style={{ color: '#d46b08', fontSize: '11px', fontWeight: '900' }}>🍦 {subjectFilter === 'All Subjects' ? 'READY FOR ICE CREAM' : 'QUALIFIED IN ' + subjectFilter.toUpperCase()}</div>
                    <div style={{ fontSize: '32px', fontWeight: '900', margin: '4px 0' }}>{stats.pizza}</div>
                </div>
                <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', borderLeft: '5px solid #1967d2' }}>
                    <div style={{ color: '#0050b3', fontSize: '11px', fontWeight: '900' }}>🌟 {subjectFilter === 'All Subjects' ? 'UNIQUE PROFICIENT' : 'PROFICIENT IN ' + subjectFilter.toUpperCase()}</div>
                    <div style={{ fontSize: '32px', fontWeight: '900', margin: '4px 0' }}>{stats.proficient}</div>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '16px', marginBottom: '24px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #dadce0' }} />
                    <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #dadce0' }}>
                        {grades.map(g => <option key={g} value={g}>{g}</option>)}
                    </select>
                    <select value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} style={{ padding: '12px', borderRadius: '8px', border: '1px solid #dadce0' }}>
                        {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button onClick={() => {
                        if (filter === 'all') setFilter('pizza');
                        else if (filter === 'pizza') setFilter('not_pizza');
                        else setFilter('all');
                    }} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', backgroundColor: filter === 'pizza' ? '#faad14' : filter === 'not_pizza' ? '#fce8e6' : '#f1f3f4', color: filter === 'pizza' ? 'white' : filter === 'not_pizza' ? '#d93025' : '#5f6368', fontWeight: '900' }}>
                        {filter === 'pizza' ? '🍦 SHOWING PARTY' : filter === 'not_pizza' ? '🚫 NO PARTY' : '🍦 FILTER PARTY'}
                    </button>
                    <button onClick={() => {
                        const partyStudents = reportData.filter(item => item.studentQualifiesForPizza);
                        const emails = [...new Set(partyStudents.map(item => item.studentId))].filter(id => id && String(id).includes('@'));
                        navigator.clipboard.writeText(emails.join(', '));
                        alert(`Copied ${emails.length} emails to clipboard!`);
                    }} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid #dadce0', backgroundColor: 'white', color: '#5f6368', fontWeight: '900', cursor: 'pointer' }}>
                        📋 COPY EMAILS
                    </button>
                </div>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                        <tr style={{ borderBottom: '2px solid #f1f3f4', textTransform: 'uppercase', fontSize: '11px', color: '#5f6368', fontWeight: '900' }}>
                            <th style={{ padding: '16px', textAlign: 'left' }}>STUDENT</th>
                            <th style={{ padding: '16px' }}>SUBJECT</th>
                            <th style={{ padding: '16px', backgroundColor: '#f0f7ff' }}>FALL RIT</th>
                            <th style={{ padding: '16px', backgroundColor: '#f0f7ff' }}>FALL %ILE</th>
                            <th style={{ padding: '16px', backgroundColor: '#f0fff4' }}>SPRING RIT</th>
                            <th style={{ padding: '16px', backgroundColor: '#f0fff4' }}>SPRING %ILE</th>
                            <th style={{ padding: '16px' }}>GROWTH</th>
                            <th style={{ padding: '16px' }}>ENGAGEMENT</th>
                            <th style={{ padding: '16px' }}>STATE SCORE</th>
                            <th style={{ padding: '16px' }}>EXCL</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredData.map(item => {
                            const scale = getScaleStyle(item.spring?.scaleScore, item.spring?.achievementLevel);
                            return (
                                <tr key={item.id} style={{ borderBottom: '1px solid #f1f3f4' }}>
                                    <td style={{ padding: '16px' }}>
                                        <div style={{ fontWeight: '800', fontSize: '13px' }}>
                                            {item.lastName}, {item.firstName} 
                                            {item.studentQualifiesForPizza && <span style={{ marginLeft: '6px', cursor: 'help' }} title="Qualifies for Ice Cream Party">🍦</span>}
                                            {item.studentIsProficient && <span style={{ marginLeft: '4px', cursor: 'help' }} title="State Proficient">🌟</span>}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#80868b' }}>Grade {item.grade} | ID: {item.studentId}</div>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '900', backgroundColor: item.subject.startsWith('R') ? '#e8f0fe' : '#e6fffa', color: item.subject.startsWith('R') ? '#1967d2' : '#08805b' }}>{item.subject.startsWith('R') ? 'RE' : 'MATH'}</span>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fbff' }}>{item.fall?.rit ?? '-'}</td>
                                    <td style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fbff' }}>{item.fall?.perc ? `${item.fall.perc}%` : '-'}</td>
                                    <td style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fff9', fontWeight: '900' }}>{item.spring?.rit ?? '-'}</td>
                                    <td style={{ padding: '16px', textAlign: 'center', backgroundColor: '#f8fff9' }}>{item.spring?.perc ? `${item.spring.perc}%` : '-'}</td>
                                    <td style={{ padding: '8px' }}>
                                        <div style={{ padding: '12px 0', borderRadius: '8px', fontWeight: '900', fontSize: '18px', textAlign: 'center', ...(item.ritGrowth !== null ? (item.ritGrowth >= -5 ? { backgroundColor: '#e6f4ea', color: '#1e8e3e' } : { backgroundColor: '#fce8e6', color: '#d93025' }) : {}) }}>
                                            {item.ritGrowth !== null ? (item.ritGrowth >= 0 ? `+${item.ritGrowth}` : item.ritGrowth) : '-'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <div style={{ 
                                            padding: '12px 10px', 
                                            borderRadius: '8px', 
                                            fontWeight: '900', 
                                            fontSize: '12px', 
                                            textAlign: 'center', 
                                            backgroundColor: item.spring?.engagement === 'High' ? '#e6f4ea' : item.spring?.engagement === 'Low' ? '#fce8e6' : '#e8f0fe',
                                            color: item.spring?.engagement === 'High' ? '#1e8e3e' : item.spring?.engagement === 'Low' ? '#d93025' : '#1967d2'
                                        }}>
                                            {item.spring?.engagement?.toUpperCase() || 'MEDIUM'}
                                            {item.spring?.rapidGuessing && <div style={{ fontSize: '9px', opacity: 0.7 }}>RG: {item.spring.rapidGuessing}%</div>}
                                        </div>
                                    </td>
                                    <td style={{ padding: '8px' }}>
                                        <div style={{ padding: '12px 10px', borderRadius: '8px', fontWeight: '900', fontSize: '14px', textAlign: 'center', backgroundColor: scale.backgroundColor, color: scale.color }}>
                                            {item.spring?.scaleScore ? `${item.spring.scaleScore} ${scale.label}` : '-'}
                                        </div>
                                    </td>
                                    <td style={{ padding: '16px', textAlign: 'center' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            {item.spring?.scoreId && (
                                                <>
                                                    <button 
                                                        onClick={() => updateDoc(doc(db, 'nwea_map_scores', item.spring.scoreId), { pizzaManual: !item.spring.isManual, pizzaExcluded: false })} 
                                                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: item.spring?.isManual ? 1 : 0.2 }}
                                                        title={item.spring?.isManual ? "Remove Manual Qualification" : "Manually Qualify for Ice Cream"}
                                                    >
                                                        🍦
                                                    </button>
                                                    <button 
                                                        onClick={() => updateDoc(doc(db, 'nwea_map_scores', item.spring.scoreId), { pizzaExcluded: !item.spring.isExcluded, pizzaManual: false })} 
                                                        style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '18px', opacity: item.spring?.isExcluded ? 1 : 0.2 }}
                                                        title={item.spring?.isExcluded ? "Remove Exclusion" : "Exclude from Ice Cream Party"}
                                                    >
                                                        🚫
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MAPGrowthReport;

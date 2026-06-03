import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import StudentViewPreview from './StudentViewPreview';
import { useAuth } from '../../../context/AuthContext';

const StudentTestSearch = ({ impersonatedCaseload = null }) => {
    const { user, userProfile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [allData, setAllData] = useState({});
    const [loading, setLoading] = useState(true);
    const [showInactive, setShowInactive] = useState(false);
    const [previewStudent, setPreviewStudent] = useState(null);

    useEffect(() => {
        const unsubscribes = [];
        const dataBySource = {};

        const updateState = () => {
            setAllData(prev => ({ ...prev, ...dataBySource }));
            setLoading(false);
        };

        // 1. AP Registrations
        const unsubAP = onSnapshot(collection(db, 'ap_registrations'), (snap) => {
            dataBySource.ap = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    category: 'AP',
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    testName: data.course || 'AP Exam',
                    email: (data.email || '').toLowerCase()
                };
            });
            updateState();
        }, (error) => console.error("Error fetching AP:", error));
        unsubscribes.push(unsubAP);

        // 2. SAT Registrations
        const unsubSAT = onSnapshot(collection(db, 'sat_registrations'), (snap) => {
            dataBySource.sat = snap.docs.map(d => {
                const data = d.data();
                return {
                    id: d.id,
                    ...data,
                    category: 'SAT/PSAT',
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    testName: data.testType || 'SAT',
                    email: (data.email || '').toLowerCase()
                };
            });
            updateState();
        }, (error) => console.error("Error fetching SAT:", error));
        unsubscribes.push(unsubSAT);

        // 3. Master List (Maine Tests)
        const unsubMaster = onSnapshot(collection(db, 'master_students'), (snap) => {
            const maineTests = [];
            snap.forEach(doc => {
                const data = doc.data();

                // Parse Name if separate fields are missing
                let fName = data.firstName;
                let lName = data.lastName;
                if (!fName || !lName) {
                    const rawName = data.name || '';
                    if (rawName.includes(',')) {
                        const parts = rawName.split(',');
                        lName = parts[0].trim();
                        fName = parts[1]?.trim() || '';
                    } else {
                        const parts = rawName.split(' ');
                        if (parts.length > 1) {
                            lName = parts.pop();
                            fName = parts.join(' ');
                        } else {
                            fName = rawName;
                            lName = '';
                        }
                    }
                }

                const grade = String(data.grade || '').replace(/[^0-9]/g, '');
                const commonData = {
                    ...data,
                    firstName: fName,
                    lastName: lName,
                    email: (data.email || '').toLowerCase()
                };

                // Maine Through Year (10th)
                if (grade === '10' || data.maine_through_year_include) {
                    maineTests.push({
                        id: `${doc.id}_mty`,
                        ...commonData,
                        category: 'Maine Through Year',
                        testName: 'Maine Through Year'
                    });
                }
                // Maine Science (11th)
                if (grade === '11' || data.maine_science_include) {
                    maineTests.push({
                        id: `${doc.id}_msci`,
                        ...commonData,
                        category: 'Maine Science',
                        testName: 'Maine Science'
                    });
                }
            });
            dataBySource.maine = maineTests;
            updateState();
        }, (error) => console.error("Error fetching Master:", error));
        unsubscribes.push(unsubMaster);

        return () => unsubscribes.forEach(u => u());
    }, []);

    const activeCaseload = impersonatedCaseload || (userProfile?.role === 'case_manager' ? userProfile.caseloadName : null) || (userProfile?.role === 'counselor' ? userProfile.staffName : null);
    
    // Show results if they are typing a search, OR if they are viewing their caseload default view
    const isSearching = searchTerm.length >= 2;
    const isCaseloadDefault = !isSearching && searchTerm.length === 0 && activeCaseload;

    const searchResults = (isSearching || isCaseloadDefault)
        ? Object.values(allData).flat().filter(s => {
            // Filter by search term
            if (isSearching) {
                const matchesSearch = `${s.firstName} ${s.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    s.email?.toLowerCase().includes(searchTerm.toLowerCase());
                if (!matchesSearch) return false;
            }

            // Caseload Link Filtering
            if (activeCaseload) {
                const term = activeCaseload.toLowerCase().trim();
                if (!(s.advisor || '').toLowerCase().includes(term)) return false;
            }

            // Filter Inactive (unless toggle is on)
            if (!showInactive && s.status === 'Inactive') return false;

            return true;
        })
        : [];

    // Group results by NORMALIZED NAME (not email) to merge records with different emails
    const groupedByStudent = {};
    searchResults.forEach(result => {
        const normalizedName = `${(result.firstName || '').toLowerCase().trim()} ${(result.lastName || '').toLowerCase().trim()}`.trim();
        const key = normalizedName || result.email || 'unknown';

        if (!groupedByStudent[key]) {
            groupedByStudent[key] = {
                name: `${result.firstName} ${result.lastName}`.trim(),
                emails: new Set(),
                grade: result.grade,
                tests: []
            };
        }
        if (result.email) {
            groupedByStudent[key].emails.add(result.email);
        }
        if (result.grade && (!groupedByStudent[key].grade || String(result.grade).length < String(groupedByStudent[key].grade).length)) {
            groupedByStudent[key].grade = result.grade;
        }
        // Avoid duplicate tests of the same category for this key
        const alreadyHasTest = groupedByStudent[key].tests.some(t => t.category === result.category && t.testName === result.testName);
        if (!alreadyHasTest) {
            groupedByStudent[key].tests.push(result);
        }
    });

    return (
        <div style={{ padding: '8px 0' }}>
            <div style={{ marginBottom: '24px' }}>
                <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '22px', fontWeight: 'bold' }}>🔍 Student Unified Test Search</h2>
                <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)', fontSize: '13px' }}>
                    Look up any student's complete testing schedule across SAT/PSAT, AP, and Maine State programs.
                </p>
            </div>

            {/* Search Box - Premium Glassmorphic */}
            <div className="glass-panel" style={{
                padding: '24px',
                marginBottom: '24px',
                background: 'rgba(255, 255, 255, 0.4)'
            }}>
                <div style={{ display: 'flex', gap: '20px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <input
                        type="text"
                        placeholder="Type student name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            flex: 1,
                            minWidth: '280px',
                            maxWidth: '450px',
                            padding: '12px 18px',
                            fontSize: '15px',
                            borderRadius: '8px',
                            border: '1px solid var(--glass-border)',
                            backgroundColor: 'white',
                            outline: 'none',
                            boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.05)',
                            transition: 'border-color 0.2s'
                        }}
                        autoFocus
                    />
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '14px', color: 'var(--fa-dark-blue)', cursor: 'pointer', fontWeight: '500' }}>
                        <input
                            type="checkbox"
                            checked={showInactive}
                            onChange={(e) => setShowInactive(e.target.checked)}
                            style={{ marginRight: '8px', width: '16px', height: '16px', accentColor: 'var(--fa-blue)' }}
                        />
                        Include Inactive Records
                    </label>
                </div>
                {searchTerm.length > 0 && searchTerm.length < 2 && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--fa-red)', fontWeight: 'bold' }}>
                        Please enter at least 2 characters to search...
                    </div>
                )}
            </div>

            {/* Results Display */}
            {(searchTerm.length >= 2 || isCaseloadDefault) && (
                <div>
                    {Object.keys(groupedByStudent).length === 0 ? (
                        <div className="glass-panel" style={{
                            textAlign: 'center',
                            padding: '48px 24px',
                            color: 'var(--fa-warm-gray)',
                            background: 'rgba(255, 255, 255, 0.2)'
                        }}>
                            <span style={{ fontSize: '32px', display: 'block', marginBottom: '12px' }}>📭</span>
                            No matching students found for "{searchTerm}".
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {Object.values(groupedByStudent).map((student, idx) => (
                                <div key={idx} className="glass-panel" style={{
                                    borderRadius: '12px',
                                    overflow: 'hidden',
                                    padding: '0',
                                    border: '1px solid var(--glass-border)',
                                    background: 'rgba(255, 255, 255, 0.5)'
                                }}>
                                    <div style={{
                                        padding: '18px 24px',
                                        backgroundColor: 'rgba(0, 70, 139, 0.05)',
                                        borderBottom: '1px solid var(--glass-border)',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        flexWrap: 'wrap',
                                        gap: '12px'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 'bold', fontSize: '17px', color: 'var(--fa-dark-blue)' }}>
                                                {student.name}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: '2px' }}>
                                                📧 {Array.from(student.emails).join(' / ')} • Grade {student.grade || 'N/A'}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                backgroundColor: 'var(--fa-blue)',
                                                color: 'white',
                                                padding: '4px 12px',
                                                borderRadius: '20px',
                                                fontSize: '12px',
                                                fontWeight: 'bold'
                                            }}>
                                                {student.tests.length} scheduled program{student.tests.length !== 1 ? 's' : ''}
                                            </div>
                                            <button 
                                                onClick={() => setPreviewStudent({ email: Array.from(student.emails)[0], name: student.name })}
                                                style={{
                                                    padding: '6px 14px',
                                                    backgroundColor: 'white',
                                                    border: '1px solid var(--fa-blue)',
                                                    color: 'var(--fa-blue)',
                                                    borderRadius: '6px',
                                                    fontSize: '12px',
                                                    fontWeight: 'bold',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseOver={(e) => { e.currentTarget.style.backgroundColor = 'var(--fa-blue)'; e.currentTarget.style.color = 'white'; }}
                                                onMouseOut={(e) => { e.currentTarget.style.backgroundColor = 'white'; e.currentTarget.style.color = 'var(--fa-blue)'; }}
                                            >
                                                👁️ View as Student
                                            </button>
                                        </div>
                                    </div>
                                    <div style={{ padding: '20px 24px' }}>
                                        {student.tests.map((test, tidx) => (
                                            <div key={tidx} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '10px 0',
                                                borderBottom: tidx < student.tests.length - 1 ? '1px solid rgba(0,0,0,0.05)' : 'none',
                                                flexWrap: 'wrap'
                                            }}>
                                                <span style={{
                                                    padding: '3px 8px',
                                                    backgroundColor: test.category === 'AP' ? 'rgba(0, 70, 139, 0.08)' :
                                                        test.category === 'SAT/PSAT' ? 'rgba(52, 168, 83, 0.08)' :
                                                        test.category === 'Maine Through Year' ? 'rgba(234, 176, 16, 0.08)' : 'rgba(158, 36, 50, 0.08)',
                                                    color: test.category === 'AP' ? 'var(--fa-blue)' :
                                                        test.category === 'SAT/PSAT' ? '#2e7d32' :
                                                        test.category === 'Maine Through Year' ? '#b06000' : 'var(--fa-red)',
                                                    borderRadius: '6px',
                                                    fontSize: '11px',
                                                    fontWeight: 'bold',
                                                    textTransform: 'uppercase'
                                                }}>
                                                    {test.category}
                                                </span>
                                                <span style={{ fontWeight: '600', color: 'var(--fa-dark-blue)', fontSize: '14px' }}>{test.testName}</span>
                                                {test.date && <span style={{ color: 'var(--fa-warm-gray)', fontSize: '13px' }}>• 📅 {test.date}</span>}
                                                {test.room && <span style={{ color: 'var(--fa-warm-gray)', fontSize: '13px' }}>• 🏫 Room {test.room}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {searchTerm.length === 0 && !isCaseloadDefault && (
                <div className="glass-panel" style={{
                    textAlign: 'center',
                    padding: '64px 32px',
                    backgroundColor: 'rgba(255, 255, 255, 0.25)',
                    border: '1.5px dashed var(--glass-border)'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
                    <h3 style={{ color: 'var(--fa-dark-blue)', marginBottom: '8px', fontWeight: 'bold' }}>Unified Search Active</h3>
                    <p style={{ color: 'var(--fa-warm-gray)', fontSize: '13px', maxWidth: '480px', margin: '0 auto', lineHeight: '1.5' }}>
                        Enter a student's name or email address above. The system will compile all registries across SAT, AP, and Maine State programs, resolving multiple credentials automatically.
                    </p>
                </div>
            )}

            {/* Student Preview Modal */}
            {previewStudent && (
                <StudentViewPreview 
                    studentEmail={previewStudent.email}
                    studentName={previewStudent.name}
                    onClose={() => setPreviewStudent(null)}
                />
            )}
        </div>
    );
};

export default StudentTestSearch;

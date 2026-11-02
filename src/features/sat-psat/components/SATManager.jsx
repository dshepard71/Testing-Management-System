import React, { useEffect, useState } from 'react';
import { db } from '../../../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, writeBatch, getDocs, setDoc } from 'firebase/firestore';
import Papa from 'papaparse';
import { decryptText, encryptText } from '../../../utils/crypto';

const normalizeDOB = (dob) => {
    if (!dob) return '';
    const parts = dob.trim().split(/[/.-]/);
    if (parts.length !== 3) return dob;
    let [m, d, y] = parts;
    if (m.length === 1) m = `0${m}`;
    if (d.length === 1) d = `0${d}`;
    if (y.length === 2) y = `20${y}`;
    return `${m}/${d}/${y}`;
};

const SATManager = () => {
    const [registrations, setRegistrations] = useState([]);
    const [masterStudents, setMasterStudents] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editData, setEditData] = useState({});
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showManualModal, setShowManualModal] = useState(false);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [paymentFilter, setPaymentFilter] = useState('all');     // 'all', 'paid', 'pending'
    const [billedFilter, setBilledFilter] = useState('all');       // 'all', 'billed', 'not_billed'
    const [tenderFilter, setTenderFilter] = useState('all');       // 'all', 'Cash', 'Check', 'CC', 'Account'
    const [accommodationFilter, setAccommodationFilter] = useState('all'); // 'all', 'has'
    const [examFilter, setExamFilter] = useState('all');           // 'all', 'SAT', 'PSAT'
    const [roomFilter, setRoomFilter] = useState('all');           // 'all', 'standard', 'extended', 'small_group'
    const [studentTypeFilter, setStudentTypeFilter] = useState([]); // [] = all, or array of selected types
    const [manualData, setManualData] = useState({
        firstName: '', lastName: '', email: '', testType: 'SAT', studentType: 'boarding', counselor: '', grade: '11', accommodations: 'None', waiverEligible: 'No'
    });

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'sat_registrations'), (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                return {
                    id: doc.id,
                    ...docData,
                    accommodations: decryptText(docData.accommodations || ''),
                    accommodationNotes: decryptText(docData.accommodationNotes || '')
                };
            });
            setRegistrations(data);
            setLoading(false);
        }, (error) => {
            console.error("Firestore error in SATManager:", error);
            setLoading(false);
        });

        const timer = setTimeout(() => {
            setLoading(false);
        }, 10000);

        const unsubMaster = onSnapshot(collection(db, 'master_students'), (snapshot) => {
            setMasterStudents(snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    dob: decryptText(data.dob || ''),
                    stateId: decryptText(data.stateId || ''),
                    accommodations: decryptText(data.accommodations || ''),
                    accommodationNotes: decryptText(data.accommodationNotes || '')
                };
            }));
        });

        return () => {
            unsubscribe();
            unsubMaster();
            clearTimeout(timer);
        };
    }, []);

    const handleEdit = (reg) => {
        setEditingId(reg.id);
        setEditData({ ...reg });
    };

    const handleSave = async (id) => {
        try {
            const docRef = doc(db, 'sat_registrations', id);
            const finalFee = editData.waiverEligible === 'Yes' ? 0 : (editData.testType === 'SAT' ? 60 : 18);

            await updateDoc(docRef, {
                ...editData,
                accommodations: encryptText(editData.accommodations || 'None'),
                feeAmount: finalFee,
                lastUpdated: serverTimestamp()
            });
            setEditingId(null);
        } catch (error) {
            console.error("Error saving registration:", error);
            alert("Failed to save changes.");
        }
    };

    const handleManualAdd = async (e) => {
        e.preventDefault();
        try {
            const fee = manualData.waiverEligible === 'Yes' ? 0 : (manualData.testType === 'SAT' ? 60 : 18);
            const docRef = doc(collection(db, 'sat_registrations'), manualData.email.toLowerCase().replace(/[.#$/[\]]/g, '_'));
            await setDoc(docRef, {
                ...manualData,
                accommodations: encryptText(manualData.accommodations || 'None'),
                feeAmount: fee,
                paymentRecd: 'No',
                submittedToBO: false,
                createdAt: serverTimestamp(),
                lastUpdated: serverTimestamp()
            });
            setManualData({
                firstName: '', lastName: '', email: '', testType: 'SAT', studentType: 'boarding', counselor: '', grade: '11', accommodations: 'None', waiverEligible: 'No'
            });
            setShowManualModal(false);
            alert("Student added successfully!");
        } catch (error) {
            console.error("Error adding student:", error);
            alert("Failed to add student.");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Delete this registration?")) {
            try {
                await deleteDoc(doc(db, 'sat_registrations', id));
            } catch (error) {
                console.error("Error deleting:", error);
            }
        }
    };

    const handleBulkDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Are you sure you want to delete ${selectedIds.length} selected registrations?`)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.delete(doc(db, 'sat_registrations', id));
            });
            await batch.commit();
            setSelectedIds([]);
            alert(`Deleted ${selectedIds.length} registrations.`);
        } catch (error) {
            console.error("Bulk delete error:", error);
            alert("Failed to delete records.");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkMarkSubmitted = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Mark ${selectedIds.length} selected student(s) as Submitted to the Business Office?`)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.update(doc(db, 'sat_registrations', id), {
                    submittedToBO: true,
                    lastUpdated: serverTimestamp()
                });
            });
            await batch.commit();
            setSelectedIds([]);
            alert(`✅ Marked ${selectedIds.length} registrations as Submitted to Business Office.`);
        } catch (error) {
            console.error("Error bulk updating submittedToBO:", error);
            alert("Failed to update status.");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkBillToAccount = async () => {
        if (selectedIds.length === 0) return;
        if (!window.confirm(`Mark ${selectedIds.length} selected student(s) as 'Billed to Account' (Payment: Yes, Tender: Account)?`)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            selectedIds.forEach(id => {
                batch.update(doc(db, 'sat_registrations', id), {
                    paymentRecd: 'Yes',
                    paymentTender: 'Account',
                    billed: true,
                    lastUpdated: serverTimestamp()
                });
            });
            await batch.commit();
            setSelectedIds([]);
            alert(`✅ Successfully marked ${selectedIds.length} student(s) as Billed to Account!`);
        } catch (error) {
            console.error("Error bulk billing to account:", error);
            alert("Failed to update billing status.");
        } finally {
            setLoading(false);
        }
    };

    const toggleSelectAll = () => {
        if (selectedIds.length === filtered.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(filtered.map(r => r.id));
        }
    };

    const toggleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const exportToCollegeboard = async (targetTest = 'all') => {
        let isFall = false;
        if (targetTest === 'PSAT' || targetTest === 'all') {
            isFall = window.confirm("Is this export for the FALL testing cycle?\n\n- Click OK for FALL (10th/11th graders are marked as PNM)\n- Click Cancel for SPRING (10th graders are marked as P10)");
        }

        try {
            const masterSnap = await getDocs(collection(db, 'master_students'));
            const masterList = masterSnap.docs.reduce((acc, doc) => {
                const data = doc.data();
                if (data.email) {
                    acc[data.email.toLowerCase()] = {
                        ...data,
                        dob: decryptText(data.dob || ''),
                        stateId: decryptText(data.stateId || ''),
                        accommodations: decryptText(data.accommodations || ''),
                        accommodationNotes: decryptText(data.accommodationNotes || '')
                    };
                }
                return acc;
            }, {});

            // Filter registrations by target test if specified (SAT vs PSAT)
            const filteredRegs = registrations.filter(reg => {
                if (targetTest === 'SAT') return (reg.testType || '').toUpperCase().includes('SAT') && !(reg.testType || '').toUpperCase().includes('PSAT');
                if (targetTest === 'PSAT') return (reg.testType || '').toUpperCase().includes('PSAT');
                return true;
            });

            if (filteredRegs.length === 0) {
                alert(`No registrations found for ${targetTest === 'all' ? 'export' : targetTest}.`);
                return;
            }

            const exportData = filteredRegs.map(reg => {
                const master = masterList[reg.email?.toLowerCase()] || {};
                
                // Determine student type (homeschool check)
                const studentType = String(reg.studentType || master.studentType || master.schoolProgram || '').toLowerCase();
                const isHomeschool = studentType.includes('homeschool');

                // Testing AI Code (Col A): Fryeburg Academy is 200390
                const testingAI = String(master.testingAI || '200390').replace(/\D/g, '').slice(0, 6) || '200390';
                
                // Attending AI Code (Col B):
                // 970000 if homeschooled, otherwise 200390 for regular students
                let attendingAI = '200390';
                if (isHomeschool) {
                    attendingAI = master.attendingAI ? String(master.attendingAI).replace(/\D/g, '').slice(0, 6) : '970000';
                } else if (master.attendingAI) {
                    attendingAI = String(master.attendingAI).replace(/\D/g, '').slice(0, 6) || '200390';
                }

                // First Name (Col C): Max 30 chars, allowed: a-z, A-Z, hyphen (-), space, apostrophe (')
                const cleanFirst = (reg.firstName || master.firstName || '')
                    .replace(/[^a-zA-Z\s'-]/g, '')
                    .trim()
                    .slice(0, 30);

                // Middle Initial (Col D): 1 char, Alpha (A-Z)
                const cleanMiddle = (master.middleName || '')
                    .replace(/[^a-zA-Z]/g, '')
                    .charAt(0)
                    .toUpperCase();

                // Last Name (Col E): Max 35 chars, allowed: a-z, A-Z, hyphen (-), space, apostrophe (')
                // Strip common generational suffixes (Jr, Sr, II, III, IV)
                const rawLast = (reg.lastName || master.lastName || '')
                    .replace(/\b(jr\.?|sr\.?|ii|iii|iv|v)\b/gi, '')
                    .replace(/[^a-zA-Z\s'-]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .slice(0, 35);

                // Date of Birth (Col F): MM/DD/YYYY
                const dob = normalizeDOB(master.dob || '');

                // Gender (Col G): F, M, or U (Not Specified)
                let gender = 'U';
                const g = (master.gender || '').trim().toUpperCase();
                if (g === 'M' || g === 'MALE') gender = 'M';
                else if (g === 'F' || g === 'FEMALE') gender = 'F';

                // Grade (Col H): 6, 7, 8, 9, 10, 11, 12, N, 1C, 2C (no leading zero for single digits)
                let rawGrade = String(reg.grade || master.grade || '').trim();
                let grade = '';
                if (['6', '7', '8', '9', '10', '11', '12', 'N', '1C', '2C'].includes(rawGrade.toUpperCase())) {
                    grade = rawGrade.toUpperCase();
                } else {
                    const numGrade = parseInt(rawGrade.replace(/\D/g, ''), 10);
                    if (!isNaN(numGrade) && numGrade >= 6 && numGrade <= 12) {
                        grade = String(numGrade);
                    } else if (rawGrade.toUpperCase().startsWith('N')) {
                        grade = 'N';
                    } else {
                        grade = '11'; // Default sensible high school junior grade if missing
                    }
                }

                // Test (Col I): PNM, P89, P10, SAT
                let testCode = 'SAT';
                const t = (reg.testType || '').toUpperCase();
                if (t.includes('PSAT')) {
                    if (isFall) {
                        if (grade === '8' || grade === '9') testCode = 'P89';
                        else testCode = 'PNM';
                    } else {
                        if (grade === '10') testCode = 'P10';
                        else if (grade === '8' || grade === '9') testCode = 'P89';
                        else testCode = 'PNM';
                    }
                } else if (t.includes('SAT')) {
                    testCode = 'SAT';
                }

                // School Student ID (Col J): Max 30 alphanumeric, no spaces
                let schoolStudentId = '';
                if (isHomeschool) {
                    const cleanLastLower = (reg.lastName || master.lastName || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
                    schoolStudentId = `970000${cleanLastLower}`.slice(0, 30);
                } else {
                    const rawSchoolId = String(master.schoolId || master.userId || master.user_id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
                    schoolStudentId = rawSchoolId || (reg.email ? reg.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').slice(0, 30) : '');
                }

                // District Student ID (Col K): Max 30 alphanumeric, no spaces, optional
                const districtStudentId = '';

                // State Student ID (Col L): Max 30 alphanumeric, no spaces, optional
                const stateStudentId = String(master.stateId || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);

                return {
                    'Testing AI Code': testingAI,
                    'Attending AI Code': attendingAI,
                    'First Name': cleanFirst,
                    'Middle Initial': cleanMiddle,
                    'Last Name': rawLast,
                    'Date of Birth': dob,
                    'Gender': gender,
                    'Grade': grade,
                    'Test': testCode,
                    'School Student ID': schoolStudentId,
                    'District Student ID': districtStudentId,
                    'State Student ID': stateStudentId
                };
            });

            const csv = Papa.unparse(exportData);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            const filename = targetTest === 'all'
                ? `CollegeBoard_Export_${new Date().toISOString().split('T')[0]}.csv`
                : `CollegeBoard_${targetTest}_Export_${new Date().toISOString().split('T')[0]}.csv`;
            link.setAttribute("href", url);
            link.setAttribute("download", filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error("Export error:", error);
            alert("Failed to generate export.");
        }
    };

    const handleBulkImport = async () => {
        if (!bulkText.trim()) return;
        setLoading(true);
        try {
            const existingSnapshot = await getDocs(collection(db, 'sat_registrations'));
            const existingDocIds = new Set();
            existingSnapshot.forEach(doc => {
                existingDocIds.add(doc.id);
            });

            const batch = writeBatch(db);
            const rows = bulkText.split('\n');
            let importedCount = 0;
            let skippedCount = 0;

            const masterMap = {};
            masterStudents.forEach(m => {
                if (m.email) masterMap[m.email.toLowerCase().trim()] = m;
            });

            rows.forEach((row, index) => {
                if (!row.trim()) return;
                if (index === 0 && (row.toLowerCase().includes('email') || row.toLowerCase().includes('timestamp'))) return;
                
                // Support both Tab-separated (copy-paste from Sheets) and Comma-separated (CSV)
                let cols = row.split('\t');
                if (cols.length === 1 && row.includes(',')) {
                    cols = row.split(',');
                }
                if (cols.length < 3) return;

                // Detect email column: either cols[1] (Google Form with timestamp) or cols[0]
                let email = '';
                let rawName = '';
                let rawGrade = '';
                let rawExam = '';

                if (cols[1] && cols[1].includes('@')) {
                    // Standard Google Form: [0] Timestamp, [1] Email, [2] Name, [3] Grade, [4] Exam
                    email = cols[1].trim().toLowerCase();
                    rawName = cols[2]?.trim() || '';
                    rawGrade = cols[3]?.trim() || '';
                    rawExam = cols[4]?.trim() || '';
                } else if (cols[0] && cols[0].includes('@')) {
                    // Export without timestamp: [0] Email, [1] Name, [2] Grade, [3] Exam
                    email = cols[0].trim().toLowerCase();
                    rawName = cols[1]?.trim() || '';
                    rawGrade = cols[2]?.trim() || '';
                    rawExam = cols[3]?.trim() || '';
                } else {
                    // Fallback to searching any column for an email
                    const foundEmailCol = cols.find(c => c.includes('@'));
                    if (foundEmailCol) email = foundEmailCol.trim().toLowerCase();
                }

                if (!email) return;

                const docId = email.replace(/[.#$/[\]]/g, '_');
                const master = masterMap[email];

                // Determine official First Name and Last Name:
                let firstName = master?.firstName || '';
                let lastName = master?.lastName || '';
                
                // If not in master list, parse rawName:
                if (!firstName && !lastName && rawName) {
                    if (rawName.includes(',')) {
                        const parts = rawName.split(',');
                        lastName = parts[0]?.trim();
                        firstName = parts[1]?.trim();
                    } else {
                        const parts = rawName.split(' ');
                        firstName = parts[0]?.trim();
                        lastName = parts.slice(1).join(' ').trim();
                    }
                }

                // Determine Grade:
                let grade = '11';
                if (master?.grade) {
                    grade = String(master.grade).replace(/[^0-9]/g, '');
                } else if (rawGrade) {
                    grade = String(rawGrade).replace(/[^0-9]/g, '');
                }

                // Determine Test Type:
                let testType = 'SAT';
                const examCheck = (rawExam || '').toUpperCase();
                if (examCheck.includes('PSAT')) testType = 'PSAT';
                else if (examCheck.includes('SAT')) testType = 'SAT';

                let studentType = master?.schoolProgram || master?.studentType || 'boarding';
                if (String(studentType).toLowerCase().includes('day') || String(studentType).toLowerCase().includes('district') || String(studentType).toLowerCase().includes('commuter')) {
                    studentType = 'day';
                }

                const counselor = master?.advisor || master?.counselor || '';
                const waiverEligible = master?.waiverEligible || 'No';
                const fee = waiverEligible === 'Yes' ? 0 : (testType === 'SAT' ? 60 : 18);
                const docRef = doc(collection(db, 'sat_registrations'), docId);
                
                batch.set(docRef, {
                    firstName: firstName || 'Unknown',
                    lastName: lastName || 'Student',
                    email: email,
                    studentType: studentType,
                    counselor: counselor,
                    testType: testType,
                    grade: grade || '11',
                    waiverEligible: waiverEligible,
                    feeAmount: fee,
                    testingCycle: 'Fall 2026',
                    createdAt: serverTimestamp(),
                    lastUpdated: serverTimestamp()
                }, { merge: true });

                if (existingDocIds.has(docId)) {
                    skippedCount++;
                } else {
                    importedCount++;
                }
                existingDocIds.add(docId);
            });

            await batch.commit();

            let message = `Import complete!\n\n✅ New registrations added: ${importedCount}`;
            if (skippedCount > 0) {
                message += `\n⏭️ Duplicates skipped: ${skippedCount}`;
            }
            alert(message);

            setBulkText('');
            setShowBulkModal(false);
        } catch (error) {
            console.error("Bulk import error:", error);
            alert("Failed to import registrations.");
        } finally {
            setLoading(false);
        }
    };

    const finalizeDeposit = async (readyList) => {
        if (!window.confirm(`Finalize deposit for ${readyList.length} students? This will mark them as submitted to the Business Office.`)) return;

        try {
            const batch = writeBatch(db);
            readyList.forEach(r => {
                const docRef = doc(db, 'sat_registrations', r.id);
                batch.update(docRef, {
                    submittedToBO: true,
                    lastUpdated: serverTimestamp()
                });
            });
            await batch.commit();
            setShowDepositModal(false);
            alert("Deposit finalized successfully!");
        } catch (error) {
            console.error("Error finalizing deposit:", error);
            alert("Failed to finalize deposit.");
        }
    };

    // Helper to categorize student testing room needs based on FA rules:
    // If student has both Extended Time and Small Group -> Extended Time room
    // If student has Extended Time -> Extended Time room
    // If student has Small Group only -> Small Group room
    // If None / blank -> Standard room
    const getStudentRoomCategory = (r) => {
        const master = masterStudents.find(m => m.email?.toLowerCase() === r.email?.toLowerCase()) ||
            masterStudents.find(m => m.lastName?.toLowerCase() === r.lastName?.toLowerCase() &&
                m.firstName?.toLowerCase() === r.firstName?.toLowerCase());
        const rawAcc = `${r.accommodations || ''} ${master?.accommodations || ''} ${r.accommodationNotes || ''} ${master?.accommodationNotes || ''}`.toLowerCase();
        
        const hasExtended = rawAcc.includes('extended') || rawAcc.includes('extra time') || rawAcc.includes('time and a half') || rawAcc.includes('double time');
        const hasSmallGroup = rawAcc.includes('small group') || rawAcc.includes('small-group');

        if (hasExtended) return 'extended'; // If both or extended -> goes to Extended Time
        if (hasSmallGroup) return 'small_group';
        if (rawAcc.trim() && !rawAcc.includes('none')) return 'special'; // Other specific accom
        return 'standard';
    };

    // Calculate room & exam breakdown metrics across all registrations
    const satRegistrations = registrations.filter(r => (r.testType || '').toUpperCase().includes('SAT') && !(r.testType || '').toUpperCase().includes('PSAT'));
    const psatRegistrations = registrations.filter(r => (r.testType || '').toUpperCase().includes('PSAT'));

    // Count rooms according to the active exam filter (or all)
    const baseRoomList = examFilter === 'all' 
        ? registrations 
        : examFilter === 'SAT' ? satRegistrations : psatRegistrations;

    const roomCounts = baseRoomList.reduce((acc, r) => {
        const cat = getStudentRoomCategory(r);
        acc[cat] = (acc[cat] || 0) + 1;
        return acc;
    }, { standard: 0, extended: 0, small_group: 0, special: 0 });

    const filtered = registrations.filter(r => {
        const matchesSearch = `${r.firstName} ${r.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
            r.email?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesPayment = paymentFilter === 'all' ||
            (paymentFilter === 'paid' && r.paymentRecd === 'Yes') ||
            (paymentFilter === 'pending' && r.paymentRecd !== 'Yes');

        const isSat = (r.testType || '').toUpperCase().includes('SAT') && !(r.testType || '').toUpperCase().includes('PSAT');
        const isPsat = (r.testType || '').toUpperCase().includes('PSAT');
        const matchesExam = examFilter === 'all' ||
            (examFilter === 'SAT' && isSat) ||
            (examFilter === 'PSAT' && isPsat);

        const roomCat = getStudentRoomCategory(r);
        const matchesRoom = roomFilter === 'all' || roomFilter === roomCat;

        let hasAccom = false;
        if (accommodationFilter === 'has') {
            const master = masterStudents.find(m => m.email?.toLowerCase() === r.email?.toLowerCase()) ||
                masterStudents.find(m => m.lastName?.toLowerCase() === r.lastName?.toLowerCase() &&
                    m.firstName?.toLowerCase() === r.firstName?.toLowerCase());
            const mAcc = master?.accommodations;
            const rAcc = r.accommodations;
            hasAccom = (mAcc && mAcc !== 'None' && mAcc.trim() !== '') || (rAcc && rAcc !== 'None' && rAcc.trim() !== '');
        }
        const matchesAccom = accommodationFilter === 'all' || hasAccom;

        // Smart case-insensitive matching for studentType (Boarding vs boarding, Day vs day, etc.)
        // Also fallback to master student schoolProgram if r.studentType is missing or unspecified
        const master = masterStudents.find(m => m.email?.toLowerCase() === r.email?.toLowerCase()) ||
            masterStudents.find(m => m.lastName?.toLowerCase() === r.lastName?.toLowerCase() &&
                m.firstName?.toLowerCase() === r.firstName?.toLowerCase());
        const resolvedType = (r.studentType || master?.schoolProgram || master?.studentType || '').toLowerCase().trim();

        const matchesStudentType = studentTypeFilter.length === 0 || studentTypeFilter.some(selected => {
            const filterKey = selected.toLowerCase().trim();
            return resolvedType.includes(filterKey) || filterKey.includes(resolvedType);
        });

        const matchesBilled = billedFilter === 'all' ||
            (billedFilter === 'billed' && r.billed) ||
            (billedFilter === 'not_billed' && !r.billed);
        const matchesTender = tenderFilter === 'all' || r.paymentTender === tenderFilter;

        return matchesSearch && matchesPayment && matchesTender && matchesExam && matchesRoom && matchesAccom && matchesStudentType && matchesBilled;
    }).sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''));

    const paidCount = registrations.filter(r => r.paymentRecd === 'Yes').length;
    const pendingCount = registrations.filter(r => r.paymentRecd !== 'Yes').length;

    const copyFilteredEmails = () => {
        const emails = filtered.map(r => r.email).filter(Boolean).join(', ');
        navigator.clipboard.writeText(emails).then(() => {
            alert(`Copied ${filtered.length} email addresses to clipboard!`);
        }).catch(err => {
            console.error('Failed to copy:', err);
            alert('Failed to copy emails. Please try again.');
        });
    };

    // Export Account Billing CSV specifically for the Business Office
    // If includeAll is false, exports only unsubmitted account students, then prompts to mark them as submitted.
    const exportAccountBillingCSV = async (includeAll = false) => {
        const targetStudents = includeAll 
            ? registrations.filter(r => r.paymentTender === 'Account')
            : registrations.filter(r => r.paymentTender === 'Account' && !r.submittedToBO);

        if (targetStudents.length === 0) {
            if (!includeAll && registrations.some(r => r.paymentTender === 'Account')) {
                if (window.confirm("No unsubmitted Account students in the queue. Would you like to export all Account students (including already submitted)?")) {
                    exportAccountBillingCSV(true);
                }
                return;
            }
            alert("No students currently marked for 'Bill to Account'.");
            return;
        }

        const rows = [
            ["Last Name", "First Name", "Student ID", "Email", "Grade", "Student Type", "Exam", "Fee Amount", "Payment Status", "Billed to Acct", "BO Notes"]
        ];

        targetStudents.forEach(r => {
            const master = masterStudents.find(m => m.email?.toLowerCase() === r.email?.toLowerCase()) || {};
            const fee = r.waiverEligible === 'Yes' ? 0 : (r.feeAmount !== undefined ? r.feeAmount : (r.testType === 'SAT' ? 60 : 18));
            const studentId = master.schoolId || master.userId || master.user_id || (r.email ? r.email.split('@')[0] : '');
            rows.push([
                `"${r.lastName || master.lastName || ''}"`,
                `"${r.firstName || master.firstName || ''}"`,
                `"${studentId}"`,
                `"${r.email || ''}"`,
                r.grade || master.grade || '',
                r.studentType || master.schoolProgram || 'Day',
                r.testType || 'SAT',
                fee,
                'Billed to Account',
                r.billed ? 'Yes' : 'No',
                `"${r.boNotes || ''}"`
            ]);
        });

        const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        const suffix = includeAll ? 'All' : 'Unsubmitted';
        link.setAttribute("download", `Account_Billing_${suffix}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // If exporting unsubmitted, ask if they'd like to mark them as submitted to BO
        if (!includeAll) {
            const shouldMark = window.confirm(
                `Exported ${targetStudents.length} student(s).\n\nWould you like to mark these ${targetStudents.length} student(s) as "Submitted to Business Office" now?`
            );
            if (shouldMark) {
                try {
                    const batch = writeBatch(db);
                    targetStudents.forEach(r => {
                        const docRef = doc(db, 'sat_registrations', r.id);
                        batch.update(docRef, {
                            submittedToBO: true,
                            lastUpdated: serverTimestamp()
                        });
                    });
                    await batch.commit();
                    alert(`✅ Successfully marked ${targetStudents.length} student(s) as Submitted to BO.`);
                } catch (error) {
                    console.error("Error updating account students as submitted:", error);
                    alert("Export succeeded, but failed to automatically update status.");
                }
            }
        }
    };

    const accountCount = registrations.filter(r => r.paymentTender === 'Account').length;
    const unsubmittedAccountCount = registrations.filter(r => r.paymentTender === 'Account' && !r.submittedToBO).length;

    const depositReady = registrations.filter(r =>
        r.paymentRecd === 'Yes' &&
        !r.submittedToBO &&
        r.paymentTender !== 'Account'
    );

    if (loading) return <div style={{ padding: '20px', color: 'var(--fa-warm-gray)' }}>Loading registrations...</div>;

    return (
        <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h2 style={{ margin: 0, color: 'var(--fa-dark-blue)', fontSize: '20px', fontWeight: 'bold' }}>SAT/PSAT Registration Manager</h2>
                    <p style={{ margin: '4px 0 0', color: 'var(--fa-warm-gray)', fontSize: '12px' }}>Manage all student sign-ups for Collegeboard exams.</p>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {selectedIds.length > 0 && (
                        <>
                            <button
                                onClick={handleBulkMarkSubmitted}
                                style={{ padding: '8px 16px', backgroundColor: '#0d6efd', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                                title="Mark selected students as Submitted to Business Office"
                            >
                                ✓ Mark Submitted to BO ({selectedIds.length})
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                style={{ padding: '8px 16px', backgroundColor: 'var(--fa-red)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                            >
                                Delete Selected ({selectedIds.length})
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setShowManualModal(true)}
                        style={{ padding: '8px 16px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                    >
                        + Add Student
                    </button>
                    <button
                        onClick={() => setShowBulkModal(true)}
                        style={{ padding: '8px 16px', backgroundColor: 'white', color: 'var(--fa-blue)', border: '1px solid var(--fa-blue)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                    >
                        Bulk Paste Import
                    </button>
                    <button
                        onClick={() => exportToCollegeboard('SAT')}
                        style={{ padding: '8px 14px', backgroundColor: 'white', color: 'var(--fa-blue)', border: '1px solid var(--fa-blue)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        title="Export only SAT registrations for CollegeBoard SSOR"
                    >
                        Export SAT CSV
                    </button>
                    <button
                        onClick={() => exportToCollegeboard('PSAT')}
                        style={{ padding: '8px 14px', backgroundColor: 'white', color: 'var(--fa-blue)', border: '1px solid var(--fa-blue)', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px' }}
                        title="Export only PSAT registrations for CollegeBoard SSOR"
                    >
                        Export PSAT CSV
                    </button>
                    <button
                        onClick={() => exportAccountBillingCSV(false)}
                        style={{
                            padding: '8px 14px',
                            backgroundColor: 'white',
                            color: '#0d6efd',
                            border: '1px solid #0d6efd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '13px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px'
                        }}
                        title="Export CSV of unsubmitted 'Bill to Account' students for Business Office ledger"
                    >
                        <span>🧾 Export Account Billing</span>
                        {unsubmittedAccountCount > 0 ? (
                            <span style={{ backgroundColor: '#0d6efd', color: 'white', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }} title={`${unsubmittedAccountCount} unsubmitted to BO`}>
                                {unsubmittedAccountCount}
                            </span>
                        ) : accountCount > 0 ? (
                            <span style={{ backgroundColor: '#6c757d', color: 'white', borderRadius: '10px', padding: '1px 6px', fontSize: '11px' }} title="All account students submitted to BO">
                                0 / {accountCount}
                            </span>
                        ) : null}
                    </button>
                    <button
                        onClick={() => setShowDepositModal(true)}
                        disabled={depositReady.length === 0}
                        style={{
                            padding: '8px 16px',
                            backgroundColor: depositReady.length > 0 ? '#34a853' : '#ccc',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: depositReady.length > 0 ? 'pointer' : 'not-allowed',
                            fontWeight: 'bold', fontSize: '13px'
                        }}
                    >
                        Create Deposit Sheet ({depositReady.length})
                    </button>
                    <input
                        type="text"
                        placeholder="Search registrations..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{ padding: '8px 12px', width: '200px', borderRadius: '8px', border: '1px solid var(--glass-border)', outline: 'none', fontSize: '13px' }}
                    />
                </div>
            </div>

            <div className="glass-panel" style={{
                display: 'flex', flexDirection: 'column', gap: '12px',
                marginBottom: '20px', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.55)'
            }}>
                {/* Row 1: High Level Totals and Filters */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--fa-dark-blue)' }}>
                            <span>{registrations.length} Total</span>
                            <span style={{ color: 'var(--fa-warm-gray)', margin: '0 6px' }}>|</span>
                            <span style={{ color: '#1e8e3e' }}>{paidCount} Paid</span>
                            <span style={{ color: 'var(--fa-warm-gray)', margin: '0 6px' }}>|</span>
                            <span style={{ color: 'var(--fa-red)' }}>{pendingCount} Pending</span>
                            {accountCount > 0 && (
                                <>
                                    <span style={{ color: 'var(--fa-warm-gray)', margin: '0 6px' }}>|</span>
                                    <span style={{ color: '#0d6efd' }}>{accountCount} Account Billed</span>
                                </>
                            )}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        {/* Exam Filter: All | SAT | PSAT */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Exam:</span>
                            {[
                                { id: 'all', label: `All (${registrations.length})` },
                                { id: 'SAT', label: `SAT (${satRegistrations.length})` },
                                { id: 'PSAT', label: `PSAT (${psatRegistrations.length})` }
                            ].map(opt => (
                                <button key={opt.id} onClick={() => setExamFilter(opt.id)}
                                    style={{
                                        padding: '4px 10px', fontSize: '11px', borderRadius: '6px',
                                        border: examFilter === opt.id ? '2px solid var(--fa-blue)' : '1px solid #ccc',
                                        backgroundColor: examFilter === opt.id ? 'var(--fa-blue)' : '#fff',
                                        color: examFilter === opt.id ? '#fff' : '#444',
                                        cursor: 'pointer', fontWeight: 'bold'
                                    }}>
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        {/* Payment Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>Payment:</span>
                            {['all', 'paid', 'pending'].map(opt => (
                                <button key={opt} onClick={() => setPaymentFilter(opt)}
                                    style={{
                                        padding: '4px 10px', fontSize: '11px', borderRadius: '6px',
                                        border: paymentFilter === opt ? '2px solid var(--fa-blue)' : '1px solid #ccc',
                                        backgroundColor: paymentFilter === opt ? 'rgba(0, 70, 139, 0.08)' : '#fff',
                                        color: paymentFilter === opt ? 'var(--fa-blue)' : '#666',
                                        cursor: 'pointer', textTransform: 'capitalize', fontWeight: '600'
                                    }}>
                                    {opt}
                                </button>
                            ))}
                        </div>

                        {/* Tender Filter */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>Tender:</span>
                            {['all', 'Cash', 'Check', 'CC', 'Account'].map(opt => (
                                <button key={opt} onClick={() => setTenderFilter(opt)}
                                    style={{
                                        padding: '4px 8px', fontSize: '11px', borderRadius: '6px',
                                        border: tenderFilter === opt ? '2px solid var(--fa-blue)' : '1px solid #ccc',
                                        backgroundColor: tenderFilter === opt ? 'rgba(0, 70, 139, 0.08)' : '#fff',
                                        color: tenderFilter === opt ? 'var(--fa-blue)' : '#666',
                                        cursor: 'pointer', fontWeight: '600'
                                    }}>
                                    {opt === 'all' ? 'All' : opt}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>Billed:</span>
                        {['all', 'billed', 'not_billed'].map(opt => (
                            <button key={opt} onClick={() => setBilledFilter(opt)}
                                style={{
                                    padding: '4px 10px', fontSize: '11px', borderRadius: '6px',
                                    border: billedFilter === opt ? '2px solid var(--fa-blue)' : '1px solid #ccc',
                                    backgroundColor: billedFilter === opt ? 'rgba(0, 70, 139, 0.08)' : '#fff',
                                    color: billedFilter === opt ? 'var(--fa-blue)' : '#666',
                                    cursor: 'pointer', textTransform: 'capitalize', fontWeight: '600'
                                }}>
                                {opt === 'not_billed' ? 'No' : opt === 'billed' ? 'Yes' : 'All'}
                            </button>
                        ))}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>Type:</span>
                        {['boarding', 'day', 'commuter'].map(type => {
                            const isSelected = studentTypeFilter.includes(type);
                            return (
                                <button
                                    key={type}
                                    onClick={() => {
                                        if (isSelected) setStudentTypeFilter(studentTypeFilter.filter(t => t !== type));
                                        else setStudentTypeFilter([...studentTypeFilter, type]);
                                    }}
                                    style={{
                                        padding: '4px 10px', fontSize: '11px', borderRadius: '6px',
                                        border: isSelected ? '2px solid var(--fa-blue)' : '1px solid #ccc',
                                        backgroundColor: isSelected ? 'rgba(0, 70, 139, 0.08)' : '#fff',
                                        color: isSelected ? 'var(--fa-blue)' : '#666',
                                        cursor: 'pointer', textTransform: 'capitalize', fontWeight: '600'
                                    }}
                                >
                                    {type}
                                </button>
                            );
                        })}
                        {studentTypeFilter.length > 0 && (
                            <button onClick={() => setStudentTypeFilter([])} style={{ padding: '4px 8px', fontSize: '10px', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--fa-red)', fontWeight: 'bold' }}>✕</button>
                        )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', fontWeight: 'bold' }}>Accom:</span>
                        <button onClick={() => setAccommodationFilter('all')}
                            style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: accommodationFilter === 'all' ? '2px solid var(--fa-blue)' : '1px solid #ccc', backgroundColor: accommodationFilter === 'all' ? 'rgba(0, 70, 139, 0.08)' : '#fff', color: accommodationFilter === 'all' ? 'var(--fa-blue)' : '#666', cursor: 'pointer', fontWeight: '600' }}>All</button>
                        <button onClick={() => setAccommodationFilter('has')}
                            style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: accommodationFilter === 'has' ? '2px solid var(--fa-blue)' : '1px solid #ccc', backgroundColor: accommodationFilter === 'has' ? 'rgba(0, 70, 139, 0.08)' : '#fff', color: accommodationFilter === 'has' ? 'var(--fa-blue)' : '#666', cursor: 'pointer', fontWeight: '600' }}>Has Accom</button>
                    </div>

                    <button onClick={copyFilteredEmails}
                        style={{ padding: '6px 12px', fontSize: '11px', backgroundColor: '#fff', color: 'var(--fa-blue)', border: '1px solid var(--fa-blue)', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>
                        📋 Copy Emails ({filtered.length})
                    </button>
                </div>

                {/* Row 2: Room & Proctoring Breakdown & Quick Filter */}
                <div style={{
                    paddingTop: '10px',
                    borderTop: '1px dashed var(--glass-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '10px',
                    fontSize: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            🏫 Room Planning {examFilter !== 'all' ? `(${examFilter})` : ''}:
                        </span>
                        
                        {/* Standard Room Button */}
                        <button
                            onClick={() => setRoomFilter(roomFilter === 'standard' ? 'all' : 'standard')}
                            style={{
                                border: roomFilter === 'standard' ? '2px solid #1a73e8' : '1px solid #d1d5db',
                                backgroundColor: roomFilter === 'standard' ? '#e8f0fe' : '#fff',
                                color: '#1a73e8',
                                padding: '3px 10px',
                                borderRadius: '14px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '11px'
                            }}
                            title="Students testing without accommodations"
                        >
                            Standard Room: <strong>{roomCounts.standard}</strong>
                        </button>

                        {/* Extended Time Room Button (includes both Ext Time + Small Group) */}
                        <button
                            onClick={() => setRoomFilter(roomFilter === 'extended' ? 'all' : 'extended')}
                            style={{
                                border: roomFilter === 'extended' ? '2px solid #b06000' : '1px solid #fed7aa',
                                backgroundColor: roomFilter === 'extended' ? '#ffedd5' : '#fff7ed',
                                color: '#b06000',
                                padding: '3px 10px',
                                borderRadius: '14px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '11px'
                            }}
                            title="Extended Time (or both Extended Time + Small Group)"
                        >
                            ⏱️ Extended Time: <strong>{roomCounts.extended}</strong>
                        </button>

                        {/* Small Group Only Room Button */}
                        <button
                            onClick={() => setRoomFilter(roomFilter === 'small_group' ? 'all' : 'small_group')}
                            style={{
                                border: roomFilter === 'small_group' ? '2px solid #6b21a8' : '1px solid #e9d5ff',
                                backgroundColor: roomFilter === 'small_group' ? '#f3e8ff' : '#faf5ff',
                                color: '#6b21a8',
                                padding: '3px 10px',
                                borderRadius: '14px',
                                cursor: 'pointer',
                                fontWeight: '600',
                                fontSize: '11px'
                            }}
                            title="Small Group testing only (no extended time)"
                        >
                            👥 Small Group Only: <strong>{roomCounts.small_group}</strong>
                        </button>

                        {roomCounts.special > 0 && (
                            <button
                                onClick={() => setRoomFilter(roomFilter === 'special' ? 'all' : 'special')}
                                style={{
                                    border: roomFilter === 'special' ? '2px solid #4b5563' : '1px solid #e5e7eb',
                                    backgroundColor: roomFilter === 'special' ? '#e5e7eb' : '#f9fafb',
                                    color: '#374151',
                                    padding: '3px 10px',
                                    borderRadius: '14px',
                                    cursor: 'pointer',
                                    fontWeight: '600',
                                    fontSize: '11px'
                                }}
                            >
                                Other Accommodations: <strong>{roomCounts.special}</strong>
                            </button>
                        )}

                        {roomFilter !== 'all' && (
                            <button
                                onClick={() => setRoomFilter('all')}
                                style={{ border: 'none', background: 'none', color: 'var(--fa-red)', cursor: 'pointer', fontWeight: 'bold', fontSize: '11px', textDecoration: 'underline' }}
                            >
                                Clear Room Filter
                            </button>
                        )}
                    </div>

                    <div style={{ color: 'var(--fa-warm-gray)', fontSize: '11px', fontStyle: 'italic' }}>
                        *Rule: Students with both Extended Time & Small Group are assigned to Extended Time rooms.
                    </div>
                </div>
            </div>

            {/* Floating/Contextual Bulk Action Bar */}
            {selectedIds.length > 0 && (
                <div className="glass-panel" style={{
                    marginBottom: '16px', padding: '12px 20px', borderRadius: '10px',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px',
                    backgroundColor: 'rgba(0, 70, 139, 0.08)', border: '1.5px solid var(--fa-blue)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span style={{ fontWeight: 'bold', color: 'var(--fa-dark-blue)', fontSize: '13px' }}>
                            ✓ {selectedIds.length} student{selectedIds.length > 1 ? 's' : ''} selected
                        </span>
                        <button
                            onClick={() => setSelectedIds([])}
                            style={{ background: 'none', border: 'none', color: 'var(--fa-warm-gray)', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline' }}
                        >
                            Deselect All
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <button
                            onClick={handleBulkBillToAccount}
                            style={{
                                padding: '6px 14px', backgroundColor: 'var(--fa-blue)', color: 'white',
                                border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                            title="Set Payment Received = Yes, Payment Tender = Account"
                        >
                            ⚡ Bulk Bill to Account
                        </button>

                        <button
                            onClick={handleBulkMarkSubmitted}
                            style={{
                                padding: '6px 14px', backgroundColor: '#e8f0fe', color: '#1a73e8',
                                border: '1px solid #1a73e8', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px'
                            }}
                        >
                            📤 Mark Submitted to BO
                        </button>

                        <button
                            onClick={handleBulkDelete}
                            style={{
                                padding: '6px 12px', backgroundColor: 'transparent', color: 'var(--fa-red)',
                                border: '1px solid var(--fa-red)', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px',
                                cursor: 'pointer'
                            }}
                        >
                            🗑️ Delete ({selectedIds.length})
                        </button>
                    </div>
                </div>
            )}

            <div className="glass-panel" style={{ padding: 0, borderRadius: '12px', border: '1px solid var(--glass-border)', overflow: 'hidden', background: 'rgba(255, 255, 255, 0.45)' }}>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
                        <thead>
                            <tr style={{ backgroundColor: 'rgba(0, 70, 139, 0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                                <th style={{ padding: '12px 16px', width: '30px' }}>
                                    <input type="checkbox" checked={filtered.length > 0 && selectedIds.length === filtered.length} onChange={toggleSelectAll} />
                                </th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Student</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Test/Type</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Accommodations</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Waiver</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Fee Due</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Payment Info</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Status</th>
                                <th style={{ padding: '12px 16px', color: 'var(--fa-dark-blue)', fontWeight: 'bold' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(r => {
                                let master = masterStudents.find(m => m.email?.toLowerCase() === r.email?.toLowerCase());
                                if (!master) {
                                    master = masterStudents.find(m =>
                                        m.lastName?.toLowerCase() === r.lastName?.toLowerCase() &&
                                        m.firstName?.toLowerCase() === r.firstName?.toLowerCase()
                                    );
                                }
                                return (
                                    <tr key={r.id} style={{ borderBottom: '1px solid var(--glass-border)', backgroundColor: selectedIds.includes(r.id) ? 'rgba(0, 70, 139, 0.05)' : 'transparent' }}>
                                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                                            <input type="checkbox" checked={selectedIds.includes(r.id)} onChange={() => toggleSelectOne(r.id)} />
                                        </td>
                                        {editingId === r.id ? (
                                            <>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '600' }}>{r.lastName}, {r.firstName}</div>
                                                    <input 
                                                        type="email"
                                                        value={editData.email || ''} 
                                                        onChange={e => setEditData({ ...editData, email: e.target.value.trim().toLowerCase() })}
                                                        placeholder="student@fryeburgacademy.org"
                                                        title="Student Email Address"
                                                        style={{ fontSize: '11px', marginTop: '4px', padding: '3px 6px', borderRadius: '4px', border: '1px solid var(--fa-blue)', width: '100%', boxSizing: 'border-box' }}
                                                    />
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {r.testType}<br />
                                                    <select value={editData.studentType || 'boarding'} onChange={e => setEditData({ ...editData, studentType: e.target.value })} style={{ fontSize: '10px', marginTop: '4px', padding: '2px', borderRadius: '4px' }}>
                                                        <option value="boarding">Boarding</option>
                                                        <option value="day">District Day</option>
                                                        <option value="commuter">Commuter Day</option>
                                                        <option value="homeschool">Homeschool</option>
                                                    </select>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <select value={editData.accommodations || 'None'} onChange={e => setEditData({ ...editData, accommodations: e.target.value })} style={{ width: '100%', padding: '2px', borderRadius: '4px' }}>
                                                        <option value="None">None</option>
                                                        <option value="Small Group">Small Group</option>
                                                        <option value="Extended Time">Extended Time</option>
                                                        <option value="Extra Breaks">Extra Breaks</option>
                                                        <option value="ESOL">ESOL</option>
                                                        <option value="Other">Other</option>
                                                    </select>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <select value={editData.waiverEligible || 'No'} onChange={e => setEditData({ ...editData, waiverEligible: e.target.value })} style={{ padding: '2px', borderRadius: '4px' }}>
                                                        <option value="No">No</option>
                                                        <option value="Yes">Yes ($0)</option>
                                                    </select>
                                                </td>
                                                <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>
                                                    ${editData.waiverEligible === 'Yes' ? 0 : (r.testType === 'SAT' ? 60 : 18)}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '4px' }}>
                                                        <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                                                            <input type="checkbox" checked={editData.paymentRecd === 'Yes'} onChange={e => setEditData({ ...editData, paymentRecd: e.target.checked ? 'Yes' : 'No' })} />
                                                            Rec'd
                                                        </label>
                                                        <select value={editData.paymentTender || ''} onChange={e => setEditData({ ...editData, paymentTender: e.target.value })} style={{ fontSize: '10px', padding: '2px', borderRadius: '4px' }}>
                                                            <option value="">Tender...</option>
                                                            <option value="Cash">Cash</option>
                                                            <option value="Check">Check</option>
                                                            <option value="CC">CC</option>
                                                            <option value="Account">Account</option>
                                                        </select>
                                                        {editData.paymentTender === 'Check' && <input placeholder="Check #" value={editData.checkNumber || ''} onChange={e => setEditData({ ...editData, checkNumber: e.target.value })} style={{ fontSize: '10px', padding: '2px', borderRadius: '4px' }} />}
                                                        {editData.paymentTender === 'CC' && <input placeholder="Conf Code" value={editData.ccConfirmationCode || ''} onChange={e => setEditData({ ...editData, ccConfirmationCode: e.target.value })} style={{ fontSize: '10px', padding: '2px', borderRadius: '4px' }} />}
                                                        <div style={{ display: 'flex', gap: '4px' }}>
                                                            <input placeholder="Amount" value={editData.paymentAmount || ''} onChange={e => setEditData({ ...editData, paymentAmount: e.target.value })} style={{ fontSize: '10px', width: '50px', padding: '2px', borderRadius: '4px' }} />
                                                            <input type="date" value={editData.paymentDate || ''} onChange={e => setEditData({ ...editData, paymentDate: e.target.value })} style={{ fontSize: '10px', padding: '2px', borderRadius: '4px' }} />
                                                        </div>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
                                                        <input type="checkbox" checked={editData.submittedToBO || false} onChange={e => setEditData({ ...editData, submittedToBO: e.target.checked })} />
                                                        Sub?
                                                    </label>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <button onClick={() => handleSave(r.id)} style={{ padding: '4px 8px', backgroundColor: '#1e8e3e', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px', marginRight: '4px' }}>Save</button>
                                                    <button onClick={() => setEditingId(null)} style={{ padding: '4px 8px', backgroundColor: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '10px' }}>Cancel</button>
                                                </td>
                                            </>
                                        ) : (
                                            <>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--fa-dark-blue)' }}>{r.lastName}, {r.firstName}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--fa-warm-gray)' }}>{r.email} | Gr. {r.grade}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div style={{ fontWeight: '600' }}>{r.testType}</div>
                                                    <div style={{ fontSize: '9px', color: 'var(--fa-warm-gray)', textTransform: 'capitalize' }}>{r.studentType}</div>
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {(() => {
                                                        const accom = (r.accommodations && r.accommodations !== 'None') ? r.accommodations : master?.accommodations;
                                                        return (accom && accom !== 'None' && accom.trim() !== '') ? (
                                                            <span style={{ padding: '2px 6px', backgroundColor: 'rgba(0, 70, 139, 0.08)', color: 'var(--fa-blue)', borderRadius: '4px', fontSize: '10px', fontWeight: 'bold' }}>
                                                                {accom}
                                                            </span>
                                                        ) : (
                                                            <span style={{ color: '#ccc' }}>None</span>
                                                        );
                                                    })()}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <span style={{ color: r.waiverEligible === 'Yes' ? '#1e8e3e' : 'var(--fa-warm-gray)', fontWeight: r.waiverEligible === 'Yes' ? 'bold' : 'normal' }}>
                                                        {r.waiverEligible || 'No'}
                                                    </span>
                                                    {master?.waiverEligible === 'Yes' && r.waiverEligible !== 'Yes' && (
                                                        <div style={{ fontSize: '9px', color: 'var(--fa-red)', fontWeight: 'bold', marginTop: '2px' }}>⚠️ MASTER: YES</div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 16px', fontWeight: 'bold', color: 'var(--fa-dark-blue)' }}>
                                                    ${r.feeAmount ?? (r.testType === 'SAT' ? 60 : 18)}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    {r.paymentRecd === 'Yes' ? (
                                                        <div style={{ fontSize: '9px', color: 'var(--fa-dark-blue)' }}>
                                                            <div><span style={{ color: '#1e8e3e', fontWeight: 'bold' }}>Rec'd</span> | {r.paymentTender} {r.paymentTender === 'Check' ? `#${r.checkNumber || ''}` : ''}{r.paymentTender === 'CC' && r.ccConfirmationCode ? ` (${r.ccConfirmationCode})` : ''}</div>
                                                            <div>${r.paymentAmount} | {r.paymentDate}</div>
                                                        </div>
                                                    ) : (
                                                        <span style={{ color: '#ccc', fontSize: '11px', fontWeight: 'bold' }}>Pending</span>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <div>
                                                        {r.submittedToBO ? (
                                                            <span style={{ color: '#1e8e3e', fontWeight: 'bold', fontSize: '11px' }}>SUBMITTED</span>
                                                        ) : (
                                                            <span style={{ color: r.paymentRecd === 'Yes' ? '#f57f17' : '#ccc', fontSize: '11px', fontWeight: 'bold' }}>
                                                                {r.paymentRecd === 'Yes' ? 'NOT SENT' : 'PRE-PAY'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {r.billed && (
                                                        <div style={{ marginTop: '4px' }}>
                                                            <span style={{ backgroundColor: '#e6f4ea', color: '#1e8e3e', padding: '2px 6px', borderRadius: '4px', fontSize: '9px', fontWeight: 'bold', display: 'inline-block' }}>✓ BILLED</span>
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ padding: '12px 16px' }}>
                                                    <button onClick={() => handleEdit(r)} style={{ border: 'none', background: 'none', color: 'var(--fa-blue)', cursor: 'pointer', marginRight: '10px', fontWeight: 'bold', fontSize: '12px' }}>Edit</button>
                                                    <button onClick={() => handleDelete(r.id)} style={{ border: 'none', background: 'none', color: 'var(--fa-red)', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>Delete</button>
                                                </td>
                                            </>
                                        )}
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>

            {showDepositModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
                    <div className="glass-panel" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '800px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>Printable Deposit Sheet</h3>
                            <button onClick={() => setShowDepositModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>&times;</button>
                        </div>
                        
                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid #ccc', padding: '40px', marginBottom: '20px', backgroundColor: '#fff', boxShadow: '0 0 10px rgba(0,0,0,0.1)' }}>
                            <div id="printable-deposit-sheet" style={{ color: 'black', fontFamily: 'sans-serif' }}>
                                <h2 style={{ textAlign: 'center', margin: '0 0 5px 0' }}>Business Office Deposit Sheet</h2>
                                <p style={{ textAlign: 'center', margin: '0 0 30px 0', color: '#555' }}>Testing Management System</p>

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '14px' }}>
                                    <div>
                                        <div style={{ marginBottom: '4px' }}><strong>Date:</strong> {new Date().toLocaleDateString()}</div>
                                        <div><strong>Test(s):</strong> {[...new Set(depositReady.map(r => r.testType))].filter(Boolean).join(', ') || 'N/A'}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ marginBottom: '4px' }}><strong>Cash Total:</strong> ${depositReady.filter(r => r.paymentTender === 'Cash').reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0).toFixed(2)}</div>
                                        <div style={{ marginBottom: '4px' }}><strong>Check Total:</strong> ${depositReady.filter(r => r.paymentTender === 'Check').reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0).toFixed(2)}</div>
                                        <div style={{ marginTop: '8px', borderTop: '1px solid black', paddingTop: '8px' }}>
                                            <strong>Overall Total:</strong> <span style={{ fontSize: '18px', fontWeight: 'bold' }}>${depositReady.reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0).toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>

                                {(() => {
                                    const cashList = depositReady.filter(r => r.paymentTender === 'Cash');
                                    const checkList = depositReady.filter(r => r.paymentTender === 'Check');
                                    const otherList = depositReady.filter(r => r.paymentTender !== 'Cash' && r.paymentTender !== 'Check');

                                    const cashSubtotal = cashList.reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0);
                                    const checkSubtotal = checkList.reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0);
                                    const otherSubtotal = otherList.reduce((sum, r) => sum + (Number(r.paymentAmount) || 0), 0);

                                    return (
                                        <>
                                            {/* CASH TABLE */}
                                            <div style={{ marginBottom: '25px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '2px solid #222', paddingBottom: '4px' }}>
                                                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>💵 Cash Receipts ({cashList.length})</span>
                                                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Subtotal: ${cashSubtotal.toFixed(2)}</span>
                                                </div>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#f5f5f5' }}>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Student</th>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Exam</th>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Date</th>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {cashList.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="4" style={{ padding: '8px', textAlign: 'center', color: '#777', fontStyle: 'italic' }}>No cash payments</td>
                                                            </tr>
                                                        ) : (
                                                            cashList.map(r => (
                                                                <tr key={r.id}>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.lastName}, {r.firstName}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.testType || 'SAT'}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.paymentDate || '—'}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px', textAlign: 'right' }}>${Number(r.paymentAmount || 0).toFixed(2)}</td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* CHECK TABLE */}
                                            <div style={{ marginBottom: '25px' }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '2px solid #222', paddingBottom: '4px' }}>
                                                    <span style={{ fontWeight: 'bold', fontSize: '15px' }}>📝 Check Receipts ({checkList.length})</span>
                                                    <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Subtotal: ${checkSubtotal.toFixed(2)}</span>
                                                </div>
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                    <thead>
                                                        <tr style={{ backgroundColor: '#f5f5f5' }}>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Student</th>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Check #</th>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Exam</th>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Date</th>
                                                            <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {checkList.length === 0 ? (
                                                            <tr>
                                                                <td colSpan="5" style={{ padding: '8px', textAlign: 'center', color: '#777', fontStyle: 'italic' }}>No check payments</td>
                                                            </tr>
                                                        ) : (
                                                            checkList.map(r => (
                                                                <tr key={r.id}>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.lastName}, {r.firstName}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px', fontWeight: 'bold' }}>{r.checkNumber ? `#${r.checkNumber}` : '—'}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.testType || 'SAT'}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.paymentDate || '—'}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px', textAlign: 'right' }}>${Number(r.paymentAmount || 0).toFixed(2)}</td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* OTHER / CC TABLE IF ANY */}
                                            {otherList.length > 0 && (
                                                <div style={{ marginBottom: '25px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', borderBottom: '2px solid #222', paddingBottom: '4px' }}>
                                                        <span style={{ fontWeight: 'bold', fontSize: '15px' }}>💳 Credit Card / Other Receipts ({otherList.length})</span>
                                                        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>Subtotal: ${otherSubtotal.toFixed(2)}</span>
                                                    </div>
                                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                                        <thead>
                                                            <tr style={{ backgroundColor: '#f5f5f5' }}>
                                                                <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Student</th>
                                                                <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Tender</th>
                                                                <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'left' }}>Reference</th>
                                                                <th style={{ borderBottom: '1px solid #ccc', padding: '6px 8px', textAlign: 'right' }}>Amount</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {otherList.map(r => (
                                                                <tr key={r.id}>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.lastName}, {r.firstName}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.paymentTender}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px' }}>{r.ccConfirmationCode || '—'}</td>
                                                                    <td style={{ borderBottom: '1px solid #eee', padding: '6px 8px', textAlign: 'right' }}>${Number(r.paymentAmount || 0).toFixed(2)}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}

                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '80px' }}>
                                    <div style={{ width: '40%' }}>
                                        <div style={{ borderBottom: '1px solid black', marginBottom: '5px', height: '30px' }}></div>
                                        <div style={{ fontSize: '12px', color: '#555' }}>Prepared By (Signature)</div>
                                    </div>
                                    <div style={{ width: '40%' }}>
                                        <div style={{ borderBottom: '1px solid black', marginBottom: '5px', height: '30px' }}></div>
                                        <div style={{ fontSize: '12px', color: '#555' }}>Received By (Business Office)</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <button type="button" onClick={() => {
                                    const printContent = document.getElementById('printable-deposit-sheet').innerHTML;
                                    const printWindow = window.open('', '', 'width=800,height=600');
                                    printWindow.document.write(
                                        '<html><head><title>Deposit Sheet</title><style>' +
                                        'body { font-family: sans-serif; padding: 40px; margin: 0; } ' +
                                        '@media print { @page { margin: 0.5in; } }' +
                                        '</style></head><body>' +
                                        printContent +
                                        '</body></html>'
                                    );
                                    printWindow.document.close();
                                    printWindow.focus();
                                    setTimeout(() => {
                                        printWindow.print();
                                        printWindow.close();
                                    }, 250);
                                }} style={{ padding: '8px 16px', border: '2px solid var(--fa-blue)', color: 'var(--fa-blue)', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontWeight: 'bold' }}>
                                    🖨️ Print Sheet
                                </button>
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button type="button" onClick={() => setShowDepositModal(false)} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white' }}>Cancel</button>
                                <button type="button" onClick={() => finalizeDeposit(depositReady)} style={{ padding: '8px 16px', backgroundColor: '#34a853', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Finalize Deposit</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showManualModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
                    <div className="glass-panel" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '500px' }}>
                        <h3 style={{ marginTop: 0, color: 'var(--fa-dark-blue)' }}>Add Student Registration</h3>
                        <form onSubmit={handleManualAdd}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                <input placeholder="First Name" required value={manualData.firstName} onChange={e => setManualData({ ...manualData, firstName: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
                                <input placeholder="Last Name" required value={manualData.lastName} onChange={e => setManualData({ ...manualData, lastName: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }} />
                            </div>
                            <input type="email" placeholder="Student Email" required value={manualData.email} onChange={e => setManualData({ ...manualData, email: e.target.value })} style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ccc', marginBottom: '15px' }} />
                            
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
                                <select value={manualData.grade} onChange={e => setManualData({ ...manualData, grade: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                                    <option value="12">12th Grade</option>
                                    <option value="11">11th Grade</option>
                                    <option value="10">10th Grade</option>
                                    <option value="09">9th Grade</option>
                                </select>
                                <select value={manualData.testType} onChange={e => setManualData({ ...manualData, testType: e.target.value })} style={{ padding: '8px', borderRadius: '6px', border: '1px solid #ccc' }}>
                                    <option value="SAT">SAT</option>
                                    <option value="PSAT">PSAT</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                                <button type="button" onClick={() => setShowManualModal(false)} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white' }}>Cancel</button>
                                <button type="submit" style={{ padding: '8px 16px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Add Student</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showBulkModal && (
                <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, backdropFilter: 'blur(3px)' }}>
                    <div className="glass-panel" style={{ backgroundColor: 'white', padding: '32px', borderRadius: '12px', width: '90%', maxWidth: '650px', maxHeight: '85vh', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: 'var(--fa-dark-blue)' }}>Bulk Import SAT/PSAT Registrations</h3>
                            <button onClick={() => setShowBulkModal(false)} style={{ border: 'none', background: 'none', fontSize: '20px', cursor: 'pointer', color: '#888' }}>&times;</button>
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--fa-warm-gray)', marginTop: 0, marginBottom: '16px' }}>
                            Paste rows directly from Google Sheets or Excel. Expects columns: <b>Timestamp, Email, Last Name, First Name, Student Status, Counselor, Exam/Grade</b>.
                        </p>
                        
                        <textarea
                            placeholder="Paste spreadsheet rows here (Ctrl+V)..."
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            rows={10}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', fontSize: '12px', fontFamily: 'monospace', outline: 'none', boxSizing: 'border-box' }}
                        />

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
                            <button type="button" onClick={() => setShowBulkModal(false)} style={{ padding: '8px 16px', border: '1px solid #ccc', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white' }}>Cancel</button>
                            <button
                                type="button"
                                onClick={handleBulkImport}
                                disabled={!bulkText.trim()}
                                style={{
                                    padding: '8px 24px', backgroundColor: 'var(--fa-blue)', color: 'white', border: 'none', borderRadius: '6px',
                                    cursor: !bulkText.trim() ? 'not-allowed' : 'pointer', fontWeight: 'bold', opacity: !bulkText.trim() ? 0.6 : 1
                                }}
                            >
                                Import Registrations
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SATManager;

import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { db } from '../../../firebase';
import { collection, writeBatch, doc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { decryptText } from '../../../utils/crypto';

const MAPUpload = ({ onComplete }) => {
    const [data, setData] = useState([]);
    const [status, setStatus] = useState('');
    const [importing, setImporting] = useState(false);
    const [term, setTerm] = useState('Fall');
    const [schoolYear, setSchoolYear] = useState('2025-2026');
    const [validationWarnings, setValidationWarnings] = useState([]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setStatus('Parsing file...');
        const reader = new FileReader();

        if (file.name.endsWith('.csv')) {
            reader.onload = (event) => {
                const csvData = event.target.result;
                Papa.parse(csvData, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        processData(results.data);
                    }
                });
            };
            reader.readAsText(file);
        } else if (file.name.endsWith('.xlsx')) {
            reader.onload = (event) => {
                const workbook = XLSX.read(event.target.result, { type: 'binary' });
                const sheetName = workbook.SheetNames[0];
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet);
                processData(jsonData);
            };
            reader.readAsBinaryString(file);
        }
    };

    const processData = (rawData) => {
        if (rawData && rawData.length > 0) {
            console.log("MAP Import Headers Detected:", Object.keys(rawData[0]));
        }
        const warnings = [];
        const cleaned = rawData.map((row, index) => {
            // Basic Student Info
            const firstName = row['Student First Name'] || row['First Name'] || row['student_first_name'] || '';
            const lastName = row['Student Last Name'] || row['Last Name'] || row['student_last_name'] || '';
            const middleName = row['Student Middle Name'] || '';
            const studentName = row['Student Name'] || (firstName && lastName ? `${lastName}, ${firstName}${middleName ? ` ${middleName}` : ''}` : firstName || lastName || '');
            
            const studentId = String(
                row['Student State ID'] || row['Student ID'] || row['ID'] || row['student_id'] || row['User ID'] || 
                row['StudentID'] || row['State ID'] || row['School ID'] || ''
            );

            // Test Info
            const subject = row['Subject'] || row['subject'] || row['Discipline'] || '';
            const testName = row['Test Name'] || row['test_name'] || row['TestName'] || '';
            const testGrade = row['Test Grade'] || row['Grade'] || '';
            const testDate = row['Test Completion Date'] || '';
            const testElapsedTime = row['Test Elapsed Time'] || '';
            
            // Scores (Support both "Scale Score" and "RIT Scale Score")
            const rawRit = parseFloat(row['RIT Scale Score'] || row['RIT Score'] || row['RIT'] || 0);
            const ritScore = (rawRit > 100 && rawRit < 350) ? rawRit : null;
            
            // Capture Maine Through Year Scale Score (1400-1600)
            const rawScale = parseFloat(row['Scale Score'] || 0);
            const stateScaleScore = (rawScale >= 1400 && rawScale <= 1600) ? rawScale : null;

            const ritSem = parseFloat(row['RIT SEM'] || row['Standard Error'] || 0);
            const achievementPercentile = parseInt(row['RIT Achievement Percentile'] || row['Percentile'] || 0);
            const achievementLevel = row['Scale Score Achievement Level'] || row['Achievement Level'] || '';

            // Instructional Areas (1-4) - Store in structured format for the report
            const instructionalAreas = {};
            for (let i = 1; i <= 4; i++) {
                const areaName = row[`Instructional Area ${i} Name`] || row[`Goal Area ${i} Name`];
                const areaScore = row[`Instructional Area ${i} RIT Scale Score`] || row[`Goal Area ${i} RIT Scale Score`];
                if (areaName) {
                    instructionalAreas[`area${i}`] = {
                        name: areaName,
                        rit: parseFloat(areaScore) || null
                    };
                }
            }

            // Demographics
            const demographics = {
                economicDisadvantage: row['Economic Disadvantage Status'] || '',
                englishLearner: row['English Language Learner Status Code'] || '',
                iepStatus: row['IEP Status'] || '',
                gender: row['Gender'] || '',
                ethnicGroup: row['Student Ethnic Group'] || ''
            };

            // Accommodations (Grouped by Embedded vs Non-Embedded)
            const accommodations = {
                embedded: {
                    braille: row['Embedded Accommodation - Braille'] === 'Y' || row['Embedded Accommodation - Braille'] === 'True',
                    largePrint: row['Embedded Accommodation - Large Print'] === 'Y' || row['Embedded Accommodation - Large Print'] === 'True',
                    paperPencil: row['Embedded Accommodation - Paper Pencil'] === 'Y' || row['Embedded Accommodation - Paper Pencil'] === 'True',
                    textToSpeech: row['Embedded Accommodation - Text to Speech Flag'] === 'Y' || row['Embedded Accommodation - Text to Speech Flag'] === 'True'
                },
                nonEmbedded: {
                    asl: row['Non-Embedded Accommodation - ASL Flag'] === 'Y',
                    bilingualGlossary: row['Non-Embedded Accommodation - Bilingual Word Glossary for MLs - Designated Support Flag'] === 'Y',
                    calculator: row['Non-Embedded Accommodation - Calculator Flag'] === 'Y',
                    humanReaderPassages: row['Non-Embedded Accommodation - Human Reader for Reading Passages Flag'] === 'Y',
                    mathSupports: row['Non-Embedded Accommodation - Mathematical Supports - Designated Support Flag'] === 'Y',
                    humanReaderPaper: row['Non-Embedded Accommodation - Human Reader (Paper-Based Test ONLY) Flag'] === 'Y',
                    scribe: row['Non-Embedded Accommodation - Scribe Flag'] === 'Y',
                    smallGroup: row['Non-Embedded Accommodation - Small Group or Individual Setting - Designated Support Flag'] === 'Y'
                }
            };

            // Attempt Info
            const rapidGuessing = row['Rapid Guessing Percentage'] || row['Percent of Disengaged Responses'] || row['Rapid Guessing %'] || null;
            const engagement = row['Test Engagement'] || row['Student Engagement'] || row['Engagement Level'] || 
                             (rapidGuessing !== null ? (parseFloat(rapidGuessing) >= 30 ? 'Low' : parseFloat(rapidGuessing) <= 10 ? 'High' : 'Medium') : 'Medium');

            const attemptInfo = {
                validAttempt: row['Valid Attempt'] || '',
                invalidReason: row['Invalid Attempt Reason Code'] || '',
                notTestedCode: row['Not Tested Code'] || '',
                engagement: engagement,
                rapidGuessing: rapidGuessing
            };

            if (!studentName || !studentId) {
                warnings.push({ row: index + 2, type: 'Missing Data', message: `Row ${index + 2}: Missing Name or ID` });
            }

            return {
                studentName,
                firstName,
                lastName,
                middleName,
                studentId,
                grade: row['Enrolled Grade Level'] || '',
                testGrade,
                subject,
                term: term,
                testName,
                testType: row['Test Type'] || '',
                testAdministrationName: row['Test Administration Name'] || '',
                testDate,
                testElapsedTime,
                ritScore,
                stateScaleScore,
                ritSem,
                achievementPercentile,
                achievementLevel,
                instructionalAreas,
                demographics,
                accommodations,
                attemptInfo,
                normsReferenceData: row['Norms Reference Data'] || '',
                estimatedWeeksOfInstruction: row['Estimated Weeks of Instruction'] || '',
                
                // Location Info
                location: {
                    testingDistrictCode: row['Testing District Code'] || '',
                    testingDistrictName: row['Testing District Name'] || '',
                    testingSchoolCode: row['Testing School Code'] || '',
                    testingSchoolName: row['Testing School Name'] || '',
                    reportingDistrictCode: row['Reporting District Code'] || '',
                    reportingDistrictName: row['Reporting District Name'] || '',
                    reportingSchoolCode: row['Reporting School Code'] || '',
                    reportingSchoolName: row['Reporting School Name'] || ''
                },
                schoolYear,
                uploadedAt: new Date()
            };
        }).filter(s => s.studentName && s.studentId);

        setValidationWarnings(warnings);
        setData(cleaned);
        setStatus(`Parsed ${cleaned.length} records.${warnings.length > 0 ? ` ⚠️ ${warnings.length} warning(s) found.` : ' ✅ Ready to import.'}`);
    };

    const saveToFirestore = async () => {
        if (data.length === 0) return;
        setImporting(true);
        setStatus('Linking records and saving...');

        try {
            const masterSnapshot = await getDocs(collection(db, 'master_students'));
            const studentMap = {}; 
            masterSnapshot.docs.forEach(doc => {
                const s = doc.data();
                if (s.schoolId) studentMap[String(s.schoolId)] = s.email;
                if (s.stateId) {
                    const decStateId = decryptText(s.stateId);
                    if (decStateId) {
                        studentMap[String(decStateId)] = s.email;
                    }
                }
            });

            const batch = writeBatch(db);
            let linkedCount = 0;
            let unlinkedCount = 0;

            data.forEach((record) => {
                const studentEmail = studentMap[record.studentId];
                if (!studentEmail) {
                    unlinkedCount++;
                } else {
                    linkedCount++;
                }

                const emailKey = studentEmail ? studentEmail.replace(/[.#$/[\]]/g, '_') : `unlinked_${record.studentId}_${record.subject}`.replace(/[.#$/[\]]/g, '_');
                
                // Unique key: email_subject_testDate_schoolYear (to avoid overlap between Fall/Spring/ThroughYear)
                // Use record.testDate if available, otherwise term
                const dateKey = record.testDate ? record.testDate.replace(/\//g, '-') : record.term;
                const scoreId = `${emailKey}_${record.subject}_${dateKey}_${record.schoolYear}`.replace(/\s+/g, '_');
                const docRef = doc(db, 'nwea_map_scores', scoreId);
                
                batch.set(docRef, {
                    ...record,
                    studentEmail: studentEmail || '',
                    uploadedAt: serverTimestamp()
                }, { merge: true });
            });

            await batch.commit();
            setStatus(`Successfully imported ${data.length} records. (${linkedCount} linked to Master List, ${unlinkedCount} unlinked).`);
            setData([]);
            if (onComplete) onComplete();
        } catch (error) {
            console.error("Error saving MAP data:", error);
            setStatus(`Error: ${error.message}`);
        } finally {
            setImporting(false);
        }
    };

    return (
        <div style={{ padding: '20px', backgroundColor: '#f8f9fa', borderRadius: '12px', border: '1px solid #dadce0' }}>
            <h3 style={{ marginTop: 0 }}>Import NWEA MAP Data</h3>
            <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>Testing Term</label>
                    <select 
                        value={term} 
                        onChange={(e) => setTerm(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dadce0' }}
                    >
                        <option value="Fall">Fall</option>
                        <option value="Spring">Spring</option>
                    </select>
                </div>
                <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '8px' }}>School Year</label>
                    <select 
                        value={schoolYear} 
                        onChange={(e) => setSchoolYear(e.target.value)}
                        style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #dadce0' }}
                    >
                        <option value="2024-2025">2024-2025</option>
                        <option value="2025-2026">2025-2026</option>
                        <option value="2026-2027">2026-2027</option>
                    </select>
                </div>
            </div>

            <div style={{ 
                padding: '30px', 
                border: '2px dashed #dadce0', 
                borderRadius: '12px', 
                textAlign: 'center', 
                backgroundColor: 'white',
                marginBottom: '20px'
            }}>
                <input
                    type="file"
                    accept=".csv, .xlsx"
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                    id="map-file-upload"
                />
                <label htmlFor="map-file-upload" style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: '32px', marginBottom: '8px' }}>📊</div>
                    <div style={{ color: '#1a73e8', fontWeight: '600' }}>Click to upload MAP CSV/XLSX</div>
                    <div style={{ color: '#5f6368', fontSize: '12px' }}>Standard NWEA Export format</div>
                </label>
            </div>

            {status && (
                <div style={{ 
                    padding: '12px', 
                    backgroundColor: status.includes('Error') ? '#fce8e6' : '#e8f0fe', 
                    color: status.includes('Error') ? '#c5221f' : '#1a73e8', 
                    borderRadius: '8px', 
                    marginBottom: '20px', 
                    fontSize: '14px',
                    fontWeight: '500'
                }}>
                    {status}
                </div>
            )}

            {data.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                    <button 
                        onClick={() => setData([])} 
                        style={{ padding: '10px 20px', border: '1px solid #dadce0', borderRadius: '8px', backgroundColor: '#fff', cursor: 'pointer' }}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={saveToFirestore}
                        disabled={importing}
                        style={{ 
                            padding: '10px 24px', 
                            backgroundColor: '#1e8e3e', 
                            color: 'white', 
                            border: 'none', 
                            borderRadius: '8px', 
                            fontWeight: '600', 
                            cursor: importing ? 'not-allowed' : 'pointer' 
                        }}
                    >
                        {importing ? 'Importing...' : `Import ${data.length} Scores`}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MAPUpload;

# 📘 Testing Management System V2 — Administrator Operations Manual & Standard Operating Procedures (SOP)

This document is the definitive operational reference for **Testing Management System V2**. It contains complete, step-by-step instructions for managing school-wide testing (SAT, PSAT, AP, Maine State Assessments, NWEA MAP), student rosters, seating charts, logistics, billing, and system deployments.

---

## 📋 Table of Contents
1. [System Architecture & Roles](#1-system-architecture--roles)
2. [Master Student Roster Management](#2-master-student-roster-management)
3. [SAT & PSAT Test Administration](#3-sat--psat-test-administration)
4. [AP Exam Management](#4-ap-exam-management)
5. [State Assessments & NWEA MAP Testing](#5-state-assessments--nwea-map-testing)
6. [Seating Charts & Testing Calendar Scheduling](#6-seating-charts--testing-calendar-scheduling)
7. [Live Attendance Check-in & Makeup Tracker](#7-live-attendance-check-in--makeup-tracker)
8. [Billing Clearinghouse & Business Office Console](#8-billing-clearinghouse--business-office-console)
9. [User Management & System Settings](#9-user-management--system-settings)
10. [Building & Deploying System Updates](#10-building--deploying-system-updates)

---

## 1. System Architecture & Roles

The system uses role-based access control (RBAC). User roles include:
- **`admin`**: Total system control (Roster imports, billing, user role management, system settings, deployments).
- **`counselor` / `case_manager` / `advisor`**: Student caseload access, accommodation view, proctor assignment management.
- **`proctor`**: Live check-in console, room seating charts, student list printing, door sign generation.
- **`business`**: Financial summary, payment tracking for AP and SAT fees, billing clearinghouse.
- **`student`**: Student portal for schedule viewing, accommodation notes, test room lookup, and form registration.

---

## 2. Master Student Roster Management

**Location:** **Master Student List** (Counselor/Admin Hub)

The `master_students` collection is the single source of truth for student identity, grade levels, state IDs, accommodations, and academic programs.

### Importing New Student Rosters
1. Navigate to **Master Student List**.
2. Click **Import** (Admin access required).
3. Choose an `.xlsx` or `.csv` file containing headers:
   - `First Name`, `Last Name`, `Email`, `Date of Birth`, `State ID`, `Grade`, `Advisor`/`Counselor`, `School Program`, `Accommodations`.
4. Review validation warnings (e.g., missing names or duplicate emails).
5. Click **Save to Firestore**.

### Adding & Managing Homeschool / Day / Commuter Students
- Students can be designated by their **School Program** (e.g., `Homeschool`, `Boarding`, `District Day`, `Commuter Day`).
- To edit any student: Click **Edit** next to their row in the Master List, update fields, and click **Save**.
- To filter by grade, program, or advisor: Use the top filter dropdowns.

---

## 3. SAT & PSAT Test Administration

**Location:** **Data & Billing $\rightarrow$ Assessment Hub $\rightarrow$ SAT/PSAT Manager**

### Annual Rollover & Clearing Previous Year Data
Before starting a new school year:
1. Export last year's records by clicking **Export Collegeboard CSV**.
2. Select all rows using the top-left header checkbox.
3. Click the red **Delete Selected (X)** button to clear old registrations.

### Adding New Students to SAT/PSAT
- **Individual Add:** Click **+ Add Student**, enter First & Last Name, Email, Grade, Counselor, Test Type (`SAT` or `PSAT`), and select **Student Type** (`Homeschool`, `Boarding`, `District Day`, or `Commuter Day`).
- **Bulk Import:** Click **Bulk Paste Import**, paste tab/comma-delimited data, and click Import.
- **Student Self-Registration:** Enable registration under **SAT Settings** so students can register via `/student/sat-registration`.

### Exporting & Deposit Sheets
- Click **Export Collegeboard CSV** to generate College Board format uploads.
- Click **Create Deposit Sheet** to aggregate cash/check/credit card payments ready for the Business Office.

---

## 4. AP Exam Management

**Location:** **Data & Billing $\rightarrow$ Assessment Hub $\rightarrow$ AP Manager**

1. **Importing AP Rosters:** Click **Upload AP Roster** to import official College Board AP exports (`.csv` or `.xlsx`). The system parses course enrollments, exam ordering, fee reductions, and matches with student school emails.
2. **Editing Fee Status:** Set student fee status (`Standard`, `Reduced`, `Late Order`, `Unused`).
3. **Billing Integration:** Exam fee totals automatically flow into the **Billing Clearinghouse**.

---

## 5. State Assessments & NWEA MAP Testing

**Location:** **Data & Billing $\rightarrow$ State & MAP Hub**

- **Maine Through Year & Maine Science:** Track room allocations, proctor assignments, and test completion.
- **NWEA MAP:** Upload NWEA MAP CSV exports to update student testing records and accommodations.

---

## 6. Seating Charts & Testing Calendar Scheduling

### Creating Seating Charts & Placing Tests on Calendar
1. Navigate to **Seating Charts**.
2. Create or select a room layout.
3. Assign a **Test Type** (e.g. SAT, AP, Maine Science) and set the scheduled **Date**.
4. Assign students to seats or use **Auto-Seat**.
5. **Testing Calendar:** Setting the date on a seating chart automatically publishes the test session to the **Testing Calendar** (`/admin/analytics`).

---

## 7. Live Attendance Check-in & Makeup Tracker

**Location:** **Operations $\rightarrow$ Live Check-in / Makeup Tracker**

- **Live Check-in:** Proctors check in students as they enter testing rooms. Real-time stats update live across the dashboard.
- **Absence Reports & Makeups:** Unchecked students are automatically flagged and routed to the **Makeup Tracker** for follow-up scheduling.

---

## 8. Billing Clearinghouse & Business Office Console

**Location:** **Data & Billing $\rightarrow$ Billing Clearinghouse**

- View all outstanding test fees (SAT, PSAT, AP).
- Filter by student type (Boarding vs. Day vs. Homeschool).
- Record payment tender (`Cash`, `Check`, `CC`, `Account`) and mark as billed.
- Export financial summary reports for accounting.

---

## 9. User Management & System Settings

**Location:** **System Admin $\rightarrow$ User Management / Settings**

- **Adding Admin Users:** In **User Management**, add user emails to grant administrative roles.
- **Graduation Year Mappings:** Configure graduation years to grade level mappings (e.g. Grade 11 = 2028).

---

## 10. Building & Deploying System Updates

**Location:** Project Root Directory

### Step 1: Compile Production Build
Run in terminal:
```bash
npm run build
```
This verifies code syntax and outputs compiled assets to `dist/`.

### Step 2: Deploy to Firebase Live Site
Run in terminal:
```bash
firebase deploy --only hosting
```
Or:
```bash
npx firebase deploy --only hosting
```
Live URL: **https://fa-testing.web.app**

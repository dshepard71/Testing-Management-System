# 🚀 Firebase Deployment Instructions

This file serves as your permanent quick-reference guide for deploying **Testing Management System V2** to your live Firebase environment.

---

## 🛠️ Step 1: Run the Production Build
Before deploying, Vite must compile, optimize, and minify your React code into static files.
Open your terminal in this directory and run:
```bash
npm run build
```
This compiles the code and saves it into the `dist/` directory.

---

## 🧪 Step 2: Test on a Preview Channel (Highly Recommended!)
You can deploy your changes to a secure, private preview URL to test with counselors and proctors without replacing your live site:
```bash
firebase hosting:channel:deploy v2-preview
```
* **Why this is awesome:** It creates a temporary URL (e.g. `tms-v2-preview-xxxx.web.app`) that is fully connected to your real database. You can test impersonation, student logins, and live check-in safely!

---

## 🚀 Step 3: Deploy to Production (Overwrites Live Site)
When you are ready to point your custom domain permanently to V2, run the production deploy command:
```bash
firebase deploy --only hosting
```
Within 5 seconds, V2 will be fully live on your existing domain!

---

### ⚠️ Rollback Plan (If you ever need to go back to V1)
If you deploy V2 and need to immediately return to the old site:
1. Go to your **Firebase Console** (for project `testing-management-syste-c5d9a`).
2. Navigate to **Hosting** in the left sidebar.
3. Scroll to your **Release History**.
4. Click the three dots next to the previous V1 release, and select **Rollback**. The site reverts instantly!

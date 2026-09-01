import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, googleProvider, db } from '../firebase';
import { onAuthStateChanged, signInWithPopup, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, deleteField } from 'firebase/firestore';
import { setSystemEncryptionKey } from '../utils/crypto';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [adminEmails, setAdminEmails] = useState([]);
    
    // Impersonation state (only available to administrative emails)
    const [impersonatedRole, setImpersonatedRole] = useState(null);
    const [impersonatedCaseloadName, setImpersonatedCaseloadName] = useState(null);

    // Subscribe to globally configured admin emails in Firestore
    useEffect(() => {
        const unsubAdmins = onSnapshot(doc(db, 'settings', 'admin_users'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().emails) {
                setAdminEmails(docSnap.data().emails.map(e => e.toLowerCase().trim()));
            }
        }, (error) => {
            console.warn('Failed to fetch admin list from settings/admin_users, using local defaults');
        });
        return () => unsubAdmins();
    }, []);

    const isAdminEmail = (email) => {
        if (!email) return false;
        const lowerEmail = email.toLowerCase().trim();
        return adminEmails.includes(lowerEmail) || 
               lowerEmail === 'dshepard@fryeburgacademy.org' ||
               lowerEmail === 'djdshep@gmail.com';
    };

    const loginWithGoogle = async () => {
        // Use select_account to allow users to choose between their accounts
        googleProvider.setCustomParameters({ prompt: 'select_account' });
        
        const result = await signInWithPopup(auth, googleProvider);
        const email = result.user.email.toLowerCase();
        
        // Enforce school domain in production, allow personal Gmail on localhost for developer testing
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            if (!email.endsWith('@fryeburgacademy.org') && !email.endsWith('@myfryeburg.org') && !isAdminEmail(email)) {
                await signOut(auth);
                throw new Error('Unauthorized domain. Please use a school email account.');
            }
        }
        
        return result;
    };

    const loginWithEmail = async (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => {
        // Reset impersonation on logout
        setImpersonatedRole(null);
        setImpersonatedCaseloadName(null);
        return signOut(auth);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (loggedInUser) => {
            setUser(loggedInUser);
            if (loggedInUser) {
                const uidRef = doc(db, 'users', loggedInUser.uid);
                const emailRef = doc(db, 'users', loggedInUser.email.toLowerCase().trim());

                try {
                    let activeProfile = null;

                    // 1. Fetch the UID-based user document
                    const uidSnap = await getDoc(uidRef);

                    if (uidSnap.exists()) {
                        // User has logged in before and profile exists under UID
                        const profile = uidSnap.data();
                        activeProfile = profile;

                        // Self-healing: remove photoURL from database if it exists
                        if (profile.photoURL !== undefined) {
                            delete profile.photoURL;
                            await setDoc(uidRef, { photoURL: deleteField() }, { merge: true });
                        }

                        // If they are admin but their database role isn't admin yet, update it
                        if (isAdminEmail(loggedInUser.email) && profile.role !== 'admin') {
                            const updatedProfile = { ...profile, role: 'admin' };
                            await setDoc(uidRef, updatedProfile, { merge: true });
                            activeProfile = updatedProfile;
                        }
                    } else {
                        // 2. Self-Healing Migration: Check if an email-based document exists
                        const emailSnap = await getDoc(emailRef);
                        
                        let baseRole = isAdminEmail(loggedInUser.email) ? 'admin' : 'student';
                        let caseloadName = null;

                        if (emailSnap.exists()) {
                            // Legacy profile exists (manually added under email)
                            const emailData = emailSnap.data();
                            baseRole = emailData.role || baseRole;
                            caseloadName = emailData.caseloadName || null;

                            console.log(`Self-Healing Auth: Migrating legacy profile for ${loggedInUser.email} from email document to UID document.`);
                        }

                        // Create modern UID-based document
                        const newProfile = {
                            uid: loggedInUser.uid,
                            displayName: loggedInUser.displayName || emailSnap.data()?.displayName || 'Unknown Name',
                            email: loggedInUser.email.toLowerCase().trim(),
                            role: baseRole,
                            caseloadName: caseloadName,
                            lastLogin: new Date()
                        };

                        await setDoc(uidRef, newProfile);
                        activeProfile = newProfile;

                        // 3. Delete the legacy email-based duplicate document
                        if (emailSnap.exists()) {
                            await deleteDoc(emailRef);
                            console.log(`Self-Healing Auth: Deleted legacy email document for ${loggedInUser.email}.`);
                        }
                    }

                    setUserProfile(activeProfile);

                    // --- Dynamic Key Loading BEFORE completing Auth Loading ---
                    if (activeProfile) {
                        const role = activeProfile.role;
                        const isStaff = ['admin', 'counselor', 'case_manager', 'business', 'proctor'].includes(role) || isAdminEmail(loggedInUser.email);
                        if (isStaff) {
                            try {
                                const keySnap = await getDoc(doc(db, 'settings', 'encryption'));
                                if (keySnap.exists() && keySnap.data().secretKey) {
                                    setSystemEncryptionKey(keySnap.data().secretKey);
                                    console.log("🔒 Dynamic encryption key securely loaded for staff session.");
                                } else {
                                    console.warn("⚠️ Encryption key document not found in settings/encryption.");
                                }
                            } catch (keyErr) {
                                console.error("❌ Failed to fetch secure encryption key:", keyErr);
                            }
                        } else {
                            setSystemEncryptionKey('');
                        }
                    } else {
                        setSystemEncryptionKey('');
                    }

                } catch (err) {
                    console.error("Authentication check / migration error:", err);
                    setSystemEncryptionKey('');
                }
            } else {
                setUserProfile(null);
                setSystemEncryptionKey('');
            }
            setLoading(false);
        });

        return unsubscribe;
    }, [adminEmails]);

    // Compute effective profile with impersonation layers
    const getEffectiveProfile = () => {
        if (!userProfile) return null;
        
        const isActualAdmin = userProfile.role === 'admin' || isAdminEmail(userProfile.email);
        if (!isActualAdmin) return userProfile; // Non-admins can never impersonate

        return {
            ...userProfile,
            role: impersonatedRole || userProfile.role,
            caseloadName: impersonatedRole ? (impersonatedCaseloadName || '') : userProfile.caseloadName,
            isImpersonated: !!impersonatedRole,
            actualRole: userProfile.role
        };
    };

    const value = {
        user,
        userProfile: getEffectiveProfile(),
        actualProfile: userProfile,
        loginWithGoogle,
        loginWithEmail,
        logout,
        loading,
        adminEmails,
        isAdminEmail,
        impersonatedRole,
        setImpersonatedRole,
        impersonatedCaseloadName,
        setImpersonatedCaseloadName
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

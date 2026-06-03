import CryptoJS from 'crypto-js';

// The key will be dynamically injected for staff sessions, falling back to env/local key for dev
let activeKey = '';

/**
 * Dynamically updates the active symmetric key in memory.
 * Called securely by AuthContext upon verified staff log in.
 */
export const setSystemEncryptionKey = (key) => {
    activeKey = key;
};

const getEncryptionKey = () => {
    // If activeKey (from DB) is loaded, combine it with the static client-side environment prefix
    if (activeKey) {
        const clientPrefix = import.meta.env.VITE_ENCRYPTION_KEY || '';
        return clientPrefix + activeKey;
    }
    // Fallback/Local Dev mode (prior to login or using the unsplit local dev key)
    return import.meta.env.VITE_ENCRYPTION_KEY || 'fa-testing-system-v2-super-secret-key-928374928';
};

/**
 * Encrypts plaintext using AES-256.
 * If the text is already encrypted, returns it directly to prevent double-encryption.
 */
export const encryptText = (text) => {
    if (!text) return '';
    try {
        const strText = String(text).trim();
        // Standard CryptoJS AES-256 output starts with "U2FsdGVkX1"
        if (strText.startsWith('U2FsdGVkX1')) {
            return strText;
        }
        return CryptoJS.AES.encrypt(strText, getEncryptionKey()).toString();
    } catch (error) {
        console.error("Encryption error:", error);
        return text;
    }
};

/**
 * Decrypts an AES-256 ciphertext.
 * If the ciphertext is not encrypted (plain text), it returns it as-is (graceful fallback).
 */
export const decryptText = (ciphertext) => {
    if (!ciphertext) return '';
    try {
        const strCipher = String(ciphertext).trim();
        // If it does not start with the standard prefix, it is plain text
        if (!strCipher.startsWith('U2FsdGVkX1')) {
            return strCipher;
        }
        const bytes = CryptoJS.AES.decrypt(strCipher, getEncryptionKey());
        const decrypted = bytes.toString(CryptoJS.enc.Utf8);
        return decrypted || strCipher; // If empty string returned, fallback to original
    } catch (error) {
        console.error("Decryption error:", error);
        return ciphertext; // Safe fallback on error
    }
};


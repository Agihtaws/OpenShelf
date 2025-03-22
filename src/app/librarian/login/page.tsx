// src/app/auth/login/components/LibrarianLogin.tsx
"use client";

import { useState, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import styles from '@/app/auth/login/login.module.css';
import { FormData, FormErrors } from '@/app/auth/login/types';
import { 
  auth, 
  db,
  signInWithEmailAndPassword,
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from '@/firebaseConfig';

interface LibrarianLoginProps {
  setErrors: React.Dispatch<React.SetStateAction<{general?: string}>>;
}

export default function LibrarianLogin({ setErrors }: LibrarianLoginProps) {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    employeeId: '',
    password: '',
    rememberMe: false
  });
  
  const [localError, setLocalError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Generate a device ID based on browser and system info
  const generateDeviceId = (): string => {
    const navigator = window.navigator;
    const screen = window.screen;
    
    // Combine various browser properties to create a unique fingerprint
    const deviceData = [
      navigator.userAgent,
      screen.height,
      screen.width,
      screen.colorDepth,
      new Date().getTimezoneOffset()
    ].join('|');
    
    // Create a hash of the deviceData
    let hash = 0;
    for (let i = 0; i < deviceData.length; i++) {
      const char = deviceData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    
    return hash.toString(16);
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user types
    if (localError) {
      setLocalError('');
      setErrors({});
    }
  };

  const validateForm = (): boolean => {
    if (!formData.employeeId?.trim()) {
      setLocalError("Employee ID is required");
      return false;
    }
    
    if (!formData.password) {
      setLocalError("Password is required");
      return false;
    }
    
    return true;
  };

  // Update the handleSubmit function in LibrarianLogin.tsx
const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  e.preventDefault();
  
  if (!validateForm()) {
    return;
  }
  
  setSubmitting(true);
  setLocalError('');
  setErrors({});
  
  try {
    // First, check if the employee ID exists in the users_librarian collection
    const librariansRef = collection(db, "users_librarian");
    const q = query(librariansRef, where("employeeId", "==", formData.employeeId));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      setLocalError("Invalid Employee ID. Please try again.");
      setSubmitting(false);
      return;
    }
    
    // Get the librarian document
    const librarianDoc = querySnapshot.docs[0];
    const librarianData = librarianDoc.data();
    const librarianId = librarianDoc.id;
    
    // Get the email from the document
    const email = librarianData.email;
    
    if (!email) {
      setLocalError("Account error. Please contact administrator.");
      setSubmitting(false);
      return;
    }
    
    // Verify password directly with the stored password in Firestore
    // This bypasses Firebase Auth for password verification
    if (formData.password !== librarianData.password) {
      setLocalError("Invalid Password. Please try again.");
      setSubmitting(false);
      return;
    }
    
    // Instead of using signInWithEmailAndPassword, just set the login status
    // directly since we've already verified the credentials against Firestore
    
    // Get current device ID
    const deviceId = generateDeviceId();
    
    // Update login status in Firestore
    const userDocRef = doc(db, "users_librarian", librarianId);
    await updateDoc(userDocRef, {
      lastLogin: serverTimestamp(),
      lastDevice: deviceId,
      isLoggedIn: true
    });
    
    // Store session data
    localStorage.setItem('user_token', 'logged_in');
    localStorage.setItem('user_role', 'librarian');
    localStorage.setItem('librarian_token', 'logged_in');
    localStorage.setItem('device_id', deviceId);
    localStorage.setItem('librarian_id', librarianId);
    
    // Set cookies
    document.cookie = `user_token=logged_in; path=/; max-age=${60 * 60 * 24 * 14}`;
    document.cookie = `user_role=librarian; path=/; max-age=${60 * 60 * 24 * 14}`;
    document.cookie = `device_id=${deviceId}; path=/; max-age=${60 * 60 * 24 * 14}`;
    document.cookie = `last_activity=${Date.now()}; path=/; max-age=${60 * 60 * 24 * 30}`;
    
    // Redirect to dashboard
    window.location.href = '/librarian/dashboard';
    
  } catch (error: any) {
    console.error("Login error:", error);
    setLocalError("An unexpected error occurred. Please try again later.");
    setSubmitting(false);
  }
};

  return (
    <form className={styles.loginFormElement} onSubmit={handleSubmit}>
      {localError && (
        <div className={styles.errorAlert}>
          {localError}
        </div>
      )}
      
      <div className={styles.formGroup}>
        <label htmlFor="employeeId">Employee ID</label>
        <input
          type="text"
          id="employeeId"
          name="employeeId"
          value={formData.employeeId}
          onChange={handleInputChange}
          className={localError ? styles.inputError : ''}
          placeholder="Enter your employee ID"
          autoComplete="username"
        />
      </div>
      
      <div className={styles.formGroup}>
        <div className={styles.passwordHeader}>
          <label htmlFor="password">Password</label>
          <Link 
            href="/auth/forgot-password" 
            className={styles.forgotLink}
          >
            Forgot password?
          </Link>
        </div>
        <div className={styles.passwordInput}>
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={localError ? styles.inputError : ''}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
          <button 
            type="button" 
            className={styles.passwordToggle}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      
      <div className={styles.rememberMe}>
        <div className={styles.checkboxGroup}>
          <input
            type="checkbox"
            id="rememberMe"
            name="rememberMe"
            checked={formData.rememberMe}
            onChange={handleInputChange}
          />
          <label htmlFor="rememberMe">Remember me</label>
        </div>
      </div>
      
      <div className={styles.formActions}>
        <button 
          type="submit" 
          className={styles.loginButton}
          disabled={submitting}
        >
          {submitting ? 'Signing In...' : 'Sign In'}
        </button>
      </div>
    </form>
  );
}

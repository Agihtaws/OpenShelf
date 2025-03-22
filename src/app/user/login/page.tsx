// src/app/auth/login/components/UserLogin.tsx
"use client";

import { useState, ChangeEvent, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from '@/app/auth/login/login.module.css';
import { FormData, FormErrors } from '@/app/auth/login/types';
import { 
  db,
  collection,
  query,
  where,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from '@/firebaseConfig';

interface UserLoginProps {
  setErrors: React.Dispatch<React.SetStateAction<{general?: string}>>;
}

export default function UserLogin({ setErrors }: UserLoginProps) {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    rememberMe: false
  });
  
  const [localError, setLocalError] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // Generate a device ID based on browser and system info
  const generateDeviceId = (): string => {
    if (typeof window === 'undefined') return '';
    
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
    if (!formData.email.trim()) {
      setLocalError("Library card ID/Email is required");
      return false;
    }
    
    if (!formData.password) {
      setLocalError("Password is required");
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Check for browser environment
    if (typeof window === 'undefined') {
      setLocalError("Browser environment required");
      setSubmitting(false);
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    setLocalError('');
    setErrors({}); 
    
    try {
      const inputValue = formData.email.trim();
      const inputPassword = formData.password;
      
      // Check if input is library card ID or email
      const isLibraryCard = inputValue.toUpperCase().startsWith('LIB-ID-CARD');
      
      // Query for user by either library card ID or email
      let userQuery;
      if (isLibraryCard) {
        userQuery = query(
          collection(db, "users_customer"),
          where("libraryCardId", "==", inputValue)
        );
      } else {
        userQuery = query(
          collection(db, "users_customer"),
          where("email", "==", inputValue.toLowerCase())
        );
      }
      
      const userSnapshot = await getDocs(userQuery);
      
      // Check if user exists
      if (userSnapshot.empty) {
        setLocalError("Account not found. Please check your Library Card ID/Email or register for an account.");
        setSubmitting(false);
        return;
      }
      
      // Get user data
      const userDoc = userSnapshot.docs[0];
      const userData = userDoc.data();
      
      // Check if password matches
      if (userData.password !== inputPassword) {
        setLocalError("Incorrect password. Please try again.");
        setSubmitting(false);
        return;
      }
      
      // Password matches, proceed with login
      const deviceId = generateDeviceId();
      
      // Update user document
      await updateDoc(doc(db, "users_customer", userDoc.id), {
        lastLogin: serverTimestamp(),
        lastDevice: deviceId,
        isLoggedIn: true
      });
      
      // Store user data in localStorage for access in other components
      const userDataForStorage = {
        uid: userDoc.id,
        displayName: userData.displayName || '',
        email: userData.email || '',
        photoURL: userData.photoURL || '',
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        libraryCardId: userData.libraryCardId || '',
        memberSince: userData.createdAt || new Date(),
        joinDate: userData.createdAt ? new Date(userData.createdAt.seconds * 1000).toLocaleDateString() : new Date().toLocaleDateString()
      };
      localStorage.setItem('user_data', JSON.stringify(userDataForStorage));
      
      // Store authentication data in localStorage
      localStorage.setItem('user_token', 'logged_in');
      localStorage.setItem('user_role', 'customer');
      localStorage.setItem('user_id', userDoc.id);
      localStorage.setItem('device_id', deviceId);
      
      // Set cookies for session management
      document.cookie = `user_token=logged_in; path=/; max-age=${60 * 60 * 24 * 14}`; // 14 days
      document.cookie = `user_role=customer; path=/; max-age=${60 * 60 * 24 * 14}`;
      document.cookie = `user_id=${userDoc.id}; path=/; max-age=${60 * 60 * 24 * 14}`;
      document.cookie = `device_id=${deviceId}; path=/; max-age=${60 * 60 * 24 * 14}`;
      document.cookie = `last_activity=${Date.now()}; path=/; max-age=${60 * 60 * 24 * 30}`;
      
      // Redirect to customer dashboard
      router.push('/user/dashboard');
      
    } catch (error: any) {
      console.error("Login error:", error);
      setLocalError("An unexpected error occurred. Please try again later.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {localError && (
        <div className={styles.errorAlert}>
          {localError}
        </div>
      )}
      
      <form className={styles.loginFormElement} onSubmit={handleSubmit}>
        <div className={styles.formGroup}>
          <label htmlFor="email">Library Card ID/Email</label>
          <input
            type="text"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="Enter your library card ID or email"
            autoComplete="email"
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
    </>
  );
}

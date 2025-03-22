// src/app/auth/login/components/AdminLogin.tsx
"use client";

import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import styles from '@/app/auth/login/login.module.css';
import { FormData, FormErrors } from '@/app/auth/login/types';
import { 
  auth, 
  db,
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signOut,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  updateDoc,
  collection,
  query,
  getDocs,
  onSnapshot
} from '@/firebaseConfig';

interface AdminLoginProps {
  setErrors: React.Dispatch<React.SetStateAction<{general?: string}>>;
  setNewSecurityKey: React.Dispatch<React.SetStateAction<string | null>>;
  setShowSecurityKeyPopup: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function AdminLogin({ 
  setErrors, 
  setNewSecurityKey, 
  setShowSecurityKeyPopup 
}: AdminLoginProps) {
  const [formData, setFormData] = useState<FormData>({
    email: '',
    password: '',
    securityKey: '',
    rememberMe: false
  });
  
  const [errors, setLocalErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSecurityKey, setShowSecurityKey] = useState(false);
  
  // State for admin existence check
  const [adminExists, setAdminExists] = useState<boolean | null>(null);
  const [checkingAdminExists, setCheckingAdminExists] = useState(false);

  // Check if an admin account exists
  useEffect(() => {
    setCheckingAdminExists(true);
    
    const checkForAdmin = async () => {
      try {
        // Check users_admin collection for existing admins
        const adminQuery = query(collection(db, "users_admin"));
        const querySnapshot = await getDocs(adminQuery);
        const exists = !querySnapshot.empty;
        console.log("Admin exists check:", exists);
        setAdminExists(exists);
      } catch (error) {
        console.error("Error checking admin existence:", error);
        // Default to assuming admin does not exist in case of error
        setAdminExists(false);
      } finally {
        setCheckingAdminExists(false);
      }
    };
    
    checkForAdmin();
    
    // Also set up a real-time listener for the admin collection
    const adminCollectionRef = collection(db, "users_admin");
    const unsubscribe = onSnapshot(adminCollectionRef, (snapshot) => {
      const exists = !snapshot.empty;
      console.log("Real-time admin exists check:", exists);
      setAdminExists(exists);
    }, (error) => {
      console.error("Error in admin collection listener:", error);
    });
    
    return () => unsubscribe();
  }, []);

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

  // Generate a security key
  const generateSecurityKey = (): string => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
    let result = '';
    const length = 24;
    
    for (let i = 0; i < length; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
  };

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Clear error when user types
    if (errors[name as keyof FormErrors]) {
      setLocalErrors(prev => ({
        ...prev,
        [name]: undefined
      }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    
    if (!formData.password) {
      newErrors.password = "Password is required";
    }
    
    if (adminExists && !formData.securityKey) {
      newErrors.securityKey = "Security key is required";
    }
    
    setLocalErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Function to handle admin signup
  const handleAdminSignup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      setErrors({
        general: "Please provide both email and password to create an admin account."
      });
      return;
    }
    
    setSubmitting(true);
    setLocalErrors({});
    setErrors({});
    
    try {
      // Check if admin already exists (double-check)
      const adminQuery = query(collection(db, "users_admin"));
      const querySnapshot = await getDocs(adminQuery);
      
      if (!querySnapshot.empty) {
        setErrors({
          general: "An admin account already exists. Please log in instead."
        });
        setAdminExists(true);
        setSubmitting(false);
        return;
      }
      
      // Create user with email and password
      const userCredential = await createUserWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      // Generate a security key for the admin
      const securityKey = generateSecurityKey();
      
      // Store admin data in Firestore with the security key
      await setDoc(doc(db, "users_admin", userCredential.user.uid), {
        uid: userCredential.user.uid,
        email: formData.email,
        role: 'admin',
        securityKey: securityKey,
        securityKeyGeneratedAt: serverTimestamp(),
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp()
      });
      
      // Show the security key to the admin
      setNewSecurityKey(securityKey);
      setShowSecurityKeyPopup(true);
      
      // Admin now exists
      setAdminExists(true);
      
      // Clear form
      setFormData({
        email: '',
        password: '',
        securityKey: '',
        rememberMe: false
      });
      
      // Sign out the user immediately after signup and show security key
      await signOut(auth);
      
    } catch (error: any) {
      console.error('Admin signup failed:', error);
      
      if (error.code === 'auth/email-already-in-use') {
        setLocalErrors({
          email: "This email is already in use"
        });
        setErrors({
          general: "An account with this email already exists."
        });
      } else {
        setErrors({
          general: `Admin signup failed: ${error.message || "Please try again."}`
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAdminLogin = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    setLocalErrors({});
    setErrors({});
    
    try {
      // Admin login with email/password
      const userCredential = await signInWithEmailAndPassword(
        auth, 
        formData.email, 
        formData.password
      );
      
      if (!userCredential) {
        throw new Error("Authentication failed");
      }
      
      // Get current device ID
      const deviceId = generateDeviceId();
      
      // Check if user exists in the admin role collection
      const userDocRef = doc(db, `users_admin`, userCredential.user.uid);
      const userSnapshot = await getDoc(userDocRef);
      
      if (!userSnapshot.exists()) {
        // Sign them out and show an error if not an admin
        await auth.signOut();
        setErrors({
          general: `This account does not have admin permissions. Please select the correct user type or contact an administrator.`
        });
        setSubmitting(false);
        return;
      }
      
      const userData = userSnapshot.data();
      
      // Verify security key
      if (userData.securityKey !== formData.securityKey) {
        setLocalErrors({
          securityKey: "Invalid security key"
        });
        setErrors({
          general: "Admin verification failed. Please check your security key."
        });
        setSubmitting(false);
        return;
      }
      
      // Update last accessed timestamp for security key
      await updateDoc(userDocRef, {
        lastSecurityKeyAccess: serverTimestamp()
      });
      
      // Update user document
      await updateDoc(userDocRef, {
        lastLogin: serverTimestamp(),
        lastDevice: deviceId,
        isLoggedIn: true
      });
      
      // Store authentication data
      localStorage.setItem('user_token', 'logged_in');
      localStorage.setItem('user_role', 'admin');
      localStorage.setItem('device_id', deviceId);
      
      // Set cookies
      document.cookie = `user_token=logged_in; path=/; max-age=${60 * 60 * 24 * 14}`; // 14 days
      document.cookie = `user_role=admin; path=/; max-age=${60 * 60 * 24 * 14}`;
      document.cookie = `device_id=${deviceId}; path=/; max-age=${60 * 60 * 24 * 14}`;
      document.cookie = `last_activity=${Date.now()}; path=/; max-age=${60 * 60 * 24 * 30}`;
      
      // Redirect to admin dashboard
      window.location.href = '/admin/dashboard';
      
    } catch (error: any) {
      console.error('Login failed:', error);
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        setErrors({
          general: "Invalid credentials. Please try again."
        });
      } else if (error.code === 'auth/too-many-requests') {
        setErrors({
          general: "Too many failed login attempts. Please try again later or reset your password."
        });
      } else {
        setErrors({
          general: `Login failed: ${error.message || "Please check your credentials and try again."}`
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingAdminExists) {
    return <div className={styles.loadingIndicator}>Checking for admin...</div>;
  }

  // If no admin exists, show signup form
  if (adminExists === false) {
    return (
      <form className={styles.loginFormElement} onSubmit={handleAdminSignup}>
        <div className={styles.formGroup}>
          <label htmlFor="email">Admin Email</label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            className={errors.email ? styles.inputError : ''}
            placeholder="Enter admin email"
            autoComplete="email"
          />
          {errors.email && <span className={styles.errorText}>{errors.email}</span>}
        </div>
        
        <div className={styles.formGroup}>
          <div className={styles.passwordHeader}>
            <label htmlFor="password">Password</label>
          </div>
          <div className={styles.passwordInput}>
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              className={errors.password ? styles.inputError : ''}
              placeholder="Create a strong password"
              autoComplete="new-password"
            />
            <button 
              type="button" 
              className={styles.passwordToggle}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
          {errors.password && <span className={styles.errorText}>{errors.password}</span>}
        </div>
        
        <div className={styles.formActions}>
          <button 
            type="submit" 
            className={styles.loginButton}
            disabled={submitting}
          >
            {submitting ? 'Creating Admin...' : 'Create Admin Account'}
          </button>
        </div>
      </form>
    );
  }

  // If admin exists, show login form
  return (
    <form className={styles.loginFormElement} onSubmit={handleAdminLogin}>
      <div className={styles.formGroup}>
        <label htmlFor="email">Email Address</label>
        <input
          type="email"
          id="email"
          name="email"
          value={formData.email}
          onChange={handleInputChange}
          className={errors.email ? styles.inputError : ''}
          placeholder="Enter your email"
          autoComplete="email"
        />
        {errors.email && <span className={styles.errorText}>{errors.email}</span>}
      </div>
      
      <div className={styles.formGroup}>
        <div className={styles.passwordHeader}>
          <label htmlFor="password">Password</label>
        </div>
        <div className={styles.passwordInput}>
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            name="password"
            value={formData.password}
            onChange={handleInputChange}
            className={errors.password ? styles.inputError : ''}
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
        {errors.password && <span className={styles.errorText}>{errors.password}</span>}
      </div>
      
      <div className={styles.formGroup}>
        <label htmlFor="securityKey">Security Key</label>
        <div className={styles.passwordInput}>
          <input
            type={showSecurityKey ? "text" : "password"}
            id="securityKey"
            name="securityKey"
            value={formData.securityKey}
            onChange={handleInputChange}
            className={errors.securityKey ? styles.inputError : ''}
            placeholder="Enter your security key"
          />
          <button 
            type="button" 
            className={styles.passwordToggle}
            onClick={() => setShowSecurityKey(!showSecurityKey)}
          >
            {showSecurityKey ? "Hide" : "Show"}
          </button>
        </div>
        {errors.securityKey && <span className={styles.errorText}>{errors.securityKey}</span>}
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

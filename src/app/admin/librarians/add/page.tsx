// src/app/admin/librarians/add/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './addLibrarian.module.css';
import { auth, db } from '../../../../firebaseConfig';
import { 
  onAuthStateChanged, 
  signOut
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc, 
  collection, 
  getDocs,
  serverTimestamp,
  query,
  where
} from 'firebase/firestore';
import Sidebar from '@/app/admin/components/sidebar';

// Define the Librarian interface
interface LibrarianFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  department: string;
  employmentType: 'full-time' | 'part-time' | 'volunteer';
  startDate: string;
}

export default function AddLibrarian() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [librarianCredentials, setLibrarianCredentials] = useState({
    id: '',
    password: '',
    email: ''
  });
  const [activeMenuItem, setActiveMenuItem] = useState('librarians');

  // Initialize form data
  const [formData, setFormData] = useState<LibrarianFormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    department: 'general',
    employmentType: 'full-time',
    startDate: new Date().toISOString().substring(0, 10),
  });

  // Check authentication when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      
      if (user) {
        try {
          // Check if user document exists in users_admin collection
          const userDocRef = doc(db, "users_admin", user.uid);
          const userSnapshot = await getDoc(userDocRef);
          
          if (userSnapshot.exists()) {
            // User is authenticated and admin document exists
            setIsAuthenticated(true);
            setIsLoading(false);
          } else {
            // User exists in Firebase Auth but not in users_admin collection
            console.log("Admin document not found - signing out");
            setIsAuthenticated(false);
            // Don't set loading to false here, wait for redirect
            window.location.href = '/auth/login';
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAuthenticated(false);
          setIsLoading(false);
          window.location.href = '/auth/login';
        }
      } else {
        // No user is signed in
        setIsAuthenticated(false);
        // Don't set loading to false here, wait for redirect
        window.location.href = '/auth/login';
      }
    });
    
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);
  

  const handleLogout = async () => {
    try {
      await signOut(auth);
      window.location.href = '/auth/login';
    } catch (error) {
      console.error("Error signing out:", error);
      window.location.href = '/auth/login';
    }
  };

  // Check if email already exists - real-time validation
  const checkEmailExists = async (email: string) => {
    if (!email) return;
    
    try {
      const emailQuery = query(
        collection(db, "users_librarian"), 
        where("email", "==", email)
      );
      const emailSnapshot = await getDocs(emailQuery);
      
      if (!emailSnapshot.empty) {
        setEmailError("This email is already registered");
        return true;
      } else {
        setEmailError(null);
        return false;
      }
    } catch (error) {
      console.error("Error checking email:", error);
      return false;
    }
  };

  // Check if phone already exists - real-time validation
  const checkPhoneExists = async (phone: string) => {
    if (!phone) return;
    
    try {
      const phoneQuery = query(
        collection(db, "users_librarian"), 
        where("phone", "==", phone)
      );
      const phoneSnapshot = await getDocs(phoneQuery);
      
      if (!phoneSnapshot.empty) {
        setPhoneError("This phone number is already registered");
        return true;
      } else {
        setPhoneError(null);
        return false;
      }
    } catch (error) {
      console.error("Error checking phone:", error);
      return false;
    }
  };

  // Handle form input changes
  const handleInputChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Real-time validation for email and phone
    if (name === 'email') {
      await checkEmailExists(value);
    } else if (name === 'phone') {
      await checkPhoneExists(value);
    }
  };

  // Generate a random password
  const generatePassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Generate a unique employee ID
  const generateEmployeeId = async () => {
    const year = new Date().getFullYear().toString().substring(2);
    const librariansCollection = collection(db, "users_librarian");
    const snapshot = await getDocs(librariansCollection);
    const count = snapshot.size + 1;
    return `LIB-${year}-${count.toString().padStart(4, '0')}`;
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      // Validate form data
      if (!formData.firstName || !formData.lastName || !formData.email || !formData.phone) {
        throw new Error("Please fill in all required fields");
      }
      
      // Check for validation errors
      if (emailError) {
        throw new Error("Please use a different email address");
      }
      
      if (phoneError) {
        throw new Error("Please use a different phone number");
      }
      
      // Final check for email and phone duplicates
      const emailExists = await checkEmailExists(formData.email);
      const phoneExists = await checkPhoneExists(formData.phone);
      
      if (emailExists) {
        throw new Error("This email is already registered");
      }
      
      if (phoneExists) {
        throw new Error("This phone number is already registered");
      }
      
      // Store current admin UID
      const adminUid = auth.currentUser?.uid;
      
      // Generate employee ID and password
      const employeeId = await generateEmployeeId();
      const password = generatePassword();
      
      // Generate a unique UID for the librarian
      const librarianUid = `lib_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Add directly to users_librarian with the generated UID
      await setDoc(doc(db, "users_librarian", librarianUid), {
        uid: librarianUid,
        employeeId: employeeId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        city: formData.city,
        state: formData.state,
        zip: formData.zip,
        department: formData.department,
        employmentType: formData.employmentType,
        startDate: formData.startDate,
        createdAt: serverTimestamp(),
        lastLogin: null,
        status: 'active',
        role: 'librarian',
        password: password,
        createdBy: adminUid
      });
      
      // Set credentials for popup
      setLibrarianCredentials({
        id: employeeId,
        password: password,
        email: formData.email
      });
      
      // Show success popup
      setShowPopup(true);
      
      // Reset form
      setFormData({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        department: 'general',
        employmentType: 'full-time',
        startDate: new Date().toISOString().substring(0, 10),
      });
      
    } catch (error: any) {
      console.error("Error adding librarian:", error);
      setError(error.message || "Failed to add librarian. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle popup close
  const handleClosePopup = () => {
    setShowPopup(false);
    // Redirect to librarians list page
    router.push('/admin/librarians');
  };

  // Copy credentials to clipboard
  const copyCredentials = () => {
    const text = `
Employee ID: ${librarianCredentials.id}
Password: ${librarianCredentials.password}
Email: ${librarianCredentials.email}
    `;
    
    navigator.clipboard.writeText(text)
      .then(() => {
        alert("Credentials copied to clipboard!");
      })
      .catch(err => {
        console.error("Failed to copy credentials:", err);
        alert("Failed to copy credentials. Please manually select and copy the information.");
      });
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // If not authenticated, don't render anything (redirect happens in useEffect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.adminLayout}>
      {/* Sidebar */}
      <Sidebar activeMenuItem={activeMenuItem} handleLogout={handleLogout} />
      
      {/* Main Content */}
      <main className={styles.mainContent}>
        {/* Dashboard Content */}
        <div className={styles.dashboardContent}>
          <div className={styles.pageContainer}>
            <div className={styles.pageHeader}>
              <h1 className={styles.pageTitle}>Add Librarian</h1>
              <p>Create a new librarian account in the system</p>
            </div>
            
            {error && (
              <div className={styles.errorAlert}>
                {error}
              </div>
            )}
            
            <div className={styles.formContainer}>
              <form onSubmit={handleSubmit}>
                <div className={styles.formSection}>
                  <h2>Personal Information</h2>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="firstName">First Name *</label>
                      <input
                        type="text"
                        id="firstName"
                        name="firstName"
                        value={formData.firstName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="lastName">Last Name *</label>
                      <input
                        type="text"
                        id="lastName"
                        name="lastName"
                        value={formData.lastName}
                        onChange={handleInputChange}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="email">Email Address *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className={emailError ? styles.inputError : ''}
                      />
                      {emailError && (
                        <div className={styles.fieldError}>{emailError}</div>
                      )}
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="phone">Phone Number *</label>
                      <input
                        type="tel"
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        required
                        className={phoneError ? styles.inputError : ''}
                      />
                      {phoneError && (
                        <div className={styles.fieldError}>{phoneError}</div>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className={styles.formSection}>
                  <h2>Address Information</h2>
                  <div className={styles.formGroup}>
                    <label htmlFor="address">Street Address</label>
                    <input
                      type="text"
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="city">City</label>
                      <input
                        type="text"
                        id="city"
                        name="city"
                        value={formData.city}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="state">State</label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="zip">ZIP Code</label>
                      <input
                        type="text"
                        id="zip"
                        name="zip"
                        value={formData.zip}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
                
                <div className={styles.formSection}>
                  <h2>Employment Information</h2>
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="department">Department</label>
                      <select
                        id="department"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                      >
                        <option value="general">General</option>
                        <option value="circulation">Circulation</option>
                        <option value="reference">Reference</option>
                        <option value="childrens">Children's</option>
                        <option value="technical">Technical Services</option>
                        <option value="archives">Archives</option>
                        <option value="digital">Digital Resources</option>
                        <option value="adult">Adult Services</option>
                        <option value="youth">Youth Services</option>
                        <option value="administration">Administration</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="employmentType">Employment Type</label>
                      <select
                        id="employmentType"
                        name="employmentType"
                        value={formData.employmentType}
                        onChange={handleInputChange}
                      >
                        <option value="full-time">Full-Time</option>
                        <option value="part-time">Part-Time</option>
                        <option value="volunteer">Volunteer</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor="startDate">Start Date</label>
                      <input
                        type="date"
                        id="startDate"
                        name="startDate"
                        value={formData.startDate}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                </div>
                
                <div className={styles.formActions}>
                  <Link href="/admin/librarians" className={styles.cancelButton}>
                    Cancel
                  </Link>
                  <button 
                    type="submit" 
                    className={styles.submitButton} 
                    disabled={submitting || !!emailError || !!phoneError}
                  >
                    {submitting ? 'Adding...' : 'Add Librarian'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>

      </main>

      {/* Credentials Popup */}
      {showPopup && (
        <div className={styles.popupOverlay}>
          <div className={styles.popup}>
            <div className={styles.popupHeader}>
              <h2>Librarian Account Created</h2>
              <button 
                className={styles.popupClose}
                onClick={handleClosePopup}
              >
                ×
              </button>
            </div>
            <div className={styles.popupContent}>
              <div className={styles.credentialsContainer}>
                <div className={styles.credentialItem}>
                  <span className={styles.credentialLabel}>Employee ID:</span>
                  <span className={styles.credentialValue}>{librarianCredentials.id}</span>
                </div>
                <div className={styles.credentialItem}>
                  <span className={styles.credentialLabel}>Password:</span>
                  <span className={styles.credentialValue}>{librarianCredentials.password}</span>
                </div>
                <div className={styles.credentialItem}>
                  <span className={styles.credentialLabel}>Email:</span>
                  <span className={styles.credentialValue}>{librarianCredentials.email}</span>
                </div>
              </div>
              
              <div className={styles.popupNote}>
                <div className={styles.noteIcon}>⚠️</div>
                <p>
                  <strong>IMPORTANT:</strong> Please save or copy these credentials. 
                  The password will not be displayed again and cannot be recovered.
                </p>
              </div>
            </div>
            <div className={styles.popupActions}>
              <button 
                className={styles.copyButton}
                onClick={copyCredentials}
              >
                Copy Credentials
              </button>
              <button 
                className={styles.doneButton}
                onClick={handleClosePopup}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

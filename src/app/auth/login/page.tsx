// src/app/auth/login/page.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';
import styles from './login.module.css';
import Footer from '@/app/components/layout/Footer';
import Navbar from '@/app/components/layout/Navbar';
import UserLogin from '@/app/user/login/page';
import AdminLogin from '@/app/admin/login/page';
import LibrarianLogin from '@/app/librarian/login/page';
import { UserType, AuthMode } from '@/app/auth/login/types';

export default function LoginPage() {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [userType, setUserType] = useState<UserType>('customer');
  const [showSecurityKeyPopup, setShowSecurityKeyPopup] = useState(false);
  const [newSecurityKey, setNewSecurityKey] = useState<string | null>(null);
  const [securityKeyCopied, setSecurityKeyCopied] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errors, setErrors] = useState<{general?: string}>({});

  // Function to handle user type selection
  const handleUserTypeChange = (type: UserType) => {
    setUserType(type);
  };

  // Copy security key with improved handling
  const copySecurityKey = () => {
    if (newSecurityKey) {
      navigator.clipboard.writeText(newSecurityKey)
        .then(() => {
          setSecurityKeyCopied(true);
          setSuccessMessage("Security key copied to clipboard!");
          setTimeout(() => setSuccessMessage(""), 3000);
        })
        .catch(err => {
          console.error('Failed to copy security key:', err);
          alert('Failed to copy security key. Please manually select and copy the key.');
        });
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <Navbar />
      
      <main className={styles.loginPage}>
        <div className={styles.container}>
          <div className={styles.loginContainer}>
            <div className={styles.loginForm}>
              <div className={styles.formHeader}>
                <a href="/" className={styles.logo}>
                  <span className={styles.logoText}>OpenShelf</span>
                </a>
                {authMode === 'login' && (
                  <>
                    <h1>Welcome Back</h1>
                    <p>Sign in to access your library account</p>
                  </>
                )}
                {authMode === 'resetKey' && (
                  <>
                    <h1>Reset Security Key</h1>
                    <p>Verify your identity to generate a new security key</p>
                  </>
                )}
                {authMode === 'verifyDevice' && (
                  <>
                    <h1>New Device Detected</h1>
                    <p>Please verify your identity to continue</p>
                  </>
                )}
              </div>
              
              {errors.general && (
                <div className={styles.errorAlert}>
                  {errors.general}
                </div>
              )}
              
              {successMessage && (
                <div className={styles.successAlert}>
                  {successMessage}
                </div>
              )}
              
              {authMode === 'login' && (
                <>
                  <div className={styles.userTypeSelector}>
                    <button 
                      type="button"
                      className={`${styles.userTypeButton} ${userType === 'customer' ? styles.userTypeActive : ''}`}
                      onClick={() => handleUserTypeChange('customer')}
                    >
                      Customer
                    </button>
                    <button 
                      type="button"
                      className={`${styles.userTypeButton} ${userType === 'librarian' ? styles.userTypeActive : ''}`}
                      onClick={() => handleUserTypeChange('librarian')}
                    >
                      Librarian
                    </button>
                    <button 
                      type="button"
                      className={`${styles.userTypeButton} ${userType === 'admin' ? styles.userTypeActive : ''}`}
                      onClick={() => handleUserTypeChange('admin')}
                    >
                      Admin
                    </button>
                  </div>
                  
                  {userType === 'customer' && (
                    <UserLogin 
                      setErrors={setErrors}
                    />
                  )}
                  
                  {userType === 'admin' && (
                    <AdminLogin 
                      setErrors={setErrors}
                      setNewSecurityKey={setNewSecurityKey}
                      setShowSecurityKeyPopup={setShowSecurityKeyPopup}
                    />
                  )}
                  
                  {userType === 'librarian' && (
                    <LibrarianLogin 
                      setErrors={setErrors}
                    />
                  )}
                </>
              )}

              {/* Security Key Popup */}
              {showSecurityKeyPopup && newSecurityKey && (
                <div className={styles.securityKeyPopup}>
                  <div className={styles.securityKeyPopupContent}>
                    <div className={styles.securityKeyPopupHeader}>
                      <h3>Your New Security Key</h3>
                      <span className={styles.securityKeyPopupSubheader}>
                        This will only be shown once
                      </span>
                    </div>
                    <div className={styles.securityKeyPopupBody}>
                      <div className={styles.securityKeyWarning}>
                        <span className={styles.warningIcon}>⚠️</span>
                        <p>
                          <strong>IMPORTANT:</strong> Your security key will only be shown this one time. Please copy it and store it in a secure location. This key will be required for all future admin logins.
                        </p>
                      </div>
                      
                      <div className={styles.securityKeyDisplay}>
                        {newSecurityKey}
                      </div>
                      
                      <div className={styles.securityKeyActions}>
                        <button 
                          className={styles.securityKeyCopyButton}
                          onClick={copySecurityKey}
                        >
                          {securityKeyCopied ? "Copied!" : "Copy to Clipboard"}
                        </button>
                        
                        <button 
                          className={styles.securityKeyDoneButton}
                          onClick={() => {
                            if (securityKeyCopied) {
                              setShowSecurityKeyPopup(false);
                              setAuthMode('login');
                              window.location.reload();
                            } else {
                              setSuccessMessage("Please copy your security key before continuing");
                              setTimeout(() => setSuccessMessage(""), 3000);
                            }
                          }}
                          disabled={!securityKeyCopied}
                        >
                          I've Saved My Key
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className={styles.loginImage}>
              <div className={styles.imageOverlay}>
                <div className={styles.imageContent}>
                  <h2>Welcome to OpenShelf</h2>
                  <ul className={styles.benefitsList}>
                    <li>Access thousands of books, journals, and digital resources</li>
                    <li>Reserve books online and get notified when they're available</li>
                    <li>Track your reading history and get personalized recommendations</li>
                    <li>Participate in community events and reading groups</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      
      <Footer />
    </div>
  );
}

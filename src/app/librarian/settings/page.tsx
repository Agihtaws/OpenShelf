// src/app/librarian/settings/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '../../../firebaseConfig';
import { 
  doc, 
  getDoc, 
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import styles from './settings.module.css';
import { 
  FiUser, 
  FiMail, 
  FiPhone, 
  FiLock, 
  FiSave, 
  FiCheck, 
  FiAlertCircle,
  FiArrowLeft
} from 'react-icons/fi';

interface Librarian {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  employeeId: string;
  department?: string;
  password: string;
}

export default function LibrarianSettings() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<Partial<Librarian>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    employeeId: '',
    department: ''
  });

  const [userInitials, setUserInitials] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordMessage, setPasswordMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordSaved, setIsPasswordSaved] = useState(false);

  useEffect(() => {
    const fetchLibrarianData = async () => {
      try {
        const librarianId = localStorage.getItem('librarian_id');
        if (!librarianId) {
          router.push('/auth/login');
          return;
        }

        const librarianDoc = await getDoc(doc(db, "users_librarian", librarianId));

        if (librarianDoc.exists()) {
          const data = librarianDoc.data();
          setUserData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            employeeId: data.employeeId || '',
            department: data.department || ''
          });

          // Set user initials for avatar fallback
          if (data.firstName && data.lastName) {
            setUserInitials(`${data.firstName.charAt(0)}${data.lastName.charAt(0)}`);
          } else if (data.email) {
            setUserInitials(data.email.charAt(0).toUpperCase());
          }
        } else {
          router.push('/auth/login');
        }
      } catch (error) {
        console.error("Error fetching librarian data:", error);
        setErrorMessage("Failed to load librarian data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchLibrarianData();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setPasswordData(prev => ({
      ...prev,
      [name]: value
    }));

    if (name === 'newPassword') {
      checkPasswordStrength(value);
    }
  };

  const checkPasswordStrength = (password: string) => {
    // Password strength criteria
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}><]/.test(password);
    const isLongEnough = password.length >= 8;

    // Calculate strength score (0-5)
    const criteria = [hasLowercase, hasUppercase, hasNumber, hasSpecialChar, isLongEnough];
    const strength = criteria.filter(Boolean).length;

    setPasswordStrength(strength);

    // Set appropriate message
    if (strength === 0) {
      setPasswordMessage('Very weak');
    } else if (strength === 1) {
      setPasswordMessage('Weak');
    } else if (strength === 2) {
      setPasswordMessage('Fair');
    } else if (strength === 3) {
      setPasswordMessage('Good');
    } else if (strength === 4) {
      setPasswordMessage('Strong');
    } else {
      setPasswordMessage('Very strong');
    }
  };

  const handleSaveChanges = async () => {
    try {
      setIsSaving(true);
      const librarianId = localStorage.getItem('librarian_id');
      if (!librarianId) {
        router.push('/auth/login');
        return;
      }

      // Only update phone number
      await updateDoc(doc(db, "users_librarian", librarianId), {
        phone: userData.phone
      });

      setSuccessMessage("Your profile has been updated successfully!");

      // Reset save button after 3 seconds
      setTimeout(() => {
        setIsSaving(false);
      }, 3000);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error updating profile:", error);
      setErrorMessage("Failed to update profile. Please try again.");
      setIsSaving(false);

      // Clear error message after 5 seconds
      setTimeout(() => {
        setErrorMessage("");
      }, 5000);
    }
  };

  const handleSavePassword = async () => {
    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setErrorMessage("New passwords don't match");
      return;
    }

    if (passwordStrength < 3) {
      setErrorMessage("Please choose a stronger password");
      return;
    }

    try {
      setIsPasswordSaved(true);
      const librarianId = localStorage.getItem('librarian_id');
      if (!librarianId) {
        router.push('/auth/login');
        return;
      }

      // Verify current password
      const librarianDoc = await getDoc(doc(db, "users_librarian", librarianId));

      if (!librarianDoc.exists()) {
        setErrorMessage("User not found");
        setIsPasswordSaved(false);
        return;
      }

      if (librarianDoc.data().password !== passwordData.currentPassword) {
        setErrorMessage("Current password is incorrect");
        setIsPasswordSaved(false);
        return;
      }

      // Update password
      await updateDoc(doc(db, "users_librarian", librarianId), {
        password: passwordData.newPassword,
        lastPasswordChange: serverTimestamp()
      });

      // Reset form and show success message
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });

      setSuccessMessage("Password updated successfully!");

      // Reset the save button after 3 seconds
      setTimeout(() => {
        setIsPasswordSaved(false);
      }, 3000);

      // Close the modal after 3.5 seconds
      setTimeout(() => {
        setShowPasswordModal(false);
      }, 3500);

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSuccessMessage("");
      }, 5000);
    } catch (error) {
      console.error("Error updating password:", error);
      setErrorMessage("Failed to update password. Please try again.");
      setIsPasswordSaved(false);

      // Clear error message after 5 seconds
      setTimeout(() => {
        setErrorMessage("");
      }, 5000);
    }
  };

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingsHeader}>
        
        <h3>Manage your account information and password</h3>
      </div>

      {successMessage && (
        <div className={styles.successMessage}>
          <FiCheck className={styles.messageIcon} />
          {successMessage}
        </div>
      )}

      {errorMessage && (
        <div className={styles.errorMessage}>
          <FiAlertCircle className={styles.messageIcon} />
          {errorMessage}
        </div>
      )}

      <div className={styles.settingsCard}>
        <div className={styles.cardHeader}>
          <h2>Profile Information</h2>
        </div>

        <div className={styles.profileSection}>
          <div className={styles.avatarSection}>
            <div className={styles.userInitialsAvatar}>
              {userInitials}
            </div>
            
          </div>

          <div className={styles.profileForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="firstName">First Name</label>
                <div className={styles.inputWrapper}>
                  <FiUser className={styles.inputIcon} />
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={userData.firstName}
                    disabled
                    className={styles.disabledInput}
                  />
                </div>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="lastName">Last Name</label>
                <div className={styles.inputWrapper}>
                  <FiUser className={styles.inputIcon} />
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={userData.lastName}
                    disabled
                    className={styles.disabledInput}
                  />
                </div>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="employeeId">Employee ID</label>
              <div className={styles.inputWrapper}>
                <FiUser className={styles.inputIcon} />
                <input
                  type="text"
                  id="employeeId"
                  name="employeeId"
                  value={userData.employeeId}
                  disabled
                  className={styles.disabledInput}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="department">Department</label>
              <div className={styles.inputWrapper}>
                <FiUser className={styles.inputIcon} />
                <input
                  type="text"
                  id="department"
                  name="department"
                  value={userData.department}
                  disabled
                  className={styles.disabledInput}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="email">Email Address</label>
              <div className={styles.inputWrapper}>
                <FiMail className={styles.inputIcon} />
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={userData.email}
                  disabled
                  className={styles.disabledInput}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="phone">Phone Number</label>
              <div className={styles.inputWrapper}>
                <FiPhone className={styles.inputIcon} />
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={userData.phone}
                  onChange={handleInputChange}
                  className={styles.formInput}
                />
              </div>
            </div>
          </div>
        </div>

        <div className={styles.securitySection}>
          <h3>Security</h3>
          <div className={styles.passwordSection}>
            <div className={styles.passwordInfo}>
              <FiLock className={styles.securityIcon} />
              <div>
                <h4>Password</h4>
                <p>Update your password to enhance account security</p>
              </div>
            </div>
            <button
              className={styles.changePasswordBtn}
              onClick={() => setShowPasswordModal(true)}
            >
              Change Password
            </button>
          </div>
        </div>

        <div className={styles.formActions}>
          <button
            className={`${styles.saveButton} ${isSaving ? styles.saved : ''}`}
            onClick={handleSaveChanges}
            disabled={isSaving}
          >
            {isSaving ? (
              <>
                <FiCheck /> Saved
              </>
            ) : (
              <>
                <FiSave /> Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Password Change Modal */}
      {showPasswordModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.passwordModal}>
            <div className={styles.modalHeader}>
              <h3>Change Password</h3>
              <button
                className={styles.closeButton}
                onClick={() => setShowPasswordModal(false)}
              >
                &times;
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label htmlFor="currentPassword">Current Password</label>
                <input
                  type="password"
                  id="currentPassword"
                  name="currentPassword"
                  value={passwordData.currentPassword}
                  onChange={handlePasswordChange}
                  className={styles.formInput}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  value={passwordData.newPassword}
                  onChange={handlePasswordChange}
                  className={styles.formInput}
                  required
                />

                <div className={styles.passwordStrength}>
                  <div className={styles.strengthBar}>
                    <div
                      className={styles.strengthIndicator}
                      style={{
                        width: `${(passwordStrength / 5) * 100}%`,
                        backgroundColor:
                          passwordStrength <= 1 ? '#ff4d4f' :
                            passwordStrength <= 2 ? '#faad14' :
                              passwordStrength <= 3 ? '#52c41a' : '#1890ff'
                      }}
                    ></div>
                  </div>
                  <span className={styles.strengthText}>{passwordMessage}</span>
                </div>

                <ul className={styles.passwordRequirements}>
                  <li>At least 8 characters</li>
                  <li>Include uppercase and lowercase letters</li>
                  <li>Include at least one number</li>
                  <li>Include at least one special character</li>
                </ul>
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword">Confirm Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  value={passwordData.confirmPassword}
                  onChange={handlePasswordChange}
                  className={styles.formInput}
                  required
                />
                {passwordData.newPassword && passwordData.confirmPassword &&
                  passwordData.newPassword !== passwordData.confirmPassword && (
                    <p className={styles.passwordMismatch}>
                      <FiAlertCircle /> Passwords don't match
                    </p>
                  )}
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className={styles.cancelButton}
                onClick={() => setShowPasswordModal(false)}
              >
                Cancel
              </button>
              <button
                className={`${styles.saveButton} ${isPasswordSaved ? styles.saved : ''}`}
                onClick={handleSavePassword}
                disabled={
                  isPasswordSaved ||
                  !passwordData.currentPassword ||
                  !passwordData.newPassword ||
                  !passwordData.confirmPassword ||
                  passwordData.newPassword !== passwordData.confirmPassword ||
                  passwordStrength < 3
                }
              >
                {isPasswordSaved ? (
                  <>
                    <FiCheck /> Saved
                  </>
                ) : (
                  'Save'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

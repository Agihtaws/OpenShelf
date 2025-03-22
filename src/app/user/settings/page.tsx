// src/app/user/settings/page.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { auth, db } from '../../../firebaseConfig';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import styles from './settings.module.css';
import { FiUser, FiMail, FiPhone, FiLock, FiSave, FiCheck, FiAlertCircle } from 'react-icons/fi';

interface User {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  libraryCardId: string;
  photoURL: string;
}

export default function UserSettings() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [userData, setUserData] = useState<Partial<User>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    libraryCardId: '',
    photoURL: ''
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
  const [phoneError, setPhoneError] = useState('');
  const [isCurrentPasswordValid, setIsCurrentPasswordValid] = useState(true);

  const validatePhoneInput = (value: string) => {
    // Only allow digits and limit to 10 characters
    return value.replace(/\D/g, '').slice(0, 10);
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const userId = localStorage.getItem('user_id');
        if (!userId) {
          router.push('/auth/login');
          return;
        }

        const userDoc = await getDoc(doc(db, "users_customer", userId));

        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData({
            firstName: data.firstName || '',
            lastName: data.lastName || '',
            email: data.email || '',
            phone: data.phone || '',
            libraryCardId: data.libraryCardId || 'LIB-ID-CARD-1',
            photoURL: data.photoURL || ''
          });

          // Set user initials for avatar fallback - UPDATED to ensure capitalization
          if (data.firstName && data.lastName) {
            const firstInitial = data.firstName.charAt(0).toUpperCase();
            const lastInitial = data.lastName.charAt(0).toUpperCase();
            setUserInitials(`${firstInitial}${lastInitial}`);
          } else if (data.email) {
            setUserInitials(data.email.charAt(0).toUpperCase());
          }
        } else {
          router.push('/auth/login');
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setErrorMessage("Failed to load user data. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    if (name === 'phone') {
      // Apply phone number validation
      const validatedValue = validatePhoneInput(value);
      setUserData(prev => ({
        ...prev,
        [name]: validatedValue
      }));
      
      // Set error message if not 10 digits
      if (validatedValue.length > 0 && validatedValue.length !== 10) {
        setPhoneError('Please enter exactly 10 digits');
      } else {
        setPhoneError('');
      }
    } else {
      setUserData(prev => ({
        ...prev,
        [name]: value
      }));
    }
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
    
    // Reset current password validation when the field changes
    if (name === 'currentPassword') {
      setIsCurrentPasswordValid(true);
    }
  };

  const checkPasswordStrength = (password: string) => {
    // Password strength criteria
    const hasLowercase = /[a-z]/.test(password);
    const hasUppercase = /[A-Z]/.test(password);
    const hasNumber = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    const isLongEnough = password.length >= 8;

    // Calculate strength score (0-4)
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
      setPasswordMessage('Very strong');
    } else {
      setPasswordMessage('Very strong');
    }
  };

  const handleSaveChanges = async () => {
    // Validate phone number before saving
    if (userData.phone && userData.phone.length !== 10) {
      setErrorMessage("Please enter exactly 10 digits for phone number");
      return;
    }
    
    try {
      setIsSaving(true);
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        router.push('/auth/login');
        return;
      }

      // Only update phone number as email and library card ID are fixed
      await updateDoc(doc(db, "users_customer", userId), {
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

  const validateCurrentPassword = async () => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        router.push('/auth/login');
        return false;
      }

      const userDoc = await getDoc(doc(db, "users_customer", userId));

      if (!userDoc.exists()) {
        setErrorMessage("User not found");
        return false;
      }

      const isValid = userDoc.data().password === passwordData.currentPassword;
      setIsCurrentPasswordValid(isValid);
      
      if (!isValid) {
        setErrorMessage("Current password is incorrect");
      } else {
        setErrorMessage("");
      }
      
      return isValid;
    } catch (error) {
      console.error("Error validating password:", error);
      setErrorMessage("Failed to validate current password");
      return false;
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
      const userId = localStorage.getItem('user_id');
      if (!userId) {
        router.push('/auth/login');
        return;
      }

      // Verify current password
      const userDoc = await getDoc(doc(db, "users_customer", userId));

      if (!userDoc.exists()) {
        setErrorMessage("User not found");
        setIsPasswordSaved(false);
        return;
      }

      if (userDoc.data().password !== passwordData.currentPassword) {
        setErrorMessage("Current password is incorrect");
        setIsCurrentPasswordValid(false);
        setIsPasswordSaved(false);
        return;
      }

      await updateDoc(doc(db, "users_customer", userId), {
        password: passwordData.newPassword,
        passwordLastUpdated: serverTimestamp()
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
    <main className={styles.settingsContainer}>
      <div className={styles.settingsHeader}>
        
        <h3>Manage your personal information and password</h3>
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
            {userData.photoURL ? (
              <Image
                src={userData.photoURL}
                alt="Profile"
                width={100}
                height={100}
                className={styles.userAvatar}
              />
            ) : (
              <div className={styles.userInitialsAvatar}>
                {userInitials}
              </div>
            )}
            
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
              <label htmlFor="libraryCardId">Library Card ID</label>
              <div className={styles.inputWrapper}>
                <FiUser className={styles.inputIcon} />
                <input
                  type="text"
                  id="libraryCardId"
                  name="libraryCardId"
                  value={userData.libraryCardId}
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
                  className={`${styles.formInput} ${phoneError ? styles.inputError : ''}`}
                  maxLength={10}
                  pattern="[0-9]{10}"
                  placeholder="10-digit phone number"
                />
              </div>
              {phoneError && (
                <p className={styles.fieldError}>
                  <FiAlertCircle /> {phoneError}
                </p>
              )}
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
            disabled={isSaving || (!!userData.phone && userData.phone.length !== 10)}
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
                  onBlur={validateCurrentPassword}
                  className={`${styles.formInput} ${!isCurrentPasswordValid ? styles.inputError : ''}`}
                  required
                />
                {!isCurrentPasswordValid && (
                  <p className={styles.fieldError}>
                    <FiAlertCircle /> Current password is incorrect
                  </p>
                )}
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
                  passwordStrength < 3 ||
                  !isCurrentPasswordValid
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
    </main>
  );
}

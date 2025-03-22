// src/app/admin/settings/page.tsx
"use client";

import { useState, useEffect, useRef, ChangeEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { 
  auth, 
  db, 
  storage,
  doc,
  getDoc,
  updateDoc,
  ref,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  signInWithEmailAndPassword
} from '@/firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import styles from './settings.module.css';

interface AdminProfile {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  profileImage?: string;
  securityKey?: string;
}

export default function AdminSettings() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<AdminProfile>({
    firstName: '',
    lastName: '',
    email: '',
    phoneNumber: '',
  });
  
  // States for form handling
  const [showSecurityKey, setShowSecurityKey] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [errors, setErrors] = useState<{[key: string]: string}>({});
  
  // Ref for file input
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // State for image upload
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  
  // Original profile data for comparison
  const [originalProfile, setOriginalProfile] = useState<AdminProfile | null>(null);

  // States for password verification
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

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
            
            // Fetch admin profile data
            const userData = userSnapshot.data();
            const profileData = {
              firstName: userData.firstName || '',
              lastName: userData.lastName || '',
              email: userData.email || user.email || '',
              phoneNumber: userData.phoneNumber || '',
              profileImage: userData.profileImage || '',
              securityKey: userData.securityKey || ''
            };
            
            setProfile(profileData);
            setOriginalProfile(profileData);
            
            setIsLoading(false);
          } else {
            // User exists in Firebase Auth but not in users_admin collection
            console.log("Admin document not found - signing out");
            setIsAuthenticated(false);
            
            // Redirect to login
            window.location.replace('/auth/login');
            // Only set loading to false after redirect is initiated
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAuthenticated(false);
          setIsLoading(false);
          
          // Redirect to login
          window.location.replace('/auth/login');
        }
      } else {
        // No user is signed in
        setIsAuthenticated(false);
        // Don't set loading to false here, wait for redirect
        
        // Redirect to login
        window.location.replace('/auth/login');
      }
    });
    
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);
  

  // Check for changes in profile data
  useEffect(() => {
    if (!originalProfile) return;
    
    const hasProfileChanged = 
      profile.firstName !== originalProfile.firstName ||
      profile.lastName !== originalProfile.lastName ||
      profile.phoneNumber !== originalProfile.phoneNumber ||
      profile.profileImage !== originalProfile.profileImage;
    
    setHasChanges(hasProfileChanged);
    
    if (hasProfileChanged) {
      setSaveStatus('idle');
    }
  }, [profile, originalProfile]);

  // Handle input changes
  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    
    // Validate phone number (10 digits only)
    if (name === 'phoneNumber') {
      // Only allow digits and limit to 10
      const digitsOnly = value.replace(/\D/g, '').slice(0, 10);
      
      setProfile(prev => ({
        ...prev,
        [name]: digitsOnly
      }));
      
      // Set error if not 10 digits and not empty
      if (digitsOnly.length > 0 && digitsOnly.length !== 10) {
        setErrors(prev => ({
          ...prev,
          phoneNumber: 'Phone number must be exactly 10 digits'
        }));
      } else {
        // Clear error if valid or empty
        setErrors(prev => {
          const newErrors = { ...prev };
          delete newErrors.phoneNumber;
          return newErrors;
        });
      }
    } else {
      setProfile(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle password input change
  const handlePasswordInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    setPasswordInput(e.target.value);
    if (passwordError) setPasswordError('');
  };

  // Handle profile image upload
  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Validate file is an image and not too large
    if (!file.type.match('image.*')) {
      alert('Please select an image file');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('Image size should not exceed 5MB');
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No authenticated user');
      
      // Create a reference to the storage location
      const storageRef = ref(storage, `admin_profiles/${currentUser.uid}`);
      
      // Upload the file with progress monitoring
      const uploadTask = uploadBytesResumable(storageRef, file);
      
      // Monitor upload progress
      uploadTask.on('state_changed', 
        (snapshot) => {
          // Get upload progress
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(progress);
        },
        (error) => {
          // Handle errors
          console.error("Upload error:", error);
          alert('Upload failed. Please try again.');
          setIsUploading(false);
        },
        async () => {
          // Upload completed successfully
          // Get download URL
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          // Update profile state
          setProfile(prev => ({
            ...prev,
            profileImage: downloadURL
          }));
          
          // Update the profile in Firestore
          const userDocRef = doc(db, "users_admin", currentUser.uid);
          await updateDoc(userDocRef, {
            profileImage: downloadURL,
            updatedAt: new Date()
          });
          
          // Update originalProfile state to reflect this change
          setOriginalProfile(prev => prev ? {
            ...prev,
            profileImage: downloadURL
          } : null);
          
          // Update profile in localStorage for header
          localStorage.setItem('admin_profile_image', downloadURL);
          
          // Dispatch a custom event to notify header of profile update
          window.dispatchEvent(new CustomEvent('admin_profile_updated', {
            detail: {
              profileImage: downloadURL
            }
          }));
          
          setHasChanges(true);
          setSaveStatus('saved');
          setIsUploading(false);
        }
      );
      
    } catch (error) {
      console.error("Error uploading image:", error);
      alert('Failed to upload image. Please try again.');
      setIsUploading(false);
    }
  };

  // Handle profile image removal
  const handleRemoveImage = async () => {
    if (!window.confirm('Are you sure you want to remove your profile image?')) {
      return;
    }
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No authenticated user');
      
      // Create a reference to the storage location
      const storageRef = ref(storage, `admin_profiles/${currentUser.uid}`);
      
      // Delete the file from storage
      try {
        await deleteObject(storageRef);
      } catch (error) {
        console.error("Error deleting image from storage:", error);
        // Continue even if storage deletion fails
      }
      
      // Update profile state
      setProfile(prev => ({
        ...prev,
        profileImage: ''
      }));
      
      // Update originalProfile state to reflect this change
      setOriginalProfile(prev => prev ? {
        ...prev,
        profileImage: ''
      } : null);
      
      // Update the profile in Firestore
      const userDocRef = doc(db, "users_admin", currentUser.uid);
      await updateDoc(userDocRef, {
        profileImage: '',
        updatedAt: new Date()
      });
      
      // Remove profile image from localStorage
      localStorage.removeItem('admin_profile_image');
      
      // Dispatch a custom event to notify header of profile update
      window.dispatchEvent(new CustomEvent('admin_profile_updated', {
        detail: {
          profileImage: ''
        }
      }));
      
      setHasChanges(true);
      setSaveStatus('saved');
      
    } catch (error) {
      console.error("Error removing image:", error);
      alert('Failed to remove image. Please try again.');
    }
  };

  // Save profile changes
  const saveProfileChanges = async () => {
    // Validate phone number if present
    if (profile.phoneNumber && profile.phoneNumber.length !== 10) {
      setErrors(prev => ({
        ...prev,
        phoneNumber: 'Phone number must be exactly 10 digits'
      }));
      return;
    }
    
    setIsSaving(true);
    setSaveStatus('saving');
    
    try {
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('No authenticated user');
      
      // Update the profile in Firestore
      const userDocRef = doc(db, "users_admin", currentUser.uid);
      await updateDoc(userDocRef, {
        firstName: profile.firstName,
        lastName: profile.lastName,
        phoneNumber: profile.phoneNumber,
        updatedAt: new Date()
      });
      
      // Store profile info in localStorage for header
      localStorage.setItem('admin_first_name', profile.firstName);
      localStorage.setItem('admin_last_name', profile.lastName);
      
      // Update originalProfile to match current profile
      setOriginalProfile(profile);
      
      // Dispatch a custom event to notify header of profile update
      window.dispatchEvent(new CustomEvent('admin_profile_updated', {
        detail: {
          firstName: profile.firstName,
          lastName: profile.lastName
        }
      }));
      
      setHasChanges(false);
      setSaveStatus('saved');
      
      // Reset save status after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle');
      }, 3000);
      
    } catch (error) {
      console.error("Error saving profile:", error);
      setSaveStatus('error');
      alert('Failed to save profile changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Toggle security key visibility
  const toggleSecurityKey = () => {
    if (showSecurityKey) {
      // If already showing, just hide it
      setShowSecurityKey(false);
      setPasswordInput('');
      setPasswordError('');
    } else {
      // If not showing, require password verification first
      setIsVerifyingPassword(true);
    }
  };

  // Verify admin password
  const verifyAdminPassword = async () => {
    if (!passwordInput.trim()) {
      setPasswordError('Password is required');
      return;
    }
    
    try {
      // Get current user
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Not authenticated');
      
      // Re-authenticate user with their password
      await signInWithEmailAndPassword(
        auth,
        currentUser.email || '',
        passwordInput
      );
      
      // If successful, show security key
      setShowSecurityKey(true);
      setIsVerifyingPassword(false);
      setPasswordInput('');
      setPasswordError('');
    } catch (error) {
      console.error("Password verification failed:", error);
      setPasswordError('Incorrect password. Please try again.');
    }
  };

  // Cancel password verification
  const cancelPasswordVerification = () => {
    setIsVerifyingPassword(false);
    setPasswordInput('');
    setPasswordError('');
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading settings...</p>
      </div>
    );
  }

  // If not authenticated, don't render anything (redirect happens in useEffect)
  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={styles.settingsContainer}>
      <div className={styles.settingsContent}>
        <div className={styles.profileSection}>
          <div className={styles.profileImageContainer}>
            {profile.profileImage ? (
              <Image 
                src={profile.profileImage} 
                alt="Profile" 
                width={120} 
                height={120} 
                className={styles.profileImage}
              />
            ) : (
              <div className={styles.profilePlaceholder}>
                {profile.firstName && profile.lastName ? 
                  `${profile.firstName[0]}${profile.lastName[0]}` : 
                  profile.firstName ? profile.firstName[0] :
                  profile.lastName ? profile.lastName[0] : 'A'}
              </div>
            )}
            
            {isUploading && (
              <div className={styles.uploadProgress}>
                <div 
                  className={styles.uploadProgressBar} 
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            )}
          </div>
          
         
          
        </div>
        
        <div className={styles.profileDetailsSection}>
          <div className={styles.formGroup}>
            <label>Email</label>
            <input
              type="email"
              name="email"
              value={profile.email}
              disabled
              className={styles.disabledInput}
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>First Name</label>
            <input
              type="text"
              name="firstName"
              value={profile.firstName}
              onChange={handleInputChange}
              placeholder="Enter first name"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Last Name</label>
            <input
              type="text"
              name="lastName"
              value={profile.lastName}
              onChange={handleInputChange}
              placeholder="Enter last name"
            />
          </div>
          
          <div className={styles.formGroup}>
            <label>Phone Number (10 digits only)</label>
            <input
              type="text"
              name="phoneNumber"
              value={profile.phoneNumber}
              onChange={handleInputChange}
              placeholder="Enter 10-digit phone number"
              className={errors.phoneNumber ? styles.inputError : ''}
            />
            {errors.phoneNumber && (
              <span className={styles.errorText}>{errors.phoneNumber}</span>
            )}
          </div>
          
          <div className={styles.securityKeySection}>
            <button 
              className={styles.showSecurityKeyButton}
              onClick={toggleSecurityKey}
            >
              {showSecurityKey ? 'Hide Security Key' : 'Show Security Key'}
            </button>
            
            {/* Password Verification Modal */}
            {isVerifyingPassword && (
              <div className={styles.passwordVerificationOverlay}>
                <div className={styles.passwordVerificationModal}>
                  <h3>Admin Verification Required</h3>
                  <p>Please enter your admin password to view the security key.</p>
                  
                  <div className={styles.passwordInputContainer}>
                    <input
                      type="password"
                      value={passwordInput}
                      onChange={handlePasswordInputChange}
                      placeholder="Enter your password"
                      className={passwordError ? styles.inputError : ''}
                    />
                    {passwordError && (
                      <span className={styles.errorText}>{passwordError}</span>
                    )}
                  </div>
                  
                  <div className={styles.modalButtons}>
                    <button 
                      className={styles.cancelButton}
                      onClick={cancelPasswordVerification}
                    >
                      Cancel
                    </button>
                    <button 
                      className={styles.verifyButton}
                      onClick={verifyAdminPassword}
                    >
                      Verify
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Security Key Display (only shown after password verification) */}
            {showSecurityKey && profile.securityKey && (
              <div className={styles.securityKeyDisplay}>
                <p className={styles.securityKeyWarning}>
                  <span className={styles.warningIcon}>⚠️</span>
                  <strong>IMPORTANT:</strong> Keep this key secure and do not share it with anyone.
                </p>
                <div className={styles.securityKey}>
                  {profile.securityKey}
                </div>
              </div>
            )}
          </div>
          
          <button 
            className={`${styles.saveButton} ${saveStatus === 'saved' ? styles.savedButton : ''}`}
            onClick={saveProfileChanges}
            disabled={!hasChanges || isSaving || Object.keys(errors).length > 0}
          >
            {saveStatus === 'saving' ? 'Saving...' : 
             saveStatus === 'saved' ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

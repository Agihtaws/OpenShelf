// src/app/admin/components/Header.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import styles from './Header.module.css';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc,
  doc,
  orderBy,
  limit,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { auth, db } from '@/firebaseConfig';

// Define types for job applications
interface JobApplication {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  position: string;
  type: 'specific' | 'general';
  submittedAt: Timestamp;
  viewed: boolean;
  status?: string;
}

export default function Header() {
  const pathname = usePathname();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [notifications, setNotifications] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [pageTitle, setPageTitle] = useState('Dashboard');
  const [darkMode, setDarkMode] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);

  // Set page title based on pathname
  useEffect(() => {
    const path = pathname.split('/');
    if (path.length > 2) {
      const title = path[2].charAt(0).toUpperCase() + path[2].slice(1);
      setPageTitle(title.replace(/-/g, ' '));
    } else {
      setPageTitle('Dashboard');
    }

    // Get user data from localStorage
    const userEmail = localStorage.getItem('user_email');
    const storedFirstName = localStorage.getItem('admin_first_name');
    const storedLastName = localStorage.getItem('admin_last_name');
    const storedProfileImage = localStorage.getItem('admin_profile_image');
    
    if (storedFirstName) setFirstName(storedFirstName);
    if (storedLastName) setLastName(storedLastName);
    if (storedProfileImage) setProfileImage(storedProfileImage);
    
    if (userEmail && (!storedFirstName || !storedLastName)) {
      const name = userEmail.split('@')[0];
      const formattedName = name.charAt(0).toUpperCase() + name.slice(1);
      if (!storedFirstName) setFirstName(formattedName);
      if (!storedLastName) setLastName('');
    }

    // Check dark mode preference
    const isDarkMode = localStorage.getItem('darkMode') === 'true';
    setDarkMode(isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }

    // Handle profile updates from settings page
    const handleProfileUpdate = (event: CustomEvent) => {
      const { firstName, lastName, profileImage } = event.detail;
      
      if (firstName) setFirstName(firstName);
      if (lastName) setLastName(lastName);
      if (profileImage !== undefined) setProfileImage(profileImage);
    };
    
    window.addEventListener('admin_profile_updated', handleProfileUpdate as EventListener);
    
    return () => {
      window.removeEventListener('admin_profile_updated', handleProfileUpdate as EventListener);
    };
  }, [pathname]);

  // Fetch job applications
  useEffect(() => {
    const fetchApplications = async () => {
      try {
        // Query for applications ordered by submission date (newest first)
        const applicationsQuery = query(
          collection(db, "jobApplications"),
          orderBy("submittedAt", "desc"),
          limit(10)
        );
        
        const unsubscribe = onSnapshot(applicationsQuery, (snapshot) => {
          const applicationsData: JobApplication[] = snapshot.docs.map(doc => {
            const data = doc.data() as JobApplication;
            return { ...data, id: doc.id };
          });
          
          setApplications(applicationsData);
          
          // Count unviewed applications for notifications
          const unviewedCount = applicationsData.filter(app => !app.viewed).length;
          setNotifications(unviewedCount);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error("Error fetching applications:", error);
        setApplications([]);
        setNotifications(0);
      }
    };
    
    const fetchApplicationsWrapper = async () => {
      const unsubscribe = await fetchApplications();
      return unsubscribe;
    };

    const unsubscribePromise = fetchApplicationsWrapper();
    return () => {
      unsubscribePromise.then((unsubscribe) => {
        if (unsubscribe && typeof unsubscribe === 'function') unsubscribe();
      });
    };
  }, []);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  // Mark application as viewed
  const markAsRead = async (applicationId: string) => {
    try {
      // Update the document in Firestore
      const applicationRef = doc(db, "jobApplications", applicationId);
      await updateDoc(applicationRef, {
        viewed: true
      });
      
      // Navigate to application details
      window.location.href = `/admin/careers/applications?id=${applicationId}`;
    } catch (error) {
      console.error("Error marking application as viewed:", error);
    }
  };

  // Mark all applications as read
  const markAllAsRead = async () => {
    try {
      const unviewedApplications = applications.filter(app => !app.viewed);
      
      // Update each unviewed application
      for (const app of unviewedApplications) {
        const applicationRef = doc(db, "jobApplications", app.id);
        await updateDoc(applicationRef, {
          viewed: true
        });
      }
    } catch (error) {
      console.error("Error marking all applications as read:", error);
    }
  };

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('darkMode', String(newMode));
    
    if (newMode) {
      document.documentElement.classList.add('dark-mode');
    } else {
      document.documentElement.classList.remove('dark-mode');
    }
  };

  // Format time ago for timestamps
  const formatTimeAgo = (timestamp: Timestamp) => {
    if (!timestamp || !timestamp.toDate) {
      return "N/A";
    }
    
    try {
      const date = timestamp.toDate();
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      
      if (diffMins < 60) {
        return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
      } else if (diffMins < 1440) { // less than a day
        const hours = Math.floor(diffMins / 60);
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
      } else {
        const days = Math.floor(diffMins / 1440);
        return `${days} day${days !== 1 ? 's' : ''} ago`;
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.pageTitle}>
          {pageTitle}
        </h1>
      </div>
      
      <div className={styles.headerRight}>
        <div className={styles.headerActions}>
          <button 
            className={styles.darkModeToggle} 
            onClick={toggleDarkMode}
            aria-label="Toggle dark mode"
          >
            {darkMode ? '☀️' : '🌙'}
          </button>
          
          <div className={styles.notifications} ref={notificationRef}>
            <button 
              className={styles.notificationButton} 
              onClick={toggleNotifications}
              aria-label="Notifications"
            >
              🔔
              {notifications > 0 && (
                <span className={styles.notificationBadge}>{notifications}</span>
              )}
            </button>
            
            {showNotifications && (
              <div className={styles.notificationPanel}>
                <div className={styles.notificationHeader}>
                  <h3>Job Applications</h3>
                  {notifications > 0 ? (
                    <span className={styles.newNotificationsLabel}>{notifications} new</span>
                  ) : (
                    <span className={styles.noNewNotificationsLabel}>No new applications</span>
                  )}
                </div>
                
                <div className={styles.notificationList}>
                  {applications.length > 0 ? (
                    applications.map(application => (
                      <div 
                        key={application.id} 
                        className={`${styles.notificationItem} ${!application.viewed ? styles.unread : ''}`}
                        onClick={() => markAsRead(application.id)}
                      >
                        <div className={styles.notificationIcon}>
                          {application.type === 'specific' ? '📝' : '📄'}
                        </div>
                        <div className={styles.notificationContent}>
                          <div className={styles.notificationTitle}>
                            {`${application.firstName} ${application.lastName}`} applied for {application.position}
                          </div>
                          <div className={styles.notificationMeta}>
                            <span className={styles.notificationTime}>
                              {formatTimeAgo(application.submittedAt)}
                            </span>
                            <span className={styles.notificationType}>
                              {application.type === 'specific' ? 'Job Application' : 'General Application'}
                            </span>
                          </div>
                        </div>
                        {!application.viewed && (
                          <div className={styles.notificationBadgeSmall}></div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyNotifications}>
                      No applications to display
                    </div>
                  )}
                </div>
                
                {notifications > 0 && (
                  <div className={styles.notificationFooter}>
                    <button 
                      className={styles.markAllReadButton}
                      onClick={markAllAsRead}
                    >
                      Mark all as read
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Link href="/admin/settings" className={styles.userMenu}>
            {profileImage ? (
              <div className={styles.userAvatar}>
                <Image 
                  src={profileImage} 
                  alt="Profile" 
                  width={40} 
                  height={40} 
                  className={styles.userAvatarImage}
                />
              </div>
            ) : (
              <div className={styles.userAvatar}>
                {firstName && lastName ? 
                  `${firstName[0]}${lastName[0]}` : 'A'}
              </div>
            )}
            <span className={styles.userName}>
              {firstName && lastName ? 
                `${firstName} ${lastName}` : 'Admin'}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
}

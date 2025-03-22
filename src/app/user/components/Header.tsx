// src/app/user/components/header.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { FiSun, FiMoon, FiBell, FiCheck, FiSearch } from 'react-icons/fi';
import styles from './header.module.css';
import { auth, db } from '../../../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  orderBy, 
  limit 
} from 'firebase/firestore';

interface Notification {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
  link?: string;
}

interface UserData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoURL?: string;
  displayName?: string;
}

export default function Header({ onSearch }: { onSearch?: (query: string) => void }) {
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageTitle, setPageTitle] = useState('Dashboard');
  
  const notificationRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  // Set page title based on the current path
  useEffect(() => {
    const path = pathname?.split('/') || [];
    if (path.length > 2) {
      const title = path[2].charAt(0).toUpperCase() + path[2].slice(1);
      setPageTitle(title.replace(/-/g, ' '));
    } else {
      setPageTitle('Dashboard');
    }
  }, [pathname]);

  // Handle theme toggle
  useEffect(() => {
    // Check if user has a saved preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark-mode');
    }
  }, []);

  const toggleTheme = () => {
    setDarkMode(!darkMode);
    if (!darkMode) {
      document.documentElement.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    }
  };

  // Handle click outside notifications panel to close it
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

  // Fetch user data and notifications
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        setIsLoading(true);
        
        // Get user ID from localStorage
        const userId = localStorage.getItem('user_id');
        if (!userId) {
          setIsLoading(false);
          return;
        }
        
        // Get user data from Firestore
        const userDoc = await getDoc(doc(db, "users_customer", userId));
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          
          setUserData({
            id: userDoc.id,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || '',
            photoURL: userData.photoURL || '',
            displayName: userData.displayName || ''
          });
          
          // Fetch notifications for this user
          await fetchNotifications(userDoc.id);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error fetching user data:", error);
        setIsLoading(false);
      }
    };
    
    fetchUserData();
  }, []);

  // Function to fetch notifications
  const fetchNotifications = async (userId: string) => {
    try {
      // Query notifications collection
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      
      const querySnapshot = await getDocs(notificationsQuery);
      const notificationsData: Notification[] = [];
      let unreadCount = 0;
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convert Firestore timestamp to Date
        const createdAt = data.createdAt?.toDate ? 
          data.createdAt.toDate() : 
          data.createdAt ? new Date(data.createdAt) : new Date();
        
        const notification: Notification = {
          id: doc.id,
          title: data.title || '',
          message: data.message || '',
          createdAt,
          read: data.read || false,
          type: data.type || 'info',
          link: data.link
        };
        
        if (!notification.read) {
          unreadCount++;
        }
        
        notificationsData.push(notification);
      });
      
      setNotifications(notificationsData);
      setUnreadCount(unreadCount);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSearch && searchQuery.trim()) {
      onSearch(searchQuery.trim());
    }
  };

  // Format time ago for notifications
  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.round(diffMs / 1000);
    const diffMin = Math.round(diffSec / 60);
    const diffHour = Math.round(diffMin / 60);
    const diffDay = Math.round(diffHour / 24);

    if (diffSec < 60) {
      return `Just now`;
    } else if (diffMin < 60) {
      return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
    } else if (diffHour < 24) {
      return `${diffHour} hour${diffHour > 1 ? 's' : ''} ago`;
    } else if (diffDay < 7) {
      return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    try {
      // Update all unread notifications
      for (const notification of notifications) {
        if (!notification.read) {
          await updateDoc(doc(db, "notifications", notification.id), {
            read: true
          });
        }
      }
      
      // Update local state
      setNotifications(notifications.map(notification => ({
        ...notification,
        read: true
      })));
      
      setUnreadCount(0);
    } catch (error) {
      console.error("Error marking notifications as read:", error);
    }
  };

  // Mark a single notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true
      });
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === notificationId 
          ? { ...notification, read: true } 
          : notification
      ));
      
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    // Mark as read if not already
    if (!notification.read) {
      markAsRead(notification.id);
    }
    
    // Navigate to link if provided
    if (notification.link) {
      router.push(notification.link);
    }
    
    // Close notification panel
    setShowNotifications(false);
  };

  // Get initials for avatar
  const getInitials = (): string => {
    if (!userData) return '';
    
    if (userData.firstName && userData.lastName) {
      return `${userData.firstName.charAt(0)}${userData.lastName.charAt(0)}`.toUpperCase();
    } else if (userData.displayName) {
      const nameParts = userData.displayName.split(' ');
      if (nameParts.length > 1) {
        return `${nameParts[0].charAt(0)}${nameParts[1].charAt(0)}`.toUpperCase();
      }
      return userData.displayName.charAt(0).toUpperCase();
    }
    
    return userData.email.charAt(0).toUpperCase();
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerLeft}>
        <h1 className={styles.pageTitle}>{pageTitle}</h1>
      </div>
      
      <div className={styles.headerRight}>
        {/* Search Bar */}
        <form className={styles.searchBar} onSubmit={handleSearch}>
          <input 
            type="text" 
            placeholder="Search books..." 
            className={styles.searchInput}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <button type="submit" className={styles.searchButton}>
            <FiSearch />
          </button>
        </form>
        
        {/* Theme Toggle */}
        <button 
          className={styles.iconButton} 
          onClick={toggleTheme}
          aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
        >
          {darkMode ? <FiSun /> : <FiMoon />}
        </button>
        
        {/* Notifications */}
        <div className={styles.notificationContainer} ref={notificationRef}>
          <button 
            className={`${styles.iconButton} ${unreadCount > 0 ? styles.hasNotifications : ''}`} 
            onClick={() => setShowNotifications(!showNotifications)}
            aria-label="Notifications"
          >
            <FiBell />
            {unreadCount > 0 && (
              <span className={styles.notificationBadge}>{unreadCount}</span>
            )}
          </button>
          
          {showNotifications && (
            <div className={styles.notificationsPanel}>
              <div className={styles.notificationsHeader}>
                <h3>Notifications</h3>
                {unreadCount > 0 && (
                  <button 
                    className={styles.markAllReadButton}
                    onClick={markAllAsRead}
                  >
                    <FiCheck size={14} /> Mark all as read
                  </button>
                )}
              </div>
              
              <div className={styles.notificationsList}>
                {notifications.length > 0 ? (
                  notifications.map((notification) => (
                    <div 
                      key={notification.id} 
                      className={`${styles.notificationItem} ${!notification.read ? styles.unread : ''} ${styles[notification.type]}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className={styles.notificationContent}>
                        <h4 className={styles.notificationTitle}>{notification.title}</h4>
                        <p className={styles.notificationMessage}>{notification.message}</p>
                        <span className={styles.notificationTime}>
                          {formatTimeAgo(notification.createdAt)}
                        </span>
                      </div>
                      {!notification.read && (
                        <button 
                          className={styles.markReadButton}
                          onClick={(e) => {
                            e.stopPropagation();
                            markAsRead(notification.id);
                          }}
                          aria-label="Mark as read"
                        >
                          <FiCheck size={16} />
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <div className={styles.noNotifications}>
                    <p>No notifications</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* User Menu */}
        <Link href="/user/settings" className={styles.userMenu}>
          <div className={styles.userAvatar}>
            {userData?.photoURL ? (
              <img 
                src={userData.photoURL} 
                alt={`${userData.firstName} ${userData.lastName}`} 
                className={styles.avatarImage}
              />
            ) : (
              <span>{getInitials()}</span>
            )}
          </div>
          <div className={styles.userName}>
            {isLoading ? 'Loading...' : (
              userData ? `${userData.firstName} ${userData.lastName}` : 'Member'
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}

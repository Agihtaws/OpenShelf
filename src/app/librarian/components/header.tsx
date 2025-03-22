// src/app/librarian/components/header.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link'; // Import Link
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

interface LibrarianData {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photoURL?: string;
}

export default function Header({ onSearch }: { onSearch?: (query: string) => void }) {
  const [darkMode, setDarkMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [librarianData, setLibrarianData] = useState<LibrarianData | null>(null);
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

  // Fetch librarian data and notifications
  useEffect(() => {
    const fetchLibrarianData = async () => {
      try {
        setIsLoading(true);
        const currentUser = auth.currentUser;
        
        // If there's a librarian ID in localStorage, try getting the librarian directly
        const librarianId = localStorage.getItem('librarian_id');
        if (librarianId) {
          try {
            // Get librarian directly by ID
            const librarianDocRef = doc(db, "users_librarian", librarianId);
            const librarianDocSnap = await getDoc(librarianDocRef);
            
            if (librarianDocSnap.exists()) {
              const librarianData = librarianDocSnap.data();
              
              setLibrarianData({
                id: librarianDocSnap.id,
                firstName: librarianData.firstName || '',
                lastName: librarianData.lastName || '',
                email: librarianData.email || '',
                photoURL: librarianData.photoURL || ''
              });
              
              // Store email for future use
              if (librarianData.email) {
                localStorage.setItem('librarian_email', librarianData.email);
              }
              
              // Fetch notifications for this librarian
              await fetchNotifications(librarianDocSnap.id);
              setIsLoading(false);
              return;
            }
          } catch (error) {
            console.error("Error fetching librarian by ID:", error);
          }
        }
        
        if (!currentUser || !currentUser.email) {
          // If not authenticated through Firebase, try getting from localStorage
          const userEmail = localStorage.getItem('librarian_email');
          if (!userEmail) {
            console.error("No authenticated user found");
            
            // Try to get any librarian as fallback (for demo purposes)
            try {
              const librariansQuery = query(
                collection(db, "users_librarian"),
                limit(1)
              );
              
              const querySnapshot = await getDocs(librariansQuery);
              if (!querySnapshot.empty) {
                const librarianDoc = querySnapshot.docs[0];
                const librarianData = librarianDoc.data();
                
                setLibrarianData({
                  id: librarianDoc.id,
                  firstName: librarianData.firstName || '',
                  lastName: librarianData.lastName || '',
                  email: librarianData.email || '',
                  photoURL: librarianData.photoURL || ''
                });
                
                // Store for future use
                localStorage.setItem('librarian_id', librarianDoc.id);
                if (librarianData.email) {
                  localStorage.setItem('librarian_email', librarianData.email);
                }
                
                await fetchNotifications(librarianDoc.id);
              }
            } catch (fallbackError) {
              console.error("Fallback error:", fallbackError);
            }
            
            setIsLoading(false);
            return;
          }
          
          // Find librarian by email
          const librariansQuery = query(
            collection(db, "users_librarian"),
            where("email", "==", userEmail)
          );
          
          const querySnapshot = await getDocs(librariansQuery);
          if (querySnapshot.empty) {
            console.error("No librarian found with this email");
            setIsLoading(false);
            return;
          }
          
          const librarianDoc = querySnapshot.docs[0];
          const librarianData = librarianDoc.data();
          
          setLibrarianData({
            id: librarianDoc.id,
            firstName: librarianData.firstName || '',
            lastName: librarianData.lastName || '',
            email: librarianData.email || '',
            photoURL: librarianData.photoURL || ''
          });
          
          // Store ID for future use
          localStorage.setItem('librarian_id', librarianDoc.id);
          
          // Fetch notifications for this librarian
          await fetchNotifications(librarianDoc.id);
        } else {
          // User is authenticated through Firebase
          const librariansQuery = query(
            collection(db, "users_librarian"),
            where("email", "==", currentUser.email)
          );
          
          const querySnapshot = await getDocs(librariansQuery);
          if (querySnapshot.empty) {
            console.error("No librarian found with this email");
            setIsLoading(false);
            return;
          }
          
          const librarianDoc = querySnapshot.docs[0];
          const librarianData = librarianDoc.data();
          
          setLibrarianData({
            id: librarianDoc.id,
            firstName: librarianData.firstName || '',
            lastName: librarianData.lastName || '',
            email: librarianData.email || '',
            photoURL: librarianData.photoURL || currentUser.photoURL || ''
          });
          
          // Store ID for future use
          localStorage.setItem('librarian_id', librarianDoc.id);
          
          // Fetch notifications for this librarian
          await fetchNotifications(librarianDoc.id);
        }
      } catch (error) {
        console.error("Error fetching librarian data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchLibrarianData();
  }, []);

  // Function to fetch notifications
  const fetchNotifications = async (librarianId: string) => {
    try {
      // Query notifications collection
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("recipientId", "==", librarianId),
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
  // Function to handle search
  const handleSearch = (e: React.FormEvent) => {
    // Prevent the default form submission behavior
    e.preventDefault();
    // If the onSearch function is defined and the searchQuery is not empty, call the onSearch function with the trimmed searchQuery
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
    if (!librarianData) return '';
    return `${librarianData.firstName.charAt(0)}${librarianData.lastName.charAt(0)}`.toUpperCase();
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
            placeholder="Search books, patrons..." 
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
        <Link href="/librarian/settings" className={styles.userMenu}>
          <div className={styles.userAvatar}>
            {librarianData?.photoURL ? (
              <img 
                src={librarianData.photoURL} 
                alt={`${librarianData.firstName} ${librarianData.lastName}`} 
                className={styles.avatarImage}
              />
            ) : (
              <span>{getInitials()}</span>
            )}
          </div>
          <div className={styles.userName}>
            {isLoading ? 'Loading...' : (
              librarianData ? `${librarianData.firstName} ${librarianData.lastName}` : 'Unknown Librarian'
            )}
          </div>
        </Link>
      </div>
    </header>
  );
}

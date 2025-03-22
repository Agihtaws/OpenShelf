// src/app/admin/dashboard/page.tsx
"use client";

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';
import { auth, db } from '../../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  Timestamp,
  doc,
  updateDoc,
  getDoc,
  getCountFromServer,
  where
} from 'firebase/firestore';
import { 
  FiSearch, 
  FiUser, 
  FiCalendar, 
  FiMail, 
  FiX, 
  FiChevronRight 
} from 'react-icons/fi';

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

// Define SecurityKey interface
interface SecurityKey {
  key: string;
  generatedAt: Timestamp;
  lastAccessed?: Timestamp;
}

// Define HoldRequest interface
interface HoldRequest {
  id: string;
  bookId?: string;
  userId?: string;
  book?: {
    title?: string;
    author?: string;
    isbn?: string;
    coverImage?: string;
  };
  user?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    libraryCardId?: string;
    email?: string;
  };
  pickupBy?: Date;
  formattedPickupDate?: string;
  status: string;
  reservedAt: Date;
}

// Define Checkout interface
interface Checkout {
  id: string;
  userId: string;
  bookId: string;
  quantity: number;
  borrowedAt: any;
  dueDate: any;
  returnDate?: any;
  status: 'borrowed' | 'returned' | 'overdue' | 'renewed';
  renewals: number;
  book?: {
    title?: string;
    author?: string;
    isbn?: string;
    coverImage?: string;
    shelfNumber?: string;
    copies?: number;
  };
  user?: {
    firstName?: string;
    lastName?: string;
    libraryCardId?: string;
    email?: string;
  };
}

// Define Return interface
interface Return {
  id: string;
  userId: string;
  bookId: string;
  borrowedAt: any;
  returnDate: any;
  dueDate: any;
  status: 'returned';
  book?: {
    title?: string;
    author?: string;
    isbn?: string;
    coverImage?: string;
    shelfNumber?: string;
  };
  user?: {
    firstName?: string;
    lastName?: string;
    libraryCardId?: string;
    email?: string;
  };
  returnedOnTime: boolean;
}

// Define Stat interface
interface Stat {
  label: string;
  value: string;
  icon: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // State for applications and notifications
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [notifications, setNotifications] = useState(0);
  
  // State for security key
  const [securityKeyInfo, setSecurityKeyInfo] = useState<SecurityKey | null>(null);
  const [showSecurityPopup, setShowSecurityPopup] = useState(false);
  const [securityKeyLoading, setSecurityKeyLoading] = useState(false);
  const [securityKeyCopied, setSecurityKeyCopied] = useState(false);
  
  // State for book stats
  const [totalBooks, setTotalBooks] = useState<number | null>(null);
  const [recentBookChanges, setRecentBookChanges] = useState<string>('+0');
  const [newlyAddedBooks, setNewlyAddedBooks] = useState<number>(0);
  const [overdueItems, setOverdueItems] = useState<number>(0);
  const [newPatrons, setNewPatrons] = useState<number>(0);
  
  // State for holds, checkouts, returns, and all data for modals
  const [holdRequests, setHoldRequests] = useState<HoldRequest[]>([]);
  const [recentCheckouts, setRecentCheckouts] = useState<Checkout[]>([]);
  const [recentReturns, setRecentReturns] = useState<Return[]>([]);
  const [showAllHolds, setShowAllHolds] = useState(false);
  const [showAllCheckouts, setShowAllCheckouts] = useState(false);
  const [showAllApplications, setShowAllApplications] = useState(false);
  const [showAllReturns, setShowAllReturns] = useState(false);
  const [allHoldRequests, setAllHoldRequests] = useState<HoldRequest[]>([]);
  const [allCheckouts, setAllCheckouts] = useState<Checkout[]>([]);
  const [allJobApplications, setAllJobApplications] = useState<JobApplication[]>([]);
  const [allReturns, setAllReturns] = useState<Return[]>([]);
  
  // Stats array with dynamic values
  const stats: Stat[] = [
    { label: 'Total Books', value: totalBooks !== null ? totalBooks.toString() : 'Loading...', icon: '📚' },
    { label: 'Newly Added Books', value: newlyAddedBooks.toString(), icon: '📕' },
    { label: 'Overdue Items', value: overdueItems.toString(), icon: '⏰' },
    { label: 'New Patrons', value: newPatrons.toString(), icon: '👤' }
  ];
  
  // Memoize static data to prevent unnecessary re-renders
  const recentActivities = [
    { id: 1, action: 'Book Added', item: 'The Midnight Library', user: 'Sarah Johnson', time: '10 minutes ago' },
    { id: 2, action: 'Patron Registered', item: 'James Wilson', user: 'System', time: '25 minutes ago' },
    { id: 3, action: 'Book Returned', item: 'Educated', user: 'Michael Chen', time: '1 hour ago' },
    { id: 4, action: 'Fine Collected', item: '$12.50', user: 'Lisa Rodriguez', time: '2 hours ago' },
    { id: 5, action: 'Book Reserved', item: 'Project Hail Mary', user: 'Robert Lee', time: '3 hours ago' }
  ];
  
  const popularBooks = [
    { title: 'The Midnight Library', author: 'Matt Haig', checkouts: 42 },
    { title: 'Project Hail Mary', author: 'Andy Weir', checkouts: 38 },
    { title: 'Educated', author: 'Tara Westover', checkouts: 35 },
    { title: 'The Invisible Life of Addie LaRue', author: 'V.E. Schwab', checkouts: 29 },
    { title: 'Klara and the Sun', author: 'Kazuo Ishiguro', checkouts: 26 }
  ];

  // Format date function
  const formatDate = (date: Date | null | undefined): string => {
    if (!date) return "N/A";
    
    try {
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  // Calculate borrow duration
  const calculateBorrowDuration = (borrowedDate: Date, returnDate: Date): string => {
    const diffTime = Math.abs(returnDate.getTime() - borrowedDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return 'Less than a day';
    } else if (diffDays === 1) {
      return '1 day';
    } else {
      return `${diffDays} days`;
    }
  };

  // Fetch book count from Firestore - only counts books with copies > 0
  const fetchBookCount = useCallback(async () => {
    try {
      // Create a query to get only books with copies > 0
      const booksQuery = query(
        collection(db, "books"),
        where("copies", ">", 0)
      );
      
      const snapshot = await getCountFromServer(booksQuery);
      setTotalBooks(snapshot.data().count);
    } catch (error) {
      console.error("Error fetching book count:", error);
      setTotalBooks(null);
    }
  }, []);

  // Fetch newly added books (in the last 24 hours)
  const fetchNewlyAddedBooks = useCallback(async () => {
    try {
      // Get date from 24 hours ago
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      const oneDayAgoTimestamp = Timestamp.fromDate(oneDayAgo);
      
      // Query for books added in the last 24 hours
      const newBooksQuery = query(
        collection(db, "books"),
        where("createdAt", ">=", oneDayAgoTimestamp)
      );
      
      const snapshot = await getCountFromServer(newBooksQuery);
      setNewlyAddedBooks(snapshot.data().count);
    } catch (error) {
      console.error("Error fetching newly added books:", error);
      setNewlyAddedBooks(0);
    }
  }, []);

  // Fetch overdue items count
  const fetchOverdueItems = useCallback(async () => {
    try {
      const now = new Date();
      const nowTimestamp = Timestamp.fromDate(now);
      
      const overdueQuery = query(
        collection(db, "borrows"),
        where("status", "in", ["borrowed", "renewed"]),
        where("dueDate", "<", nowTimestamp)
      );
      
      const snapshot = await getCountFromServer(overdueQuery);
      setOverdueItems(snapshot.data().count);
    } catch (error) {
      console.error("Error fetching overdue items:", error);
      setOverdueItems(0);
    }
  }, []);

  // Fetch new patrons count
  const fetchNewPatrons = useCallback(async () => {
    try {
      const patronsCollection = collection(db, "users_customer");
      const snapshot = await getCountFromServer(patronsCollection);
      setNewPatrons(snapshot.data().count);
    } catch (error) {
      console.error("Error fetching patron count:", error);
      setNewPatrons(0);
    }
  }, []);

  // Fetch hold requests
  const fetchHoldRequests = useCallback(async () => {
    try {
      // Get date from 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);
      
      // Create a query to get only active reserved books
      const reservationsQuery = query(
        collection(db, "reserves"),
        where("status", "==", "reserved"),
        where("reservedAt", ">=", sevenDaysAgoTimestamp),
        orderBy("reservedAt", "desc")
      );
      
      const querySnapshot = await getDocs(reservationsQuery);
      const reservationsData: HoldRequest[] = [];
      
      // For each reservation, fetch the associated book and user details
      for (const reservationDoc of querySnapshot.docs) {
        const reservationData = reservationDoc.data();
        
        // Fetch book details
        const bookDocRef = doc(db, "books", reservationData.bookId);
        let bookData = null;
        const bookDoc = await getDoc(bookDocRef);
        if (bookDoc.exists()) {
          bookData = bookDoc.data();
          bookData.id = bookDoc.id;
        }
        
        // Fetch user details
        const userDocRef = doc(db, "users_customer", reservationData.userId);
        let userData = undefined;
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          userData = {
            firstName: userDoc.data().firstName || '',
            lastName: userDoc.data().lastName || '',
            email: userDoc.data().email || '',
            libraryCardId: userDoc.data().libraryCardId || ''
          };
        }
        
        // Calculate pickup date (7 days from reservation)
        let pickupDate;
        if (reservationData.pickupDate) {
          pickupDate = reservationData.pickupDate.toDate ? 
            new Date(reservationData.pickupDate.toDate()) : 
            new Date(reservationData.pickupDate);
        } else {
          const reservedDate = reservationData.reservedAt.toDate ? 
            new Date(reservationData.reservedAt.toDate()) : 
            new Date(reservationData.reservedAt);
          
          pickupDate = new Date(reservedDate);
          pickupDate.setDate(reservedDate.getDate() + 7);
        }
        
        // Add to reservations list
        reservationsData.push({
          id: reservationDoc.id,
          ...reservationData,
          reservedAt: reservationData.reservedAt.toDate ? 
            new Date(reservationData.reservedAt.toDate()) : 
            new Date(reservationData.reservedAt),
          pickupBy: pickupDate,
          formattedPickupDate: formatDate(pickupDate),
          book: bookData || undefined,
          user: userData || undefined,
          status: reservationData.status
        });
      }
      
      // Set the first 5 for the dashboard
      setHoldRequests(reservationsData.slice(0, 5));
      
      // Set all for the modal
      setAllHoldRequests(reservationsData);
    } catch (error) {
      console.error("Error fetching hold requests:", error);
    }
  }, []);

  // Fetch checkouts
  const fetchCheckouts = useCallback(async () => {
    try {
      // Create a query to get active checkouts
      const checkoutsQuery = query(
        collection(db, "borrows"),
        where("status", "in", ["borrowed", "overdue"]),
        orderBy("borrowedAt", "desc")
      );
      
      const querySnapshot = await getDocs(checkoutsQuery);
      const checkoutsData: Checkout[] = [];
      
      // For each checkout, fetch the associated book and user details
      for (const checkoutDoc of querySnapshot.docs) {
        const checkoutData = checkoutDoc.data();
        
        // Fetch book details
        const bookDocRef = doc(db, "books", checkoutData.bookId);
        let bookData = null;
        const bookDoc = await getDoc(bookDocRef);
        if (bookDoc.exists()) {
          bookData = bookDoc.data();
          bookData.id = bookDoc.id;
        }
        
        // Fetch user details
        const userDocRef = doc(db, "users_customer", checkoutData.userId);
        let userData = null;
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          userData = {
            firstName: userDoc.data().firstName || '',
            lastName: userDoc.data().lastName || '',
            email: userDoc.data().email || '',
            libraryCardId: userDoc.data().libraryCardId || ''
          };
        }
        
        // Convert Firestore timestamps to Date objects
        const borrowedDate = checkoutData.borrowedAt?.toDate ? 
          checkoutData.borrowedAt.toDate() : 
          new Date(checkoutData.borrowedAt);
        
        const dueDate = checkoutData.dueDate?.toDate ? 
          checkoutData.dueDate.toDate() : 
          new Date(checkoutData.dueDate);
        
        // Check if checkout is overdue
        const now = new Date();
        let status = checkoutData.status;
        if (status === 'borrowed' && dueDate < now) {
          status = 'overdue';
        }
        
        // Add to checkouts list
        checkoutsData.push({
          id: checkoutDoc.id,
          userId: checkoutData.userId,
          bookId: checkoutData.bookId,
          quantity: checkoutData.quantity || 1,
          renewals: checkoutData.renewals || 0,
          borrowedAt: borrowedDate,
          dueDate: dueDate,
          status: status,
          book: bookData ? bookData as { title?: string; author?: string; isbn?: string; coverImage?: string; shelfNumber?: string; copies?: number } : undefined,
          user: userData || undefined
        });
      }
      
      // Set the first 5 for the dashboard
      setRecentCheckouts(checkoutsData.slice(0, 5));
      
      // Set all for the modal
      setAllCheckouts(checkoutsData);
    } catch (error) {
      console.error("Error fetching checkouts:", error);
    }
  }, []);

  // Fetch returns
  const fetchReturns = useCallback(async () => {
    try {
      // Get date from 30 days ago for recent returns
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);
      
      // Create a query to get recently returned books
      const returnsQuery = query(
        collection(db, "borrows"),
        where("status", "==", "returned"),
        where("returnDate", ">=", thirtyDaysAgoTimestamp),
        orderBy("returnDate", "desc"),
        limit(100)
      );
      
      const querySnapshot = await getDocs(returnsQuery);
      const returnsData: Return[] = [];
      
      // For each return, fetch the associated book and user details
      for (const returnDoc of querySnapshot.docs) {
        const returnData = returnDoc.data();
        
        // Fetch book details
        const bookDocRef = doc(db, "books", returnData.bookId);
        let bookData = null;
        const bookDoc = await getDoc(bookDocRef);
        if (bookDoc.exists()) {
          bookData = bookDoc.data();
          bookData.id = bookDoc.id;
        }
        
        // Fetch user details
        const userDocRef = doc(db, "users_customer", returnData.userId);
        let userData = null;
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          userData = {
            firstName: userDoc.data().firstName || '',
            lastName: userDoc.data().lastName || '',
            email: userDoc.data().email || '',
            libraryCardId: userDoc.data().libraryCardId || ''
          };
        }
        
        // Convert Firestore timestamps to Date objects
        const borrowedDate = returnData.borrowedAt?.toDate ? 
          returnData.borrowedAt.toDate() : 
          new Date(returnData.borrowedAt);
        
        const returnDate = returnData.returnDate?.toDate ? 
          returnData.returnDate.toDate() : 
          new Date(returnData.returnDate);
          
        const dueDate = returnData.dueDate?.toDate ? 
          returnData.dueDate.toDate() : 
          new Date(returnData.dueDate);
        
        // Check if the book was returned on time
        const returnedOnTime = returnDate <= dueDate;
        
        // Add to returns list
        returnsData.push({
          id: returnDoc.id,
          userId: returnData.userId,
          bookId: returnData.bookId,
          status: returnData.status,
          borrowedAt: borrowedDate,
          returnDate: returnDate,
          dueDate: dueDate,
          book: bookData ? bookData as { title?: string; author?: string; isbn?: string; coverImage?: string; shelfNumber?: string; } : undefined,
          user: userData || undefined,
          returnedOnTime
        });
      }
      
      // Set the first 5 for the dashboard
      setRecentReturns(returnsData.slice(0, 5));
      
      // Set all for the modal
      setAllReturns(returnsData);
    } catch (error) {
      console.error("Error fetching returns:", error);
    }
  }, []);

  // Fetch job applications from Firestore
  const fetchApplications = useCallback(async () => {
    try {
      // Query for applications ordered by submission date (newest first)
      const applicationsQuery = query(
        collection(db, "jobApplications"),
        orderBy("submittedAt", "desc"),
        limit(20)
      );
      
      const querySnapshot = await getDocs(applicationsQuery);
      const applicationsData: JobApplication[] = querySnapshot.docs.map(doc => {
        const data = doc.data() as JobApplication;
        return { ...data, id: doc.id };
      });
      
      setApplications(applicationsData);
      
      // Set all for the modal
      setAllJobApplications(applicationsData);
      
      // Count unviewed applications for notifications
      const unviewedCount = applicationsData.filter(app => !app.viewed).length;
      setNotifications(unviewedCount);
      
    } catch (error) {
      console.error("Error fetching applications:", error);
      // If there's an error with Firestore, don't show any applications
      setApplications([]);
      setNotifications(0);
    }
  }, []);

  // Fetch security key information
  const fetchSecurityKey = useCallback(async (userId: string) => {
    try {
      const securityKeyRef = doc(db, "securityKeys", userId);
      const securityKeyDoc = await getDoc(securityKeyRef);
      
      if (securityKeyDoc.exists()) {
        setSecurityKeyInfo(securityKeyDoc.data() as SecurityKey);
      } else {
        setSecurityKeyInfo(null);
      }
    } catch (error) {
      console.error("Error fetching security key:", error);
      setSecurityKeyInfo(null);
    }
  }, []);

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
            fetchApplications();
            fetchSecurityKey(user.uid);
            fetchBookCount();
            fetchNewlyAddedBooks();
            fetchOverdueItems();
            fetchNewPatrons();
            fetchHoldRequests();
            fetchCheckouts();
            fetchReturns();
            setIsLoading(false);
          } else {
            // User exists in Firebase Auth but not in users_admin collection
            console.log("Admin document not found - signing out");
            setIsAuthenticated(false);
            
            // Sign out the user
            await auth.signOut();
            
            // Clear auth data and redirect
            clearAuthDataAndRedirect();
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAuthenticated(false);
          setIsLoading(false);
          
          // Sign out on error
          await auth.signOut();
          
          // Clear auth data and redirect
          clearAuthDataAndRedirect();
        }
      } else {
        // No user is signed in
        setIsAuthenticated(false);
        setIsLoading(false);
        
        // Use window.location.replace for immediate redirect
        window.location.replace('/auth/login');
      }
    });
    
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [
    fetchApplications, 
    fetchBookCount, 
    fetchSecurityKey, 
    fetchHoldRequests, 
    fetchCheckouts, 
    fetchReturns,
    fetchNewlyAddedBooks,
    fetchOverdueItems,
    fetchNewPatrons
  ]);

  // Extract repeated logic to a separate function
  const clearAuthDataAndRedirect = () => {
    // Clear auth data
    localStorage.removeItem('user_token');
    localStorage.removeItem('user_role');
    
    // Clear cookies
    document.cookie = 'user_token=; path=/; max-age=0';
    document.cookie = 'user_role=; path=/; max-age=0';
    document.cookie = 'device_id=; path=/; max-age=0';
    document.cookie = 'last_activity=; path=/; max-age=0';
    
    // Redirect
    window.location.replace('/auth/login');
  };

  const handleLogout = useCallback(async () => {
    try {
      // Clear all localStorage items
      localStorage.clear();
      
      // Clear all cookies
      document.cookie.split(";").forEach(function(c) { 
        document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"); 
      });
      
      // Sign out from Firebase
      await auth.signOut();
      
      // Force a complete page reload and redirect
      window.location.href = '/auth/login';
    } catch (error) {
      console.error("Error signing out:", error);
      // Even if there's an error, force redirect
      window.location.href = '/auth/login';
    }
  }, []);

  // Mark application as viewed
  const markAsViewed = useCallback(async (applicationId: string) => {
    try {
      // Update the document in Firestore
      const applicationRef = doc(db, "jobApplications", applicationId);
      await updateDoc(applicationRef, {
        viewed: true
      });
      
      // Update local state
      setApplications(prevApps => 
        prevApps.map(app => 
          app.id === applicationId ? { ...app, viewed: true } : app
        )
      );
      
      // Update notification count
      setNotifications(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking application as viewed:", error);
    }
  }, []);

  // Format time ago for timestamps
  const formatTimeAgo = useCallback((timestamp: Timestamp) => {
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
  }, []);

  // View application details
  const viewApplication = useCallback((applicationId: string) => {
    // Mark as viewed first
    markAsViewed(applicationId);
    
    // Redirect to the applications page with the selected application
    router.push(`/admin/careers/applications?id=${applicationId}`);
  }, [markAsViewed, router]);

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

  // Render the dashboard
  return (
    <div className={styles.dashboardContent}>
      {/* Stats Cards */}
      <StatsSection stats={stats} />

      {/* Main Dashboard Sections */}
      <div className={styles.dashboardGrid}>
        {/* Hold Requests Section */}
        <section className={styles.holdsSection}>
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Reserved Books</h2>
              <button 
                className={styles.viewAllLink}
                onClick={() => setShowAllHolds(true)}
              >
                View All
              </button>
            </div>
            
            <div className={styles.holdsList}>
              {holdRequests.length > 0 ? (
                holdRequests.map((hold) => (
                  <div key={hold.id} className={styles.holdItem}>
                    <div className={styles.bookCoverThumb}>
                      {hold.book?.coverImage ? (
                        <Image 
                          src={hold.book.coverImage} 
                          alt={hold.book?.title || 'Book cover'}
                          width={40}
                          height={60}
                          unoptimized={true}
                        />
                      ) : (
                        <div className={styles.noImageThumb}>
                          <span>No Cover</span>
                        </div>
                      )}
                    </div>
                    
                    <div className={styles.itemDetails}>
                      <h3 className={styles.itemTitle}>{hold.book?.title}</h3>
                      <p className={styles.itemPatron}>
                        <strong>Patron:</strong> {hold.user?.firstName} {hold.user?.lastName}
                      </p>
                      <p className={styles.itemPickup}>
                        <FiCalendar size={14} style={{ marginRight: '4px' }} />
                        <strong>Pickup by:</strong> {hold.formattedPickupDate}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noHolds}>
                  <p>No current hold requests.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Recent Checkouts Section */}
        <section className={styles.checkoutsSection}>
          <div className={styles.sectionCard}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Recent Checkouts</h2>
              <button 
                className={styles.viewAllLink}
                onClick={() => setShowAllCheckouts(true)}
              >
                View All
              </button>
            </div>
            
            <div className={styles.checkoutsList}>
              {recentCheckouts.length > 0 ? (
                recentCheckouts.map((checkout) => (
                  <div key={checkout.id} className={styles.checkoutItem}>
                    <div className={styles.bookCoverThumb}>
                      {checkout.book?.coverImage ? (
                                                <Image 
                                                src={checkout.book.coverImage} 
                                                alt={checkout.book?.title || 'Book cover'}
                                                width={40}
                                                height={60}
                                                unoptimized={true}
                                              />
                                            ) : (
                                              <div className={styles.noImageThumb}>
                                                <span>No Cover</span>
                                              </div>
                                            )}
                                          </div>
                                          
                                          <div className={styles.itemDetails}>
                                            <h3 className={styles.itemTitle}>{checkout.book?.title}</h3>
                                            <p className={styles.itemPatron}>
                                              <strong>Patron:</strong> {checkout.user?.firstName} {checkout.user?.lastName}
                                            </p>
                                            <div className={styles.checkoutInfo}>
                                              <span className={styles.checkoutDate}>
                                                <FiCalendar size={14} style={{ marginRight: '4px' }} />
                                                <strong>Due:</strong> {formatDate(checkout.dueDate)}
                                              </span>
                                              <span className={`${styles.statusBadge} ${styles[checkout.status]}`}>
                                                {checkout.status.charAt(0).toUpperCase() + checkout.status.slice(1)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className={styles.noCheckouts}>
                                        <p>No current checkouts.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </section>
                      
                              {/* Recent Returns Section */}
                              <section className={styles.returnsSection}>
                                <div className={styles.sectionCard}>
                                  <div className={styles.cardHeader}>
                                    <h2 className={styles.cardTitle}>Recent Returns</h2>
                                    <button 
                                      className={styles.viewAllLink}
                                      onClick={() => setShowAllReturns(true)}
                                    >
                                      View All
                                    </button>
                                  </div>
                                  
                                  <div className={styles.returnsList}>
                                    {recentReturns.length > 0 ? (
                                      recentReturns.map((returnItem) => (
                                        <div key={returnItem.id} className={styles.returnItem}>
                                          <div className={styles.bookCoverThumb}>
                                            {returnItem.book?.coverImage ? (
                                              <Image 
                                                src={returnItem.book.coverImage} 
                                                alt={returnItem.book?.title || 'Book cover'}
                                                width={40}
                                                height={60}
                                                unoptimized={true}
                                              />
                                            ) : (
                                              <div className={styles.noImageThumb}>
                                                <span>No Cover</span>
                                              </div>
                                            )}
                                          </div>
                                          
                                          <div className={styles.itemDetails}>
                                            <h3 className={styles.itemTitle}>{returnItem.book?.title}</h3>
                                            <p className={styles.itemPatron}>
                                              <strong>Patron:</strong> {returnItem.user?.firstName} {returnItem.user?.lastName}
                                            </p>
                                            <div className={styles.returnInfo}>
                                              <div className={styles.returnDates}>
                                                <span className={styles.returnDate}>
                                                  <FiCalendar size={14} style={{ marginRight: '4px' }} />
                                                  <strong>Returned:</strong> {formatDate(returnItem.returnDate)}
                                                </span>
                                                <span className={styles.borrowDuration}>
                                                  <strong>Duration:</strong> {calculateBorrowDuration(returnItem.borrowedAt, returnItem.returnDate)}
                                                </span>
                                              </div>
                                              <span className={`${styles.statusBadge} ${returnItem.returnedOnTime ? styles.onTime : styles.late}`}>
                                                {returnItem.returnedOnTime ? 'On Time' : 'Late'}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <div className={styles.noReturns}>
                                        <p>No recent returns.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </section>
                      
                              {/* Job Applications Section */}
                              {applications.length > 0 && (
                                <ApplicationsSection 
                                  applications={applications.slice(0, 5)}
                                  formatDate={formatTimeAgo}
                                  viewApplication={viewApplication}
                                  setShowAllApplications={setShowAllApplications}
                                />
                              )}
                      
                              {/* Quick Actions */}
                              <QuickActionsSection />
                            </div>
                      
                            {/* Modal for all hold requests */}
                            {showAllHolds && (
                              <div className={styles.modalOverlay}>
                                <div className={styles.modal}>
                                  <div className={styles.modalHeader}>
                                    <h2>All Reserved Books</h2>
                                    <button 
                                      className={styles.closeButton}
                                      onClick={() => setShowAllHolds(false)}
                                    >
                                      <FiX size={20} />
                                    </button>
                                  </div>
                                  
                                  <div className={styles.modalContent}>
                                    {allHoldRequests.length > 0 ? (
                                      <div className={styles.modalList}>
                                        {allHoldRequests.map((hold) => (
                                          <div key={hold.id} className={styles.modalItem}>
                                            <div className={styles.bookCoverThumb}>
                                              {hold.book?.coverImage ? (
                                                <Image 
                                                  src={hold.book.coverImage} 
                                                  alt={hold.book?.title || 'Book cover'}
                                                  width={40}
                                                  height={60}
                                                  unoptimized={true}
                                                />
                                              ) : (
                                                <div className={styles.noImageThumb}>
                                                  <span>No Cover</span>
                                                </div>
                                              )}
                                            </div>
                                            
                                            <div className={styles.modalItemDetails}>
                                              <h3 className={styles.modalItemTitle}>{hold.book?.title}</h3>
                                              <p className={styles.modalItemAuthor}>by {hold.book?.author || 'Unknown'}</p>
                                              <p className={styles.modalItemPatron}>
                                                <strong>Patron:</strong> {hold.user?.firstName} {hold.user?.lastName} ({hold.user?.libraryCardId})
                                              </p>
                                              <p className={styles.modalItemPickup}>
                                                <FiCalendar size={14} style={{ marginRight: '4px' }} />
                                                <strong>Pickup by:</strong> {hold.formattedPickupDate}
                                              </p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className={styles.modalEmpty}>
                                        <p>No reserved books found.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                      
                            {/* Modal for all checkouts */}
                            {showAllCheckouts && (
                              <div className={styles.modalOverlay}>
                                <div className={styles.modal}>
                                  <div className={styles.modalHeader}>
                                    <h2>All Checkouts</h2>
                                    <button 
                                      className={styles.closeButton}
                                      onClick={() => setShowAllCheckouts(false)}
                                    >
                                      <FiX size={20} />
                                    </button>
                                  </div>
                                  
                                  <div className={styles.modalContent}>
                                    {allCheckouts.length > 0 ? (
                                      <div className={styles.modalList}>
                                        {allCheckouts.map((checkout) => (
                                          <div key={checkout.id} className={styles.modalItem}>
                                            <div className={styles.bookCoverThumb}>
                                              {checkout.book?.coverImage ? (
                                                <Image 
                                                  src={checkout.book.coverImage} 
                                                  alt={checkout.book?.title || 'Book cover'}
                                                  width={40}
                                                  height={60}
                                                  unoptimized={true}
                                                />
                                              ) : (
                                                <div className={styles.noImageThumb}>
                                                  <span>No Cover</span>
                                                </div>
                                              )}
                                            </div>
                                            
                                            <div className={styles.modalItemDetails}>
                                              <h3 className={styles.modalItemTitle}>{checkout.book?.title}</h3>
                                              <p className={styles.modalItemAuthor}>by {checkout.book?.author || 'Unknown'}</p>
                                              <p className={styles.modalItemPatron}>
                                                <strong>Patron:</strong> {checkout.user?.firstName} {checkout.user?.lastName} ({checkout.user?.libraryCardId})
                                              </p>
                                              <div className={styles.modalItemDates}>
                                                <span>
                                                  <strong>Borrowed:</strong> {formatDate(checkout.borrowedAt)}
                                                </span>
                                                <span>
                                                  <strong>Due:</strong> {formatDate(checkout.dueDate)}
                                                </span>
                                              </div>
                                              <span className={`${styles.statusBadge} ${styles[checkout.status]}`}>
                                                {checkout.status.charAt(0).toUpperCase() + checkout.status.slice(1)}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className={styles.modalEmpty}>
                                        <p>No checkouts found.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                      
                            {/* Modal for all returns */}
                            {showAllReturns && (
                              <div className={styles.modalOverlay}>
                                <div className={styles.modal}>
                                  <div className={styles.modalHeader}>
                                    <h2>All Returns</h2>
                                    <button 
                                      className={styles.closeButton}
                                      onClick={() => setShowAllReturns(false)}
                                    >
                                      <FiX size={20} />
                                    </button>
                                  </div>
                                  
                                  <div className={styles.modalContent}>
                                    {allReturns.length > 0 ? (
                                      <div className={styles.modalList}>
                                        {allReturns.map((returnItem) => (
                                          <div key={returnItem.id} className={styles.modalItem}>
                                            <div className={styles.bookCoverThumb}>
                                              {returnItem.book?.coverImage ? (
                                                <Image 
                                                  src={returnItem.book.coverImage} 
                                                  alt={returnItem.book?.title || 'Book cover'}
                                                  width={40}
                                                  height={60}
                                                  unoptimized={true}
                                                />
                                              ) : (
                                                <div className={styles.noImageThumb}>
                                                  <span>No Cover</span>
                                                </div>
                                              )}
                                            </div>
                                            
                                            <div className={styles.modalItemDetails}>
                                              <h3 className={styles.modalItemTitle}>{returnItem.book?.title}</h3>
                                              <p className={styles.modalItemAuthor}>by {returnItem.book?.author || 'Unknown'}</p>
                                              <p className={styles.modalItemPatron}>
                                                <strong>Patron:</strong> {returnItem.user?.firstName} {returnItem.user?.lastName} ({returnItem.user?.libraryCardId})
                                              </p>
                                              <div className={styles.modalItemDates}>
                                                <span>
                                                  <strong>Borrowed:</strong> {formatDate(returnItem.borrowedAt)}
                                                </span>
                                                <span>
                                                  <strong>Returned:</strong> {formatDate(returnItem.returnDate)}
                                                </span>
                                              </div>
                                              <div className={styles.returnDetails}>
                                                <span>
                                                  <strong>Due Date:</strong> {formatDate(returnItem.dueDate)}
                                                </span>
                                                <span>
                                                  <strong>Duration:</strong> {calculateBorrowDuration(returnItem.borrowedAt, returnItem.returnDate)}
                                                </span>
                                              </div>
                                              <span className={`${styles.statusBadge} ${returnItem.returnedOnTime ? styles.onTime : styles.late}`}>
                                                {returnItem.returnedOnTime ? 'Returned On Time' : 'Returned Late'}
                                              </span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className={styles.modalEmpty}>
                                        <p>No returns found.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                      
                            {/* Modal for all job applications */}
                            {showAllApplications && (
                              <div className={styles.modalOverlay}>
                                <div className={styles.modal}>
                                  <div className={styles.modalHeader}>
                                    <h2>All Job Applications</h2>
                                    <button 
                                      className={styles.closeButton}
                                      onClick={() => setShowAllApplications(false)}
                                    >
                                      <FiX size={20} />
                                    </button>
                                  </div>
                                  
                                  <div className={styles.modalContent}>
                                    {allJobApplications.length > 0 ? (
                                      <div className={styles.modalList}>
                                        {allJobApplications.map((application) => (
                                          <div key={application.id} className={styles.modalItem}>
                                            <div className={styles.applicantAvatar}>
                                              {application.firstName.charAt(0)}
                                            </div>
                                            
                                            <div className={styles.modalItemDetails}>
                                              <h3 className={styles.modalItemTitle}>
                                                {application.firstName} {application.lastName}
                                              </h3>
                                              <p className={styles.modalItemEmail}>
                                                <FiMail size={14} style={{ marginRight: '4px' }} />
                                                {application.email}
                                              </p>
                                              <p className={styles.modalItemPosition}>
                                                <strong>Position:</strong> {application.position}
                                              </p>
                                              <div className={styles.modalItemFooter}>
                                                <span className={styles.modalItemDate}>
                                                  Submitted: {formatTimeAgo(application.submittedAt)}
                                                </span>
                                                <span className={`${styles.statusBadge} ${styles[application.type]}`}>
                                                  {application.type.charAt(0).toUpperCase() + application.type.slice(1)}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <div className={styles.modalEmpty}>
                                        <p>No job applications found.</p>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                      
                      // Stats Section Component
                      const StatsSection: React.FC<{ stats: Stat[] }> = ({ stats }) => (
                        <section className={styles.statsSection}>
                          <div className={styles.statsGrid}>
                            {stats.map((stat, index) => (
                              <div key={index} className={styles.statCard}>
                                <div className={styles.statIcon}>{stat.icon}</div>
                                <div className={styles.statInfo}>
                                  <h3 className={styles.statValue}>{stat.value}</h3>
                                  <p className={styles.statLabel}>{stat.label}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                      
                      // Applications Section Component
                      interface ApplicationsSectionProps {
                        applications: JobApplication[];
                        formatDate: (timestamp: Timestamp) => string;
                        viewApplication: (applicationId: string) => void;
                        setShowAllApplications: (show: boolean) => void;
                      }
                      
                      const ApplicationsSection: React.FC<ApplicationsSectionProps> = ({ 
                        applications, 
                        formatDate, 
                        viewApplication,
                        setShowAllApplications
                      }) => (
                        <section className={styles.applicationsSection}>
                          <div className={styles.sectionHeader}>
                            <h2>Recent Job Applications</h2>
                            <button 
                              className={styles.viewAllLink}
                              onClick={() => setShowAllApplications(true)}
                            >
                              View All
                            </button>
                          </div>
                      
                          <div className={styles.applicationsTable}>
                            <div className={styles.tableHeader}>
                              <div className={styles.tableCell}>Applicant</div>
                              <div className={styles.tableCell}>Position</div>
                              <div className={styles.tableCell}>Type</div>
                              <div className={styles.tableCell}>Date</div>
                              <div className={styles.tableCell}>Status</div>
                              <div className={styles.tableCell}>Actions</div>
                            </div>
                      
                            <div className={styles.tableBody}>
                              {applications.map(application => (
                                <div key={application.id} className={styles.tableRow}>
                                  <div className={styles.tableCell}>
                                    <div className={styles.applicantInfo}>
                                      <div className={styles.applicantName}>
                                        {application.firstName} {application.lastName}
                                      </div>
                                      <div className={styles.applicantEmail}>
                                        {application.email}
                                      </div>
                                    </div>
                                  </div>
                                  <div className={styles.tableCell}>{application.position}</div>
                                  <div className={styles.tableCell}>
                                    <span className={`${styles.applicationType} ${application.type === 'specific' ? styles.specificType : styles.generalType}`}>
                                      {application.type === 'specific' ? 'Specific' : 'General'}
                                    </span>
                                  </div>
                                  <div className={styles.tableCell}>
                                    {formatDate(application.submittedAt)}
                                  </div>
                                  <div className={styles.tableCell}>
                                    <span className={`${styles.applicationStatus} ${application.viewed ? styles.viewedStatus : styles.newStatus}`}>
                                      {application.viewed ? 'Viewed' : 'New'}
                                    </span>
                                  </div>
                                  <div className={styles.tableCell}>
                                    <div className={styles.actionButtons}>
                                      <button 
                                        className={styles.viewButton}
                                        onClick={() => viewApplication(application.id)}
                                      >
                                        View
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      );
                      
                      // Quick Actions Section Component
                      const QuickActionsSection = () => (
                        <section className={styles.quickActions}>
                          <h2 className={styles.sectionTitle}>Quick Actions</h2>
                          <div className={styles.actionGrid}>
                            <ActionCard href="/admin/add-book" icon="📕" label="Add Book" />
                            <ActionCard href="/admin/stocks" icon="📦" label="Manage Stocks" />
                            <ActionCard href="/admin/librarians/add" icon="👤" label="Add Librarian" />
                            <ActionCard href="/admin/patrons" icon="👤" label="Patrons" />
                            <ActionCard href="/admin/reports" icon="📝" label="Reports" />
                          </div>
                        </section>
                      );
                      
                      // Action Card Component
                      interface ActionCardProps {
                        href: string;
                        icon: string;
                        label: string;
                      }
                      
                      const ActionCard: React.FC<ActionCardProps> = ({ href, icon, label }) => (
                        <Link href={href} className={styles.actionCard}>
                          <div className={styles.actionIcon}>{icon}</div>
                          <span className={styles.actionLabel}>{label}</span>
                        </Link>
                      );
                      // Notification Panel Component for use with the Header
interface NotificationPanelProps {
  applications: JobApplication[];
  notifications: number;
  formatDate: (timestamp: Timestamp) => string;
  markAsViewed: (applicationId: string) => void;
}

const NotificationPanel = ({ applications, notifications, formatDate, markAsViewed }: NotificationPanelProps) => (
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
            onClick={() => markAsViewed(application.id)}
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
                  {formatDate(application.submittedAt)}
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

    <div className={styles.notificationFooter}>
      <Link href="/admin/careers/applications" className={styles.viewAllLink}>
        View All Applications
      </Link>
    </div>
  </div>
);

// Security Key Popup Component
interface SecurityKeyPopupProps {
  securityKeyInfo: SecurityKey | null;
  securityKeyCopied: boolean;
  setSecurityKeyCopied: (copied: boolean) => void;
  setShowSecurityPopup: (show: boolean) => void;
}

const SecurityKeyPopup: React.FC<SecurityKeyPopupProps> = ({ 
  securityKeyInfo, 
  securityKeyCopied, 
  setSecurityKeyCopied, 
  setShowSecurityPopup 
}) => (
  <div className={styles.securityKeyPopup}>
    <div className={styles.securityKeyPopupContent}>
      <div className={styles.securityKeyPopupHeader}>
        <h3>Your New Security Key</h3>
      </div>
      <div className={styles.securityKeyPopupBody}>
        <p className={styles.securityKeyWarning}>
          <span className={styles.warningIcon}>⚠️</span>
          <strong>IMPORTANT:</strong> This is the only time your security key will be displayed in full. 
          You MUST copy this key before closing this popup!
        </p>
        <div className={styles.securityKeyDisplay}>
          {securityKeyInfo?.key}
        </div>
        <div className={styles.securityKeyActions}>
          <button 
            className={styles.securityKeyCopyButton}
            onClick={() => {
              if (securityKeyInfo?.key) {
                navigator.clipboard.writeText(securityKeyInfo.key)
                  .then(() => {
                    alert("Security key copied to clipboard!");
                    setSecurityKeyCopied(true);
                  })
                  .catch((err) => {
                    console.error("Failed to copy security key:", err);
                    alert("Failed to copy security key. Please manually select and copy the key.");
                  });
              }
            }}
          >
            Copy to Clipboard
          </button>
          <button 
            className={styles.securityKeyDoneButton}
            onClick={() => {
              if (securityKeyCopied) {
                setShowSecurityPopup(false);
                setSecurityKeyCopied(false);
              } else {
                const confirmed = window.confirm(
                  "You haven't copied your security key. Are you sure you want to close this popup? " +
                  "You won't be able to see this key again without resetting it."
                );
                if (confirmed) {
                  setShowSecurityPopup(false);
                }
              }
            }}
          >
            I've Saved My Key
          </button>
        </div>
        <p className={styles.securityKeyNote}>
          After closing this popup, you'll only be able to view your key on the Privacy Page with additional verification.
        </p>
      </div>
    </div>
  </div>
);

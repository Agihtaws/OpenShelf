// src/app/user/dashboard/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { db } from '@/firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, serverTimestamp, updateDoc, deleteDoc, addDoc, setDoc, orderBy, limit } from 'firebase/firestore';
import { FiBook, FiHeart, FiClock, FiBookmark, FiSettings, FiLogOut, FiHome, FiBell, FiUser, FiBarChart2, FiDollarSign, FiRefreshCw } from 'react-icons/fi';
import styles from './dashboard.module.css';
import { searchBooks, getBookById, formatBookData } from '@/utils/googleBooksAPI';
import { getBookRecommendations, getStockAwareRecommendations } from '@/utils/geminiAPI';

// Define types for user data
interface UserData {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  firstName?: string;
  lastName?: string;
  memberSince?: any;
  libraryCardId?: string;
  libraryCardNumeric?: number;
  joinDate?: string;
  preferences?: string[];
  readingHistory?: string[];
}

// Define types for book data
interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  categories: string[];
  publishedDate: string;
  dueDate?: string;
  status?: 'borrowed' | 'reserved' | 'returned' | 'overdue' | 'available';
  returnDate?: string;
  renewals?: number;
  renewable?: boolean;
  reason?: string;
  availableCopies?: number;
  totalCopies?: number;
  pickupDate?: string;
}

// Define types for notifications
interface Notification {
  id?: string;
  userId: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  createdAt: any;
  read: boolean;
}

// Define type for Firestore timestamp to fix "toDate" error
interface FirestoreTimestamp {
  toDate: () => Date;
  seconds: number;
  nanoseconds: number;
}

// Type guard to check if a value is a Firestore timestamp
function isFirestoreTimestamp(value: any): value is FirestoreTimestamp {
  return value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function';
}

export default function UserDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('borrowed');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userInitial, setUserInitial] = useState('');
  
  // Book-related states
  const [borrowedBooks, setBorrowedBooks] = useState<Book[]>([]);
  const [reservedBooks, setReservedBooks] = useState<Book[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [recommendedBooks, setRecommendedBooks] = useState<Book[]>([]);
  
  interface Fine {
    id: string;
    bookTitle: string;
    amount: number;
    reason: string;
    date: string;
    isPaid: boolean;
  }
  
  const [fines, setFines] = useState<{ total: number; items: Fine[] }>({ total: 0, items: [] });
  
  // UI states
  const [notifications, setNotifications] = useState(0);
  const [userNotifications, setUserNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // State for reservation popup
  const [showReservationPopup, setShowReservationPopup] = useState(false);
  const [selectedBookForReservation, setSelectedBookForReservation] = useState<Book | null>(null);
  const [pickupDate, setPickupDate] = useState('');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [maxRenewalDate, setMaxRenewalDate] = useState<Date | null>(null);

  // Check authentication when component mounts
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const notificationsContainer = document.querySelector(`.${styles.notificationsContainer}`);
      
      if (notificationsContainer && !notificationsContainer.contains(target)) {
        setShowNotifications(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    
    const checkAuth = async () => {
      try {
        // Check if user is logged in via localStorage/cookies
        const userToken = localStorage.getItem('user_token');
        const userId = localStorage.getItem('user_id');
        
        if (userToken === 'logged_in' && userId) {
          // User is logged in, get their data from Firestore
          const userDoc = await getDoc(doc(db, "users_customer", userId));
          
          if (userDoc.exists()) {
            // Get the created date from Firestore
            const createdAtTimestamp = userDoc.data().createdAt;
            let createdAtDate: Date;
            
            // Fix for "Property toDate does not exist on type Never" error
            if (isFirestoreTimestamp(createdAtTimestamp)) {
              createdAtDate = createdAtTimestamp.toDate();
            } else if (createdAtTimestamp) {
              createdAtDate = new Date(createdAtTimestamp);
            } else {
              createdAtDate = new Date();
            }
            
            // Format the date as a string for display
            const formattedCreatedDate = createdAtDate.toLocaleDateString();
            
            // Set user data
            setUserData({
              uid: userId,
              displayName: userDoc.data().displayName || '',
              email: userDoc.data().email || '',
              photoURL: userDoc.data().photoURL || '',
              firstName: userDoc.data().firstName || '',
              lastName: userDoc.data().lastName || '',
              memberSince: createdAtTimestamp,
              libraryCardId: userDoc.data().libraryCardId || `LIB-ID-CARD-1`,
              libraryCardNumeric: userDoc.data().libraryCardNumeric || 1,
              joinDate: formattedCreatedDate, // Use the formatted creation date
              preferences: userDoc.data().preferences || [],
              readingHistory: userDoc.data().readingHistory || []
            });
            
            // Set user initial for avatar
            if (userDoc.data().firstName) {
              setUserInitial(userDoc.data().firstName.charAt(0).toUpperCase());
            } else if (userDoc.data().displayName) {
              setUserInitial(userDoc.data().displayName.charAt(0).toUpperCase());
            } else if (userDoc.data().email) {
              setUserInitial(userDoc.data().email.charAt(0).toUpperCase());
            }
            
            // Fetch user's books
            await fetchUserBooks(userId);
            
            // Fetch user's notifications
            await fetchUserNotifications(userId);
            
            setIsAuthenticated(true);
          } else {
            // If user document doesn't exist, force logout
            handleLogout();
          }
        } else {
          // Redirect to login if not authenticated
          router.push('/auth/login');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking authentication:", error);
        // Redirect to login on error
        router.push('/auth/login');
        setIsLoading(false);
      }
    };
    
    checkAuth();
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [router]);

  // Fetch user's books from Firestore - Optimized version
  const fetchUserBooks = async (userId: string) => {
    try {
      // Use Promise.all to fetch different types of data in parallel
      const [
        borrowedResult, 
        reservedResult, 
        favoritesResult, 
        finesResult
      ] = await Promise.all([
        // Fetch borrowed books
        getDocs(query(
          collection(db, "borrows"),
          where("userId", "==", userId),
          where("status", "in", ["borrowed", "overdue"])
        )),
        
        // Fetch reserved books
        getDocs(query(
          collection(db, "reserves"),
          where("userId", "==", userId),
          where("status", "==", "reserved")
        )),
        
        // Fetch favorite books
        getDocs(query(
          collection(db, "favorites"),
          where("userId", "==", userId)
        )),
        
        // Fetch fines
        getDocs(query(
          collection(db, "fines"),
          where("userId", "==", userId),
          where("isPaid", "==", false)
        ))
      ]);

      // Extract book IDs from each collection
      const borrowedBookIds = borrowedResult.docs.map(doc => doc.data().bookId);
      const reservedBookIds = reservedResult.docs.map(doc => doc.data().bookId);
      const favoriteBookIds = favoritesResult.docs.map(doc => doc.data().bookId);
      
      // Get unique book IDs to minimize book fetching
      const uniqueBookIds = [...new Set([...borrowedBookIds, ...reservedBookIds, ...favoriteBookIds])];
      
      // Fetch all needed books in a single batch query
      const bookDocs = await Promise.all(
        uniqueBookIds.map(bookId => getDoc(doc(db, "books", bookId)))
      );
      
      // Create a map of book data for quick lookup
      const booksMap = new Map();
      bookDocs.forEach(bookDoc => {
        if (bookDoc.exists()) {
          booksMap.set(bookDoc.id, { ...bookDoc.data(), id: bookDoc.id });
        }
      });
      
      // Process borrowed books
      const borrowedList: Book[] = borrowedResult.docs.map(borrowDoc => {
        const borrowData = borrowDoc.data();
        const bookData = booksMap.get(borrowData.bookId);
        
        if (!bookData) return null;
        
        // Calculate if book is overdue
        let dueDate: Date;
        if (isFirestoreTimestamp(borrowData.dueDate)) {
          dueDate = borrowData.dueDate.toDate();
        } else {
          dueDate = new Date(borrowData.dueDate);
        }
        
        const isOverdue = dueDate < new Date();
        
        return {
          ...bookData,
          dueDate: dueDate.toISOString().split('T')[0],
          renewals: borrowData.renewals || 0,
          renewable: borrowData.renewals < 3,
          status: isOverdue ? 'overdue' : 'borrowed'
        };
      }).filter(Boolean);
      
      // Process reserved books
      const reservedList: Book[] = reservedResult.docs.map(reserveDoc => {
        const reserveData = reserveDoc.data();
        const bookData = booksMap.get(reserveData.bookId);
        
        if (!bookData) return null;
        
        // Handle reservedAt date
        let returnDateStr: string | undefined;
        if (reserveData.reservedAt) {
          if (isFirestoreTimestamp(reserveData.reservedAt)) {
            returnDateStr = reserveData.reservedAt.toDate().toISOString().split('T')[0];
          } else {
            returnDateStr = new Date(reserveData.reservedAt).toISOString().split('T')[0];
          }
        }
        
        // Handle pickupDate date
        let pickupDateStr: string | undefined;
        if (reserveData.pickupDate) {
          if (isFirestoreTimestamp(reserveData.pickupDate)) {
            pickupDateStr = reserveData.pickupDate.toDate().toISOString().split('T')[0];
          } else {
            pickupDateStr = new Date(reserveData.pickupDate).toISOString().split('T')[0];
          }
        }
        
        return {
          ...bookData,
          status: 'reserved',
          returnDate: returnDateStr,
          pickupDate: pickupDateStr
        };
      }).filter(Boolean);
      
      // Process favorites
      const favoritesList: Book[] = favoritesResult.docs.map(favoriteDoc => {
        const favoriteData = favoriteDoc.data();
        const bookData = booksMap.get(favoriteData.bookId);
        
        if (!bookData) return null;
        
        return bookData;
      }).filter(Boolean);
      
      // Process fines
      const finesList: Fine[] = [];
      let totalFines = 0;
      
      finesResult.docs.forEach(fineDoc => {
        const fineData = fineDoc.data() as Fine;
        let dateStr = '';
        
        if (fineData.date) {
          if (isFirestoreTimestamp(fineData.date)) {
            dateStr = fineData.date.toDate().toISOString().split('T')[0];
          } else {
            dateStr = new Date(fineData.date).toISOString().split('T')[0];
          }
        }
        
        finesList.push({
          ...fineData,
          id: fineDoc.id,
          date: dateStr
        });
        
        totalFines += fineData.amount;
      });
      
      // Set state with fetched data
      setBorrowedBooks(borrowedList);
      setReservedBooks(reservedList);
      setFavoriteBooks(favoritesList);
      setFines({
        total: totalFines,
        items: finesList
      });
      
      // Fetch recommendations asynchronously after main data is loaded
      setIsLoadingRecommendations(true);
      getStockAwareRecommendations(
        userId,
        favoritesList,
        borrowedList
      ).then(recommendations => {
        setRecommendedBooks(recommendations);
        setIsLoadingRecommendations(false);
      }).catch(error => {
        console.error("Error getting recommendations:", error);
        setIsLoadingRecommendations(false);
        setRecommendedBooks([]);
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching user books:", error);
      
      // Fallback to mock data if API fails
      setBorrowedBooks([
        {
          id: '1',
          title: 'The Midnight Library',
          author: 'Matt Haig',
          coverImage: '/images/default-cover.jpg',
          description: 'Between life and death there is a library...',
          categories: ['Fiction', 'Fantasy'],
          publishedDate: '2020',
          dueDate: '2025-03-15',
          renewals: 0,
          renewable: true
        },
        {
          id: '2',
          title: 'Project Hail Mary',
          author: 'Andy Weir',
          coverImage: '/images/default-cover.jpg',
          description: 'A lone astronaut must save the earth from disaster...',
          categories: ['Science Fiction'],
          publishedDate: '2021',
          dueDate: '2025-03-18',
          renewals: 1,
          renewable: true
        }
      ]);
      
      setReservedBooks([
        {
          id: '3',
          title: 'Cloud Cuckoo Land',
          author: 'Anthony Doerr',
          coverImage: '/images/default-cover.jpg',
          description: 'Set in Constantinople in the fifteenth century...',
          categories: ['Historical Fiction'],
          publishedDate: '2021',
          status: 'reserved',
          returnDate: '2025-03-10',
          pickupDate: '2025-03-17'
        }
      ]);
      
      setFavoriteBooks([
        {
          id: '6',
          title: 'The Song of Achilles',
          author: 'Madeline Miller',
          coverImage: '/images/default-cover.jpg',
          description: 'A retelling of the Trojan War from the perspective of Patroclus...',
          categories: ['Historical Fiction', 'Fantasy', 'Mythology'],
          publishedDate: '2012'
        },
        {
          id: '7',
          title: 'Educated',
          author: 'Tara Westover',
          coverImage: '/images/default-cover.jpg',
          description: 'A memoir about a woman who leaves her survivalist family...',
          categories: ['Memoir', 'Biography', 'Nonfiction'],
          publishedDate: '2018'
        }
      ]);
      
      setRecommendedBooks([
        {
          id: '4',
          title: 'The Lincoln Highway',
          author: 'Amor Towles',
          coverImage: '/images/default-cover.jpg',
          description: 'In June, 1954, eighteen-year-old Emmett Watson...',
          categories: ['Historical Fiction'],
          publishedDate: '2021',
          reason: 'Based on your interest in historical fiction',
          availableCopies: 3,
          totalCopies: 5,
          status: 'available'
        },
        {
          id: '5',
          title: 'Klara and the Sun',
          author: 'Kazuo Ishiguro',
          coverImage: '/images/default-cover.jpg',
          description: 'From the bestselling author of Never Let Me Go...',
          categories: ['Science Fiction', 'Literary Fiction'],
          publishedDate: '2021',
          reason: 'Popular in your favorite genres',
          availableCopies: 2,
          totalCopies: 4,
          status: 'available'
        }
      ]);
      
      // Mock fines
      setFines({
        total: 3.50,
        items: [
          { id: '1', bookTitle: 'The Dutch House', amount: 1.50, reason: 'Late return (3 days)', date: '2025-02-28', isPaid: false },
          { id: '2', bookTitle: 'Circe', amount: 2.00, reason: 'Late return (4 days)', date: '2025-03-01', isPaid: false }
        ]
      });
      
      setIsLoading(false);
    }
  };

  // Function to check book availability
  const checkBookAvailability = async (bookId: string) => {
    try {
      // Get book document from Firestore
      const bookDoc = await getDoc(doc(db, "books", bookId));
      
      if (!bookDoc.exists()) {
        return { inStock: false, availableCopies: 0, totalCopies: 0 };
      }
      
      const bookData = bookDoc.data();
      const totalCopies = bookData.copies || 0;
      
      // Count borrowed copies
      const borrowedQuery = query(
        collection(db, "borrows"),
        where("bookId", "==", bookId),
        where("status", "in", ["borrowed", "overdue"])
      );
      
      const borrowedSnapshot = await getDocs(borrowedQuery);
      const borrowedCount = borrowedSnapshot.size;
      
      // Count reserved copies
      const reservedQuery = query(
        collection(db, "reserves"),
        where("bookId", "==", bookId),
        where("status", "==", "reserved")
      );
      
      const reservedSnapshot = await getDocs(reservedQuery);
      const reservedCount = reservedSnapshot.size;
      
      // Calculate available copies
      const availableCopies = Math.max(0, totalCopies - borrowedCount - reservedCount);
      
      return {
        inStock: totalCopies > 0,
        availableCopies,
        totalCopies,
        borrowedCount,
        reservedCount
      };
    } catch (error) {
      console.error("Error checking book availability:", error);
      return { inStock: false, availableCopies: 0, totalCopies: 0 };
    }
  };

  // Fetch user notifications
  const fetchUserNotifications = async (userId: string) => {
    try {
      // Get most recent unread notifications
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        orderBy("createdAt", "desc"),
        limit(10)
      );
      
      const notificationsSnapshot = await getDocs(notificationsQuery);
      const notificationsList: Notification[] = [];
      let unreadCount = 0;
      
      notificationsSnapshot.forEach(doc => {
        const data = doc.data() as Notification;
        let createdAtDate: Date;
        
        // Fix for timestamp conversion issues
        if (isFirestoreTimestamp(data.createdAt)) {
          createdAtDate = data.createdAt.toDate();
        } else if (data.createdAt) {
          createdAtDate = new Date(data.createdAt);
        } else {
          createdAtDate = new Date();
        }
        
        notificationsList.push({
          id: doc.id,
          ...data,
          createdAt: createdAtDate
        });
        
        if (!data.read) {
          unreadCount++;
        }
      });
      
      setUserNotifications(notificationsList);
      setNotifications(unreadCount);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  // Function to add a notification
  const addNotification = async (userId: string, notification: Omit<Notification, 'id' | 'userId' | 'read'>) => {
    try {
      const notificationData = {
        userId,
        ...notification,
        read: false
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, "notifications"), notificationData);
      
      // Update UI
      setUserNotifications(prev => [
        { id: docRef.id, ...notificationData },
        ...prev
      ]);
      
      // Update notification count
      setNotifications(prev => prev + 1);
      
      return docRef.id;
    } catch (error) {
      console.error("Error adding notification:", error);
    }
  };

  // Function to mark notification as read
  const markNotificationAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, "notifications", notificationId), {
        read: true
      });
      
      // Update UI
      setUserNotifications(prev => 
        prev.map(notification => 
          notification.id === notificationId 
            ? { ...notification, read: true }
            : notification
        )
      );
      
      // Update notification count
      setNotifications(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Function to clear all notifications
  const clearAllNotifications = async () => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) return;
      
      // Get all unread notifications
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", userId),
        where("read", "==", false)
      );
      
      const notificationsSnapshot = await getDocs(notificationsQuery);
      
      // Mark all as read
      for (const notificationDoc of notificationsSnapshot.docs) {
        await updateDoc(notificationDoc.ref, {
          read: true
        });
      }
      
      // Update UI
      setUserNotifications(prev => 
        prev.map(notification => ({ ...notification, read: true }))
      );
      
      // Reset notification count
      setNotifications(0);
    } catch (error) {
      console.error("Error clearing notifications:", error);
    }
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      // Get the user ID from localStorage
      const userId = localStorage.getItem('user_id');
      
      // Update user document to set isLoggedIn to false if we have a userId
      if (userId) {
        try {
          await updateDoc(doc(db, "users_customer", userId), {
            isLoggedIn: false,
            lastLogout: serverTimestamp()
          });
        } catch (error) {
          console.error("Error updating user logout status:", error);
        }
      }
      // Clear all localStorage items
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      localStorage.removeItem('device_id');
      
      // Clear all cookies
      document.cookie = 'user_token=; path=/; max-age=0';
      document.cookie = 'user_role=; path=/; max-age=0';
      document.cookie = 'user_id=; path=/; max-age=0';
      document.cookie = 'device_id=; path=/; max-age=0';
      document.cookie = 'last_activity=; path=/; max-age=0';
      
      // Force a complete page reload and redirect
      window.location.href = '/auth/login';
    } catch (error) {
      console.error("Error signing out:", error);
      // Even if there's an error, force redirect
      window.location.href = '/auth/login';
    }
  };

  // Open renewal modal with calculated max date
  const openRenewModal = (book: Book) => {
    // Check if book is renewable
    if (!book.renewable) {
      // Add notification instead of toast
      const userId = localStorage.getItem('user_id');
      if (userId) {
        addNotification(userId, {
          title: "Renewal Limit Reached",
          message: "You've reached the maximum number of renewals for this book.",
          type: "warning",
          createdAt: new Date()
        });
      }
      return;
    }

    // Calculate max renewal date based on renewal count
    const maxDate = book.dueDate ? new Date(book.dueDate) : new Date();
    if (book.renewals === 2) {
      // Third renewal - only allow 5 days extension
      maxDate.setDate(maxDate.getDate() + 5);
    } else {
      // First and second renewals - allow 10 days extension
      maxDate.setDate(maxDate.getDate() + 10);
    }
    
    setSelectedBook(book);
    setNewDueDate(maxDate); // Default to max date
    setMaxRenewalDate(maxDate);
    setShowRenewModal(true);
  };

  // Function to handle book renewal with modal
  const renewBook = async () => {
    try {
      if (!selectedBook || !newDueDate) return;
      
      const userId = localStorage.getItem('user_id');
      if (!userId) return;
      
      // Set processing state to prevent multiple clicks
      setIsProcessing(true);
      
      // Find the borrow document
      const borrowQuery = query(
        collection(db, "borrows"),
        where("userId", "==", userId),
        where("bookId", "==", selectedBook.id)
      );
      
      const borrowSnapshot = await getDocs(borrowQuery);
      
      if (!borrowSnapshot.empty) {
        const borrowDoc = borrowSnapshot.docs[0];
        const borrowData = borrowDoc.data();
        
        // Update the borrow document
        await updateDoc(borrowDoc.ref, {
          renewals: (selectedBook.renewals ?? 0) + 1,
          dueDate: newDueDate,
          status: 'borrowed'
        });
        
        // Add a notification
        await addNotification(userId, {
          title: "Book Renewed",
          message: `Your book has been renewed. New due date: ${newDueDate.toLocaleDateString()}.`,
          type: "success",
          createdAt: new Date()
        });
        
        // Add activity log for librarian dashboard
        await addDoc(collection(db, "activity_logs"), {
          userId: userId,
          userEmail: userData?.email,
          userLibraryId: userData?.libraryCardId,
          bookId: selectedBook.id,
          bookTitle: selectedBook.title,
          actionType: "renew",
          timestamp: serverTimestamp(),
          details: {
            previousDueDate: selectedBook.dueDate ? new Date(selectedBook.dueDate).toLocaleDateString() : 'N/A',
            newDueDate: newDueDate.toLocaleDateString(),
            renewalCount: (selectedBook.renewals ?? 0) + 1
          }
        });
        
        // Update UI
        setBorrowedBooks(prev => prev.map(book => {
          if (book.id === selectedBook.id) {
            return {
              ...book,
              dueDate: newDueDate.toISOString().split('T')[0],
              renewals: (book.renewals ?? 0) + 1,
              renewable: ((book.renewals ?? 0) + 1) < 3,
              status: 'borrowed'
            };
          }
          return book;
        }));
        
        // Close modal and reset
        setShowRenewModal(false);
        setSelectedBook(null);
        setNewDueDate(null);
      }
    } catch (error) {
      console.error("Error renewing book:", error);
      const userId = localStorage.getItem('user_id');
      if (userId) {
        await addNotification(userId, {
          title: "Renewal Failed",
          message: "Failed to renew book. Please try again later.",
          type: "error",
          createdAt: new Date()
        });
      }
    } finally {
      // Always reset processing state when done
      setIsProcessing(false);
    }
  };

  // Function to handle book return
  const returnBook = async (bookId: string) => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) return;
      
      // Find the borrow document
      const borrowQuery = query(
        collection(db, "borrows"),
        where("userId", "==", userId),
        where("bookId", "==", bookId)
      );
      
      const borrowSnapshot = await getDocs(borrowQuery);
      
      if (!borrowSnapshot.empty) {
        const borrowDoc = borrowSnapshot.docs[0];
        
        // Update the borrow document
        await updateDoc(borrowDoc.ref, {
          status: 'returned',
          returnDate: new Date()
        });
        
        // Add a notification
        await addNotification(userId, {
          title: "Book Returned",
          message: "Your book has been returned successfully.",
          type: "success",
          createdAt: new Date()        });
        
          // Update UI
          setBorrowedBooks(prev => prev.filter(book => book.id !== bookId));
        }
      } catch (error) {
        console.error("Error returning book:", error);
        const userId = localStorage.getItem('user_id');
        if (userId) {
          await addNotification(userId, {
            title: "Return Failed",
            message: "Failed to return book. Please try again later.",
            type: "error",
            createdAt: new Date()
          });
        }
      }
    };
    
    // Function to handle reservation cancellation
    const cancelReservation = async (bookId: string) => {
      try {
        const userId = localStorage.getItem('user_id');
        if (!userId) return;
        
        // Find the reservation document
        const reserveQuery = query(
          collection(db, "reserves"),
          where("userId", "==", userId),
          where("bookId", "==", bookId),
          where("status", "==", "reserved")
        );
        
        const reserveSnapshot = await getDocs(reserveQuery);
        
        if (!reserveSnapshot.empty) {
          const reserveDoc = reserveSnapshot.docs[0];
          
          // Delete the reservation
          await deleteDoc(reserveDoc.ref);
          
          // Add a notification
          await addNotification(userId, {
            title: "Reservation Cancelled",
            message: "Your book reservation has been cancelled.",
            type: "info",
            createdAt: new Date()
          });
          
          // Update UI
          setReservedBooks(prev => prev.filter(book => book.id !== bookId));
        }
      } catch (error) {
        console.error("Error cancelling reservation:", error);
        const userId = localStorage.getItem('user_id');
        if (userId) {
          await addNotification(userId, {
            title: "Cancellation Failed",
            message: "Failed to cancel reservation. Please try again later.",
            type: "error",
            createdAt: new Date()
          });
        }
      }
    };
    
    // Function to add a book to favorites
    const addToFavorites = async (book: Book) => {
      try {
        const userId = localStorage.getItem('user_id');
        if (!userId) return;
        
        // Check if book is already in favorites
        const favoriteQuery = query(
          collection(db, "favorites"),
          where("userId", "==", userId),
          where("bookId", "==", book.id)
        );
        
        const favoriteSnapshot = await getDocs(favoriteQuery);
        
        if (!favoriteSnapshot.empty) {
          // Add notification instead of toast
          await addNotification(userId, {
            title: "Already in Favorites",
            message: "This book is already in your favorites!",
            type: "info",
            createdAt: new Date()
          });
          return;
        }
        
        // Add to favorites collection
        await setDoc(doc(db, "favorites", `${userId}_${book.id}`), {
          userId: userId,
          bookId: book.id,
          addedAt: new Date()
        });
        
        // Add a notification
        await addNotification(userId, {
          title: "Added to Favorites",
          message: `"${book.title}" has been added to your favorites!`,
          type: "success",
          createdAt: new Date()
        });
        
        // Update favorites count in UI
        setFavoriteBooks(prev => [...prev, book]);
      } catch (error) {
        console.error("Error adding to favorites:", error);
        const userId = localStorage.getItem('user_id');
        if (userId) {
          await addNotification(userId, {
            title: "Failed to Add",
            message: "Failed to add to favorites. Please try again later.",
            type: "error",
            createdAt: new Date()
          });
        }
      }
    };
    
    // Function to remove a book from favorites
    const removeFromFavorites = async (bookId: string, bookTitle: string) => {
      try {
        const userId = localStorage.getItem('user_id');
        if (!userId) return;
        
        // Delete from favorites collection
        await deleteDoc(doc(db, "favorites", `${userId}_${bookId}`));
        
        // Update UI
        setFavoriteBooks(prev => prev.filter(book => book.id !== bookId));
        
        // Add a notification
        await addNotification(userId, {
          title: "Removed from Favorites",
          message: `"${bookTitle}" has been removed from your favorites.`,
          type: "info",
          createdAt: new Date()
        });
      } catch (error) {
        console.error("Error removing from favorites:", error);
        const userId = localStorage.getItem('user_id');
        if (userId) {
          await addNotification(userId, {
            title: "Removal Failed",
            message: "Failed to remove from favorites. Please try again later.",
            type: "error",
            createdAt: new Date()
          });
        }
      }
    };
    
    // Function to handle reservation popup
    const openReservationPopup = (book: Book) => {
      setSelectedBookForReservation(book);
      
      // Set default pickup date (tomorrow)
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setPickupDate(tomorrow.toISOString().split('T')[0]);
      
      setShowReservationPopup(true);
    };
    
    // Function to reserve a book with pickup date
    const confirmReservation = async () => {
      try {
        if (!selectedBookForReservation) return;
        
        const userId = localStorage.getItem('user_id');
        if (!userId) return;
        
        // Check if book is already reserved
        const reserveQuery = query(
          collection(db, "reserves"),
          where("userId", "==", userId),
          where("bookId", "==", selectedBookForReservation.id),
          where("status", "==", "reserved")
        );
        
        const reserveSnapshot = await getDocs(reserveQuery);
        
        if (!reserveSnapshot.empty) {
          await addNotification(userId, {
            title: "Already Reserved",
            message: "You have already reserved this book!",
            type: "info",
            createdAt: new Date()
          });
          setShowReservationPopup(false);
          return;
        }
        
        // Check if book is still available
        const availability = await checkBookAvailability(selectedBookForReservation.id);
        if (!availability.inStock || availability.availableCopies <= 0) {
          await addNotification(userId, {
            title: "No Longer Available",
            message: "Sorry, this book is no longer available for reservation.",
            type: "warning",
            createdAt: new Date()
          });
          
          setShowReservationPopup(false);
          
          // Refresh recommendations
          if (userData?.uid) {
            const stockAwareRecs = await getStockAwareRecommendations(
              userData.uid,
              favoriteBooks,
              borrowedBooks
            );
            setRecommendedBooks(stockAwareRecs);
          }
          return;
        }
        
        // Add to reserves collection with pickup date
        await setDoc(doc(db, "reserves", `${userId}_${selectedBookForReservation.id}`), {
          userId: userId,
          bookId: selectedBookForReservation.id,
          status: 'reserved',
          reservedAt: new Date(),
          pickupDate: pickupDate
        });
        
        // Add a notification
        await addNotification(userId, {
          title: "Book Reserved",
          message: `"${selectedBookForReservation.title}" has been reserved. You can pick it up on ${new Date(pickupDate).toLocaleDateString()}.`,
          type: "success",
          createdAt: new Date()
        });
        
        // Update reserved books count in UI
        setReservedBooks(prev => [...prev, {
          ...selectedBookForReservation,
          status: 'reserved',
          returnDate: new Date().toISOString().split('T')[0],
          pickupDate: pickupDate
        }]);
        
        // Update recommendation UI by removing the reserved book
        setRecommendedBooks(prev => prev.filter(rec => rec.id !== selectedBookForReservation.id));
        
        // Close the popup
        setShowReservationPopup(false);
      } catch (error) {
        console.error("Error reserving book:", error);
        const userId = localStorage.getItem('user_id');
        if (userId) {
          await addNotification(userId, {
            title: "Reservation Failed",
            message: "Failed to reserve book. Please try again later.",
            type: "error",
            createdAt: new Date()
          });
        }
        setShowReservationPopup(false);
      }
    };
    
    // Function to handle fine payment
    const payFines = async () => {
      try {
        const userId = localStorage.getItem('user_id');
        if (!userId) return;
        
        // Add a notification for payment initiation
        await addNotification(userId, {
          title: "Payment Processing",
          message: "Redirecting to payment gateway...",
          type: "info",
          createdAt: new Date()
        });
        
        // For now, we'll just mock a successful payment
        setTimeout(async () => {
          // Mark all fines as paid
          for (const fine of fines.items) {
            await updateDoc(doc(db, "fines", fine.id), {
              isPaid: true,
              paidAt: new Date()
            });
          }
          
          // Add a notification
          await addNotification(userId, {
            title: "Payment Successful",
            message: `Your fine payment of USD ${fines.total.toFixed(2)} was successful.`,
            type: "success",
            createdAt: new Date()
          });
          
          // Update UI
          setFines({ total: 0, items: [] });
        }, 2000);
      } catch (error) {
        console.error("Error processing payment:", error);
        const userId = localStorage.getItem('user_id');
        if (userId) {
          await addNotification(userId, {
            title: "Payment Failed",
            message: "Payment failed. Please try again later.",
            type: "error",
            createdAt: new Date()
          });
        }
      }
    };
  
    // Function to ensure diversity in recommendations
    const ensureDiversity = (recommendations: Book[]): Book[] => {
      const categories = new Set<string>();
      const authors = new Set<string>();
      const diverseRecommendations: Book[] = [];
      
      // First pass: add books with unique categories/authors
      for (const book of recommendations) {
        const bookCategory = book.categories?.[0] || '';
        if (!categories.has(bookCategory) || !authors.has(book.author)) {
          diverseRecommendations.push(book);
          categories.add(bookCategory);
          authors.add(book.author);
          
          // Limit to 5 diverse recommendations
          if (diverseRecommendations.length >= 5) break;
        }
      }
      
      // Fill remaining slots if needed
      if (diverseRecommendations.length < 5) {
        for (const book of recommendations) {
          if (!diverseRecommendations.includes(book)) {
            diverseRecommendations.push(book);
            if (diverseRecommendations.length >= 5) break;
          }
        }
      }
      
      return diverseRecommendations;
    };
  
    // Show loading state while checking authentication
    if (isLoading) {
      return (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading your library...</p>
        </div>
      );
    }
  
    // If not authenticated, don't render anything (redirect happens in useEffect)
    if (!isAuthenticated) {
      return null;
    }
  
    // Main dashboard rendering
    return (
      <div className={styles.dashboardContainer}>
        <main className={styles.mainContent}>
          
          {/* Welcome Section */}
          <section className={styles.welcomeSection}>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeSubheading}>
                Library Card: {userData?.libraryCardId || 'LIB-ID-CARD-1'}
              </h1>
              <p className={styles.welcomeJoinDate}>
                Member since: {userData?.joinDate || new Date().toLocaleDateString()}
              </p>
            </div>
            <div className={styles.statsGrid}>
              <div className={styles.statsCard}>
                <span className={styles.statsNumber}>{borrowedBooks.length}</span>
                <span className={styles.statsLabel}>Borrowed</span>
              </div>
              <div className={styles.statsCard}>
                <span className={styles.statsNumber}>{reservedBooks.length}</span>
                <span className={styles.statsLabel}>Reserved</span>
              </div>
              <div className={styles.statsCard}>
                <span className={styles.statsNumber}>{favoriteBooks.length}</span>
                <span className={styles.statsLabel}>Favorites</span>
              </div>
              <div className={styles.statsCard}>
                <span className={styles.statsNumber}>INR {fines.total.toFixed(2)}</span>
                <span className={styles.statsLabel}>Fines</span>
              </div>
            </div>
          </section>
          
          {/* Dashboard Tabs */}
          <section className={styles.dashboardTabs}>
            <div className={styles.tabsHeader}>
              <button 
                className={`${styles.tabButton} ${activeTab === 'borrowed' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('borrowed')}
              >
                Borrowed
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'reserved' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('reserved')}
              >
                Reserved
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'fines' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('fines')}
              >
                Fines
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'favorites' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('favorites')}
              >
                Favorites
              </button>
            </div>
  
            <div className={styles.tabContent}>
              {/* Borrowed Books Tab */}
              {activeTab === 'borrowed' && (
                <div className={styles.booksGrid}>
                  {borrowedBooks.length > 0 ? (
                    borrowedBooks.map((book, index) => (
                      <div key={`borrowed-${book.id}-${index}`} className={styles.bookCard}>
                        <div className={styles.bookCoverThumb}>
                          {book.coverImage ? (
                            <Image 
                              src={book.coverImage} 
                              alt={book.title} 
                              width={40} 
                              height={60}
                              className={styles.coverImage}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = '/images/default-cover.jpg';
                              }}
                            />
                          ) : (
                            <div className={styles.noImageThumb}>
                              <span>No Cover</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.itemDetails}>
                          <h3 className={styles.itemTitle}>{book.title}</h3>
                          <p className={styles.itemAuthor}>{book.author}</p>
                          <div className={styles.bookMeta}>
                            <span className={`${styles.dueDate} ${book.status === 'overdue' ? styles.overdue : ''}`}>
                              {book.status === 'overdue' ? 'Overdue' : 'Due'}: {book.dueDate}
                            </span>
                            <span className={styles.renewals}>
                              Renewals: {book.renewals}/3
                            </span>
                          </div>
                          <div className={styles.bookActions}>
                            {book.renewable && (
                              <button 
                                className={styles.renewButton}
                                onClick={() => openRenewModal(book)}
                                disabled={isProcessing || (book.renewals ?? 0) >= 3}
                              >
                                <FiRefreshCw /> {(book.renewals ?? 0) >= 3 ? "Max Renewals" : "Renew"}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📚</div>
                      <h3>No borrowed books</h3>
                      <p>You don't have any books checked out at the moment.</p>
                      <Link href="/user/catalog" className={styles.browseButton}>
                        Browse Catalog
                      </Link>
                    </div>
                  )}
                </div>
              )}
              {/* Reserved Books Tab */}
              {activeTab === 'reserved' && (
                <div className={styles.booksGrid}>
                  {reservedBooks.length > 0 ? (
                    reservedBooks.map((book, index) => (
                      <div key={`reserved-${book.id}-${index}`} className={styles.bookCard}>
                        <div className={styles.bookCoverThumb}>
                          {book.coverImage ? (
                            <Image 
                              src={book.coverImage} 
                              alt={book.title} 
                              width={40} 
                              height={60}
                              className={styles.coverImage}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = '/images/default-cover.jpg';
                              }}
                            />
                          ) : (
                            <div className={styles.noImageThumb}>
                              <span>No Cover</span>
                            </div>
                          )}
                        </div>
                        <div className={styles.itemDetails}>
                          <h3 className={styles.itemTitle}>{book.title}</h3>
                          <p className={styles.itemAuthor}>{book.author}</p>
                          <div className={styles.bookStatus}>
                            <span className={styles.statusBadge}>Reserved</span>
                            {book.returnDate && (
                              <span className={styles.reserveDate}>
                                Reserved on: {typeof book.returnDate === 'string' 
                                  ? book.returnDate 
                                  : (book.returnDate && isFirestoreTimestamp(book.returnDate)
                                    ? book.returnDate.toDate().toLocaleDateString() 
                                    : new Date(book.returnDate).toLocaleDateString())}
                              </span>
                            )}
                            {book.pickupDate && (
                              <span className={styles.pickupDate}>
                                Pickup on: {typeof book.pickupDate === 'string' 
                                  ? book.pickupDate 
                                  : (book.pickupDate && isFirestoreTimestamp(book.pickupDate)
                                    ? book.pickupDate.toDate().toLocaleDateString() 
                                    : new Date(book.pickupDate).toLocaleDateString())}
                              </span>
                            )}
                          </div>
                          <div className={styles.bookActions}>
                            <button 
                              className={styles.cancelButton}
                              onClick={() => cancelReservation(book.id)}
                            >
                              Cancel Reservation
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>🔖</div>
                      <h3>No reserved books</h3>
                      <p>You don't have any books reserved at the moment.</p>
                      <Link href="/user/catalog" className={styles.browseButton}>
                        Browse Catalog
                      </Link>
                    </div>
                  )}
                </div>
              )}
  
              
              {/* Fines Tab */}
              {activeTab === 'fines' && (
                <div className={styles.finesContainer}>
                  <div className={styles.finesSummary}>
                    <h3 className={styles.finesTotal}>
                      Total Fines: <span>INR {fines.total.toFixed(2)}</span>
                    </h3>
                    {fines.total > 0 && (
                      <button 
                        className={styles.payButton}
                        onClick={payFines}
                      >
                        Pay Now
                      </button>
                    )}
                  </div>
                  
                  {fines.items.length > 0 ? (
                    <div className={styles.finesList}>
                      {fines.items.map((fine) => (
                        <div key={fine.id} className={styles.fineItem}>
                          <div className={styles.fineInfo}>
                            <h4>{fine.bookTitle}</h4>
                            <p>{fine.reason}</p>
                            <p className={styles.fineDate}>Date: {fine.date}</p>
                          </div>
                          <div className={styles.fineAmount}>
                            USD {fine.amount.toFixed(2)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>💰</div>
                      <h3>No fines</h3>
                      <p>You don't have any outstanding fines at the moment.</p>
                    </div>
                  )}
                </div>
              )}
  
              {/* Favorites Tab */}
              {activeTab === 'favorites' && (
                <div className={styles.booksGrid}>
                  {favoriteBooks.length > 0 ? (
                    favoriteBooks.map(book => {
                      // Check if book is already reserved
                      const isReserved = reservedBooks.some(reservedBook => reservedBook.id === book.id);
                      
                      return (
                        <div key={book.id} className={styles.bookCard}>
                          <div className={styles.bookCoverThumb}>
                            {book.coverImage ? (
                              <Image 
                                src={book.coverImage} 
                                alt={book.title} 
                                width={40} 
                                height={60}
                                className={styles.coverImage}
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.onerror = null;
                                  target.src = '/images/default-cover.jpg';
                                }}
                              />
                            ) : (
                              <div className={styles.noImageThumb}>
                                <span>No Cover</span>
                              </div>
                            )}
                          </div>
                          <div className={styles.itemDetails}>
                            <h3 className={styles.itemTitle}>{book.title}</h3>
                            <p className={styles.itemAuthor}>{book.author}</p>
                            {book.categories && book.categories.length > 0 && (
                              <div className={styles.bookCategories}>
                                {book.categories.slice(0, 2).map((category, index) => (
                                  <span key={index} className={styles.categoryTag}>
                                    {category}
                                  </span>
                                ))}
                                {book.categories.length > 2 && (
                                  <span className={styles.moreCategoriesTag}>
                                    +{book.categories.length - 2}
                                  </span>
                                )}
                              </div>
                            )}
                            <div className={styles.bookActions}>
                              {isReserved ? (
                                <button 
                                  className={styles.cancelButton}
                                  onClick={() => cancelReservation(book.id)}
                                >
                                  Cancel Reservation
                                </button>
                              ) : (
                                <button 
                                  className={styles.reserveButton}
                                  onClick={() => openReservationPopup(book)}
                                >
                                  Reserve
                                </button>
                              )}
                              <button 
                                className={styles.removeButton}
                                onClick={() => removeFromFavorites(book.id, book.title)}
                                >
                                  <FiHeart /> Remove
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className={styles.emptyState}>
                        <div className={styles.emptyIcon}>❤️</div>
                        <h3>No favorite books</h3>
                        <p>You haven't added any books to your favorites yet.</p>
                        <Link href="/user/catalog" className={styles.browseButton}>
                          Browse Catalog
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
            
            {/* Stock-Aware Recommendations Section */}
            <section className={styles.recommendationsSection}>
              <div className={styles.sectionHeader}>
                <h2>Books Available Now For You</h2>
                <p className={styles.sectionSubheader}>
                  Personalized recommendations from books currently in stock
                </p>
              </div>
            
              {isLoadingRecommendations ? (
                <div className={styles.loadingState}>
                  <div className={styles.loadingSpinner}></div>
                  <p>Finding perfect books for you...</p>
                </div>
              ) : (
                <div className={styles.booksGrid}>
                  {recommendedBooks.length > 0 ? (
                    recommendedBooks.map(book => (
                      <div key={book.id} className={styles.bookCard}>
                        <div className={styles.bookCoverThumb}>
                          {book.coverImage ? (
                            <Image 
                              src={book.coverImage} 
                              alt={book.title} 
                              width={40} 
                              height={60}
                              className={styles.coverImage}
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = '/images/default-cover.jpg';
                              }}
                            />
                          ) : (
                            <div className={styles.noImageThumb}>
                              <span>No Cover</span>
                            </div>
                          )}
                          <div className={styles.stockBadge}>
                            {book.availableCopies} of {book.totalCopies} available
                          </div>
                        </div>
                        <div className={styles.itemDetails}>
                          <h3 className={styles.itemTitle}>{book.title}</h3>
                          <p className={styles.itemAuthor}>{book.author}</p>
                          {book.reason && (
                            <p className={styles.recommendReason}>
                              <span className={styles.reasonIcon}>💡</span> 
                              {book.reason}
                            </p>
                          )}
                          {/* In the recommendedBooks.map section, modify the Save button to show state */}
<div className={styles.bookActions}>
  <button 
    className={styles.reserveButton}
    onClick={() => openReservationPopup(book)}
  >
    Reserve Now
  </button>
  {/* Improved Save button with state */}
  {favoriteBooks.some(fav => fav.id === book.id) ? (
    <button 
      className={`${styles.favoriteButton} ${styles.favorited}`}
      onClick={() => removeFromFavorites(book.id, book.title)}
    >
      <FiHeart style={{fill: '#ef4444', color: '#ef4444'}} /> Saved
    </button>
  ) : (
    <button 
      className={styles.favoriteButton}
      onClick={() => addToFavorites(book)}
    >
      <FiHeart /> Save
    </button>
  )}
</div>

                        </div>
                      </div>
                    ))
                  ) : (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>✨</div>
                      <h3>No available recommendations</h3>
                      <p>We couldn't find books matching your preferences that are currently in stock.</p>
                      <Link href="/user/catalog" className={styles.browseButton}>
                        Browse Catalog
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </section>
  
            {/* Renewal Modal */}
            {showRenewModal && selectedBook && (
              <div className={styles.popupOverlay}>
                <div className={styles.popupContainer}>
                  <div className={styles.popupHeader}>
                    <h3>Renew Book</h3>
                    <button 
                      className={styles.closePopup}
                      onClick={() => setShowRenewModal(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className={styles.popupContent}>
                    <div className={styles.popupBookDetails}>
                      <h4>{selectedBook.title}</h4>
                      <p>by {selectedBook.author}</p>
                    </div>
                    
                    <div className={styles.renewalInfo}>
                      <p>Current due date: {selectedBook.dueDate}</p>
                      <p>Renewals used: {selectedBook.renewals}/3</p>
                      {selectedBook.renewals === 2 ? (
                        <p>You can extend the due date by up to 5 days from the current due date.</p>
                      ) : (
                        <p>You can extend the due date by up to 10 days from the current due date.</p>
                      )}
                    </div>
                    
                    <div className={styles.datePickerContainer}>
                      <label>New Due Date:</label>
                      <input 
                        type="date" 
                        value={newDueDate ? newDueDate.toISOString().split('T')[0] : ''}
                        onChange={(e) => setNewDueDate(new Date(e.target.value))}
                        min={selectedBook.dueDate}
                        max={maxRenewalDate ? maxRenewalDate.toISOString().split('T')[0] : ''}
                        className={styles.dateInput}
                        required
                      />
                    </div>
                    
                    <div className={styles.popupActions}>
                      <button 
                        className={styles.cancelPopupButton}
                        onClick={() => setShowRenewModal(false)}
                      >
                        Cancel
                      </button>
                      <button 
                        className={styles.confirmButton}
                        onClick={renewBook}
                        disabled={isProcessing || !newDueDate}
                      >
                        {isProcessing ? "Processing..." : "Confirm Renewal"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
  
            {/* Reservation Popup */}
            {showReservationPopup && selectedBookForReservation && (
              <div className={styles.popupOverlay}>
                <div className={styles.popupContainer}>
                  <div className={styles.popupHeader}>
                    <h3>Reserve Book</h3>
                    <button 
                      className={styles.closePopup}
                      onClick={() => setShowReservationPopup(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className={styles.popupContent}>
                    <div className={styles.popupBookDetails}>
                      <h4>{selectedBookForReservation.title}</h4>
                      <p>by {selectedBookForReservation.author}</p>
                  </div>
                  <div className={styles.pickupDateSelector}>
                    <label htmlFor="pickupDate">Choose a pickup date:</label>
                    <input 
                      type="date" 
                      id="pickupDate"
                      className={styles.dateInput}
                      value={pickupDate}
                      onChange={(e) => setPickupDate(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      required
                    />
                  </div>
                  <div className={styles.popupActions}>
                    <button 
                      className={styles.cancelPopupButton}
                      onClick={() => setShowReservationPopup(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      className={styles.confirmButton}
                      onClick={confirmReservation}
                      disabled={!pickupDate}
                    >
                      Confirm Reservation
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    );
}

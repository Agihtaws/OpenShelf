"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './dashboard.module.css';
import { auth, signOut, db } from '../../../firebaseConfig';
import { FiUser, FiCheckCircle, FiCalendar, FiClock, FiRefreshCw, FiBookOpen, FiAlertTriangle, FiMail, FiPlus } from 'react-icons/fi';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { 
  collection, 
  query, 
  orderBy, 
  limit, 
  getDocs, 
  where, 
  getCountFromServer, 
  Timestamp, 
  doc, 
  getDoc, 
  updateDoc, 
  addDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// This would be replaced with actual authentication logic
const checkLibrarianAuth = () => {
  // In a real app, this would verify the librarian's authentication status
  const token = localStorage.getItem('librarian_token');
  return !!token;
};

export default function LibrarianDashboard() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Stats counts
  const [newArrivalsCount, setNewArrivalsCount] = useState(0);
  const [stocksCount, setStocksCount] = useState(0);
  const [checkoutsCount, setCheckoutsCount] = useState(0);
  const [returnsCount, setReturnsCount] = useState(0);
  
  const [circulationPeriod, setCirculationPeriod] = useState('weekly');
  const [circulationMetric, setCirculationMetric] = useState('borrowed');
  interface CirculationData {
    time: string;
    value: number;
    date: Date;
  }
  
  const [circulationData, setCirculationData] = useState<CirculationData[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(true);
  
  // Real hold requests data
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
      firstName?: string;
      lastName?: string;
      libraryCardId?: string;
      email?: string;
    };
    pickupBy?: Date;
    formattedPickupDate?: string;
  }
  
  // Checkout interface
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

  interface RecentPatron {
    id: string;
    firstName: string;
    lastName: string;
    libraryCardId: string;
    email: string;
    createdAt: Date;
  }
  
  const [realHoldRequests, setRealHoldRequests] = useState<HoldRequest[]>([]);
  const [recentCheckouts, setRecentCheckouts] = useState<Checkout[]>([]);
  const [recentPatrons, setRecentPatrons] = useState<RecentPatron[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Confirmation popup states
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<HoldRequest | null>(null);
  
  // Return confirmation states
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [checkoutToReturn, setCheckoutToReturn] = useState<Checkout | null>(null);
  
  // Renewal modal states
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<Checkout | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [maxRenewalDate, setMaxRenewalDate] = useState<Date | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Format date function for consistent date formatting
  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Add this function to fetch circulation data
  const fetchCirculationData = async (period: 'daily' | 'weekly' | 'monthly' | 'yearly', metric: 'borrowed' | 'returned' | 'reserved' | 'patrons') => {
    setIsChartLoading(true);
    try {
      // Define the collection and time range based on the period
      let startDate = new Date();
      let timeField = '';
      let timeFormat = '';
      let groupBy = '';
      
      switch(period) {
        case 'daily':
          // Last 24 hours with hourly data points
          startDate.setHours(startDate.getHours() - 24);
          timeField = 'hour';
          timeFormat = 'ha'; // 1PM, 2PM, etc.
          groupBy = 'hour';
          break;
        case 'weekly':
          // Last 7 days with daily data points
          startDate.setDate(startDate.getDate() - 7);
          timeField = 'day';
          timeFormat = 'MMM d'; // Jan 1, Jan 2, etc.
          groupBy = 'day';
          break;
        case 'monthly':
          // Last 30 days with daily data points
          startDate.setDate(startDate.getDate() - 30);
          timeField = 'day';
          timeFormat = 'MMM d'; // Jan 1, Jan 2, etc.
          groupBy = 'day';
          break;
        case 'yearly':
          // Last 12 months with monthly data points
          startDate.setFullYear(startDate.getFullYear() - 1);
          timeField = 'month';
          timeFormat = 'MMM yyyy'; // Jan 2025, Feb 2025, etc.
          groupBy = 'month';
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
          timeField = 'day';
          timeFormat = 'MMM d';
          groupBy = 'day';
      }

      const startTimestamp = Timestamp.fromDate(startDate);

      // Determine which collection to query based on the metric
      let collectionName = '';
      let fieldName = '';
      
      switch(metric) {
        case 'borrowed':
          collectionName = 'borrows';
          fieldName = 'borrowedAt';
          break;
        case 'returned':
          collectionName = 'borrows';
          fieldName = 'returnDate';
          break;
        case 'reserved':
          collectionName = 'reserves';
          fieldName = 'reservedAt';
          break;
        case 'patrons':
          collectionName = 'users_customer';
          fieldName = 'createdAt';
          break;
        default:
          collectionName = 'borrows';
          fieldName = 'borrowedAt';
      }

      // Query the appropriate collection
      const dataQuery = query(
        collection(db, collectionName),
        where(fieldName, ">=", startTimestamp),
        orderBy(fieldName, "asc")
      );

      const querySnapshot = await getDocs(dataQuery);
      
      // Process the data to group by the appropriate time unit
      const dataByTime: Record<string, number> = {};
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const timestamp = data[fieldName]?.toDate ? data[fieldName].toDate() : new Date(data[fieldName]);
        
        let timeKey = '';
        
        switch(groupBy) {
          case 'hour':
            timeKey = new Date(
              timestamp.getFullYear(),
              timestamp.getMonth(),
              timestamp.getDate(),
              timestamp.getHours()
            ).toISOString();
            break;
          case 'day':
            timeKey = new Date(
              timestamp.getFullYear(),
              timestamp.getMonth(),
              timestamp.getDate()
            ).toISOString();
            break;
          case 'month':
            timeKey = new Date(
              timestamp.getFullYear(),
              timestamp.getMonth(),
              1
            ).toISOString();
            break;
          default:
            timeKey = new Date(
              timestamp.getFullYear(),
              timestamp.getMonth(),
              timestamp.getDate()
            ).toISOString();
        }
        
        if (!dataByTime[timeKey]) {
          dataByTime[timeKey] = 0;
        }
        
        dataByTime[timeKey]++;
      });
      
      // Convert to the format expected by Recharts
      const chartData = Object.keys(dataByTime).map(timeKey => {
        const date = new Date(timeKey);
        let formattedTime = '';
        
        switch(timeFormat) {
          case 'ha':
            formattedTime = date.getHours() + (date.getHours() >= 12 ? 'PM' : 'AM');
            break;
          case 'MMM d':
            formattedTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            break;
          case 'MMM yyyy':
            formattedTime = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            break;
          default:
            formattedTime = date.toLocaleDateString();
        }
        
        return {
          time: formattedTime,
          value: dataByTime[timeKey],
          date: date // Keep the original date for sorting
        };
      });
      
      // Sort by date
      chartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setCirculationData(chartData);
    } catch (error) {
      console.error('Error fetching circulation data:', error);
      setCirculationData([]);
    } finally {
      setIsChartLoading(false);
    }
  };

  // Add this to your existing useEffect or create a new one
  useEffect(() => {
    fetchCirculationData(circulationPeriod, circulationMetric);
  }, [circulationPeriod, circulationMetric]);
  
  // Format time ago function
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
      return formatDate(date);
    }
  };

  // Function to show confirmation popup
  const handlePickupConfirmation = (reservation: HoldRequest) => {
    setSelectedReservation(reservation);
    setShowConfirmation(true);
  };
  
  // Function to fetch recent patrons
  const fetchRecentPatrons = async () => {
    try {
      // Get the 5 most recently added patrons
      const patronsQuery = query(
        collection(db, "users_customer"),
        orderBy("createdAt", "desc"),
        limit(5)
      );
      
      const querySnapshot = await getDocs(patronsQuery);
      const patronsData: RecentPatron[] = [];
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Convert Firestore timestamp to Date
        const createdAt = data.createdAt?.toDate ? 
          data.createdAt.toDate() : 
          data.createdAt ? new Date(data.createdAt) : new Date();
        
        patronsData.push({
          id: doc.id,
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          libraryCardId: data.libraryCardId || '',
          email: data.email || '',
          createdAt
        });
      });
      
      setRecentPatrons(patronsData);
    } catch (error) {
      console.error("Error fetching recent patrons:", error);
    }
  };
  
  // The actual pickup function that runs after confirmation
  const handleMarkAsPickedUp = async () => {
    try {
      if (!selectedReservation) return;
      
      const reservation = selectedReservation;
      
      // Fetch the book document to get the number of copies
      if (!reservation.bookId) {
        console.error("Book ID is undefined.");
        return;
      }
      const bookDocRef = doc(db, "books", reservation.bookId);
      const bookDoc = await getDoc(bookDocRef);
      
      if (!bookDoc.exists()) {
        console.error("Book not found.");
        return;
      }
      
      const bookData = bookDoc.data();
      const availableCopies = bookData.copies || 0;
      
      // Check if there are available copies
      if (availableCopies <= 0) {
        console.error("No copies available for checkout.");
        return;
      }

      // Update reservation status
      await updateDoc(doc(db, "reserves", reservation.id), {
        status: "picked-up"
      });

      // Calculate the due date (14 days from today)
      const borrowedDate = new Date();
      const dueDate = new Date(borrowedDate);
      dueDate.setDate(borrowedDate.getDate() + 14);

      // Save checkout details to the "borrows" collection
      await addDoc(collection(db, "borrows"), {
        userId: reservation.userId,
        bookId: reservation.bookId,
        borrowedAt: serverTimestamp(),
        dueDate: dueDate, // Use calculated due date (14 days from now)
        status: 'borrowed',
        renewals: 0
      });
      
      // Update book status and copies
      await updateDoc(bookDocRef, {
        copies: availableCopies - 1,
        status: availableCopies - 1 > 0 ? 'Available' : 'On Loan'
      });
      
      // Update local state to remove the picked up item
      setRealHoldRequests(prevHolds => 
        prevHolds.filter(hold => hold.id !== reservation.id)
      );
      
      // Increment checkouts count
      setCheckoutsCount(prev => prev + 1);
      
      // Show success message
      setSuccessMessage(`Marked "${reservation.book?.title}" as picked up by ${reservation.user?.firstName} ${reservation.user?.lastName}.`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
      // Close the confirmation popup
      setShowConfirmation(false);
      setSelectedReservation(null);
    } catch (error) {
      console.error("Error updating reservation:", error);
      setShowConfirmation(false);
    }
  };

  // Function to check for expired reservations
  const checkExpiredReservations = () => {
    const today = new Date();
    
    // Filter out expired reservations
    const updatedReservations = realHoldRequests.filter(reservation => {
      const pickupDate = new Date(reservation.pickupBy);
      return pickupDate >= today;
    });
    
    // Update state if any reservations were removed
    if (updatedReservations.length !== realHoldRequests.length) {
      setRealHoldRequests(updatedReservations);
    }
  };

  // Open return confirmation modal
  const openReturnConfirmation = (checkout: Checkout) => {
    setCheckoutToReturn(checkout);
    setShowReturnConfirm(true);
  };

  // Dismiss return confirmation
  const dismissReturnConfirm = () => {
    setShowReturnConfirm(false);
    setCheckoutToReturn(null);
  };

  // Confirm return action
  const confirmReturn = async () => {
    if (!checkoutToReturn) return;
    
    try {
      setIsProcessing(true);
      
      // Update checkout status
      await updateDoc(doc(db, "borrows", checkoutToReturn.id), {
        status: "returned",
        returnDate: serverTimestamp()
      });
      
      // Update book status if needed
      if (checkoutToReturn.bookId) {
        const bookRef = doc(db, "books", checkoutToReturn.bookId);
        const bookDoc = await getDoc(bookRef);
        
        if (bookDoc.exists()) {
          const bookData = bookDoc.data();
          const currentCopies = bookData.copies || 0;
          
          await updateDoc(bookRef, {
            copies: currentCopies + (checkoutToReturn.quantity || 1),
            status: (currentCopies + (checkoutToReturn.quantity || 1) > 0) ? 'Available' : bookData.status
          });
        }
      }
      
      // Add activity log
      await addDoc(collection(db, "activity_logs"), {
        userId: checkoutToReturn.userId,
        userEmail: checkoutToReturn.user?.email || "Unknown",
        userLibraryId: checkoutToReturn.user?.libraryCardId || "Unknown",
        bookId: checkoutToReturn.bookId,
        bookTitle: checkoutToReturn.book?.title || "Unknown Book",
        actionType: "return",
        timestamp: serverTimestamp(),
        performedBy: "librarian",
        details: {
          borrowedDate: formatDate(checkoutToReturn.borrowedAt),
          dueDate: formatDate(checkoutToReturn.dueDate),
          returnDate: formatDate(new Date()),
          renewalCount: checkoutToReturn.renewals
        }
      });
      
      // Update local state
      const returnDate = new Date();
      setRecentCheckouts(prevCheckouts => 
        prevCheckouts.map(c => 
          c.id === checkoutToReturn.id ? { ...c, status: 'returned', returnDate } : c
        )
      );
      
      setSuccessMessage(`Marked "${checkoutToReturn.book?.title}" as returned by ${checkoutToReturn.user?.firstName} ${checkoutToReturn.user?.lastName}.`);
      
      // Close confirmation popup
      setShowReturnConfirm(false);
      setCheckoutToReturn(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error updating checkout:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Open renewal modal
  const openRenewModal = (checkout: Checkout) => {
    // Check if checkout has already been renewed 3 times
    if (checkout.renewals >= 3) {
      setSuccessMessage("This book cannot be renewed more than 3 times.");
      setTimeout(() => setSuccessMessage(''), 3000);
      return;
    }
    
    // Calculate max renewal date based on renewal count
    const maxDate = new Date(checkout.dueDate);
    if (checkout.renewals === 2) {
      // Third renewal - only allow 5 days extension
      maxDate.setDate(maxDate.getDate() + 5);
    } else {
      // First and second renewals - allow 10 days extension
      maxDate.setDate(maxDate.getDate() + 10);
    }
    
    setSelectedCheckout(checkout);
    setNewDueDate(maxDate); // Default to max date
    setMaxRenewalDate(maxDate);
    setShowRenewModal(true);
  };
  
  // Confirm renewal with selected date
  const confirmRenewal = async () => {
    try {
      if (!selectedCheckout || !newDueDate) return;
      
      setIsProcessing(true);
      
      // Update checkout status
      await updateDoc(doc(db, "borrows", selectedCheckout.id), {
        status: "borrowed",
        dueDate: newDueDate,
        renewals: selectedCheckout.renewals + 1
      });
      
      // Add activity log
      await addDoc(collection(db, "activity_logs"), {
        userId: selectedCheckout.userId,
        userEmail: selectedCheckout.user?.email || "Unknown",
        userLibraryId: selectedCheckout.user?.libraryCardId || "Unknown",
        bookId: selectedCheckout.bookId,
        bookTitle: selectedCheckout.book?.title || "Unknown Book",
        actionType: "renew",
        timestamp: serverTimestamp(),
        performedBy: "librarian",
        details: {
          previousDueDate: formatDate(selectedCheckout.dueDate),
          newDueDate: formatDate(newDueDate),
          renewalCount: selectedCheckout.renewals + 1
        }
      });
      
      // Update local state
      setRecentCheckouts(prevCheckouts => 
        prevCheckouts.map(c => 
          c.id === selectedCheckout.id ? { 
            ...c, 
            status: 'borrowed', 
            dueDate: newDueDate,
            renewals: c.renewals + 1
          } : c
        )
      );
      
      setSuccessMessage(`Renewed "${selectedCheckout.book?.title}" for ${selectedCheckout.user?.firstName} ${selectedCheckout.user?.lastName} until ${formatDate(newDueDate)}.`);
      
      // Close modal and reset
      setShowRenewModal(false);
      setSelectedCheckout(null);
      setNewDueDate(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error renewing checkout:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  // Add this to check for expired reservations
  useEffect(() => {
    // Check for expired reservations when component mounts
    checkExpiredReservations();
    
    // Set up interval to check for expired reservations every hour
    const intervalId = setInterval(checkExpiredReservations, 60 * 60 * 1000);
    
    // Clean up the interval when component unmounts
    return () => clearInterval(intervalId);
  }, [realHoldRequests]);

  useEffect(() => {
    // Check authentication when component mounts
    const authenticated = checkLibrarianAuth();
    setIsAuthenticated(authenticated);
    
    // If not authenticated, redirect to login
    if (!authenticated && !isLoading) {
      window.location.href = '/auth/login';
    }
    
    // This is for demo purposes only
    // In a real app, you would set up proper authentication
    if (!authenticated) {
      // For demo, we'll set a token to simulate authentication
      localStorage.setItem('librarian_token', 'demo_token');
      setIsAuthenticated(true);
    }

    // Fetch dashboard data
    const fetchDashboardData = async () => {
      try {
        // Get today's date at midnight
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);
        
        // Fetch new arrivals count - books added today
        const newArrivalsQuery = query(
          collection(db, "books"),
          where("addedAt", ">=", todayTimestamp)
        );
        const newArrivalsSnapshot = await getCountFromServer(newArrivalsQuery);
        setNewArrivalsCount(newArrivalsSnapshot.data().count);

        // Fetch total stocks count - only count books with copies > 0
        const stocksQuery = query(
          collection(db, "books"),
          where("copies", ">", 0)
        );
        const stocksCountSnapshot = await getCountFromServer(stocksQuery);
        setStocksCount(stocksCountSnapshot.data().count);

        // Fetch checkouts count - books currently borrowed (not returned)
        const checkoutsQuery = query(
          collection(db, "borrows"),
          where("status", "in", ["borrowed", "overdue"])
        );
        const checkoutsSnapshot = await getCountFromServer(checkoutsQuery);
        setCheckoutsCount(checkoutsSnapshot.data().count);

        // Fetch returns count - books returned today
        const returnsQuery = query(
          collection(db, "borrows"),
          where("status", "==", "returned")
        );
        const returnsSnapshot = await getCountFromServer(returnsQuery);
        setReturnsCount(returnsSnapshot.data().count);

        // Fetch recent hold requests (from the last 7 days)
        const fetchRecentHoldRequests = async () => {
          try {
            // Get date from 7 days ago
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);
            
            // Create a query to get only the 3 most recently reserved books
            const reservationsQuery = query(
              collection(db, "reserves"),
              where("status", "==", "reserved"),
              where("reservedAt", ">=", sevenDaysAgoTimestamp),
              orderBy("reservedAt", "desc"),
              limit(3) // Changed from 5 to 3
            );
            
            const querySnapshot = await getDocs(reservationsQuery);
            const reservationsData = [];
            
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
              let userData = null;
              const userDoc = await getDoc(userDocRef);
              if (userDoc.exists()) {
                userData = {
                  id: userDoc.id,
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
                book: bookData ? {
                  title: bookData.title || undefined,
                  author: bookData.author || undefined,
                  isbn: bookData.isbn || undefined,
                  coverImage: bookData.coverImage || undefined,
                } : undefined,
                user: userData
              });
            }
            
            setRealHoldRequests(reservationsData);
          } catch (error) {
            console.error("Error fetching hold requests:", error);
          }
        };

        // Fetch recent checkouts
        const fetchRecentCheckouts = async () => {
          try {
            // Create a query to get the 3 most recent checkouts
            const checkoutsQuery = query(
              collection(db, "borrows"),
              where("status", "in", ["borrowed", "overdue"]),
              orderBy("borrowedAt", "desc"),
              limit(3)
            );
            
            const querySnapshot = await getDocs(checkoutsQuery);
            const checkoutsData = [];
            
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
                  id: userDoc.id,
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
              const today = new Date();
              let status = checkoutData.status;
              if (status === 'borrowed' && dueDate < today) {
                status = 'overdue';
              }
              
                            // Add to checkouts list
                            checkoutsData.push({
                                id: checkoutDoc.id,
                                ...checkoutData,
                                borrowedAt: borrowedDate,
                                dueDate: dueDate,
                                status: status,
                                book: bookData,
                                user: userData
                              });
                            }
                            
                            setRecentCheckouts(checkoutsData);
                          } catch (error) {
                            console.error("Error fetching recent checkouts:", error);
                          }
                        };
                
                        // Call the functions to fetch data
                        await fetchRecentHoldRequests();
                        await fetchRecentCheckouts();
                        await fetchRecentPatrons(); // Add this line to fetch recent patrons
                
                        setIsLoading(false);
                      } catch (error) {
                        console.error("Error fetching dashboard data:", error);
                        // Set default values if fetching fails
                        setNewArrivalsCount(0);
                        setStocksCount(0);
                        setCheckoutsCount(0);
                        setReturnsCount(0);
                        setIsLoading(false);
                      }
                    };
                
                    fetchDashboardData();
                  }, [isLoading]);
                  
                  // Calculate days remaining or overdue
                  const getDaysStatus = (checkout: Checkout): { text: string, className: string } => {
                    if (checkout.status === 'returned') {
                      return { 
                        text: `Returned ${checkout.returnDate ? formatDate(checkout.returnDate) : ''}`,
                        className: styles.returned 
                      };
                    }
                    
                    const today = new Date();
                    const dueDate = checkout.dueDate;
                    const diffTime = dueDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0) {
                      return { 
                        text: `Overdue by ${Math.abs(diffDays)} days`,
                        className: styles.overdue 
                      };
                    } else if (diffDays === 0) {
                      return { 
                        text: 'Due today',
                        className: styles.dueToday 
                      };
                    } else if (diffDays <= 3) {
                      return { 
                        text: `Due in ${diffDays} days`,
                        className: styles.dueSoon 
                      };
                    } else {
                      return { 
                        text: `Due in ${diffDays} days`,
                        className: styles.dueNormal 
                      };
                    }
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
                    <div className={styles.dashboardContent}>
                      {/* Stats Cards */}
                      <section className={styles.statsSection}>
                        <div className={styles.statsGrid}>
                          <div className={styles.statCard}>
                            <div className={styles.statIcon}>📚</div>
                            <div className={styles.statInfo}>
                              <h3 className={styles.statValue}>{newArrivalsCount}</h3>
                              <p className={styles.statLabel}>New Arrivals</p>
                            </div>
                          </div>
                          <div className={styles.statCard}>
                            <div className={styles.statIcon}>📋</div>
                            <div className={styles.statInfo}>
                              <h3 className={styles.statValue}>{stocksCount}</h3>
                              <p className={styles.statLabel}>Stocks</p>
                            </div>
                          </div>
                          <div className={styles.statCard}>
                            <div className={styles.statIcon}>📤</div>
                            <div className={styles.statInfo}>
                              <h3 className={styles.statValue}>{checkoutsCount}</h3>
                              <p className={styles.statLabel}>Checkouts</p>
                            </div>
                          </div>
                          <div className={styles.statCard}>
                            <div className={styles.statIcon}>📥</div>
                            <div className={styles.statInfo}>
                              <h3 className={styles.statValue}>{returnsCount}</h3>
                              <p className={styles.statLabel}>Returns</p>
                            </div>
                          </div>
                        </div>
                      </section>
                
                      {/* Main Dashboard Sections */}
                      <div className={styles.dashboardGrid}>
                        {/* Recent Checkouts Section */}
                        <section className={styles.dueSoonSection}>
                          <div className={styles.sectionCard}>
                            <div className={styles.cardHeader}>
                              <h2 className={styles.cardTitle}>Recent Checkouts</h2>
                              <Link href="/librarian/checkouts" className={styles.viewAllLink}>
                                View All
                              </Link>
                            </div>
                            
                            <div className={styles.dueSoonList}>
                              {recentCheckouts.length > 0 ? (
                                recentCheckouts.map((checkout) => {
                                  const daysStatus = getDaysStatus(checkout);
                                  
                                  return (
                                    <div key={checkout.id} className={styles.dueSoonItem}>
                                      <div className={styles.bookCoverThumb}>
                                        {checkout.book?.coverImage ? (
                                          <Image 
                                            src={checkout.book.coverImage} 
                                            alt={checkout.book?.title}
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
                                        <p className={styles.itemDueDate}>
                                          <FiCalendar size={14} style={{ marginRight: '4px' }} />
                                          <strong>Due:</strong> {formatDate(checkout.dueDate)}
                                          {checkout.renewals > 0 && (
                                            <span className={styles.renewalsBadge}>
                                              <FiRefreshCw size={12} /> {checkout.renewals}x
                                            </span>
                                          )}
                                        </p>
                                      </div>
                                      
                                      <div className={styles.itemActions}>
                                        <div className={styles.statusBadge + ' ' + daysStatus.className}>
                                          {daysStatus.text}
                                        </div>
                                        <div className={styles.actionButtons}>
                                          <button 
                                            className={styles.returnButton}
                                            onClick={() => openReturnConfirmation(checkout)}
                                            disabled={checkout.status === 'returned' || isProcessing}
                                          >
                                            <FiCheckCircle size={14} /> Return
                                          </button>
                                          <button 
                                            className={styles.renewButton}
                                            onClick={() => openRenewModal(checkout)}
                                            disabled={checkout.renewals >= 3 || checkout.status === 'returned' || isProcessing}
                                          >
                                            <FiRefreshCw size={14} /> Renew
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })
                              ) : (
                                <div className={styles.noCheckouts}>
                                  <p>No current checkouts.</p>
                                </div>
                              )}
                            </div>
                            <div className={styles.cardFooter}>
                              <Link href="/librarian/checkouts" className={styles.sendRemindersButton}>
                                Manage Checkouts
                              </Link>
                            </div>
                          </div>
                        </section>
                
                        {/* Hold Requests Section */}
                        <section className={styles.holdsSection}>
                          <div className={styles.sectionCard}>
                            <div className={styles.cardHeader}>
                              <h2 className={styles.cardTitle}>Hold Requests</h2>
                              <Link href="/librarian/reserved" className={styles.viewAllLink}>
                                View All
                              </Link>
                            </div>
                            
                            {successMessage && <div className={styles.successMessage}>{successMessage}</div>}
                            
                            <div className={styles.holdsList}>
                              {realHoldRequests.length > 0 ? (
                                realHoldRequests.map((hold) => (
                                  <div key={hold.id} className={styles.holdItem}>
                                    <div className={styles.bookCoverThumb}>
                                      {hold.book?.coverImage ? (
                                        <Image 
                                          src={hold.book.coverImage} 
                                          alt={hold.book?.title}
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
                                    
                                    <div className={styles.itemActions}>
                                      <button 
                                        className={styles.pickupButton}
                                        onClick={() => handlePickupConfirmation(hold)}
                                      >
                                        <FiCheckCircle /> Picked Up
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className={styles.noHolds}>
                                  <p>No current hold requests.</p>
                                </div>
                              )}
                            </div>
                            <div className={styles.cardFooter}>
                              <Link href="/librarian/reserved" className={styles.processHoldsButton}>
                                Process All Holds
                              </Link>
                            </div>
                          </div>
                        </section>
                
                        {/* Recent Patrons Section */}
                        <section className={styles.patronActivitySection}>
                          <div className={styles.sectionCard}>
                            <div className={styles.cardHeader}>
                              <h2 className={styles.cardTitle}>Recently Added Patrons</h2>
                              <Link href="/librarian/patrons" className={styles.viewAllLink}>
                                View All
                              </Link>
                            </div>
                            <div className={styles.recentPatronsList}>
                              {recentPatrons.length > 0 ? (
                                recentPatrons.map((patron) => (
                                  <div key={patron.id} className={styles.recentPatronItem}>
                                    <div className={styles.patronAvatar}>
                                      {patron.firstName.charAt(0)}{patron.lastName.charAt(0)}
                                    </div>
                                    <div className={styles.patronDetails}>
                                      <div className={styles.patronNameRow}>
                                        <span className={styles.patronName}>
                                          {patron.firstName} {patron.lastName}
                                        </span>
                                        <span className={styles.patronCardId}>
                                          {patron.libraryCardId}
                                        </span>
                                      </div>
                                      <div className={styles.patronEmail}>
                                        <FiMail size={12} style={{ marginRight: '4px' }} />
                                        {patron.email}
                                      </div>
                                    </div>
                                    <div className={styles.patronAddedTime}>
                                      {formatTimeAgo(patron.createdAt)}
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className={styles.noPatrons}>
                                  <p>No patrons found.</p>
                                </div>
                              )}
                            </div>
                            <div className={styles.cardFooter}>
                              <Link href="/librarian/add-patron" className={styles.addPatronButton}>
                                <FiPlus /> Add New Patron
                              </Link>
                            </div>
                          </div>
                        </section>
                
                        {/* Circulation Activity */}
                        <section className={styles.circulationStatsSection}>
                          <div className={styles.sectionCard}>
                            <div className={styles.cardHeader}>
                              <h2 className={styles.cardTitle}>Circulation Activity</h2>
                              <select 
                                className={styles.periodSelect}
                                value={circulationPeriod}
                                onChange={(e) => setCirculationPeriod(e.target.value)}
                              >
                                <option value="daily">Today</option>
                                <option value="weekly">Last 7 Days</option>
                                <option value="monthly">Last 30 Days</option>
                                <option value="yearly">Last 12 Months</option>
                              </select>
                            </div>
                            
                            <div className={styles.chartContainer}>
                              {isChartLoading ? (
                                <div className={styles.chartLoading}>
                                  <div className={styles.loadingSpinner}></div>
                                  <p>Loading chart data...</p>
                                </div>
                              ) : circulationData.length > 0 ? (
                                <ResponsiveContainer width="100%" height={300}>
                                  <AreaChart
                                    data={circulationData}
                                    margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                                  >
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis dataKey="time" />
                                    <YAxis />
                                    <Tooltip 
                                      formatter={(value) => [`${value} ${circulationMetric === 'patrons' ? 'patrons' : 'items'}`, circulationMetric === 'patrons' ? 'Patrons Added' : circulationMetric.charAt(0).toUpperCase() + circulationMetric.slice(1)]}
                                      labelFormatter={(label) => `Time: ${label}`}
                                    />
                                    <Area 
                                      type="monotone" 
                                      dataKey="value" 
                                      name={circulationMetric === 'patrons' ? 'Patrons Added' : circulationMetric.charAt(0).toUpperCase() + circulationMetric.slice(1)} 
                                      stroke={
                                        circulationMetric === 'borrowed' ? '#4263eb' : 
                                        circulationMetric === 'returned' ? '#40c057' :
                                        circulationMetric === 'reserved' ? '#fd7e14' : 
                                        '#7048e8'
                                      } 
                                      fill={
                                        circulationMetric === 'borrowed' ? 'rgba(66, 99, 235, 0.2)' : 
                                        circulationMetric === 'returned' ? 'rgba(64, 192, 87, 0.2)' :
                                        circulationMetric === 'reserved' ? 'rgba(253, 126, 20, 0.2)' : 
                                        'rgba(112, 72, 232, 0.2)'
                                      } 
                                    />
                                  </AreaChart>
                                </ResponsiveContainer>
                              ) : (
                                <div className={styles.noChartData}>
                                  <p>No data available for the selected period and metric.</p>
                                </div>
                              )}
                            </div>
                            
                            <div className={styles.metricSelectors}>
                              <button 
                                className={`${styles.metricButton} ${circulationMetric === 'borrowed' ? styles.active : ''}`}
                                onClick={() => setCirculationMetric('borrowed')}
                              >
                                <span className={styles.metricDot} style={{ backgroundColor: '#4263eb' }}></span>
                                Borrowed
                              </button>
                              <button 
                                className={`${styles.metricButton} ${circulationMetric === 'returned' ? styles.active : ''}`}
                                onClick={() => setCirculationMetric('returned')}
                              >
                                <span className={styles.metricDot} style={{ backgroundColor: '#40c057' }}></span>
                                Returned
                              </button>
                              <button 
                                className={`${styles.metricButton} ${circulationMetric === 'reserved' ? styles.active : ''}`}
                                onClick={() => setCirculationMetric('reserved')}
                              >
                                <span className={styles.metricDot} style={{ backgroundColor: '#fd7e14' }}></span>
                                Reserved
                              </button>
                              <button 
                                className={`${styles.metricButton} ${circulationMetric === 'patrons' ? styles.active : ''}`}
                                onClick={() => setCirculationMetric('patrons')}
                              >
                                <span className={styles.metricDot} style={{ backgroundColor: '#7048e8' }}></span>
                                Patrons Added
                              </button>
                            </div>
                          </div>
                        </section>
                      </div>
                
                      {/* Confirmation Popup for Hold Pickup */}
                      {showConfirmation && (
                        <div className={styles.confirmationOverlay}>
                          <div className={styles.confirmationPopup}>
                            <h3 className={styles.confirmationTitle}>Confirm Pickup</h3>
                            {selectedReservation && (
                              <p className={styles.confirmationMessage}>
                                Are you sure you want to mark "{selectedReservation.book?.title}" as picked up by {selectedReservation.user?.firstName} {selectedReservation.user?.lastName}?
                              </p>
                            )}
                            <div className={styles.confirmationButtons}>
                              <button 
                                className={styles.confirmButton}
                                onClick={handleMarkAsPickedUp}
                              >
                                Yes, Confirm Pickup
                              </button>
                              <button 
                                className={styles.cancelButton}
                                onClick={() => {
                                  setShowConfirmation(false);
                                  setSelectedReservation(null);
                                }}
                              >
                                No, Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                
                      {/* Return Confirmation Modal */}
                      {showReturnConfirm && checkoutToReturn && (
                        <div className={styles.modalOverlay}>
                          <div className={`${styles.confirmationModal} ${styles.returnModal}`}>
                            <div className={styles.confirmationIcon}>
                              <FiCheckCircle size={40} />
                            </div>
                            <h3>Confirm Return</h3>
                            
                            <div className={styles.confirmationContent}>
                              <p>Are you sure you want to mark this book as returned?</p>
                              
                              <div className={styles.confirmationDetails}>
                                <div className={styles.confirmationBook}>
                                  <strong>Book:</strong> {checkoutToReturn.book?.title || "Unknown Book"}
                                </div>
                                <div className={styles.confirmationPatron}>
                                  <strong>Patron:</strong> {checkoutToReturn.user ? 
                                    `${checkoutToReturn.user.firstName || 'Unknown'} ${checkoutToReturn.user.lastName || 'Patron'}` : 
                                    'Unknown Patron'
                                  }
                                </div>
                                <div className={styles.confirmationDate}>
                                  <strong>Due Date:</strong> {formatDate(checkoutToReturn.dueDate)}
                                </div>
                              </div>
                              
                              {checkoutToReturn.status === 'overdue' && (
                                <div className={styles.overdueWarning}>
                                  <FiAlertTriangle className={styles.warningIcon} />
                                  <span>This book is currently overdue.</span>
                                </div>
                              )}
                            </div>
                            
                            <div className={styles.modalActions}>
                              <button 
                                className={styles.cancelButton}
                                onClick={dismissReturnConfirm}
                                disabled={isProcessing}
                              >
                                Cancel
                              </button>
                              <button 
                                className={styles.confirmButton}
                                onClick={confirmReturn}
                                disabled={isProcessing}
                              >
                                {isProcessing ? "Processing..." : "Confirm Return"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                
                      {/* Renewal Modal */}
                      {showRenewModal && selectedCheckout && (
                        <div className={styles.modalOverlay}>
                          <div className={styles.renewalModal}>
                            <h3>Renew Book</h3>
                            <div className={styles.renewBookInfo}>
                              <p className={styles.renewBookTitle}>{selectedCheckout.book?.title || 'Unknown Book'}</p>
                              <p className={styles.renewBookAuthor}>by {selectedCheckout.book?.author || 'Unknown Author'}</p>
                            </div>
                            
                            <div className={styles.patronRenewInfo}>
                              <p className={styles.renewPatronName}>
                                Patron: {selectedCheckout.user?.firstName || 'Unknown'} {selectedCheckout.user?.lastName || 'Patron'}
                              </p>
                              <p className={styles.renewPatronId}>
                                Card ID: {selectedCheckout.user?.libraryCardId || 'Not available'}
                              </p>
                            </div>
                            
                            <div className={styles.renewalInfo}>
                              <p>Current due date: {formatDate(selectedCheckout.dueDate)}</p>
                              <p>Renewals used: {selectedCheckout.renewals}/3</p>
                              {selectedCheckout.renewals === 2 ? (
                                <p>You can extend the due date by up to 5 days from the current due date.</p>
                              ) : (
                                <p>You can extend the due date by up to 10 days from the current due date.</p>
                              )}
                            </div>
                            
                            <div className={styles.datePickerContainer}>
                              <label>New Due Date:</label>
                              <DatePicker
                                selected={newDueDate}
                                onChange={(date: Date | null) => setNewDueDate(date)}
                                minDate={selectedCheckout.dueDate}
                                maxDate={maxRenewalDate || undefined}
                                dateFormat="dd MMM yyyy"
                                className={styles.datePicker}
                                popperPlacement="top-start"
                                required
                              />
                            </div>
                            
                            <div className={styles.modalActions}>
                              <button 
                                className={styles.cancelButton}
                                onClick={() => {
                                  setShowRenewModal(false);
                                  setSelectedCheckout(null);
                                  setNewDueDate(null);
                                }}
                                type="button"
                              >
                                Cancel
                              </button>
                              <button 
                                className={styles.confirmButton}
                                onClick={confirmRenewal}
                                type="button"
                                disabled={isProcessing || !newDueDate}
                              >
                                {isProcessing ? "Processing..." : "Confirm Renewal"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                }
                
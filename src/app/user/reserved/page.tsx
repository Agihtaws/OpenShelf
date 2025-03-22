// src/app/user/reserved/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../firebaseConfig';
import { getDoc, doc, collection, query, where, getDocs, deleteDoc, writeBatch, increment } from 'firebase/firestore';
import { FiTrash2, FiBook, FiCalendar, FiAlertTriangle } from 'react-icons/fi';
import styles from './reserved.module.css';
import { formatBookData, getBookById } from '../../../utils/googleBooksAPI';
import useExpiredReservationsCheck from '../../../hooks/useExpiredReservationsCheck';
import { HiH3 } from 'react-icons/hi2';

// Define types for book data
interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  categories: string[];
  publishedDate: string;
  status?: 'reserved';
  reserveId?: string;
  reservedAt?: any;
  pickupBy?: string;
  pickupDate?: Date;
}

export default function ReservedBooksPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [reservedBooks, setReservedBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [sortBy, setSortBy] = useState('recent');
  const [userData, setUserData] = useState<any>(null);
  const [userInitial, setUserInitial] = useState('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');
  
  // Use the expired reservations check hook
  const { isChecking } = useExpiredReservationsCheck();

  // Format date consistently across the app
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return '';

    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    };
    return d.toLocaleDateString('en-US', options);
  };

  // Check authentication when component mounts
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if user is logged in via localStorage/cookies
        const userToken = localStorage.getItem('user_token');
        const userId = localStorage.getItem('user_id');
        
        if (userToken === 'logged_in' && userId) {
          // User is logged in, get their data from Firestore
          const userDoc = await getDoc(doc(db, "users_customer", userId));
          
          if (userDoc.exists()) {
            const userData = userDoc.data() as {
              displayName?: string;
              email?: string;
              photoURL?: string;
              firstName?: string;
              lastName?: string;
            };
            setUserData({
              uid: userId,
              displayName: userData.displayName || '',
              email: userData.email || '',
              photoURL: userData.photoURL || '',
              firstName: userData.firstName || '',
              lastName: userData.lastName || ''
            });
            
            // Set user initial for avatar
            if (userData.firstName) {
              setUserInitial(userData.firstName.charAt(0).toUpperCase());
            } else if (userData.displayName) {
              setUserInitial(userData.displayName.charAt(0).toUpperCase());
            } else if (userData.email) {
              setUserInitial(userData.email.charAt(0).toUpperCase());
            }
            
            setIsAuthenticated(true);
            fetchReservedBooks(userId);
          } else {
            router.push('/auth/login');
          }
        } else {
          router.push('/auth/login');
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Error checking authentication:", error);
        router.push('/auth/login');
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  // Show toast notification
  const showToastNotification = (message: string, type: 'success' | 'error') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    
    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      setShowToast(false);
    }, 3000);
  };

  // Fetch user's reserved books
  const fetchReservedBooks = async (userId: string) => {
    try {
      // Query reserves collection for this user
      const reservesQuery = query(
        collection(db, "reserves"),
        where("userId", "==", userId),
        where("status", "==", "reserved")
      );
      
      const reservesSnapshot = await getDocs(reservesQuery);
      const reservedList: Book[] = [];
      
      // Fetch details for each reserved book
      for (const reserveDoc of reservesSnapshot.docs) {
        const reserveData = reserveDoc.data();
        const bookDocRef = doc(db, "books", reserveData.bookId);
        const bookDoc = await getDoc(bookDocRef);
        
        if (bookDoc.exists()) {
          const bookData = bookDoc.data() as Book;
          
          // Use the pickup date from the reservation if available
          const pickupDate = reserveData.pickupDate?.toDate ? 
            new Date(reserveData.pickupDate.toDate()) : 
            reserveData.pickupDate ? new Date(reserveData.pickupDate) : null;
          
          // If no pickup date was set, use 7 days from reservation date as default
          let finalPickupDate = pickupDate;
          if (!finalPickupDate) {
            const reservedDate = reserveData.reservedAt.toDate ? 
              new Date(reserveData.reservedAt.toDate()) : 
              new Date(reserveData.reservedAt);
            finalPickupDate = new Date(reservedDate);
            finalPickupDate.setDate(reservedDate.getDate() + 7);
          }
          
          // Add to reserved list
          reservedList.push({
            ...bookData,
            id: bookDoc.id,
            reserveId: reserveDoc.id,
            status: 'reserved',
            reservedAt: reserveData.reservedAt.toDate ? 
              new Date(reserveData.reservedAt.toDate()) : 
              new Date(reserveData.reservedAt),
            pickupDate: finalPickupDate,
            pickupBy: finalPickupDate.toISOString().split('T')[0]
          });
        } else {
          // If book doesn't exist in Firestore, try to fetch it from Google Books API
          try {
            const googleBook = await getBookById(reserveData.bookId);
            if (googleBook) {
              const bookData = formatBookData(googleBook);
              
              // Use the pickup date from the reservation if available
              const pickupDate = reserveData.pickupDate?.toDate ? 
                new Date(reserveData.pickupDate.toDate()) : 
                reserveData.pickupDate ? new Date(reserveData.pickupDate) : null;
              
              // If no pickup date was set, use 7 days from reservation date as default
              let finalPickupDate = pickupDate;
              if (!finalPickupDate) {
                const reservedDate = reserveData.reservedAt.toDate ? 
                  new Date(reserveData.reservedAt.toDate()) : 
                  new Date(reserveData.reservedAt);
                finalPickupDate = new Date(reservedDate);
                finalPickupDate.setDate(reservedDate.getDate() + 7);
              }
              
              reservedList.push({
                ...bookData,
                id: reserveData.bookId,
                reserveId: reserveDoc.id,
                status: 'reserved',
                reservedAt: reserveData.reservedAt.toDate ? 
                  new Date(reserveData.reservedAt.toDate()) : 
                  new Date(reserveData.reservedAt),
                pickupDate: finalPickupDate,
                pickupBy: finalPickupDate.toISOString().split('T')[0]
              });
            }
          } catch (error) {
            console.error("Error fetching book from Google Books API:", error);
          }
        }
      }
      
      // Set state with reserved books
      setReservedBooks(reservedList);
      setFilteredBooks(reservedList);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching reserved books:", error);
      setIsLoading(false);
    }
  };

  // Filter and sort reserved books
  useEffect(() => {
    if (reservedBooks.length === 0) return;
    
    let filtered = [...reservedBooks];
    
    // Apply sort
    if (sortBy === 'recent') {
      filtered.sort((a, b) => {
        if (!a.reservedAt || !b.reservedAt) return 0;
        return b.reservedAt.getTime() - a.reservedAt.getTime();
      });
    } else if (sortBy === 'title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      filtered.sort((a, b) => a.author.localeCompare(b.author));
    } else if (sortBy === 'pickup') {
      filtered.sort((a, b) => {
        if (!a.pickupDate || !b.pickupDate) return 0;
        return a.pickupDate.getTime() - b.pickupDate.getTime();
      });
    }
    
    setFilteredBooks(filtered);
  }, [reservedBooks, sortBy]);

  // Show cancel confirmation popup
  const handleCancelReservation = (book: Book) => {
    setSelectedBook(book);
    setShowCancelConfirm(true);
  };

  // Dismiss cancel confirmation popup
  const dismissCancelConfirm = () => {
    setShowCancelConfirm(false);
    setSelectedBook(null);
  };

  // Actually cancel the reservation after confirmation
  const confirmCancelReservation = async () => {
    if (!selectedBook || !selectedBook.reserveId) return;
    
    try {
      setIsCancelling(true);
      const userId = localStorage.getItem('user_id');
      if (!userId) return;
      
      // Create a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);
      
      // 1. Delete the reservation document
      const reserveRef = doc(db, "reserves", selectedBook.reserveId);
      batch.delete(reserveRef);
      
      // 2. Update the book's copies count (increment by 1)
      const bookRef = doc(db, "books", selectedBook.id);
      batch.update(bookRef, {
        copies: increment(1) // Use Firestore's increment function to safely increment
      });
      
      // Commit the batch
      await batch.commit();
      
      // Update UI
      setReservedBooks(prev => prev.filter(b => b.reserveId !== selectedBook.reserveId));
      setFilteredBooks(prev => prev.filter(b => b.reserveId !== selectedBook.reserveId));
      
      // Show toast notification
      showToastNotification(`Reservation for "${selectedBook.title}" has been cancelled`, "success");
      
      setIsCancelling(false);
      setShowCancelConfirm(false);
      setSelectedBook(null);
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      showToastNotification("Failed to cancel reservation", "error");
      setIsCancelling(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your reserved books...</p>
      </div>
    );
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.pageHeader}>
        
        <h3 className={styles.headerDescription}>
          Books you've reserved that are waiting for pickup
        </h3>
        
        <div className={styles.filterBar}>
          <div className={styles.sortFilter}>
            <label htmlFor="sortBy" className={styles.sortLabel}>Sort by:</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.sortSelect}
            >
              <option value="recent">Recently Reserved</option>
              <option value="pickup">Pickup Date</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
            </select>
          </div>
        </div>
      </header>

      <div className={styles.booksGrid}>
        {filteredBooks.length > 0 ? (
          filteredBooks.map(book => (
            <div key={book.reserveId} className={styles.bookCard}>
              <div className={styles.bookCover}>
                {book.coverImage ? (
                  <Image 
                    src={book.coverImage} 
                    alt={book.title} 
                    width={180} 
                    height={270}
                    className={styles.coverImage}
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null;
                      target.src = '/images/default-cover.jpg';
                    }}
                  />
                ) : (
                  <div className={styles.coverFallback}>
                    <FiBook size={40} />
                  </div>
                )}
                <div className={styles.statusBadge}>Reserved</div>
              </div>
              <div className={styles.bookInfo}>
                <h2 className={styles.bookTitle}>{book.title}</h2>
                <p className={styles.bookAuthor}>by {book.author}</p>
                
                {book.categories && book.categories.length > 0 && (
                  <div className={styles.categories}>
                    {book.categories.slice(0, 3).map((category, index) => (
                      <span key={index} className={styles.category}>{category}</span>
                    ))}
                  </div>
                )}
                
                <div className={styles.reservationDetails}>
                  <div className={styles.dateInfo}>
                    <FiCalendar className={styles.dateIcon} />
                    <div>
                      <p className={styles.reservedDate}>
                        Reserved on: {formatDate(book.reservedAt)}
                      </p>
                      <p className={styles.pickupDate}>
                        Pick up by: {formatDate(book.pickupDate)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.pickupNote}>
                    <FiAlertTriangle className={styles.alertIcon} />
                    <p>Please pick up this book by the date shown or your reservation will be automatically canceled.</p>
                  </div>
                </div>
                
                <div className={styles.bookActions}>
                  <button 
                    className={styles.cancelButton}
                    onClick={() => handleCancelReservation(book)}
                  >
                    <FiTrash2 /> Cancel Reservation
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

      {/* Cancel Reservation Confirmation Popup */}
      {showCancelConfirm && selectedBook && (
        <div className={styles.confirmationOverlay}>
          <div className={`${styles.confirmationPopup} ${styles.cancel}`}>
            <div className={`${styles.confirmationIcon} ${styles.cancelIcon}`}>
              ⚠️
            </div>
            <h3>Cancel Reservation</h3>
            <p>Are you sure you want to cancel your reservation for "{selectedBook.title}"?</p>
            
            <div className={styles.confirmationButtons}>
              <button 
                className={styles.cancelConfirmButton}
                onClick={confirmCancelReservation}
                disabled={isCancelling}
              >
                {isCancelling ? "Processing..." : "Yes, Cancel"}
              </button>
              <button 
                className={`${styles.cancelButton} ${styles.popup}`}
                onClick={dismissCancelConfirm}
              >
                Keep Reservation
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast Notification */}
      {showToast && (
        <div className={styles.toastContainer}>
          <div className={`${styles.toast} ${styles[toastType]}`}>
            <div className={styles.toastIcon}>
              {toastType === 'success' ? <FiBook /> : <FiAlertTriangle />}
            </div>
            <span className={styles.toastMessage}>{toastMessage}</span>
          </div>
        </div>
      )}
    </main>
  );
}

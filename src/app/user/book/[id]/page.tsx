"use client"
import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { auth, db } from '../../../../firebaseConfig';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, writeBatch, increment } from 'firebase/firestore';
import { FiArrowLeft, FiBookOpen, FiCalendar, FiHash, FiUser, FiBookmark, FiTag, FiInfo, FiHeart, FiAlertTriangle } from 'react-icons/fi';
import styles from './BookDetails.module.css';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface Book {
  id: string;
  googleBooksId: string;
  title: string;
  author: string;
  isbn: string;
  publishedDate: string;
  publisher: string;
  description: string;
  pageCount: number;
  categories: string[];
  coverImage: string;
  language: string;
  shelfNumber: string;
  copies: number;
  status: 'Available' | 'On Loan' | 'Reserved' | 'Lost' | 'Damaged';
}

export default function BookDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [book, setBook] = useState<Book | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [inWishlist, setInWishlist] = useState(false);
  const [favoriteId, setFavoriteId] = useState<string | null>(null);
  const [isReserved, setIsReserved] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [borrowedBookIds, setBorrowedBookIds] = useState<Set<string>>(new Set());
  
  // Popup states
  const [showReservationPopup, setShowReservationPopup] = useState(false);
  const [selectedReservationDate, setSelectedReservationDate] = useState<Date | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [reservationSuccess, setReservationSuccess] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userToken = localStorage.getItem('user_token');
        const storedUserId = localStorage.getItem('user_id');

        if (userToken === 'logged_in' && storedUserId) {
          // User is logged in, fetch data
          setIsAuthenticated(true);
          setUserId(storedUserId);
          fetchBook(storedUserId);
        } else {
          router.push('/auth/login'); // Redirect if not logged in
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        router.push('/auth/login');
      }
    };

    checkAuth();
  }, [id, router]);

  const fetchBook = async (userId: string) => {
    if (!id) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const bookId = Array.isArray(id) ? id[0] : id;
      const bookDoc = await getDoc(doc(db, "books", bookId));

      if (bookDoc.exists()) {
        const bookData = bookDoc.data() as Book;
        setBook({ ...bookData, id: bookDoc.id });
        
        // Check if book is in user's favorites
        checkFavoriteStatus(bookDoc.id, userId);
        
        // Check if book is already reserved by this user
        checkReservationStatus(bookDoc.id, userId);
        
        // Check if book is already borrowed by this user
        checkBorrowedStatus(bookDoc.id, userId);
      } else {
        setErrorMessage("Book not found.");
        router.push('/user/catalog');
      }
    } catch (error) {
      console.error("Error fetching book details:", error);
      setErrorMessage("Failed to load book details. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  };

  // Check if the book is in the user's favorites
  const checkFavoriteStatus = async (bookId: string, userId: string) => {
    try {
      // Query the favorites collection
      const favoritesQuery = query(
        collection(db, "favorites"),
        where("userId", "==", userId),
        where("bookId", "==", bookId)
      );
      
      const querySnapshot = await getDocs(favoritesQuery);
      
      if (!querySnapshot.empty) {
        setInWishlist(true);
        setFavoriteId(querySnapshot.docs[0].id);
      }
    } catch (error) {
      console.error("Error checking favorite status:", error);
    }
  };
  
  // Check if the book is already reserved by this user
  const checkReservationStatus = async (bookId: string, userId: string) => {
    try {
      // Query the reserves collection
      const reservesQuery = query(
        collection(db, "reserves"),
        where("userId", "==", userId),
        where("bookId", "==", bookId),
        where("status", "==", "reserved")
      );
      
      const querySnapshot = await getDocs(reservesQuery);
      
      if (!querySnapshot.empty) {
        setIsReserved(true);
      }
    } catch (error) {
      console.error("Error checking reservation status:", error);
    }
  };
  
  // Check if the book is already borrowed by this user
  const checkBorrowedStatus = async (bookId: string, userId: string) => {
    try {
      // Query user's borrowed books
      const borrowsQuery = query(
        collection(db, "borrows"),
        where("userId", "==", userId),
        where("bookId", "==", bookId),
        where("status", "in", ["borrowed", "overdue"])
      );
      
      const querySnapshot = await getDocs(borrowsQuery);
      
      if (!querySnapshot.empty) {
        setBorrowedBookIds(prev => {
          const updated = new Set(prev);
          updated.add(bookId);
          return updated;
        });
      }
    } catch (error) {
      console.error("Error checking borrowed status:", error);
    }
  };

  // Toggle wishlist status
  const toggleWishlist = async () => {
    if (!book || !userId) return;

    try {
      if (inWishlist && favoriteId) {
        // Remove from favorites
        await deleteDoc(doc(db, "favorites", favoriteId));
        setInWishlist(false);
        setFavoriteId(null);
        
        // Show toast
        showToastNotification("Removed from wishlist", "success");
      } else {
        // Add to favorites
        const newFavoriteRef = doc(db, "favorites", `${userId}_${book.id}`);
        await setDoc(newFavoriteRef, {
          userId: userId,
          bookId: book.id,
          addedAt: new Date()
        });
        
        setInWishlist(true);
        setFavoriteId(`${userId}_${book.id}`);
        
        // Show toast
        showToastNotification("Added to wishlist", "success");
      }
    } catch (error) {
      console.error("Error updating wishlist:", error);
      showToastNotification("Failed to update wishlist", "error");
    }
  };
  
  // Open reservation popup
  const handleReserveBook = () => {
    setSelectedReservationDate(new Date()); // Set default date to today
    setShowReservationPopup(true);
    setReservationSuccess(false);
  };
  
  // Show cancel confirmation popup
  const handleCancelReservation = () => {
    setShowCancelConfirm(true);
  };
  
  // Dismiss cancel confirmation popup
  const dismissCancelConfirm = () => {
    setShowCancelConfirm(false);
  };
  
  // Complete reservation
// Complete reservation
const confirmReservation = async () => {
  if (!book || !selectedReservationDate || !userId) return;
  
  try {
    setIsReserving(true);

    // Create a batch to ensure all operations succeed or fail together
    const batch = writeBatch(db);

    // 1. Add to reserves collection with the selected date
    const reserveRef = doc(db, "reserves", `${userId}_${book.id}`);
    batch.set(reserveRef, {
      userId: userId,
      bookId: book.id,
      bookTitle: book.title,
      status: 'reserved',
      reservedAt: new Date(),
      pickupDate: selectedReservationDate
    });
    
    // 2. Update the book's copies count (decrement by 1)
    const bookRef = doc(db, "books", book.id);
    batch.update(bookRef, {
      copies: increment(-1) // Use Firestore's increment function to safely decrement
    });
    
    // Commit the batch
    await batch.commit();
    
    // Update local state
    setIsReserved(true);
    setBook(prev => prev ? {...prev, copies: prev.copies - 1} : null);
    
    // Show success state
    setReservationSuccess(true);
    
    // Auto-close after 3 seconds
    setTimeout(() => {
      setShowReservationPopup(false);
      setSelectedReservationDate(null);
      setReservationSuccess(false);
    }, 3000);
    
  } catch (error) {
    console.error("Error reserving book:", error);
    showToastNotification("Failed to reserve book", "error");
  } finally {
    setIsReserving(false);
  }
};

  
  // Actually cancel the reservation after confirmation
  // Actually cancel the reservation after confirmation
const confirmCancelReservation = async () => {
  if (!book || !userId) return;
  
  try {
    setIsCancelling(true);
    
    // Create a batch to ensure all operations succeed or fail together
    const batch = writeBatch(db);
    
    // 1. Delete the reservation document
    const reserveRef = doc(db, "reserves", `${userId}_${book.id}`);
    batch.delete(reserveRef);
    
    // 2. Update the book's copies count (increment by 1)
    const bookRef = doc(db, "books", book.id);
    batch.update(bookRef, {
      copies: increment(1) // Use Firestore's increment function to safely increment
    });
    
    // Commit the batch
    await batch.commit();
    
    // Update state
    setIsReserved(false);
    setBook(prev => prev ? {...prev, copies: prev.copies + 1} : null);
    
    // Show toast
    showToastNotification("Reservation cancelled", "success");
    
    setIsCancelling(false);
    setShowCancelConfirm(false);
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    showToastNotification("Failed to cancel reservation", "error");
    setIsCancelling(false);
  }
};

  
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
  
  // Format date consistently
  const formatDate = (date: Date | null): string => {
    if (!date) return '';
    
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    };
    return d.toLocaleDateString('en-US', options);
  };

  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading book details...</p>
      </div>
    );
  }

  if (errorMessage || !book) {
    return (
      <div className={styles.errorContainer}>
        <div className={styles.errorMessage}>{errorMessage || "Book information could not be loaded."}</div>
        <Link href="/user/catalog" className={styles.backButton}>
          <FiArrowLeft /> Return to Catalog
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.bookDetailsPage}>
      

      <div className={styles.bookDetails}>
        <div className={styles.bookCover}>
          {book.coverImage ? (
            <Image 
              src={book.coverImage} 
              alt={book.title}
              width={300}
              height={450}
              className={styles.coverImage}
              unoptimized={true}
              priority={true}
            />
          ) : (
            <div className={styles.noCoverImage}>
              <FiBookOpen size={80} />
            </div>
          )}
        </div>

        <div className={styles.bookInfo}>
          <h1 className={styles.bookTitle}>{book.title}</h1>
          <p className={styles.bookAuthor}>
            <FiUser className={styles.infoIcon} /> {book.author}
          </p>

          {book.categories && book.categories.length > 0 && (
            <div className={styles.bookCategories}>
              <FiTag className={styles.infoIcon} />
              {book.categories.map((category, index) => (
                <span key={index} className={styles.categoryPill}>
                  {category}
                </span>
              ))}
            </div>
          )}

          <div className={styles.bookMeta}>
            {book.publishedDate && (
              <div className={styles.metaItem}>
                <FiCalendar className={styles.infoIcon} />
                <span>Published: {book.publishedDate}</span>
              </div>
            )}
            
            {book.publisher && (
              <div className={styles.metaItem}>
                <FiInfo className={styles.infoIcon} />
                <span>Publisher: {book.publisher}</span>
              </div>
            )}
            
            {book.isbn && (
              <div className={styles.metaItem}>
                <FiHash className={styles.infoIcon} />
                <span>ISBN: {book.isbn}</span>
              </div>
            )}
            
            {book.shelfNumber && (
              <div className={styles.metaItem}>
                <FiBookmark className={styles.infoIcon} />
                <span>Shelf: {book.shelfNumber}</span>
              </div>
            )}
          </div>

          <div className={styles.statusSection}>
            <div className={`${styles.statusBadge} ${styles[book.status.replace(/\s+/g, '').toLowerCase()]}`}>
              {book.status}
            </div>
            {book.copies > 0 && (
              <span className={styles.copiesInfo}>
                {book.copies} {book.copies === 1 ? 'copy' : 'copies'} available
              </span>
            )}
          </div>

          <div className={styles.actionButtons}>
            {borrowedBookIds.has(book.id) ? (
              <button
                className={`${styles.borrowedButton} ${styles.disabled}`}
                disabled={true}
              >
                <FiBookmark /> Borrowed
              </button>
            ) : isReserved ? (
              <button
                className={styles.cancelButton}
                onClick={handleCancelReservation}
              >
                <FiBookmark /> Cancel Reservation
              </button>
            ) : (
              <button
                className={styles.reserveButton}
                onClick={handleReserveBook}
                disabled={book.status !== 'Available'}
              >
                <FiBookmark /> Reserve
              </button>
            )}
            <button 
              className={`${styles.wishlistButton} ${inWishlist ? styles.wishlisted : ''}`}
              onClick={toggleWishlist}
            >
              <FiHeart /> {inWishlist ? 'In Wishlist' : 'Add to Wishlist'}
            </button>
          </div>

          {book.description && (
            <div className={styles.descriptionSection}>
              <h2>Description</h2>
              <div className={styles.description}>
                {book.description}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Toast Notification */}
      {showToast && (
        <div className={styles.toastContainer}>
          <div className={`${styles.toast} ${styles[toastType]}`}>
            <span className={styles.toastMessage}>{toastMessage}</span>
          </div>
        </div>
      )}
      
      {/* Reservation Date Picker Popup */}
      {showReservationPopup && (
        <div className={styles.confirmationOverlay}>
          <div className={`${styles.confirmationPopup} ${styles.reservationPopup} ${reservationSuccess ? styles.success : ''}`}>
            {!reservationSuccess ? (
              <>
                <div className={`${styles.confirmationIcon} ${styles.reserveIcon}`}>
                  📅
                </div>
                <h3>Reserve Book</h3>
                
                <div className={styles.bookInfoInPopup}>
                  <div className={styles.bookTitleInPopup}>{book.title}</div>
                  <div className={styles.bookAuthorInPopup}>by {book.author}</div>
                </div>
                
                <div className={styles.datePickerContainer}>
                  <label className={styles.datePickerLabel}>Select a pickup date:</label>
                  <DatePicker
                    selected={selectedReservationDate}
                    onChange={(date: Date | null) => setSelectedReservationDate(date)}
                    minDate={new Date()}
                    placeholderText="Select a date"
                  />
                </div>
                
                <p className={styles.dateInstructions}>
                  Please select the date by which you will pick up your book. 
                  Reservations not claimed by this date will be automatically canceled.
                </p>
                
                <div className={styles.confirmationButtons}>
                  <button 
                    className={styles.confirmButton}
                    onClick={confirmReservation} 
                    disabled={!selectedReservationDate || isReserving}
                  >
                    {isReserving ? "Reserving..." : "Confirm Reservation"}
                  </button>
                  <button 
                    className={`${styles.cancelButton} ${styles.popup}`}
                    onClick={() => {
                      setShowReservationPopup(false);
                      setSelectedReservationDate(null);
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.successContent}>
                <div className={styles.successIcon}>✓</div>
                <h3>Reservation Confirmed!</h3>
                <p>You have successfully reserved "{book.title}".</p>
                <p className={styles.pickupInfo}>
                  <FiCalendar className={styles.calendarIcon} />
                  Please pick up by: {formatDate(selectedReservationDate)}
                </p>
                <p className={styles.successNote}>
                  You can view and manage your reservations in the Reserved Books section.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Cancel Reservation Confirmation Popup */}
      {showCancelConfirm && (
        <div className={styles.confirmationOverlay}>
          <div className={`${styles.confirmationPopup} ${styles.cancel}`}>
            <div className={`${styles.confirmationIcon} ${styles.cancelIcon}`}>
              <FiAlertTriangle />
            </div>
            <h3>Cancel Reservation</h3>
            <p>Are you sure you want to cancel your reservation for "{book.title}"?</p>
            
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
    </div>
  );
}

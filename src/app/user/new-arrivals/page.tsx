// src/app/user/new-arrivals/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { db } from '@/firebaseConfig';
import { doc, getDoc, collection, query, orderBy, getDocs, setDoc, deleteDoc, Timestamp, where, limit, writeBatch, increment } from 'firebase/firestore';
import { FiHeart, FiBookmark, FiSearch, FiFilter, FiCalendar, FiAlertTriangle } from 'react-icons/fi';
import styles from './newArrivals.module.css';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

// Define types for book data
interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  categories: string[];
  publishedDate: string;
  addedAt: Timestamp;
  status: string;
  copies: number;
}

export default function NewArrivalsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [books, setBooks] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [favoriteBookIds, setFavoriteBookIds] = useState<Set<string>>(new Set());
  const [reservedBookIds, setReservedBookIds] = useState<Set<string>>(new Set());
  const [borrowedBookIds, setBorrowedBookIds] = useState<Set<string>>(new Set());
  const [userData, setUserData] = useState<any>(null);
  const [userInitial, setUserInitial] = useState('');
  
  // Popup states
  const [showFavoritePopup, setShowFavoritePopup] = useState(false);
  const [favoritePopupMessage, setFavoritePopupMessage] = useState('');
  const [showReservationPopup, setShowReservationPopup] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedReservationDate, setSelectedReservationDate] = useState<Date | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [reservationSuccess, setReservationSuccess] = useState(false);
  
  // Cancel confirmation popup
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

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
            const userData = userDoc.data();
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
            fetchNewArrivals();
            checkFavoriteStatus();
            checkReservationStatus();
            checkBorrowedStatus();
          } else {
            router.push('/auth/login');
          }
        } else {
          router.push('/auth/login');
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        router.push('/auth/login');
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Check favorite status of all books
  const checkFavoriteStatus = async () => {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    try {
      // Query all user's favorites
      const favoritesQuery = query(
        collection(db, "favorites"),
        where("userId", "==", userId)
      );

      const querySnapshot = await getDocs(favoritesQuery);
      const favoriteIds = new Set<string>();

      querySnapshot.forEach(doc => {
        const data = doc.data();
        favoriteIds.add(data.bookId);
      });

      setFavoriteBookIds(favoriteIds);
    } catch (error) {
      console.error("Error checking favorite status:", error);
    }
  };

  // Check reservation status of all books
  const checkReservationStatus = async () => {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    try {
      // Query all user's reservations
      const reservesQuery = query(
        collection(db, "reserves"),
        where("userId", "==", userId),
        where("status", "==", "reserved")
      );

      const querySnapshot = await getDocs(reservesQuery);
      const reservedIds = new Set<string>();

      querySnapshot.forEach(doc => {
        const data = doc.data();
        reservedIds.add(data.bookId);
      });

      setReservedBookIds(reservedIds);
    } catch (error) {
      console.error("Error checking reservation status:", error);
    }
  };

  // Check borrowed status of all books
  const checkBorrowedStatus = async () => {
    const userId = localStorage.getItem('user_id');
    if (!userId) return;

    try {
      // Query user's borrowed books
      const borrowsQuery = query(
        collection(db, "borrows"),
        where("userId", "==", userId),
        where("status", "in", ["borrowed", "overdue"])
      );
      
      const querySnapshot = await getDocs(borrowsQuery);
      const borrowedIds = new Set<string>();
      
      querySnapshot.forEach(doc => {
        const data = doc.data();
        borrowedIds.add(data.bookId);
      });
      
      setBorrowedBookIds(borrowedIds);
    } catch (error) {
      console.error("Error checking borrowed status:", error);
    }
  };

  // Fetch new arrivals from Firestore
  const fetchNewArrivals = async () => {
    try {
      // Get current date and date 24 hours ago
      const now = new Date();
      const today = new Date(now);
      today.setHours(0, 0, 0, 0); // Start of today
      
      // First query: Books added today with copies > 0
      const todayBooksQuery = query(
        collection(db, "books"),
        where("copies", ">", 0),
        where("addedAt", ">=", today),
        orderBy("addedAt", "desc")
      );
      
      const todaySnapshot = await getDocs(todayBooksQuery);
      const todayBooks: Book[] = [];
      const uniqueCategories = new Set<string>();
      
      // Process today's books
      todaySnapshot.forEach((doc) => {
        const data = doc.data() as Omit<Book, 'id'>;
        
        if (data.copies > 0) {
          todayBooks.push({
            ...data,
            id: doc.id
          });
          
          // Collect unique categories
          if (data.categories && Array.isArray(data.categories)) {
            data.categories.forEach(category => uniqueCategories.add(category));
          }
        }
      });
      
      let booksData: Book[] = [...todayBooks];
      
      // If we have fewer than 10 books from today, fetch older books to fill up to 10
      if (todayBooks.length < 10) {
        // Get the number of additional books needed
        const additionalBooksNeeded = 10 - todayBooks.length;
        
        // Query for older books
        const olderBooksQuery = query(
          collection(db, "books"),
          where("copies", ">", 0),
          where("addedAt", "<", today),
          orderBy("addedAt", "desc"),
          limit(additionalBooksNeeded)
        );
        
        const olderSnapshot = await getDocs(olderBooksQuery);
        
        // Process older books and add them to the books array
        olderSnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Book, 'id'>;
          
          if (data.copies > 0) {
            booksData.push({
              ...data,
              id: doc.id
            });
            
            // Collect unique categories
            if (data.categories && Array.isArray(data.categories)) {
              data.categories.forEach(category => uniqueCategories.add(category));
            }
          }
        });
      }
      
      setBooks(booksData);
      setFilteredBooks(booksData);
      setCategories(Array.from(uniqueCategories).sort());
    } catch (error) {
      console.error("Error fetching new arrivals:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Filter books based on search query and category
  useEffect(() => {
    if (books.length === 0) return;

    let filtered = [...books];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(book =>
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        (book.description && book.description.toLowerCase().includes(query))
      );
    }

    // Apply category filter
    if (categoryFilter !== 'All') {
      filtered = filtered.filter(book =>
        book.categories && book.categories.includes(categoryFilter)
      );
    }

    setFilteredBooks(filtered);
  }, [books, searchQuery, categoryFilter]);

  // Toggle favorite status
  const toggleFavorite = async (book: Book) => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId) return;

      const favoriteId = `${userId}_${book.id}`;
      const favoriteRef = doc(db, "favorites", favoriteId);

      if (favoriteBookIds.has(book.id)) {
        // Remove from favorites
        await deleteDoc(favoriteRef);

        // Update state
        setFavoriteBookIds(prev => {
          const updated = new Set(prev);
          updated.delete(book.id);
          return updated;
        });
        
        // Show popup message
        setFavoritePopupMessage(`"${book.title}" has been removed from your favorites.`);
        setShowFavoritePopup(true);
        
        // Auto-hide popup after 3 seconds
        setTimeout(() => {
          setShowFavoritePopup(false);
        }, 3000);
      } else {
        // Add to favorites
        await setDoc(favoriteRef, {
          userId: userId,
          bookId: book.id,
          addedAt: new Date()
        });

        // Update state
        setFavoriteBookIds(prev => {
          const updated = new Set(prev);
          updated.add(book.id);
          return updated;
        });
        
        // Show popup message
        setFavoritePopupMessage(`"${book.title}" has been added to your favorites.`);
        setShowFavoritePopup(true);
        
        // Auto-hide popup after 3 seconds
        setTimeout(() => {
          setShowFavoritePopup(false);
        }, 3000);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
    }
  };

  // Open reservation popup
  const handleReserveBook = (book: Book) => {
    setSelectedBook(book);
    
    // Set default pickup date to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setSelectedReservationDate(tomorrow);
    
    setShowReservationPopup(true);
    setReservationSuccess(false);
  };

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
    if (!selectedBook) return;
    
    try {
      setIsCancelling(true);
      const userId = localStorage.getItem('user_id');
      if (!userId) return;
      
      // Create a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);
      
      // 1. Delete the reservation document
      const reserveRef = doc(db, "reserves", `${userId}_${selectedBook.id}`);
      batch.delete(reserveRef);
      
      // 2. Update the book's copies count (increment by 1)
      const bookRef = doc(db, "books", selectedBook.id);
      batch.update(bookRef, {
        copies: increment(1) // Use Firestore's increment function to safely increment
      });
      
      // Commit the batch
      await batch.commit();
      
      // Update reserved books state
      setReservedBookIds(prev => {
        const updated = new Set(prev);
        updated.delete(selectedBook.id);
        return updated;
      });
      
      // Update the book's copies in the local state
      setBooks(prevBooks => 
        prevBooks.map(book => 
          book.id === selectedBook.id 
            ? {...book, copies: book.copies + 1}
            : book
        )
      );
      
      // Show popup message
      setFavoritePopupMessage(`Your reservation for "${selectedBook.title}" has been cancelled.`);
      setShowFavoritePopup(true);
      
      // Auto-hide popup after 3 seconds
      setTimeout(() => {
        setShowFavoritePopup(false);
      }, 3000);
      
      setIsCancelling(false);
      setShowCancelConfirm(false);
      setSelectedBook(null);
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      setIsCancelling(false);
    }
  };

  // Complete reservation
  const confirmReservation = async () => {
    if (!selectedBook || !selectedReservationDate) return;
    
    try {
      setIsReserving(true);
      const userId = localStorage.getItem('user_id');
      if (!userId) return;

      // Create a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);

      // 1. Add to reserves collection with the selected date
      const reserveRef = doc(db, "reserves", `${userId}_${selectedBook.id}`);
      batch.set(reserveRef, {
        userId: userId,
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        status: 'reserved',
        reservedAt: new Date(),
        pickupDate: selectedReservationDate
      });
      
      // 2. Update the book's copies count (decrement by 1)
      const bookRef = doc(db, "books", selectedBook.id);
      batch.update(bookRef, {
        copies: increment(-1) // Use Firestore's increment function to safely decrement
      });
      
      // Commit the batch
      await batch.commit();
      
      // Update local state
      setReservedBookIds(prev => {
        const updated = new Set(prev);
        updated.add(selectedBook.id);
        return updated;
      });
      
      // Update the book's copies in the local state
      setBooks(prevBooks => 
        prevBooks.map(book => 
          book.id === selectedBook.id 
            ? {...book, copies: book.copies - 1}
            : book
        )
      );
      
      // Show success state
      setReservationSuccess(true);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        setShowReservationPopup(false);
        setSelectedBook(null);
        setSelectedReservationDate(null);
        setReservationSuccess(false);
      }, 3000);
      
    } catch (error) {
      console.error("Error reserving book:", error);
    } finally {
      setIsReserving(false);
    }
  };

  // Format date consistently across the app
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

  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading new arrivals...</p>
      </div>
    );
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.pageHeader}>
        
        <h3 className={styles.headerDescription}>
          Discover the latest additions to our library collection
        </h3>

        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <FiSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by title, author, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.categoryFilter}>
            <FiFilter className={styles.filterIcon} />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="All">All Categories</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      <div className={styles.booksGrid}>
        {filteredBooks.length > 0 ? (
          filteredBooks.map(book => (
            <div key={book.id} className={styles.bookCard}>
              <div className={styles.bookCover}>
                <Image
                  src={book.coverImage || '/images/default-cover.jpg'}
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
                <div className={styles.bookBadge}>New</div>
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

                <p className={styles.bookDescription}>
                  {book.description ? (
                    book.description.length > 150
                      ? `${book.description.substring(0, 150)}...`
                      : book.description
                  ) : 'No description available.'}
                </p>

                <div className={styles.bookActions}>
                  <button
                    className={`${styles.favoriteButton} ${favoriteBookIds.has(book.id) ? styles.favorited : ''}`}
                    onClick={() => toggleFavorite(book)}
                  >
                    <FiHeart /> {favoriteBookIds.has(book.id) ? 'Saved' : 'Add to Favorites'}
                  </button>

                  {borrowedBookIds.has(book.id) ? (
                    <button
                      className={`${styles.borrowedButton} ${styles.disabled}`}
                      disabled={true}
                    >
                      <FiBookmark /> Borrowed
                    </button>
                  ) : reservedBookIds.has(book.id) ? (
                    <button
                      className={styles.cancelButton}
                      onClick={() => handleCancelReservation(book)}
                    >
                      <FiBookmark /> Cancel Reservation
                    </button>
                  ) : (
                    <button
                      className={styles.reserveButton}
                      onClick={() => handleReserveBook(book)}
                    >
                      <FiBookmark /> Reserve
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📚</div>
            <h3>No books found</h3>
            <p>
              {searchQuery || categoryFilter !== 'All'
                ? 'Try adjusting your search or filter criteria'
                : 'There are no new arrivals at the moment. Check back soon!'}
            </p>
          </div>
        )}
      </div>
      
      {/* Favorite Confirmation Popup */}
      {showFavoritePopup && (
        <div className={styles.popupOverlay}>
          <div className={`${styles.popup} ${styles.favoritePopup}`}>
            <div className={styles.popupIcon}>
              <FiHeart />
            </div>
            <p className={styles.popupMessage}>{favoritePopupMessage}</p>
          </div>
        </div>
      )}
      
      {/* Reservation Date Picker Popup */}
      {showReservationPopup && selectedBook && (
        <div className={styles.confirmationOverlay}>
          <div className={`${styles.confirmationPopup} ${styles.reservationPopup} ${reservationSuccess ? styles.success : ''}`}>
            {!reservationSuccess ? (
              <>
                <div className={`${styles.confirmationIcon} ${styles.reserveIcon}`}>
                  📅
                </div>
                <h3>Reserve Book</h3>
                
                <div className={styles.bookInfoInPopup}>
                  <div className={styles.bookTitleInPopup}>{selectedBook.title}</div>
                  <div className={styles.bookAuthorInPopup}>by {selectedBook.author}</div>
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
                      setSelectedBook(null);
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
                <p>You have successfully reserved "{selectedBook.title}".</p>
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
      {showCancelConfirm && selectedBook && (
        <div className={styles.confirmationOverlay}>
          <div className={`${styles.confirmationPopup} ${styles.cancel}`}>
            <div className={`${styles.confirmationIcon} ${styles.cancelIcon}`}>
              <FiAlertTriangle />
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
    </main>
  );
}

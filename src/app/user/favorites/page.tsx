// src/app/user/favorites/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../firebaseConfig';
import { getDoc, collection, query, where, getDocs, deleteDoc, setDoc, doc, writeBatch, increment } from 'firebase/firestore';
import { FiTrash2, FiBookmark, FiSearch, FiFilter, FiBook, FiCalendar, FiHeart } from 'react-icons/fi';
import styles from './favorites.module.css';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
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
  favoriteId?: string; // ID in the favorites collection
  addedAt?: any;
  reservationDate?: Date | null;
  isReserved?: boolean;
}

export default function FavoritesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [favorites, setFavorites] = useState<Book[]>([]);
  const [filteredFavorites, setFilteredFavorites] = useState<Book[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('recent');
  const [userData, setUserData] = useState<any>(null);
  const [userInitial, setUserInitial] = useState('');
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [bookToRemove, setBookToRemove] = useState<{ favoriteId: string; bookTitle: string } | null>(null);
  const [selectedReservationDate, setSelectedReservationDate] = useState<Date | null>(null);
  const [isReserving, setIsReserving] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [reservationSuccess, setReservationSuccess] = useState(false);
  const [borrowedBookIds, setBorrowedBookIds] = useState<Set<string>>(new Set());
  
  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Format date consistently across the app
  const formatDate = (date: Date | string | null): string => {
    if (!date) return '';
    
    const d = new Date(date);
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    };
    return d.toLocaleDateString('en-US', options);
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
              fetchUserFavorites(userId);
            } else {
              router.push('/auth/login');
              setIsLoading(false); // Set loading to false here
            }
          } else {
            router.push('/auth/login');
            setIsLoading(false); // Set loading to false here
          }
      
          
        } catch (error) {
          console.error("Error checking authentication:", error);
          router.push('/auth/login');
          setIsLoading(false);
        }
      };
      

    checkAuth();
  }, [router]);

  // Check borrowed status of books
  const checkBorrowedStatus = async (userId: string) => {
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

  // Fetch user's favorite books and check reservation status
  const fetchUserFavorites = async (userId: string) => {
    try {
      // Query favorites collection for this user
      const favoritesQuery = query(
        collection(db, "favorites"),
        where("userId", "==", userId)
      );

      const favoritesSnapshot = await getDocs(favoritesQuery);
      const favoritesList: Book[] = [];
      const uniqueCategories = new Set<string>();
      
      // Get all user's reservations to check status
      const reservesQuery = query(
        collection(db, "reserves"),
        where("userId", "==", userId),
        where("status", "==", "reserved")
      );
      
      const reservesSnapshot = await getDocs(reservesQuery);
      const reservedBooks = new Map();
      
      // Create a map of reserved books with their pickup dates
      reservesSnapshot.forEach(doc => {
        const reserveData = doc.data();
        const pickupDate = reserveData.pickupDate?.toDate ? 
          reserveData.pickupDate.toDate() : 
          reserveData.pickupDate ? new Date(reserveData.pickupDate) : null;
        
        reservedBooks.set(reserveData.bookId, {
          isReserved: true,
          reservationDate: pickupDate
        });
      });

      // Fetch details for each favorite book
      for (const favoriteDoc of favoritesSnapshot.docs) {
        const favoriteData = favoriteDoc.data();
        const bookDocRef = doc(db, "books", favoriteData.bookId);
        const bookDoc = await getDoc(bookDocRef);

        if (bookDoc.exists()) {
          const bookData = bookDoc.data() as Book;
          const reservationInfo = reservedBooks.get(bookDoc.id) || { isReserved: false, reservationDate: null };

          // Add to favorites list with reservation status
          favoritesList.push({
            ...bookData,
            id: bookDoc.id,
            favoriteId: favoriteDoc.id,
            addedAt: favoriteData.addedAt,
            isReserved: reservationInfo.isReserved,
            reservationDate: reservationInfo.reservationDate
          });

          // Collect unique categories
          if (bookData.categories) {
            bookData.categories.forEach(category => uniqueCategories.add(category));
          }
        }
      }

      // Set state with favorites and categories
      setFavorites(favoritesList);
      setFilteredFavorites(favoritesList);
      setCategories(Array.from(uniqueCategories).sort());
      
      // Check borrowed status
      await checkBorrowedStatus(userId);
      
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      setIsLoading(false);
    }
  };

  // Filter and sort favorites
  useEffect(() => {
    if (favorites.length === 0) return;

    let filtered = [...favorites];

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
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(book =>
        book.categories && book.categories.includes(selectedCategory)
      );
    }

    // Apply sorting
    if (sortBy === 'recent') {
      filtered.sort((a, b) => {
        if (!a.addedAt || !b.addedAt) return 0;
        return b.addedAt.toDate ? b.addedAt.toDate().getTime() - a.addedAt.toDate().getTime() : 0;
      });
    } else if (sortBy === 'title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      filtered.sort((a, b) => a.author.localeCompare(b.author));
    }

    setFilteredFavorites(filtered);
  }, [favorites, searchQuery, selectedCategory, sortBy]);

  // Remove from favorites (using custom confirmation)
  const handleRemoveFavorite = (favoriteId: string, bookTitle: string) => {
    setBookToRemove({ favoriteId, bookTitle });
    setShowRemoveConfirm(true);
  };

  const confirmRemoveFavorite = async () => {
    if (!bookToRemove) return;

    try {
      await deleteDoc(doc(db, "favorites", bookToRemove.favoriteId));

      // Update state
      setFavorites(prev => prev.filter(book => book.favoriteId !== bookToRemove.favoriteId));
      
      // Show toast notification
      showToastNotification(`"${bookToRemove.bookTitle}" has been removed from your favorites`, "success");
      
      setShowRemoveConfirm(false);
      setBookToRemove(null);
    } catch (error) {
      console.error("Error removing from favorites:", error);
      showToastNotification("Failed to remove book from favorites", "error");
    }
  };

  // Reserve a book - show date picker
  const handleReserveBook = async (book: Book) => {
    setSelectedReservationDate(new Date()); // Set initial date
    setSelectedBook(book);
  };

  // Function to actually reserve the book with the selected date
  const reserveBook = async () => {
    if (!selectedBook || !selectedReservationDate) return;

    try {
      setIsReserving(true);

      const userId = localStorage.getItem('user_id');
      if (!userId) return;

      // Create a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);

      // 1. Add to reserves collection with reservation date
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

      // Update UI - set isReserved to true and add reservationDate
      setFavorites(prev =>
        prev.map(book =>
          book.id === selectedBook.id
            ? { ...book, isReserved: true, reservationDate: selectedReservationDate }
            : book
        )
      );
      setFilteredFavorites(prev =>
        prev.map(book =>
          book.id === selectedBook.id
            ? { ...book, isReserved: true, reservationDate: selectedReservationDate }
            : book
        )
      );
      
      // Show success state
      setReservationSuccess(true);
      
      // Auto-close after 3 seconds
      setTimeout(() => {
        setSelectedBook(null);
        setSelectedReservationDate(null);
        setReservationSuccess(false);
        setIsReserving(false);
      }, 3000);

    } catch (error) {
      console.error("Error reserving book:", error);
      showToastNotification("Failed to reserve book", "error");
      setIsReserving(false);
    }
  };

  // Handle cancel reservation (show confirmation first)
  const handleCancelReservation = (book: Book) => {
    setSelectedBook(book);
    setShowCancelConfirm(true);
  };

  const dismissCancelConfirm = () => {
    setShowCancelConfirm(false);
    setSelectedBook(null); // This is important to prevent the date picker from showing
  };

  // Function to actually cancel reservation after confirmation
  const confirmCancelReservation = async () => {
    if (!selectedBook) return;
    
    try {
      setIsReserving(true);
      const userId = localStorage.getItem('user_id');
      if (!userId) return;

      // Create a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);

      // 1. Construct the document ID for the reservation
      const reserveId = `${userId}_${selectedBook.id}`;
      const reserveRef = doc(db, "reserves", reserveId);
      
      // Delete the reservation document
      batch.delete(reserveRef);

      // 2. Update the book's copies count (increment by 1)
      const bookRef = doc(db, "books", selectedBook.id);
      batch.update(bookRef, {
        copies: increment(1) // Use Firestore's increment function to safely increment
      });

      // Commit the batch
      await batch.commit();

      // Update UI - set isReserved to false and remove reservationDate
      setFavorites(prev =>
        prev.map(b =>
          b.id === selectedBook.id
            ? { ...b, isReserved: false, reservationDate: null }
            : b
        )
      );
      setFilteredFavorites(prev =>
        prev.map(b =>
          b.id === selectedBook.id
            ? { ...b, isReserved: false, reservationDate: null }
            : b
        )
      );
      
      // Show toast notification
      showToastNotification(`Reservation for "${selectedBook.title}" has been cancelled`, "success");

      setIsReserving(false);
      setShowCancelConfirm(false);
      setSelectedBook(null);
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      showToastNotification("Failed to cancel reservation", "error");
      setIsReserving(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your favorites...</p>
      </div>
    );
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.pageHeader}>
        
        <h3 className={styles.headerDescription}>
          Books you've saved to your favorites collection
        </h3>

        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <FiSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search your favorites..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <div className={styles.categoryFilter}>
              <FiFilter className={styles.filterIcon} />
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className={styles.filterSelect}
              >
                <option value="All">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className={styles.sortFilter}>
              <label htmlFor="sortBy" className={styles.sortLabel}>Sort by:</label>
              <select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className={styles.sortSelect}
              >
                <option value="recent">Recently Added</option>
                <option value="title">Title</option>
                <option value="author">Author</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      <div className={styles.booksGrid}>
        {filteredFavorites.length > 0 ? (
          filteredFavorites.map(book => (
            <div key={book.favoriteId} className={styles.bookCard}>
              <div className={styles.bookCover}>
                {book.coverImage ? (
                  <Image
                    src={book.coverImage}
                    alt={book.title}
                    width={180}
                    height={280}
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
                {book.isReserved && (
                  <div className={styles.statusBadge}>Reserved</div>
                )}
                {borrowedBookIds.has(book.id) && (
                  <div className={`${styles.statusBadge} ${styles.borrowed}`}>Borrowed</div>
                )}
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

                {book.isReserved && book.reservationDate && (
                  <div className={styles.reservationInfo}>
                    <FiCalendar className={styles.infoIcon} />
                    <p>Pick up by: {formatDate(book.reservationDate)}</p>
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
                  {borrowedBookIds.has(book.id) ? (
                    <button
                      className={`${styles.borrowedButton} ${styles.disabled}`}
                      disabled={true}
                    >
                      <FiBookmark /> Borrowed
                    </button>
                  ) : book.isReserved ? (
                    <button
                      className={styles.cancelButton}
                      onClick={() => handleCancelReservation(book)}
                      disabled={isReserving}
                    >
                      <FiBookmark /> Cancel Reservation
                    </button>
                  ) : (
                    <button
                      className={styles.reserveButton}
                      onClick={() => handleReserveBook(book)}
                      disabled={isReserving && selectedBook?.id === book.id}
                    >
                      <FiBookmark /> Reserve
                    </button>
                  )}
                  
                  <button
                    className={styles.removeButton}
                    onClick={() => handleRemoveFavorite(book.favoriteId!, book.title)}
                  >
                    <FiTrash2 /> Remove
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>❤️</div>
            <h3>No favorites yet</h3>
            <p>
              {searchQuery || selectedCategory !== 'All'
                ? 'Try adjusting your search or filter criteria'
                : 'Start adding books to your favorites to see them here.'}
            </p>
            <Link href="/user/catalog" className={styles.browseButton}>
              Browse Catalog
            </Link>
          </div>
        )}
      </div>
      
      {/* Toast Notification */}
      {showToast && (
        <div className={styles.toastContainer}>
          <div className={`${styles.toast} ${styles[toastType]}`}>
            <div className={styles.toastIcon}>
              {toastType === 'success' ? <FiHeart /> : '⚠️'}
            </div>
            <span className={styles.toastMessage}>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Remove Confirmation Popup */}
      {showRemoveConfirm && bookToRemove && (
        <div className={styles.confirmationOverlay}>
          <div className={`${styles.confirmationPopup} ${styles.remove}`}>
            <div className={`${styles.confirmationIcon} ${styles.removeIcon}`}>
              🗑️
            </div>
            <h3>Remove from Favorites</h3>
            <p>Remove "{bookToRemove.bookTitle}" from your favorites?</p>
            <div className={styles.confirmationButtons}>
              <button 
                className={styles.removeConfirmButton}
                onClick={confirmRemoveFavorite}
              >
                Yes, Remove
              </button>
              <button 
                className={`${styles.cancelButton} ${styles.popup}`}
                onClick={() => setShowRemoveConfirm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
                disabled={isReserving}
              >
                {isReserving ? "Processing..." : "Yes, Cancel"}
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

      {/* Date Picker Popup */}
      {selectedBook && selectedReservationDate !== undefined && !showCancelConfirm && !selectedBook.isReserved && (
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
                    onClick={reserveBook} 
                    disabled={!selectedReservationDate || isReserving}
                  >
                    {isReserving ? "Reserving..." : "Confirm Reservation"}
                  </button>
                  <button 
                    className={`${styles.cancelButton} ${styles.popup}`}
                    onClick={() => {
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
    </main>
  );
}

// src/app/user/borrowed/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { FiRefreshCw, FiFilter, FiBook, FiCalendar, FiClock, FiCheck, FiX, FiInfo } from 'react-icons/fi';
import styles from './borrowed.module.css';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';


// Define types for book data
interface Book {
  id: string;
  title: string;
  author: string;
  coverImage: string;
  description: string;
  categories: string[];
  publishedDate: string;
  status?: 'borrowed' | 'overdue';
  borrowId?: string;
  borrowedAt: Date;
  dueDate: Date;
  renewals: number;
  renewable: boolean;
  isbn: string;
}

// Define types for notifications
interface Notification {
  userId: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  createdAt: any;
  read: boolean;
}

// Define toast notification type
interface ToastNotification {
  message: string;
  type: 'success' | 'error';
  visible: boolean;
}

export default function BorrowedBooksPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [borrowedBooks, setBorrowedBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('dueDate');
  const [userData, setUserData] = useState<any>(null);
  const [userInitial, setUserInitial] = useState('');
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [maxRenewalDate, setMaxRenewalDate] = useState<Date | null>(null);
  const [isRenewing, setIsRenewing] = useState(false);
  
  const handleDateChange = (date: Date | null) => {
    setNewDueDate(date);
  };
  
  // Toast notification state
  const [toast, setToast] = useState<ToastNotification>({
    message: '',
    type: 'success',
    visible: false
  });

  // Format date to dd MMM yyyy (e.g., 17 Mar 2025)
  const formatDate = (date: Date) => {
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({
      message,
      type,
      visible: true
    });
    
    // Auto-hide toast after 3 seconds
    setTimeout(() => {
      setToast(prev => ({ ...prev, visible: false }));
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
              lastName: userData.lastName || '',
              libraryId: userData.libraryId || ''
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
            fetchBorrowedBooks(userId);
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

  // Fetch user's borrowed books
  const fetchBorrowedBooks = async (userId: string) => {
    try {
      // Query borrows collection for this user
      const borrowsQuery = query(
        collection(db, "borrows"),
        where("userId", "==", userId),
        where("status", "in", ["borrowed", "overdue"])
      );
      
      const borrowsSnapshot = await getDocs(borrowsQuery);
      const borrowedList: Book[] = [];
      
      // Fetch details for each borrowed book
      for (const borrowDoc of borrowsSnapshot.docs) {
        const borrowData = borrowDoc.data();
        const bookDocRef = doc(db, "books", borrowData.bookId);
        const bookDoc = await getDoc(bookDocRef);
        
        if (bookDoc.exists()) {
          const bookData = bookDoc.data();
          
          // Get borrowed date
          const borrowedDate = borrowData.borrowedAt?.toDate ? 
            borrowData.borrowedAt.toDate() : 
            new Date(borrowData.borrowedAt);
          
          // Calculate or get due date (should be 14 days after borrowing)
          let dueDate;
          if (borrowData.dueDate) {
            dueDate = borrowData.dueDate.toDate ? 
              borrowData.dueDate.toDate() : 
              new Date(borrowData.dueDate);
          } else {
            // If no due date is set, calculate it as borrowedDate + 14 days
            dueDate = new Date(borrowedDate);
            dueDate.setDate(borrowedDate.getDate() + 14); // 14 days from borrow date
            
            // Update the borrow document with the calculated due date
            await updateDoc(doc(db, "borrows", borrowDoc.id), {
              dueDate: dueDate
            });
          }
          
          // Check if book is overdue
          const isOverdue = dueDate < new Date();
          
          // Add to borrowed list
          borrowedList.push({
            id: bookDoc.id,
            title: bookData.title || '',
            author: bookData.author || '',
            coverImage: bookData.coverImage || '',
            description: bookData.description || '',
            categories: bookData.categories || [],
            publishedDate: bookData.publishedDate || '',
            isbn: bookData.isbn || '',
            borrowId: borrowDoc.id,
            status: isOverdue ? 'overdue' : 'borrowed',
            borrowedAt: borrowedDate,
            dueDate: dueDate,
            renewals: borrowData.renewals || 0,
            renewable: (borrowData.renewals || 0) < 3
          });
        }
      }
      
      // Set state with borrowed books
      setBorrowedBooks(borrowedList);
      setFilteredBooks(borrowedList);
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching borrowed books:", error);
      setIsLoading(false);
    }
  };

  // Filter and sort borrowed books
  useEffect(() => {
    if (borrowedBooks.length === 0) return;
    
    let filtered = [...borrowedBooks];
    
    // Apply status filter
    if (filterStatus === 'borrowed') {
      filtered = filtered.filter(book => book.status === 'borrowed');
    } else if (filterStatus === 'overdue') {
      filtered = filtered.filter(book => book.status === 'overdue');
    }
    
    // Apply sort
    if (sortBy === 'dueDate') {
      filtered.sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
    } else if (sortBy === 'title') {
      filtered.sort((a, b) => a.title.localeCompare(b.title));
    } else if (sortBy === 'author') {
      filtered.sort((a, b) => a.author.localeCompare(b.author));
    } else if (sortBy === 'recent') {
      filtered.sort((a, b) => b.borrowedAt.getTime() - a.borrowedAt.getTime());
    }
    
    setFilteredBooks(filtered);
  }, [borrowedBooks, filterStatus, sortBy]);

  // Add a notification
  const addNotification = async (notification: Omit<Notification, 'read'>) => {
    try {
      await addDoc(collection(db, "notifications"), {
        ...notification,
        read: false
      });
    } catch (error) {
      console.error("Error adding notification:", error);
    }
  };

  // Open renewal modal with calculated max date
  const openRenewModal = (book: Book) => {
    // Check if book is renewable
    if (!book.renewable) {
      showToast("You've reached the maximum number of renewals for this book.", "error");
      return;
    }

    // Calculate max renewal date based on renewal count
    const maxDate = new Date(book.dueDate);
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

  // Renew book with selected date
  const renewBook = async () => {
    try {
      if (!selectedBook || !selectedBook.borrowId || !newDueDate) return;
      
      setIsRenewing(true);
      
      const userId = localStorage.getItem('user_id');
      if (!userId) return;
      
      // Update the borrow document
      await updateDoc(doc(db, "borrows", selectedBook.borrowId), {
        renewals: selectedBook.renewals + 1,
        dueDate: newDueDate,
        status: 'borrowed'
      });
      
      // Add notification
      await addNotification({
        userId: userId,
        title: "Book Renewed",
        message: `"${selectedBook.title}" has been renewed. New due date: ${formatDate(newDueDate)}.`,
        type: "success",
        createdAt: new Date()
      });
      
      // Add activity log for librarian dashboard
      await addDoc(collection(db, "activity_logs"), {
        userId: userId,
        userEmail: userData.email,
        userLibraryId: userData.libraryId,
        bookId: selectedBook.id,
        bookTitle: selectedBook.title,
        actionType: "renew",
        timestamp: serverTimestamp(),
        details: {
          previousDueDate: formatDate(selectedBook.dueDate),
          newDueDate: formatDate(newDueDate),
          renewalCount: selectedBook.renewals + 1
        }
      });
      
      // Update UI
      setBorrowedBooks(prev => prev.map(b => {
        if (b.borrowId === selectedBook.borrowId) {
          return {
            ...b,
            dueDate: newDueDate,
            renewals: b.renewals + 1,
            renewable: (b.renewals + 1) < 3,
            status: 'borrowed'
          };
        }
        return b;
      }));
      
      // Close modal and reset
      setShowRenewModal(false);
      setSelectedBook(null);
      setNewDueDate(null);
      setIsRenewing(false);
      
      // Show success toast notification
      showToast(`Book renewed successfully. New due date: ${formatDate(newDueDate)}`, "success");
    } catch (error) {
      console.error("Error renewing book:", error);
      showToast("Failed to renew book. Please try again later.", "error");
    } finally {
      setIsRenewing(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your borrowed books...</p>
      </div>
    );
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.pageHeader}>
        
        <h3 className={styles.headerDescription}>
          Books you've currently checked out from the library
        </h3>
        
        <div className={styles.filterBar}>
          <div className={styles.statusFilter}>
            <FiFilter className={styles.filterIcon} />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="all">All Books</option>
              <option value="borrowed">Borrowed</option>
              <option value="overdue">Overdue</option>
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
              <option value="dueDate">Due Date</option>
              <option value="recent">Recently Borrowed</option>
              <option value="title">Title</option>
              <option value="author">Author</option>
            </select>
          </div>
        </div>
      </header>

      <div className={styles.booksGrid}>
        {filteredBooks.length > 0 ? (
          filteredBooks.map(book => (
            <div key={book.borrowId} className={styles.bookCard}>
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
                <div className={`${styles.statusBadge} ${book.status === 'overdue' ? styles.overdue : ''}`}>
                  {book.status === 'overdue' ? 'Overdue' : 'Borrowed'}
                </div>
              </div>
              <div className={styles.bookInfo}>
                <h2 className={styles.bookTitle}>{book.title}</h2>
                <p className={styles.bookAuthor}>by {book.author}</p>
                <p className={styles.bookIsbn}>ISBN: {book.isbn || 'Not available'}</p>
                
                {book.categories && book.categories.length > 0 && (
                  <div className={styles.categories}>
                    {book.categories.slice(0, 3).map((category, index) => (
                      <span key={index} className={styles.category}>{category}</span>
                    ))}
                  </div>
                )}
                
                <div className={styles.borrowDetails}>
                  <div className={styles.dateInfo}>
                    <FiCalendar className={styles.dateIcon} />
                    <div>
                      <p className={styles.borrowedDate}>
                        Borrowed on: {formatDate(book.borrowedAt)}
                      </p>
                      <p className={`${styles.dueDate} ${book.status === 'overdue' ? styles.overdue : ''}`}>
                        Due on: {formatDate(book.dueDate)}
                      </p>
                    </div>
                  </div>
                  <div className={styles.renewalInfo}>
                    <FiRefreshCw className={styles.renewIcon} />
                    <p className={styles.renewals}>
                      Renewals: {book.renewals}/3
                    </p>
                  </div>
                </div>
                
                <div className={styles.bookActions}>
                  {book.renewals < 3 ? (
                    <button 
                      className={styles.renewButton}
                      onClick={() => openRenewModal(book)}
                      disabled={isRenewing && selectedBook?.id === book.id}
                    >
                      <FiRefreshCw /> Renew
                    </button>
                  ) : (
                    <button 
                      className={`${styles.renewButton} ${styles.disabled}`}
                      disabled={true}
                    >
                      <FiRefreshCw /> Max Renewals
                    </button>
                  )}
                  <div className={styles.infoNote}>
                    <FiInfo className={styles.infoIcon} />
                    <span>Please visit the library to return this book</span>
                  </div>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>📚</div>
            <h3>No borrowed books</h3>
            <p>
              {filterStatus !== 'all' 
                ? `You don't have any ${filterStatus} books at the moment.` 
                : 'You don\'t have any books checked out at the moment.'}
            </p>
            <Link href="/user/catalog" className={styles.browseButton}>
              Browse Catalog
            </Link>
          </div>
        )}
      </div>

      {/* Renewal Modal */}
      {showRenewModal && selectedBook && (
        <div className={styles.modalOverlay}>
          <div className={styles.renewalModal}>
            <h3>Renew Book</h3>
            <p className={styles.renewBookTitle}>{selectedBook.title}</p>
            
            <div className={styles.renewalInfo}>
              <p>Current due date: {formatDate(selectedBook.dueDate)}</p>
              <p>Renewals used: {selectedBook.renewals}/3</p>
              {selectedBook.renewals === 2 ? (
                <p>You can extend the due date by up to 5 days from the current due date.</p>
              ) : (
                <p>You can extend the due date by up to 10 days from the current due date.</p>
              )}
            </div>
            
            <div className={styles.datePickerContainer}>
              <label>New Due Date:</label>
              <DatePicker
  selected={newDueDate}
  onChange={(date: Date | null) => handleDateChange(date)}
  minDate={selectedBook.dueDate}
  maxDate={maxRenewalDate}
  dateFormat="dd MMM yyyy"
  className={styles.datePicker}
  popperPlacement="top-start"
  required
/>

            </div>
            
            <div className={styles.modalActions}>
              <button 
                className={styles.cancelButton}
                onClick={() => setShowRenewModal(false)}
                type="button"
              >
                Cancel
              </button>
              <button 
                className={styles.confirmButton}
                onClick={(e) => {
                  e.preventDefault();
                  renewBook();
                }}
                type="button"
                disabled={isRenewing}
              >
                {isRenewing ? "Processing..." : "Confirm Renewal"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <div className={styles.toastContainer}>
          <div className={`${styles.toast} ${styles[toast.type]}`}>
            <div className={styles.toastIcon}>
              {toast.type === 'success' ? <FiCheck /> : <FiX />}
            </div>
            <span className={styles.toastMessage}>{toast.message}</span>
          </div>
        </div>
      )}
    </main>
  );
}

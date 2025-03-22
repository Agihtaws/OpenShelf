"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '../../../firebaseConfig';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  updateDoc, 
  addDoc,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { FiSearch, FiFilter, FiBookOpen, FiArrowLeft, FiTag, FiBook, FiUser, FiGrid, FiList } from 'react-icons/fi';
import styles from './Stocks.module.css';

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
  acquisitionDate: string;
  price: number;
  status: 'Available' | 'Unavailable';
  notes: string;
  addedAt?: any;
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  libraryCardId: string;
  borrowedCount: number;
  borrowedBooks: string[]; // Array of book IDs the user has borrowed
}

interface BorrowModalProps {
  book: Book;
  onClose: () => void;
  onBorrow: (userId: string, libCardId: string, numBooks: number, userName: string) => void;
}

export default function StocksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState('title');
  const [sortDirection, setSortDirection] = useState('asc');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [borrowingBook, setBorrowingBook] = useState<Book | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch books from Firestore
  const fetchBooks = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');
    
    try {
      // Create a query ordered by title
      const booksQuery = query(
        collection(db, "books"),
        orderBy("title", "asc")
      );
      
      const querySnapshot = await getDocs(booksQuery);
      const booksData: Book[] = querySnapshot.docs.map(doc => {
        const data = doc.data() as Book;
        // Ensure numeric values are valid numbers or default to 0
        const copies = typeof data.copies === 'number' && !isNaN(data.copies) ? data.copies : 0;
        
        // Simplify status to just Available/Unavailable
        const bookStatus = copies > 0 ? 'Available' : 'Unavailable';
        
        return { 
          ...data, 
          id: doc.id,
          copies: copies,
          pageCount: typeof data.pageCount === 'number' && !isNaN(data.pageCount) ? data.pageCount : 0,
          price: typeof data.price === 'number' && !isNaN(data.price) ? data.price : 0,
          // Ensure categories is always an array
          categories: Array.isArray(data.categories) ? data.categories : [],
          // Simplify status
          status: bookStatus
        };
      });
      
      // Extract unique categories
      const uniqueCategories = new Set<string>();
      booksData.forEach(book => {
        if (book.categories && book.categories.length > 0) {
          book.categories.forEach(category => {
            uniqueCategories.add(category);
          });
        }
      });
      
      setCategories(Array.from(uniqueCategories).sort());
      setBooks(booksData);
      setFilteredBooks(booksData);
    } catch (error) {
      console.error("Error fetching books:", error);
      setErrorMessage("Failed to load book inventory. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchBooks();
  }, [fetchBooks]);

  // Filter and sort books when search query, status filter, or sort options change
  useEffect(() => {
    if (books.length === 0) return;

    let result = [...books];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(book => 
        (book.title || '').toLowerCase().includes(query) ||
        (book.author || '').toLowerCase().includes(query) ||
        (book.isbn || '').toLowerCase().includes(query) ||
        (book.shelfNumber || '').toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'All') {
      result = result.filter(book => book.status === statusFilter);
    }
    
    // Apply category filter
    if (categoryFilter !== 'All') {
      result = result.filter(book => 
        book.categories && book.categories.includes(categoryFilter)
      );
    }
    
    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'title':
          comparison = (a.title || '').localeCompare(b.title || '');
          break;
        case 'author':
          comparison = (a.author || '').localeCompare(b.author || '');
          break;
        case 'copies':
          // Ensure copies are valid numbers
          const aCopies = typeof a.copies === 'number' && !isNaN(a.copies) ? a.copies : 0;
          const bCopies = typeof b.copies === 'number' && !isNaN(b.copies) ? b.copies : 0;
          comparison = aCopies - bCopies;
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
        case 'addedAt':
          const aTime = a.addedAt?.seconds || 0;
          const bTime = b.addedAt?.seconds || 0;
          comparison = aTime - bTime;
          break;
        default:
          comparison = (a.title || '').localeCompare(b.title || '');
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
    
    setFilteredBooks(result);
  }, [books, searchQuery, statusFilter, categoryFilter, sortBy, sortDirection]);

  // Handle sort change
  const handleSortChange = useCallback((field: string) => {
    setSortBy(prevField => {
      const newDirection = prevField === field && sortDirection === 'asc' ? 'desc' : 'asc';
      setSortDirection(newDirection);
      return field;
    });
  }, [sortDirection]);

  // Handle borrow book
  const handleBorrowClick = useCallback((book: Book) => {
    setBorrowingBook(book);
  }, []);

  // Handle borrow submission
  const handleBorrowSubmit = useCallback(async (userId: string, libCardId: string, numBooks: number, userName: string) => {
    if (!borrowingBook) return;
    
    try {
      // Ensure numBooks is a valid number
      if (typeof numBooks !== 'number' || isNaN(numBooks) || numBooks <= 0) {
        setErrorMessage("Number of books must be greater than 0");
        return;
      }
      
      // Ensure copies is a valid number
      const bookCopies = typeof borrowingBook.copies === 'number' && !isNaN(borrowingBook.copies) 
        ? borrowingBook.copies : 0;
      
      if (numBooks > bookCopies) {
        setErrorMessage(`Only ${bookCopies} copies available for borrowing`);
        return;
      }
      
      // Calculate due date (2 weeks from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);
      
      // Update book copies in database
      const bookRef = doc(db, "books", borrowingBook.id);
      const newCopies = bookCopies - numBooks;
      
      await updateDoc(bookRef, {
        copies: newCopies,
        status: newCopies > 0 ? 'Available' : 'Unavailable'
      });
      
      // Add borrow record
      await addDoc(collection(db, "borrows"), {
        userId: userId,
        bookId: borrowingBook.id,
        bookTitle: borrowingBook.title || '',
        bookAuthor: borrowingBook.author || '',
        bookCover: borrowingBook.coverImage || '',
        quantity: numBooks,
        borrowedAt: serverTimestamp(),
        dueDate: dueDate,
        status: "borrowed",
        renewals: 0
      });
      
      // Update local state
      setBooks(prevBooks => prevBooks.map(book => {
        if (book.id === borrowingBook.id) {
          const bookCopies = typeof book.copies === 'number' && !isNaN(book.copies) ? book.copies : 0;
          const newCopies = bookCopies - numBooks;
          return {
            ...book,
            copies: newCopies,
            status: newCopies > 0 ? 'Available' : 'Unavailable'
          };
        }
        return book;
      }));
      
      setSuccessMessage(`${numBooks} ${numBooks === 1 ? 'copy' : 'copies'} of "${borrowingBook.title || ''}" has been borrowed by ${userName}.`);
      setBorrowingBook(null);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error borrowing book:", error);
      setErrorMessage("Failed to process borrowing. Please try again.");
    }
  }, [borrowingBook]);

  // Handle click outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setBorrowingBook(null);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get user's initial from email
  const getUserInitial = (email: string) => {
    if (!email) return '';
    return email.charAt(0).toUpperCase();
  };

  // Generate avatar background color based on email
  const getAvatarColor = (email: string) => {
    if (!email) return '#6c757d'; // default gray
    
    // Simple hash function to generate consistent color
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      hash = email.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Convert hash to RGB color
    const hue = hash % 360;
    return `hsl(${hue}, 70%, 60%)`;
  };

  // Borrow Modal Component
  const BorrowModal = ({ book, onClose, onBorrow }: BorrowModalProps) => {
    const [libCardId, setLibCardId] = useState('');
    const [numBooks, setNumBooks] = useState(1);
    const [isVerifying, setIsVerifying] = useState(false);
    const [verifiedUser, setVerifiedUser] = useState<User | null>(null);
    const [verificationError, setVerificationError] = useState('');
    const [alreadyBorrowed, setAlreadyBorrowed] = useState(false);
    
    // Ensure book.copies is a valid number
    const bookCopies = typeof book.copies === 'number' && !isNaN(book.copies) ? book.copies : 0;
    
    // Verify library card ID
    const verifyLibraryCard = async () => {
      if (!libCardId.trim()) {
        setVerificationError('Please enter a library card ID');
        return;
      }
      
      setIsVerifying(true);
      setVerificationError('');
      setAlreadyBorrowed(false);
      
      try {
        // Query users_customer collection for matching library card ID
        const usersQuery = query(
          collection(db, "users_customer"),
          where("libraryCardId", "==", libCardId.trim())
        );
        
        const querySnapshot = await getDocs(usersQuery);
        
        if (querySnapshot.empty) {
          setVerificationError('No user found with this library card ID');
          setVerifiedUser(null);
        } else {
          const userDoc = querySnapshot.docs[0];
          const userData = userDoc.data();
          
          // Get count of currently borrowed books and check if this book is already borrowed
          const borrowsQuery = query(
            collection(db, "borrows"),
            where("userId", "==", userDoc.id),
            where("status", "in", ["borrowed", "overdue"])
          );
          
          const borrowsSnapshot = await getDocs(borrowsQuery);
          const borrowedCount = borrowsSnapshot.size;
          
          // Check if user has already borrowed this specific book
          const hasAlreadyBorrowedThisBook = borrowsSnapshot.docs.some(
            doc => doc.data().bookId === book.id
          );
          
          setAlreadyBorrowed(hasAlreadyBorrowedThisBook);
          
          // Get list of borrowed book IDs
          const borrowedBooks = borrowsSnapshot.docs.map(doc => doc.data().bookId);
          
          setVerifiedUser({
            id: userDoc.id,
            firstName: userData.firstName || '',
            lastName: userData.lastName || '',
            email: userData.email || '',
            libraryCardId: userData.libraryCardId || '',
            borrowedCount: borrowedCount,
            borrowedBooks: borrowedBooks
          });
        }
      } catch (error) {
        console.error("Error verifying library card:", error);
        setVerificationError('Failed to verify library card. Please try again.');
      } finally {
        setIsVerifying(false);
      }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      
      if (!verifiedUser) {
        verifyLibraryCard();
        return;
      }
      
      onBorrow(
        verifiedUser.id, 
        verifiedUser.libraryCardId, 
        numBooks, 
        `${verifiedUser.firstName} ${verifiedUser.lastName}`
      );
    };
    
    // Create user avatar display
    const UserAvatar = ({ email }: { email: string }) => {
      const initial = getUserInitial(email);
      const bgColor = getAvatarColor(email);
      
      return (
        <div 
          className={styles.userAvatar} 
          style={{ backgroundColor: bgColor }}
        >
          {initial}
        </div>
      );
    };
    
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.modal} ref={modalRef}>
          <div className={styles.modalHeader}>
            <h2>Borrow Book</h2>
            <button 
              className={styles.closeButton}
              onClick={onClose}
            >
              &times;
            </button>
          </div>
          
          <div className={styles.modalBookInfo}>
            {book.coverImage ? (
              <Image 
                src={book.coverImage} 
                alt={book.title || 'Book cover'}
                width={60}
                height={90}
                className={styles.modalCover}
                unoptimized={true}
              />
            ) : (
              <div className={styles.noImageThumb}>
                <FiBook size={40} />
              </div>
            )}
            <div>
              <h3>{book.title || 'Untitled'}</h3>
              <p>{book.author || 'Unknown author'}</p>
              <p className={styles.availableCopies}>Available copies: {bookCopies}</p>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className={styles.borrowForm}>
            <div className={styles.formGroup}>
              <label htmlFor="libCardId">Library Card ID</label>
              <div className={styles.inputWithButton}>
                <input
                  type="text"
                  id="libCardId"
                  value={libCardId}
                  onChange={(e) => {
                    setLibCardId(e.target.value);
                    setVerifiedUser(null);
                    setAlreadyBorrowed(false);
                  }}
                  disabled={!!verifiedUser}
                  required
                  placeholder="Enter customer's library card ID"
                />
                {!verifiedUser && (
                  <button 
                    type="button" 
                    className={styles.verifyButton}
                    onClick={verifyLibraryCard}
                    disabled={isVerifying || !libCardId.trim()}
                  >
                    {isVerifying ? 'Verifying...' : 'Verify'}
                  </button>
                )}
              </div>
              {verificationError && (
                <p className={styles.verificationError}>{verificationError}</p>
              )}
            </div>
            
            {verifiedUser && (
              <>
                <div className={styles.userInfo}>
                  {verifiedUser.email ? (
                    <UserAvatar email={verifiedUser.email} />
                  ) : (
                    <div className={styles.userIcon}>
                      <FiUser size={24} />
                    </div>
                  )}
                  <div>
                    <h4>{verifiedUser.firstName} {verifiedUser.lastName}</h4>
                    <p className={styles.userEmail}>{verifiedUser.email}</p>
                    <p className={styles.borrowCount}>
                      Currently borrowed books: {verifiedUser.borrowedCount}
                    </p>
                    
                    {alreadyBorrowed && (
                      <p className={styles.alreadyBorrowedMessage}>
                        This user has already borrowed this book
                      </p>
                    )}
                  </div>
                </div>
                
                {!alreadyBorrowed && (
                  <div className={styles.formGroup}>
                    <label htmlFor="numBooks">Number of Books</label>
                    <input
                      type="number"
                      id="numBooks"
                      value={numBooks}
                      onChange={(e) => {
                        const value = parseInt(e.target.value);
                        setNumBooks(isNaN(value) ? 1 : value);
                      }}
                      min="1"
                      max={bookCopies}
                      required
                    />
                  </div>
                )}
              </>
            )}
            
            <div className={styles.modalActions}>
              <button 
                type="button" 
                className={styles.cancelButton}
                onClick={onClose}
              >
                Cancel
              </button>
              <button 
                type="submit" 
                className={styles.borrowButton}
                disabled={!verifiedUser || alreadyBorrowed || numBooks < 1 || numBooks > bookCopies}
              >
                {!verifiedUser ? 'Verify ID' : alreadyBorrowed ? 'Already Borrowed' : 'Borrow'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  // Memoize components to prevent unnecessary re-renders
  const TableHeader = useMemo(() => (
    <div className={styles.tableHeader}>
      <div 
        className={`${styles.tableCell} ${sortBy === 'title' ? styles.sortActive : ''}`}
        onClick={() => handleSortChange('title')}
      >
        Title
        {sortBy === 'title' && (
          <span className={styles.sortIcon}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div 
        className={`${styles.tableCell} ${sortBy === 'author' ? styles.sortActive : ''}`}
        onClick={() => handleSortChange('author')}
      >
        Author
        {sortBy === 'author' && (
          <span className={styles.sortIcon}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div className={styles.tableCell}>Categories</div>
      <div className={styles.tableCell}>Shelf</div>
      <div 
        className={`${styles.tableCell} ${sortBy === 'copies' ? styles.sortActive : ''}`}
        onClick={() => handleSortChange('copies')}
      >
        Copies
        {sortBy === 'copies' && (
          <span className={styles.sortIcon}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div 
        className={`${styles.tableCell} ${sortBy === 'status' ? styles.sortActive : ''}`}
        onClick={() => handleSortChange('status')}
      >
        Status
        {sortBy === 'status' && (
          <span className={styles.sortIcon}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </span>
        )}
      </div>
      <div className={styles.tableCell}>Actions</div>
    </div>
  ), [sortBy, sortDirection, handleSortChange]);

  // Render book rows as a separate component
  const BookRow = useCallback(({ book }: { book: Book }) => {
    // Ensure copies is a valid number
    const bookCopies = typeof book.copies === 'number' && !isNaN(book.copies) ? book.copies : 0;
    
    return (
      <div className={styles.tableRow}>
        <div className={styles.tableCell}>
          <div className={styles.bookTitle}>
            <div className={styles.bookCoverThumb}>
              {book.coverImage ? (
                <Image 
                  src={book.coverImage} 
                  alt={book.title || 'Book cover'}
                  width={40}
                  height={60}
                  unoptimized={true}
                />
              ) : (
                <div className={styles.noImageThumb}>
                  <FiBookOpen size={20} />
                </div>
              )}
            </div>
            <span>{book.title || 'Untitled'}</span>
          </div>
        </div>
        <div className={styles.tableCell}>{book.author || 'Unknown author'}</div>
        <div className={styles.tableCell}>
          <div className={styles.categoriesList}>
            {book.categories && book.categories.length > 0 ? (
              book.categories.map((category, index) => (
                <span key={index} className={styles.categoryPill}>
                  {category}
                </span>
              ))
            ) : (
              <span className={styles.noCategoryLabel}>No categories</span>
            )}
          </div>
        </div>
        <div className={styles.tableCell}>{book.shelfNumber || 'N/A'}</div>
        <div className={styles.tableCell}>{bookCopies}</div>
        <div className={styles.tableCell}>
          <span className={`${styles.statusBadge} ${book.status === 'Available' ? styles.available : styles.unavailable}`}>
            {book.status}
          </span>
        </div>
        <div className={styles.tableCell}>
          <div className={styles.actionButtons}>
            <button 
              className={styles.borrowButton} 
              onClick={() => handleBorrowClick(book)}
              disabled={bookCopies === 0 || book.status !== 'Available'}
              aria-label="Borrow book"
            >
              Borrow
            </button>
          </div>
        </div>
      </div>
    );
  }, [handleBorrowClick]);

  return (
    <div className={styles.stocksPage}>
      <div className={styles.pageHeader}>
       
        
        <h3>Manage your library's book inventory and stock levels</h3>
      </div>
      
      <div className={styles.actionBar}>
        <div className={styles.searchWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search by title, author, ISBN, or shelf number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label htmlFor="statusFilter" className={styles.filterLabel}>
              <FiFilter className={styles.filterIcon} />
              Status:
            </label>
            <select
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="All">All</option>
              <option value="Available">Available</option>
              <option value="Unavailable">Unavailable</option>
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="categoryFilter" className={styles.filterLabel}>
              <FiTag className={styles.filterIcon} />
              Category:
            </label>
            <select
              id="categoryFilter"
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
          
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <FiGrid size={16} />
            </button>
            <button 
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <FiList size={16} />
            </button>
          </div>
        </div>
      </div>
      
      {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
      {successMessage && <div className={styles.successMessage}>{successMessage}</div>}
      
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading inventory...</p>
        </div>
      ) : filteredBooks.length > 0 ? (
        <>
          <div className={styles.timeframeInfo}>
            <p>Book Inventory</p>
            <span className={styles.resultCount}>{filteredBooks.length} books found</span>
          </div>
          
          {viewMode === 'grid' ? (
            <div className={styles.booksGrid}>
              {filteredBooks.map((book) => {
                // Ensure copies is a valid number
                const bookCopies = typeof book.copies === 'number' && !isNaN(book.copies) ? book.copies : 0;
                
                return (
                  <div key={book.id} className={styles.bookCard}>
                    <div className={styles.bookCover}>
                      {book.coverImage ? (
                        <Image 
                          src={book.coverImage} 
                          alt={book.title || 'Book cover'}
                          width={120}
                          height={180}
                          unoptimized={true}
                        />
                      ) : (
                        <div className={styles.noImageCover}>
                          <FiBookOpen size={40} />
                        </div>
                      )}
                    </div>
                    <div className={styles.bookInfo}>
                      <h3 className={styles.bookTitle}>{book.title || 'Untitled'}</h3>
                      <p className={styles.bookAuthor}>by {book.author || 'Unknown author'}</p>
                      
                      <div className={styles.bookDetails}>
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>ISBN:</span>
                          <span className={styles.detailValue}>{book.isbn || 'N/A'}</span>
                        </div>
                        
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Status:</span>
                          <span className={`${styles.statusBadge} ${book.status === 'Available' ? styles.available : styles.unavailable}`}>
                            {book.status}
                          </span>
                        </div>
                        
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Shelf:</span>
                          <span className={styles.detailValue}>{book.shelfNumber || 'N/A'}</span>
                        </div>
                        
                        <div className={styles.detailItem}>
                          <span className={styles.detailLabel}>Copies:</span>
                          <span className={styles.detailValue}>{bookCopies}</span>
                        </div>
                      </div>
                      
                      {book.categories && book.categories.length > 0 && (
                        <div className={styles.categoriesList}>
                          {book.categories.map((category, index) => (
                            <span key={index} className={styles.categoryPill}>
                              {category}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <div className={styles.bookActions}>
                        <button 
                          className={styles.borrowButton} 
                          onClick={() => handleBorrowClick(book)}
                          disabled={bookCopies === 0 || book.status !== 'Available'}
                        >
                          Borrow
                        </button>
                      </div>
                    </div>
                
                    </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.inventoryTable}>
              {TableHeader}
              
              <div className={styles.tableBody}>
                {filteredBooks.map((book) => (
                  <BookRow key={book.id} book={book} />
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FiBookOpen size={48} />
          </div>
          <h3>No books found</h3>
          <p>
            {searchQuery || statusFilter !== 'All' || categoryFilter !== 'All'
              ? 'Try adjusting your search or filters' 
              : 'No books in inventory matching your criteria.'}
          </p>
        </div>
      )}
      
      {/* Borrow Book Modal */}
      {borrowingBook && (
        <BorrowModal 
          book={borrowingBook} 
          onClose={() => setBorrowingBook(null)}
          onBorrow={handleBorrowSubmit}
        />
      )}
    </div>
  );
}

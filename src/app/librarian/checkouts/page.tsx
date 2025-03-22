"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { db } from '../../../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  doc, 
  getDoc, 
  updateDoc, 
  orderBy, 
  Timestamp,
  serverTimestamp,
  addDoc,
  writeBatch,
  increment
} from 'firebase/firestore';
import { 
  FiSearch, 
  FiFilter, 
  FiBookOpen, 
  FiArrowLeft, 
  FiTag, 
  FiGrid, 
  FiList, 
  FiUser, 
  FiCalendar, 
  FiCheckCircle, 
  FiClock,
  FiRefreshCw,
  FiInfo,
  FiAlertTriangle
} from 'react-icons/fi';
import styles from './Checkouts.module.css';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  categories: string[];
  coverImage: string;
  shelfNumber: string;
  copies: number;
  status: 'Available' | 'On Loan' | 'Reserved' | 'Lost' | 'Damaged';
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  libraryCardId: string;
}

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
  book?: Book;
  user?: User;
}

export default function LibrarianCheckoutsPage() {
  const [checkouts, setCheckouts] = useState<Checkout[]>([]);
  const [filteredCheckouts, setFilteredCheckouts] = useState<Checkout[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sortBy, setSortBy] = useState('dueDate');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Renewal modal states
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [selectedCheckout, setSelectedCheckout] = useState<Checkout | null>(null);
  const [newDueDate, setNewDueDate] = useState<Date | null>(null);
  const [maxRenewalDate, setMaxRenewalDate] = useState<Date | null>(null);
  
  // Return confirmation states
  const [showReturnConfirm, setShowReturnConfirm] = useState(false);
  const [checkoutToReturn, setCheckoutToReturn] = useState<Checkout | null>(null);
  
  const router = useRouter();

  // Fetch all checkouts
  useEffect(() => {
    const fetchCheckouts = async () => {
      setIsLoading(true);
      setErrorMessage('');
      
      try {
        // Create a query to get all checkouts
        const checkoutsQuery = query(
          collection(db, "borrows"),
          orderBy("borrowedAt", "desc")
        );
        
        const querySnapshot = await getDocs(checkoutsQuery);
        const checkoutsData: Checkout[] = [];
        
        // For each checkout, fetch the associated book and user details
        for (const checkoutDoc of querySnapshot.docs) {
          const checkoutData = checkoutDoc.data() as Omit<Checkout, 'id'>;
          
          // Fetch book details
          let bookData = null;
          try {
            const bookDoc = await getDoc(doc(db, "books", checkoutData.bookId));
            if (bookDoc.exists()) {
              bookData = { id: bookDoc.id, ...bookDoc.data() } as Book;
            } else {
              console.log(`Book document does not exist for ID: ${checkoutData.bookId}`);
              bookData = {
                id: checkoutData.bookId,
                title: 'Unknown Book',
                author: 'Unknown Author',
                isbn: 'N/A',
                categories: [],
                coverImage: '',
                shelfNumber: 'N/A',
                copies: 0,
                status: 'On Loan' as 'On Loan'
              };
            }
          } catch (error) {
            console.error(`Error fetching book with ID ${checkoutData.bookId}:`, error);
            bookData = {
              id: checkoutData.bookId,
              title: 'Error Loading Book',
              author: 'Error',
              isbn: 'Error',
              categories: [],
              coverImage: '',
              shelfNumber: 'Error',
              copies: 0,
              status: 'On Loan' as 'Available' | 'On Loan' | 'Reserved' | 'Lost' | 'Damaged'
            };
          }
          
          // Fetch user details - Add more error handling and logging
          let userData = null;
          try {
            console.log(`Fetching user with ID: ${checkoutData.userId}`);
            const userDoc = await getDoc(doc(db, "users_customer", checkoutData.userId));
            
            if (userDoc.exists()) {
              const userDocData = userDoc.data();
              console.log(`User data fetched:`, userDocData);
              
              userData = {
                id: userDoc.id,
                firstName: userDocData.firstName || 'Unknown',
                lastName: userDocData.lastName || 'Unknown',
                email: userDocData.email || 'No email',
                libraryCardId: userDocData.libraryCardId || 'No ID'
              };
            } else {
              console.log(`User document does not exist for ID: ${checkoutData.userId}`);
              // Set default values for missing user data
              userData = {
                id: checkoutData.userId,
                firstName: 'Unknown',
                lastName: 'Patron',
                email: 'No email available',
                libraryCardId: 'ID not found'
              };
            }
          } catch (error) {
            console.error(`Error fetching user with ID ${checkoutData.userId}:`, error);
            // Set default values for error case
            userData = {
              id: checkoutData.userId,
              firstName: 'Error',
              lastName: 'Loading User',
              email: 'Error retrieving email',
              libraryCardId: 'Error retrieving ID'
            };
          }
          
          // Convert Firestore timestamps to Date objects
          const borrowedDate = checkoutData.borrowedAt?.toDate ? 
            checkoutData.borrowedAt.toDate() : 
            new Date(checkoutData.borrowedAt);
          
          const dueDate = checkoutData.dueDate?.toDate ? 
            checkoutData.dueDate.toDate() : 
            new Date(checkoutData.dueDate);
          
          const returnDate = checkoutData.returnDate?.toDate ? 
            checkoutData.returnDate.toDate() : 
            checkoutData.returnDate ? new Date(checkoutData.returnDate) : null;
          
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
            returnDate: returnDate,
            status: status,
            book: bookData,
            user: userData
          });
        }
        
        setCheckouts(checkoutsData);
        setFilteredCheckouts(checkoutsData);
      } catch (error) {
        console.error("Error fetching checkouts:", error);
        setErrorMessage("Failed to load checkouts. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchCheckouts();
  }, []);

  // Filter and sort checkouts when search query, status filter, or sort options change
  useEffect(() => {
    if (checkouts.length === 0) return;

    let result = [...checkouts];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(checkout => 
        checkout.book?.title.toLowerCase().includes(query) ||
        checkout.book?.author.toLowerCase().includes(query) ||
        checkout.user?.firstName?.toLowerCase().includes(query) ||
        checkout.user?.lastName?.toLowerCase().includes(query) ||
        checkout.user?.libraryCardId?.toLowerCase().includes(query) ||
        checkout.book?.isbn?.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'All') {
      result = result.filter(checkout => checkout.status === statusFilter.toLowerCase());
    }
    
    // Apply sorting
    if (sortBy === 'dueDate') {
      result.sort((a, b) => {
        if (a.status === 'returned' && b.status !== 'returned') return 1;
        if (a.status !== 'returned' && b.status === 'returned') return -1;
        return a.dueDate.getTime() - b.dueDate.getTime();
      });
    } else if (sortBy === 'borrowDate') {
      result.sort((a, b) => b.borrowedAt.getTime() - a.borrowedAt.getTime());
    } else if (sortBy === 'title') {
      result.sort((a, b) => {
        if (!a.book || !b.book) return 0;
        return a.book.title.localeCompare(b.book.title);
      });
    } else if (sortBy === 'patron') {
      result.sort((a, b) => {
        if (!a.user || !b.user) return 0;
        return `${a.user.lastName}, ${a.user.firstName}`.localeCompare(`${b.user.lastName}, ${b.user.firstName}`);
      });
    }
    
    setFilteredCheckouts(result);
  }, [checkouts, searchQuery, statusFilter, sortBy]);

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

      // Create a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);
      
      // Update checkout status
      batch.update(doc(db, "borrows", checkoutToReturn.id), {
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
          
          batch.update(bookRef, {
            copies: increment(checkoutToReturn.quantity || 1),
            status: (currentCopies + (checkoutToReturn.quantity || 1) > 0) ? 'Available' : bookData.status
          });
        }
      }

      // Commit the batch
      await batch.commit();
      
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
      setCheckouts(prevCheckouts => 
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
      setErrorMessage("Failed to update checkout status. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Open renewal modal
  const openRenewModal = (checkout: Checkout) => {
    // Check if checkout has already been renewed 3 times
    if (checkout.renewals >= 3) {
      setErrorMessage("This book cannot be renewed more than 3 times.");
      setTimeout(() => setErrorMessage(''), 3000);
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
      setCheckouts(prevCheckouts => 
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
      setErrorMessage("Failed to renew checkout. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Format date
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Check if a checkout is overdue
  const isOverdue = (checkout: Checkout): boolean => {
    const today = new Date();
    return checkout.dueDate < today && checkout.status !== 'returned';
  };

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

  return (
    <div className={styles.checkoutsPage}>
      <div className={styles.pageHeader}>
        <h3>Manage borrowed books and process returns</h3>
      </div>
      
      <div className={styles.actionBar}>
        <div className={styles.searchWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by title, author, patron name, library card ID, or ISBN..."
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
              <option value="All">All Statuses</option>
              <option value="borrowed">Borrowed</option>
              <option value="overdue">Overdue</option>
              <option value="returned">Returned</option>
            </select>
          </div>
          
          <div className={styles.filterGroup}>
            <label htmlFor="sortBy" className={styles.filterLabel}>
              <FiTag className={styles.filterIcon} />
              Sort by:
            </label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="dueDate">Due Date</option>
              <option value="borrowDate">Borrow Date</option>
              <option value="title">Book Title</option>
              <option value="patron">Patron Name</option>
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
          <p>Loading checkouts...</p>
        </div>
      ) : filteredCheckouts.length > 0 ? (
        <>
          
          
          
          {viewMode === 'grid' ? (
            <div className={styles.checkoutsGrid}>
              {filteredCheckouts.map(checkout => {
                const daysStatus = getDaysStatus(checkout);
                
                return (
                  <div key={checkout.id} className={`${styles.checkoutCard} ${isOverdue(checkout) ? styles.overdueCard : ''}`}>
                    <div className={styles.cardHeader}>
                      <div className={`${styles.statusBadge} ${styles[checkout.status]}`}>
                        {checkout.status.charAt(0).toUpperCase() + checkout.status.slice(1)}
                      </div>
                      <div className={`${styles.daysStatus} ${daysStatus.className}`}>
                        {daysStatus.text}
                      </div>
                    </div>
                    <div className={styles.cardBody}>
                      <div className={styles.bookDetails}>
                        <div className={styles.bookCover}>
                          {checkout.book?.coverImage ? (
                            <Image 
                              src={checkout.book.coverImage} 
                              alt={checkout.book.title}
                              width={80}
                              height={120}
                              unoptimized={true}
                            />
                          ) : (
                            <div className={styles.noImageCover}>
                              <FiBookOpen size={30} />
                            </div>
                          )}
                        </div>
                        <div className={styles.bookInfo}>
                          <h3 className={styles.bookTitle}>{checkout.book?.title || 'Unknown Book'}</h3>
                          <p className={styles.bookAuthor}>by {checkout.book?.author || 'Unknown Author'}</p>
                          <p className={styles.bookISBN}>ISBN: {checkout.book?.isbn || 'N/A'}</p>
                          <p className={styles.bookShelf}>Shelf: {checkout.book?.shelfNumber || 'N/A'}</p>
                          <p className={styles.quantity}>Quantity: {checkout.quantity}</p>
                        </div>
                      </div>
                      <div className={styles.patronDetails}>
                        <div className={styles.patronIcon}>
                          <FiUser size={24} />
                        </div>
                        <div className={styles.patronInfo}>
                          <h4 className={styles.patronName}>
                            {checkout.user ? `${checkout.user.firstName || 'Unknown'} ${checkout.user.lastName || 'Patron'}` : 'Unknown Patron'}
                          </h4>
                          <p className={styles.patronID}>
                            Card ID: {checkout.user?.libraryCardId || 'Not available'}
                          </p>
                          <p className={styles.patronEmail}>
                            {checkout.user?.email || 'No email available'}
                          </p>
                        </div>
                      </div>
                      <div className={styles.checkoutDates}>
                        <div className={styles.dateItem}>
                          <FiCalendar size={16} />
                          <span>Borrowed: {formatDate(checkout.borrowedAt)}</span>
                        </div>
                        <div className={styles.dateItem}>
                          <FiClock size={16} />
                          <span>Due: {formatDate(checkout.dueDate)}</span>
                        </div>
                        {checkout.renewals > 0 && (
                          <div className={styles.renewalsInfo}>
                            <FiRefreshCw size={16} />
                            <span>Renewed {checkout.renewals} {checkout.renewals === 1 ? 'time' : 'times'}</span>
                          </div>
                        )}
                      </div>
                    </div>
                    {checkout.status !== 'returned' && (
                      <div className={styles.cardActions}>
                        <button 
                          className={styles.returnButton}
                          onClick={() => openReturnConfirmation(checkout)}
                          disabled={isProcessing}
                        >
                          <FiCheckCircle /> Mark as Returned
                        </button>
                        <button 
                          className={styles.renewButton}
                          onClick={() => openRenewModal(checkout)}
                          disabled={checkout.renewals >= 3 || isProcessing}
                        >
                          <FiRefreshCw /> {checkout.renewals >= 3 ? "Max Renewals" : "Renew"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.checkoutsTable}>
              <div className={styles.tableHeader}>
                <div className={styles.tableCell}>Status</div>
                <div className={styles.tableCell}>Book</div>
                <div className={styles.tableCell}>Patron</div>
                <div className={styles.tableCell}>Borrowed</div>
                <div className={styles.tableCell}>Due Date</div>
                <div className={styles.tableCell}>Actions</div>
              </div>
              
              <div className={styles.tableBody}>
                {filteredCheckouts.map(checkout => {
                  const daysStatus = getDaysStatus(checkout);
                  
                  return (
                    <div key={checkout.id} className={`${styles.tableRow} ${isOverdue(checkout) ? styles.overdueRow : ''}`}>
                      <div className={styles.tableCell}>
                        <div>
                          <span className={`${styles.statusBadge} ${styles[checkout.status]}`}>
                            {checkout.status.charAt(0).toUpperCase() + checkout.status.slice(1)}
                          </span>
                          <span className={`${styles.daysStatus} ${daysStatus.className}`}>
                            {daysStatus.text}
                          </span>
                        </div>
                      </div>
                      <div className={styles.tableCell}>
                        <div className={styles.bookTitle}>
                          <div className={styles.bookCoverThumb}>
                            {checkout.book?.coverImage ? (
                              <Image 
                                src={checkout.book.coverImage} 
                                alt={checkout.book.title}
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
                          <div className={styles.bookTitleInfo}>
                            <span className={styles.bookTitleText}>{checkout.book?.title || 'Unknown Book'}</span>
                            <span className={styles.bookAuthorText}>by {checkout.book?.author || 'Unknown Author'}</span>
                            <span className={styles.bookDetailsText}>
                              ISBN: {checkout.book?.isbn || 'N/A'} | Qty: {checkout.quantity}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={styles.tableCell}>
                        <div className={styles.patronInfo}>
                          <span className={styles.patronName}>
                            {checkout.user ? `${checkout.user.firstName || 'Unknown'} ${checkout.user.lastName || 'Patron'}` : 'Unknown Patron'}
                          </span>
                          <span className={styles.patronID}>
                            Card ID: {checkout.user?.libraryCardId || 'Not available'}
                          </span>
                          <span className={styles.patronEmail}>
                            {checkout.user?.email || 'No email available'}
                          </span>
                        </div>
                      </div>
                      <div className={styles.tableCell}>{formatDate(checkout.borrowedAt)}</div>
                      <div className={styles.tableCell}>
                      {formatDate(checkout.dueDate)}
                        {checkout.renewals > 0 && (
                          <div className={styles.renewalsText}>
                            <FiRefreshCw size={12} />
                            <span>Renewed {checkout.renewals}x</span>
                          </div>
                        )}
                      </div>
                      <div className={styles.tableCell}>
                                                {checkout.status !== 'returned' && (
                          <div className={styles.actionButtons}>
                            <button 
                              className={styles.returnButton}
                              onClick={() => openReturnConfirmation(checkout)}
                              disabled={isProcessing}
                            >
                              <FiCheckCircle /> Return
                            </button>
                            <button 
                              className={styles.renewButton}
                              onClick={() => openRenewModal(checkout)}
                              disabled={checkout.renewals >= 3 || isProcessing}
                            >
                              <FiRefreshCw /> Renew
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FiBookOpen size={48} />
          </div>
          <h3>No checkouts found</h3>
          <p>
            {searchQuery || statusFilter !== 'All'
              ? 'Try adjusting your search or filters' 
              : 'There are no book checkouts in the system.'}
          </p>
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
    </div>
  );
}

"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { db } from '../../../firebaseConfig';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, deleteDoc, orderBy, Timestamp, addDoc, serverTimestamp, writeBatch, increment } from 'firebase/firestore';
import { FiSearch, FiFilter, FiBookOpen, FiArrowLeft, FiTag, FiGrid, FiList, FiUser, FiCalendar, FiCheckCircle, FiXCircle } from 'react-icons/fi';
import styles from './Reserved.module.css';

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

interface Reservation {
  id: string;
  userId: string;
  bookId: string;
  reservedAt: any;
  pickupBy: any;
  status: 'reserved' | 'picked-up' | 'expired' | 'cancelled';
  book?: Book | null;
  user?: User | null;
  pickupDate?: any;
}

export default function LibrarianReservedPage() {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [filteredReservations, setFilteredReservations] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [sortBy, setSortBy] = useState('recent');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Confirmation popup states
  const [showPickupConfirmation, setShowPickupConfirmation] = useState(false);
  const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
  const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
  
  const router = useRouter();

  // Format date to dd MMM yyyy (e.g., 17 Mar 2025)
  const formatDate = (date: Date): string => {
    const day = date.getDate();
    const month = date.toLocaleString('default', { month: 'short' });
    const year = date.getFullYear();
    return `${day} ${month} ${year}`;
  };

  // Fetch all reservations
  useEffect(() => {
    const fetchReservations = async () => {
      setIsLoading(true);
      setErrorMessage('');
      
      try {
        // Create a query to get all active reservations
        const reservationsQuery = query(
          collection(db, "reserves"),
          where("status", "==", "reserved"),
          orderBy("reservedAt", "desc")
        );
        
        const querySnapshot = await getDocs(reservationsQuery);
        const reservationsData: Reservation[] = [];
        
        // For each reservation, fetch the associated book and user details
        for (const reservationDoc of querySnapshot.docs) {
          const reservationData = reservationDoc.data() as Omit<Reservation, 'id'>;
          
          // Fetch book details
          const bookDocRef = doc(db, "books", reservationData.bookId);
          let bookData = null;
          const bookDoc = await getDoc(bookDocRef);
          if (bookDoc.exists()) {
            bookData = bookDoc.data() as Book;
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
          
          // First, try to get the pickupDate directly from the reservation
          let pickupDate;
          if (reservationData.pickupDate) {
            pickupDate = reservationData.pickupDate.toDate ? 
              new Date(reservationData.pickupDate.toDate()) : 
              new Date(reservationData.pickupDate);
          } else {
            // If no pickup date was set, calculate it as 7 days from reservation date
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
            pickupDate: reservationData.pickupDate,
            book: bookData,
            user: userData
          });
        }
        
        setReservations(reservationsData);
        setFilteredReservations(reservationsData);
      } catch (error) {
        console.error("Error fetching reservations:", error);
        setErrorMessage("Failed to load reservations. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchReservations();
  }, []);

  // Handle showing pickup confirmation popup
  const showPickupConfirm = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowPickupConfirmation(true);
  };

  // Handle showing cancel confirmation popup
  const showCancelConfirm = (reservation: Reservation) => {
    setSelectedReservation(reservation);
    setShowCancelConfirmation(true);
  };

  // Actual mark as picked up function that runs after confirmation
  const handleMarkAsPickedUp = async () => {
    try {
      if (!selectedReservation) return;
      
      const reservation = selectedReservation;
      
      // Fetch the book document to get the number of copies
      const bookDocRef = doc(db, "books", reservation.bookId);
      const bookDoc = await getDoc(bookDocRef);
      
      if (!bookDoc.exists()) {
        setErrorMessage("Book not found.");
        return;
      }
      
      const bookData = bookDoc.data();
      let availableCopies = bookData.copies || 0;
      
      // Check if there are available copies
      if (availableCopies <= 0) {
        setErrorMessage("No copies available for checkout.");
        return;
      }

      // Create a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);
      
      // 1. Update reservation status
      batch.update(doc(db, "reserves", reservation.id), {
        status: "picked-up"
      });

      // 2. Calculate the due date (14 days from today)
      const borrowedDate = new Date();
const dueDate = new Date(borrowedDate);
dueDate.setDate(borrowedDate.getDate() + 14);


      // 3. Save checkout details to the "borrows" collection
      batch.set(doc(db, "borrows", reservation.id), {
        userId: reservation.userId,
        bookId: reservation.bookId,
        bookTitle: reservation.book?.title || '',
        bookAuthor: reservation.book?.author || '',
        bookCover: reservation.book?.coverImage || '',
        borrowedAt: serverTimestamp(),
        dueDate: dueDate, // Use calculated due date (14 days from now)
        status: 'borrowed',
        renewals: 0
      });
      
      // 4. Update book status and copies
      

      // Commit the batch
      await batch.commit();
      
      // Update local state
      setReservations(prevReservations => 
        prevReservations.map(res => {
          if (res.id === reservation.id && res.book) {
            return {
              ...res,
              book: {
                ...res.book,
                copies: availableCopies - 1
              }
            };
          }
          return res;
        }).filter(r => r.id !== reservation.id)
      );
      setFilteredReservations(prevReservations => 
        prevReservations.map(res => {
          if (res.id === reservation.id && res.book) {
            return {
              ...res,
              book: {
                ...res.book,
                copies: availableCopies - 1
              }
            };
          }
          return res;
        }).filter(r => r.id !== reservation.id)
      );
      
      setSuccessMessage(`Marked "${reservation.book?.title}" as picked up by ${reservation.user?.firstName} ${reservation.user?.lastName}.`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
      // Close the confirmation popup
      setShowPickupConfirmation(false);
      setSelectedReservation(null);
    } catch (error) {
      console.error("Error updating reservation:", error);
      setErrorMessage("Failed to update reservation status. Please try again.");
      setShowPickupConfirmation(false);
    }
  };

  // Actual cancel reservation function that runs after confirmation
  const handleCancelReservation = async () => {
    try {
      if (!selectedReservation) return;
      
      const reservation = selectedReservation;
      
      // Fetch the book document to get the number of copies
      const bookDocRef = doc(db, "books", reservation.bookId);
      const bookDoc = await getDoc(bookDocRef);
      
      if (!bookDoc.exists()) {
        setErrorMessage("Book not found.");
        return;
      }
      
      const bookData = bookDoc.data();
      let availableCopies = bookData.copies || 0;

      // Create a batch to ensure all operations succeed or fail together
      const batch = writeBatch(db);

      // 1. Update reservation status
      batch.update(doc(db, "reserves", reservation.id), {
        status: "cancelled"
      });
      
      // 2. Update the book document to get the number of copies
      batch.update(bookDocRef, {
        copies: increment(1)
      });
      
      // Commit the batch
      await batch.commit();
      
      // Update local state
      setReservations(prevReservations =>
        prevReservations.map(res => {
          if (res.id === reservation.id && res.book) {
            return {
              ...res,
              book: {
                ...res.book,
                copies: availableCopies + 1
              }
            };
          }
          return res;
        }).filter(r => r.id !== reservation.id)
      );
      setFilteredReservations(prevReservations =>
        prevReservations.map(res => {
          if (res.id === reservation.id && res.book) {
            return {
              ...res,
              book: {
                ...res.book,
                copies: availableCopies + 1
              }
            };
          }
          return res;
        }).filter(r => r.id !== reservation.id)
      );
      
      setSuccessMessage(`Cancelled reservation for "${reservation.book?.title}".`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
      
      // Close the confirmation popup
      setShowCancelConfirmation(false);
      setSelectedReservation(null);
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      setErrorMessage("Failed to cancel reservation. Please try again.");
      setShowCancelConfirmation(false);
    }
  };

  useEffect(() => {
    if (reservations.length === 0) return;
  
    let result = [...reservations];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(reservation => 
        reservation.book?.title?.toLowerCase().includes(query) ||
        reservation.book?.author?.toLowerCase().includes(query) ||
        reservation.user?.firstName?.toLowerCase().includes(query) ||
        reservation.user?.lastName?.toLowerCase().includes(query) ||
        reservation.user?.libraryCardId?.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    if (sortBy === 'recent') {
      result.sort((a, b) => b.reservedAt.getTime() - a.reservedAt.getTime());
    } else if (sortBy === 'pickup') {
      result.sort((a, b) => a.pickupBy.getTime() - b.pickupBy.getTime());
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
    
    setFilteredReservations(result);
  }, [reservations, searchQuery, sortBy]);

  // Check if a reservation is expired
  const isExpired = (reservation: Reservation): boolean => {
    if (!reservation.pickupDate) return false;
    const today = new Date();
    return new Date(reservation.pickupDate) < today && reservation.status === 'reserved';
  };

  // Check for expired reservations every day
  useEffect(() => {
    const checkExpiredReservations = async () => {
      const now = new Date();
      
      // Check if reservations are expired and update their status to "expired"
      for (const reservation of reservations) {
        if (isExpired(reservation)) {
          try {
            await updateDoc(doc(db, "reserves", reservation.id), {
              status: "expired"
            });
            
            // Update local state
            setReservations(prevReservations => 
              prevReservations.map(r => 
                r.id === reservation.id ? { ...r, status: 'expired' } : r
              )
            );
            setFilteredReservations(prevReservations => 
              prevReservations.map(r => 
                r.id === reservation.id ? { ...r, status: 'expired' } : r
              )
            );
          } catch (error) {
            console.error(`Error updating reservation status to expired:`, error);
          }
        }
      }
    };

    // Run the check immediately and then every 24 hours
    checkExpiredReservations();
    const intervalId = setInterval(checkExpiredReservations, 24 * 60 * 60 * 1000); // every 24 hours

    return () => clearInterval(intervalId); // cleanup on unmount
  }, [reservations]); // re-run when reservations change


  return (
    <div className={styles.reservedPage}>
      <div className={styles.pageHeader}>
        
        
        <h3>Manage book reservations and process pickups</h3>
      </div>
      
      <div className={styles.actionBar}>
        <div className={styles.searchWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by title, author, patron name, or library card ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filters}>
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
              <option value="recent">Recently Reserved</option>
              <option value="pickup">Pickup Date</option>
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
          <p>Loading reservations...</p>
        </div>
      ) : filteredReservations.length > 0 ? (
        <>
          {/* Stats bar has been removed */}
          
          {viewMode === 'grid' ? (
            <div className={styles.reservationsGrid}>
              {filteredReservations.map(reservation => (
                <div key={reservation.id} className={`${styles.reservationCard} ${isExpired(reservation) ? styles.expired : ''}`}>
                  <div className={styles.cardBody}>
                    <div className={styles.bookDetails}>
                      <div className={styles.bookCover}>
                        {reservation.book?.coverImage ? (
                          <Image 
                            src={reservation.book.coverImage} 
                            alt={reservation.book.title}
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
                        <h3 className={styles.bookTitle}>{reservation.book?.title || 'Unknown Book'}</h3>
                        <p className={styles.bookAuthor}>by {reservation.book?.author || 'Unknown Author'}</p>
                        <p className={styles.bookISBN}>ISBN: {reservation.book?.isbn || 'N/A'}</p>
                        <p className={styles.bookShelf}>Shelf: {reservation.book?.shelfNumber || 'N/A'}</p>
                        <p className={styles.bookCopies}>Copies Left: {reservation.book?.copies || 0}</p>
                      </div>
                    </div>
                    <div className={styles.patronDetails}>
                      <div className={styles.patronIcon}>
                        <FiUser size={24} />
                      </div>
                      <div className={styles.patronInfo}>
                        <h4 className={styles.patronName}>{reservation.user?.firstName} {reservation.user?.lastName}</h4>
                        <p className={styles.patronID}>Card ID: {reservation.user?.libraryCardId}</p>
                        <p className={styles.patronEmail}>{reservation.user?.email}</p>
                      </div>
                    </div>
                    <div className={styles.reservationDates}>
                      <div className={styles.dateItem}>
                        <FiCalendar size={16} />
                        <span>Reserved: {formatDate(reservation.reservedAt)}</span>
                      </div>
                      <div className={styles.dateItem}>
                        <FiCalendar size={16} />
                        <span>Pickup by: {formatDate(reservation.pickupBy)}</span>
                      </div>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                    <button 
                      className={styles.pickupButton}
                      onClick={() => showPickupConfirm(reservation)}
                    >
                      <FiCheckCircle /> Mark as Picked Up
                    </button>
                    <button 
                      className={styles.cancelButton}
                      onClick={() => showCancelConfirm(reservation)}
                    >
                      <FiXCircle /> Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.reservationsTable}>
              <div className={styles.tableHeader}>
                <div className={styles.tableCell}>Book</div>
                <div className={styles.tableCell}>Patron</div>
                <div className={styles.tableCell}>Reserved On</div>
                <div className={styles.tableCell}>Pickup By</div>
                <div className={styles.tableCell}>Copies Left</div>
                <div className={styles.tableCell}>Actions</div>
              </div>
              
              <div className={styles.tableBody}>
                {filteredReservations.map(reservation => (
                  <div key={reservation.id} className={`${styles.tableRow} ${isExpired(reservation) ? styles.expired : ''}`}>
                    <div className={styles.tableCell}>
                      <div className={styles.bookTitle}>
                        <div className={styles.bookCoverThumb}>
                          {reservation.book?.coverImage ? (
                            <Image 
                              src={reservation.book.coverImage} 
                              alt={reservation.book.title}
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
                          <span className={styles.bookTitleText}>{reservation.book?.title || 'Unknown Book'}</span>
                          <span className={styles.bookAuthorText}>by {reservation.book?.author || 'Unknown Author'}</span>
                          <span className={styles.bookDetails}>
                            ISBN: {reservation.book?.isbn || 'N/A'} | Shelf: {reservation.book?.shelfNumber || 'N/A'}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.tableCell}>
  <div className={styles.patronInfo}>
    <span className={styles.patronName}>{reservation.user?.firstName} {reservation.user?.lastName}</span>
    <span className={styles.patronID}>Card ID: {reservation.user?.libraryCardId}</span>
    <span className={styles.patronEmail}>{reservation.user?.email}</span>
  </div>
</div>

                    <div className={styles.tableCell}>{formatDate(reservation.reservedAt)}</div>
                    <div className={styles.tableCell}>{formatDate(reservation.pickupBy)}</div>
                    <div className={styles.tableCell}>{reservation.book?.copies || 'N/A'}</div>
                    <div className={styles.tableCell}>
                      <div className={styles.actionButtons}>
                        <button 
                          className={styles.pickupButton}
                          onClick={() => showPickupConfirm(reservation)}
                        >
                          <FiCheckCircle /> Pickup
                        </button>
                        <button 
                          className={styles.cancelButton}
                          onClick={() => showCancelConfirm(reservation)}
                        >
                          <FiXCircle /> Cancel
                        </button>
                      </div>
                    </div>
                  </div>
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
          <h3>No reservations found</h3>
          <p>
            {searchQuery
              ? 'Try adjusting your search' 
              : 'There are no book reservations in the system.'}
          </p>
        </div>
      )}
  
      {/* Pickup Confirmation Modal */}
      {showPickupConfirmation && selectedReservation && (
        <div className={styles.confirmationOverlay}>
          <div className={styles.confirmationPopup}>
            <h3 className={styles.confirmationTitle}>Confirm Pickup</h3>
            <p className={styles.confirmationMessage}>
              Are you sure you want to mark "{selectedReservation.book?.title}" as picked up by {selectedReservation.user?.firstName} {selectedReservation.user?.lastName}?
            </p>
            <div className={styles.confirmationDetails}>
              <div className={styles.confirmationDetail}>
                <strong>Book:</strong> {selectedReservation.book?.title}
              </div>
              <div className={styles.confirmationDetail}>
                <strong>Author:</strong> {selectedReservation.book?.author}
              </div>
              <div className={styles.confirmationDetail}>
                <strong>Patron:</strong> {selectedReservation.user?.firstName} {selectedReservation.user?.lastName}
              </div>
              <div className={styles.confirmationDetail}>
                <strong>Library Card:</strong> {selectedReservation.user?.libraryCardId}
              </div>
            </div>
            <div className={styles.confirmationButtons}>
              <button 
                className={styles.confirmButton}
                onClick={handleMarkAsPickedUp}
              >
                Yes, Confirm Pickup
              </button>
              <button 
                className={styles.cancelConfirmButton}
                onClick={() => {
                  setShowPickupConfirmation(false);
                  setSelectedReservation(null);
                }}
              >
                No, Cancel
              </button>
            </div>
          </div>
        </div>
      )}
  
      {/* Cancel Confirmation Modal */}
      {showCancelConfirmation && selectedReservation && (
        <div className={styles.confirmationOverlay}>
          <div className={styles.confirmationPopup}>
            <h3 className={styles.confirmationTitle}>Confirm Cancellation</h3>
            <p className={styles.confirmationMessage}>
              Are you sure you want to cancel the reservation for "{selectedReservation.book?.title}" by {selectedReservation.user?.firstName} {selectedReservation.user?.lastName}?
            </p>
            <div className={styles.confirmationDetails}>
              <div className={styles.confirmationDetail}>
                <strong>Book:</strong> {selectedReservation.book?.title}
              </div>
              <div className={styles.confirmationDetail}>
                <strong>Reserved on:</strong> {formatDate(selectedReservation.reservedAt)}
              </div>
              <div className={styles.confirmationDetail}>
                <strong>Pickup by:</strong> {formatDate(selectedReservation.pickupBy)}
              </div>
            </div>
            <div className={styles.warningMessage}>
              This action cannot be undone.
            </div>
            <div className={styles.confirmationButtons}>
              <button 
                className={styles.confirmButton}
                onClick={handleCancelReservation}
              >
                Yes, Cancel Reservation
              </button>
              <button 
                className={styles.cancelConfirmButton}
                onClick={() => {
                  setShowCancelConfirmation(false);
                  setSelectedReservation(null);
                }}
              >
                No, Keep Reservation
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

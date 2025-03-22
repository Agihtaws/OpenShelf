"use client";

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { db } from '../../../firebaseConfig';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  limit, 
  where, 
  Timestamp 
} from 'firebase/firestore';
import { FiBookOpen, FiArrowLeft, FiSearch, FiFilter, FiTag, FiGrid, FiList } from 'react-icons/fi';
import styles from './NewArrivals.module.css';

// Update the Book interface to include a computed status
interface Book {
  id: string;
  title: string;
  author: string;
  isbn: string;
  categories: string[];
  coverImage: string;
  shelfNumber: string;
  copies: number;
  status: 'Available' | 'Unavailable'; // This will be computed
  addedAt: any;
}

export default function NewArrivalsPage() {
  const [newArrivals, setNewArrivals] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All'); // Add status filter
  const [categories, setCategories] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const fetchNewArrivals = async () => {
      setIsLoading(true);
      setErrorMessage('');
      
      try {
        // Get current date and start of today
        const now = new Date();
        const today = new Date(now);
        today.setHours(0, 0, 0, 0); // Start of today
        const todayTimestamp = Timestamp.fromDate(today);
        
        // First query: Books added today
        const todayBooksQuery = query(
          collection(db, "books"),
          where("addedAt", ">=", todayTimestamp),
          orderBy("addedAt", "desc")
        );
        
        const todaySnapshot = await getDocs(todayBooksQuery);
        const todayBooks: Book[] = todaySnapshot.docs.map(doc => {
          const data = doc.data() as Omit<Book, 'id' | 'status'>;
          const copies = typeof data.copies === 'number' && !isNaN(data.copies) ? data.copies : 0;
          // Compute status based on copies
          const status = copies > 0 ? 'Available' : 'Unavailable';
          
          return { 
            ...data, 
            id: doc.id,
            status: status,
            copies: copies // Ensure copies is a valid number
          };
        });
        
        let booksData: Book[] = [...todayBooks];
        
        // If we have fewer than 10 books from today, fetch older books to fill up to 10
        if (todayBooks.length < 10) {
          // Get the number of additional books needed
          const additionalBooksNeeded = 10 - todayBooks.length;
          
          // Query for older books
          const olderBooksQuery = query(
            collection(db, "books"),
            where("addedAt", "<", todayTimestamp),
            orderBy("addedAt", "desc"),
            limit(additionalBooksNeeded)
          );
          
          const olderSnapshot = await getDocs(olderBooksQuery);
          
          // Process older books and add them to the books array
          olderSnapshot.docs.forEach(doc => {
            const data = doc.data() as Omit<Book, 'id' | 'status'>;
            const copies = typeof data.copies === 'number' && !isNaN(data.copies) ? data.copies : 0;
            // Compute status based on copies
            const status = copies > 0 ? 'Available' : 'Unavailable';
            
            booksData.push({ 
              ...data, 
              id: doc.id,
              status: status,
              copies: copies // Ensure copies is a valid number
            });
          });
        }
        
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
        setNewArrivals(booksData);
      } catch (error) {
        console.error("Error fetching new arrivals:", error);
        setErrorMessage("Failed to load new arrivals. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchNewArrivals();
  }, []);

  // Apply filters
  const filteredBooks = newArrivals.filter(book => {
    // Apply status filter
    if (statusFilter !== 'All') {
      if (book.status !== statusFilter) {
        return false;
      }
    }
    
    // Apply category filter
    if (categoryFilter !== 'All' && (!book.categories || !book.categories.includes(categoryFilter))) {
      return false;
    }
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        (book.isbn && book.isbn.toLowerCase().includes(query)) ||
        book.shelfNumber.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  // Format date from Firestore timestamp
  const formatDate = (timestamp: any): string => {
    if (!timestamp) return 'N/A';
    
    try {
      const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(date);
    } catch (error) {
      return 'Invalid date';
    }
  };
  
  // Format copies to display a proper value
  const formatCopies = (copies: any): string => {
    if (copies === undefined || copies === null || isNaN(copies)) {
      return '0';
    }
    return copies.toString();
  };

  return (
    <div className={styles.newArrivalsPage}>
      <div className={styles.pageHeader}>
        
        
        <h3>The latest additions to your library's collection</h3>
      </div>
      
      <div className={styles.actionBar}>
        <div className={styles.searchWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by title, author, ISBN, or shelf number..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filters}>
          {/* Add status filter */}
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
      
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading new arrivals...</p>
        </div>
      ) : filteredBooks.length > 0 ? (
        <>
          <div className={styles.timeframeInfo}>
            {newArrivals.length > 0 && newArrivals[0].addedAt && 
              (newArrivals[0].addedAt.seconds ? 
                new Date(newArrivals[0].addedAt.seconds * 1000).toDateString() === new Date().toDateString() :
                new Date(newArrivals[0].addedAt).toDateString() === new Date().toDateString()) ? (
              <p>Books added today</p>
            ) : (
              <p>Most recently added books</p>
            )}
            <span className={styles.resultCount}>{filteredBooks.length} books found</span>
          </div>
          
          {viewMode === 'grid' ? (
            <div className={styles.booksGrid}>
              {filteredBooks.map((book) => (
                <div key={book.id} className={styles.bookCard}>
                  <div className={styles.bookCover}>
                    {book.coverImage ? (
                      <Image 
                        src={book.coverImage} 
                        alt={book.title}
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
                    <h3 className={styles.bookTitle}>{book.title}</h3>
                    <p className={styles.bookAuthor}>by {book.author}</p>
                    
                    <div className={styles.bookDetails}>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Added:</span>
                        <span className={styles.detailValue}>{formatDate(book.addedAt)}</span>
                      </div>
                      
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Status:</span>
                        <span className={`${styles.statusBadge} ${book.status === 'Available' ? styles.available : styles.unavailable}`}>
                          {book.status}
                        </span>
                      </div>
                      
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Shelf:</span>
                        <span className={styles.detailValue}>{book.shelfNumber}</span>
                      </div>
                      
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Copies:</span>
                        <span className={styles.detailValue}>{formatCopies(book.copies)}</span>
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
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.inventoryTable}>
              <div className={styles.tableHeader}>
                <div className={styles.tableCell}>Title</div>
                <div className={styles.tableCell}>Author</div>
                <div className={styles.tableCell}>Categories</div>
                <div className={styles.tableCell}>Shelf</div>
                <div className={styles.tableCell}>Copies</div>
                <div className={styles.tableCell}>Status</div>
                <div className={styles.tableCell}>Added Date</div>
              </div>
              
              <div className={styles.tableBody}>
                {filteredBooks.map((book) => (
                  <div key={book.id} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <div className={styles.bookTitle}>
                        <div className={styles.bookCoverThumb}>
                          {book.coverImage ? (
                            <Image 
                              src={book.coverImage} 
                              alt={book.title}
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
                        <span>{book.title}</span>
                      </div>
                    </div>
                    <div className={styles.tableCell}>{book.author}</div>
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
                    <div className={styles.tableCell}>{book.shelfNumber}</div>
                    <div className={styles.tableCell}>{formatCopies(book.copies)}</div>
                    <div className={styles.tableCell}>
                      <span className={`${styles.statusBadge} ${book.status === 'Available' ? styles.available : styles.unavailable}`}>
                        {book.status}
                      </span>
                    </div>
                    <div className={styles.tableCell}>{formatDate(book.addedAt)}</div>
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
          <h3>No books found</h3>
          <p>
            {searchQuery || categoryFilter !== 'All' || statusFilter !== 'All'
              ? 'Try adjusting your search or filters'
              : 'There are no books that have been added recently.'}
          </p>
        </div>
      )}
    </div>
  );
}

// src/app/stocks/page.tsx
"use client"
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Navbar from '@/app/components/layout/Navbar';
import { db } from '@/firebaseConfig';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where,
  limit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot
} from 'firebase/firestore';
import { FiSearch, FiBookOpen, FiTag, FiList, FiGrid, FiArrowDown } from 'react-icons/fi';
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
  status: 'Available' | 'On Loan' | 'Reserved' | 'Lost' | 'Damaged';
}

export default function StocksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [pageSize] = useState(12);
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Fetch books on component mount
  useEffect(() => {
    fetchBooks();
  }, []);

  // Fetch books from Firestore
  const fetchBooks = async (isInitial = true) => {
    if (isInitial) {
      setIsLoading(true);
      setErrorMessage('');
    }
    
    try {
      // Only show available books - same query as in the user catalog
      let booksQuery;
      
      if (isInitial) {
        booksQuery = query(
          collection(db, "books"),
          where("status", "==", "Available"),
          orderBy("title", "asc"),
          limit(pageSize)
        );
      } else if (lastVisible) {
        booksQuery = query(
          collection(db, "books"),
          where("status", "==", "Available"),
          orderBy("title", "asc"),
          startAfter(lastVisible),
          limit(pageSize)
        );
      } else {
        setHasMore(false);
        return;
      }
      
      const querySnapshot = await getDocs(booksQuery);
      
      // Update lastVisible for pagination
      const lastDoc = querySnapshot.docs[querySnapshot.docs.length - 1];
      setLastVisible(lastDoc || null);
      setHasMore(querySnapshot.docs.length === pageSize);
      
      const booksData: Book[] = querySnapshot.docs.map(doc => {
        const data = doc.data() as Book;
        return { ...data, id: doc.id };
      });
      
      // Extract unique categories
      if (isInitial) {
        const allBooksQuery = query(
          collection(db, "books"),
          where("status", "==", "Available")
        );
        const allBooksSnapshot = await getDocs(allBooksQuery);
        
        const uniqueCategories = new Set<string>();
        allBooksSnapshot.docs.forEach(doc => {
          const bookData = doc.data() as Book;
          if (bookData.categories && bookData.categories.length > 0) {
            bookData.categories.forEach(category => {
              uniqueCategories.add(category);
            });
          }
        });
        
        setCategories(Array.from(uniqueCategories).sort());
      }
      
      if (isInitial) {
        setBooks(booksData);
        setFilteredBooks(booksData);
      } else {
        setBooks(prevBooks => [...prevBooks, ...booksData]);
        setFilteredBooks(prevBooks => [...prevBooks, ...booksData]);
      }
    } catch (error) {
      console.error("Error fetching books:", error);
      setErrorMessage("Failed to load books. Please try again later.");
    } finally {
      if (isInitial) {
        setIsLoading(false);
      }
    }
  };

  // Load more books
  const loadMoreBooks = () => {
    if (hasMore) {
      fetchBooks(false);
    }
  };

  // Filter books when search query or filters change
  useEffect(() => {
    if (books.length === 0) return;

    let result = [...books];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(book => 
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        (book.description && book.description.toLowerCase().includes(query))
      );
    }
    
    // Apply category filter
    if (categoryFilter !== 'All') {
      result = result.filter(book => 
        book.categories && book.categories.includes(categoryFilter)
      );
    }
    
    setFilteredBooks(result);
  }, [books, searchQuery, categoryFilter]);

  return (
    <>
    <Navbar />
    <div className={styles.stocksContainer}>
      <main className={styles.mainContent}>
        <div className={styles.pageHeader}>
          <h1>Book Inventory</h1>
          <p>Browse our collection of books currently in stock</p>
        </div>
        
        <div className={styles.actionBar}>
          <div className={styles.searchWrapper}>
            <FiSearch className={styles.searchIcon} />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search by title, author, or keywords..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.searchInput}
            />
          </div>
          
          <div className={styles.filters}>
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
          </div>
          
          <div className={styles.viewToggle}>
            <button 
              className={`${styles.viewButton} ${viewMode === 'grid' ? styles.active : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <FiGrid />
            </button>
            <button 
              className={`${styles.viewButton} ${viewMode === 'list' ? styles.active : ''}`}
              onClick={() => setViewMode('list')}
              aria-label="List view"
            >
              <FiList />
            </button>
          </div>
        </div>
        
        {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
        
        {isLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading books...</p>
          </div>
        ) : filteredBooks.length > 0 ? (
          <>
            <div className={`${styles.booksContainer} ${viewMode === 'grid' ? styles.gridView : styles.listView}`}>
              {filteredBooks.map((book) => (
                <div key={book.id} className={styles.bookCard}>
                  <div className={styles.bookCover}>
                    {book.coverImage ? (
                      <Image 
                        src={book.coverImage} 
                        alt={book.title}
                        width={viewMode === 'grid' ? 180 : 120}
                        height={viewMode === 'grid' ? 270 : 180}
                        className={styles.coverImage}
                        unoptimized={true}
                      />
                    ) : (
                      <div className={styles.noCoverImage}>
                        <FiBookOpen size={viewMode === 'grid' ? 60 : 40} />
                      </div>
                    )}
                  </div>
                  <div className={styles.bookInfo}>
                    <h3 className={styles.bookTitle}>{book.title}</h3>
                    <p className={styles.bookAuthor}>by {book.author}</p>
                    
                    <div className={styles.publishedYear}>
                      Published: {new Date(book.publishedDate).getFullYear()}
                    </div>
                    
                    <div className={styles.bookCategories}>
                      {book.categories && book.categories.length > 0 ? (
                        book.categories.slice(0, 3).map((category, index) => (
                          <span key={index} className={styles.categoryPill}>
                            {category}
                          </span>
                        ))
                      ) : (
                        <span className={styles.noCategoryLabel}>No categories</span>
                      )}
                      {book.categories && book.categories.length > 3 && (
                        <span className={styles.moreCategoriesLabel}>+{book.categories.length - 3}</span>
                      )}
                    </div>
                    
                    <p className={styles.bookDescription}>
                      {book.description && book.description.length > 200 
                        ? book.description.substring(0, 200) + '...' 
                        : book.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            
            {hasMore && (
              <div className={styles.loadMoreContainer}>
                <button 
                  className={styles.loadMoreButton}
                  onClick={loadMoreBooks}
                >
                  Load More Books <FiArrowDown />
                </button>
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
              {searchQuery || categoryFilter !== 'All'
                ? 'Try adjusting your search or filters' 
                : 'Our book inventory is currently empty. Please check back later.'}
            </p>
          </div>
        )}
      </main>
    </div>
    </>
  );
}

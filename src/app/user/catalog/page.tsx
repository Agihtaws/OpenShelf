// src/app/user/catalog/page.tsx
"use client";
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { auth, db } from '../../../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where,
  limit,
  startAfter,
  DocumentData,
  QueryDocumentSnapshot,
  getDoc,
  doc
} from 'firebase/firestore';
import { FiSearch, FiFilter, FiBookOpen, FiTag, FiList, FiGrid, FiArrowDown } from 'react-icons/fi';
import styles from './Catalog.module.css';

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

export default function UserCatalogPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
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
  const [userData, setUserData] = useState<any>(null);
  const [userInitial, setUserInitial] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Check authentication
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
            fetchCategories(); // Load categories before books
            fetchBooks();
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

  // Fetch categories from Firestore
  const fetchCategories = async () => {
    try {
      const categoriesQuery = query(
        collection(db, "categories"),
        orderBy("name", "asc")
      );
      const categoriesSnapshot = await getDocs(categoriesQuery);
      setCategories(categoriesSnapshot.docs.map(doc => doc.data().name));
    } catch (error) {
      console.error("Error fetching categories:", error);
      setErrorMessage("Failed to load categories. Please try again later.");
    }
  };

  // Update the fetchBooks function to only show books with copies > 0
  const fetchBooks = async (isInitial = true) => {
    if (isInitial) {
      setIsLoading(true);
      setErrorMessage('');
    }
    
    try {
      // Show only books with available copies (copies > 0)
      let booksQuery;
      
      if (isInitial) {
        booksQuery = query(
          collection(db, "books"),
          where("copies", ">", 0),  // Only books with copies > 0
          orderBy("title", "asc"),
          limit(pageSize)
        );
      } else if (lastVisible) {
        booksQuery = query(
          collection(db, "books"),
          where("copies", ">", 0),  // Only books with copies > 0
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
      
      if (isInitial) {
        setBooks(booksData);
        setFilteredBooks(booksData);
      } else {
        setBooks(prevBooks => [...prevBooks, ...booksData]);
        setFilteredBooks(prevBooks => [...prevBooks, ...booksData]);
      }
    } catch (error) {
      console.error("Error fetching books:", error);
      setErrorMessage("Failed to load catalog. Please try again later.");
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
      const queryText = searchQuery.toLowerCase();
      result = result.filter(book => 
        book.title.toLowerCase().includes(queryText) ||
        book.author.toLowerCase().includes(queryText) ||
        book.isbn.toLowerCase().includes(queryText) ||
        (book.description && book.description.toLowerCase().includes(queryText))
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

  // Handle logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      router.push('/auth/login');
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading catalog...</p>
      </div>
    );
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.pageHeader}>
        
        <h3>Browse our collection of books available for borrowing</h3>
      </header>
      
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
          <p>Loading catalog...</p>
        </div>
      ) : filteredBooks.length > 0 ? (
        <>
          <div className={`${styles.booksContainer} ${viewMode === 'grid' ? styles.gridView : styles.listView}`}>
            {filteredBooks.map((book) => (
              <div key={book.id} className={styles.bookCard}>
                <div className={styles.bookCover}>
                  {book.coverImage ? (
                    <Image 
                      src={book.coverImage || '/images/default-cover.jpg'} 
                      alt={book.title}
                      width={viewMode === 'grid' ? 180 : 120}
                      height={viewMode === 'grid' ? 270 : 180}
                      className={styles.coverImage}
                      priority={true}
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = '/images/default-cover.jpg';
                      }}
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
                  
                  {viewMode === 'list' && (
                    <p className={styles.bookDescription}>
                      {book.description && book.description.length > 150 
                        ? book.description.substring(0, 150) + '...' 
                        : book.description}
                    </p>
                  )}
                  
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
                  
                  <Link href={`/user/book/${book.id}`} className={styles.viewDetailsButton}>
                    View Details
                  </Link>
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
              : 'Our catalog is currently empty. Please check back later.'}
          </p>
        </div>
      )}
    </main>
  );
}

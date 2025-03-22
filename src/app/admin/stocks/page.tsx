// src/app/admin/stocks/page.tsx
"use client"
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
  deleteDoc, 
  where, 
  getCountFromServer, 
  increment, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { FiEdit, FiTrash2, FiSearch, FiFilter, FiBookOpen, FiPlus, FiDownload, FiTag, FiX } from 'react-icons/fi';
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
  status: 'Available' | 'On Loan' | 'Reserved' | 'Lost' | 'Damaged';
  notes: string;
  addedAt?: any;
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
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch books from Firestore - memoized with useCallback
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
        return { ...data, id: doc.id };
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
      
      // Update the total books count in the counters collection
      updateBookCounter(booksData.length);
    } catch (error) {
      console.error("Error fetching books:", error);
      setErrorMessage("Failed to load book inventory. Please try again later.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update book counter in Firestore - memoized with useCallback
  const updateBookCounter = useCallback(async (totalCount: number) => {
    try {
      const counterRef = doc(db, "counters", "books");
      await setDoc(counterRef, {
        total: totalCount,
        lastUpdated: serverTimestamp()
      }, { merge: true });
    } catch (error) {
      console.error("Error updating book counter:", error);
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
        book.title.toLowerCase().includes(query) ||
        book.author.toLowerCase().includes(query) ||
        book.isbn.toLowerCase().includes(query) ||
        book.shelfNumber.toLowerCase().includes(query)
      );
    }
    
    // Apply status filter
    if (statusFilter !== 'All') {
      if (statusFilter === 'Available') {
        result = result.filter(book => typeof book.copies === 'number' && book.copies > 0);
      } else if (statusFilter === 'Unavailable') {
        result = result.filter(book => typeof book.copies !== 'number' || book.copies <= 0);
      } else if (statusFilter === 'Low Stock') {
        result = result.filter(book => typeof book.copies === 'number' && book.copies > 0 && book.copies <= 3);
      } else {
        result = result.filter(book => book.status === statusFilter);
      }
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
          comparison = a.title.localeCompare(b.title);
          break;
        case 'author':
          comparison = a.author.localeCompare(b.author);
          break;
        case 'copies':
          comparison = a.copies - b.copies;
          break;
        case 'status':
          // For status sorting, consider availability first
          const aAvailable = typeof a.copies === 'number' && a.copies > 0;
          const bAvailable = typeof b.copies === 'number' && b.copies > 0;
          if (aAvailable !== bAvailable) {
            return aAvailable ? -1 : 1;
          }
          // Then consider low stock
          const aLowStock = aAvailable && a.copies <= 3;
          const bLowStock = bAvailable && b.copies <= 3;
          if (aLowStock !== bLowStock) {
            return aLowStock ? -1 : 1;
          }
          // If both have same availability status, fall back to original status
          comparison = a.status.localeCompare(b.status);
          break;
        case 'addedAt':
          comparison = (a.addedAt?.seconds || 0) - (b.addedAt?.seconds || 0);
          break;
        default:
          comparison = a.title.localeCompare(b.title);
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

  // Handle edit book
  const handleEditBook = useCallback((book: Book) => {
    setEditingBook({...book});
    setIsEditing(true);
  }, []);

  // Handle form change - updated to prevent undefined values
  const handleFormChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!editingBook) return;
    
    const { name, value } = e.target;
    
    if (name === 'copies') {
      const numValue = parseInt(value);
      setEditingBook(prev => prev ? ({
        ...prev,
        [name]: isNaN(numValue) ? 0 : numValue
      }) : prev);
    } else {
      setEditingBook(prev => prev ? ({
        ...prev,
        [name]: value
      }) : prev);
    }
  }, [editingBook]);

  // Handle update book - fixed to prevent undefined values
  const handleUpdateBook = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBook) return;
    
    try {
      const bookRef = doc(db, "books", editingBook.id);
      const oldBook = books.find(b => b.id === editingBook.id);
      const copiesDifference = editingBook.copies - (oldBook?.copies || 0);
      
      // Create an update object with only defined fields
      const updateData: Record<string, any> = {};
      
      // Only include fields that are defined and not null/undefined
      if (editingBook.title !== undefined && editingBook.title !== null) 
        updateData.title = editingBook.title;
      
      if (editingBook.author !== undefined && editingBook.author !== null) 
        updateData.author = editingBook.author;
      
      if (editingBook.shelfNumber !== undefined && editingBook.shelfNumber !== null) 
        updateData.shelfNumber = editingBook.shelfNumber;
      
      if (editingBook.copies !== undefined && !isNaN(editingBook.copies)) 
        updateData.copies = editingBook.copies;
      
      if (editingBook.status !== undefined && editingBook.status !== null) 
        updateData.status = editingBook.status;
      
      if (editingBook.categories !== undefined && Array.isArray(editingBook.categories)) 
        updateData.categories = editingBook.categories;
      
      if (editingBook.notes !== undefined) 
        updateData.notes = editingBook.notes;
      
      // Proceed with update if there are fields to update
      if (Object.keys(updateData).length > 0) {
        await updateDoc(bookRef, updateData);
        
        // Update local state
        setBooks(prevBooks => prevBooks.map(book => 
          book.id === editingBook.id ? editingBook : book
        ));
        
        // Update book counter if copies changed
        if (copiesDifference !== 0) {
          const counterRef = doc(db, "counters", "books");
          await updateDoc(counterRef, {
            recentChanges: increment(copiesDifference),
            lastUpdated: serverTimestamp()
          });
        }
        
        setSuccessMessage(`"${editingBook.title}" has been updated successfully.`);
        setIsEditing(false);
        setEditingBook(null);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      } else {
        setErrorMessage("No valid fields to update. Please check your input.");
      }
    } catch (error) {
      console.error("Error updating book:", error);
      setErrorMessage(`Failed to update book: ${(error as Error).message}`);
    }
  }, [editingBook, books]);

  // Handle delete book
  const handleDeleteBook = useCallback(async (bookId: string, bookTitle: string) => {
    if (!confirm(`Are you sure you want to delete "${bookTitle}" from the inventory?`)) {
      return;
    }
    
    try {
      const bookToDelete = books.find(book => book.id === bookId);
      await deleteDoc(doc(db, "books", bookId));
      
      // Update local state
      setBooks(prevBooks => prevBooks.filter(book => book.id !== bookId));
      
      // Update book counter
      if (bookToDelete) {
        const counterRef = doc(db, "counters", "books");
        await updateDoc(counterRef, {
          total: increment(-1),
          recentChanges: increment(-bookToDelete.copies),
          lastUpdated: serverTimestamp()
        });
      }
      
      setSuccessMessage(`"${bookTitle}" has been removed from the inventory.`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccessMessage('');
      }, 3000);
    } catch (error) {
      console.error("Error deleting book:", error);
      setErrorMessage("Failed to delete book. Please try again.");
    }
  }, [books]);

  // Add category to editing book
  const addCategory = useCallback((category: string) => {
    if (!editingBook || !category.trim() || editingBook.categories.includes(category)) return;
    
    setEditingBook(prev => prev ? ({
      ...prev,
      categories: [...prev.categories, category]
    }) : prev);
  }, [editingBook]);

  // Remove category from editing book
  const removeCategory = useCallback((indexToRemove: number) => {
    if (!editingBook) return;
    
    setEditingBook(prev => prev ? ({
      ...prev,
      categories: prev.categories.filter((_, index) => index !== indexToRemove)
    }) : prev);
  }, [editingBook]);

  // Export inventory to CSV
  const exportToCSV = useCallback(() => {
    // Create CSV header
    const csvHeader = ['Title', 'Author', 'ISBN', 'Categories', 'Shelf Number', 'Copies', 'Status', 'Added Date'].join(',');
    
    // Create CSV rows
    const csvRows = filteredBooks.map(book => {
      const addedDate = book.addedAt ? new Date(book.addedAt.seconds * 1000).toLocaleDateString() : 'N/A';
      const categories = book.categories ? `"${book.categories.join(', ')}"` : '""';
      const isAvailable = typeof book.copies === 'number' && book.copies > 0;
      const isLowStock = isAvailable && book.copies <= 3;
      const status = !isAvailable ? 'Unavailable' : (isLowStock ? 'Low Stock' : 'Available');
      
      return [
        `"${book.title.replace(/"/g, '""')}"`,
        `"${book.author.replace(/"/g, '""')}"`,
        `"${book.isbn}"`,
        categories,
        `"${book.shelfNumber}"`,
        typeof book.copies === 'number' && !isNaN(book.copies) ? book.copies : 0,
        `"${status}"`,
        `"${addedDate}"`
      ].join(',');
    });
    
    // Combine header and rows
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Create a Blob containing the CSV data
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // Create a URL for the Blob
    const url = URL.createObjectURL(blob);
    
    // Create a link element
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `library-inventory-${new Date().toISOString().split('T')[0]}.csv`);
    
    // Append the link to the document
    document.body.appendChild(link);
    
    // Click the link to trigger the download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [filteredBooks]);

  // Handle click outside modal
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setIsEditing(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle new category input for editing book
  const handleCategoryKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = e.target as HTMLInputElement;
      const category = input.value.trim();
      if (category) {
        addCategory(category);
        input.value = '';
      }
    }
  }, [addCategory]);

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
  ), [sortBy, sortDirection, handleSortChange, styles]);

  // Render book rows as a separate component
  const BookRow = useCallback(({ book }: { book: Book }) => {
    // Calculate if stock is low (3 or fewer copies but not zero)
    const isLowStock = typeof book.copies === 'number' && book.copies > 0 && book.copies <= 3;
    // Calculate if book is available (has at least 1 copy)
    const isAvailable = typeof book.copies === 'number' && book.copies > 0;
    
    return (
      <div className={styles.tableRow}>
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
        <div className={styles.tableCell}>
          <div className={styles.copiesContainer}>
            {typeof book.copies === 'number' && !isNaN(book.copies) ? book.copies : 0}
            {isLowStock && (
              <span className={styles.lowStockWarning} title="Low stock">⚠️</span>
            )}
          </div>
        </div>
        <div className={styles.tableCell}>
          <span className={`${styles.statusBadge} ${isAvailable ? (isLowStock ? styles.lowStock : styles.available) : styles.unavailable}`}>
            {!isAvailable ? 'Unavailable' : (isLowStock ? 'Low Stock' : 'Available')}
          </span>
        </div>
        <div className={styles.tableCell}>
          <div className={styles.actionButtons}>
            <button 
              className={styles.editButton} 
              onClick={() => handleEditBook(book)}
              aria-label="Edit book"
            >
              <FiEdit />
            </button>
            <button 
              className={styles.deleteButton}
              onClick={() => handleDeleteBook(book.id, book.title)}
              aria-label="Delete book"
            >
              <FiTrash2 />
            </button>
          </div>
        </div>
      </div>
    );
  }, [handleEditBook, handleDeleteBook, styles]);
  
  return (
    <div className={styles.stocksPage}>
      <div className={styles.pageHeader}>
        <h1>Book Inventory Management</h1>
        <p>Manage your library's book inventory and stock levels</p>
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
              <option value="Low Stock">Low Stock</option>
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
        </div>
        
        <div className={styles.actions}>
          <button 
            className={styles.exportButton}
            onClick={exportToCSV}
            title="Export to CSV"
          >
            <FiDownload /> Export
          </button>
          <Link href="/admin/add-book" className={styles.addButton}>
            <FiPlus /> Add Book
          </Link>
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
        <div className={styles.inventoryTable}>
          {TableHeader}
          
          <div className={styles.tableBody}>
            {filteredBooks.map((book) => (
              <BookRow key={book.id} book={book} />
            ))}
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FiBookOpen size={48} />
          </div>
          <h3>No books found</h3>
          <p>
            {searchQuery || statusFilter !== 'All' || categoryFilter !== 'All'
              ? 'Try adjusting your search or filters' 
              : 'Your inventory is empty. Add books to get started.'}
          </p>
          {(!searchQuery && statusFilter === 'All' && categoryFilter === 'All') && (
            <Link href="/admin/add-book" className={styles.addButton}>
              <FiPlus /> Add Your First Book
            </Link>
          )}
        </div>
      )}
      
      {/* Edit Book Modal */}
      {isEditing && editingBook && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal} ref={modalRef}>
            <div className={styles.modalHeader}>
              <h2>Edit Book</h2>
              <button 
                className={styles.closeButton}
                onClick={() => setIsEditing(false)}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleUpdateBook} className={styles.editForm}>
              <div className={styles.modalBookInfo}>
                {editingBook.coverImage && (
                  <Image 
                    src={editingBook.coverImage} 
                    alt={editingBook.title}
                    width={60}
                    height={90}
                    className={styles.modalCover}
                    unoptimized={true}
                  />
                )}
                <div>
                  <h3>{editingBook.title}</h3>
                  <p>{editingBook.author}</p>
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="title">Title</label>
                  <input
                    type="text"
                    id="title"
                    name="title"
                    value={editingBook.title}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="author">Author</label>
                  <input
                    type="text"
                    id="author"
                    name="author"
                    value={editingBook.author}
                    onChange={handleFormChange}
                    required
                  />
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="categories">Categories</label>
                <div className={styles.categoriesContainer}>
                  {editingBook.categories.map((category, index) => (
                    <span key={index} className={styles.categoryTag}>
                      {category}
                      <button 
                        type="button" 
                        className={styles.removeCategory}
                        onClick={() => removeCategory(index)}
                        aria-label={`Remove ${category} category`}
                      >
                        <FiX size={14} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    id="newCategory"
                    placeholder="Add a category..."
                    onKeyDown={handleCategoryKeyDown}
                    className={styles.categoryInput}
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="shelfNumber">Shelf Number</label>
                  <input
                    type="text"
                    id="shelfNumber"
                    name="shelfNumber"
                    value={editingBook.shelfNumber}
                    onChange={handleFormChange}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="copies">Number of Copies</label>
                  <input
                    type="number"
                    id="copies"
                    name="copies"
                    min="0"
                    value={editingBook.copies.toString()}
                    onChange={handleFormChange}
                    onWheel={(e) => (e.target as HTMLInputElement).blur()} // Prevent scroll wheel from changing value
                    required
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="status">Status</label>
                  <select
                    id="status"
                    name="status"
                    value={editingBook.status}
                    onChange={handleFormChange}
                    required
                  >
                    <option value="Available">Available</option>
                    <option value="On Loan">On Loan</option>
                    <option value="Reserved">Reserved</option>
                    <option value="Lost">Lost</option>
                    <option value="Damaged">Damaged</option>
                  </select>
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="notes">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={editingBook.notes}
                  onChange={handleFormChange}
                  rows={3}
                ></textarea>
              </div>
              
              <div className={styles.modalActions}>
                <button 
                  type="button" 
                  className={styles.cancelButton}
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className={styles.saveButton}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

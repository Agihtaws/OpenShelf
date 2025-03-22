// src/app/admin/add-book/page.tsx
"use client"
import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { db } from '../../../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { FiSearch, FiPlus, FiBook, FiUser, FiHash, FiCalendar, FiBookmark, FiShoppingCart, FiTag, FiX } from 'react-icons/fi';
import styles from './AddBook.module.css';

interface BookSearchResult {
  id: string;
  title: string;
  authors: string[];
  publishedDate: string;
  description: string;
  categories: string[];
  imageLinks: {
    thumbnail?: string;
    small?: string;
    medium?: string;
    large?: string;
    extraLarge?: string;
    [key: string]: string | undefined;
  };
  industryIdentifiers: {
    type: string;
    identifier: string;
  }[];
  pageCount: number;
  publisher: string;
  language: string;
}

interface BookToAdd {
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
  notes: string;
  addedAt?: any;
}


// Common categories for suggestions
const COMMON_CATEGORIES = [
  'Fiction', 'Fantasy', 'Science Fiction', 'Mystery', 'Thriller', 'Romance',
  'Historical Fiction', 'Non-Fiction', 'Biography', 'Self-Help', 'Business',
  'History', 'Science', 'Technology', 'Philosophy', 'Psychology', 'Art',
  'Poetry', 'Children', 'Young Adult', 'Horror', 'Adventure', 'Dystopian',
  'Foreign Language Study', 'Educational', 'Academic', 'Classics', 'Comics',
  'Cooking', 'Crafts', 'Health', 'Religion', 'Sports', 'Travel'
];

export default function AddBookPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<BookSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedBook, setSelectedBook] = useState<BookToAdd | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [showCategorySuggestions, setShowCategorySuggestions] = useState(false);
  const [filteredCategorySuggestions, setFilteredCategorySuggestions] = useState<string[]>([]);
  const [previousSearches, setPreviousSearches] = useState<{[key: string]: BookSearchResult[]}>({});
  
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLUListElement>(null);
  const categoryInputRef = useRef<HTMLInputElement>(null);
  const categorySuggestionsRef = useRef<HTMLUListElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Focus search input on page load
  useEffect(() => {
    if (searchInputRef.current) {
      searchInputRef.current.focus();
    }

    // Click outside to close suggestions
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) && 
          searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
      
      if (categorySuggestionsRef.current && !categorySuggestionsRef.current.contains(event.target as Node) && 
          categoryInputRef.current && !categoryInputRef.current.contains(event.target as Node)) {
        setShowCategorySuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Filter category suggestions as user types
  useEffect(() => {
    if (newCategory.trim()) {
      const filtered = COMMON_CATEGORIES.filter(
        category => category.toLowerCase().includes(newCategory.toLowerCase())
      );
      setFilteredCategorySuggestions(filtered);
      setShowCategorySuggestions(filtered.length > 0);
    } else {
      setFilteredCategorySuggestions([]);
      setShowCategorySuggestions(false);
    }
  }, [newCategory]);

  // Fetch suggestions as user types with debounce
  useEffect(() => {
    if (searchQuery.trim().length > 1) {
      // Clear previous timeout
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      // Set a timeout to avoid too many API calls
      searchTimeoutRef.current = setTimeout(async () => {
        try {
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
          const response = await fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=5&key=${apiKey}`
          );
          
          const data = await response.json();
          
          if (data.items && data.items.length > 0) {
            // Extract suggestions from results
            const newSuggestions = data.items.map((item: any) => item.volumeInfo.title);
            setSuggestions(newSuggestions);
            setShowSuggestions(true);
          } else {
            setSuggestions([]);
            setShowSuggestions(false);
          }
        } catch (error) {
          console.error('Error fetching suggestions:', error);
          setSuggestions([]);
          setShowSuggestions(false);
        }
      }, 300); // 300ms delay
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchQuery]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setErrorMessage('');
    setShowSuggestions(false);

    // Check if we already have results for this query
    if (previousSearches[searchQuery]) {
      setSearchResults(previousSearches[searchQuery]);
      setIsSearching(false);
      return;
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
      const response = await fetch(
        `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=15&orderBy=relevance&printType=books&key=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        const books = data.items.map((item: any) => ({
          id: item.id,
          ...item.volumeInfo
        }));
        setSearchResults(books);
        
        // Save to previous searches
        setPreviousSearches(prev => ({
          ...prev,
          [searchQuery]: books
        }));
      } else {
        setSearchResults([]);
        setErrorMessage('No books found matching your search criteria.');
      }
    } catch (error) {
      console.error('Error searching books:', error);
      setErrorMessage('An error occurred while searching for books. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const selectSuggestion = (suggestion: string) => {
    setSearchQuery(suggestion);
    setShowSuggestions(false);
    handleSearch({ preventDefault: () => {} } as React.FormEvent);
  };

  const selectBookForAdding = (book: BookSearchResult) => {
    // Get ISBN if available
    let isbn = '';
    if (book.industryIdentifiers) {
      const isbn13 = book.industryIdentifiers.find(id => id.type === 'ISBN_13');
      const isbn10 = book.industryIdentifiers.find(id => id.type === 'ISBN_10');
      isbn = isbn13 ? isbn13.identifier : isbn10 ? isbn10.identifier : '';
    }

    // Get the best available cover image
    let coverImage = '';

    // First check if imageLinks exists at all
    if (book.imageLinks) {
      // Try each image size in order of preference (from highest to lowest quality)
      if (book.imageLinks.extraLarge) {
        coverImage = book.imageLinks.extraLarge;
      } else if (book.imageLinks.large) {
        coverImage = book.imageLinks.large;
      } else if (book.imageLinks.medium) {
        coverImage = book.imageLinks.medium;
      } else if (book.imageLinks.small) {
        coverImage = book.imageLinks.small;
      } else if (book.imageLinks.thumbnail) {
        coverImage = book.imageLinks.thumbnail;
      }

      // Use Google Books API's zoom parameter for higher resolution
      if (coverImage.includes('books.google.com')) {
        coverImage = coverImage.replace('&zoom=1', '&zoom=3');
      }

      // Ensure HTTPS
      if (coverImage && coverImage.startsWith('http:')) {
        coverImage = coverImage.replace('http:', 'https:');
      }
    }

    // If no image from Google Books API but we have an ISBN, try Open Library covers
    if (!coverImage && isbn) {
      // Try Open Library covers API with large size (L)
      coverImage = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
    }

    // Set a fallback image if none is available
    if (!coverImage) {
      coverImage = '/images/no-cover-available.jpg';
    }

    // Process categories
    let categories = book.categories || [];
    if (categories.length === 0 && book.description) {
      // Try to extract categories from description if none provided
      const description = book.description.toLowerCase();
      const foundCategories = COMMON_CATEGORIES.filter(category => 
        description.includes(category.toLowerCase())
      );
      
      if (foundCategories.length > 0) {
        categories = foundCategories;
      } else {
        // Default category based on publisher or other metadata
        if (book.publisher && book.publisher.toLowerCase().includes('academic')) {
          categories = ['Academic'];
        } else {
          categories = ['General'];
        }
      }
    }
    
    // Generate a shelf number suggestion based on category and author
    const mainCategory = categories.length > 0 ? categories[0] : 'General';
    const authorLastName = book.authors && book.authors.length > 0 
      ? book.authors[0].split(' ').pop()?.substring(0, 3).toUpperCase() 
      : 'UNK';
    const shelfNumberSuggestion = `${mainCategory.substring(0, 3).toUpperCase()}-${authorLastName}-${Math.floor(Math.random() * 100)}`;

    setSelectedBook({
      googleBooksId: book.id,
      title: book.title || '',
      author: book.authors ? book.authors.join(', ') : '',
      isbn: isbn,
      publishedDate: book.publishedDate || '',
      publisher: book.publisher || '',
      description: book.description || 'No description available.',
      pageCount: book.pageCount || 0,
      categories: categories,
      coverImage: coverImage,
      language: book.language || '',
      shelfNumber: shelfNumberSuggestion,
      copies: 1, // Set default copies to 1
      acquisitionDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    

    // Scroll to form
    setTimeout(() => {
      document.getElementById('addBookForm')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (!selectedBook) return;
    
    const { name, value } = e.target;
    
    // Fix for number fields
    if (name === 'copies') {
      const numValue = parseFloat(value);
      setSelectedBook({
        ...selectedBook,
        [name]: isNaN(numValue) ? 0 : numValue // Default to 0 if NaN
      });
    } else {
      setSelectedBook({
        ...selectedBook,
        [name]: value
      });
    }
  };

  const addCategory = (category: string) => {
    if (!selectedBook) return;
    if (!category.trim() || selectedBook.categories.includes(category)) return;
    
    setSelectedBook({
      ...selectedBook,
      categories: [...selectedBook.categories, category]
    });
    setNewCategory('');
    setShowCategorySuggestions(false);
  };

  const removeCategory = (indexToRemove: number) => {
    if (!selectedBook) return;
    
    setSelectedBook({
      ...selectedBook,
      categories: selectedBook.categories.filter((_, index) => index !== indexToRemove)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBook) return;

    setIsSubmitting(true);
    setSuccessMessage('');
    setErrorMessage('');

    try {
      // Add timestamp to the book data
      const bookData = {
        ...selectedBook,
        addedAt: serverTimestamp()
      };
      
      // Add to Firestore collection
      const docRef = await addDoc(collection(db, "books"), bookData);
      
      console.log('Book added to library with ID:', docRef.id);
      setSuccessMessage(`"${selectedBook.title}" has been successfully added to the library.`);
      
      // Reset form for a new book
      setSelectedBook(null);
      setSearchQuery('');
      
      // Focus back on search
      searchInputRef.current?.focus();
    } catch (error) {
      console.error('Error adding book:', error);
      setErrorMessage('Failed to add book. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelAddBook = () => {
    setSelectedBook(null);
    searchInputRef.current?.focus();
  };

  return (
    <div className={styles.addBookPage}>
      <div className={styles.pageHeader}>
        <h1>Add New Book to Library</h1>
        <p>Search for books by title, author, or ISBN and add them to your library inventory</p>
      </div>

      <div className={styles.searchSection}>
        <form onSubmit={handleSearch} className={styles.searchForm}>
          <div className={styles.searchInputWrapper}>
            <FiSearch className={styles.searchIcon} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchQuery.trim().length > 1 && setShowSuggestions(true)}
              placeholder="Search by title, author, or ISBN..."
              className={styles.searchInput}
              disabled={isSearching}
              autoComplete="off"
            />
            {showSuggestions && suggestions.length > 0 && (
              <ul ref={suggestionsRef} className={styles.suggestions}>
                {suggestions.map((suggestion, index) => (
                  <li 
                    key={index} 
                    onClick={() => selectSuggestion(suggestion)}
                    className={styles.suggestionItem}
                  >
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button 
            type="submit" 
            className={styles.searchButton}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? 'Searching...' : 'Search'}
          </button>
        </form>

        {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
        
        {searchResults.length > 0 && (
          <div className={styles.searchResults}>
            <h2>Search Results</h2>
            <div className={styles.resultsGrid}>
              {searchResults.map((book) => (
                <div key={book.id} className={styles.bookSearchCard} onClick={() => selectBookForAdding(book)}>
                  <div className={styles.bookThumbnail}>
                  
                    {book.imageLinks?.thumbnail ? (
                      <Image
                        src={book.imageLinks.thumbnail.replace('http:', 'https:')}
                        alt={book.title}
                        width={150}
                        height={225}
                        quality={95}
                        priority={true}
                        unoptimized={false}
                        placeholder="blur"
                        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.onerror = null; // Prevent infinite loop
                          target.src = '/images/no-cover-available.jpg';
                        }}
                      />
                    ) : (
                      <div className={styles.noImage}>
                        <FiBook size={40} />
                      </div>
                    )}

                  </div>
                  <div className={styles.bookInfo}>
                    <h3>{book.title}</h3>
                    <p className={styles.bookAuthor}>
                      {book.authors ? book.authors.join(', ') : 'Unknown Author'}
                    </p>
                    <p className={styles.bookDetails}>
                      {book.publishedDate && <span>{book.publishedDate.substring(0, 4)}</span>}
                      {book.publisher && <span> • {book.publisher}</span>}
                    </p>
                    <button 
                      type="button" 
                      className={styles.addButton} 
                      onClick={(e) => {
                        e.stopPropagation();
                        selectBookForAdding(book);
                      }}
                    >
                      <FiPlus /> Add to Library
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedBook && (
        <div className={styles.addBookFormSection} id="addBookForm">
          <h2>Add Book to Library</h2>
          
          {successMessage && <div className={styles.successMessage}>{successMessage}</div>}
          
          <form onSubmit={handleSubmit} className={styles.addBookForm}>
            <div className={styles.formGrid}>
              <div className={styles.bookPreview}>
                {selectedBook.coverImage ? (
                  <Image
                    src={selectedBook.coverImage}
                    alt={selectedBook.title}
                    width={250}
                    height={375}
                    className={styles.bookCover}
                    quality={95}
                    priority={true}
                    unoptimized={false}
                    placeholder="blur"
                    blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII="
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.onerror = null; // Prevent infinite loop
                      target.src = '/images/no-cover-available.jpg';
                    }}
                  />
                ) : (
                  <div className={styles.noCoverImage}>
                    <FiBook size={80} />
                  </div>
                )}

                <h3>{selectedBook.title}</h3>
                <p>{selectedBook.author}</p>
                
                <div className={styles.previewCategories}>
                  {selectedBook.categories.map((category, index) => (
                    <span key={index} className={styles.previewCategoryTag}>
                      {category}
                    </span>
                  ))}
                </div>
              </div>
              
              <div className={styles.formFields}>
                <div className={styles.formSection}>
                  <h4>Book Information</h4>
                  
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="title">
                        <FiBook /> Title
                      </label>
                      <input
                        type="text"
                        id="title"
                        name="title"
                        value={selectedBook.title}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="author">
                        <FiUser /> Author
                      </label>
                      <input
                        type="text"
                        id="author"
                        name="author"
                        value={selectedBook.author}
                        onChange={handleFormChange}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label htmlFor="isbn">
                        <FiHash /> ISBN
                      </label>
                      <input
                        type="text"
                        id="isbn"
                        name="isbn"
                        value={selectedBook.isbn}
                        onChange={handleFormChange}
                      />
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="publishedDate">
                        <FiCalendar /> Publication Date
                      </label>
                      <input
                        type="text"
                        id="publishedDate"
                        name="publishedDate"
                        value={selectedBook.publishedDate}
                        onChange={handleFormChange}
                      />
                    </div>
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="categories">
                      <FiTag /> Categories
                    </label>
                    <div className={styles.categoriesContainer}>
                      {selectedBook.categories.map((category, index) => (
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
                      <div className={styles.categoryInputWrapper}>
                        <input
                          ref={categoryInputRef}
                          type="text"
                          id="newCategory"
                          placeholder="Add a category..."
                          value={newCategory}
                          onChange={(e) => setNewCategory(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              addCategory(newCategory);
                            }
                          }}
                          onFocus={() => {
                            if (filteredCategorySuggestions.length > 0) {
                              setShowCategorySuggestions(true);
                            }
                          }}
                          className={styles.categoryInput}
                        />
                        {showCategorySuggestions && filteredCategorySuggestions.length > 0 && (
                          <ul ref={categorySuggestionsRef} className={styles.categorySuggestions}>
                            {filteredCategorySuggestions.map((suggestion, index) => (
                              <li 
                              key={index} 
                              onClick={() => {
                                addCategory(suggestion);
                              }}
                              className={styles.categorySuggestionItem}
                            >
                              {suggestion}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={selectedBook.description}
                    onChange={handleFormChange}
                    rows={4}
                  ></textarea>
                </div>
              </div>
              
              <div className={styles.formSection}>
                <h4>Library Management</h4>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="shelfNumber">
                      <FiBookmark /> Shelf Number
                    </label>
                    <input
                      type="text"
                      id="shelfNumber"
                      name="shelfNumber"
                      value={selectedBook.shelfNumber}
                      onChange={handleFormChange}
                      required
                      placeholder="e.g., A-12-B"
                    />
                  </div>
                  
                  <div className={styles.formGroup}>
                    <label htmlFor="copies">
                      <FiShoppingCart /> Number of Copies
                    </label>
                    <input
                      type="number"
                      id="copies"
                      name="copies"
                      min="1"
                      value={selectedBook.copies}
                      onChange={(e) => {
                        const numValue = parseInt(e.target.value);
                        setSelectedBook({
                          ...selectedBook,
                          copies: isNaN(numValue) ? 1 : numValue
                        });
                      }}
                      onWheel={(e) => e.currentTarget.blur()}
                      required
                    />
                  </div>
                </div>
                
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label htmlFor="acquisitionDate">Acquisition Date</label>
                    <input
                      type="date"
                      id="acquisitionDate"
                      name="acquisitionDate"
                      value={selectedBook.acquisitionDate}
                      onChange={handleFormChange}
                      required
                    />
                  </div>
                </div>
              </div>
              
              <div className={styles.formSection}>
                <h4>Additional Information</h4>
                
                <div className={styles.formGroup}>
                  <label htmlFor="notes">Notes</label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={selectedBook.notes}
                    onChange={handleFormChange}
                    placeholder="Add any additional notes about this book..."
                    rows={3}
                  ></textarea>
                </div>
              </div>
            </div>
          </div>
          
          <div className={styles.formActions}>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={cancelAddBook}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Adding Book...' : 'Add Book to Library'}
            </button>
          </div>
        </form>
      </div>
    )}
  </div>
  );
}

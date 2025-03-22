// src/components/home/TrendingBooks.tsx
"use client"
import { useEffect, useState } from 'react';
import Image from 'next/image';
import styles from './TrendingBooks.module.css';

interface Book {
  id: string;
  cover: string;
  title: string;
  author: string;
  category: string;
}

export default function TrendingBooks() {
  const [trendingBooks, setTrendingBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchTrendingBooks = async () => {
    try {
      setLoading(true);
      // Using environment variable for API key
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
      
      // Add randomization to get different results
      const queries = ['bestseller', 'new release', 'popular fiction', 'top rated', 'award winning'];
      const randomQuery = queries[Math.floor(Math.random() * queries.length)];
      
      // Add a timestamp parameter to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${randomQuery}&maxResults=10&key=${apiKey}&_=${timestamp}`);
      const data = await response.json();
      
      if (data.items && data.items.length > 0) {
        // Process books with simpler logic
        const processedBooks = data.items
          .filter((item: any) => item.volumeInfo.imageLinks?.thumbnail) // Just ensure it has a thumbnail
          .map((item: any) => {
            const volumeInfo = item.volumeInfo;
            
            // Get the thumbnail and ensure it's HTTPS
            let coverUrl = volumeInfo.imageLinks.thumbnail;
            
            // Replace http:// with https:// to avoid mixed content errors
            if (coverUrl.startsWith('http:')) {
              coverUrl = coverUrl.replace('http:', 'https:');
            }
            
            // Try to get a larger image by modifying the URL
            coverUrl = coverUrl.replace('&zoom=1', '&zoom=2');
            
            return {
              id: item.id,
              cover: coverUrl,
              title: volumeInfo.title || 'Unknown Title',
              author: volumeInfo.authors ? volumeInfo.authors[0] : 'Unknown Author',
              category: volumeInfo.categories ? volumeInfo.categories[0] : 'Bestseller'
            };
          });
        
        // Take only the first 4 books
        setTrendingBooks(processedBooks.slice(0, 4));
        
        // Set last updated timestamp
        const now = new Date();
        setLastUpdated(now.toLocaleString());
      }
    } catch (error) {
      console.error('Error fetching trending books:', error);
      // Add fallback books in case of error
      setTrendingBooks([
        {
          id: '1',
          cover: "/images/books/book1.jpg",
          title: "The Library at Mount Char",
          author: "Scott Hawkins",
          category: "Fantasy"
        },
        {
          id: '2',
          cover: "/images/books/book2.jpg",
          title: "The Midnight Library",
          author: "Matt Haig",
          category: "Fiction"
        },
        {
          id: '3',
          cover: "/images/books/book3.jpg",
          title: "The Library Book",
          author: "Susan Orlean",
          category: "Non-Fiction"
        },
        {
          id: '4',
          cover: "/images/books/book4.jpg",
          title: "The Personal Librarian",
          author: "Marie Benedict",
          category: "Historical Fiction"
        }
      ]);
      
      // Set last updated timestamp even for fallback data
      const now = new Date();
      setLastUpdated(now.toLocaleString());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTrendingBooks();
    
    // Set up interval to refresh data daily (86400000 ms) instead of hourly
    const intervalId = setInterval(() => {
      fetchTrendingBooks();
    }, 86400000);
    
    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <section className={styles.trendingBooks}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <h2>Trending Books This Month</h2>
          <p>Discover what readers are loving right now</p>
          {lastUpdated && <small className={styles.lastUpdated}>Last updated: {lastUpdated}</small>}
        </div>
        
        <div className={styles.booksGrid}>
          {loading ? (
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinner}></div>
            </div>
          ) : trendingBooks.length > 0 ? (
            trendingBooks.map((book) => (
              <div key={book.id} className={styles.bookCard}>
                <div className={styles.bookCover}>
                  <Image 
                    src={book.cover} 
                    alt={book.title} 
                    width={180} 
                    height={270} 
                    className={styles.coverImage}
                    unoptimized={true}
                  />
                </div>
                <div className={styles.bookInfo}>
                  <h3>{book.title}</h3>
                  <p className={styles.bookAuthor}>by {book.author}</p>
                  <span className={styles.bookCategory}>{book.category}</span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.noResults}>
              <p>No trending books found. Please try again later.</p>
            </div>
          )}
        </div>
        
        <div className={styles.refreshButton}>
          <button onClick={fetchTrendingBooks} className={styles.refreshBtn}>
            Refresh Books
          </button>
        </div>
      </div>
    </section>
  );
}

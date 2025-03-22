// src/utils/googleBooksAPI.ts
const GOOGLE_BOOKS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_BOOKS_API_KEY;
const API_BASE_URL = 'https://www.googleapis.com/books/v1';

export interface GoogleBookItem {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    publishedDate?: string;
    description?: string;
    categories?: string[];
    imageLinks?: {
      thumbnail?: string;
      smallThumbnail?: string;
      small?: string;
      medium?: string;
      large?: string;
      extraLarge?: string;
    };
    pageCount?: number;
    language?: string;
    publisher?: string;
    industryIdentifiers?: {
      type: string;
      identifier: string;
    }[];
  };
  saleInfo?: {
    isEbook: boolean;
    saleability: string;
    listPrice?: {
      amount: number;
      currencyCode: string;
    };
  };
}

export async function searchBooks(query: string, maxResults: number = 10): Promise<GoogleBookItem[]> {
  try {
    // Add error handling for empty queries
    if (!query || query.trim() === '') {
      console.error('Empty search query provided');
      return [];
    }
    
    // Add retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let lastError;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/volumes?q=${encodeURIComponent(query)}&maxResults=${maxResults}&key=${GOOGLE_BOOKS_API_KEY}`
        );
        
        if (!response.ok) {
          throw new Error(`Google Books API error: ${response.status}`);
        }
        
        const data = await response.json();
        return data.items || [];
      } catch (error) {
        lastError = error;
        attempts++;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // If we've exhausted all attempts
    console.error('Error searching books after multiple attempts:', lastError);
    return [];
  } catch (error) {
    console.error('Error searching books:', error);
    return [];
  }
}

export async function getBookById(id: string): Promise<GoogleBookItem | null> {
  try {
    // Add error handling for empty ID
    if (!id || id.trim() === '') {
      console.error('Empty book ID provided');
      return null;
    }
    
    // Add retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let lastError;
    
    while (attempts < maxAttempts) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/volumes/${id}?key=${GOOGLE_BOOKS_API_KEY}`
        );
        
        if (!response.ok) {
          throw new Error(`Google Books API error: ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        lastError = error;
        attempts++;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // If we've exhausted all attempts
    console.error('Error fetching book by ID after multiple attempts:', lastError);
    return null;
  } catch (error) {
    console.error('Error fetching book by ID:', error);
    return null;
  }
}

export async function getBooksByCategory(category: string, maxResults: number = 10): Promise<GoogleBookItem[]> {
  try {
    // Add error handling for empty category
    if (!category || category.trim() === '') {
      console.error('Empty category provided');
      return [];
    }
    
    const response = await fetch(
      `${API_BASE_URL}/volumes?q=subject:${encodeURIComponent(category)}&maxResults=${maxResults}&key=${GOOGLE_BOOKS_API_KEY}`
    );
    
    if (!response.ok) {
      throw new Error(`Google Books API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.items || [];
  } catch (error) {
    console.error('Error fetching books by category:', error);
    return [];
  }
}

export function getHighQualityCoverImage(book: GoogleBookItem): string {
  // Default image if no cover is available
  const defaultCover = '/images/no-cover-available.jpg';
  
  if (!book?.volumeInfo?.imageLinks) {
    return defaultCover;
  }
  
  // Get the best available image in order of preference
  let coverUrl = book.volumeInfo.imageLinks.extraLarge || 
                 book.volumeInfo.imageLinks.large || 
                 book.volumeInfo.imageLinks.medium || 
                 book.volumeInfo.imageLinks.small || 
                 book.volumeInfo.imageLinks.thumbnail || 
                 book.volumeInfo.imageLinks.smallThumbnail;
  
  // If still no image, return default
  if (!coverUrl) {
    return defaultCover;
  }
  
  // Try to get higher resolution from Google Books
  if (coverUrl.includes('books.google.com')) {
    coverUrl = coverUrl.replace('&zoom=1', '&zoom=3');
  }
  
  // Ensure HTTPS
  coverUrl = coverUrl.replace('http://', 'https://');
  
  return coverUrl;
}

export function formatBookData(googleBook: GoogleBookItem) {
  try {
    // Add defensive coding to handle missing data
    if (!googleBook || !googleBook.volumeInfo) {
      throw new Error('Invalid book data structure');
    }
    
    // Get ISBN if available
    let isbn = '';
    if (googleBook.volumeInfo.industryIdentifiers) {
      const isbn13 = googleBook.volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_13');
      const isbn10 = googleBook.volumeInfo.industryIdentifiers.find(id => id.type === 'ISBN_10');
      isbn = isbn13 ? isbn13.identifier : isbn10 ? isbn10.identifier : '';
    }
    
    return {
      id: googleBook.id || `unknown_${Math.random().toString(36).substring(2, 11)}`,
      title: googleBook.volumeInfo.title || 'Unknown Title',
      author: googleBook.volumeInfo.authors ? googleBook.volumeInfo.authors.join(', ') : 'Unknown Author',
      isbn: isbn,
      coverImage: getHighQualityCoverImage(googleBook),
      description: googleBook.volumeInfo.description || 'No description available.',
      categories: googleBook.volumeInfo.categories || [],
      publishedDate: googleBook.volumeInfo.publishedDate || 'Unknown',
      pageCount: googleBook.volumeInfo.pageCount || 0,
      publisher: googleBook.volumeInfo.publisher || 'Unknown Publisher',
      language: googleBook.volumeInfo.language || 'en',
      status: 'Available' // Default status
    };
  } catch (error) {
    console.error('Error formatting book data:', error);
    
    // Return minimal valid book data if there's an error
    return {
      id: googleBook?.id || `unknown_${Math.random().toString(36).substring(2, 11)}`,
      title: googleBook?.volumeInfo?.title || 'Unknown Title',
      author: 'Unknown Author',
      coverImage: '/images/no-cover-available.jpg',
      description: 'No description available.',
      categories: [],
      publishedDate: 'Unknown',
      status: 'Available'
    };
  }
}

// Function to get book details from Google Books API
export async function getBookDetails(query: string): Promise<{title: string, author: string, isbn: string, publishedDate: string}> {
  try {
    // Add error handling for empty query
    if (!query || query.trim() === '') {
      console.error('Empty query provided');
      return { 
        title: 'Not found', 
        author: 'Not found', 
        isbn: 'Not found', 
        publishedDate: 'Not found' 
      };
    }
    
    // Add retry logic
    let attempts = 0;
    const maxAttempts = 3;
    let lastError;
    
    while (attempts < maxAttempts) {
      try {
        // Encode the query for URL
        const encodedQuery = encodeURIComponent(query);
        const response = await fetch(
          `${API_BASE_URL}/volumes?q=${encodedQuery}&maxResults=1&key=${GOOGLE_BOOKS_API_KEY}`
        );
        
        if (!response.ok) {
          throw new Error(`Google Books API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.items || data.items.length === 0) {
          return { 
            title: 'Not found', 
            author: 'Not found', 
            isbn: 'Not found', 
            publishedDate: 'Not found' 
          };
        }
        
        const book = data.items[0];
        const volumeInfo = book.volumeInfo;
        
        // Extract title
        const title = volumeInfo.title || 'Not found';
        
        // Extract author
        const author = volumeInfo.authors ? volumeInfo.authors.join(', ') : 'Not found';
        
        // Extract ISBN
        let isbn = 'Not found';
        if (volumeInfo.industryIdentifiers) {
          const isbn13 = volumeInfo.industryIdentifiers.find((id: { type: string; identifier: string }) => id.type === 'ISBN_13');
          const isbn10 = volumeInfo.industryIdentifiers.find((id: { type: string; identifier: string }) => id.type === 'ISBN_10');
          isbn = isbn13 ? isbn13.identifier : isbn10 ? isbn10.identifier : 'Not found';
        }
        
        // Extract publication date
        const publishedDate = volumeInfo.publishedDate || 'Not found';
        
        return { title, author, isbn, publishedDate };
      } catch (error) {
        lastError = error;
        attempts++;
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // If we've exhausted all attempts
    console.error('Error fetching book details after multiple attempts:', lastError);
    return { 
      title: 'Error', 
      author: 'Error', 
      isbn: 'Error', 
      publishedDate: 'Error' 
    };
  } catch (error) {
    console.error('Error fetching book details:', error);
    return { 
      title: 'Error', 
      author: 'Error', 
      isbn: 'Error', 
      publishedDate: 'Error' 
    };
  }
}

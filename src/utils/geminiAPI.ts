// src/utils/geminiAPI.ts
import { db } from '@/firebaseConfig';
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { searchBooks, formatBookData } from '@/utils/googleBooksAPI';

// Simple recommendation function that just returns available books
export async function getStockAwareRecommendations(
  userId: string,
  favoriteBooks: any[],
  borrowedBooks: any[],
  reservedBooks: any[] = []
): Promise<any[]> {
  try {
    console.log("Starting recommendations for user:", userId);
    
    // Get all books with at least one copy
    const booksQuery = query(
      collection(db, "books"),
      where("copies", ">", 0),
      limit(20)
    );
    
    const booksSnapshot = await getDocs(booksQuery);
    const availableBooks: any[] = [];
    
    // Process each book
    for (const bookDoc of booksSnapshot.docs) {
      const bookData = bookDoc.data();
      const bookId = bookDoc.id;
      
      // Skip if user already has this book
      const allUserBooks = [...favoriteBooks, ...borrowedBooks, ...reservedBooks];
      if (allUserBooks.some(book => book.id === bookId)) {
        continue;
      }
      
      // Check borrowed count
      const borrowedQuery = query(
        collection(db, "borrows"),
        where("bookId", "==", bookId),
        where("status", "in", ["borrowed", "overdue"])
      );
      
      const borrowedSnapshot = await getDocs(borrowedQuery);
      const borrowedCount = borrowedSnapshot.size;
      
      // Check reserved count
      const reservedQuery = query(
        collection(db, "reserves"),
        where("bookId", "==", bookId),
        where("status", "==", "reserved")
      );
      
      const reservedSnapshot = await getDocs(reservedQuery);
      const reservedCount = reservedSnapshot.size;
      
      // Calculate available copies
      const totalCopies = bookData.copies || 0;
      const availableCopies = Math.max(0, totalCopies - borrowedCount - reservedCount);
      
      if (availableCopies > 0) {
        // Create recommendation reason
        let reason = "This book is currently available in our library.";
        
        // Check if book matches user's interests
        const userCategories = new Set<string>();
        allUserBooks.forEach(book => {
          if (book.categories) {
            book.categories.forEach((category: string) => userCategories.add(category));
          }
        });
        
        if (bookData.categories) {
          for (const category of bookData.categories) {
            if (userCategories.has(category)) {
              reason = `This book is in the ${category} category that you enjoy.`;
              break;
            }
          }
        }
        
        // Add to recommendations
        availableBooks.push({
          id: bookId,
          title: bookData.title || "Unknown Title",
          author: bookData.author || "Unknown Author",
          coverImage: bookData.coverImage || "",
          description: bookData.description || "",
          categories: bookData.categories || [],
          publishedDate: bookData.publishedDate || "",
          reason: reason,
          availableCopies: availableCopies,
          totalCopies: totalCopies,
          status: 'available'
        });
        
        // Limit to 5 recommendations
        if (availableBooks.length >= 5) {
          break;
        }
      }
    }
    
    console.log(`Found ${availableBooks.length} recommendations`);
    return availableBooks;
  } catch (error) {
    console.error("Error getting recommendations:", error);
    return [];
  }
}

// This is a placeholder function that just returns popular books
export async function getBookRecommendations(
  categories: string[],
  authors: string[],
  readingHistory: string[],
  numRecommendations = 5
): Promise<any[]> {
  try {
    // Just get popular books from the database
    const booksQuery = query(
      collection(db, "books"),
      limit(numRecommendations)
    );
    
    const booksSnapshot = await getDocs(booksQuery);
    const recommendations: any[] = [];
    
    booksSnapshot.forEach(doc => {
      const bookData = doc.data();
      recommendations.push({
        title: bookData.title || "Unknown Title",
        author: bookData.author || "Unknown Author",
        reason: "This is a popular book in our library."
      });
    });
    
    return recommendations;
  } catch (error) {
    console.error("Error getting book recommendations:", error);
    return [];
  }
}

// Simple function to check if a book matches user preferences
export function matchesUserPreferences(
  book: any,
  userCategories: string[],
  userAuthors: string[]
): boolean {
  // Check if book has categories and if any match user categories
  const bookCategories = book.categories || [];
  const hasMatchingCategory = bookCategories.some((category: string) => 
    userCategories.includes(category)
  );
  
  // Check if book author matches any user authors
  const hasMatchingAuthor = userAuthors.some(author =>
    (book.author || "").toLowerCase().includes(author.toLowerCase())
  );
  
  return hasMatchingCategory || hasMatchingAuthor;
}

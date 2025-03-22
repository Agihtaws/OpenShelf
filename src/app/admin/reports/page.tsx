// src/app/admin/reports/page.tsx (Simplified Version)
"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './reports.module.css';
import { db } from '../../../firebaseConfig';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where, 
  Timestamp,
  doc,
  getDoc,
  getCountFromServer,
  limit,
  DocumentData,
  QuerySnapshot,
  Query
} from 'firebase/firestore';

import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from 'recharts';
import { 
  FiCalendar, FiDownload, FiFilter, FiRefreshCw, FiPieChart, 
  FiBarChart2, FiTrendingUp, FiUsers, FiBook, FiClock, FiBookOpen, FiDollarSign
} from 'react-icons/fi';
  
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Define types for the data structures
type ChartDataPoint = {
  time: string;
  value: number;
  date: Date;
};

type BookDetails = {
  id: string;
  title: string;
  author: string;
  checkouts: number;
};

type CategoryData = {
  name: string;
  value: number;
};

type PatronData = {
  id: string;
  name: string;
  checkouts: number;
};

type PerformanceData = {
  subject: string;
  A: number;
  fullMark: number;
};

type ColorScheme = {
  [key: string]: string;
};

export default function ReportsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [exportLoading, setExportLoading] = useState<boolean>(false);

  // Metrics state
  const [borrowedData, setBorrowedData] = useState<ChartDataPoint[]>([]);
  const [returnedData, setReturnedData] = useState<ChartDataPoint[]>([]);
  const [reservedData, setReservedData] = useState<ChartDataPoint[]>([]);
  const [patronsData, setPatronsData] = useState<ChartDataPoint[]>([]);
  const [overdueData, setOverdueData] = useState<ChartDataPoint[]>([]);
  const [popularBooksData, setPopularBooksData] = useState<BookDetails[]>([]);
  const [categoryDistributionData, setCategoryDistributionData] = useState<CategoryData[]>([]);
  const [patronActivityData, setPatronActivityData] = useState<PatronData[]>([]);
  const [libraryPerformanceData, setLibraryPerformanceData] = useState<PerformanceData[]>([]);
  
  // Summary stats
  const [totalBooks, setTotalBooks] = useState<number>(0);
  const [totalPatrons, setTotalPatrons] = useState<number>(0);
  const [activeLoans, setActiveLoans] = useState<number>(0);
  const [overdueItems, setOverdueItems] = useState<number>(0);
  
  // Time period filter state
  const [timePeriod, setTimePeriod] = useState<string>('weekly');
  const [isChartLoading, setIsChartLoading] = useState<boolean>(true);
  const [showExportOptions, setShowExportOptions] = useState<boolean>(false);
  
  // Refs for exporting
  const reportsContentRef = useRef<HTMLDivElement>(null);
  
  // Colors for charts
  const COLORS: ColorScheme = {
    borrowed: '#4263eb',
    returned: '#40c057',
    reserved: '#fd7e14',
    patrons: '#7048e8',
    overdue: '#fa5252',
    books: '#12b886',
    primary: '#4263eb',
    secondary: '#7048e8',
    success: '#40c057',
    warning: '#fd7e14',
    danger: '#fa5252',
    info: '#15aabf'
  };

  // Format date function
  const formatDate = (date: Date | null): string => {
    if (!date) return "N/A";
    
    try {
      const day = date.getDate();
      const month = date.toLocaleString('default', { month: 'short' });
      const year = date.getFullYear();
      return `${day} ${month} ${year}`;
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  // Fetch circulation data for a specific metric
  const fetchCirculationData = useCallback(async (period: string, metric: string): Promise<ChartDataPoint[]> => {
    try {
      // Define the collection and time range based on the period
      let startDate = new Date();
      let timeField = '';
      let timeFormat = '';
      let groupBy = '';
      
      switch(period) {
        case 'daily':
          // Last 24 hours with hourly data points
          startDate.setHours(startDate.getHours() - 24);
          timeField = 'hour';
          timeFormat = 'ha'; // 1PM, 2PM, etc.
          groupBy = 'hour';
          break;
        case 'weekly':
          // Last 7 days with daily data points
          startDate.setDate(startDate.getDate() - 7);
          timeField = 'day';
          timeFormat = 'MMM d'; // Jan 1, Jan 2, etc.
          groupBy = 'day';
          break;
        case 'monthly':
          // Last 30 days with daily data points
          startDate.setDate(startDate.getDate() - 30);
          timeField = 'day';
          timeFormat = 'MMM d'; // Jan 1, Jan 2, etc.
          groupBy = 'day';
          break;
        case 'yearly':
          // Last 12 months with monthly data points
          startDate.setFullYear(startDate.getFullYear() - 1);
          timeField = 'month';
          timeFormat = 'MMM yyyy'; // Jan 2025, Feb 2025, etc.
          groupBy = 'month';
          break;
        default:
          startDate.setDate(startDate.getDate() - 7);
          timeField = 'day';
          timeFormat = 'MMM d';
          groupBy = 'day';
      }

      const startTimestamp = Timestamp.fromDate(startDate);

      // Determine which collection to query based on the metric
      let collectionName = '';
      let fieldName = '';
      let statusFilter: string | null = null;
      
      switch(metric) {
        case 'borrowed':
          collectionName = 'borrows';
          fieldName = 'borrowedAt';
          break;
        case 'returned':
          collectionName = 'borrows';
          fieldName = 'returnDate';
          break;
        case 'reserved':
          collectionName = 'reserves';
          fieldName = 'reservedAt';
          break;
        case 'patrons':
          collectionName = 'users_customer';
          fieldName = 'createdAt';
          break;
        case 'overdue':
          collectionName = 'borrows';
          fieldName = 'dueDate';
          statusFilter = 'overdue';
          break;
        default:
          collectionName = 'borrows';
          fieldName = 'borrowedAt';
      }

      // Query the appropriate collection
      let dataQuery: Query<DocumentData>;
      
      if (statusFilter === 'overdue') {
        // For overdue items, we need to look at current date vs. dueDate
        const now = new Date();
        const nowTimestamp = Timestamp.fromDate(now);
        
        dataQuery = query(
          collection(db, collectionName),
          where('status', 'in', ['borrowed', 'renewed']),
          where(fieldName, '<', nowTimestamp),
          where(fieldName, '>=', startTimestamp),
          orderBy(fieldName, "asc")
        );
      } else {
        dataQuery = query(
          collection(db, collectionName),
          where(fieldName, ">=", startTimestamp),
          orderBy(fieldName, "asc")
        );
      }

      const querySnapshot = await getDocs(dataQuery);
      
      // Process the data to group by the appropriate time unit
      const dataByTime: { [key: string]: number } = {};
      
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Skip if we're filtering by status and this document doesn't match
        if (statusFilter === 'overdue' && data.status !== 'borrowed' && data.status !== 'renewed') {
          return;
        }
        
        const timestamp = data[fieldName]?.toDate ? data[fieldName].toDate() : new Date(data[fieldName]);
        
        let timeKey = '';
        
        switch(groupBy) {
          case 'hour':
            timeKey = new Date(
              timestamp.getFullYear(),
              timestamp.getMonth(),
              timestamp.getDate(),
              timestamp.getHours()
            ).toISOString();
            break;
          case 'day':
            timeKey = new Date(
              timestamp.getFullYear(),
              timestamp.getMonth(),
              timestamp.getDate()
            ).toISOString();
            break;
          case 'month':
            timeKey = new Date(
              timestamp.getFullYear(),
              timestamp.getMonth(),
              1
            ).toISOString();
            break;
          default:
            timeKey = new Date(
              timestamp.getFullYear(),
              timestamp.getMonth(),
              timestamp.getDate()
            ).toISOString();
        }
        
        if (!dataByTime[timeKey]) {
          dataByTime[timeKey] = 0;
        }
        
        dataByTime[timeKey]++;
      });
      
      // Convert to the format expected by Recharts
      const chartData: ChartDataPoint[] = Object.keys(dataByTime).map(timeKey => {
        const date = new Date(timeKey);
        let formattedTime = '';
        
        switch(timeFormat) {
          case 'ha':
            formattedTime = date.getHours() + (date.getHours() >= 12 ? 'PM' : 'AM');
            break;
          case 'MMM d':
            formattedTime = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            break;
          case 'MMM yyyy':
            formattedTime = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
            break;
          default:
            formattedTime = date.toLocaleDateString();
        }
        
        return {
          time: formattedTime,
          value: dataByTime[timeKey],
          date: date // Keep the original date for sorting
        };
      });
      
      // Sort by date
      chartData.sort((a, b) => a.date.getTime() - b.date.getTime());
      
      return chartData;
    } catch (error) {
      console.error(`Error fetching ${metric} data:`, error);
      return [];
    }
  }, []);

  // Fetch popular books data
  const fetchPopularBooksData = useCallback(async (): Promise<BookDetails[]> => {
    try {
      // Query the borrows collection to count checkouts by book
      const borrowsQuery = query(
        collection(db, "borrows"),
        orderBy("borrowedAt", "desc")
      );
      
      const querySnapshot = await getDocs(borrowsQuery);
      const bookCheckoutCounts: { [key: string]: number } = {};
      
      // Count checkouts for each book
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const bookId = data.bookId;
        
        if (!bookCheckoutCounts[bookId]) {
          bookCheckoutCounts[bookId] = 0;
        }
        
        bookCheckoutCounts[bookId]++;
      });
      
      // Convert to array and sort by checkout count
      const bookCountsArray = Object.entries(bookCheckoutCounts).map(([bookId, count]) => ({
        bookId,
        count
      }));
      
      bookCountsArray.sort((a, b) => b.count - a.count);
      
      // Get the top 10 books
      const top10Books = bookCountsArray.slice(0, 10);
      
      // Fetch book details for each book
      const booksWithDetails = await Promise.all(top10Books.map(async (book) => {
        const bookDocRef = doc(db, "books", book.bookId);
        const bookDoc = await getDoc(bookDocRef);
        
        if (bookDoc.exists()) {
          const bookData = bookDoc.data();
          return {
            id: book.bookId,
            title: bookData.title || 'Unknown Title',
            author: bookData.author || 'Unknown Author',
            checkouts: book.count
          };
        } else {
          return {
            id: book.bookId,
            title: 'Unknown Book',
            author: 'Unknown Author',
            checkouts: book.count
          };
        }
      }));
      
      return booksWithDetails;
    } catch (error) {
      console.error("Error fetching popular books data:", error);
      return [];
    }
  }, []);

  // Fetch category distribution data
  const fetchCategoryDistributionData = useCallback(async (): Promise<CategoryData[]> => {
    try {
      // Query all books
      const booksQuery = query(collection(db, "books"));
      const querySnapshot = await getDocs(booksQuery);
      
      const categoryCounts: { [key: string]: number } = {};
      
      // Count books in each category
      querySnapshot.forEach((doc) => {
        const bookData = doc.data();
        const categories = bookData.categories || [];
        
        categories.forEach((category: string) => {
          if (!categoryCounts[category]) {
            categoryCounts[category] = 0;
          }
          
          categoryCounts[category]++;
        });
      });
      
      // Convert to array and sort by count
      const categoryArray = Object.entries(categoryCounts).map(([name, value]) => ({
        name,
        value
      }));
      
      categoryArray.sort((a, b) => b.value - a.value);
      
      // Get the top 8 categories, combine the rest as "Other"
      const top8Categories = categoryArray.slice(0, 8);
      
      if (categoryArray.length > 8) {
        const otherCategories = categoryArray.slice(8);
        const otherCount = otherCategories.reduce((sum, cat) => sum + cat.value, 0);
        
        top8Categories.push({
          name: 'Other',
          value: otherCount
        });
      }
      
      return top8Categories;
    } catch (error) {
      console.error("Error fetching category distribution data:", error);
      return [];
    }
  }, []);

  // Fetch patron activity data (checkouts per patron)
  const fetchPatronActivityData = useCallback(async (): Promise<PatronData[]> => {
    try {
      // Query the borrows collection
      const borrowsQuery = query(
        collection(db, "borrows"),
        orderBy("borrowedAt", "desc")
      );
      
      const querySnapshot = await getDocs(borrowsQuery);
      const patronCheckoutCounts: { [key: string]: number } = {};
      
      // Count checkouts for each patron
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        const userId = data.userId;
        
        if (!patronCheckoutCounts[userId]) {
          patronCheckoutCounts[userId] = 0;
        }
        
        patronCheckoutCounts[userId]++;
      });
      
      // Get patron details for the top 5 most active patrons
      const topPatrons = Object.entries(patronCheckoutCounts)
        .map(([userId, count]) => ({ userId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      const patronsWithDetails = await Promise.all(topPatrons.map(async (patron) => {
        const userDocRef = doc(db, "users_customer", patron.userId);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data();
          return {
            id: patron.userId,
            name: `${userData.firstName || ''} ${userData.lastName || ''}`.trim() || 'Unknown Patron',
            checkouts: patron.count
          };
        } else {
          return {
            id: patron.userId,
            name: 'Unknown Patron',
            checkouts: patron.count
          };
        }
      }));
      
      return patronsWithDetails;
    } catch (error) {
      console.error("Error fetching patron activity data:", error);
      return [];
    }
  }, []);

  // Fetch library performance metrics
  const fetchLibraryPerformanceData = useCallback(async (): Promise<PerformanceData[]> => {
    try {
      // We'll create a radar chart with different metrics
      // Each metric is calculated differently
      
      // 1. Calculate checkout efficiency (checkouts per day)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);
      
      const checkoutsQuery = query(
        collection(db, "borrows"),
        where("borrowedAt", ">=", thirtyDaysAgoTimestamp)
      );
      
      const checkoutsSnapshot = await getDocs(checkoutsQuery);
      const checkoutsCount = checkoutsSnapshot.docs.length;
      const checkoutsPerDay = checkoutsCount / 30;
      
      // 2. Calculate return rate (returns / checkouts)
      const returnsQuery = query(
        collection(db, "borrows"),
        where("status", "==", "returned"),
        where("returnDate", ">=", thirtyDaysAgoTimestamp)
      );
      
      const returnsSnapshot = await getDocs(returnsQuery);
      const returnsCount = returnsSnapshot.docs.length;
      const returnRate = checkoutsCount > 0 ? (returnsCount / checkoutsCount) * 100 : 0;
      
      // 3. Calculate on-time returns (non-overdue returns / total returns)
      let onTimeReturnsCount = 0;
      
      returnsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const returnDate = data.returnDate?.toDate ? data.returnDate.toDate() : new Date(data.returnDate);
        const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
        
        if (returnDate <= dueDate) {
          onTimeReturnsCount++;
        }
      });
      
      const onTimeReturnRate = returnsCount > 0 ? (onTimeReturnsCount / returnsCount) * 100 : 0;
      
      // 4. Calculate collection utilization (unique books borrowed / total books)
      const booksSnapshot = await getCountFromServer(collection(db, "books"));
      const totalBooksCount = booksSnapshot.data().count;
      
      const uniqueBorrowedBooks = new Set<string>();
      checkoutsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        uniqueBorrowedBooks.add(data.bookId);
      });
      
      const collectionUtilization = totalBooksCount > 0 ? (uniqueBorrowedBooks.size / totalBooksCount) * 100 : 0;
      
      // 5. Calculate patron engagement (active patrons / total patrons)
      const patronsSnapshot = await getCountFromServer(collection(db, "users_customer"));
      const totalPatronsCount = patronsSnapshot.data().count;
      
      const activePatrons = new Set<string>();
      checkoutsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        activePatrons.add(data.userId);
      });
      
      const patronEngagement = totalPatronsCount > 0 ? (activePatrons.size / totalPatronsCount) * 100 : 0;
      
      // 6. Calculate reservation fulfillment (picked up reservations / total reservations)
      const reservationsQuery = query(
        collection(db, "reserves"),
        where("reservedAt", ">=", thirtyDaysAgoTimestamp)
      );
      
      const reservationsSnapshot = await getDocs(reservationsQuery);
      const totalReservations = reservationsSnapshot.docs.length;
      
      const fulfilledReservations = reservationsSnapshot.docs.filter(doc => {
        const data = doc.data();
        return data.status === "picked-up";
      }).length;
      
      const reservationFulfillment = totalReservations > 0 ? (fulfilledReservations / totalReservations) * 100 : 0;
      
      // Return the combined data
      return [
        { subject: 'Checkouts Per Day', A: Math.min(checkoutsPerDay * 10, 100), fullMark: 100 },
        { subject: 'Return Rate', A: returnRate, fullMark: 100 },
        { subject: 'On-Time Returns', A: onTimeReturnRate, fullMark: 100 },
        { subject: 'Collection Usage', A: collectionUtilization, fullMark: 100 },
        { subject: 'Patron Engagement', A: patronEngagement, fullMark: 100 },
        { subject: 'Reservation Fulfillment', A: reservationFulfillment, fullMark: 100 }
      ];
    } catch (error) {
      console.error("Error fetching library performance data:", error);
      return [];
    }
  }, []);

  // Fetch summary stats
  const fetchSummaryStats = useCallback(async (): Promise<void> => {
    try {
      // Total books (only count books with copies > 0)
      const booksQuery = query(
        collection(db, "books"),
        where("copies", ">", 0)
      );
      const booksSnapshot = await getDocs(booksQuery);
      const booksCount = booksSnapshot.docs.length;
      setTotalBooks(booksCount);
      
      // Total patrons
      const patronsSnapshot = await getCountFromServer(collection(db, "users_customer"));
      const patronsCount = patronsSnapshot.data().count;
      setTotalPatrons(patronsCount);
      
      // Payments instead of Active loans
      const paymentsQuery = query(
        collection(db, "payments"),
        where("status", "==", "completed")
      );
      const paymentsSnapshot = await getCountFromServer(paymentsQuery);
      const paymentsCount = paymentsSnapshot.data().count;
      setActiveLoans(paymentsCount);
      
      // Overdue items
      const now = new Date();
      const nowTimestamp = Timestamp.fromDate(now);
      
      const overdueQuery = query(
        collection(db, "borrows"),
        where("status", "in", ["borrowed", "renewed"]),
        where("dueDate", "<", nowTimestamp)
      );
      
      const overdueSnapshot = await getCountFromServer(overdueQuery);
      const overdueCount = overdueSnapshot.data().count;
      setOverdueItems(overdueCount);
    } catch (error) {
      console.error("Error fetching summary stats:", error);
    }
  }, []);
  
  // Fetch all data when time period changes
  const fetchAllData = useCallback(async (): Promise<void> => {
    setIsChartLoading(true);
    
    try {
      const [
        borrowedDataResult, 
        returnedDataResult, 
        reservedDataResult, 
        patronsDataResult,
        overdueDataResult,
        popularBooksDataResult,
        categoryDistributionDataResult,
        patronActivityDataResult,
        libraryPerformanceDataResult
      ] = await Promise.all([
        fetchCirculationData(timePeriod, 'borrowed'),
        fetchCirculationData(timePeriod, 'returned'),
        fetchCirculationData(timePeriod, 'reserved'),
        fetchCirculationData(timePeriod, 'patrons'),
        fetchCirculationData(timePeriod, 'overdue'),
        fetchPopularBooksData(),
        fetchCategoryDistributionData(),
        fetchPatronActivityData(),
        fetchLibraryPerformanceData()
      ]);
      
      setBorrowedData(borrowedDataResult);
      setReturnedData(returnedDataResult);
      setReservedData(reservedDataResult);
      setPatronsData(patronsDataResult);
      setOverdueData(overdueDataResult);
      setPopularBooksData(popularBooksDataResult);
      setCategoryDistributionData(categoryDistributionDataResult);
      setPatronActivityData(patronActivityDataResult);
      setLibraryPerformanceData(libraryPerformanceDataResult);
      
      // Also fetch summary stats
      await fetchSummaryStats();
    } catch (error) {
      console.error("Error fetching all data:", error);
    } finally {
      setIsChartLoading(false);
    }
  }, [
    timePeriod, 
    fetchCirculationData, 
    fetchPopularBooksData, 
    fetchCategoryDistributionData,
    fetchPatronActivityData,
    fetchLibraryPerformanceData,
    fetchSummaryStats
  ]);

  // Export reports as PDF
  const exportAsPDF = useCallback(async (): Promise<void> => {
    if (!reportsContentRef.current) return;
    
    setExportLoading(true);
    
    try {
      const content = reportsContentRef.current;
      const canvas = await html2canvas(content, {
        useCORS: true,
        logging: false,
      });
      
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      
      const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
      
      const imgX = (pdfWidth - imgWidth * ratio) / 2;
      const imgY = 30;
      
      // Add title
      pdf.setFontSize(18);
      pdf.text('Library Reports', pdfWidth / 2, 15, { align: 'center' });
      
      // Add date
      pdf.setFontSize(12);
      pdf.text(`Generated on ${new Date().toLocaleDateString()}`, pdfWidth / 2, 22, { align: 'center' });
      
      // Add content
      pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
      
      // Save PDF
      pdf.save(`library-reports-${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      alert("Failed to export PDF. Please try again.");
    } finally {
      setExportLoading(false);
      setShowExportOptions(false);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchAllData();
    setIsLoading(false);
  }, [fetchAllData]);

  // Fetch new data when time period changes
  useEffect(() => {
    if (!isLoading) {
      fetchAllData();
    }
  }, [timePeriod, fetchAllData, isLoading]);

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading reports...</p>
      </div>
    );
  }

  // Define the pie chart colors
  const CATEGORY_COLORS = [
    '#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', 
    '#a4de6c', '#d0ed57', '#ffc658', '#ff8042', '#ff6b6b'
  ];

  return (
    <main className={styles.mainContent}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.pageTitle}>
            <FiPieChart className={styles.pageTitleIcon} /> Library Reports
          </h1>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.timeFilterContainer}>
            <label htmlFor="timeFilter" className={styles.filterLabel}>
              <FiCalendar className={styles.filterIcon} /> Time Period:
            </label>
            <select 
              id="timeFilter"
              className={styles.timeFilter}
              value={timePeriod}
              onChange={(e) => setTimePeriod(e.target.value)}
            >
              <option value="daily">Today</option>
              <option value="weekly">Last 7 Days</option>
              <option value="monthly">Last 30 Days</option>
              <option value="yearly">Last 12 Months</option>
            </select>
          </div>
          
          <div className={styles.exportContainer}>
            <button 
              className={styles.exportButton}
              onClick={() => setShowExportOptions(!showExportOptions)}
              disabled={exportLoading}
            >
              <FiDownload className={styles.exportIcon} />
              {exportLoading ? 'Exporting...' : 'Export'}
            </button>
            
            {showExportOptions && (
              <div className={styles.exportOptions}>
                <button 
                  className={styles.exportOptionButton}
                  onClick={exportAsPDF}
                  disabled={exportLoading}
                >
                  Export as PDF
                </button>
              </div>
            )}
          </div>
          
          <button 
            className={styles.refreshButton}
            onClick={fetchAllData}
            disabled={isChartLoading}
          >
            <FiRefreshCw className={`${styles.refreshIcon} ${isChartLoading ? styles.spinning : ''}`} />
            Refresh
          </button>
        </div>
      </header>

      {/* Reports Content */}
      <div className={styles.reportsContent} ref={reportsContentRef}>
        {isChartLoading ? (
          <div className={styles.loadingContainer}>
            <div className={styles.loadingSpinner}></div>
            <p>Loading report data...</p>
          </div>
        ) : (
          <>
                        {/* Summary Stats */}
                        <section className={styles.summarySection}>
              <div className={styles.summaryGrid}>
                <div className={styles.summaryCard}>
                  <div className={styles.summaryIconContainer}>
                    <FiBook className={styles.summaryIcon} />
                  </div>
                  <div className={styles.summaryContent}>
                    <h3 className={styles.summaryValue}>{totalBooks.toLocaleString()}</h3>
                    <p className={styles.summaryLabel}>Total Books</p>
                  </div>
                </div>
                
                <div className={styles.summaryCard}>
                  <div className={styles.summaryIconContainer}>
                    <FiUsers className={styles.summaryIcon} />
                  </div>
                  <div className={styles.summaryContent}>
                    <h3 className={styles.summaryValue}>{totalPatrons.toLocaleString()}</h3>
                    <p className={styles.summaryLabel}>Total Patrons</p>
                  </div>
                </div>
                
                <div className={styles.summaryCard}>
                  <div className={styles.summaryIconContainer}>
                    <FiBookOpen className={styles.summaryIcon} />
                  </div>
                  <div className={styles.summaryContent}>
                    <h3 className={styles.summaryValue}>{activeLoans.toLocaleString()}</h3>
                    <p className={styles.summaryLabel}>Payments</p>
                  </div>
                </div>
                
                <div className={styles.summaryCard}>
                  <div className={styles.summaryIconContainer}>
                    <FiClock className={styles.summaryIcon} style={{ color: COLORS.danger }} />
                  </div>
                  <div className={styles.summaryContent}>
                    <h3 className={styles.summaryValue}>{overdueItems.toLocaleString()}</h3>
                    <p className={styles.summaryLabel}>Overdue Items</p>
                  </div>
                </div>
              </div>
            </section>

            {/* First Row - Circulation Activity */}
            <section className={styles.reportsSection}>
              <h2 className={styles.sectionTitle}>
                <FiTrendingUp className={styles.sectionTitleIcon} /> Circulation Activity
              </h2>
              <div className={styles.chartsGrid}>
                {/* Borrowed Books Chart */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>
                      <span className={styles.chartDot} style={{ backgroundColor: COLORS.borrowed }}></span>
                      Borrowed Books
                    </h3>
                  </div>
                  <div className={styles.chartContainer}>
                    {borrowedData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart
                          data={borrowedData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number) => [`${value} items`, 'Borrowed']}
                            labelFormatter={(label: string) => `Time: ${label}`}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            name="Borrowed" 
                            stroke={COLORS.borrowed} 
                            fill={`${COLORS.borrowed}33`} 
                            activeDot={{ r: 6 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Returned Books Chart */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>
                      <span className={styles.chartDot} style={{ backgroundColor: COLORS.returned }}></span>
                      Returned Books
                    </h3>
                  </div>
                  <div className={styles.chartContainer}>
                    {returnedData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart
                          data={returnedData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number) => [`${value} items`, 'Returned']}
                            labelFormatter={(label: string) => `Time: ${label}`}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            name="Returned" 
                            stroke={COLORS.returned} 
                            fill={`${COLORS.returned}33`} 
                            activeDot={{ r: 6 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Second Row - Reservations and Patrons */}
            <section className={styles.reportsSection}>
              <div className={styles.chartsGrid}>
                {/* Reserved Books Chart */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>
                      <span className={styles.chartDot} style={{ backgroundColor: COLORS.reserved }}></span>
                      Book Reservations
                    </h3>
                  </div>
                  <div className={styles.chartContainer}>
                    {reservedData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart
                          data={reservedData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number) => [`${value} items`, 'Reserved']}
                            labelFormatter={(label: string) => `Time: ${label}`}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            name="Reserved" 
                            stroke={COLORS.reserved} 
                            fill={`${COLORS.reserved}33`} 
                            activeDot={{ r: 6 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* New Patrons Chart */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>
                      <span className={styles.chartDot} style={{ backgroundColor: COLORS.patrons }}></span>
                      New Patrons
                    </h3>
                  </div>
                  <div className={styles.chartContainer}>
                    {patronsData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart
                          data={patronsData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number) => [`${value} patrons`, 'New Patrons']}
                            labelFormatter={(label: string) => `Time: ${label}`}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            name="New Patrons" 
                            stroke={COLORS.patrons} 
                            fill={`${COLORS.patrons}33`} 
                            activeDot={{ r: 6 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Payment Section - Full Width */}
            <section className={styles.reportsSection}>
              <h2 className={styles.sectionTitle}>
                <FiDollarSign className={styles.sectionTitleIcon} /> Payment Activity
              </h2>
              <div className={styles.chartsGrid}>
                {/* Payments Chart - Takes full width */}
                <div className={styles.chartCard} style={{ gridColumn: '1 / -1' }}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>
                      <span className={styles.chartDot} style={{ backgroundColor: COLORS.success }}></span>
                      Payment Transactions
                    </h3>
                  </div>
                  <div className={styles.chartContainer}>
                    {borrowedData.length > 0 ? ( // Reusing borrowedData for now - replace with paymentsData when available
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart
                          data={borrowedData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number) => [`${value} transactions`, 'Payments']}
                            labelFormatter={(label: string) => `Time: ${label}`}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            name="Payments" 
                            stroke={COLORS.success} 
                            fill={`${COLORS.success}33`} 
                            activeDot={{ r: 6 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No payment data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Third Row - Overdue Items only (full width) */}
            <section className={styles.reportsSection}>
              <h2 className={styles.sectionTitle}>
                <FiBarChart2 className={styles.sectionTitleIcon} /> Books & Patrons Analysis
              </h2>
              <div className={styles.chartsGrid}>
                {/* Overdue Items Chart - Now takes full width */}
                <div className={styles.chartCard} style={{ gridColumn: '1 / -1' }}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>
                      <span className={styles.chartDot} style={{ backgroundColor: COLORS.overdue }}></span>
                      Overdue Items
                    </h3>
                  </div>
                  <div className={styles.chartContainer}>
                    {overdueData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={250}>
                        <AreaChart
                          data={overdueData}
                          margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <Tooltip 
                            formatter={(value: number) => [`${value} items`, 'Overdue']}
                            labelFormatter={(label: string) => `Time: ${label}`}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="value" 
                            name="Overdue" 
                            stroke={COLORS.overdue} 
                            fill={`${COLORS.overdue}33`} 
                            activeDot={{ r: 6 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No data available for the selected period.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Fourth Row - Category Distribution and Patron Activity */}
            <section className={styles.reportsSection}>
              <div className={styles.chartsGrid}>
                {/* Category Distribution Chart - Enhanced version */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Book Categories Distribution</h3>
                  </div>
                  <div className={styles.chartContainer}>
                    {categoryDistributionData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={320}>
                        <PieChart>
                          <Pie
                            data={categoryDistributionData}
                            cx="50%"
                            cy="50%"
                            labelLine={true}
                            label={({ name, percent }: { name: string, percent: number }) => 
                              `${name} (${(percent * 100).toFixed(0)}%)`
                            }
                            outerRadius={120}
                            fill="#8884d8"
                            dataKey="value"
                            paddingAngle={2}
                          >
                            {categoryDistributionData.map((entry, index) => (
                              <Cell 
                                key={`cell-${index}`} 
                                fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} 
                                stroke="#fff"
                                strokeWidth={2}
                              />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value: number, name: string, props: any) => [
                              `${value} books`, 
                              props.payload.name
                            ]}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No data available for category distribution.</p>
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Top Patrons Chart */}
                <div className={styles.chartCard}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Most Active Patrons</h3>
                  </div>
                  <div className={styles.chartContainer}>
                    {patronActivityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart
                          data={patronActivityData}
                          layout="vertical"
                          margin={{ top: 5, right: 30, left: 120, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                          <XAxis 
                            type="number" 
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis 
                            type="category" 
                            dataKey="name" 
                            tick={{ fontSize: 12 }}
                            width={120}
                            axisLine={false}
                            tickLine={false}
                          />
                          <Tooltip 
                            formatter={(value: number) => [`${value} checkouts`]}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                          <Bar 
                            dataKey="checkouts" 
                            fill={COLORS.patrons}
                            name="Checkouts"
                            radius={[0, 4, 4, 0]}
                            barSize={20}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No data available for patron activity.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Fifth Row - Library Performance Radar Chart */}
            <section className={styles.reportsSection}>
              <h2 className={styles.sectionTitle}>
                <FiPieChart className={styles.sectionTitleIcon} /> Library Performance Metrics
              </h2>
              <div className={styles.chartsGrid}>
                <div className={styles.chartCard} style={{ gridColumn: 'span 2' }}>
                  <div className={styles.chartHeader}>
                    <h3 className={styles.chartTitle}>Performance Analysis</h3>
                  </div>
                  <div className={styles.chartContainer} style={{ height: '450px' }}> {/* Increased height */}
                    {libraryPerformanceData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={400}>
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={libraryPerformanceData}> {/* Reduced outerRadius */}
                          <PolarGrid />
                          <PolarAngleAxis dataKey="subject" />
                          <PolarRadiusAxis angle={30} domain={[0, 100]} />
                          <Radar 
                              name="Performance" 
                              dataKey="A" 
                              stroke={COLORS.primary} 
                              fill={COLORS.primary} 
                              fillOpacity={0.6} 
                          />
                          <Tooltip 
                            formatter={(value: number) => [`${value.toFixed(1)}%`]}
                            contentStyle={{ backgroundColor: '#fff', borderRadius: '4px', border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}
                          />
                          <Legend 
                            verticalAlign="bottom" 
                            height={36} 
                            wrapperStyle={{ 
                              bottom: 0, 
                              left: 0, 
                              right: 0, 
                              paddingTop: '20px' 
                            }} 
                          />
                        </RadarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className={styles.noChartData}>
                        <p>No data available for library performance metrics.</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}


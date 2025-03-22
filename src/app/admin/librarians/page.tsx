"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import styles from './librarians.module.css';
import { auth, db } from '../../../firebaseConfig';
import { 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs,
  query,
  orderBy,
  where
} from 'firebase/firestore';
import Sidebar from '@/app/admin/components/sidebar';
import Head from 'next/head';
import { 
  FiUser, 
  FiEdit2, 
  FiTrash2, 
  FiMail, 
  FiPhone, 
  FiHome, 
  FiLock, 
  FiCheck, 
  FiAlertCircle,
  FiShield
} from 'react-icons/fi';

// Define Librarian interface
interface Librarian {
  uid: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  department?: string;
  employmentType: string;
  status: string;
  startDate: string;
  createdAt: any;
  lastLogin: any;
  lastPasswordChange?: any;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}


export default function LibrariansPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [librarians, setLibrarians] = useState<Librarian[]>([]);
  const [expandedLibrarian, setExpandedLibrarian] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDepartment, setFilterDepartment] = useState<string>('all');
  const [filterPasswordChange, setFilterPasswordChange] = useState<string>('all');
  const [sortField, setSortField] = useState<string>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [activeMenuItem, setActiveMenuItem] = useState('librarians');

  // Check authentication when component mounts
  useEffect(() => {
    let isMounted = true;
    
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!isMounted) return;
      
      if (user) {
        try {
          // Check if user document exists in users_admin collection
          const userDocRef = doc(db, "users_admin", user.uid);
          const userSnapshot = await getDoc(userDocRef);
          
          if (userSnapshot.exists()) {
            // User is authenticated and admin document exists
            setIsAuthenticated(true);
            await fetchLibrarians(); // Wait for data to load
            setIsLoading(false); // Only set loading to false after data is loaded
          } else {
            // User exists in Firebase Auth but not in users_admin collection
            console.log("Admin document not found - signing out");
            setIsAuthenticated(false);
            window.location.href = '/auth/login';
            // Don't set loading to false here as we're redirecting
          }
        } catch (error) {
          console.error("Error checking admin status:", error);
          setIsAuthenticated(false);
          setIsLoading(false);
          window.location.href = '/auth/login';
        }
      } else {
        // No user is signed in
        setIsAuthenticated(false);
        // Don't set loading to false here, wait for redirect
        window.location.href = '/auth/login';
      }
    });
    
    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);
  

  // Fetch librarians from Firestore
  const fetchLibrarians = async () => {
    try {
      const librariansQuery = query(
        collection(db, "users_librarian"),
        orderBy("lastName")
      );
      
      const querySnapshot = await getDocs(librariansQuery);
      const librariansData: Librarian[] = [];
      
      querySnapshot.forEach(doc => {
        const data = doc.data() as Librarian;
        librariansData.push({
          ...data,
          uid: doc.id
        });
      });
      
      setLibrarians(librariansData);
      return librariansData; // Return the data for chaining
    } catch (error) {
      console.error("Error fetching librarians:", error);
      return []; // Return empty array on error
    }
  };
  

  const handleLogout = async () => {
    try {
      await auth.signOut();
      window.location.href = '/auth/login';
    } catch (error) {
      console.error("Error signing out:", error);
      window.location.href = '/auth/login';
    }
  };

  // Toggle librarian details
  const toggleLibrarianDetails = (uid: string) => {
    if (expandedLibrarian === uid) {
      setExpandedLibrarian(null);
    } else {
      setExpandedLibrarian(uid);
    }
  };

  // Handle sorting
  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if clicking the same field
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new field and default to ascending
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sorted and filtered librarians
  const getFilteredAndSortedLibrarians = () => {
    // First filter by search term
    let filtered = librarians.filter(librarian => {
      const searchString = searchTerm.toLowerCase();
      return (
        librarian.firstName.toLowerCase().includes(searchString) ||
        librarian.lastName.toLowerCase().includes(searchString) ||
        librarian.employeeId.toLowerCase().includes(searchString) ||
        librarian.email.toLowerCase().includes(searchString) ||
        (librarian.department && librarian.department.toLowerCase().includes(searchString))
      );
    });

    // Then filter by status if not 'all'
    if (filterStatus !== 'all') {
      filtered = filtered.filter(librarian => librarian.status === filterStatus);
    }

    // Then filter by department if not 'all'
    if (filterDepartment !== 'all') {
      filtered = filtered.filter(librarian => librarian.department === filterDepartment);
    }
    
    // Filter by password change status
    if (filterPasswordChange !== 'all') {
      const now = new Date();
      
      if (filterPasswordChange === 'never') {
        filtered = filtered.filter(librarian => !librarian.lastPasswordChange);
      } else if (filterPasswordChange === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        filtered = filtered.filter(librarian => {
          if (!librarian.lastPasswordChange) return false;
          
          const changeDate = librarian.lastPasswordChange.toDate ? 
            librarian.lastPasswordChange.toDate() : 
            new Date(librarian.lastPasswordChange);
            
          return changeDate >= today;
        });
      } else if (filterPasswordChange === 'week') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        filtered = filtered.filter(librarian => {
          if (!librarian.lastPasswordChange) return false;
          
          const changeDate = librarian.lastPasswordChange.toDate ? 
            librarian.lastPasswordChange.toDate() : 
            new Date(librarian.lastPasswordChange);
            
          return changeDate >= oneWeekAgo;
        });
      } else if (filterPasswordChange === 'month') {
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        filtered = filtered.filter(librarian => {
          if (!librarian.lastPasswordChange) return false;
          
          const changeDate = librarian.lastPasswordChange.toDate ? 
            librarian.lastPasswordChange.toDate() : 
            new Date(librarian.lastPasswordChange);
            
          return changeDate >= oneMonthAgo;
        });
      }
    }

    // Then sort
    return filtered.sort((a, b) => {
      let valueA = a[sortField as keyof Librarian];
      let valueB = b[sortField as keyof Librarian];
      
      // Handle string comparison
      if (typeof valueA === 'string' && typeof valueB === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
      
      // Handle dates
      if (sortField === 'createdAt' || sortField === 'lastLogin' || sortField === 'lastPasswordChange') {
        valueA = valueA ? new Date(valueA.toDate ? valueA.toDate() : valueA).getTime() : 0;
        valueB = valueB ? new Date(valueB.toDate ? valueB.toDate() : valueB).getTime() : 0;
      }
      
      if (valueA < valueB) return sortDirection === 'asc' ? -1 : 1;
      if (valueA > valueB) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Format date for display
  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };
  
  // Format date with time
  const formatDateTime = (timestamp: any) => {
    if (!timestamp) return "Never";
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error("Error formatting date:", error);
      return "Never";
    }
  };

  // Format password last updated relative time
  const formatPasswordUpdateTime = (timestamp: any): string => {
    if (!timestamp) return 'Never updated';
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      
      if (date >= today) {
        // Today
        if (diffMins < 1) {
          return 'Just now';
        } else if (diffMins < 60) {
          return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
        } else {
          return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
        }
      } else if (date >= yesterday) {
        // Yesterday
        return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays < 7) {
        // Within a week
        return `${diffDays} days ago`;
      } else {
        // More than a week ago
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'short', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        });
      }
    } catch (error) {
      console.error("Error formatting password update time:", error);
      return "Never updated";
    }
  };

  // Determine if password was recently updated (within last 24 hours)
  const isPasswordRecentlyUpdated = (timestamp: any): boolean => {
    if (!timestamp) return false;
    
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      const now = new Date();
      const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
      
      return diffHours < 24;
    } catch (error) {
      return false;
    }
  };

  // Get unique departments for filter
  const getDepartments = () => {
    const departments = new Set<string>();
    librarians.forEach(librarian => {
      if (librarian.department) {
        departments.add(librarian.department);
      }
    });
    return Array.from(departments);
  };

  // Format employment type for display
  const formatEmploymentType = (type: string) => {
    return type.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading librarians...</p>
      </div>
    );
  }

  // If not authenticated, don't render anything (redirect happens in useEffect)
  if (!isAuthenticated) {
    return null;
  }

  const filteredLibrarians = getFilteredAndSortedLibrarians();

  return (
    <>
      <Head>
        <title>Manage Librarians | Library Management System</title>
        <meta name="description" content="View and manage all librarians in the library management system. See details, credentials, and account status." />
        <meta name="keywords" content="librarians, library staff, staff management, library administration" />
      </Head>
      
      <div className={styles.adminLayout}>
        {/* Use the Sidebar component */}
        <Sidebar activeMenuItem={activeMenuItem} handleLogout={handleLogout} />

        {/* Main Content */}
        <main className={styles.mainContent}>
          {/* Dashboard Content */}
          <div className={styles.dashboardContent}>
            <div className={styles.pageContainer}>
              <div className={styles.pageHeader}>
                <div className={styles.pageActions}>
                  <Link href="/admin/librarians/add" className={styles.addButton}>
                    <span className={styles.addIcon}>+</span>
                    Add Librarian
                  </Link>
                </div>
                
                <div className={styles.searchContainer}>
                  <input 
                    type="text" 
                    placeholder="Search librarians..." 
                    className={styles.searchInput} 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    aria-label="Search librarians"
                  />
                </div>
                
                {successMessage && (
                  <div className={styles.successMessage}>
                    <FiCheck /> {successMessage}
                  </div>
                )}
                
                {errorMessage && (
                  <div className={styles.errorMessage}>
                    <FiAlertCircle /> {errorMessage}
                  </div>
                )}
                
                <div className={styles.filters}>
                  <div className={styles.filterGroup}>
                    <label htmlFor="statusFilter">Status:</label>
                    <select 
                      id="statusFilter" 
                      className={styles.filterSelect}
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                  
                  <div className={styles.filterGroup}>
                    <label htmlFor="departmentFilter">Department:</label>
                    <select 
                      id="departmentFilter" 
                      className={styles.filterSelect}
                      value={filterDepartment}
                      onChange={(e) => setFilterDepartment(e.target.value)}
                    >
                      <option value="all">All Departments</option>
                      {getDepartments().map(dept => (
                        <option key={dept} value={dept}>
                          {dept.charAt(0).toUpperCase() + dept.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className={styles.filterGroup}>
                    <label htmlFor="passwordChangeFilter">Password Changed:</label>
                    <select 
                      id="passwordChangeFilter" 
                      className={styles.filterSelect}
                      value={filterPasswordChange}
                      onChange={(e) => setFilterPasswordChange(e.target.value)}
                    >
                      <option value="all">All</option>
                      <option value="never">Never Changed</option>
                      <option value="today">Changed Today</option>
                      <option value="week">Changed This Week</option>
                      <option value="month">Changed This Month</option>
                    </select>
                  </div>
                  
                  <div className={styles.resultsCount}>
                    {filteredLibrarians.length} {filteredLibrarians.length === 1 ? 'librarian' : 'librarians'} found
                  </div>
                </div>
              </div>
              
              <div className={styles.statsBar}>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{librarians.length}</span>
                  <span className={styles.statLabel}>Total Librarians</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{librarians.filter(l => l.status === 'active').length}</span>
                  <span className={styles.statLabel}>Active</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>
                    {librarians.filter(l => l.lastPasswordChange && isPasswordRecentlyUpdated(l.lastPasswordChange)).length}
                  </span>
                  <span className={styles.statLabel}>Recent Password Updates</span>
                </div>
                <div className={styles.statItem}>
                  <span className={styles.statValue}>{filteredLibrarians.length}</span>
                  <span className={styles.statLabel}>Showing</span>
                </div>
              </div>
              
              <div className={styles.librariansContainer}>
                <table className={styles.librariansTable}>
                  <thead>
                    <tr>
                      <th 
                        className={`${styles.tableHeader} ${sortField === 'employeeId' ? styles.sortActive : ''}`}
                        onClick={() => handleSort('employeeId')}
                      >
                        ID {sortField === 'employeeId' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className={`${styles.tableHeader} ${sortField === 'lastName' ? styles.sortActive : ''}`}
                        onClick={() => handleSort('lastName')}
                      >
                        Name {sortField === 'lastName' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className={`${styles.tableHeader} ${sortField === 'email' ? styles.sortActive : ''}`}
                        onClick={() => handleSort('email')}
                      >
                        Email {sortField === 'email' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className={`${styles.tableHeader} ${sortField === 'department' ? styles.sortActive : ''}`}
                        onClick={() => handleSort('department')}
                      >
                        Department {sortField === 'department' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className={`${styles.tableHeader} ${sortField === 'lastPasswordChange' ? styles.sortActive : ''}`}
                        onClick={() => handleSort('lastPasswordChange')}
                      >
                        Password Updated {sortField === 'lastPasswordChange' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th 
                        className={`${styles.tableHeader} ${sortField === 'status' ? styles.sortActive : ''}`}
                        onClick={() => handleSort('status')}
                      >
                        Status {sortField === 'status' && (sortDirection === 'asc' ? '↑' : '↓')}
                      </th>
                      <th className={styles.tableHeader}>Actions</th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {filteredLibrarians.length > 0 ? (
                      filteredLibrarians.map(librarian => (
                        <React.Fragment key={librarian.uid}>
                          <tr className={styles.tableRow}>
                            <td className={styles.tableCell}>{librarian.employeeId}</td>
                            <td className={styles.tableCell}>{`${librarian.firstName} ${librarian.lastName}`}</td>
                            <td className={styles.tableCell}>{librarian.email}</td>
                            <td className={styles.tableCell}>{librarian.department || 'N/A'}</td>
                            <td className={styles.tableCell}>
                              <div className={`${styles.passwordUpdateInfo} ${isPasswordRecentlyUpdated(librarian.lastPasswordChange) ? styles.recentUpdate : ''}`}>
                                {formatPasswordUpdateTime(librarian.lastPasswordChange)}
                                {isPasswordRecentlyUpdated(librarian.lastPasswordChange) && (
                                  <span className={styles.recentBadge}>Recent</span>
                                )}
                              </div>
                            </td>
                            <td className={styles.tableCell}>
                              <span className={`${styles.statusBadge} ${styles[librarian.status]}`}>
                                {librarian.status.charAt(0).toUpperCase() + librarian.status.slice(1)}
                              </span>
                            </td>
                            <td className={styles.tableCell}>
                              <div className={styles.actionButtons}>
                                <button 
                                  className={expandedLibrarian === librarian.uid ? styles.hideButton : styles.viewButton}
                                  onClick={() => toggleLibrarianDetails(librarian.uid)}
                                >
                                  {expandedLibrarian === librarian.uid ? 'Hide Details' : 'View Details'}
                                </button>
                              </div>
                            </td>
                          </tr>
                          
                          {/* Expanded Details */}
                          {expandedLibrarian === librarian.uid && (
                            <tr>
                              <td colSpan={7} className={styles.expandedCell}>
                                <div className={styles.expandedDetails}>
                                  <div className={styles.detailsGrid}>
                                    <div className={styles.detailGroup}>
                                      <h3>Personal Information</h3>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Full Name:</span>
                                        <span className={styles.detailValue}>{`${librarian.firstName} ${librarian.lastName}`}</span>
                                      </div>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Email:</span>
                                        <span className={styles.detailValue}>{librarian.email}</span>
                                      </div>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Phone:</span>
                                        <span className={styles.detailValue}>{librarian.phone || 'N/A'}</span>
                                      </div>
                                      {librarian.address && (
                                        <div className={styles.detailRow}>
                                          <span className={styles.detailLabel}>Address:</span>
                                          <span className={styles.detailValue}>
                                            {`${librarian.address}, ${librarian.city || ''} ${librarian.state || ''} ${librarian.zip || ''}`}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                    
                                    <div className={styles.detailGroup}>
                                      <h3>Employment Information</h3>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Department:</span>
                                        <span className={styles.detailValue}>{librarian.department || 'N/A'}</span>
                                      </div>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Employment Type:</span>
                                        <span className={styles.detailValue}>
                                          {formatEmploymentType(librarian.employmentType)}
                                        </span>
                                      </div>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Start Date:</span>
                                        <span className={styles.detailValue}>{librarian.startDate || 'N/A'}</span>
                                      </div>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Account Created:</span>
                                        <span className={styles.detailValue}>{formatDate(librarian.createdAt)}</span>
                                      </div>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Last Login:</span>
                                        <span className={styles.detailValue}>{librarian.lastLogin ? formatDate(librarian.lastLogin) : 'Never'}</span>
                                      </div>
                                    </div>
                                    
                                    <div className={styles.detailGroup}>
                                      <h3>Security Information</h3>
                                      <div className={styles.securitySection}>
                                        <FiShield className={styles.securityIcon} />
                                        <div className={styles.securityInfo}>
                                          <h4 className={styles.securityTitle}>Password Status</h4>
                                          {librarian.lastPasswordChange ? (
                                            <div className={`${styles.passwordUpdateInfo} ${isPasswordRecentlyUpdated(librarian.lastPasswordChange) ? styles.recentUpdate : ''}`}>
                                              <FiLock className={styles.updateIcon} />
                                              <span>
                                                Password updated: {formatPasswordUpdateTime(librarian.lastPasswordChange)}
                                                {isPasswordRecentlyUpdated(librarian.lastPasswordChange) && (
                                                  <span className={styles.recentBadge}>Recent</span>
                                                )}
                                              </span>
                                            </div>
                                          ) : (
                                            <div className={styles.passwordUpdateInfo}>
                                              <FiLock className={styles.updateIcon} />
                                              <span>Password never updated</span>
                                            </div>
                                          )}
                                          <p className={styles.securityNote}>
                                            For security reasons, passwords are not visible to administrators. 
                                            Librarians can change their passwords in their settings page.
                                          </p>
                                        </div>
                                      </div>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Employee ID:</span>
                                        <span className={styles.detailValue}>{librarian.employeeId}</span>
                                      </div>
                                      <div className={styles.detailRow}>
                                        <span className={styles.detailLabel}>Login Email:</span>
                                        <span className={styles.detailValue}>{librarian.email}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className={styles.noResults}>
                          <p>No librarians found. {searchTerm || filterStatus !== 'all' || filterDepartment !== 'all' || filterPasswordChange !== 'all' ? 'Try different search criteria.' : ''}</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

        </main>
      </div>
    </>
  );
}

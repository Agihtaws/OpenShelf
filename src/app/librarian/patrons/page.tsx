"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { db } from '../../../firebaseConfig';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  where, 
  doc, 
  getDoc
} from 'firebase/firestore';
import { 
  FiSearch, 
  FiUser, 
  FiArrowLeft, 
  FiPlus, 
  FiMail, 
  FiPhone, 
  FiHome, 
  FiGrid, 
  FiList,
  FiLock,
  FiCheck,
  FiAlertCircle,
  FiShield,
  FiCalendar
} from 'react-icons/fi';
import styles from './Patrons.module.css';

interface Patron {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  libraryCardId: string;
  feesPaid: boolean;
  receiveEmails: boolean;
  receiveTexts: boolean;
  createdAt: any;
  passwordLastUpdated?: any;
  membershipExpiryDate?: any; // Add membership expiry date
  membershipType?: string; // Add membership type
}

export default function PatronsPage() {
  const [patrons, setPatrons] = useState<Patron[]>([]);
  const [filteredPatrons, setFilteredPatrons] = useState<Patron[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  const router = useRouter();

  // Fetch all patrons
  useEffect(() => {
    const fetchPatrons = async () => {
      setIsLoading(true);
      setErrorMessage('');
      
      try {
        // Create a query to get all patrons
        const patronsQuery = query(
          collection(db, "users_customer"),
          orderBy("lastName", "asc")
        );
        
        const querySnapshot = await getDocs(patronsQuery);
        const patronsData: Patron[] = [];
        
        querySnapshot.forEach((doc) => {
          const data = doc.data() as Omit<Patron, 'id'>;
          
          // Convert Firestore timestamp to Date
          const createdAt = data.createdAt?.toDate ? 
            data.createdAt.toDate() : 
            data.createdAt ? new Date(data.createdAt) : new Date();
          
          // Convert password update timestamp if available
          const passwordLastUpdated = data.passwordLastUpdated?.toDate ? 
            data.passwordLastUpdated.toDate() : 
            data.passwordLastUpdated ? new Date(data.passwordLastUpdated) : null;
          
          // Convert membership expiry date if available
          const membershipExpiryDate = data.membershipExpiryDate?.toDate ? 
            data.membershipExpiryDate.toDate() : 
            data.membershipExpiryDate ? new Date(data.membershipExpiryDate) : null;
          
          patronsData.push({
            id: doc.id,
            ...data,
            createdAt,
            passwordLastUpdated,
            membershipExpiryDate
          });
        });
        
        setPatrons(patronsData);
        setFilteredPatrons(patronsData);
      } catch (error) {
        console.error("Error fetching patrons:", error);
        setErrorMessage("Failed to load patrons. Please try again later.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPatrons();
  }, []);

  // Filter and sort patrons when search query or sort options change
  useEffect(() => {
    if (patrons.length === 0) return;

    let result = [...patrons];
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(patron => 
        patron.firstName.toLowerCase().includes(query) ||
        patron.lastName.toLowerCase().includes(query) ||
        patron.email.toLowerCase().includes(query) ||
        patron.phone.includes(query) ||
        patron.libraryCardId.toLowerCase().includes(query)
      );
    }
    
    // Apply sorting
    if (sortBy === 'name') {
      result.sort((a, b) => {
        const nameA = `${a.lastName}, ${a.firstName}`.toLowerCase();
        const nameB = `${b.lastName}, ${b.firstName}`.toLowerCase();
        return nameA.localeCompare(nameB);
      });
    } else if (sortBy === 'cardId') {
      result.sort((a, b) => a.libraryCardId.localeCompare(b.libraryCardId));
    } else if (sortBy === 'createdAt') {
      result.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    } else if (sortBy === 'passwordUpdated') {
      result.sort((a, b) => {
        // Sort patrons with password updates at the top, newest first
        if (!a.passwordLastUpdated && !b.passwordLastUpdated) return 0;
        if (!a.passwordLastUpdated) return 1;
        if (!b.passwordLastUpdated) return -1;
        return b.passwordLastUpdated.getTime() - a.passwordLastUpdated.getTime();
      });
    } else if (sortBy === 'expiryDate') {
      result.sort((a, b) => {
        if (!a.membershipExpiryDate && !b.membershipExpiryDate) return 0;
        if (!a.membershipExpiryDate) return 1;
        if (!b.membershipExpiryDate) return -1;
        return a.membershipExpiryDate.getTime() - b.membershipExpiryDate.getTime();
      });
    }
    
    setFilteredPatrons(result);
  }, [patrons, searchQuery, sortBy]);

  // Format date
  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  // Format password last updated date with time
  const formatPasswordUpdateTime = (date: Date | null): string => {
    if (!date) return 'Never updated';
    
    const now = new Date();
    const today = new Date(now);
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
  };

  // Check if membership is expired
  const isMembershipExpired = (expiryDate: Date | null): boolean => {
    if (!expiryDate) return false;
    const today = new Date();
    return expiryDate < today;
  };

  // Calculate days until membership expiry
  const getDaysUntilExpiry = (expiryDate: Date | null): string => {
    if (!expiryDate) return 'No expiry date';
    
    const today = new Date();
    const diffTime = expiryDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return `Expired ${Math.abs(diffDays)} days ago`;
    } else if (diffDays === 0) {
      return 'Expires today';
    } else if (diffDays === 1) {
      return 'Expires tomorrow';
    } else {
      return `Expires in ${diffDays} days`;
    }
  };

  // Format expiry date in dd/mm/yyyy format
  const formatExpiryDate = (date: Date | null): string => {
    if (!date) return 'No expiry date';
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Determine if password was recently updated (within last 24 hours)
  const isPasswordRecentlyUpdated = (date: Date | null): boolean => {
    if (!date) return false;
    
    const now = new Date();
    const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    return diffHours < 24;
  };

  return (
    <div className={styles.patronsPage}>
      <div className={styles.pageHeader}>
        
        
        <h3>Manage patron accounts and information</h3>
      </div>
      
      <div className={styles.actionBar}>
        <div className={styles.searchWrapper}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by name, email, phone, or library card ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        
        <div className={styles.filters}>
          <div className={styles.filterGroup}>
            <label htmlFor="sortBy" className={styles.filterLabel}>
              Sort by:
            </label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className={styles.filterSelect}
            >
              <option value="name">Name</option>
              <option value="cardId">Library Card ID</option>
              <option value="createdAt">Registration Date</option>
              <option value="passwordUpdated">Password Updated</option>
              <option value="expiryDate">Membership Expiry</option>
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
          
          <Link href="/librarian/add-patron" className={styles.addButton}>
            <FiPlus /> Add Patron
          </Link>
        </div>
      </div>
      
      {errorMessage && <div className={styles.errorMessage}><FiAlertCircle /> {errorMessage}</div>}
      {successMessage && <div className={styles.successMessage}><FiCheck /> {successMessage}</div>}
      
      
        
      
      {isLoading ? (
        <div className={styles.loadingContainer}>
          <div className={styles.loadingSpinner}></div>
          <p>Loading patrons...</p>
        </div>
      ) : filteredPatrons.length > 0 ? (
        <>
          {viewMode === 'grid' ? (
            <div className={styles.patronsGrid}>
              {filteredPatrons.map(patron => (
                <div key={patron.id} className={styles.patronCard}>
                  <div className={styles.cardHeader}>
                    <div className={styles.patronAvatar}>
                      {patron.firstName.charAt(0)}{patron.lastName.charAt(0)}
                    </div>
                    <div className={styles.patronNameContainer}>
                      <h3 className={styles.patronName}>
                        {patron.firstName} {patron.lastName}
                      </h3>
                    </div>
                  </div>
                  
                  <div className={styles.cardBody}>
                    <div className={styles.patronDetail}>
                      <FiUser className={styles.detailIcon} />
                      <span className={styles.detailLabel}>Card ID:</span>
                      <span className={styles.detailValue}>{patron.libraryCardId}</span>
                    </div>
                    
                    <div className={styles.patronDetail}>
                      <FiMail className={styles.detailIcon} />
                      <span className={styles.detailLabel}>Email:</span>
                      <span className={styles.detailValue}>{patron.email}</span>
                    </div>
                    
                    <div className={styles.patronDetail}>
                      <FiPhone className={styles.detailIcon} />
                      <span className={styles.detailLabel}>Phone:</span>
                      <span className={styles.detailValue}>{patron.phone}</span>
                    </div>
                    
                    <div className={styles.patronDetail}>
                      <FiHome className={styles.detailIcon} />
                      <span className={styles.detailLabel}>Address:</span>
                      <span className={styles.detailValue}>
                        {patron.address}, {patron.city}, {patron.state} {patron.zip}
                      </span>
                    </div>
                    
                    <div className={styles.securitySection}>
                      <FiShield className={styles.securityIcon} />
                      <div className={styles.securityInfo}>
                        <h4 className={styles.securityTitle}>Security</h4>
                        {patron.passwordLastUpdated ? (
                          <div className={`${styles.passwordUpdateInfo} ${isPasswordRecentlyUpdated(patron.passwordLastUpdated) ? styles.recentUpdate : ''}`}>
                            <FiLock className={styles.updateIcon} />
                            <span>
                              Password updated: {formatPasswordUpdateTime(patron.passwordLastUpdated)}
                              {isPasswordRecentlyUpdated(patron.passwordLastUpdated) && (
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
                      </div>
                    </div>
                    
                    <div className={styles.patronDetail}>
                      <span className={styles.detailLabel}>Registered:</span>
                      <span className={styles.detailValue}>
                        {formatDate(patron.createdAt)}
                      </span>
                    </div>

                    <div className={styles.patronDetail}>
                      <FiCalendar className={styles.detailIcon} />
                      <span className={styles.detailLabel}>Expires at:</span>
                      <span className={`${styles.detailValue} ${patron.membershipExpiryDate && isMembershipExpired(patron.membershipExpiryDate) ? styles.expired : ''}`}>
                        {patron.membershipExpiryDate ? formatExpiryDate(patron.membershipExpiryDate) : 'No expiry date'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.patronsTable}>
              <div className={styles.tableHeader}>
                <div className={styles.tableCell}>Name</div>
                <div className={styles.tableCell}>Card ID</div>
                <div className={styles.tableCell}>Contact</div>
                <div className={styles.tableCell}>Security</div>
                <div className={styles.tableCell}>Registered</div>
                <div className={styles.tableCell}>Expires at</div>
              </div>
              
              <div className={styles.tableBody}>
                {filteredPatrons.map(patron => (
                  <div key={patron.id} className={styles.tableRow}>
                    <div className={styles.tableCell}>
                      <div className={styles.patronInfo}>
                        <div className={styles.patronAvatar}>
                          {patron.firstName.charAt(0)}{patron.lastName.charAt(0)}
                        </div>
                        <div>
                          <span className={styles.patronName}>
                            {patron.firstName} {patron.lastName}
                          </span>
                          <span className={styles.patronAddress}>
                            {patron.city}, {patron.state}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className={styles.tableCell}>
                      <span className={styles.cardId}>{patron.libraryCardId}</span>
                    </div>
                    <div className={styles.tableCell}>
                      <div className={styles.contactInfo}>
                        <span className={styles.contactEmail}>
                          <FiMail size={14} /> {patron.email}
                        </span>
                        <span className={styles.contactPhone}>
                          <FiPhone size={14} /> {patron.phone}
                        </span>
                      </div>
                    </div>
                    <div className={styles.tableCell}>
                      <div className={styles.securityCell}>
                        {patron.passwordLastUpdated ? (
                          <div className={`${styles.passwordUpdateInfo} ${isPasswordRecentlyUpdated(patron.passwordLastUpdated) ? styles.recentUpdate : ''}`}>
                            <FiLock size={14} className={styles.updateIcon} />
                            <span className={styles.updateTimeSmall}>
                              Updated: {formatPasswordUpdateTime(patron.passwordLastUpdated)}
                              {isPasswordRecentlyUpdated(patron.passwordLastUpdated) && (
                                <span className={styles.recentBadge}>Recent</span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className={styles.passwordUpdateInfo}>
                            <FiLock size={14} className={styles.updateIcon} />
                            <span className={styles.updateTimeSmall}>Never updated</span>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className={styles.tableCell}>
                      {formatDate(patron.createdAt)}
                    </div>
                    <div className={styles.tableCell}>
                      {patron.membershipExpiryDate ? 
                        formatExpiryDate(patron.membershipExpiryDate) : 
                        'No expiry date'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon}>
            <FiUser size={48} />
          </div>
          <h3>No patrons found</h3>
          <p>
            {searchQuery
              ? 'Try adjusting your search' 
              : 'There are no patrons registered in the system.'}
          </p>
          <Link href="/librarian/add-patron" className={styles.addPatronButton}>
            <FiPlus /> Add Your First Patron
          </Link>
        </div>
      )}
    </div>
  );
}

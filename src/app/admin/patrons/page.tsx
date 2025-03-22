// src/app/admin/patrons/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { auth, db } from '../../../firebaseConfig';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  doc, 
  getDoc 
} from 'firebase/firestore';
import { 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  FiSearch, 
  FiUser, 
  FiArrowLeft, 
  FiMail, 
  FiPhone, 
  FiHome, 
  FiGrid, 
  FiList
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
  createdAt: any;
}

export default function AdminPatronsPage() {
  const [patrons, setPatrons] = useState<Patron[]>([]);
  const [filteredPatrons, setFilteredPatrons] = useState<Patron[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [errorMessage, setErrorMessage] = useState('');

  // Fetch all patrons
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
        
        patronsData.push({
          id: doc.id,
          ...data,
          createdAt
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

  // Initial data fetch
  useEffect(() => {
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

  return (
    <div className={styles.patronsPage}>
      <div className={styles.pageHeader}>
        
        <h1>Library Patrons</h1>
        <p>View patron information</p>
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
        </div>
      </div>
      
      {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
      
      <div className={styles.statsBar}>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{patrons.length}</span>
          <span className={styles.statLabel}>Total Patrons</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statValue}>{filteredPatrons.length}</span>
          <span className={styles.statLabel}>Showing</span>
        </div>
      </div>
      
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
                    
                    <div className={styles.patronDetail}>
                      <span className={styles.detailLabel}>Registered:</span>
                      <span className={styles.detailValue}>
                        {formatDate(patron.createdAt)}
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
                <div className={styles.tableCell}>Address</div>
                <div className={styles.tableCell}>Registered</div>
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
                      {patron.address}, {patron.city}, {patron.state} {patron.zip}
                    </div>
                    <div className={styles.tableCell}>
                      {formatDate(patron.createdAt)}
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
            {searchQuery ? 'Try adjusting your search criteria' : 'There are no patrons registered in the system.'}
          </p>
        </div>
      )}
    </div>
  );
}

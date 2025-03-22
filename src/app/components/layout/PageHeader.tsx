// src/components/layout/PageHeader.tsx
"use client";

import { useState } from 'react';
import Link from 'next/link';
import { FiBell, FiSearch } from 'react-icons/fi';
import styles from './PageHeader.module.css';

interface PageHeaderProps {
  userData: any;
  isDarkMode: boolean;
  toggleDarkMode: () => void;
}

export default function PageHeader({ userData, isDarkMode, toggleDarkMode }: PageHeaderProps) {
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Implement search functionality
    console.log('Searching for:', searchQuery);
  };

  return (
    <header className={styles.header}>
      <div className={styles.headerContent}>
        <div className={styles.searchContainer}>
          <form onSubmit={handleSearch}>
            <div className={styles.searchInputWrapper}>
              <FiSearch className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search books, authors..."
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </form>
        </div>

        <div className={styles.headerActions}>
          <button className={styles.notificationBtn} onClick={() => setShowNotifications(!showNotifications)}>
            <FiBell size={20} />
            <span className={styles.notificationBadge}>0</span>
          </button>
          
          <button className={styles.themeToggle} onClick={toggleDarkMode}>
            {isDarkMode ? '☀️' : '🌙'}
          </button>
          
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {userData?.displayName || userData?.email?.split('@')[0] || 'User'}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

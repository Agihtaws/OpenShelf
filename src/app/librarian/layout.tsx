// src/app/librarian/layout.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/librarian/components/sidebar';
import Header from '@/app/librarian/components/header';
import Footer from '@/app/librarian/components/Footer';
import styles from './librarian.module.css';
import { auth, signOut } from '@/firebaseConfig';

export default function LibrarianLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard');

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      const userRole = localStorage.getItem('user_role');
      // Check if user is librarian or admin (admins can access librarian pages)
      if (userRole !== 'librarian' && userRole !== 'admin') {
        router.push('/auth/login');
      } else {
        setLoading(false);
      }
    };

    // Determine active menu item based on URL path
    const determineActiveMenuItem = () => {
      const path = window.location.pathname;
      const segments = path.split('/').filter(Boolean);
      
      if (segments.length > 1 && segments[0] === 'librarian') {
        setActiveMenuItem(segments[1]);
      } else {
        setActiveMenuItem('dashboard');
      }
    };

    checkAuth();
    determineActiveMenuItem();
  }, [router]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      
      // Clear local storage
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('device_id');
      localStorage.removeItem('librarian_email');
      localStorage.removeItem('librarian_token');
      
      // Clear cookies
      document.cookie = 'user_token=; path=/; max-age=0';
      document.cookie = 'user_role=; path=/; max-age=0';
      document.cookie = 'device_id=; path=/; max-age=0';
      document.cookie = 'last_activity=; path=/; max-age=0';
      
      // Redirect to login
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
      // Force redirect even if logout fails
      router.push('/auth/login');
    }
  };

  // Handle search queries from the header
  const handleSearch = (query: string) => {
    // Navigate to search results page with query
    router.push(`/librarian/search?q=${encodeURIComponent(query)}`);
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className={styles.librarianLayout}>
      <Sidebar handleLogout={handleLogout} activeMenuItem={activeMenuItem} />
      <div className={styles.mainContainer}>
        <Header onSearch={handleSearch} />
        <main className={styles.mainContent}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

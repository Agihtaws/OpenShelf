// src/app/user/layout.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import UserSidebar from '@/app/user/components/sidebar';
import Header from '@/app/user/components/Header';
import Footer from '@/app/user/components/Footer';
import styles from './user.module.css';
import { auth, signOut } from '@/firebaseConfig';

export default function UserLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [activeMenuItem, setActiveMenuItem] = useState('dashboard');
  const [userData, setUserData] = useState<any>(null);
  const [userInitial, setUserInitial] = useState('');

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      // Check for browser environment
      if (typeof window === 'undefined') return;
      
      const userRole = localStorage.getItem('user_role');
      const userId = localStorage.getItem('user_id');
      const userToken = localStorage.getItem('user_token');
      
      // Check if user is authenticated and has customer role
      if (!userToken || !userId || userRole !== 'customer') {
        router.push('/auth/login');
      } else {
        // Get user data from localStorage or state
        const storedUserData = localStorage.getItem('user_data');
        if (storedUserData) {
          try {
            const parsedUserData = JSON.parse(storedUserData);
            setUserData(parsedUserData);
            
            // Set user initial for avatar
            if (parsedUserData.firstName) {
              setUserInitial(parsedUserData.firstName.charAt(0).toUpperCase());
            } else if (parsedUserData.displayName) {
              setUserInitial(parsedUserData.displayName.charAt(0).toUpperCase());
            } else if (parsedUserData.email) {
              setUserInitial(parsedUserData.email.charAt(0).toUpperCase());
            }
          } catch (error) {
            console.error('Error parsing user data:', error);
          }
        }
        
        setLoading(false);
      }
    };

    // Determine active menu item based on URL path
    const determineActiveMenuItem = () => {
      if (typeof window === 'undefined') return;
      
      const path = window.location.pathname;
      const segments = path.split('/').filter(Boolean);
      
      if (segments.length > 1 && segments[0] === 'user') {
        setActiveMenuItem(segments[1]);
      } else {
        setActiveMenuItem('dashboard');
      }
    };

    checkAuth();
    determineActiveMenuItem();
    
    // Add event listener for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user_token' && !e.newValue) {
        // User logged out in another tab
        router.push('/auth/login');
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [router]);

  // Handle logout
  const handleLogout = async () => {
    try {
      if (typeof window === 'undefined') return;
      
      await signOut(auth);
      
      // Clear local storage
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('user_id');
      localStorage.removeItem('device_id');
      localStorage.removeItem('user_data');
      
      // Clear cookies
      document.cookie = 'user_token=; path=/; max-age=0';
      document.cookie = 'user_role=; path=/; max-age=0';
      document.cookie = 'user_id=; path=/; max-age=0';
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
    router.push(`/user/search?q=${encodeURIComponent(query)}`);
  };

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your library...</p>
      </div>
    );
  }

  return (
    <div className={styles.userLayout}>
      <UserSidebar 
        userData={userData}
        userInitial={userInitial}
        handleLogout={handleLogout} 
        activeMenuItem={activeMenuItem}
      />
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

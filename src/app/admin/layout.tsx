// src/app/admin/layout.tsx
"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/app/admin/components/sidebar';
import Header from '@/app/admin/components/Header';
import Footer from '@/app/admin/components/Footer';
import styles from './admin.module.css';
import { auth, signOut } from '@/firebaseConfig';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Check authentication on component mount
  useEffect(() => {
    const checkAuth = () => {
      const userRole = localStorage.getItem('user_role');
      if (userRole !== 'admin') {
        router.push('/auth/login');
      } else {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
      
      // Clear local storage
      localStorage.removeItem('user_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('device_id');
      localStorage.removeItem('user_email');
      
      // Clear cookies
      document.cookie = 'user_token=; path=/; max-age=0';
      document.cookie = 'user_role=; path=/; max-age=0';
      document.cookie = 'device_id=; path=/; max-age=0';
      document.cookie = 'last_activity=; path=/; max-age=0';
      
      // Redirect to login
      router.push('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
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
    <div className={styles.adminLayout}>
      <Sidebar handleLogout={handleLogout} activeMenuItem="dashboard" />
      <div className={styles.mainContainer}>
        <Header />
        <main className={styles.mainContent}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
}

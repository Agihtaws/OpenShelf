// src/app/user/fines/page.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { db } from '@/firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { FiAlertTriangle, FiBook, FiDollarSign } from 'react-icons/fi';
import styles from './fines.module.css';

interface Fine {
  id: string;
  bookTitle: string;
  amount: number;
  reason: string;
  date: string;
  isPaid: boolean;
}

export default function FinesPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [fines, setFines] = useState<{ total: number; items: Fine[] }>({ total: 0, items: [] });
  const [userData, setUserData] = useState<any>(null);
  const [userInitial, setUserInitial] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userToken = localStorage.getItem('user_token');
        const userId = localStorage.getItem('user_id');

        if (userToken === 'logged_in' && userId) {
          const userDoc = await getDoc(doc(db, "users_customer", userId));

          if (userDoc.exists()) {
            const userData = userDoc.data();
            setUserData({
              uid: userId,
              displayName: userData.displayName || '',
              email: userData.email || '',
              photoURL: userData.photoURL || '',
              firstName: userData.firstName || '',
              lastName: userData.lastName || ''
            });

            if (userData.firstName) {
              setUserInitial(userData.firstName.charAt(0).toUpperCase());
            } else if (userData.displayName) {
              setUserInitial(userData.displayName.charAt(0).toUpperCase());
            } else if (userData.email) {
              setUserInitial(userData.email.charAt(0).toUpperCase());
            }

            setIsAuthenticated(true);
            fetchUserFines(userId);
          } else {
            router.push('/auth/login');
          }
        } else {
          router.push('/auth/login');
        }
      } catch (error) {
        console.error("Error checking authentication:", error);
        router.push('/auth/login');
        setIsLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const fetchUserFines = async (userId: string) => {
    try {
      const finesQuery = query(
        collection(db, "fines"),
        where("userId", "==", userId),
        where("isPaid", "==", false)
      );

      const finesSnapshot = await getDocs(finesQuery);
      const finesList: Fine[] = [];
      let totalFines = 0;

      finesSnapshot.forEach(doc => {
        const fineData = doc.data() as Fine;
        finesList.push({
          ...fineData,
          id: doc.id,
          date: fineData.date
        });
        totalFines += fineData.amount;
      });

      setFines({ total: totalFines, items: finesList });
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching fines:", error);
      setIsLoading(false);
    }
  };

  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your fines...</p>
      </div>
    );
  }

  return (
    <main className={styles.mainContent}>
      <header className={styles.pageHeader}>
        
        <h3 className={styles.headerDescription}>
          Outstanding fines on your account
        </h3>
      </header>

      <div className={styles.finesContainer}>
        {fines.items.length > 0 ? (
          <>
            <div className={styles.finesSummary}>
              <h3>
                Total Fines: <span className={styles.totalAmount}>USD {fines.total.toFixed(2)}</span>
              </h3>
              <p>Please pay your fines to continue borrowing books.</p>
            </div>

            <div className={styles.finesList}>
              {fines.items.map(fine => (
                <div key={fine.id} className={styles.fineItem}>
                  <div className={styles.fineInfo}>
                    <h4 className={styles.fineTitle}>{fine.bookTitle}</h4>
                    <p className={styles.fineReason}>{fine.reason}</p>
                    <p className={styles.fineDate}>Date: {fine.date}</p>
                  </div>
                  <div className={styles.fineAmount}>
                    USD {fine.amount.toFixed(2)}
                  </div>
                </div>
              ))}
            </div>

            <div className={styles.paymentOptions}>
              <button className={styles.payButton}>
                <FiDollarSign /> Pay All Fines
              </button>
              <p className={styles.disclaimer}>Payments are processed securely.</p>
            </div>
          </>
        ) : (
          <div className={styles.emptyState}>
            <div className={styles.emptyIcon}>
              <FiAlertTriangle />
            </div>
            <h3>No fines</h3>
            <p>You don't have any outstanding fines at the moment.</p>
            <Link href="/user/catalog" className={styles.browseButton}>
              Browse Catalog
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

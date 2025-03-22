// src/hooks/useExpiredReservationsCheck.ts
import { useEffect, useState } from 'react';
import { db } from '@/firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  writeBatch, 
  doc
} from 'firebase/firestore';

export default function useExpiredReservationsCheck() {
  const [isChecking, setIsChecking] = useState(false);
  const [processedCount, setProcessedCount] = useState(0);
  
  const checkExpiredReservations = async () => {
    try {
      const userId = localStorage.getItem('user_id');
      if (!userId || isChecking) return;
      
      setIsChecking(true);
      
      const now = new Date();
      // Set to the start of today to compare dates only (not times)
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const reservesQuery = query(
        collection(db, "reserves"),
        where("userId", "==", userId),
        where("status", "==", "reserved")
      );
      
      const reservesSnapshot = await getDocs(reservesQuery);
      
      // If no reservations, skip processing
      if (reservesSnapshot.empty) {
        setIsChecking(false);
        return;
      }
      
      const batch = writeBatch(db);
      let expiredCount = 0;
      
      // Check each reservation for expiration
      reservesSnapshot.forEach(doc => {
        const reservation = doc.data();
        const pickupDate = reservation.pickupDate?.toDate ? 
          reservation.pickupDate.toDate() : 
          reservation.pickupDate ? new Date(reservation.pickupDate) : null;
        
        if (pickupDate) {
          // Convert pickup date to start of day for fair comparison
          const pickupDay = new Date(pickupDate.getFullYear(), pickupDate.getMonth(), pickupDate.getDate());
          
          // Only expire if pickup date is strictly before today
          if (pickupDay < today) {
            // Delete expired reservation
            batch.delete(doc.ref);
            expiredCount++;
          }
        }
      });
      
      if (expiredCount > 0) {
        // Commit the batch deletion
        await batch.commit();
        setProcessedCount(expiredCount);
        console.log(`Processed ${expiredCount} expired reservations`);
      }
      
      setIsChecking(false);
    } catch (error) {
      console.error("Error checking expired reservations:", error);
      setIsChecking(false);
    }
  };

  useEffect(() => {
    // Run once when component mounts
    checkExpiredReservations();
    
    // Set up interval to check every hour
    const interval = setInterval(() => {
      checkExpiredReservations();
    }, 3600000); // 1 hour
    
    return () => clearInterval(interval);
  }, []);

  return { isChecking, processedCount, checkExpiredReservations };
}

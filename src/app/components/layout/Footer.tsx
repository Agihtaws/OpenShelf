// src/components/layout/Footer.tsx
import Link from 'next/link';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>
            <span className={styles.logoText}>OpenShelf</span>
            <p>Modern library management system</p>
          </div>
          
          <div className={styles.footerLinks}>
            <div className={styles.footerLinkGroup}>
              <h4>Platform</h4>
              <Link href="/features">Features</Link>
              <Link href="/stocks">Stocks</Link>
              <Link href="/documentation">Documentation</Link>
            </div>
            
            <div className={styles.footerLinkGroup}>
              <h4>Company</h4>
              <Link href="/about">About Us</Link>
              <Link href="/careers">Careers</Link>
              <Link href="/contact">Contact</Link>
            </div>
            
            <div className={styles.footerLinkGroup}>
              <h4>Legal</h4>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
            </div>
          </div>
        </div>
        
        <div className={styles.footerBottom}>
          <p>&copy; 2025 OpenShelf. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

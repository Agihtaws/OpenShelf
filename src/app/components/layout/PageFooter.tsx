// src/components/layout/PageFooter.tsx
import Link from 'next/link';
import styles from './PageFooter.module.css';

export default function PageFooter() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.copyright}>
          © {currentYear} OpenShelf Library. All rights reserved.
        </div>
        <div className={styles.footerLinks}>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
}

// src/components/layout/Navbar.tsx
"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Navbar.module.css';

export default function Navbar() {
  const pathname = usePathname();
  
  const isActive = (path: string) => {
    if (path === '/' && pathname === '/') {
      return true;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  };

  return (
    <nav className={styles.navbar}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <Link href="/">
            <span className={styles.logoText}>OpenShelf</span>
          </Link>
        </div>
        
        
        <div className={styles.navLinks}>

        <Link 
            href="/" 
            className={`${styles.navLink} ${isActive('/') ? styles.activeLink : ''}`}
          >
            Home
          </Link>
          <Link 
            href="/about" 
            className={`${styles.navLink} ${isActive('/about') ? styles.activeLink : ''}`}
          >
            About
          </Link>
          <Link 
            href="/features" 
            className={`${styles.navLink} ${isActive('/features') ? styles.activeLink : ''}`}
          >
            Features
          </Link>
          <Link 
            href="/stocks" 
            className={`${styles.navLink} ${isActive('/stocks') ? styles.activeLink : ''}`}
          >
            Stocks
          </Link>
          <Link 
            href="/contact" 
            className={`${styles.navLink} ${isActive('/contact') ? styles.activeLink : ''}`}
          >
            Contact
          </Link>
        </div>
        
        <div className={styles.authLinks}>
        <Link href="/auth/login" className={styles.loginButton}>Login</Link>
        
          
          
        </div>
      </div>
    </nav>
  );
}

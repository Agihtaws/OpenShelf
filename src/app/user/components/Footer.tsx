// src/app/librarian/components/Footer.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import styles from './Footer.module.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerContent}>
        <div className={styles.copyright}>
          &copy; {currentYear} OpenShelf. All rights reserved.
        </div>
        <div className={styles.footerLinks}>
          <Link href="/about">About Us</Link>
          <Link href="/contact">Contact</Link>
          <Link href="/features">Features</Link>
          <Link href="/librarian/stocks">Stocks</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

// src/app/librarian/components/sidebar.tsx
"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './sidebar.module.css';

// Navigation Item Component
interface NavItemProps {
  href: string;
  icon: string;
  text: string;
  active: boolean;
  onClick: () => void;
}

const NavItem = ({ href, icon, text, active, onClick }: NavItemProps) => (
  <li className={`${styles.navItem} ${active ? styles.active : ''}`}>
    <Link href={href} className={styles.navLink} onClick={onClick}>
      <span className={styles.navIcon}>{icon}</span>
      <span className={styles.navText}>{text}</span>
    </Link>
  </li>
);

interface SidebarProps {
  handleLogout: () => void;
  activeMenuItem: string;
}

export default function Sidebar({ handleLogout }: SidebarProps) {
  const pathname = usePathname();
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeMenuItem, setActiveMenuItem] = useState('');

  // Update active menu item based on pathname
  useEffect(() => {
    // Extract the base path from the pathname
    const basePath = pathname.split('/')[2] || 'dashboard';
    setActiveMenuItem(basePath);
  }, [pathname]);
  
  // Handle window resize to detect mobile view
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      
      // Auto-close sidebar on mobile, keep open on desktop
      if (mobile !== isMobile) {
        setSidebarOpen(!mobile);
      }
    };
    
    // Initial check
    handleResize();
    
    // Add event listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup
    return () => window.removeEventListener('resize', handleResize);
  }, [isMobile]);

  // Toggle sidebar
  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };
  
  // Close sidebar after navigation on mobile
  const handleNavClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <>
      {/* Mobile Hamburger Menu */}
      {isMobile && (
        <div className={styles.mobileHeader}>
          <div className={styles.mobileLogoContainer}>
            <span className={styles.mobileLogoIcon}>📚</span>
            <span className={styles.mobileLogoText}>OPENSHELF</span>
          </div>
          <button 
            className={styles.hamburgerButton} 
            onClick={toggleSidebar}
            aria-label="Toggle navigation menu"
          >
            <div className={`${styles.hamburgerIcon} ${sidebarOpen ? styles.open : ''}`}>
              <span></span>
              <span></span>
              <span></span>
            </div>
          </button>
        </div>
      )}
      
      {/* Sidebar */}
      <aside className={`${styles.sidebar} ${!sidebarOpen ? styles.collapsed : ''} ${isMobile ? styles.mobile : ''}`}>
        {!isMobile && (
          <div className={styles.sidebarHeader}>
            <div className={styles.logo}>
              <span className={styles.logoIcon}>📚</span>
              <span className={styles.logoText}>OPENSHELF</span>
            </div>
          </div>
        )}
        
        <nav className={styles.sidebarNav}>
          <ul className={styles.navList}>
            <NavItem 
              href="/librarian/dashboard" 
              icon="📊" 
              text="Dashboard" 
              active={activeMenuItem === 'dashboard'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/new-arrivals" 
              icon="📚" 
              text="New Arrivals" 
              active={activeMenuItem === 'new-arrivals'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/stocks" 
              icon="📋" 
              text="Stocks" 
              active={activeMenuItem === 'stocks'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/reserved" 
              icon="🔖" 
              text="Reserved" 
              active={activeMenuItem === 'reserved'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/checkouts" 
              icon="📤" 
              text="Checkouts" 
              active={activeMenuItem === 'checkouts'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/patrons" 
              icon="👤" 
              text="Patrons" 
              active={activeMenuItem === 'patrons'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/add-patron" 
              icon="➕" 
              text="Add Patron" 
              active={activeMenuItem === 'add-patron'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/payments" 
              icon="💰" 
              text="Payments" 
              active={activeMenuItem === 'payments'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/overdues" 
              icon="⏰" 
              text="Overdues" 
              active={activeMenuItem === 'overdues'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/librarian/settings" 
              icon="⚙️" 
              text="Settings" 
              active={activeMenuItem === 'settings'} 
              onClick={handleNavClick}
            />
          </ul>
        </nav>
        
        <div className={styles.sidebarFooter}>
          <button className={styles.logoutButton} onClick={handleLogout}>
            <span className={styles.logoutIcon}>🚪</span>
            <span>Logout</span>
          </button>
        </div>
      </aside>
      
      {/* Overlay for mobile */}
      {isMobile && sidebarOpen && (
        <div className={styles.overlay} onClick={toggleSidebar}></div>
      )}
    </>
  );
}

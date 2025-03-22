// src\app\admin\components\sidebar.tsx
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
  
  // Determine active menu item based on current path
  const getActiveItem = () => {
    const path = pathname.split('/');
    return path.length > 2 ? path[2] : 'dashboard';
  };
  
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
            <span className={styles.mobileLogoIcon}>📚OPENSHELF</span>
            <span className={styles.mobileLogoText}></span>
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
              href="/admin/dashboard" 
              icon="📊" 
              text="Dashboard" 
              active={getActiveItem() === 'dashboard'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/admin/stocks" 
              icon="📚" 
              text="Stocks" 
              active={getActiveItem() === 'stocks'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/admin/add-book" 
              icon="📕" 
              text="Add Book" 
              active={getActiveItem() === 'add-book'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/admin/patrons" 
              icon="👤" 
              text="Patrons" 
              active={getActiveItem() === 'patrons'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/admin/payments" 
              icon="💰" 
              text="Payments" 
              active={getActiveItem() === 'payments'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/admin/librarians/add" 
              icon="👥" 
              text="Add Librarian" 
              active={getActiveItem() === 'librarians' && pathname.includes('/add')} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/admin/librarians" 
              icon="👤" 
              text="Librarians" 
              active={getActiveItem() === 'librarians' && !pathname.includes('/add')} 
              onClick={handleNavClick}
            />
            
            <NavItem 
              href="/admin/reports" 
              icon="📝" 
              text="Reports" 
              active={getActiveItem() === 'reports'} 
              onClick={handleNavClick}
            />
            <NavItem 
              href="/admin/settings" 
              icon="⚙️" 
              text="Settings" 
              active={getActiveItem() === 'settings'} 
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

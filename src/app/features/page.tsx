// src/app/features/page.tsx
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/app/components/layout/Navbar';
import styles from './features.module.css';
import Footer from '../components/layout/Footer';

export default function FeaturesPage() {
  return (
    <>
    <Navbar />
    <main className={styles.featuresPage}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <h1>Powerful Features for Modern Libraries</h1>
            <p>Discover how LibraryOS transforms library management with innovative tools and capabilities</p>
          </div>
        </div>
      </section>

      {/* Feature Categories Navigation */}
      <section className={styles.featureNav}>
        <div className={styles.container}>
          <div className={styles.featureNavLinks}>
            <a href="#inventory" className={styles.featureNavLink}>Inventory Management</a>
            <a href="#circulation" className={styles.featureNavLink}>Circulation</a>
            <a href="#catalog" className={styles.featureNavLink}>Catalog</a>
            <a href="#patrons" className={styles.featureNavLink}>Patron Management</a>
            <a href="#digital" className={styles.featureNavLink}>Digital Resources</a>
            <a href="#analytics" className={styles.featureNavLink}>Analytics</a>
            <a href="#admin" className={styles.featureNavLink}>Administration</a>
          </div>
        </div>
      </section>

      {/* Inventory Management Section */}
      <section id="inventory" className={styles.featureSection}>
        <div className={styles.container}>
          <div className={styles.featureSectionHeader}>
            <div className={styles.featureIcon}>📦</div>
            <h2>Inventory Management</h2>
            <p>Comprehensive tools to track and manage your entire collection</p>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3>Barcode & RFID Integration</h3>
              <p>Seamlessly integrate with barcode scanners and RFID systems for efficient inventory tracking and management.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Multi-location Tracking</h3>
              <p>Track items across multiple locations, branches, or collections with precise location data.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Inventory Auditing</h3>
              <p>Conduct full or partial inventory audits with mobile devices to quickly identify missing or misplaced items.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Condition Tracking</h3>
              <p>Monitor item condition over time and flag materials that need repair, replacement, or special handling.</p>
            </div>
          </div>

          <div className={styles.featureShowcase}>
            <div className={styles.featureShowcaseContent}>
              <h3>Smart Collection Management</h3>
              <p>Our advanced inventory system helps you maintain complete control over your physical collection:</p>
              <ul className={styles.featureList}>
                <li>Automated status updates as items move through the system</li>
                <li>Custom fields for specialized collections</li>
                <li>Batch processing for efficient cataloging</li>
                <li>Integration with acquisition workflows</li>
                <li>Automated alerts for missing or overdue items</li>
              </ul>
            </div>
            <div className={styles.featureShowcaseImage}>
              <Image 
                src="/images/features/inventory-dashboard.jpg" 
                alt="Inventory Management Dashboard" 
                width={550} 
                height={350}
                className={styles.showcaseImg}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Circulation Section */}
      <section id="circulation" className={`${styles.featureSection} ${styles.altBackground}`}>
        <div className={styles.container}>
          <div className={styles.featureSectionHeader}>
            <div className={styles.featureIcon}>🔄</div>
            <h2>Circulation Management</h2>
            <p>Streamline check-outs, returns, and reservations</p>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3>Fast Check-out Processing</h3>
              <p>Process check-outs in seconds with barcode scanning and quick patron lookup.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Self-service Options</h3>
              <p>Enable patron self-checkout and return with kiosk mode and integration with self-service stations.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Reservation System</h3>
              <p>Allow patrons to place holds on items and manage reservation queues efficiently.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Automated Notifications</h3>
              <p>Send automatic reminders for due dates, available holds, and overdue materials.</p>
            </div>
          </div>

          <div className={styles.featureShowcase}>
            <div className={styles.featureShowcaseImage}>
              <Image 
                src="/images/features/circulation-desk.jpg" 
                alt="Circulation Desk Interface" 
                width={550} 
                height={350}
                className={styles.showcaseImg}
              />
            </div>
            <div className={styles.featureShowcaseContent}>
              <h3>Efficient Circulation Workflows</h3>
              <p>Our circulation system is designed for speed and accuracy:</p>
              <ul className={styles.featureList}>
                <li>Intuitive interface designed for busy circulation desks</li>
                <li>Customizable loan periods by item type or patron category</li>
                <li>Fine and fee management with payment processing</li>
                <li>Offline circulation capabilities for system outages</li>
                <li>Bulk operations for school and academic environments</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Catalog Section */}
      <section id="catalog" className={styles.featureSection}>
        <div className={styles.container}>
          <div className={styles.featureSectionHeader}>
            <div className={styles.featureIcon}>🔍</div>
            <h2>Advanced Catalog</h2>
            <p>Powerful search and discovery tools for your collection</p>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3>Intuitive Search Interface</h3>
              <p>Provide patrons with a modern, Google-like search experience with instant results.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Faceted Navigation</h3>
              <p>Enable users to refine searches by format, subject, availability, publication date, and more.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Rich Metadata Support</h3>
              <p>Support for MARC21, Dublin Core, and custom metadata schemas for specialized collections.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Automatic Suggestions</h3>
              <p>Offer "did you mean" suggestions and related content recommendations.</p>
            </div>
          </div>

          <div className={styles.featureShowcase}>
            <div className={styles.featureShowcaseContent}>
              <h3>Modern Discovery Experience</h3>
              <p>Our catalog system combines powerful search technology with an intuitive interface:</p>
              <ul className={styles.featureList}>
                <li>Full-text search capabilities</li>
                <li>Customizable display templates</li>
                <li>Cover image integration</li>
                <li>Mobile-responsive design</li>
                <li>Integration with external content sources</li>
              </ul>
            </div>
            <div className={styles.featureShowcaseImage}>
              <Image 
                src="/images/features/catalog-search.jpg" 
                alt="Catalog Search Interface" 
                width={550} 
                height={350}
                className={styles.showcaseImg}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Patron Management Section */}
      <section id="patrons" className={`${styles.featureSection} ${styles.altBackground}`}>
        <div className={styles.container}>
          <div className={styles.featureSectionHeader}>
            <div className={styles.featureIcon}>👥</div>
            <h2>Patron Management</h2>
            <p>Comprehensive tools for managing library users</p>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3>Patron Profiles</h3>
              <p>Maintain detailed patron records with contact information, preferences, and borrowing history.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Custom Patron Categories</h3>
              <p>Create custom patron types with specific privileges, loan periods, and borrowing limits.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Self-service Portal</h3>
              <p>Empower patrons to manage their accounts, renew items, and update personal information.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Communication Tools</h3>
              <p>Send targeted communications to specific patron groups for events, closures, or new services.</p>
            </div>
          </div>

          <div className={styles.featureShowcase}>
            <div className={styles.featureShowcaseImage}>
              <Image 
                src="/images/features/patron-management.jpg" 
                alt="Patron Management Interface" 
                width={550} 
                height={350}
                className={styles.showcaseImg}
              />
            </div>
            <div className={styles.featureShowcaseContent}>
              <h3>Streamlined User Management</h3>
              <p>Our patron system helps you build stronger relationships with your community:</p>
              <ul className={styles.featureList}>
                <li>Batch patron import and update capabilities</li>
                <li>Privacy-focused design with configurable data retention</li>
                <li>Integration with student information systems</li>
                <li>Reading history and recommendation features</li>
                <li>Customizable registration forms and workflows</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Digital Resources Section */}
      <section id="digital" className={styles.featureSection}>
        <div className={styles.container}>
          <div className={styles.featureSectionHeader}>
            <div className={styles.featureIcon}>💻</div>
            <h2>Digital Resource Management</h2>
            <p>Tools for managing e-books, digital media, and electronic resources</p>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3>E-book Management</h3>
              <p>Catalog, organize, and provide access to your e-book collection through a unified interface.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Digital Media Support</h3>
              <p>Manage audiobooks, videos, and other digital media with specialized metadata fields.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>License Tracking</h3>
              <p>Track license agreements, usage limits, and renewal dates for digital resources.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Integrated Discovery</h3>
              <p>Provide a single search interface for both physical and digital resources.</p>
            </div>
          </div>

          <div className={styles.featureShowcase}>
            <div className={styles.featureShowcaseContent}>
              <h3>Comprehensive Digital Collection Management</h3>
              <p>Our digital resource tools help you manage the complexities of electronic content:</p>
              <ul className={styles.featureList}>
                <li>Integration with major e-book providers</li>
                <li>Usage statistics and analytics</li>
                <li>Secure access controls</li>
                <li>Support for various digital formats</li>
                <li>Authentication integration with library cards</li>
              </ul>
            </div>
            <div className={styles.featureShowcaseImage}>
              <Image 
                src="/images/features/digital-resources.jpg" 
                alt="Digital Resource Management" 
                width={550} 
                height={350}
                className={styles.showcaseImg}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Section */}
      <section id="analytics" className={`${styles.featureSection} ${styles.altBackground}`}>
        <div className={styles.container}>
          <div className={styles.featureSectionHeader}>
            <div className={styles.featureIcon}>📊</div>
            <h2>Analytics & Reporting</h2>
            <p>Data-driven insights to optimize your library operations</p>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3>Custom Reports</h3>
              <p>Create and save custom reports for circulation, collection usage, patron activity, and more.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Visual Dashboards</h3>
              <p>Monitor key metrics with interactive dashboards and visualizations.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Collection Analysis</h3>
              <p>Analyze collection usage patterns to inform acquisition and weeding decisions.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Scheduled Reports</h3>
              <p>Schedule automatic report generation and distribution to stakeholders.</p>
            </div>
          </div>

          <div className={styles.featureShowcase}>
            <div className={styles.featureShowcaseImage}>
              <Image 
                src="/images/features/analytics-dashboard.jpg" 
                alt="Analytics Dashboard" 
                width={550} 
                height={350}
                className={styles.showcaseImg}
              />
            </div>
            <div className={styles.featureShowcaseContent}>
              <h3>Data-Driven Decision Making</h3>
              <p>Our analytics tools transform your library data into actionable insights:</p>
              <ul className={styles.featureList}>
                <li>Export capabilities in multiple formats (PDF, Excel, CSV)</li>
                <li>Trend analysis with historical data comparison</li>
                <li>Predictive analytics for collection development</li>
                <li>Budget allocation and ROI analysis</li>
                <li>Compliance reporting for funding requirements</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Administration Section */}
      <section id="admin" className={styles.featureSection}>
        <div className={styles.container}>
          <div className={styles.featureSectionHeader}>
            <div className={styles.featureIcon}>⚙️</div>
            <h2>System Administration</h2>
            <p>Powerful tools for configuring and managing your library system</p>
          </div>

          <div className={styles.featureGrid}>
            <div className={styles.featureCard}>
              <h3>User Management</h3>
              <p>Create and manage staff accounts with role-based permissions and access controls.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>System Configuration</h3>
              <p>Customize system settings, workflows, and policies to match your library's needs.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Integration Tools</h3>
              <p>Connect with external systems like student information systems, payment processors, and more.</p>
            </div>

            <div className={styles.featureCard}>
              <h3>Data Management</h3>
              <p>Backup, restore, and manage your library data with powerful administrative tools.</p>
            </div>
          </div>

          <div className={styles.featureShowcase}>
            <div className={styles.featureShowcaseContent}>
              <h3>Complete System Control</h3>
              <p>Our administration tools give you full control over your library system:</p>
              <ul className={styles.featureList}>
                <li>Granular permission settings</li>
                <li>Customizable workflows and approval processes</li>
                <li>System status monitoring and alerts</li>
                <li>API access for custom integrations</li>
                <li>Comprehensive audit logging</li>
              </ul>
            </div>
            <div className={styles.featureShowcaseImage}>
              <Image 
                src="/images/features/admin-panel.jpg" 
                alt="Administration Panel" 
                width={550} 
                height={350}
                className={styles.showcaseImg}
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.ctaSection}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2>Ready to transform your library operations?</h2>
            <p>See how LibraryOS can help your institution streamline workflows and enhance services.</p>
            <div className={styles.ctaButtons}>
              
              <Link href="/contact" className={styles.secondaryButton}>
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
    </>
  );
}

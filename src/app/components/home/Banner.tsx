// src/components/home/Banner.tsx
import Link from 'next/link';
import Image from 'next/image';
import styles from './Banner.module.css';

export default function Banner() {
  return (
    <section className={styles.banner}>
      <div className={styles.container}>
        <div className={styles.bannerContent}>
          <div className={styles.bannerText}>
            <h1>Modern Library Management System</h1>
            <p>
              Streamline your library operations with our comprehensive, AI-powered inventory 
              management solution. Perfect for libraries and bookstores of all sizes.
            </p>
            <div className={styles.bannerButtons}>
              <Link href="/auth/register" className={styles.primaryButton}>
                Get Started
              </Link>

            </div>
          </div>
          <div className={styles.bannerImage}>
            <Image 
              src="/images/library-hero.jpg" 
              alt="Library Management System" 
              width={600}
              height={400}
              className={styles.heroImage}
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}

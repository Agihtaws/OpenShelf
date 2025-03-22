// src/components/home/Features.tsx
import Image from 'next/image';
import styles from './Features.module.css';

const features = [
  {
    icon: "/icons/catalog.svg",
    title: "Comprehensive Catalog",
    description: "Manage your entire collection with detailed metadata, advanced search capabilities, and easy organization."
  },
  {
    icon: "/icons/transaction.svg",
    title: "Seamless Transactions",
    description: "Handle check-outs, returns, reservations, and sales with an intuitive and efficient process."
  },
  {
    icon: "/icons/analytics.svg",
    title: "Insightful Analytics",
    description: "Gain valuable insights into circulation patterns, popular titles, and inventory performance."
  },
  {
    icon: "/icons/users.svg",
    title: "User Management",
    description: "Create and manage user accounts with different permission levels and personalized experiences."
  },
  {
    icon: "/icons/mobile.svg",
    title: "Mobile Friendly",
    description: "Access your inventory system from anywhere with our responsive design optimized for all devices."
  },
  {
    icon: "/icons/security.svg",
    title: "Secure & Reliable",
    description: "Rest easy knowing your data is protected with industry-standard security measures."
  }
];

export default function Features() {
  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <h2>Powerful Features for Modern Libraries</h2>
          <p>Everything you need to run an efficient library or bookstore</p>
        </div>
        
        <div className={styles.featureGrid}>
          {features.map((feature, index) => (
            <div key={index} className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <Image 
                  src={feature.icon} 
                  alt={feature.title} 
                  width={40} 
                  height={40} 
                />
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

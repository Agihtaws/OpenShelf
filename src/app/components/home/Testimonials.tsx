// src/components/home/Testimonials.tsx
import Image from 'next/image';
import styles from './Testimonials.module.css';

const testimonials = [
  {
    quote: "LibraryOS has transformed how we manage our university library. The AI recommendations have increased student engagement by 40%.",
    author: "Dr. Sarah Johnson",
    role: "Head Librarian, State University",
    avatar: "/images/testimonials/avatar1.jpg"
  },
  {
    quote: "As a small independent bookstore, we needed an affordable system that could handle both inventory and sales. This platform exceeded our expectations.",
    author: "Michael Chen",
    role: "Owner, Cornerstone Books",
    avatar: "/images/testimonials/avatar2.jpg"
  },
  {
    quote: "The analytics capabilities alone have been worth the investment. We've optimized our purchasing decisions based on what our community wants to read.",
    author: "Lisa Rodriguez",
    role: "Director, Metro Public Library",
    avatar: "/images/testimonials/avatar3.jpg"
  }
];

export default function Testimonials() {
  return (
    <section className={styles.testimonials}>
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <h2>What Our Users Say</h2>
          <p>Trusted by libraries and bookstores worldwide</p>
        </div>
        
        <div className={styles.testimonialGrid}>
          {testimonials.map((testimonial, index) => (
            <div key={index} className={styles.testimonialCard}>
              <div className={styles.quote}>"</div>
              <p className={styles.testimonialText}>{testimonial.quote}</p>
              <div className={styles.testimonialAuthor}>
                <Image 
                  src={testimonial.avatar} 
                  alt={testimonial.author} 
                  width={50} 
                  height={50} 
                  className={styles.authorAvatar}
                />
                <div className={styles.authorInfo}>
                  <h4>{testimonial.author}</h4>
                  <p>{testimonial.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

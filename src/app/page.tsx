// src/app/page.tsx
import Banner from '@/app/components/home/Banner';
import Features from '@/app/components/home/Features';
import TrendingBooks from '@/app/components/home/TrendingBooks';
import Testimonials from '@/app/components/home/Testimonials';
import Navbar from '@/app/components/layout/Navbar';
import Footer from '@/app/components/layout/Footer';

// Export a default function called Home
export default function Home() {
  return (
    <main>
      <Navbar />
      <Banner />
      <Features />
      <TrendingBooks />
      <Testimonials />
      <Footer />
    </main>
  );
}

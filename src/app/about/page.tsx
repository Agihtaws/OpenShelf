// src/app/about/page.tsx
import Image from 'next/image';
import Link from 'next/link';
import Navbar from '@/app/components/layout/Navbar';
import styles from './about.module.css';
import Footer from '../components/layout/Footer';

export default function AboutPage() {
  return (
    <>
    <Navbar />
    <main className={styles.aboutPage}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.container}>
          <div className={styles.heroContent}>
            <h1>About LibraryOS</h1>
            <p>Building the future of library management systems</p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className={styles.mission}>
        <div className={styles.container}>
          <div className={styles.missionContent}>
            <div className={styles.missionText}>
              <h2>Our Mission</h2>
              <p className={styles.lead}>
                We're on a mission to empower libraries and knowledge institutions with technology that enhances their ability to serve communities.
              </p>
              <p>
                Founded in 2022, LibraryOS was born from a simple observation: libraries are evolving rapidly, but the software they rely on isn't keeping pace. Our team of librarians, developers, and design specialists came together to create a solution that addresses the real challenges faced by modern libraries.
              </p>
              <p>
                We believe that libraries are essential community hubs that deserve powerful, intuitive tools to manage their resources efficiently. By combining cutting-edge technology with deep library science expertise, we've built a platform that transforms how libraries operate in the digital age.
              </p>
            </div>
            <div className={styles.missionImage}>
              <Image 
                src="/images/about/mission.jpg" 
                alt="Library interior with modern technology" 
                width={500} 
                height={350}
                className={styles.roundedImage}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className={styles.values}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our Core Values</h2>
          
          <div className={styles.valuesGrid}>
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>📚</div>
              <h3>Knowledge Access</h3>
              <p>We believe everyone deserves equal access to information and knowledge resources.</p>
            </div>
            
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🔍</div>
              <h3>Innovation</h3>
              <p>We constantly explore new technologies to solve traditional library challenges.</p>
            </div>
            
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🤝</div>
              <h3>Partnership</h3>
              <p>We work alongside libraries as partners, not just as software providers.</p>
            </div>
            
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🛠️</div>
              <h3>Craftsmanship</h3>
              <p>We build our software with attention to detail and commitment to quality.</p>
            </div>
            
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🌍</div>
              <h3>Community</h3>
              <p>We support the broader mission of libraries as vital community resources.</p>
            </div>
            
            <div className={styles.valueCard}>
              <div className={styles.valueIcon}>🔒</div>
              <h3>Security</h3>
              <p>We prioritize the security and privacy of library data and patron information.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className={styles.team}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our Leadership Team</h2>
          <p className={styles.sectionSubtitle}>
            Meet the experts behind LibraryOS
          </p>
          
          <div className={styles.teamGrid}>
            {teamMembers.map((member, index) => (
              <div key={index} className={styles.teamMember}>
                <div className={styles.teamMemberImage}>
                  <Image 
                    src={member.image} 
                    alt={member.name} 
                    width={200} 
                    height={200}
                    className={styles.memberPhoto}
                  />
                </div>
                <h3>{member.name}</h3>
                <p className={styles.teamMemberRole}>{member.role}</p>
                <p className={styles.teamMemberBio}>{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className={styles.timeline}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our Journey</h2>
          
          <div className={styles.timelineContainer}>
            {milestones.map((milestone, index) => (
              <div key={index} className={styles.timelineItem}>
                <div className={styles.timelineDot}></div>
                <div className={styles.timelineContent}>
                  <div className={styles.timelineYear}>{milestone.year}</div>
                  <h3>{milestone.title}</h3>
                  <p>{milestone.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Partners Section */}
      <section className={styles.partners}>
        <div className={styles.container}>
          <h2 className={styles.sectionTitle}>Our Partners & Clients</h2>
          <p className={styles.sectionSubtitle}>
            Trusted by leading libraries and institutions
          </p>
          
          <div className={styles.partnersGrid}>
            {partners.map((partner, index) => (
              <div key={index} className={styles.partnerLogo}>
                <Image 
                  src={partner.logo} 
                  alt={partner.name} 
                  width={150} 
                  height={80}
                  style={{ objectFit: 'contain' }}
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className={styles.cta}>
        <div className={styles.container}>
          <div className={styles.ctaContent}>
            <h2>Ready to transform your library?</h2>
            <p>Join hundreds of institutions already using LibraryOS to enhance their operations.</p>
            <div className={styles.ctaButtons}>
              <Link href="/contact" className={styles.primaryButton}>
                Contact Us
              </Link>
             
            </div>
          </div>
        </div>
      </section>
    </main>

    <Footer />
    </>
  );
}

// Data
const teamMembers = [
  {
    name: "Dr. Eleanor Chen",
    role: "Founder & CEO",
    bio: "Former head librarian with 15+ years of experience in academic libraries. PhD in Library Science from Harvard University.",
    image: "/images/about/team/eleanor.jpg"
  },
  {
    name: "Michael Rodriguez",
    role: "Chief Technology Officer",
    bio: "Software architect with experience at Google and Microsoft. Led development of multiple cloud-based enterprise systems.",
    image: "/images/about/team/michael.jpg"
  },
  {
    name: "Dr. James Wilson",
    role: "Chief Library Officer",
    bio: "20+ years in library administration. Previously directed collection development for a major university library system.",
    image: "/images/about/team/james.jpg"
  },
  {
    name: "Sarah Johnson",
    role: "Head of Product",
    bio: "Expert in UX design with special focus on accessibility. Previously worked with the Library of Congress digital initiatives.",
    image: "/images/about/team/sarah.jpg"
  }
];

const milestones = [
  {
    year: "2022",
    title: "Foundation",
    description: "LibraryOS was founded by a team of librarians and technologists with a vision to modernize library management systems."
  },
  {
    year: "2023",
    title: "First Release",
    description: "Launched our core platform with inventory management and circulation features, serving our first 10 library clients."
  },
  {
    year: "2024",
    title: "Digital Expansion",
    description: "Introduced digital collection management capabilities and expanded to serve 100+ libraries across the country."
  },
  {
    year: "2025",
    title: "AI Integration",
    description: "Implemented artificial intelligence for advanced cataloging, recommendations, and predictive analytics."
  }
];

const partners = [
  {
    name: "National Library Association",
    logo: "/images/about/partners/nla.png"
  },
  {
    name: "State University System",
    logo: "/images/about/partners/university.png"
  },
  {
    name: "Metropolitan Library Network",
    logo: "/images/about/partners/metro.png"
  },
  {
    name: "Digital Archives Consortium",
    logo: "/images/about/partners/archives.png"
  },
  {
    name: "Global Library Initiative",
    logo: "/images/about/partners/global.png"
  },
  {
    name: "Education First Foundation",
    logo: "/images/about/partners/education.png"
  }
];

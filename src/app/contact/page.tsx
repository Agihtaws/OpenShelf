// src/app/contact/page.tsx
"use client";

import { useState, FormEvent, ChangeEvent } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Navbar from '@/app/components/layout/Navbar';
import styles from './contact.module.css';
import Footer from '../components/layout/Footer';

interface FormData {
  name: string;
  email: string;
  subject: string;
  message: string;
  department: string;
  general?: string;
}

export default function ContactPage() {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    email: '',
    subject: '',
    message: '',
    department: 'general'
  });

  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    // Clear error when user types
    if (errors[name as keyof FormData]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name as keyof FormData];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = "Name is required";
    }
    
    if (!formData.email.trim()) {
      newErrors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "Email is invalid";
    }
    
    if (!formData.subject.trim()) {
      newErrors.subject = "Subject is required";
    }
    
    if (!formData.message.trim()) {
      newErrors.message = "Message is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setSubmitted(true);
      // Reset form
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: '',
        department: 'general'
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      setErrors({
        ...errors,
        general: "Failed to send message. Please try again later."
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
    <Navbar />
    <main className={styles.contactPage}>
      <div className={styles.heroSection}>
        <div className={styles.container}>
          <h1>Contact Us</h1>
          <p>We're here to help with any questions about our library management system.</p>
        </div>
      </div>

      <div className={styles.contactSection}>
        <div className={styles.container}>
          <div className={styles.contactGrid}>
            <div className={styles.contactInfo}>
              <h2>Get In Touch</h2>
              <p>
                Have questions about our services? Need technical support? 
                We're here to help! Fill out the form and we'll get back to you as soon as possible.
              </p>
              
              <div className={styles.contactMethods}>
                <div className={styles.contactMethod}>
                  <div className={styles.contactIcon}>
                    <Image 
                      src="/icons/email.svg" 
                      alt="Email" 
                      width={24} 
                      height={24} 
                    />
                  </div>
                  <div className={styles.contactDetails}>
                    <h3>Email Us</h3>
                    <p>support@libraryos.com</p>
                    <p>For general inquiries: info@libraryos.com</p>
                  </div>
                </div>
                
                <div className={styles.contactMethod}>
                  <div className={styles.contactIcon}>
                    <Image 
                      src="/icons/phone.svg" 
                      alt="Phone" 
                      width={24} 
                      height={24} 
                    />
                  </div>
                  <div className={styles.contactDetails}>
                    <h3>Call Us</h3>
                    <p>+1 (555) 123-4567</p>
                    <p>Mon-Fri, 9:00 AM - 5:00 PM EST</p>
                  </div>
                </div>
                
                <div className={styles.contactMethod}>
                  <div className={styles.contactIcon}>
                    <Image 
                      src="/icons/location.svg" 
                      alt="Location" 
                      width={24} 
                      height={24} 
                    />
                  </div>
                  <div className={styles.contactDetails}>
                    <h3>Visit Us</h3>
                    <p>123 Library Street</p>
                    <p>Boston, MA 02108</p>
                  </div>
                </div>
              </div>
              
              <div className={styles.socialLinks}>
                <h3>Connect With Us</h3>
                <div className={styles.socialIcons}>
                  <a href="https://twitter.com/libraryos" target="_blank" rel="noopener noreferrer" className={styles.socialIcon}>
                    <Image 
                      src="/icons/twitter.svg" 
                      alt="Twitter" 
                      width={20} 
                      height={20} 
                    />
                  </a>
                  <a href="https://facebook.com/libraryos" target="_blank" rel="noopener noreferrer" className={styles.socialIcon}>
                    <Image 
                      src="/icons/facebook.svg" 
                      alt="Facebook" 
                      width={20} 
                      height={20} 
                    />
                  </a>
                  <a href="https://linkedin.com/company/libraryos" target="_blank" rel="noopener noreferrer" className={styles.socialIcon}>
                    <Image 
                      src="/icons/linkedin.svg" 
                      alt="LinkedIn" 
                      width={20} 
                      height={20} 
                    />
                  </a>
                  <a href="https://instagram.com/libraryos" target="_blank" rel="noopener noreferrer" className={styles.socialIcon}>
                    <Image 
                      src="/icons/instagram.svg" 
                      alt="Instagram" 
                      width={20} 
                      height={20} 
                    />
                  </a>
                </div>
              </div>
            </div>
            
            <div className={styles.contactForm}>
              {submitted ? (
                <div className={styles.successMessage}>
                  <div className={styles.successIcon}>✓</div>
                  <h2>Message Sent!</h2>
                  <p>
                    Thank you for contacting us. We've received your message and will get back to you shortly.
                  </p>
                  <button 
                    className={styles.sendAgainButton}
                    onClick={() => setSubmitted(false)}
                  >
                    Send Another Message
                  </button>
                </div>
              ) : (
                <>
                  <h2>Send Us a Message</h2>
                  
                  {errors.general && (
                    <div className={styles.errorAlert}>
                      {errors.general}
                    </div>
                  )}
                  
                  <form onSubmit={handleSubmit}>
                    <div className={styles.formGroup}>
                      <label htmlFor="name">Full Name *</label>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        className={errors.name ? styles.inputError : ''}
                        placeholder="Enter your name"
                      />
                      {errors.name && <span className={styles.errorText}>{errors.name}</span>}
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="email">Email Address *</label>
                      <input
                        type="email"
                        id="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={errors.email ? styles.inputError : ''}
                        placeholder="Enter your email"
                      />
                      {errors.email && <span className={styles.errorText}>{errors.email}</span>}
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="department">Department</label>
                      <select
                        id="department"
                        name="department"
                        value={formData.department}
                        onChange={handleInputChange}
                      >
                        <option value="general">General Inquiry</option>
                        <option value="technical">Technical Support</option>
                        <option value="sales">Sales</option>
                        <option value="billing">Billing</option>
                        <option value="feedback">Feedback</option>
                      </select>
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="subject">Subject *</label>
                      <input
                        type="text"
                        id="subject"
                        name="subject"
                        value={formData.subject}
                        onChange={handleInputChange}
                        className={errors.subject ? styles.inputError : ''}
                        placeholder="Enter message subject"
                      />
                      {errors.subject && <span className={styles.errorText}>{errors.subject}</span>}
                    </div>
                    
                    <div className={styles.formGroup}>
                      <label htmlFor="message">Message *</label>
                      <textarea
                        id="message"
                        name="message"
                        rows={5}
                        value={formData.message}
                        onChange={handleInputChange}
                        className={errors.message ? styles.inputError : ''}
                        placeholder="Type your message here..."
                      ></textarea>
                      {errors.message && <span className={styles.errorText}>{errors.message}</span>}
                    </div>
                    
                    <button 
                      type="submit" 
                      className={styles.submitButton}
                      disabled={submitting}
                    >
                      {submitting ? 'Sending...' : 'Send Message'}
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className={styles.faqSection}>
        <div className={styles.container}>
          <h2>Frequently Asked Questions</h2>
          <div className={styles.faqGrid}>
            {faqs.map((faq, index) => (
              <div key={index} className={styles.faqItem}>
                <h3>{faq.question}</h3>
                <p>{faq.answer}</p>
              </div>
            ))}
          </div>
          
        </div>
      </div>
    </main>
    
    <Footer />
    </>
  );
}

const faqs = [
  {
    question: "How do I reset my password?",
    answer: "You can reset your password by clicking the 'Forgot Password' link on the login page. You'll receive an email with instructions to create a new password."
  },
  {
    question: "Can I integrate LibraryOS with my existing systems?",
    answer: "Yes, LibraryOS offers API integration with many popular library management systems. Contact our technical support team for details on specific integrations."
  },
  {
    question: "Is there a mobile app available?",
    answer: "Yes, we offer mobile apps for both iOS and Android. You can download them from the respective app stores by searching for 'LibraryOS'."
  },
  {
    question: "How secure is my library data?",
    answer: "We implement industry-standard security measures including encryption, regular backups, and strict access controls to ensure your data remains secure."
  }
];

// src/app/auth/forgot-password/page.tsx
"use client";

import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import styles from './forgot-password.module.css';
import { auth } from '../../../firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    if (!email.trim()) {
      setError('Please enter your email address');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Define custom action code settings to redirect to your custom reset page
      const actionCodeSettings = {
        // Use localhost:3000 for local development
        url: `http://localhost:3000/auth/reset-password`,
        handleCodeInApp: true
      };

      // Send password reset email with custom redirect
      await sendPasswordResetEmail(auth, email, actionCodeSettings);
      
      // Show success message
      setResetSent(true);
      setMessage('Password reset email sent! Check your inbox for instructions.');
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setError(err.message || 'Failed to send reset email. Please try again later.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className={styles.forgotPasswordPage}>
      <div className={styles.container}>
        <div className={styles.forgotPasswordCard}>
          <div className={styles.formHeader}>
            <Link href="/" className={styles.logo}>
              <span className={styles.logoText}>LibraryOS</span>
            </Link>
            <h1>Reset Password</h1>
            <p>Enter your email address, and we'll send you a link to reset your password.</p>
          </div>

          {resetSent ? (
            <div className={styles.resetSuccess}>
              <div className={styles.successMessage}>
                {message}
              </div>
              <div className={styles.resetInstructions}>
                <h3>Next steps:</h3>
                <ol>
                  <li>Check your email inbox (and spam folder)</li>
                  <li>Click the password reset link in the email</li>
                  <li>Create a new password when prompted</li>
                </ol>
              </div>
              <button 
                onClick={() => router.push('/auth/login')}
                className={styles.resetButton}
              >
                Return to Login
              </button>
            </div>
          ) : (
            <>
              {error && <div className={styles.errorMessage}>{error}</div>}
              
              <form onSubmit={handleSubmit} className={styles.forgotPasswordForm}>
                <div className={styles.inputGroup}>
                  <label htmlFor="email">Email Address</label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Enter your email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className={styles.authInput}
                  />
                </div>

                <button 
                  type="submit" 
                  className={styles.resetButton}
                  disabled={loading}
                >
                  {loading ? (
                    <span className={styles.loadingSpinner}>
                      <span className={styles.loadingDot}></span>
                      <span className={styles.loadingDot}></span>
                      <span className={styles.loadingDot}></span>
                    </span>
                  ) : 'Send Reset Link'}
                </button>
              </form>

              <div className={styles.backToLogin}>
                <Link href="/auth/login" className={styles.authLink}>Back to Login</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

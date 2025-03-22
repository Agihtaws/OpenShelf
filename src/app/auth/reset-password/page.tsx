// src/app/auth/reset-password/page.tsx
"use client";

import { useState, FormEvent, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from '../forgot-password/forgot-password.module.css';
import { auth } from '../../../firebaseConfig';
import { 
  confirmPasswordReset, 
  verifyPasswordResetCode
} from 'firebase/auth';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [oobCode, setOobCode] = useState('');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [validatingCode, setValidatingCode] = useState(true);
  const [codeValid, setCodeValid] = useState(false);

  useEffect(() => {
    // Get oobCode (out-of-band code) from URL parameters
    const oobCodeParam = searchParams?.get('oobCode');
    
    if (oobCodeParam) {
      setOobCode(oobCodeParam);
      validateCode(oobCodeParam);
    } else {
      setValidatingCode(false);
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [searchParams]);

  const validateCode = async (code: string) => {
    try {
      // Verify the password reset code
      const email = await verifyPasswordResetCode(auth, code);
      setEmail(email);
      setCodeValid(true);
    } catch (err: any) {
      console.error('Code validation failed:', err);
      setError('Invalid or expired reset link. Please request a new password reset.');
    } finally {
      setValidatingCode(false);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    // Password validation
    if (!newPassword) {
      setError('Please enter a new password');
      return;
    }
    
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    // Additional password validations
    if (!/[A-Z]/.test(newPassword)) {
      setError('Password must contain at least one uppercase letter');
      return;
    }

    if (!/[0-9]/.test(newPassword)) {
      setError('Password must contain at least one number');
      return;
    }
    
    setLoading(true);
    setError('');
    setMessage('');

    try {
      // Complete the password reset process
      await confirmPasswordReset(auth, oobCode, newPassword);
      
      // Show success message
      setMessage('Your password has been successfully reset!');
      
      // Redirect to login page after 3 seconds
      setTimeout(() => {
        router.push('/auth/login');
      }, 3000);
    } catch (err: any) {
      console.error('Password reset failed:', err);
      setError(err.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (validatingCode) {
    return (
      <div className={styles.forgotPasswordPage}>
        <div className={styles.container}>
          <div className={styles.forgotPasswordCard}>
            <div className={styles.formHeader}>
              <span className={styles.logoText}>LibraryOS</span>
              <h1>Validating Reset Link</h1>
              <p>Please wait while we validate your reset link...</p>
            </div>
            <div className={styles.loadingContainer}>
              <div className={styles.loadingSpinnerLarge}></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.forgotPasswordPage}>
      <div className={styles.container}>
        <div className={styles.forgotPasswordCard}>
          <div className={styles.formHeader}>
            <Link href="/" className={styles.logo}>
              <span className={styles.logoText}>LibraryOS</span>
            </Link>
            <h1>Reset Your Password</h1>
            {email && <p>Create a new password for <strong>{email}</strong></p>}
          </div>

          {message && <div className={styles.successMessage}>{message}</div>}
          {error && <div className={styles.errorMessage}>{error}</div>}

          {codeValid ? (
            <form onSubmit={handleSubmit} className={styles.forgotPasswordForm}>
              <div className={styles.inputGroup}>
                <label htmlFor="newPassword">New Password</label>
                <input
                  type="password"
                  id="newPassword"
                  name="newPassword"
                  placeholder="Enter new password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className={styles.authInput}
                />
              </div>
              
              <div className={styles.inputGroup}>
                <label htmlFor="confirmPassword">Confirm New Password</label>
                <input
                  type="password"
                  id="confirmPassword"
                  name="confirmPassword"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className={styles.authInput}
                />
              </div>

              <div className={styles.passwordRequirements}>
                <h4>Password Requirements:</h4>
                <ul>
                  <li className={newPassword.length >= 6 ? styles.requirementMet : ''}>
                    At least 6 characters long
                  </li>
                  <li className={/[A-Z]/.test(newPassword) ? styles.requirementMet : ''}>
                    Contains at least one uppercase letter
                  </li>
                  <li className={/[0-9]/.test(newPassword) ? styles.requirementMet : ''}>
                    Contains at least one number
                  </li>
                </ul>
              </div>

              <button 
                type="submit" 
                className={styles.resetButton}
                disabled={loading}
              >
                {loading ? 'Updating Password...' : 'Reset Password'}
              </button>
            </form>
          ) : (
            <div className={styles.invalidToken}>
              <p>This password reset link is invalid or has expired.</p>
              <Link href="/auth/forgot-password" className={styles.requestNewLink}>
                Request a new password reset link
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

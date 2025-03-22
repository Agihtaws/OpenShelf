// src/app/auth/register/page.tsx
"use client";

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { db } from '../../../firebaseConfig';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  increment,
  Timestamp
} from 'firebase/firestore';
import { FiUser, FiMail, FiPhone, FiHome, FiDollarSign, FiCheck, FiAlertCircle, FiCopy, FiLock, FiEye, FiEyeOff, FiDownload } from 'react-icons/fi';
import styles from './register.module.css';
import { UpiQRCode, generateQrCodeDataUrl } from '@/utils/qrCodeGenerator';

interface User {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  libraryCardId: string;
  password: string;
  confirmPassword: string;
  feesPaid: boolean;
  receiveEmails: boolean;
  receiveTexts: boolean;
  createdAt: any;
  membershipType: string;
  membershipFee: number;
  membershipExpiry: any;
  agreeToTerms: boolean;
}

interface Payment {
  userId: string;
  userName: string;
  amount: number;
  paymentDate: any;
  paymentMethod: string;
  status: 'completed' | 'pending' | 'failed';
  transactionId?: string;
  orderId?: string;
  receiptId?: string;
  paymentType: string;
  membershipType: string;
  membershipPeriod: string;
  membershipExpiry: any;
}

interface QRCodeComponentProps {
  upiId: string;
  name: string;
  amount: number;
  description: string;
  orderId: string;
}

export default function RegisterPage() {
  const [formState, setFormState] = useState<Partial<User>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    password: '',
    confirmPassword: '',
    feesPaid: false,
    receiveEmails: false,
    receiveTexts: false,
    membershipType: 'standard',
    membershipFee: 500,
    agreeToTerms: false
  });
  
  const [emailExists, setEmailExists] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [isPhoneChecking, setIsPhoneChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newUser, setNewUser] = useState<User | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [paymentReceipt, setPaymentReceipt] = useState<Payment | null>(null);
  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    feedback: ''
  });
  
  // UPI payment states
  const [qrCodeData, setQrCodeData] = useState('');
  const [showQRModal, setShowQRModal] = useState(false);
  const [statusCheckIntervalId, setStatusCheckIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  
  // Admin payment settings
  const [adminPaymentSettings, setAdminPaymentSettings] = useState({
    upiId: 'swathiga581@okicici',
    accountName: 'SWATHIGA GANESH',
    accountNumber: '110040514790',
    ifscCode: 'CNRB0001209',
    bankName: 'CANARA BANK'
  });
  
  const emailTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const phoneTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchAdminPaymentSettings();
  }, []);

  // QR Code component using the UpiQRCode component
  const QRCodeComponent = ({ upiId, name, amount, description, orderId }: QRCodeComponentProps) => {
    return (
      <UpiQRCode 
        upiId={upiId}
        name={name}
        amount={amount}
        description={description}
        orderId={orderId}
        size={250}
      />
    );
  };

  // Fetch admin payment settings
  const fetchAdminPaymentSettings = async () => {
    try {
      const settingsRef = doc(db, "admin_settings", "payment_settings");
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setAdminPaymentSettings({
          upiId: data.upiId || 'swathiga581@okicici',
          accountName: data.accountName || 'SWATHIGA GANESH',
          accountNumber: data.accountNumber || '110040514790',
          ifscCode: data.ifscCode || 'CNRB0001209',
          bankName: data.bankName || 'CANARA BANK'
        });
      }
    } catch (error) {
      console.error("Error fetching admin payment settings:", error);
      // Use defaults if unable to fetch
    }
  };

  // Check if email exists in the database
  const checkEmailExists = async (email: string) => {
    if (!email || email.trim() === '') return;
    
    setIsEmailChecking(true);
    try {
      const emailQuery = query(
        collection(db, "users_customer"),
        where("email", "==", email.toLowerCase().trim())
      );
      
      const querySnapshot = await getDocs(emailQuery);
      setEmailExists(!querySnapshot.empty);
    } catch (error) {
      console.error("Error checking email:", error);
    } finally {
      setIsEmailChecking(false);
    }
  };

  // Check if phone exists in the database
  const checkPhoneExists = async (phone: string) => {
    if (!phone || phone.trim() === '') return;
    
    setIsPhoneChecking(true);
    try {
      const phoneQuery = query(
        collection(db, "users_customer"),
        where("phone", "==", phone.trim())
      );
      
      const querySnapshot = await getDocs(phoneQuery);
      setPhoneExists(!querySnapshot.empty);
    } catch (error) {
      console.error("Error checking phone:", error);
    } finally {
      setIsPhoneChecking(false);
    }
  };

  // Check password strength
  const checkPasswordStrength = (password: string) => {
    if (!password) {
      setPasswordStrength({ score: 0, feedback: '' });
      return;
    }

    // Check for minimum length
    if (password.length < 8) {
      setPasswordStrength({ 
        score: 1, 
        feedback: 'Password is too short' 
      });
      return;
    }

    let score = 0;
    
    // Check for lowercase letters
    if (/[a-z]/.test(password)) score += 1;
    
    // Check for uppercase letters
    if (/[A-Z]/.test(password)) score += 1;
    
    // Check for numbers
    if (/[0-9]/.test(password)) score += 1;
    
    // Check for special characters
    if (/[^A-Za-z0-9]/.test(password)) score += 1;

    // Determine feedback based on score
    let feedback = '';
    if (score < 2) {
      feedback = 'Weak password';
    } else if (score < 4) {
      feedback = 'Moderate password';
    } else {
      feedback = 'Strong password';
    }

    setPasswordStrength({ score, feedback });
  };

  // Check if passwords match
  const checkPasswordsMatch = () => {
    // Use a direct comparison of the values rather than relying on state
    const currentPassword = formState.password || '';
    const currentConfirmPassword = formState.confirmPassword || '';
    
    // Compare passwords
    const matches = currentPassword === currentConfirmPassword;
    
    // Update the state for other parts of the UI that might use it
    setPasswordsMatch(matches);
    
    // Clear any existing error message about passwords not matching
    if (errorMessage === "Passwords do not match.") {
      setErrorMessage('');
    }
  };
  
  // Generate a downloadable receipt
  const generateReceiptHTML = (receipt: Payment) => {
    const expiryDate = receipt.membershipExpiry.toDate ? 
      receipt.membershipExpiry.toDate().toLocaleDateString() : 
      new Date(receipt.membershipExpiry).toLocaleDateString();
    
    const issueDate = receipt.paymentDate.toDate ? 
      receipt.paymentDate.toDate().toLocaleDateString() : 
      new Date(receipt.paymentDate).toLocaleDateString();
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Library Membership Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 20px; color: #333; }
          .receipt { max-width: 800px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; }
          .header { text-align: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px; }
          .header h1 { margin: 0; color: #2c5282; }
          .library-info { margin-bottom: 20px; text-align: center; }
          .receipt-details { margin-bottom: 20px; }
          .receipt-row { display: flex; margin-bottom: 10px; }
          .receipt-label { width: 200px; font-weight: bold; }
          .receipt-value { flex-grow: 1; }
          .payment-details { margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px; }
          .footer { margin-top: 30px; font-size: 12px; text-align: center; color: #666; }
          .important { font-weight: bold; color: #2c5282; }
          .membership-details { background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .receipt-id { font-size: 14px; color: #666; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="receipt">
          <div class="header">
            <h1>OpenShelf Library</h1>
            <p class="receipt-id">Receipt ID: ${receipt.receiptId}</p>
          </div>
          
          <div class="library-info">
            <p>123 Library Street, Thanjavur, TN 612001</p>
            <p>Phone: 0123-456789 | Email: info@openshelf-library.com</p>
          </div>
          
          <div class="receipt-details">
            <h2>Membership Receipt</h2>
            
            <div class="receipt-row">
              <div class="receipt-label">Member Name:</div>
              <div class="receipt-value">${receipt.userName}</div>
            </div>
            
            <div class="receipt-row">
              <div class="receipt-label">Payment Date:</div>
              <div class="receipt-value">${issueDate}</div>
            </div>
            
            <div class="receipt-row">
              <div class="receipt-label">Payment Method:</div>
              <div class="receipt-value">${receipt.paymentMethod}</div>
            </div>
            
            <div class="receipt-row">
              <div class="receipt-label">Transaction ID:</div>
              <div class="receipt-value">${receipt.transactionId}</div>
            </div>
          </div>
          
          <div class="membership-details">
            <h3>Membership Details</h3>
            
            <div class="receipt-row">
              <div class="receipt-label">Membership Type:</div>
              <div class="receipt-value">Standard</div>
            </div>
            
            <div class="receipt-row">
              <div class="receipt-label">Membership Period:</div>
              <div class="receipt-value">${receipt.membershipPeriod}</div>
            </div>
            
            <div class="receipt-row">
              <div class="receipt-label">Valid Until:</div>
              <div class="receipt-value" class="important">${expiryDate}</div>
            </div>
          </div>
          
          <div class="payment-details">
            <div class="receipt-row">
              <div class="receipt-label">Amount Paid:</div>
              <div class="receipt-value" class="important">₹${receipt.amount.toFixed(2)}</div>
            </div>
          </div>
          
          <div class="footer">
            <p>Thank you for becoming a member of OpenShelf Library!</p>
            <p>This receipt serves as proof of your membership payment. Please keep it for your records.</p>
            <p>For any inquiries, please contact our customer support at support@openshelf-library.com</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Function to download receipt
  const downloadReceipt = () => {
    if (!paymentReceipt) return;
    
    const receiptHTML = generateReceiptHTML(paymentReceipt);
    const blob = new Blob([receiptHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `library_receipt_${paymentReceipt.receiptId}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined;
    
    setFormState(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    // Check email after user stops typing
    if (name === 'email') {
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
      
      emailTimeoutRef.current = setTimeout(() => {
        checkEmailExists(value);
      }, 500);
    }
    
    // Check phone after user stops typing
    if (name === 'phone') {
      if (phoneTimeoutRef.current) {
        clearTimeout(phoneTimeoutRef.current);
      }
      
      phoneTimeoutRef.current = setTimeout(() => {
        checkPhoneExists(value);
      }, 500);
    }

    // Check password strength
    if (name === 'password') {
      checkPasswordStrength(value);
    }

    // Check password matching immediately
    if (name === 'password' || name === 'confirmPassword') {
      // Use setTimeout to ensure state is updated before checking
      setTimeout(() => {
        checkPasswordsMatch();
      }, 0);
    }
  };

  // Generate the next library card ID
  const generateLibraryCardId = async (): Promise<string> => {
    try {
      // Get the counter document
      const counterRef = doc(db, "counters", "library_cards");
      const counterDoc = await getDoc(counterRef);
      
      let nextId = 1;
      
      if (counterDoc.exists()) {
        // Increment the counter
        nextId = (counterDoc.data().current || 0) + 1;
        await updateDoc(counterRef, {
          current: nextId
        });
      } else {
        // Create the counter document if it doesn't exist
        await setDoc(counterRef, {
          current: nextId
        });
      }
      
      // Format the ID with leading zeros
      return `LIB-ID-CARD-${nextId.toString().padStart(5, '0')}`;
    } catch (error) {
      console.error("Error generating library card ID:", error);
      throw error;
    }
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (emailExists) {
      setErrorMessage("An account with this email already exists.");
      return;
    }
    
    if (phoneExists) {
      setErrorMessage("An account with this phone number already exists.");
      return;
    }

    // Use direct comparison instead of passwordsMatch state
    if (formState.password !== formState.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    if (passwordStrength.score < 2) {
      setErrorMessage("Password is too weak. Please choose a stronger password.");
      return;
    }

    if (!formState.agreeToTerms) {
      setErrorMessage("You must agree to the terms and conditions.");
      return;
    }
    
    setErrorMessage('');
    
    // Show payment modal
    setShowPaymentModal(true);
  };

  // Initiate UPI payment with QR code
  const initiateUPIPayment = async () => {
    try {
      setIsVerifying(true);
      
      // Generate a unique order ID
      const orderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      setCurrentOrderId(orderId);
      
      // Generate QR code data URL
      const qrData = await generateQrCodeDataUrl(
        adminPaymentSettings.upiId,
        adminPaymentSettings.accountName,
        formState.membershipFee || 500,
        "Library Membership Fee",
        orderId
      );
      
      if (qrData) {
        setQrCodeData(qrData);
        setShowQRModal(true);
        
        // Create a pending payment record in Firestore
        const pendingPaymentRef = await addDoc(collection(db, "pending_payments"), {
          orderId: orderId,
          amount: formState.membershipFee,
          customerName: `${formState.firstName} ${formState.lastName}`,
          customerEmail: formState.email,
          customerPhone: formState.phone,
          status: 'pending',
          createdAt: serverTimestamp(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes expiry
        });
        
        // Start polling for payment status
        startPaymentStatusCheck(orderId, pendingPaymentRef.id);
      } else {
        throw new Error("Failed to generate QR code");
      }
    } catch (error) {
      console.error("Error initiating UPI payment:", error);
      alert("An error occurred while setting up the payment. Please try again.");
      setIsVerifying(false);
    }
  };

  // Poll for payment status
  const startPaymentStatusCheck = (orderId: string, pendingPaymentId: string) => {
    // Clear any existing interval
    if (statusCheckIntervalId) {
      clearInterval(statusCheckIntervalId);
    }
    
    const interval = setInterval(async () => {
      try {
        // Check if payment has been marked as completed
        const paymentRef = doc(db, "pending_payments", pendingPaymentId);
        const paymentDoc = await getDoc(paymentRef);
        
        if (paymentDoc.exists()) {
          const paymentData = paymentDoc.data();
          
          if (paymentData.status === 'completed') {
            clearInterval(interval);
            // Payment successful
            createUserAfterPayment(paymentData.transactionId || orderId);
            setShowQRModal(false);
            setPaymentStatus('completed');
          } else if (paymentData.status === 'failed') {
            clearInterval(interval);
            alert("Payment failed. Please try again.");
            setIsVerifying(false);
            setShowQRModal(false);
            setPaymentStatus('failed');
          }
          // For 'pending' status, continue polling
        }
      } catch (error) {
        console.error("Error checking payment status:", error);
        // Don't clear interval on error, keep trying
      }
    }, 3000); // Check every 3 seconds
    
    setStatusCheckIntervalId(interval);
    
    // Set a timeout to stop polling after 15 minutes
    setTimeout(() => {
      clearInterval(interval);
      setStatusCheckIntervalId(null);
      // Only show timeout message if payment is still pending
      if (paymentStatus === 'pending') {
        setShowQRModal(false);
        setIsVerifying(false);
        alert("Payment session timed out. Please try again.");
      }
    }, 15 * 60 * 1000); // 15 minutes
  };

  // QR Code Modal Component
  const QRCodeModal = () => {
    return (
      <div className={styles.modalOverlay}>
        <div className={styles.qrModal}>
          <div className={styles.modalHeader}>
            <h2>Scan QR Code to Pay</h2>
            <button 
              className={styles.closeButton}
              onClick={() => {
                if (statusCheckIntervalId) {
                  clearInterval(statusCheckIntervalId);
                  setStatusCheckIntervalId(null);
                }
                setShowQRModal(false);
                setIsVerifying(false);
              }}
              disabled={isSubmitting}
            >
              ×
            </button>
          </div>
          
          <div className={styles.modalContent}>
            <div className={styles.qrContainer}>
              {qrCodeData ? (
                <img src={qrCodeData} alt="UPI QR Code" className={styles.qrImage} />
              ) : (
                <QRCodeComponent
                  upiId={adminPaymentSettings.upiId}
                  name={adminPaymentSettings.accountName}
                  amount={formState.membershipFee || 500}
                  description="Library Membership Fee"
                  orderId={currentOrderId}
                />
              )}
            </div>
            <p className={styles.qrInstructions}>
              <strong>Amount: ₹{formState.membershipFee}.00</strong><br/>
              <strong>Order ID: {currentOrderId}</strong><br/><br/>
              1. Open any UPI app (Google Pay, PhonePe, BHIM, etc.)<br/>
              2. Scan this QR code<br/>
              3. Complete the payment<br/>
              4. Wait for automatic confirmation (DO NOT close this window)
            </p>
            <div className={styles.loadingIndicator}>
              <div className={styles.spinner}></div>
              Waiting for payment confirmation...
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Create user after successful payment
  const createUserAfterPayment = async (paymentId: string) => {
    try {
      setIsSubmitting(true);
      
      // Calculate membership expiry (1 year from now)
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      
      // Generate library card ID
      const libraryCardId = await generateLibraryCardId();
      
      // Create new user object
      const newUserData: User = {
        ...formState as Omit<User, 'libraryCardId' | 'createdAt' | 'membershipExpiry'>,
        libraryCardId,
        createdAt: serverTimestamp(),
        membershipExpiry: Timestamp.fromDate(expiryDate),
        email: formState.email?.toLowerCase().trim() || '',
        phone: formState.phone?.trim() || '',
        feesPaid: true  // Since payment is completed
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, "users_customer"), newUserData);
      
      // Create receipt ID
      const receiptId = `RCT-${Date.now().toString().substring(5)}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
      
      // Create payment record
      const paymentData: Payment = {
        userId: docRef.id,
        userName: `${formState.firstName} ${formState.lastName}`,
        amount: formState.membershipFee || 0,
        paymentDate: Timestamp.now(),
        paymentMethod: 'UPI via QR Code',
        status: 'completed',
        transactionId: paymentId,
        orderId: currentOrderId,
        receiptId: receiptId,
        paymentType: 'membership',
        membershipType: formState.membershipType || 'standard',
        membershipPeriod: 'Annual (1 year)',
        membershipExpiry: Timestamp.fromDate(expiryDate)
      };
      
      await addDoc(collection(db, "payments"), paymentData);
      
      // Save receipt for download
      setPaymentReceipt(paymentData);
      
      // Update counter for statistics
      const statsRef = doc(db, "counters", "patron_stats");
      const statsDoc = await getDoc(statsRef);
      
      if (statsDoc.exists()) {
        await updateDoc(statsRef, {
          total: increment(1),
          lastUpdated: serverTimestamp()
        });
      } else {
        await setDoc(statsRef, {
          total: 1,
          lastUpdated: serverTimestamp()
        });
      }
      
      // Add activity log
      await addDoc(collection(db, "activity_logs"), {
        userId: docRef.id,
        userEmail: formState.email,
        userLibraryId: libraryCardId,
        actionType: "user_registration",
        timestamp: serverTimestamp(),
        details: {
          membershipType: formState.membershipType,
          paymentMethod: 'UPI via QR Code',
          amount: formState.membershipFee,
          registeredBy: 'Self'
        }
      });
      
      // Set success state
      setSuccessMessage("Registration successful!");
      setNewUser(newUserData);
      setShowModal(true);
      setShowPaymentModal(false);
      
      // Reset form
      setFormState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        zip: '',
        password: '',
        confirmPassword: '',
        feesPaid: false,
        receiveEmails: false,
        receiveTexts: false,
        membershipType: 'standard',
        membershipFee: 500,
        agreeToTerms: false
      });
      
      setIsSubmitting(false);
      setIsVerifying(false);
      
    } catch (error) {
      console.error("Error adding user:", error);
      setErrorMessage("Failed to register. Please try again.");
      setIsSubmitting(false);
      setIsVerifying(false);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowModal(false);
    setNewUser(null);
    
    // Redirect to login page
    router.push('/auth/login');
  };

  // Clean up timeouts
  useEffect(() => {
    return () => {
      if (emailTimeoutRef.current) {
        clearTimeout(emailTimeoutRef.current);
      }
      if (phoneTimeoutRef.current) {
        clearTimeout(phoneTimeoutRef.current);
      }
      if (statusCheckIntervalId) {
        clearInterval(statusCheckIntervalId);
      }
    };
  }, [statusCheckIntervalId]);

  return (
    <div className={styles.registerPage}>
      <div className={styles.pageHeader}>
        <h1>Create Account</h1>
        <p>Join our library community</p>
      </div>
      
      {errorMessage && <div className={styles.errorMessage}>{errorMessage}</div>}
      {successMessage && <div className={styles.successMessage}>{successMessage}</div>}
      
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.registerForm}>
          <div className={styles.formGrid}>
            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Personal Information</h2>
              
              <div className={styles.formGroup}>
                <label htmlFor="firstName" className={styles.formLabel}>
                  First Name <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <FiUser className={styles.inputIcon} />
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formState.firstName}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                  />
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="lastName" className={styles.formLabel}>
                  Last Name <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <FiUser className={styles.inputIcon} />
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formState.lastName}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                  />
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="email" className={styles.formLabel}>
                  Email <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <FiMail className={styles.inputIcon} />
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formState.email}
                    onChange={handleInputChange}
                    className={`${styles.formInput} ${emailExists ? styles.inputError : ''}`}
                    required
                  />
                                    {isEmailChecking && <div className={styles.checkingIndicator}>Checking...</div>}
                  {emailExists && (
                    <div className={styles.existsWarning}>
                      <FiAlertCircle /> This email is already registered
                    </div>
                  )}
                </div>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="phone" className={styles.formLabel}>
                  Phone Number <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <FiPhone className={styles.inputIcon} />
                  <input
                    type="tel"
                    id="phone"
                    name="phone"
                    value={formState.phone}
                    onChange={handleInputChange}
                    className={`${styles.formInput} ${phoneExists ? styles.inputError : ''}`}
                    required
                  />
                  {isPhoneChecking && <div className={styles.checkingIndicator}>Checking...</div>}
                  {phoneExists && (
                    <div className={styles.existsWarning}>
                      <FiAlertCircle /> This phone number is already registered
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <div className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Address</h2>
              
              <div className={styles.formGroup}>
                <label htmlFor="address" className={styles.formLabel}>
                  Street Address <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <FiHome className={styles.inputIcon} />
                  <input
                    type="text"
                    id="address"
                    name="address"
                    value={formState.address}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                  />
                </div>
              </div>
              
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label htmlFor="city" className={styles.formLabel}>
                    City <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formState.city}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="state" className={styles.formLabel}>
                    State <span className={styles.required}>*</span>
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formState.state}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                  />
                </div>
                </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="zip" className={styles.formLabel}>
                  ZIP Code <span className={styles.required}>*</span>
                </label>
                <input
                  type="text"
                  id="zip"
                  name="zip"
                  value={formState.zip}
                  onChange={handleInputChange}
                  className={styles.formInput}
                  required
                />
              </div>
            </div>
          </div>
          
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Account Security</h2>
            
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label htmlFor="password" className={styles.formLabel}>
                  Password <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <FiLock className={styles.inputIcon} />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formState.password}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    required
                    minLength={8}
                  />
                  <button 
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {formState.password && (
                  <div className={styles.passwordStrength}>
                    <div className={styles.strengthBar}>
                      <div 
                        className={styles.strengthFill} 
                        style={{ 
                          width: `${(passwordStrength.score / 4) * 100}%`,
                          backgroundColor: 
                            passwordStrength.score <= 1 ? '#e53e3e' : 
                            passwordStrength.score <= 2 ? '#dd6b20' : 
                            passwordStrength.score <= 3 ? '#d69e2e' : '#38a169'
                        }}
                      ></div>
                    </div>
                    <small className={styles.strengthText}>
                      {passwordStrength.feedback}
                    </small>
                  </div>
                )}
                <small className={styles.passwordHint}>Must be at least 8 characters with letters, numbers, and special characters</small>
              </div>
              
              <div className={styles.formGroup}>
                <label htmlFor="confirmPassword" className={styles.formLabel}>
                  Confirm Password <span className={styles.required}>*</span>
                </label>
                <div className={styles.inputWrapper}>
                  <FiLock className={styles.inputIcon} />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formState.confirmPassword}
                    onChange={handleInputChange}
                    className={`${styles.formInput} ${formState.confirmPassword && formState.password !== formState.confirmPassword ? styles.inputError : ''}`}
                    required
                  />
                  <button 
                    type="button"
                    className={styles.passwordToggle}
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <FiEyeOff /> : <FiEye />}
                  </button>
                </div>
                {formState.confirmPassword && (
                  <div className={styles.passwordMatchIndicator}>
                    {formState.password === formState.confirmPassword ? (
                      <div className={styles.passwordMatch}>
                        <FiCheck /> Passwords match
                      </div>
                    ) : (
                      <div className={styles.passwordMismatch}>
                        <FiAlertCircle /> Passwords do not match
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className={styles.formSection}>
            <h2 className={styles.sectionTitle}>Membership Details</h2>
            
            <div className={styles.feeDisplay}>
              <FiDollarSign />
              <span>Standard Membership Fee: </span>
              <strong>₹{formState.membershipFee}.00</strong>
            </div>
            
            <div className={styles.formGroup}>
              <div className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  id="receiveEmails"
                  name="receiveEmails"
                  checked={formState.receiveEmails}
                  onChange={handleInputChange}
                  className={styles.checkbox}
                />
                <label htmlFor="receiveEmails" className={styles.checkboxLabel}>
                  Receive email notifications about new books and events
                </label>
              </div>
            </div>
            
            <div className={styles.formGroup}>
              <div className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  id="receiveTexts"
                  name="receiveTexts"
                  checked={formState.receiveTexts}
                  onChange={handleInputChange}
                  className={styles.checkbox}
                />
                <label htmlFor="receiveTexts" className={styles.checkboxLabel}>
                  Receive text notifications about due dates and holds
                </label>
              </div>
            </div>
            
            <div className={styles.formGroup}>
              <div className={styles.checkboxWrapper}>
                <input
                  type="checkbox"
                  id="agreeToTerms"
                  name="agreeToTerms"
                  checked={formState.agreeToTerms}
                  onChange={handleInputChange}
                  className={styles.checkbox}
                  required
                />
                <label htmlFor="agreeToTerms" className={styles.checkboxLabel}>
                  I agree to the <Link href="/terms" className={styles.termsLink}>Terms and Conditions</Link> and <Link href="/privacy" className={styles.termsLink}>Privacy Policy</Link>
                </label>
              </div>
            </div>
          </div>
  
          <div className={styles.formActions}>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={() => router.push('/')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              style={{display: 'block', marginTop: '20px', backgroundColor: '#3498db', color: 'white', padding: '10px 20px'}}
              disabled={
                isSubmitting || 
                emailExists || 
                phoneExists || 
                (formState.confirmPassword && formState.password !== formState.confirmPassword) || 
                !formState.agreeToTerms
              }
            >
              {isSubmitting ? 'Processing...' : 'Register & Pay Membership Fee'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.paymentModal}>
            <div className={styles.modalHeader}>
              <h2>Complete Payment</h2>
              <button 
                className={styles.closeButton}
                onClick={() => {
                  if (!isSubmitting && !isVerifying) {
                    setShowPaymentModal(false);
                  }
                }}
                disabled={isSubmitting || isVerifying}
              >
                ×
              </button>
            </div>
            
            <div className={styles.modalContent}>
              <div className={styles.paymentDetails}>
                <div className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>Name:</span>
                  <span className={styles.paymentValue}>{formState.firstName} {formState.lastName}</span>
                </div>
                
                <div className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>Membership Type:</span>
                  <span className={styles.paymentValue}>
                    Standard
                  </span>
                </div>
                
                <div className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>Amount:</span>
                  <span className={styles.paymentAmount}>₹{formState.membershipFee}.00</span>
                </div>
              </div>
              
              <div className={styles.paymentMethods}>
                <div className={styles.paymentOptionsHeader}>
                  <h3>Payment Options</h3>
                </div>
                
                <div className={styles.paymentOptionsContainer}>
                  {/* UPI Gateway Option */}
                  <div className={styles.paymentOption}>
                    <h4>Pay with UPI</h4>
                    <p>Scan QR code with any UPI app (Google Pay, PhonePe, BHIM, Paytm, etc.)</p>
                    <button 
                      className={styles.upiButton}
                      onClick={initiateUPIPayment}
                      disabled={isVerifying}
                    >
                      {isVerifying ? 'Processing...' : 'Generate QR Code'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* QR Code Modal */}
      {showQRModal && <QRCodeModal />}
      
      {/* Registration Success Modal */}
      {showModal && newUser && paymentReceipt && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Registration Successful</h2>
              <button 
                className={styles.closeButton}
                onClick={handleModalClose}
              >
                &times;
              </button>
            </div>
            
            <div className={styles.modalBody}>
              <div className={styles.libraryCard}>
                <div className={styles.cardHeader}>
                  <h3>Library Card</h3>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardInfo}>
                    <p className={styles.cardName}>{newUser.firstName} {newUser.lastName}</p>
                    <p className={styles.cardId}>{newUser.libraryCardId}</p>
                    <p className={styles.cardIssued}>Issued: {new Date().toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              
              <div className={styles.credentialInfo}>
                <div className={styles.credentialItem}>
                  <span className={styles.credentialLabel}>Library Card ID:</span>
                  <span className={styles.credentialValue}>{newUser.libraryCardId}</span>
                </div>
                <p className={styles.credentialNote}>
                  Please save your Library Card ID. You'll need it to log in and check out books.
                </p>
                <div className={styles.paymentConfirmation}>
                  <div className={styles.paymentConfirmationIcon}>
                    <FiCheck />
                  </div>
                  <div className={styles.paymentConfirmationDetails}>
                    <h4>Payment Confirmed</h4>
                    <p>₹{paymentReceipt.amount} - Standard annual membership</p>
                    <p>Valid until: {paymentReceipt.membershipExpiry.toDate().toLocaleDateString()}</p>
                    <p>Method: {paymentReceipt.paymentMethod}</p>
                  </div>
                  
                  <button className={styles.downloadButton} onClick={downloadReceipt}>
                    <FiDownload /> Download Receipt
                  </button>

                  <p>You can also download your receipt from your <Link href="/settings" className={styles.settingsLink}>Settings</Link> page later.</p>
                </div>
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.modalButton}
                onClick={handleModalClose}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

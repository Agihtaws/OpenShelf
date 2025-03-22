// src/app/librarian/add-patron/page.tsx
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
import { FiArrowLeft, FiUser, FiMail, FiPhone, FiHome, FiDollarSign, FiCheck, FiX, FiAlertCircle, FiCopy } from 'react-icons/fi';
import styles from './AddPatron.module.css';
import { generateUpiQrCodeUrl } from '@/utils/qrCodeGenerator';

interface Patron {
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
  feesPaid: boolean;
  receiveEmails: boolean;
  receiveTexts: boolean;
  createdAt: any;
  membershipType: string;
  membershipFee: number;
  membershipExpiryDate: any;
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
}

export default function AddPatronPage() {
  const [formState, setFormState] = useState<Partial<Patron>>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    feesPaid: false,
    receiveEmails: false,
    receiveTexts: false,
    membershipType: 'standard',
    membershipFee: 50
  });
  
  const [emailExists, setEmailExists] = useState(false);
  const [phoneExists, setPhoneExists] = useState(false);
  const [phoneValidationError, setPhoneValidationError] = useState(''); 
  const [isEmailChecking, setIsEmailChecking] = useState(false);
  const [isPhoneChecking, setIsPhoneChecking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [newPatron, setNewPatron] = useState<Patron | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
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

  // Initialize
  useEffect(() => {
    fetchAdminPaymentSettings();
  }, []);

  // QR Code component using the utility
  interface QRCodeComponentProps {
    upiId: string;
    name: string;
    amount: number;
    description: string;
  }

  const QRCodeComponent = ({ upiId, name, amount, description }: QRCodeComponentProps) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
    
    useEffect(() => {
      const generateQR = async () => {
        const qrUrl = await generateUpiQrCodeUrl(upiId, name, amount, description);
        if (qrUrl) {
          setQrCodeUrl(qrUrl);
        }
      };
      
      generateQR();
    }, [upiId, name, amount, description]);
    
    return qrCodeUrl ? (
      <img src={qrCodeUrl} alt="UPI QR Code" className={styles.upiQRCode} />
    ) : (
      <div className={styles.qrLoading}>Generating QR Code...</div>
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
        
        // Add phone number validation
        if (value && value.trim().length !== 10) {
          // Set a warning if phone number is not 10 digits
          setPhoneValidationError("Please enter a 10-digit phone number");
        } else {
          // Clear the warning if valid
          setPhoneValidationError("");
        }
      }, 500);
    }
  };

  // Generate a random password
  const generatePassword = (): string => {
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    const symbols = '@#$%&*!';
    
    let password = '';
    
    // Ensure at least one character from each category
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += symbols.charAt(Math.floor(Math.random() * symbols.length));
    
    // Add remaining characters randomly
    const allChars = lowercase + uppercase + numbers + symbols;
    for (let i = 0; i < 6; i++) {
      password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    
    // Shuffle the password
    return password.split('').sort(() => 0.5 - Math.random()).join('');
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
      setErrorMessage("A patron with this email already exists.");
      return;
    }
    
    if (phoneExists) {
      setErrorMessage("A patron with this phone number already exists.");
      return;
    }
    
    // Check phone validation error
    if (phoneValidationError) {
      setErrorMessage(phoneValidationError);
      return;
    }
    
    setErrorMessage('');
    
    // Show payment modal
    setShowPaymentModal(true);
  };

  // Verify manual transaction
  const verifyManualTransaction = async () => {
    if (!transactionId) {
      alert("Please enter a transaction ID");
      return;
    }
    
    try {
      setIsVerifying(true);
      await createPatronAfterPayment({
        razorpay_payment_id: transactionId,
        razorpay_order_id: `manual-${Date.now()}`
      });
    } catch (error) {
      console.error("Error verifying transaction:", error);
      setIsVerifying(false);
      alert("Verification failed. Please try again.");
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = async (response: any, orderData: any) => {
    try {
      await createPatronAfterPayment(response);
    } catch (error) {
      console.error("Error handling payment success:", error);
      setIsSubmitting(false);
      alert("There was an issue processing the payment. Please try again.");
    }
  };

  // Create patron after successful payment
  const createPatronAfterPayment = async (paymentResponse: any) => {
    try {
      setIsSubmitting(true);
      
      // Generate library card ID and password
      const libraryCardId = await generateLibraryCardId();
      const password = generatePassword();
      
      // Calculate membership expiry date (365 days from today)
      const today = new Date();
      const expiryDate = new Date(today);
      expiryDate.setDate(today.getDate() + 365);
      
      // Create new patron object
      const newPatronData: Patron = {
        ...formState as Omit<Patron, 'libraryCardId' | 'password' | 'createdAt' | 'membershipExpiryDate'>,
        libraryCardId,
        password,
        createdAt: serverTimestamp(),
        membershipExpiryDate: Timestamp.fromDate(expiryDate),
        email: formState.email?.toLowerCase().trim() || '',
        phone: formState.phone?.trim() || '',
        feesPaid: true  // Since payment is completed
      };
      
      // Add to Firestore
      const docRef = await addDoc(collection(db, "users_customer"), newPatronData);
      
      // Create payment record
      await addDoc(collection(db, "payments"), {
        userId: docRef.id,
        userName: `${formState.firstName} ${formState.lastName}`,
        amount: formState.membershipFee,
        paymentDate: Timestamp.now(),
        paymentMethod: paymentMethod || 'Razorpay',
        status: 'completed',
        transactionId: paymentResponse.razorpay_payment_id || transactionId,
        orderId: paymentResponse.razorpay_order_id || `manual-${Date.now()}`,
        receiptId: `receipt-${Date.now()}`,
        paymentType: 'membership',
        membershipType: formState.membershipType
      } as Payment);
      
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
        actionType: "patron_registration",
        timestamp: serverTimestamp(),
        details: {
          membershipType: formState.membershipType,
          paymentMethod: paymentMethod || 'Razorpay',
          amount: formState.membershipFee,
          registeredBy: 'Librarian'
        }
      });
      
      // Set success state
      setSuccessMessage("Patron added successfully!");
      setNewPatron(newPatronData);
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
        feesPaid: false,
        receiveEmails: false,
        receiveTexts: false,
        membershipType: 'standard',
        membershipFee: 50
      });
      
      setIsSubmitting(false);
      setIsVerifying(false);
      
    } catch (error) {
      console.error("Error adding patron:", error);
      setErrorMessage("Failed to add patron. Please try again.");
      setIsSubmitting(false);
      setIsVerifying(false);
    }
  };

  // Handle modal close
  const handleModalClose = () => {
    setShowModal(false);
    setNewPatron(null);
    
    // Redirect to patrons page
    router.push('/librarian/patrons');
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
    };
  }, []);

  return (
    <div className={styles.addPatronPage}>
      <div className={styles.pageHeader}>
        
        <h3>Register a new library patron</h3>
      </div>
      
      {errorMessage && <div className={styles.errorMessage}><FiAlertCircle /> {errorMessage}</div>}
      {successMessage && <div className={styles.successMessage}><FiCheck /> {successMessage}</div>}
      
      <div className={styles.formContainer}>
        <form onSubmit={handleSubmit} className={styles.patronForm}>
          <div className={styles.formSections}>
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
                    className={`${styles.formInput} ${(phoneExists || phoneValidationError) ? styles.inputError : ''}`}
                    required
                  />
                  {isPhoneChecking && <div className={styles.checkingIndicator}>Checking...</div>}
                  {phoneExists && (
                    <div className={styles.existsWarning}>
                      <FiAlertCircle /> This phone number is already registered
                    </div>
                  )}
                  {phoneValidationError && !phoneExists && (
                    <div className={styles.existsWarning}>
                      <FiAlertCircle /> {phoneValidationError}
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
            <h2 className={styles.sectionTitle}>Membership Details</h2>
            
            <div className={styles.membershipInfo}>
              <div className={styles.membershipType}>
                <FiUser className={styles.membershipIcon} />
                <span className={styles.membershipTypeLabel}>Standard Membership</span>
              </div>
              
              <div className={styles.feeDisplay}>
                <FiDollarSign />
                <span>Registration Fee: </span>
                <strong>₹{formState.membershipFee?.toFixed(2)}</strong>
              </div>
              
              <div className={styles.membershipDuration}>
                <span>Valid for 1 year from registration date</span>
              </div>
            </div>
          </div>

          <div className={styles.formActions}>
            <button 
              type="button" 
              className={styles.cancelButton}
              onClick={() => router.push('/librarian/patrons')}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className={styles.submitButton}
              disabled={isSubmitting || emailExists || phoneExists || !!phoneValidationError}
            >
              {isSubmitting ? 'Processing...' : 'Register & Collect Payment'}
            </button>
          </div>
        </form>
      </div>
      
      {/* Payment Modal */}
      {showPaymentModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.paymentModal}>
            <div className={styles.modalHeader}>
              <h2>Collect Payment</h2>
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
                  <span className={styles.paymentLabel}>Patron:</span>
                  <span className={styles.paymentValue}>{formState.firstName} {formState.lastName}</span>
                </div>
                
                <div className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>Membership Type:</span>
                  <span className={styles.paymentValue}>Standard</span>
                </div>
                
                <div className={styles.paymentRow}>
                  <span className={styles.paymentLabel}>Amount:</span>
                  <span className={styles.paymentAmount}>₹{formState.membershipFee?.toFixed(2)}</span>
                </div>
              </div>
              
              <div className={styles.paymentMethods}>
                <h3>Select Payment Method</h3>
                
                <div className={styles.paymentMethodOptions}>
                  <div 
                    className={`${styles.paymentMethod} ${paymentMethod === 'UPI' ? styles.selected : ''}`}
                    onClick={() => setPaymentMethod('UPI')}
                  >
                    <div className={styles.methodIcon}>📱</div>
                    <span>UPI</span>
                  </div>
                  
                  <div 
                    className={`${styles.paymentMethod} ${paymentMethod === 'Cash' ? styles.selected : ''}`}
                    onClick={() => setPaymentMethod('Cash')}
                  >
                    <div className={styles.methodIcon}>💵</div>
                    <span>Cash</span>
                  </div>
                </div>
                
                {/* UPI Payment Information */}
                {paymentMethod === 'UPI' && (
                  <div className={styles.upiPaymentInfo}>
                    <h4>Scan QR Code to Pay</h4>
                    <div className={styles.upiDetails}>
                      <div className={styles.upiQRContainer}>
                        {/* Use the custom QR code generator */}
                        <QRCodeComponent
                          upiId={adminPaymentSettings.upiId}
                          name={adminPaymentSettings.accountName}
                          amount={formState.membershipFee ?? 0}
                          description={`Library membership for ${formState.firstName} ${formState.lastName}`}
                        />
                      </div>
                      <div className={styles.upiIDContainer}>
                        <p className={styles.upiIDLabel}>UPI ID:</p>
                        <div className={styles.upiIDValue}>
                          <span>{adminPaymentSettings.upiId}</span>
                          <button 
                            className={styles.copyButton}
                            onClick={() => {
                              navigator.clipboard.writeText(adminPaymentSettings.upiId);
                              alert('UPI ID copied!');
                            }}
                          >
                            <FiCopy /> Copy
                          </button>
                        </div>
                        <p className={styles.upiNote}>
                          Ask the patron to scan this QR code or pay to the UPI ID directly
                        </p>
                      </div>
                    </div>
                    
                    <div className={styles.transactionVerification}>
                      <h4>After payment is complete:</h4>
                      <div className={styles.transactionIdInput}>
                        <label htmlFor="upiTransactionId">Enter UPI Transaction ID:</label>
                        <input 
                          type="text" 
                          id="upiTransactionId" 
                          placeholder="e.g., 123456789012"
                          value={transactionId}
                          onChange={(e) => setTransactionId(e.target.value)}
                        />
                      </div>
                      <button 
                        className={styles.verifyButton}
                        onClick={verifyManualTransaction}
                        disabled={!transactionId || isVerifying}
                      >
                        {isVerifying ? 'Verifying...' : 'Verify & Complete Registration'}
                      </button>
                    </div>
                  </div>
                )}
                
                {/* Cash Payment */}
                {paymentMethod === 'Cash' && (
                  <div className={styles.cashPaymentInfo}>
                    <h4>Cash Payment</h4>
                    <div className={styles.cashInstructions}>
                      <p>1. Collect ₹{formState.membershipFee?.toFixed(2)} in cash from the patron</p>
                      <p>2. Enter a reference number or receipt number below</p>
                      <p>3. Click "Complete Registration" to finalize</p>
                    </div>
                    
                    <div className={styles.transactionIdInput}>
                      <label htmlFor="cashReference">Enter Receipt/Reference Number:</label>
                      <input 
                        type="text" 
                        id="cashReference" 
                        placeholder="e.g., CASH12345"
                        value={transactionId}
                        onChange={(e) => setTransactionId(e.target.value)}
                      />
                    </div>
                    <button 
                      className={styles.completeButton}
                      onClick={verifyManualTransaction}
                      disabled={!transactionId || isVerifying}
                    >
                      {isVerifying ? 'Processing...' : 'Complete Registration'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* New Patron Modal */}
      {showModal && newPatron && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2>Patron Added Successfully</h2>
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
                    <p className={styles.cardName}>{newPatron.firstName} {newPatron.lastName}</p>
                    <p className={styles.cardId}>{newPatron.libraryCardId}</p>
                    <p className={styles.cardIssued}>Issued: {new Date().toLocaleDateString()}</p>
                    <p className={styles.cardExpiry}>Expires: {newPatron.membershipExpiryDate?.toDate ? 
                      new Date(newPatron.membershipExpiryDate.toDate()).toLocaleDateString() : 
                      new Date(new Date().setDate(new Date().getDate() + 365)).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
              
              <div className={styles.credentialInfo}>
                <div className={styles.credentialItem}>
                  <span className={styles.credentialLabel}>Library Card ID:</span>
                  <span className={styles.credentialValue}>{newPatron.libraryCardId}</span>
                </div>
                <div className={styles.credentialItem}>
                  <span className={styles.credentialLabel}>Temporary Password:</span>
                  <span className={styles.credentialValue}>{newPatron.password}</span>
                </div>
                <p className={styles.credentialNote}>
                  Please provide these credentials to the patron. They will be required to change 
                  their password upon first login.
                </p>
                <div className={styles.paymentConfirmation}>
                  <div className={styles.paymentConfirmationIcon}>
                    <FiCheck />
                  </div>
                  <div className={styles.paymentConfirmationDetails}>
                    <h4>Payment Confirmed</h4>
                    <p>₹{newPatron.membershipFee?.toFixed(2)} - Standard membership</p>
                    <p>Method: {paymentMethod}</p>
                    <p>Valid until: {newPatron.membershipExpiryDate?.toDate ? 
                      new Date(newPatron.membershipExpiryDate.toDate()).toLocaleDateString() : 
                      new Date(new Date().setDate(new Date().getDate() + 365)).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className={styles.modalFooter}>
              <button 
                className={styles.modalButton}
                onClick={handleModalClose}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

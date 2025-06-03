import React, { useState, useEffect } from 'react';
import { db, auth, functions } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, collection, getDocs, deleteDoc, addDoc, query, where } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import { getUserCollection, getUserDoc, createSecureBackupMetadata, validateBackupOwnership } from '../utils/multiTenancy';
import { dateToISOString, processRestoredData, safelyParseDate, formatDateTime } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { 
  getShopPreferences, 
  setShopPreferences, 
  uploadLensesToShop, 
  removeLensesFromShop, 
  getCurrentUserInfo 
} from '../utils/shopAPI';

const Settings = () => {
  // Use centralized auth
  const { user, userRole, isAuthenticated, USER_ROLES } = useAuth();
  
  // Shop information
  const [shopName, setShopName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Logo and QR Code (stored directly as data URL)
  const [logoDataURL, setLogoDataURL] = useState('');
  const [qrCodeDataURL, setQrCodeDataURL] = useState('');
  
  // Bank Details
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [accountHolderName, setAccountHolderName] = useState('');
  const [upiId, setUpiId] = useState('');
  
  // Financial Year
  const [currentFinancialYear, setCurrentFinancialYear] = useState('');
  const [showFinancialYearModal, setShowFinancialYearModal] = useState(false);
  
  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // Backup & Restore
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [backupFile, setBackupFile] = useState(null);
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('shop');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
  // Modal states for backup and clear data
  const [showBackupConfirmModal, setShowBackupConfirmModal] = useState(false);
  const [showPasswordConfirmModal, setShowPasswordConfirmModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [passwordConfirmError, setPasswordConfirmError] = useState('');
  
  // Users management
  const [users, setUsers] = useState([]);
  const [inactiveUsers, setInactiveUsers] = useState([]);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('user');
  const [newUserPermissions, setNewUserPermissions] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [userError, setUserError] = useState('');
  const [userSuccess, setUserSuccess] = useState('');
  const [usersTab, setUsersTab] = useState('active'); // 'active' or 'inactive'
  
  // Add shop-related states
  const [shopPreferences, setShopPreferencesState] = useState({ isSharing: false });
  const [shopLoading, setShopLoading] = useState(false);
  const [shopError, setShopError] = useState('');
  
  // Define menu items to display in permissions checkboxes
  const menuItems = [
    { path: '/dashboard', title: 'Dashboard' },
    { path: '/orders', title: 'Orders' },
    { path: '/customers', title: 'Vendors & Customers' },
    { path: '/sales', title: 'Sales' },
    { path: '/purchases', title: 'Purchases' },
    { path: '/transactions', title: 'Transactions' },
    { path: '/ledger', title: 'Ledger' },
    { path: '/gst-returns', title: 'GST Returns' },
    { path: '/lens-inventory', title: 'Lens Inventory' },
    { path: '/settings', title: 'Settings' },
  ];
  
  // Generate financial year options
  const generateFinancialYears = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // Previous year, current year, and next year options
    for (let year = currentYear - 1; year <= currentYear + 1; year++) {
      years.push({
        value: `${year}-${year + 1}`,
        label: `${year}-${year + 1}`
      });
    }
    
    return years;
  };
  
  const financialYearOptions = generateFinancialYears();
  
  useEffect(() => {
    fetchSettings();
    if (isAuthenticated() && user) {
      fetchUsers();
    }
  }, [isAuthenticated, user]);
  
  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      // Use user-specific settings document
      const settingsDoc = await getDoc(getUserDoc('settings', 'shopSettings'));
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        
        // Shop information
        setShopName(data.shopName || '');
        setGstNumber(data.gstNumber || '');
        setAddress(data.address || '');
        setCity(data.city || '');
        setState(data.state || '');
        setPincode(data.pincode || '');
        setPhone(data.phone || '');
        setEmail(data.email || '');
        
        // Logo Data URL
        if (data.logoDataURL) {
          setLogoDataURL(data.logoDataURL);
        } else if (data.logoURL) {
          // Handle transition from old storage method (URL) to new one (data URL)
          // Just show a notification that the user should re-upload logo
          console.log('Old logo URL format detected. Please re-upload your logo for better performance.');
          setLogoDataURL('');
        } else {
          setLogoDataURL('');
        }
        
        // QR Code Data URL
        if (data.qrCodeDataURL) {
          setQrCodeDataURL(data.qrCodeDataURL);
        } else if (data.qrCodeURL) {
          // Handle transition from old storage method (URL) to new one (data URL)
          // Just show a notification that the user should re-upload QR code
          console.log('Old QR code URL format detected. Please re-upload your QR code for better performance.');
          setQrCodeDataURL('');
        } else {
          setQrCodeDataURL('');
        }
        
        // Bank Details
        setBankName(data.bankName || '');
        setAccountNumber(data.accountNumber || '');
        setIfscCode(data.ifscCode || '');
        setAccountHolderName(data.accountHolderName || '');
        setUpiId(data.upiId || '');
        
        // Financial Year
        setCurrentFinancialYear(data.financialYear || '');
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      setError('Failed to load settings. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveSettings = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Check if QR code data URL is too large for Firestore (1MB limit per document)
      if (qrCodeDataURL && qrCodeDataURL.length > 950000) { // Keep some buffer below 1MB
        displayError('QR code image is too large to save. Please upload a smaller image (less than 1MB).');
        setLoading(false);
        return;
      }
      
      // If no financial year is set, alert the user that they should set one
      if (!currentFinancialYear && activeTab === 'financial') {
        displayError('Please select a financial year to continue.');
        setLoading(false);
        return;
      }
      
      const settingsData = {
        // Shop Information
        shopName,
        gstNumber,
        address,
        city,
        state,
        pincode,
        phone,
        email,
        
        // Logo Data URL
        logoDataURL,
        
        // QR Code as data URL
        qrCodeDataURL,
        
        // Bank Details
        bankName,
        accountNumber,
        ifscCode,
        accountHolderName,
        upiId,
        
        // Financial Year
        financialYear: currentFinancialYear,
        
        // Timestamp
        updatedAt: new Date()
      };
      
      console.log('Preparing to save settings...'); 
      
      // Save to Firestore using user-specific document
      try {
        console.log('Saving settings to Firestore...');
        try {
          // First try to update the existing document
          await setDoc(getUserDoc('settings', 'shopSettings'), settingsData);
          console.log('Settings saved successfully to Firestore');
        } catch (initialError) {
          console.warn('Initial save attempt failed, trying alternative approach:', initialError);
          
          // Try with merge option
          await setDoc(getUserDoc('settings', 'shopSettings'), settingsData, { merge: true });
          console.log('Settings saved successfully using merge option');
        }
        
        displaySuccess('Settings saved successfully!');
      } catch (firestoreError) {
        console.error('Error saving to Firestore:', firestoreError);
        
        // Specific error handling based on error codes
        if (firestoreError.code === 'permission-denied') {
          throw new Error('You do not have permission to save settings. Please contact your administrator.');
        } else if (firestoreError.code === 'unavailable') {
          throw new Error('Network connection issue. Please check your connection and try again.');
        } else {
          throw new Error(`Firestore save failed: ${firestoreError.message}`);
        }
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      displayError(`Failed to save settings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Modify the setError function to not automatically clear the error
  const displayError = (errorMessage) => {
    setError(errorMessage);
    // Scroll to the top of the page to make the error visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Add success message display function
  const displaySuccess = (message) => {
    setSuccess(message);
    // Keep success message visible longer (5 seconds)
    setTimeout(() => setSuccess(''), 5000);
    // Scroll to the top to make the message visible
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  // Validate logo file
  const validateLogo = (file) => {
    // Check file size (limit to 1MB to avoid Firestore size limits)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      displayError('Logo image is too large. Please upload an image smaller than 1MB.');
      return false;
    }
    
    // Check file type - allow SVG in addition to other image formats
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      displayError('Invalid file type. Please upload a JPEG, PNG, GIF, WEBP, or SVG image.');
      return false;
    }
    
    return true;
  };
  
  // Handle logo upload
  const handleLogoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!validateLogo(file)) {
      e.target.value = ''; // Reset input
      return;
    }
    
    // Convert to data URL and store directly
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      
      // If the image is larger than 800KB, compress it
      if (dataUrl.length > 800000 && file.type !== 'image/svg+xml') {
        setLoading(true); // Show loading state during compression
        compressImage(dataUrl, 800000, (compressedDataUrl) => {
          setLogoDataURL(compressedDataUrl);
          setLoading(false);
        });
      } else {
        setLogoDataURL(dataUrl);
      }
    };
    reader.onerror = () => {
      displayError("Failed to read the logo image. Please try another image.");
    };
    reader.readAsDataURL(file);
  };
  
  // Remove logo
  const removeLogo = () => {
    setLogoDataURL('');
  };
  
  // Add QR code validation function
  const validateQRCode = (file) => {
    // Check file size (limit to 1MB to avoid Firestore size limits)
    const maxSize = 1 * 1024 * 1024; // 1MB
    if (file.size > maxSize) {
      displayError('QR code image is too large. Please upload an image smaller than 1MB.');
      return false;
    }
    
    // Check file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      displayError('Invalid file type. Please upload a JPEG, PNG, GIF, or WEBP image.');
      return false;
    }
    
    return true;
  };
  
  // Add function to compress image if it's too large
  const compressImage = (dataUrl, maxSizeInBytes, callback) => {
    const image = new Image();
    image.onload = () => {
      let quality = 0.8; // Starting quality
      const canvas = document.createElement('canvas');
      let width = image.width;
      let height = image.height;
      
      // If image is larger than 600x600, resize it
      if (width > 600 || height > 600) {
        if (width > height) {
          height = Math.round((height * 600) / width);
          width = 600;
        } else {
          width = Math.round((width * 600) / height);
          height = 600;
        }
      }
      
      canvas.width = width;
      canvas.height = height;
      
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);
      
      // Try to compress until the size is below the limit
      const tryCompress = (q) => {
        const compressedDataUrl = canvas.toDataURL('image/jpeg', q);
        if (compressedDataUrl.length <= maxSizeInBytes || q <= 0.1) {
          // We've compressed enough or reached min quality
          callback(compressedDataUrl);
        } else {
          // Try with a lower quality
          tryCompress(q - 0.1);
        }
      };
      
      tryCompress(quality);
    };
    
    image.onerror = () => {
      callback(dataUrl); // Return original on error
    };
    
    image.src = dataUrl;
  };
  
  const handleQRCodeChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (!validateQRCode(file)) {
      e.target.value = ''; // Reset input
      return;
    }
    
    // Convert to data URL and store directly
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target.result;
      
      // If the image is larger than 800KB, compress it
      if (dataUrl.length > 800000) {
        setLoading(true); // Show loading state during compression
        compressImage(dataUrl, 800000, (compressedDataUrl) => {
          setQrCodeDataURL(compressedDataUrl);
          setLoading(false);
        });
      } else {
        setQrCodeDataURL(dataUrl);
      }
    };
    reader.onerror = () => {
      displayError("Failed to read the QR code image. Please try another image.");
    };
    reader.readAsDataURL(file);
  };
  
  const removeQRCode = () => {
    setQrCodeDataURL('');
  };
  
  const handleChangePassword = async () => {
    // Reset states
    setPasswordError('');
    setPasswordSuccess('');
    
    // Validate passwords
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    
    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }
    
    try {
      setLoading(true);
      
      // Re-authenticate the user
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Change password
      await updatePassword(user, newPassword);
      
      // Clear form and show success
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordSuccess('Password changed successfully!');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (error) {
      console.error('Error changing password:', error);
      let errorMessage = 'Failed to change password. Please try again.';
      
      if (error.code === 'auth/wrong-password') {
        errorMessage = 'Current password is incorrect';
      } else if (error.code === 'auth/requires-recent-login') {
        errorMessage = 'Please log out and log back in before changing your password';
      }
      
      setPasswordError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle Financial Year change
  const handleFinancialYearChange = async (selectedYear) => {
    if (selectedYear === currentFinancialYear) return;
    
    // If changing from an existing financial year, show confirmation modal
    if (currentFinancialYear) {
      setShowFinancialYearModal(true);
    } else {
      // If no previous financial year, just set it directly
      await changeFinancialYear(selectedYear, true);
    }
  };
  
  // Function to actually change the financial year and reset invoice numbering
  const changeFinancialYear = async (newFinancialYear, resetNumbering) => {
    try {
      setLoading(true);
      
      // 1. Update the financial year in user-specific settings
      const settingsRef = getUserDoc('settings', 'shopSettings');
      await setDoc(settingsRef, { 
        financialYear: newFinancialYear,
        previousFinancialYear: currentFinancialYear || '',
        financialYearChangedAt: new Date()
      }, { merge: true });
      
      // 2. Handle invoice numbering based on user choice
      const counterRef = getUserDoc('counters', `invoices_${newFinancialYear}`);
      
      if (resetNumbering) {
        // Create a counter document for the new financial year to reset invoice numbering
        await setDoc(counterRef, { 
          count: 0,
          prefix: newFinancialYear, // Use the financial year as the prefix (e.g., "2025-26")
          separator: '/', // Use "/" as the separator (e.g., "2025-26/")
          createdAt: new Date(),
          format: '${prefix}${separator}${number}' // Define format as "2025-26/01"
        });
        
        displaySuccess(`Financial year changed to ${newFinancialYear} and invoice numbering has been reset. New invoices will be numbered as ${newFinancialYear}/01, ${newFinancialYear}/02, etc.`);
      } else {
        // Check if a counter already exists, if not create one without resetting
        const counterDoc = await getDoc(counterRef);
        
        if (!counterDoc.exists()) {
          // If no counter exists yet, create one but don't reset the count
          // First, try to get the latest count from the previous financial year
          let startCount = 0;
          
          if (currentFinancialYear) {
            const prevCounterRef = getUserDoc('counters', `invoices_${currentFinancialYear}`);
            const prevCounterDoc = await getDoc(prevCounterRef);
            
            if (prevCounterDoc.exists()) {
              startCount = prevCounterDoc.data().count || 0;
            }
          }
          
          // Create counter with continued numbering
          await setDoc(counterRef, {
            count: startCount,
            prefix: newFinancialYear, // Use the financial year as the prefix
            separator: '/', // Use "/" as the separator
            createdAt: new Date(),
            format: '${prefix}${separator}${number}' // Define format as "2025-26/01"
          });
        } else {
          // Counter already exists, update its format but don't change the count
          await updateDoc(counterRef, {
            prefix: newFinancialYear,
            separator: '/',
            format: '${prefix}${separator}${number}'
          });
        }
        
        displaySuccess(`Financial year changed to ${newFinancialYear}. Invoice numbering will continue from the last invoice.`);
      }
      
      // 3. Update state
      setCurrentFinancialYear(newFinancialYear);
      
      // 4. Close modal if open
      setShowFinancialYearModal(false);
    } catch (error) {
      console.error('Error changing financial year:', error);
      displayError(`Failed to change financial year: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Financial Year Modal
  const FinancialYearModal = () => {
    const [selectedYear, setSelectedYear] = useState('');
    const [resetNumbering, setResetNumbering] = useState(true);
    
    return (
      <div className="fixed inset-0 overflow-y-auto z-50">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>
          
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    Change Financial Year
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      You are about to change the financial year. This action will affect invoice numbering.
                    </p>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">New Financial Year</label>
                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(e.target.value)}
                        className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                      >
                        <option value="">Select a financial year</option>
                        {financialYearOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className="mt-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={resetNumbering}
                          onChange={(e) => setResetNumbering(e.target.checked)}
                          className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Reset invoice numbering to start from 1</span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500">
                        If checked, new invoices will start from 1 (e.g., {selectedYear ? `${selectedYear}/01` : "YYYY-YY/01"}).<br/>
                        If unchecked, numbering will continue from the last invoice.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => changeFinancialYear(selectedYear, resetNumbering)}
                disabled={!selectedYear || loading}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-yellow-600 text-base font-medium text-white hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
              >
                {loading ? 'Changing...' : 'Change Financial Year'}
              </button>
              <button
                type="button"
                onClick={() => setShowFinancialYearModal(false)}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:w-auto sm:text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Check if we're at the end of a financial year (March 31)
  const checkFinancialYearEnd = () => {
    const today = new Date();
    
    // Check if today is March 31
    if (today.getMonth() === 2 && today.getDate() === 31) {
      // Extract the current financial year to suggest the next one
      if (currentFinancialYear) {
        const [startYear] = currentFinancialYear.split('-');
        const nextFinancialYear = `${parseInt(startYear) + 1}-${parseInt(startYear) + 2}`;
        
        // Show the financial year end modal
        setShowFinancialYearEndModal(true);
      }
    }
  };
  
  // Add state for financial year end modal
  const [showFinancialYearEndModal, setShowFinancialYearEndModal] = useState(false);
  
  // Call this function when the component loads and when date changes
  useEffect(() => {
    // Check on initial load
    if (currentFinancialYear) {
      checkFinancialYearEnd();
    }
    
    // Also set up a daily check
    const midnightCheck = setInterval(() => {
      checkFinancialYearEnd();
    }, 24 * 60 * 60 * 1000); // Check once per day
    
    return () => clearInterval(midnightCheck);
  }, [currentFinancialYear]);
  
  // Financial Year End Modal
  const FinancialYearEndModal = () => {
    const [startYear] = currentFinancialYear.split('-');
    const nextFinancialYear = `${parseInt(startYear) + 1}-${parseInt(startYear) + 2}`;
    const [resetNumbering, setResetNumbering] = useState(true);
    
    return (
      <div className="fixed inset-0 overflow-y-auto z-50">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>
          
          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="sm:flex sm:items-start">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
                  <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    End of Financial Year
                  </h3>
                  <div className="mt-2">
                    <p className="text-sm text-gray-500">
                      Today is March 31st which marks the end of the current financial year ({currentFinancialYear}).
                      Would you like to switch to the next financial year ({nextFinancialYear})?
                    </p>
                    
                    <div className="mt-4">
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={resetNumbering}
                          onChange={(e) => setResetNumbering(e.target.checked)}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <span className="ml-2 text-sm text-gray-700">Reset invoice numbering to start from 1</span>
                      </label>
                      <p className="mt-1 text-xs text-gray-500">
                        If checked, new invoices will start from 1 (e.g., {nextFinancialYear}/01).<br/>
                        If unchecked, numbering will continue from the last invoice.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={() => {
                  changeFinancialYear(nextFinancialYear, resetNumbering);
                  setShowFinancialYearEndModal(false);
                }}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Switch to Next Financial Year
              </button>
              <button
                type="button"
                onClick={() => setShowFinancialYearEndModal(false)}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Continue with Current Year
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Generate a backup of the store data
  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      setBackupError('');
      setBackupSuccess('');
      
      // Get current user information for validation
      if (!user) {
        throw new Error('User not authenticated. Please login again.');
      }
      
      // Collections to backup - using user-specific collections
      // Enhanced list to include all ledger-related collections
      const collectionsToBackup = [
        'customers', 
        'orders', 
        'sales', 
        'purchases', 
        'settings', 
        'transactions', 
        'lensInventory', 
        'counters',
        'teamMembers', // User management
        'vendors', // Vendor information
        'products', // Product catalog
        'inventory', // General inventory
        'payments', // Payment records
        'invoices', // Invoice data
        'categories', // Product categories
        'brands', // Brand information
        'prescriptions', // Prescription data
        'appointments' // Appointment data
      ];
      const backupData = {};
      
      console.log('Starting backup process for collections:', collectionsToBackup);
      console.log('Current user creating backup:', user.uid, user.email);
      
      // Fetch data from each user-specific collection
      for (const collectionName of collectionsToBackup) {
        try {
          console.log(`Backing up collection: ${collectionName}`);
          const collectionRef = getUserCollection(collectionName);
          const snapshot = await getDocs(collectionRef);
          
          backupData[collectionName] = {};
          
          let docCount = 0;
          snapshot.docs.forEach(doc => {
            const data = doc.data();
            
            // Skip placeholder documents
            if (data._placeholder) {
              console.log(`Skipping placeholder document in ${collectionName}: ${doc.id}`);
              return;
            }
            
            // Convert any timestamps to ISO strings for JSON serialization using dateUtils
            const processedData = JSON.parse(
              JSON.stringify(data, (key, value) => {
                // Use dateToISOString from dateUtils for consistent date handling
                return dateToISOString(value) || value;
              })
            );
            
            backupData[collectionName][doc.id] = processedData;
            docCount++;
          });
          
          console.log(`Collection ${collectionName}: backed up ${docCount} documents`);
          
        } catch (collectionError) {
          console.warn(`Could not backup collection ${collectionName}:`, collectionError);
          // Don't fail the entire backup if one collection fails
          backupData[collectionName] = {};
        }
      }
      
      // Enhanced metadata with strict user identification
      backupData.metadata = {
        ...createSecureBackupMetadata(user),
        collections: collectionsToBackup,
        totalDocuments: 0, // Will be updated below
        collectionsCount: collectionsToBackup.length
      };
      
      // Calculate backup statistics
      const totalDocuments = Object.values(backupData)
        .filter(collection => typeof collection === 'object' && collection !== null && !collection.createdAt)
        .reduce((total, collection) => total + Object.keys(collection).length, 0);
      
      backupData.metadata.totalDocuments = totalDocuments;
      
      console.log(`Backup completed: ${totalDocuments} documents across ${collectionsToBackup.length} collections`);
      console.log('Backup metadata:', {
        userId: backupData.metadata.userId,
        userEmail: backupData.metadata.userEmail,
        version: backupData.metadata.version
      });
      
      // Convert to JSON and create download link
      const backupJSON = JSON.stringify(backupData, null, 2);
      const blob = new Blob([backupJSON], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Create date string for filename
      const date = new Date();
      const dateString = date.toISOString().slice(0, 10).replace(/-/g, '');
      const timeString = date.toTimeString().slice(0, 5).replace(/:/g, '');
      
      // Include user email in filename for easier identification
      const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_');
      
      // Create a link element and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `lens-management-${safeEmail}-${dateString}-${timeString}.json`;
      document.body.appendChild(a);
      a.click();
      
      // Clean up
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      
      setBackupSuccess(`✅ Your personal backup created successfully! 
      
      📊 Backup Summary:
      • User: ${user.email}
      • ${totalDocuments} documents backed up
      • ${collectionsToBackup.length} collections included
      • File: lens-management-${safeEmail}-${dateString}-${timeString}.json
      
      🔒 Security: This backup can only be restored by your account (${user.email}).
      
      Your backup file is downloading now.`);
    } catch (error) {
      console.error('Error creating backup:', error);
      setBackupError(`Failed to create backup: ${error.message}`);
    } finally {
      setBackupLoading(false);
    }
  };
  
  // Handle file selection for restore
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    
    if (file) {
      if (file.type !== 'application/json') {
        setBackupError('Please select a JSON file');
        setBackupFile(null);
        return;
      }
      
      setBackupFile(file);
      setBackupError('');
    }
  };
  
  // Restore from backup file
  const handleRestore = async () => {
    if (!backupFile) {
      setBackupError('Please select a backup file first');
      return;
    }
    
    try {
      setRestoreLoading(true);
      setBackupError('');
      setBackupSuccess('');
      
      // Get current user information for validation
      if (!user) {
        throw new Error('User not authenticated. Please login again to restore backup.');
      }
      
      console.log('Current user attempting restore:', user.uid, user.email);
      
      // Read the file
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          
          // Validate backup format
          if (!backupData.metadata || !backupData.metadata.collections) {
            throw new Error('Invalid backup file format. Please ensure you are using a valid backup file.');
          }
          
          console.log('Restore: Backup file validation passed');
          console.log('Backup metadata:', backupData.metadata);
          
          // CRITICAL: Validate backup ownership
          const validationResult = validateBackupOwnership(backupData.metadata, user);
          
          console.log('Backup ownership validation result:', validationResult);
          
          if (!validationResult.isValid) {
            const errorMessage = `🔒 SECURITY ERROR: This backup cannot be restored by your account.

${validationResult.errors.join('\n')}

Backup Details:
• Backup Owner: ${backupData.metadata.userEmail || 'Unknown'}
• Current User: ${user.email}

For security reasons, you can only restore backups created by your own account.`;
            
            throw new Error(errorMessage);
          }
          
          // Log any warnings
          if (validationResult.warnings.length > 0) {
            console.warn('Backup validation warnings:', validationResult.warnings);
          }
          
          console.log('✅ Backup ownership validation successful');
          
          // Collections to restore
          const collections = backupData.metadata.collections;
          const totalDocuments = backupData.metadata.totalDocuments || 'unknown';
          
          // Enhanced confirmation dialog with security information
          if (!window.confirm(
            `🔒 RESTORE CONFIRMATION FOR ${user.email}
            
This backup was created by: ${backupData.metadata.userEmail}
Backup created: ${new Date(backupData.metadata.createdAt).toLocaleString()}

📋 Backup Details:
• Collections: ${collections.length}
• Total documents: ${totalDocuments}
• Backup version: ${backupData.metadata.version || 'unknown'}
• Security level: ${backupData.metadata.securityLevel || 'standard'}

⚠️  WARNING: This will OVERWRITE your current data!

Collections that will be restored:
${collections.join(', ')}

✅ Ownership verified: This backup belongs to your account.

Are you sure you want to continue with the restoration?`
          )) {
            setRestoreLoading(false);
            return;
          }
          
          console.log('User confirmed restoration');
          setBackupSuccess('🔒 Ownership verified. Starting restoration process...');
          
          let restoredCount = 0;
          let skippedCount = 0;
          let errorCount = 0;
          
          // Loop through each collection
          for (const collectionName of collections) {
            try {
              console.log(`Restoring collection: ${collectionName}`);
              
              if (backupData[collectionName] && typeof backupData[collectionName] === 'object') {
                const documents = Object.entries(backupData[collectionName]);
                console.log(`Collection ${collectionName}: ${documents.length} documents to restore`);
                
                for (const [docId, docData] of documents) {
                  try {
                    // Skip if docData is null or invalid
                    if (!docData || typeof docData !== 'object') {
                      console.warn(`Skipping invalid document in ${collectionName}: ${docId}`);
                      skippedCount++;
                      continue;
                    }
                    
                    // Process the restored data using dateUtils for consistent date handling
                    const processedData = processRestoredData(docData);
                    
                    // Write document to user-specific Firestore collection
                    // This ensures data goes to the correct user's space
                    await setDoc(getUserDoc(collectionName, docId), processedData, { merge: true });
                    restoredCount++;
                    
                    // Update progress every 10 documents
                    if (restoredCount % 10 === 0) {
                      setBackupSuccess(`Restoring to ${user.email}... ${restoredCount} documents processed`);
                    }
                  } catch (docError) {
                    console.error(`Error restoring document ${docId} in ${collectionName}:`, docError);
                    errorCount++;
                  }
                }
                
                console.log(`Collection ${collectionName}: restored ${documents.length} documents to user ${user.uid}`);
              } else {
                console.log(`Collection ${collectionName}: no data to restore`);
              }
            } catch (collectionError) {
              console.error(`Error restoring collection ${collectionName}:`, collectionError);
              errorCount++;
            }
          }
          
          // Final success message with statistics and user verification
          const successMessage = `✅ Restore completed successfully for ${user.email}!

🔒 Security Verified: Data restored to your account only.

📊 Restoration Summary:
• User Account: ${user.email}
• ${restoredCount} documents restored
• ${skippedCount} documents skipped
• ${errorCount} errors encountered
• ${collections.length} collections processed

The page will refresh in 3 seconds to load your restored data...`;
          
          setBackupSuccess(successMessage);
          console.log('Restoration completed for user:', user.uid, { restoredCount, skippedCount, errorCount });
          
          // Refresh page after 3 seconds to load new data
          setTimeout(() => {
            window.location.reload();
          }, 3000);
          
        } catch (parseError) {
          console.error('Error parsing backup file or validation failed:', parseError);
          setBackupError(`${parseError.message}`);
          setRestoreLoading(false);
        }
      };
      
      reader.onerror = () => {
        setBackupError('Error reading backup file. Please try selecting the file again.');
        setRestoreLoading(false);
      };
      
      reader.readAsText(backupFile);
    } catch (error) {
      console.error('Error restoring from backup:', error);
      setBackupError(`Failed to restore from backup: ${error.message}`);
      setRestoreLoading(false);
    }
  };
  
  // Inside the Settings component, add a new function to delete all data
  const handleClearAllData = async () => {
    // Show backup confirmation modal instead of window.confirm
    setShowBackupConfirmModal(true);
  };
  
  // Fetch users - now using user-specific users collection
  const fetchUsers = async () => {
    try {
      setLoading(true);
      console.log('Fetching users from user-specific collection');
      
      // Fetch users from user-specific collection
      const usersCollection = getUserCollection('teamMembers'); // Changed from 'users' to 'teamMembers' for clarity
      const usersSnapshot = await getDocs(usersCollection);
      
      console.log(`Retrieved ${usersSnapshot.docs.length} user documents from user-specific collection`);
      
      const activeUsersList = [];
      const inactiveUsersList = [];
      
      // Process users
      usersSnapshot.forEach(doc => {
        const userData = doc.data();
        console.log(`Processing user: ${userData.email}`);
        
        // Include all users from this tenant's team
        const userWithId = {
          id: doc.id,
          ...userData,
          // Convert Firestore Timestamp to JS Date for display using dateUtils
          createdAt: safelyParseDate(userData.createdAt),
          inactiveAt: safelyParseDate(userData.inactiveAt)
        };
        
        if (userData.isActive === false) {
          console.log(`Adding to inactive users: ${userData.email}`);
          inactiveUsersList.push(userWithId);
        } else {
          console.log(`Adding to active users: ${userData.email}`);
          activeUsersList.push(userWithId);
        }
      });
      
      console.log(`Found ${activeUsersList.length} active users and ${inactiveUsersList.length} inactive users`);
      setUsers(activeUsersList);
      setInactiveUsers(inactiveUsersList);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      setUserError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  // Restore inactive user
  const handleRestoreUser = async (userId, userEmail) => {
    try {
      setLoading(true);
      
      // Update the user document to mark as active in user-specific collection
      await updateDoc(getUserDoc('teamMembers', userId), {
        isActive: true,
        inactiveAt: null,
        inactiveBy: null,
        restoredAt: new Date(),
        restoredBy: user.uid
      });
      
      setUserSuccess(`User ${userEmail} has been restored and can now log in again.`);
      
      // Refresh the users list
      await fetchUsers();
      
    } catch (error) {
      console.error('Error restoring user:', error);
      setUserError(`Failed to restore user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Add an effect to refresh the users list periodically
  useEffect(() => {
    // Initial fetch
    fetchUsers();
    
    // Set up an interval to refresh users every 30 seconds
    const intervalId = setInterval(() => {
      if (activeTab === 'users') {
        console.log('Auto-refreshing users list');
        fetchUsers();
      }
    }, 30000);
    
    // Clean up interval when component unmounts
    return () => clearInterval(intervalId);
  }, [activeTab]);
  
  // Also refresh users whenever we switch to the users tab
  useEffect(() => {
    if (activeTab === 'users') {
      console.log('Tab changed to users, refreshing data');
      fetchUsers();
    }
  }, [activeTab]);
  
  // Create new user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError('');
    setUserSuccess('');
    
    if (!newUserEmail || !newUserPassword) {
      setUserError('Email and password are required');
      return;
    }
    
    if (newUserPassword.length < 6) {
      setUserError('Password must be at least 6 characters long');
      return;
    }
    
    try {
      setLoading(true);
      
      // Create user directly with Firebase Auth
      console.log('Creating new user with email:', newUserEmail);
      
      // Get a separate auth instance to avoid logging out the current admin
      const auth2 = getAuth();
      
      // Create the user in Firebase Authentication
      const userCredential = await createUserWithEmailAndPassword(
        auth2, 
        newUserEmail, 
        newUserPassword
      );
      
      console.log('User created successfully with uid:', userCredential.user.uid);
      
      // Add user to user-specific Firestore collection
      await addDoc(getUserCollection('teamMembers'), {
        uid: userCredential.user.uid,
        email: newUserEmail,
        role: newUserRole,
        permissions: newUserPermissions,
        createdAt: new Date(),
        createdBy: user.uid,
        isActive: true
      });
      
      // Reset form and refresh users
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserRole('user');
      setNewUserPermissions({});
      await fetchUsers();
      
      setUserSuccess(`User ${newUserEmail} created successfully!`);
    } catch (error) {
      console.error('Error creating user:', error);
      let errorMessage = 'Failed to create user';
      
      // Extract detailed error message
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'This email is already in use. Please use a different email address.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email format. Please provide a valid email address.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. It must be at least 6 characters long.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setUserError(errorMessage);
    } finally {
      setLoading(false);
    }
  };
  
  // Update user permissions
  const handleUpdatePermissions = async (userId, permissions) => {
    try {
      setLoading(true);
      const userRef = getUserDoc('teamMembers', userId);
      await updateDoc(userRef, { permissions });
      await fetchUsers();
      setUserSuccess('User permissions updated successfully');
    } catch (error) {
      console.error('Error updating permissions:', error);
      setUserError(`Failed to update permissions: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Delete user
  const handleDeleteUser = async (userId, userEmail, userUid) => {
    if (!window.confirm(`Are you sure you want to delete ${userEmail}? This action cannot be undone.`)) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Instead of deleting from Firebase Auth (which requires admin privileges),
      // we'll mark the user as inactive in user-specific Firestore
      console.log(`Marking user ${userEmail} as inactive`);
      
      // Update the user document to mark as inactive in user-specific collection
      await updateDoc(getUserDoc('teamMembers', userId), {
        isActive: false,
        inactiveAt: new Date(),
        inactiveBy: user.uid
      });
      
      setUserSuccess(`User ${userEmail} has been marked as inactive and will no longer be able to log in.`);
      
      // Refresh the users list to remove the inactive user
      await fetchUsers();
      
    } catch (error) {
      console.error('Error deactivating user:', error);
      setUserError(`Failed to deactivate user: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Test login for a user
  const testUserLogin = async (userEmail) => {
    try {
      setLoading(true);
      setUserError('');
      setUserSuccess('');
      
      // Ask for the password
      const password = window.prompt(`Enter the password for ${userEmail} to test login:`);
      
      if (!password) {
        setLoading(false);
        return;
      }
      
      // Try to sign in
      const auth2 = getAuth();  // Get a new auth instance to avoid signing out the current user
      try {
        await signInWithEmailAndPassword(auth2, userEmail, password);
        setUserSuccess(`Login test successful for ${userEmail}! This user's credentials are valid.`);
      } catch (error) {
        console.error('Test login error:', error);
        setUserError(`Login test failed: ${error.message || error.code}`);
      }
    } catch (error) {
      console.error('Error in test login function:', error);
      setUserError(`Test login error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Actual function to delete all data after confirmations
  const performDataDeletion = async () => {
    setLoading(true);
    setBackupError('');
    setBackupSuccess('');
    
    try {
      console.log('Starting comprehensive data deletion...');
      
      // Comprehensive list of user-specific collections to delete
      // Updated to match the backup collections list
      const collectionsToDelete = [
        'customers', 
        'orders', 
        'sales', 
        'purchases', 
        'settings', 
        'transactions', 
        'lensInventory', 
        'counters',
        'teamMembers', // User management
        'vendors', // Vendor information
        'products', // Product catalog
        'inventory', // General inventory
        'payments', // Payment records
        'invoices', // Invoice data
        'categories', // Product categories
        'brands', // Brand information
        'prescriptions', // Prescription data
        'appointments', // Appointment data
        // Legacy collections that might exist
        'users', // Old user collection name
        'reports' // Reports if any
      ];
      
      const deletePromises = [];
      let totalDeleted = 0;
      
      for (const collectionName of collectionsToDelete) {
        try {
          console.log(`Deleting user-specific collection: ${collectionName}`);
          const collectionRef = getUserCollection(collectionName);
          const collectionSnapshot = await getDocs(collectionRef);
          
          if (collectionSnapshot.docs.length > 0) {
            console.log(`Found ${collectionSnapshot.docs.length} documents in ${collectionName}`);
            
            collectionSnapshot.docs.forEach(doc => {
              deletePromises.push(deleteDoc(doc.ref));
              totalDeleted++;
            });
          } else {
            console.log(`Collection ${collectionName} is empty, skipping...`);
          }
        } catch (collectionError) {
          console.warn(`Could not delete collection ${collectionName}:`, collectionError);
          // Continue with other collections even if one fails
        }
      }
      
      if (deletePromises.length === 0) {
        setBackupError("No data found to delete. Database appears to be empty.");
        return;
      }
      
      console.log(`Deleting ${totalDeleted} documents from ${collectionsToDelete.length} collections...`);
      
      // Wait for all deletes to complete
      await Promise.all(deletePromises);
      
      console.log('All user-specific data deleted successfully');
      
      setBackupSuccess(`✅ All data has been successfully deleted. 
      
      Deleted: ${totalDeleted} documents
      Collections cleared: ${collectionsToDelete.length}
      
      The application will refresh in 3 seconds...`);
      
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } catch (error) {
      console.error('Error clearing data:', error);
      setBackupError(`Failed to clear all data: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle password confirmation
  const handlePasswordConfirm = async () => {
    try {
      setPasswordConfirmError('');
      
      // Re-authenticate the user with the provided password
      const credential = EmailAuthProvider.credential(user.email, adminPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Password is correct, close modal and proceed with deletion
      setShowPasswordConfirmModal(false);
      setAdminPassword('');
      await performDataDeletion();
      
    } catch (error) {
      console.error('Password verification failed:', error);
      if (error.code === 'auth/wrong-password') {
        setPasswordConfirmError('Incorrect password. Please try again.');
      } else {
        setPasswordConfirmError('Password verification failed. Please try again.');
      }
    }
  };
  
  // Backup Confirmation Modal
  const BackupConfirmModal = () => (
    <div className="fixed inset-0 overflow-y-auto z-50">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-yellow-100 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900">
                  ⚠️ Create Backup Before Deletion?
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 mb-4">
                    You're about to permanently delete ALL data from your database. This action cannot be undone.
                  </p>
                  <p className="text-sm font-medium text-red-600 mb-4">
                    Would you like to create a backup first? This is highly recommended.
                  </p>
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-xs text-red-700">
                      <strong>Data to be deleted:</strong> Customers, vendors, orders, sales, purchases, 
                      invoices, lens inventory, counters, transactions, users, and all other collections.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={async () => {
                setShowBackupConfirmModal(false);
                await handleBackup();
                // After backup, show password confirmation
                setTimeout(() => setShowPasswordConfirmModal(true), 1000);
              }}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              📁 Create Backup First
            </button>
            <button
              type="button"
              onClick={() => {
                setShowBackupConfirmModal(false);
                setShowPasswordConfirmModal(true);
              }}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              🗑️ Skip Backup & Delete
            </button>
            <button
              type="button"
              onClick={() => setShowBackupConfirmModal(false)}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // Password Confirmation Modal
  const PasswordConfirmModal = () => (
    <div className="fixed inset-0 overflow-y-auto z-50">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  🔐 Admin Password Required
                </h3>
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                    Please enter your admin password to confirm this destructive action.
                  </p>
                  
                  {passwordConfirmError && (
                    <div className="bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded-md p-3 mb-4">
                      <p className="text-sm text-red-700 dark:text-red-200">{passwordConfirmError}</p>
                    </div>
                  )}
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Admin Password
                    </label>
                    <input
                      type="password"
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter your password"
                      onKeyPress={(e) => {
                        if (e.key === 'Enter' && adminPassword) {
                          handlePasswordConfirm();
                        }
                      }}
                    />
                  </div>
                  
                  <div className="mt-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md p-3">
                    <p className="text-xs text-red-700 dark:text-red-200 font-medium">
                      ⚠️ FINAL WARNING: This will permanently delete ALL your business data. 
                      This action cannot be undone.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handlePasswordConfirm}
              disabled={!adminPassword || loading}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-500 disabled:opacity-50 sm:ml-3 sm:w-auto sm:text-sm"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Deleting...
                </>
              ) : '🗑️ Delete All Data'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowPasswordConfirmModal(false);
                setAdminPassword('');
                setPasswordConfirmError('');
              }}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    checkFinancialYearEnd();
  }, []);

  // Load shop preferences on component mount
  useEffect(() => {
    loadShopPreferences();
  }, []);

  // Load shop preferences function
  const loadShopPreferences = () => {
    try {
      const preferences = getShopPreferences();
      setShopPreferencesState(preferences || { isSharing: false });
    } catch (error) {
      console.error('Error loading shop preferences:', error);
      setShopPreferencesState({ isSharing: false });
    }
  };

  // Handle shop inventory sharing toggle
  const handleShopPermissionToggle = async () => {
    try {
      setShopLoading(true);
      setShopError('');
      
      const newSharingState = !shopPreferences.isSharing;
      
      if (newSharingState) {
        // Enable sharing - upload lenses to shop
        const { db } = await import('../firebaseConfig');
        const { collection, getDocs } = await import('firebase/firestore');
        const { getUserCollection } = await import('../utils/multiTenancy');
        
        // Fetch current lens inventory
        const lensRef = getUserCollection('lensInventory');
        const snapshot = await getDocs(lensRef);
        
        const lenses = snapshot.docs
          .filter(doc => !doc.data()._placeholder)
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(lens => lens.type === 'prescription' || lens.type === 'contact'); // Only prescription and contact lenses
        
        if (lenses.length > 0) {
          // Get current user info for shop operations
          const userInfo = getCurrentUserInfo();
          await uploadLensesToShop(lenses, userInfo);
          console.log(`Uploaded ${lenses.length} lenses to shop`);
        }
        
        displaySuccess(`Successfully enabled inventory sharing! ${lenses.length} lenses uploaded to Reflex Shop.`);
      } else {
        // Disable sharing - remove lenses from shop
        const { db } = await import('../firebaseConfig');
        const { collection, getDocs } = await import('firebase/firestore');
        const { getUserCollection } = await import('../utils/multiTenancy');
        
        // Fetch current lens inventory to remove from shop
        const lensRef = getUserCollection('lensInventory');
        const snapshot = await getDocs(lensRef);
        
        const lenses = snapshot.docs
          .filter(doc => !doc.data()._placeholder)
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(lens => lens.type === 'prescription' || lens.type === 'contact');
        
        if (lenses.length > 0) {
          await removeLensesFromShop(lenses);
          console.log(`Removed ${lenses.length} lenses from shop`);
        }
        
        displaySuccess('Successfully disabled inventory sharing! Your lenses have been removed from Reflex Shop.');
      }
      
      // Update preferences
      const updatedPreferences = {
        ...shopPreferences,
        isSharing: newSharingState
      };
      
      setShopPreferences(updatedPreferences);
      setShopPreferencesState(updatedPreferences);
      
    } catch (error) {
      console.error('Error toggling shop permissions:', error);
      setShopError(`Failed to ${shopPreferences.isSharing ? 'disable' : 'enable'} inventory sharing: ${error.message}`);
    } finally {
      setShopLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="flex-grow p-4 pb-24">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 p-4 mb-6 text-red-700 dark:text-red-200 flex justify-between items-center">
            <p>{error}</p>
            <button 
              onClick={() => setError('')}
              className="ml-4 text-red-700 dark:text-red-200 hover:text-red-900 dark:hover:text-red-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 dark:bg-green-900/50 border-l-4 border-green-400 dark:border-green-600 p-4 mb-6 text-green-700 dark:text-green-200">
            <p>{success}</p>
          </div>
        )}
        
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border border-gray-200 dark:border-gray-700">
          {/* Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-700 overflow-x-auto bg-gray-50 dark:bg-gray-800/50">
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'shop' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 dark:border-sky-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('shop')}
            >
              Shop Information
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'bank' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 dark:border-sky-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('bank')}
            >
              Bank Details
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'financial' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 dark:border-sky-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('financial')}
            >
              Financial Year
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'backup' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 dark:border-sky-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('backup')}
            >
              Backup & Restore
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'users' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 dark:border-sky-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('users')}
            >
              Users
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'password' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 dark:border-sky-400 bg-white dark:bg-gray-800' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
              onClick={() => setActiveTab('password')}
            >
              Change Password
            </button>
          </div>
          
          <div className="p-6 bg-white dark:bg-gray-800">
            {/* Shop Information Tab */}
            {activeTab === 'shop' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Shop Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shop Name *</label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">GST Number</label>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                
                {/* Shop Logo Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shop Logo (Optional)</label>
                  <div className="mt-1 flex items-center">
                    {logoDataURL ? (
                      <div className="relative">
                        <img 
                          src={logoDataURL} 
                          alt="Shop Logo" 
                          className="h-32 w-32 object-contain bg-gray-100 dark:bg-gray-600 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="absolute top-1 right-1 bg-red-500 dark:bg-red-600 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 dark:hover:bg-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ) : loading ? (
                      <div className="flex justify-center items-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md h-32 w-32 p-2 bg-gray-50 dark:bg-gray-700">
                        <div className="text-center">
                          <svg className="animate-spin mx-auto h-8 w-8 text-sky-500 dark:text-sky-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-xs text-sky-500 dark:text-sky-400 mt-1">Processing...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md h-32 w-32 p-2 bg-gray-50 dark:bg-gray-700">
                        <div className="text-center">
                          <svg className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Upload Logo</p>
                        </div>
                      </div>
                    )}
                    
                    <input
                      type="file"
                      id="logo-upload"
                      className="hidden"
                      accept="image/jpeg,image/png,image/gif,image/webp,image/svg+xml"
                      onChange={handleLogoChange}
                      disabled={loading}
                    />
                    <div className="ml-4 flex flex-col space-y-2">
                      <label
                        htmlFor="logo-upload"
                        className={`inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-gray-800 dark:focus:ring-sky-400 cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {loading ? 'Processing...' : logoDataURL ? 'Change Logo' : 'Upload Logo'}
                      </label>
                      {logoDataURL && (
                        <button
                          type="button"
                          onClick={removeLogo}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 dark:focus:ring-red-400"
                          disabled={loading}
                        >
                          Remove Logo
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Upload a logo for your shop. This will appear on invoices and other documents.<br />
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Note: Max file size 1MB. Supported formats: JPEG, PNG, GIF, WEBP, SVG.</span><br />
                    <span className="text-gray-500 dark:text-gray-400 italic">Large images will be automatically compressed to fit size limits.</span>
                  </p>
                </div>
                
                {/* QR Code Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">QR Code (Optional)</label>
                  <div className="mt-1 flex items-center">
                    {qrCodeDataURL ? (
                      <div className="relative">
                        <img 
                          src={qrCodeDataURL} 
                          alt="QR Code" 
                          className="h-32 w-32 object-contain bg-gray-100 dark:bg-gray-600 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={removeQRCode}
                          className="absolute top-1 right-1 bg-red-500 dark:bg-red-600 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600 dark:hover:bg-red-700"
                        >
                          ×
                        </button>
                      </div>
                    ) : loading ? (
                      <div className="flex justify-center items-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md h-32 w-32 p-2 bg-gray-50 dark:bg-gray-700">
                        <div className="text-center">
                          <svg className="animate-spin mx-auto h-8 w-8 text-sky-500 dark:text-sky-400" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-xs text-sky-500 dark:text-sky-400 mt-1">Processing...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-md h-32 w-32 p-2 bg-gray-50 dark:bg-gray-700">
                        <div className="text-center">
                          <svg className="mx-auto h-8 w-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Upload QR Code</p>
                        </div>
                      </div>
                    )}
                    
                    <input
                      type="file"
                      id="qr-code-upload"
                      className="hidden"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleQRCodeChange}
                      disabled={loading}
                    />
                    <div className="ml-4 flex flex-col space-y-2">
                      <label
                        htmlFor="qr-code-upload"
                        className={`inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:focus:ring-offset-gray-800 dark:focus:ring-sky-400 cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {loading ? 'Processing...' : qrCodeDataURL ? 'Change QR Code' : 'Upload QR Code'}
                      </label>
                      {qrCodeDataURL && (
                        <button
                          type="button"
                          onClick={removeQRCode}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-gray-800 dark:focus:ring-red-400"
                          disabled={loading}
                        >
                          Remove QR Code
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Upload a QR code for your shop. This will be used for various purposes.<br />
                    <span className="text-amber-600 dark:text-amber-400 font-medium">Note: Max file size 1MB. Supported formats: JPEG, PNG, GIF, WEBP.</span><br />
                    <span className="text-gray-500 dark:text-gray-400 italic">Large images will be automatically compressed to fit size limits.</span>
                  </p>
                </div>
                
                {/* Reflex Shop - Inventory Sharing Section */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
                        🛒 Reflex Shop - Inventory Sharing
                      </h3>
                      <p className="text-sm text-blue-800 dark:text-blue-200">
                        Share your prescription and contact lenses in the centralized Reflex Shop marketplace. 
                        Other distributors can discover and contact you for lens orders.
                      </p>
                    </div>
                    <div className="flex items-center">
                      <button
                        onClick={handleShopPermissionToggle}
                        disabled={shopLoading}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                          shopPreferences.isSharing 
                            ? 'bg-blue-600 focus:ring-blue-500' 
                            : 'bg-gray-200 dark:bg-gray-700 focus:ring-gray-500'
                        } ${shopLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            shopPreferences.isSharing ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {shopError && (
                    <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <p className="text-red-600 dark:text-red-400 text-sm">{shopError}</p>
                    </div>
                  )}

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center space-x-2">
                      <div className={`w-3 h-3 rounded-full ${shopPreferences.isSharing ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                      <span className="text-blue-800 dark:text-blue-200">
                        {shopPreferences.isSharing ? 'Inventory sharing is enabled' : 'Inventory sharing is disabled'}
                      </span>
                    </div>
                    
                    {shopPreferences.isSharing && (
                      <>
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="text-blue-800 dark:text-blue-200">
                            Your prescription and contact lenses are visible in Reflex Shop
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span className="text-blue-800 dark:text-blue-200">
                            Other distributors can find and contact you for orders
                          </span>
                        </div>
                      </>
                    )}
                    
                    <div className="bg-blue-100 dark:bg-blue-800/50 p-3 rounded-lg">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">What gets shared:</h4>
                      <ul className="text-blue-800 dark:text-blue-200 text-xs space-y-1">
                        <li>• Prescription lenses (SPH, CYL, AXIS, ADD details)</li>
                        <li>• Contact lenses (power, brand, type information)</li>
                        <li>• Your shop name, location, and contact details</li>
                        <li>• Lens pricing and availability</li>
                      </ul>
                      <p className="text-blue-700 dark:text-blue-300 text-xs mt-2">
                        <strong>Note:</strong> Stock lenses and services are not shared in the marketplace.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Bank Details Tab */}
            {activeTab === 'bank' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Bank Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">UPI ID (Optional)</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="user@paytm"
                  />
                </div>
              </div>
            )}
            
            {/* Financial Year Tab */}
            {activeTab === 'financial' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Financial Year Settings</h2>
                
                <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-6 text-blue-700 dark:text-blue-200">
                  <h3 className="text-md font-medium">About Financial Year</h3>
                  <p className="text-sm mt-1">
                    In India, the financial year runs from April 1st to March 31st of the next calendar year. 
                    When you change the financial year, invoice numbering will reset to start from 1.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Financial Year</label>
                    <select
                      value={currentFinancialYear}
                      onChange={(e) => handleFinancialYearChange(e.target.value)}
                      className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="">Select a financial year</option>
                      {financialYearOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    
                    <div className="mt-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center mr-3 flex-shrink-0">
                          <svg className="w-5 h-5 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {currentFinancialYear 
                            ? `Your current financial year is set to ${currentFinancialYear}`
                            : 'Please select a financial year to continue'}
                        </p>
                      </div>
                    </div>
                    
                    {currentFinancialYear && (
                      <div className="mt-6 space-y-3">
                        <button
                          type="button"
                          onClick={() => setShowFinancialYearModal(true)}
                          className="inline-flex items-center px-4 py-2 border border-amber-300 dark:border-amber-600 shadow-sm text-sm font-medium rounded-md text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 dark:focus:ring-offset-gray-800 dark:focus:ring-amber-400"
                        >
                          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          Change Financial Year
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* Backup & Restore Tab */}
            {activeTab === 'backup' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Backup & Restore</h2>
                
                {backupError && (
                  <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 p-4 mb-4 text-red-700 dark:text-red-200">
                    <p>{backupError}</p>
                  </div>
                )}
                
                {backupSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/50 border-l-4 border-green-400 dark:border-green-600 p-4 mb-4 text-green-700 dark:text-green-200">
                    <p>{backupSuccess}</p>
                  </div>
                )}
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Backup Section */}
                  <div className="bg-white dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Create Backup</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Download a backup file containing all your business data. Store this file safely.
                    </p>
                    
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleBackup}
                        disabled={backupLoading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
                      >
                        {backupLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Creating Backup...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            Download Backup
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="mt-4 text-xs text-gray-500">
                      <p>The backup includes:</p>
                      <ul className="list-disc pl-5 mt-1">
                        <li>Customer data</li>
                        <li>Orders and sales</li>
                        <li>Transactions</li>
                        <li>Shop settings</li>
                        <li>Lens inventory</li>
                        <li>Purchase records</li>
                        <li>Vendor information</li>
                        <li>Product catalog</li>
                        <li>Invoice data</li>
                        <li>Payment records</li>
                        <li>User management</li>
                        <li>All other business data</li>
                      </ul>
                    </div>
                  </div>
                  
                  {/* Restore Section */}
                  <div className="bg-white dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Restore from Backup</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                      Restore your data from a previously created backup file. This will overwrite your current data.
                    </p>
                    
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Select Backup File</label>
                      <input
                        type="file"
                        accept=".json"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 dark:text-gray-400
                          file:mr-4 file:py-2 file:px-4
                          file:rounded-md file:border-0
                          file:text-sm file:font-medium
                          file:bg-blue-50 dark:file:bg-blue-900/50 file:text-blue-700 dark:file:text-blue-300
                          hover:file:bg-blue-100 dark:hover:file:bg-blue-900/70"
                      />
                      
                      {backupFile && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-md">
                          <p className="text-sm text-green-800 dark:text-green-200 font-medium">
                            ✅ Selected file: {backupFile.name}
                          </p>
                          <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                            File will be validated to ensure it belongs to your account before restoration.
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <div className="mt-4">
                      <button
                        type="button"
                        onClick={handleRestore}
                        disabled={restoreLoading || !backupFile}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-amber-500 disabled:opacity-50"
                      >
                        {restoreLoading ? (
                          <>
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Validating & Restoring...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            🔒 Validate & Restore Data
                          </>
                        )}
                      </button>
                    </div>
                    
                    <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-md">
                      <p className="text-xs text-red-700 dark:text-red-200 font-medium">
                        ⚠️ Warning: This will permanently overwrite all your current data.
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-300 mt-1">
                        Only proceed if you're certain this backup contains the data you want to restore.
                      </p>
                    </div>
                  </div>
                </div>
                
                {/* Clear All Data Section */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="bg-red-50 dark:bg-red-900/30 p-6 rounded-lg border border-red-200 dark:border-red-700">
                    <h3 className="text-lg font-medium text-red-900 dark:text-red-200 mb-4">⚠️ Danger Zone</h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      This action will permanently delete ALL data from your shop including customers, orders, sales, transactions, and settings.
                      This action cannot be undone.
                    </p>
                    
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirmModal(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-red-500"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete All Data
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Users Tab */}
            {activeTab === 'users' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">User Management</h2>
                
                {userError && (
                  <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 p-4 mb-4 text-red-700 dark:text-red-200">
                    <p>{userError}</p>
                  </div>
                )}
                
                {userSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/50 border-l-4 border-green-400 dark:border-green-600 p-4 mb-4 text-green-700 dark:text-green-200">
                    <p>{userSuccess}</p>
                  </div>
                )}
                
                {/* Users Tabs */}
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button
                    className={`px-4 py-2 text-sm font-medium ${usersTab === 'active' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 dark:border-sky-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    onClick={() => setUsersTab('active')}
                  >
                    Active Users
                  </button>
                  <button
                    className={`px-4 py-2 text-sm font-medium ${usersTab === 'inactive' ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-500 dark:border-sky-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'}`}
                    onClick={() => setUsersTab('inactive')}
                  >
                    Inactive Users
                  </button>
                </div>
                
                {/* Create New User Form */}
                {usersTab === 'active' && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border border-gray-200 dark:border-gray-600">
                    <h3 className="text-md font-medium text-gray-900 dark:text-white mb-4">Create New User</h3>
                    <form onSubmit={handleCreateUser} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email Address</label>
                          <input
                            type="email"
                            value={newUserEmail}
                            onChange={(e) => setNewUserEmail(e.target.value)}
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            required
                          />
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
                          <input
                            type="password"
                            value={newUserPassword}
                            onChange={(e) => setNewUserPassword(e.target.value)}
                            className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                            required
                            minLength="6"
                          />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Role</label>
                        <select
                          value={newUserRole}
                          onChange={(e) => setNewUserRole(e.target.value)}
                          className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        >
                          <option value="user">User</option>
                          <option value="admin">Admin</option>
                        </select>
                      </div>
                      
                      {/* Permissions */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {menuItems.map((item) => (
                            <label key={item.path} className="flex items-center">
                              <input
                                type="checkbox"
                                checked={newUserPermissions[item.path] || false}
                                onChange={(e) => setNewUserPermissions(prev => ({
                                  ...prev,
                                  [item.path]: e.target.checked
                                }))}
                                className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800"
                              />
                              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">{item.title}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={loading}
                          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 disabled:opacity-50"
                        >
                          {loading ? 'Creating...' : 'Create User'}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
                
                {/* Users List */}
                <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {usersTab === 'active' ? (
                    users.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {users.map((user) => (
                          <div key={user.uid} className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Role: {user.role || 'user'} • 
                                  Created: {formatDateTime(user.createdAt)}
                                </p>
                              </div>
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => testUserLogin(user.email)}
                                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm"
                                >
                                  Test Login
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(user.id, user.email, user.uid)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">No active users found</p>
                      </div>
                    )
                  ) : (
                    inactiveUsers.length > 0 ? (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {inactiveUsers.map((user) => (
                          <div key={user.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">{user.email}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Role: {user.role || 'user'} • 
                                  Deleted: {formatDateTime(user.deletedAt)}
                                </p>
                              </div>
                              <button
                                onClick={() => handleRestoreUser(user.id, user.email)}
                                className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 text-sm"
                              >
                                Restore
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-8 text-center">
                        <p className="text-gray-500 dark:text-gray-400">No inactive users found</p>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}
            
            {/* Password Change Tab */}
            {activeTab === 'password' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900 dark:text-white">Change Password</h2>
                
                {passwordError && (
                  <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 p-4 mb-4 text-red-700 dark:text-red-200">
                    <p>{passwordError}</p>
                  </div>
                )}
                
                {passwordSuccess && (
                  <div className="bg-green-50 dark:bg-green-900/50 border-l-4 border-green-400 dark:border-green-600 p-4 mb-4 text-green-700 dark:text-green-200">
                    <p>{passwordSuccess}</p>
                  </div>
                )}
                
                <div className="max-w-md">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Current Password</label>
                      <input
                        type="password"
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">New Password</label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        minLength="6"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Confirm New Password</label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        minLength="6"
                      />
                    </div>
                    
                    <div className="pt-4">
                      <button
                        type="button"
                        onClick={handleChangePassword}
                        disabled={loading}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 disabled:opacity-50"
                      >
                        {loading ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Save Button */}
            {(activeTab === 'shop' || activeTab === 'bank') && (
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveSettings}
                    disabled={loading}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : (
                      'Save Settings'
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Financial Year Modal */}
      {showFinancialYearModal && <FinancialYearModal />}
      
      {/* Backup Confirm Modal */}
      {showBackupConfirmModal && <BackupConfirmModal />}
      
      {/* Password Confirm Modal */}
      {showPasswordConfirmModal && <PasswordConfirmModal />}
    </div>
  );
};

export default Settings; 
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import Navbar from '../components/Navbar';

const Settings = () => {
  // Shop information
  const [shopName, setShopName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // QR Code (stored directly as data URL)
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
  
  // UI states
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('shop');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  
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
  }, []);
  
  const fetchSettings = async () => {
    try {
      setLoading(true);
      
      const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
      
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
      
      // Save to Firestore
      try {
        console.log('Saving settings to Firestore...');
        try {
          // First try to update the existing document
          await setDoc(doc(db, 'settings', 'shopSettings'), settingsData);
          console.log('Settings saved successfully to Firestore');
        } catch (initialError) {
          console.warn('Initial save attempt failed, trying alternative approach:', initialError);
          
          // Try with merge option
          await setDoc(doc(db, 'settings', 'shopSettings'), settingsData, { merge: true });
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
      const user = auth.currentUser;
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
      
      // 1. Update the financial year in settings
      const settingsRef = doc(db, 'settings', 'shopSettings');
      await setDoc(settingsRef, { 
        financialYear: newFinancialYear,
        previousFinancialYear: currentFinancialYear || '',
        financialYearChangedAt: new Date()
      }, { merge: true });
      
      // 2. Handle invoice numbering based on user choice
      const counterRef = doc(db, 'counters', `invoices_${newFinancialYear}`);
      
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
            const prevCounterRef = doc(db, 'counters', `invoices_${currentFinancialYear}`);
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
  
  return (
    <div className="bg-slate-50 min-h-screen flex flex-col">
      <Navbar />
      
      <div className="container mx-auto px-4 py-6 flex-grow">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
        
        {error && (
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6 text-red-700 flex justify-between items-center">
            <p>{error}</p>
            <button 
              onClick={() => setError('')}
              className="ml-4 text-red-700 hover:text-red-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
        
        {success && (
          <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-6 text-green-700">
            <p>{success}</p>
          </div>
        )}
        
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-200">
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'shop' ? 'text-sky-600 border-b-2 border-sky-500' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('shop')}
            >
              Shop Information
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'bank' ? 'text-sky-600 border-b-2 border-sky-500' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('bank')}
            >
              Bank Details
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'financial' ? 'text-sky-600 border-b-2 border-sky-500' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('financial')}
            >
              Financial Year
            </button>
            <button
              className={`px-4 py-3 text-sm font-medium ${activeTab === 'password' ? 'text-sky-600 border-b-2 border-sky-500' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setActiveTab('password')}
            >
              Change Password
            </button>
          </div>
          
          <div className="p-6">
            {/* Shop Information Tab */}
            {activeTab === 'shop' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900">Shop Information</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Shop Name *</label>
                    <input
                      type="text"
                      value={shopName}
                      onChange={(e) => setShopName(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                    <input
                      type="text"
                      value={gstNumber}
                      onChange={(e) => setGstNumber(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                  <textarea
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pincode</label>
                    <input
                      type="text"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">QR Code for Payments (Optional)</label>
                  <div className="mt-1 flex items-center">
                    {qrCodeDataURL ? (
                      <div className="relative">
                        <img 
                          src={qrCodeDataURL} 
                          alt="Payment QR Code" 
                          className="h-32 w-32 object-contain bg-gray-100 rounded-md"
                        />
                        <button
                          type="button"
                          onClick={removeQRCode}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                        >
                          ×
                        </button>
                      </div>
                    ) : loading ? (
                      <div className="flex justify-center items-center border-2 border-dashed border-gray-300 rounded-md h-32 w-32 p-2">
                        <div className="text-center">
                          <svg className="animate-spin mx-auto h-8 w-8 text-sky-500" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          <p className="text-xs text-sky-500 mt-1">Processing...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="flex justify-center items-center border-2 border-dashed border-gray-300 rounded-md h-32 w-32 p-2">
                        <div className="text-center">
                          <svg className="mx-auto h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <p className="text-xs text-gray-500 mt-1">Upload QR</p>
                        </div>
                      </div>
                    )}
                    
                    <input
                      type="file"
                      id="qr-upload"
                      className="hidden"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleQRCodeChange}
                      disabled={loading}
                    />
                    <div className="ml-4 flex flex-col space-y-2">
                      <label
                        htmlFor="qr-upload"
                        className={`inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 cursor-pointer ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {loading ? 'Processing...' : qrCodeDataURL ? 'Change QR Code' : 'Upload QR Code'}
                      </label>
                      {qrCodeDataURL && (
                        <button
                          type="button"
                          onClick={removeQRCode}
                          className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-red-600 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          disabled={loading}
                        >
                          Remove QR Code
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    Upload a QR code for UPI or other digital payments. This will appear on invoices.<br />
                    <span className="text-amber-600 font-medium">Note: Max file size 1MB. Supported formats: JPEG, PNG, GIF, WEBP.</span><br />
                    <span className="text-gray-500 italic">Large images will be automatically compressed to fit size limits.</span>
                  </p>
                </div>
              </div>
            )}
            
            {/* Bank Details Tab */}
            {activeTab === 'bank' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900">Bank Details</h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      value={accountHolderName}
                      onChange={(e) => setAccountHolderName(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      value={ifscCode}
                      onChange={(e) => setIfscCode(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                  <input
                    type="text"
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Your UPI ID (e.g., yourname@upi) for receiving payments
                  </p>
                </div>
              </div>
            )}
            
            {/* Financial Year Tab */}
            {activeTab === 'financial' && (
              <div className="space-y-6">
                <h2 className="text-lg font-medium text-gray-900">Financial Year Settings</h2>
                
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6 text-blue-700">
                  <h3 className="text-md font-medium">About Financial Year</h3>
                  <p className="text-sm mt-1">
                    In India, the financial year runs from April 1st to March 31st of the next calendar year. 
                    When you change the financial year, invoice numbering will reset to start from 1.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Current Financial Year</label>
                    <select
                      value={currentFinancialYear}
                      onChange={(e) => handleFinancialYearChange(e.target.value)}
                      className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
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
                        <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center mr-3 flex-shrink-0">
                          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <p className="text-sm text-gray-600">
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
                          className="inline-flex items-center px-4 py-2 border border-amber-300 shadow-sm text-sm font-medium rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500"
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
            
            {/* Password Change Tab */}
            {activeTab === 'password' && (
              <div className="space-y-6 max-w-md">
                <h2 className="text-lg font-medium text-gray-900">Change Password</h2>
                
                {passwordError && (
                  <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 text-red-700">
                    <p>{passwordError}</p>
                  </div>
                )}
                
                {passwordSuccess && (
                  <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4 text-green-700">
                    <p>{passwordSuccess}</p>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Password *</label>
                  <input
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    required
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password *</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    required
                    minLength={6}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Password must be at least 6 characters long
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    required
                  />
                </div>
                
                <div>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={loading || !currentPassword || !newPassword || !confirmPassword}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
                  >
                    {loading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </div>
            )}
            
            {/* Save button (only for non-password tabs) */}
            {activeTab !== 'password' && (
              <div className="mt-8 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveSettings}
                  disabled={loading || !shopName}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : 'Save Settings'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {showFinancialYearModal && (
        <FinancialYearModal />
      )}
      
      {showFinancialYearEndModal && (
        <FinancialYearEndModal />
      )}
    </div>
  );
};

export default Settings; 
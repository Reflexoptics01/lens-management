import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ChevronLeftIcon } from '@heroicons/react/24/outline';
import { getUserCollection } from '../utils/multiTenancy';
import { dateToISOString } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';

const Register = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // Multi-step form
  
  // Clear any existing auth state on component mount
  useEffect(() => {
    const clearAuthState = async () => {
      try {
        if (user) {
          console.log('Clearing existing auth state for user:', user.email);
          await auth.signOut();
          console.log('Auth state cleared successfully');
        }
      } catch (error) {
        console.error('Error clearing auth state:', error);
      }
    };
    
    // Only clear auth state if user is not already registering
    // This prevents clearing the auth state during the registration process
    if (user && !loading) {
      clearAuthState();
    }
  }, [user?.email]); // Remove user dependency to prevent clearing during registration
  
  // Form data
  const [formData, setFormData] = useState({
    // Account details
    email: '',
    password: '',
    confirmPassword: '',
    
    // Shop/Company details (mandatory)
    shopName: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    contactNumber: '',
    shopEmail: '', // Shop email (can be same as account email)
    
    // Business details (optional)
    gstNumber: '',
    panNumber: '',
    
    // Bank details (optional)
    bankName: '',
    accountNumber: '',
    ifscCode: '',
    accountHolderName: '',
    upiId: '',
    
    // Additional settings
    financialYear: '2024-2025',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: '12-hour',
    currency: 'INR',
    decimalPlaces: 2,
    quantityDecimalPlaces: 0,
    rateDecimalPlaces: 2,
    roundOffTotal: true,
    showPreviousBalance: true,
    enableOrderTracking: false,
    enableCreditLimit: false,
    enableGST: true,
    enableMultipleBranches: false
  });

  const [errors, setErrors] = useState({});

  // Check if email exists in database
  const checkEmailExists = async (email) => {
    try {
      console.log('Checking email existence for:', email);
      
      // Since we can't check unauthenticated, we'll rely on Firebase Auth
      // to be the primary check for email existence
      console.log('⚠️ Cannot check email in Firestore due to security rules');
      console.log('Firebase Auth will be the final check for email availability');
      
      return { 
        inRegistrations: false, 
        inUsers: false, 
        registrationData: null, 
        userData: null,
        securityRestricted: true 
      };
    } catch (error) {
      console.error('Error checking email:', error);
      
      // For any errors, assume email is available to prevent blocking legitimate registrations
      console.log('⚠️ Database check failed - assuming email is available');
      return { 
        inRegistrations: false, 
        inUsers: false, 
        registrationData: null, 
        userData: null,
        checkFailed: true 
      };
    }
  };

  const validateStep = (stepNumber) => {
    const newErrors = {};
    
    if (stepNumber === 1) {
      // Validate account details
      if (!formData.email) newErrors.email = 'Email is required';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        newErrors.email = 'Invalid email format';
      }
      
      if (!formData.password) newErrors.password = 'Password is required';
      else if (formData.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
      
      if (!formData.confirmPassword) {
        newErrors.confirmPassword = 'Please confirm password';
      } else if (formData.password !== formData.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
    } else if (stepNumber === 2) {
      // Validate company details
      if (!formData.shopName) newErrors.shopName = 'Shop/Company name is required';
      if (!formData.address) newErrors.address = 'Address is required';
      if (!formData.city) newErrors.city = 'City is required';
      if (!formData.state) newErrors.state = 'State is required';
      if (!formData.pincode) newErrors.pincode = 'Pincode is required';
      else if (!/^[0-9]{6}$/.test(formData.pincode)) {
        newErrors.pincode = 'Pincode must be 6 digits';
      }
      if (!formData.contactNumber) newErrors.contactNumber = 'Contact number is required';
      else if (!/^[+]?[\d\s\-\(\)]{10,}$/.test(formData.contactNumber)) {
        newErrors.contactNumber = 'Invalid contact number format';
      }
      
      // GSTIN validation (optional but if provided, must be valid)
      if (formData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(formData.gstNumber)) {
        newErrors.gstNumber = 'Invalid GSTIN format (e.g., 22AAAAA0000A1Z5)';
      }
      
      // PAN validation (optional but if provided, must be valid)
      if (formData.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(formData.panNumber)) {
        newErrors.panNumber = 'Invalid PAN format (e.g., ABCDE1234F)';
      }
      
      // IFSC validation (if provided)
      if (formData.ifscCode && !/^[A-Z]{4}[0][A-Z0-9]{6}$/.test(formData.ifscCode)) {
        newErrors.ifscCode = 'Invalid IFSC code format (e.g., SBIN0005943)';
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    let processedValue = value;
    
    // Auto-format certain fields
    if (name === 'gstNumber') {
      processedValue = value.toUpperCase();
    } else if (name === 'panNumber') {
      processedValue = value.toUpperCase();
    } else if (name === 'ifscCode') {
      processedValue = value.toUpperCase();
    } else if (name === 'email') {
      processedValue = value.toLowerCase();
    } else if (name === 'shopEmail') {
      processedValue = value.toLowerCase();
    } else if (name === 'pincode') {
      // Only allow numbers
      processedValue = value.replace(/\D/g, '').slice(0, 6);
    }
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : processedValue
    }));
    
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleNext = async (e) => {
    console.log('=== handleNext function called ===');
    console.log('Current step:', step);
    console.log('Event details:', e?.type, e?.key);
    console.log('Event target:', e?.target?.name, e?.target?.type);
    
    // Prevent any form submission
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (validateStep(step)) {
      // Check email on step 1
      if (step === 1) {
        console.log('Step 1: Starting email validation...');
        setLoading(true);
        try {
          const emailExists = await checkEmailExists(formData.email);
          
          // Handle security-restricted checks gracefully
          if (emailExists.securityRestricted) {
            console.log('✅ Email check restricted due to security rules - proceeding to step 2');
            toast.success('Proceeding to next step. Email availability will be verified during registration.');
          } else if (emailExists.checkFailed) {
            console.log('⚠️ Email check failed - proceeding to step 2');
            toast.success('Proceeding to next step. Email availability will be verified during registration.');
          } else if (emailExists.inRegistrations || emailExists.inUsers) {
            let message = 'This email is already registered';
            
            if (emailExists.registrationData) {
              const status = emailExists.registrationData.status;
              if (status === 'pending') {
                message = 'This email is already registered and pending approval. Please wait for admin verification or contact support.';
              } else if (status === 'approved') {
                message = 'This email is already registered and approved. Please login instead.';
              } else if (status === 'rejected') {
                message = 'Your previous registration was rejected. Please contact admin for assistance.';
              }
            } else if (emailExists.userData) {
              message = 'This email is already registered. Please login instead.';
            }
            
            console.log('Email validation failed:', message);
            toast.error(message);
            setErrors({ email: message });
            return;
          } else {
            console.log('Email validation passed');
          }
        } catch (error) {
          console.error('Error checking email:', error);
          console.log('⚠️ Email validation failed - proceeding anyway');
          toast.success('Proceeding to next step. Email availability will be verified during registration.');
        } finally {
          setLoading(false);
        }
      }
      
      // Only advance to next step, never trigger form submission
      const nextStep = step + 1;
      console.log('Advancing from step', step, 'to step', nextStep);
      setStep(nextStep);
      console.log('Step advancement completed');
    } else {
      console.log('Step validation failed for step:', step);
    }
  };

  const handleBack = () => {
    setStep(step - 1);
  };

  const handleSubmit = async (e) => {
    console.log('=== handleSubmit function called ===');
    console.log('Current step:', step);
    console.log('Event type:', e?.type);
    console.log('Event target:', e?.target?.type, e?.target?.name);
    
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent submission unless we're on the final step (step 3)
    if (step !== 3) {
      console.log('❌ SUBMISSION BLOCKED - Not on step 3. Current step:', step);
      console.log('Form submission prevented on wrong step');
      return;
    }
    
    console.log('✅ Step 3 confirmed - proceeding with submission');
    
    // Only allow submission on the final step
    if (!validateStep(step)) {
      console.log('❌ SUBMISSION BLOCKED - Step validation failed');
      return;
    }
    
    console.log('✅ Step validation passed - starting registration');
    setLoading(true);
    
    try {
      console.log('Starting registration process for:', formData.email);
      
      // Double-check email doesn't exist
      const emailExists = await checkEmailExists(formData.email);
      if (emailExists.inRegistrations || emailExists.inUsers) {
        throw new Error('Email is already registered');
      }
      
      // Create Firebase Auth user
      console.log('Creating Firebase Auth user...');
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        formData.email,
        formData.password
      );
      
      const user = userCredential.user;
      console.log('Firebase user created with UID:', user.uid);
      
      // Create user registration request in Firestore
      console.log('Creating registration document...');
      await addDoc(collection(db, 'userRegistrations'), {
        uid: user.uid,
        email: formData.email,
        companyDetails: {
          companyName: formData.shopName,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode,
          contactNumber: formData.contactNumber,
          shopEmail: formData.shopEmail || '',
          gstNumber: formData.gstNumber || '',
          panNumber: formData.panNumber || '',
          bankName: formData.bankName || '',
          accountNumber: formData.accountNumber || '',
          ifscCode: formData.ifscCode || '',
          accountHolderName: formData.accountHolderName || '',
          upiId: formData.upiId || '',
        },
        settings: {
          financialYear: formData.financialYear,
          dateFormat: formData.dateFormat,
          timeFormat: formData.timeFormat,
          currency: formData.currency,
          decimalPlaces: formData.decimalPlaces,
          quantityDecimalPlaces: formData.quantityDecimalPlaces,
          rateDecimalPlaces: formData.rateDecimalPlaces,
          roundOffTotal: formData.roundOffTotal,
          showPreviousBalance: formData.showPreviousBalance,
          enableOrderTracking: formData.enableOrderTracking,
          enableCreditLimit: formData.enableCreditLimit,
          enableGST: formData.enableGST,
          enableMultipleBranches: formData.enableMultipleBranches
        },
        status: 'pending', // Needs admin approval
        createdAt: serverTimestamp()
      });
      
      console.log('User registration document created successfully');
      
      // Don't sign out the user immediately - let them see their registration status
      // await auth.signOut();
      // console.log('User signed out after registration');
      
      toast.success('Registration successful! Please wait for admin approval. You can check your registration status in your profile.');
      navigate('/dashboard'); // Navigate to dashboard where they can see pending approval status
      
    } catch (error) {
      console.error('Registration error:', error);
      
      // Handle specific Firebase Auth errors
      if (error.code === 'auth/email-already-in-use') {
        setErrors({ email: 'This email is already registered in our system. If you believe this is an error or you were previously deleted by admin, please contact support at Info@reflexoptics.in for assistance.' });
        toast.error('Email already in use. Contact support if you need help: Info@reflexoptics.in');
      } else if (error.code === 'auth/weak-password') {
        setErrors({ password: 'Password is too weak. Please choose a stronger password.' });
        toast.error('Password is too weak. Please choose a stronger password.');
      } else if (error.code === 'auth/invalid-email') {
        setErrors({ email: 'Invalid email address format.' });
        toast.error('Invalid email address format.');
      } else if (error.code === 'auth/operation-not-allowed') {
        toast.error('Email/password accounts are not enabled. Please contact support.');
      } else if (error.code === 'auth/network-request-failed') {
        toast.error('Network error. Please check your internet connection and try again.');
      } else if (error.message === 'Email is already registered') {
        setErrors({ email: 'This email is already registered' });
        toast.error('This email is already registered');
      } else {
        toast.error('Registration failed: ' + (error.message || 'Unknown error occurred'));
      }
      
      // If Firebase user was created but registration doc failed, clean up
      if (user && error.message !== 'Email is already registered') {
        try {
          console.log('Cleaning up Firebase user due to registration failure...');
          await deleteUser(user);
          console.log('Firebase user cleaned up');
        } catch (cleanupError) {
          console.error('Failed to cleanup Firebase user:', cleanupError);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white flex items-center justify-center p-2 sm:p-4">
      <div className="w-full max-w-xl bg-white rounded-xl shadow-lg overflow-hidden my-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 to-indigo-600 p-4 sm:p-6 text-white">
          <h1 className="text-xl sm:text-2xl font-bold">Create New Account</h1>
          <p className="text-blue-100 mt-1 text-sm">Join Reflex Optic Solutions</p>
        </div>
        
        {/* Progress Bar */}
        <div className="px-4 sm:px-6 py-3 bg-gray-50">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-xs sm:text-sm font-medium ${step >= 1 ? 'text-blue-600' : 'text-gray-400'}`}>
              Account Details
            </span>
            <span className={`text-xs sm:text-sm font-medium ${step >= 2 ? 'text-blue-600' : 'text-gray-400'}`}>
              Company Info
            </span>
            <span className={`text-xs sm:text-sm font-medium ${step >= 3 ? 'text-blue-600' : 'text-gray-400'}`}>
              Additional Details
            </span>
          </div>
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-between">
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${
                step >= 1 ? 'bg-blue-600 text-white' : 'bg-white border-2 border-gray-300 text-gray-400'
              }`}>
                1
              </div>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${
                step >= 2 ? 'bg-blue-600 text-white' : 'bg-white border-2 border-gray-300 text-gray-400'
              }`}>
                2
              </div>
              <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs sm:text-sm ${
                step >= 3 ? 'bg-blue-600 text-white' : 'bg-white border-2 border-gray-300 text-gray-400'
              }`}>
                3
              </div>
            </div>
          </div>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6" onKeyDown={(e) => {
          // Prevent form submission on Enter key unless we're on step 3 and focused on the submit button
          if (e.key === 'Enter' && step !== 3) {
            e.preventDefault();
            console.log('Enter key blocked on step:', step);
            // Trigger Next button if on steps 1-2
            if (step < 3) {
              handleNext();
            }
          }
        }}>
          {/* Step 1: Account Details */}
          {step === 1 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Account Details</h2>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    errors.email ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="your@email.com"
                />
                {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    errors.password ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Minimum 6 characters"
                />
                {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Confirm Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    errors.confirmPassword ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Re-enter your password"
                />
                {errors.confirmPassword && <p className="text-red-500 text-xs mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>
          )}
          
          {/* Step 2: Company Information */}
          {step === 2 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Company Information</h2>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Optical Shop/Company Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="shopName"
                    value={formData.shopName}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.shopName ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Enter your optical shop name"
                  />
                  {errors.shopName && <p className="text-red-500 text-xs mt-1">{errors.shopName}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Contact Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    name="contactNumber"
                    value={formData.contactNumber}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.contactNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Phone number"
                  />
                  {errors.contactNumber && <p className="text-red-500 text-xs mt-1">{errors.contactNumber}</p>}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address <span className="text-red-500">*</span>
                </label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  rows={2}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    errors.address ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="Enter your business address"
                />
                {errors.address && <p className="text-red-500 text-xs mt-1">{errors.address}</p>}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  State <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="state"
                  value={formData.state}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                    errors.state ? 'border-red-500' : 'border-gray-300'
                  }`}
                  placeholder="State name"
                />
                {errors.state && <p className="text-red-500 text-xs mt-1">{errors.state}</p>}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.city ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="City name"
                  />
                  {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Pincode <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    name="pincode"
                    value={formData.pincode}
                    onChange={handleInputChange}
                    maxLength={6}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.pincode ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="6-digit pincode"
                  />
                  {errors.pincode && <p className="text-red-500 text-xs mt-1">{errors.pincode}</p>}
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Shop Email (Optional)
                </label>
                <input
                  type="email"
                  name="shopEmail"
                  value={formData.shopEmail}
                  onChange={handleInputChange}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleNext();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder="Shop email (can be different from login email)"
                />
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    GSTIN (Optional)
                  </label>
                  <input
                    type="text"
                    name="gstNumber"
                    value={formData.gstNumber}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.gstNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="15 character GSTIN"
                  />
                  {errors.gstNumber && <p className="text-red-500 text-xs mt-1">{errors.gstNumber}</p>}
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    PAN Number (Optional)
                  </label>
                  <input
                    type="text"
                    name="panNumber"
                    value={formData.panNumber}
                    onChange={handleInputChange}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleNext();
                      }
                    }}
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm ${
                      errors.panNumber ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="10 character PAN"
                  />
                  {errors.panNumber && <p className="text-red-500 text-xs mt-1">{errors.panNumber}</p>}
                </div>
              </div>
            </div>
          )}
          
          {/* Step 3: Additional Details */}
          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">Additional Details (Optional)</h2>
              
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Bank Details (Optional)</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Bank Name</label>
                    <input
                      type="text"
                      name="bankName"
                      value={formData.bankName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Bank name"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Account Number</label>
                    <input
                      type="text"
                      name="accountNumber"
                      value={formData.accountNumber}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Account number"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">IFSC Code</label>
                    <input
                      type="text"
                      name="ifscCode"
                      value={formData.ifscCode}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="IFSC code"
                    />
                    {errors.ifscCode && <p className="text-red-500 text-xs mt-1">{errors.ifscCode}</p>}
                  </div>
                  
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">Account Holder Name</label>
                    <input
                      type="text"
                      name="accountHolderName"
                      value={formData.accountHolderName}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Account holder name"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-xs text-gray-600 mb-1">UPI ID (Optional)</label>
                  <input
                    type="text"
                    name="upiId"
                    value={formData.upiId}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    placeholder="user@paytm"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-700">Settings</h3>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="enableGST"
                    checked={formData.enableGST}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Enable GST</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="enableOrderTracking"
                    checked={formData.enableOrderTracking}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Enable Order Tracking</span>
                </label>
                
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="enableCreditLimit"
                    checked={formData.enableCreditLimit}
                    onChange={handleInputChange}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">Enable Credit Limit</span>
                </label>
              </div>
              
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <p className="text-xs text-blue-800">
                  <strong>Note:</strong> After registration, you'll need to verify your email and wait for admin approval before you can access the system.
                </p>
              </div>

              <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <h4 className="text-xs font-medium text-gray-700 mb-1">Registration Policy:</h4>
                <ul className="text-xs text-gray-600 space-y-0.5">
                  <li>• Each email address can only be registered once</li>
                  <li>• If you already have an account, please login instead</li>
                  <li>• Rejected applications need admin assistance for re-registration</li>
                  <li>• Contact support if you have any issues: Info@reflexoptics.in</li>
                </ul>
              </div>
            </div>
          )}
          
          {/* Navigation Buttons */}
          <div className="flex justify-between mt-4 pt-4 border-t">
            <div>
              {step > 1 && (
                <button
                  type="button"
                  onClick={handleBack}
                  disabled={loading}
                  className="flex items-center px-3 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  <ChevronLeftIcon className="w-4 h-4 mr-1" />
                  Back
                </button>
              )}
            </div>
            
            <div className="flex items-center space-x-3">
              <Link
                to="/login"
                className="text-xs text-gray-600 hover:text-gray-800"
              >
                Already have an account?
              </Link>
              
              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm"
                >
                  {loading && step === 1 ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Validating...
                    </>
                  ) : (
                    'Next'
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center text-sm font-medium"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating Account...
                    </>
                  ) : (
                    'Create Account'
                  )}
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Register; 
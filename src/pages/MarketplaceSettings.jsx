import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getUserDoc } from '../utils/multiTenancy';
import toast from 'react-hot-toast';

const MarketplaceSettings = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [marketplaceProfile, setMarketplaceProfile] = useState({
    shopName: '',
    displayName: '',
    description: '',
    address: {
      street: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India'
    },
    contact: {
      whatsappNumber: '',
      customerSupport1: '',
      customerSupport2: '',
      alternateEmail: ''
    },
    businessInfo: {
      businessType: '',
      gstNumber: '',
      yearEstablished: '',
      specializations: []
    },
    visibility: {
      showAddress: true,
      showContact: true,
      showBusinessInfo: true,
      isActive: true
    },
    notifications: {
      newQueries: true,
      queryResponses: true,
      marketplaceUpdates: true,
      flashSaleAlerts: true,
      emailNotifications: true,
      smsNotifications: false,
      pushNotifications: true
    },
    privacy: {
      showLensInventory: true,
      showPrices: true,
      allowDirectContact: true,
      showLastActiveTime: true,
      showResponseTime: true
    },
    subscription: {
      plan: 'free', // free, basic, premium
      featuresEnabled: [],
      expiryDate: null
    },
    analytics: {
      trackProfileViews: true,
      trackQueryViews: true,
      trackContactClicks: true,
      shareAnalytics: false
    },
    marketingPreferences: {
      promotionalEmails: true,
      partnerOffers: false,
      marketResearch: false,
      newsletterSubscription: true
    }
  });

  const businessTypes = [
    'Optical Store',
    'Lens Distributor',
    'Frame Manufacturer',
    'Lens Manufacturer',
    'Optical Wholesaler',
    'Contact Lens Distributor',
    'Equipment Supplier',
    'Other'
  ];

  const specializationOptions = [
    'Progressive Lenses',
    'Contact Lenses',
    'Prescription Glasses',
    'Sunglasses',
    'Safety Glasses',
    'Sports Glasses',
    'Children\'s Eyewear',
    'Designer Frames',
    'Budget Frames',
    'Lens Coatings',
    'Blue Light Filters',
    'Photochromic Lenses'
  ];

  useEffect(() => {
    if (user) {
      loadMarketplaceProfile();
    }
  }, [user]);

  const loadMarketplaceProfile = async () => {
    setLoading(true);
    try {
      // First try to load existing marketplace profile
      const profileRef = doc(db, 'marketplaceProfiles', user.uid);
      const profileSnap = await getDoc(profileRef);
      
      // Also load settings from Settings.jsx to import existing data
      const settingsRef = getUserDoc('settings', 'shopSettings');
      const settingsSnap = await getDoc(settingsRef);
      let settingsData = {};
      let settingsImported = false;
      
      if (settingsSnap.exists()) {
        settingsData = settingsSnap.data();
        settingsImported = true;
      }
      
      if (profileSnap.exists()) {
        const data = profileSnap.data();
        setMarketplaceProfile(prev => ({
          ...prev,
          ...data
        }));
        if (settingsImported) {
          toast.success('Settings refreshed from Shop Settings!');
        }
      } else {
        // Initialize with data from Settings.jsx and user's existing data
        setMarketplaceProfile(prev => ({
          ...prev,
          // Import from Settings.jsx
          shopName: settingsData.shopName || user.opticalName || user.companyName || '',
          displayName: settingsData.shopName || user.displayName || user.opticalName || '',
          address: {
            ...prev.address,
            street: settingsData.address || '',
            city: settingsData.city || user.city || '',
            state: settingsData.state || user.state || '',
            pincode: settingsData.pincode || ''
          },
          contact: {
            ...prev.contact,
            whatsappNumber: settingsData.phone || user.phone || '',
            alternateEmail: settingsData.email || ''
          },
          businessInfo: {
            ...prev.businessInfo,
            businessType: user.businessType || '',
            gstNumber: settingsData.gstNumber || user.gstNumber || ''
          }
        }));
        
        if (settingsImported) {
          toast.success('Settings imported from Shop Settings successfully!');
        }
      }
    } catch (error) {
      console.error('Error loading marketplace profile:', error);
      toast.error('Failed to load marketplace profile');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (section, field, value) => {
    setMarketplaceProfile(prev => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value
      }
    }));
  };

  const handleDirectChange = (field, value) => {
    setMarketplaceProfile(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSpecializationToggle = (specialization) => {
    setMarketplaceProfile(prev => ({
      ...prev,
      businessInfo: {
        ...prev.businessInfo,
        specializations: prev.businessInfo.specializations.includes(specialization)
          ? prev.businessInfo.specializations.filter(s => s !== specialization)
          : [...prev.businessInfo.specializations, specialization]
      }
    }));
  };

  const importSettingsFromMainSettings = async () => {
    try {
      const userUid = localStorage.getItem('userUid');
      if (!userUid) return;

      const settingsRef = getUserDoc('settings', 'shopSettings');
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const settingsData = settingsDoc.data();
        
        setMarketplaceProfile(prev => ({
          ...prev,
          shopName: settingsData.shopName || '',
          email: settingsData.email || '',
          phone: settingsData.phone || '',
          address: settingsData.address || '',
          city: settingsData.city || '',
          state: settingsData.state || '',
          pincode: settingsData.pincode || '',
          gstNumber: settingsData.gstNumber || ''
        }));
        
        toast.success('Settings imported successfully from main settings');
      } else {
        toast.error('No main settings found to import');
      }
    } catch (error) {
      toast.error('Failed to import settings: ' + error.message);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (!user?.uid) {
        throw new Error('User not authenticated');
      }

      const profileData = {
        ...marketplaceProfile,
        userId: user.uid,
        userEmail: user.email,
        updatedAt: serverTimestamp(),
        isActive: true
      };

      try {
        // Try saving to global collection first (for better discoverability)
        const globalProfileRef = doc(db, 'marketplaceProfiles', user.uid);
        await setDoc(globalProfileRef, profileData, { merge: true });
        
      } catch (globalError) {
        // Fallback to user-specific collection if global fails
        const userProfileRef = getUserDoc('marketplaceProfile', 'profile');
        await setDoc(userProfileRef, profileData, { merge: true });
      }

      // Also save to user-specific collection for data consistency
      const userProfileRef = getUserDoc('marketplaceProfile', 'profile');
      await setDoc(userProfileRef, profileData, { merge: true });

      toast.success('Marketplace profile saved successfully!');
      
    } catch (error) {
      toast.error('Failed to save profile: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-300">Loading marketplace settings...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Marketplace Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Configure your marketplace profile to help other distributors find and connect with you.
          </p>
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                  Your unique marketplace ID: <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded">{user.uid}</code>
                </span>
              </div>
              <button
                onClick={loadMarketplaceProfile}
                disabled={loading}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg transition-colors flex items-center space-x-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>{loading ? 'Importing...' : 'Import from Settings'}</span>
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Shop Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={marketplaceProfile.shopName}
                  onChange={(e) => handleDirectChange('shopName', e.target.value)}
                  placeholder="Enter your shop/business name"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name
                </label>
                <input
                  type="text"
                  value={marketplaceProfile.displayName}
                  onChange={(e) => handleDirectChange('displayName', e.target.value)}
                  placeholder="Name to show in marketplace"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Business Description
              </label>
              <textarea
                rows={3}
                value={marketplaceProfile.description}
                onChange={(e) => handleDirectChange('description', e.target.value)}
                placeholder="Brief description of your business and services"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          {/* Address Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Address Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Street Address
                </label>
                <input
                  type="text"
                  value={marketplaceProfile.address.street}
                  onChange={(e) => handleInputChange('address', 'street', e.target.value)}
                  placeholder="Street address"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  City
                </label>
                <input
                  type="text"
                  value={marketplaceProfile.address.city}
                  onChange={(e) => handleInputChange('address', 'city', e.target.value)}
                  placeholder="City"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  State
                </label>
                <input
                  type="text"
                  value={marketplaceProfile.address.state}
                  onChange={(e) => handleInputChange('address', 'state', e.target.value)}
                  placeholder="State"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  PIN Code
                </label>
                <input
                  type="text"
                  value={marketplaceProfile.address.pincode}
                  onChange={(e) => handleInputChange('address', 'pincode', e.target.value)}
                  placeholder="PIN Code"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Country
                </label>
                <input
                  type="text"
                  value={marketplaceProfile.address.country}
                  onChange={(e) => handleInputChange('address', 'country', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Contact Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={marketplaceProfile.contact.whatsappNumber}
                  onChange={(e) => handleInputChange('contact', 'whatsappNumber', e.target.value)}
                  placeholder="+91 XXXXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer Support 1
                </label>
                <input
                  type="tel"
                  value={marketplaceProfile.contact.customerSupport1}
                  onChange={(e) => handleInputChange('contact', 'customerSupport1', e.target.value)}
                  placeholder="+91 XXXXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Customer Support 2
                </label>
                <input
                  type="tel"
                  value={marketplaceProfile.contact.customerSupport2}
                  onChange={(e) => handleInputChange('contact', 'customerSupport2', e.target.value)}
                  placeholder="+91 XXXXXXXXXX"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alternate Email
                </label>
                <input
                  type="email"
                  value={marketplaceProfile.contact.alternateEmail}
                  onChange={(e) => handleInputChange('contact', 'alternateEmail', e.target.value)}
                  placeholder="support@yourshop.com"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Business Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Business Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Business Type
                </label>
                <select
                  value={marketplaceProfile.businessInfo.businessType}
                  onChange={(e) => handleInputChange('businessInfo', 'businessType', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select business type</option>
                  {businessTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  GST Number
                </label>
                <input
                  type="text"
                  value={marketplaceProfile.businessInfo.gstNumber}
                  onChange={(e) => handleInputChange('businessInfo', 'gstNumber', e.target.value)}
                  placeholder="GST Number"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Year Established
                </label>
                <input
                  type="number"
                  value={marketplaceProfile.businessInfo.yearEstablished}
                  onChange={(e) => handleInputChange('businessInfo', 'yearEstablished', e.target.value)}
                  placeholder="2020"
                  min="1900"
                  max={new Date().getFullYear()}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            {/* Specializations */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Specializations
              </label>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {specializationOptions.map(specialization => (
                  <label key={specialization} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={marketplaceProfile.businessInfo.specializations.includes(specialization)}
                      onChange={() => handleSpecializationToggle(specialization)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{specialization}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Visibility Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Privacy & Visibility
            </h2>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.visibility.showAddress}
                  onChange={(e) => handleInputChange('visibility', 'showAddress', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show address in marketplace</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.visibility.showContact}
                  onChange={(e) => handleInputChange('visibility', 'showContact', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show contact information in marketplace</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.visibility.showBusinessInfo}
                  onChange={(e) => handleInputChange('visibility', 'showBusinessInfo', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show business information in marketplace</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.visibility.isActive}
                  onChange={(e) => handleInputChange('visibility', 'isActive', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Make my profile active in marketplace</span>
              </label>
            </div>
          </div>

          {/* Notifications Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Notifications
            </h2>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.notifications.newQueries}
                  onChange={(e) => handleInputChange('notifications', 'newQueries', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">New Queries</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.notifications.queryResponses}
                  onChange={(e) => handleInputChange('notifications', 'queryResponses', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Query Responses</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.notifications.marketplaceUpdates}
                  onChange={(e) => handleInputChange('notifications', 'marketplaceUpdates', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Marketplace Updates</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.notifications.flashSaleAlerts}
                  onChange={(e) => handleInputChange('notifications', 'flashSaleAlerts', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Flash Sale Alerts</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.notifications.emailNotifications}
                  onChange={(e) => handleInputChange('notifications', 'emailNotifications', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Email Notifications</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.notifications.smsNotifications}
                  onChange={(e) => handleInputChange('notifications', 'smsNotifications', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">SMS Notifications</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.notifications.pushNotifications}
                  onChange={(e) => handleInputChange('notifications', 'pushNotifications', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Push Notifications</span>
              </label>
            </div>
          </div>

          {/* Privacy Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Privacy Controls
            </h2>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.privacy.showLensInventory}
                  onChange={(e) => handleInputChange('privacy', 'showLensInventory', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show lens inventory</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.privacy.showPrices}
                  onChange={(e) => handleInputChange('privacy', 'showPrices', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show prices</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.privacy.allowDirectContact}
                  onChange={(e) => handleInputChange('privacy', 'allowDirectContact', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Allow direct contact</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.privacy.showLastActiveTime}
                  onChange={(e) => handleInputChange('privacy', 'showLastActiveTime', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show last active time</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.privacy.showResponseTime}
                  onChange={(e) => handleInputChange('privacy', 'showResponseTime', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show response time</span>
              </label>
            </div>
          </div>

          {/* Subscription Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Subscription
            </h2>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.subscription.plan === 'basic'}
                  onChange={(e) => handleInputChange('subscription', 'plan', 'basic')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Basic Plan</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.subscription.plan === 'premium'}
                  onChange={(e) => handleInputChange('subscription', 'plan', 'premium')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Premium Plan</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.subscription.featuresEnabled.includes('advancedAnalytics')}
                  onChange={(e) => handleInputChange('subscription', 'featuresEnabled', e.target.checked ? [...marketplaceProfile.subscription.featuresEnabled, 'advancedAnalytics'] : marketplaceProfile.subscription.featuresEnabled.filter(f => f !== 'advancedAnalytics'))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Advanced Analytics</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.subscription.featuresEnabled.includes('bulkOrdering')}
                  onChange={(e) => handleInputChange('subscription', 'featuresEnabled', e.target.checked ? [...marketplaceProfile.subscription.featuresEnabled, 'bulkOrdering'] : marketplaceProfile.subscription.featuresEnabled.filter(f => f !== 'bulkOrdering'))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Bulk Ordering</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.subscription.featuresEnabled.includes('customReports')}
                  onChange={(e) => handleInputChange('subscription', 'featuresEnabled', e.target.checked ? [...marketplaceProfile.subscription.featuresEnabled, 'customReports'] : marketplaceProfile.subscription.featuresEnabled.filter(f => f !== 'customReports'))}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Custom Reports</span>
              </label>
            </div>
          </div>

          {/* Analytics Settings */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Analytics
            </h2>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.analytics.trackProfileViews}
                  onChange={(e) => handleInputChange('analytics', 'trackProfileViews', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Track profile views</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.analytics.trackQueryViews}
                  onChange={(e) => handleInputChange('analytics', 'trackQueryViews', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Track query views</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.analytics.trackContactClicks}
                  onChange={(e) => handleInputChange('analytics', 'trackContactClicks', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Track contact clicks</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.analytics.shareAnalytics}
                  onChange={(e) => handleInputChange('analytics', 'shareAnalytics', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Share analytics</span>
              </label>
            </div>
          </div>

          {/* Marketing Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Marketing Preferences
            </h2>
            
            <div className="space-y-4">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.marketingPreferences.promotionalEmails}
                  onChange={(e) => handleInputChange('marketingPreferences', 'promotionalEmails', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Promotional Emails</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.marketingPreferences.partnerOffers}
                  onChange={(e) => handleInputChange('marketingPreferences', 'partnerOffers', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Partner Offers</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.marketingPreferences.marketResearch}
                  onChange={(e) => handleInputChange('marketingPreferences', 'marketResearch', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Market Research</span>
              </label>
              
              <label className="flex items-center space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={marketplaceProfile.marketingPreferences.newsletterSubscription}
                  onChange={(e) => handleInputChange('marketingPreferences', 'newsletterSubscription', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Newsletter Subscription</span>
              </label>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2"
            >
              {saving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Save Marketplace Profile</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketplaceSettings; 
import React, { useState, useEffect } from 'react';
import { searchLensesBySpecs, getAllShopLenses } from '../utils/shopAPI';
import { useAuth } from '../contexts/AuthContext';
import { useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import LensPrescription from '../components/LensPrescription';

// Constants from OrderForm.jsx
const MATERIALS = ['CR', 'POLY', 'GLASS', 'POLARISED', 'TRIVEX', 'MR8'];

const INDEX_BY_MATERIAL = {
  'CR': ['1.50', '1.56', '1.60', '1.67', '1.74'],
  'POLARISED': ['1.50', '1.56', '1.60', '1.67', '1.74'],
  'GLASS': ['1.52', '1.70', '1.80', '1.90'],
  'TRIVEX': ['1.53'],
  'MR8': ['1.60'],
  'POLY': ['1.59']
};

const LENS_TYPES = [
  'SINGLE VISION',
  'ROUND TOP (KT)',
  'PROGRESSIVE',
  'DIGITAL PROGRESSIVE',
  'FREEFORM PROGRESSIVE',
  'FLAT TOP (D)',
  'EXECUTIVE BIFOCAL',
  'DIGITAL BIFOCAL'
];

const BASE_TINTS = ['WHITE', 'BLUECUT', 'PHOTOGREY (PG)', 'PHOTOGREY BLUECUT', 'OTHER'];

const COATING_TYPES = ['UC', 'HC', 'HMC', 'SHMC', 'HCT'];

const COATING_COLORS = {
  'HMC': ['GREEN', 'BLUE', 'DUAL (BLUE & GREEN)', 'MAGENTA', 'VIOLET'],
  'SHMC': ['GREEN', 'BLUE', 'DUAL (BLUE & GREEN)', 'MAGENTA', 'VIOLET']
};

// Contact Lens Specific Constants
const CONTACT_TYPES = ['NO TORIC', 'TORIC'];

const CONTACT_DURATIONS = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'];

const CONTACT_TINTS = ['CLEAR', 'COLOR'];

const CONTACT_COLORS = [
  'BLUE', 'GREEN', 'GRAY', 'BROWN', 'HAZEL', 'HONEY', 'VIOLET', 'TURQUOISE',
  'EMERALD', 'SAPPHIRE', 'AMETHYST', 'AQUA', 'STERLING GRAY', 'TRUE SAPPHIRE',
  'BRILLIANT BLUE', 'GEMSTONE GREEN', 'PURE HAZEL', 'ENHANCER FOR LIGHT EYES',
  'ENHANCER FOR DARK EYES', 'OPAQUE HAZEL'
];

const Shop = ({ hideNavbar = false, hideHeader = false }) => {
  const { user, isAuthenticated } = useAuth();
  const location = useLocation();
  
  // Search criteria - expanded to match OrderForm specifications
  const [searchCriteria, setSearchCriteria] = useState({
    type: 'all', // 'all', 'prescription', 'contact'
    // Prescription fields (mandatory)
    rightSph: '',
    rightCyl: '',
    rightAxis: '',
    rightAdd: '',
    rightQty: '1',
    leftSph: '',
    leftCyl: '',
    leftAxis: '',
    leftAdd: '',
    leftQty: '1',
    // Lens specifications (optional)
    brand: '',
    material: '',
    index: '',
    lensType: '',
    baseTint: '',
    coating: '',
    coatingType: '',
    coatingColour: '',
    diameter: '',
    // Contact lens specific
    baseCurve: '',
    contactType: '',
    contactDuration: '',
    contactTint: '',
    contactColor: '',
  });
  
  // Results and UI states
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedLens, setSelectedLens] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [showCoatingColors, setShowCoatingColors] = useState(false);
  const [prescriptionRequired, setPrescriptionRequired] = useState(true);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [showContactColors, setShowContactColors] = useState(false);
  
  // Handle coating type changes
  useEffect(() => {
    if (searchCriteria.coatingType === 'HMC' || searchCriteria.coatingType === 'SHMC') {
      setShowCoatingColors(true);
    } else {
      setShowCoatingColors(false);
      setSearchCriteria(prev => ({ ...prev, coatingColour: '' }));
    }
  }, [searchCriteria.coatingType]);
  
  // Handle contact tint changes
  useEffect(() => {
    if (searchCriteria.contactTint === 'COLOR') {
      setShowContactColors(true);
    } else {
      setShowContactColors(false);
      setSearchCriteria(prev => ({ ...prev, contactColor: '' }));
    }
  }, [searchCriteria.contactTint]);
  
  // Handle incoming prescription data from CreateOrder
  useEffect(() => {
    if (location.state?.autoSearch && location.state?.prescriptionData) {
      const prescriptionData = location.state.prescriptionData;
      
      // Update search criteria with prescription data
      setSearchCriteria(prev => ({
        ...prev,
        rightSph: prescriptionData.rightSph || '',
        rightCyl: prescriptionData.rightCyl || '',
        rightAxis: prescriptionData.rightAxis || '',
        rightAdd: prescriptionData.rightAdd || '',
        leftSph: prescriptionData.leftSph || '',
        leftCyl: prescriptionData.leftCyl || '',
        leftAxis: prescriptionData.leftAxis || '',
        leftAdd: prescriptionData.leftAdd || ''
      }));
      
      // Automatically perform search after a brief delay
      setTimeout(() => {
        performAutoSearch(prescriptionData);
      }, 500);
    }
  }, [location.state]);
  
  // Function to perform automatic search with prescription data
  const performAutoSearch = async (prescriptionData) => {
    try {
      setLoading(true);
      setError('');
      setHasSearched(true);
      
      // Build search parameters with prescription data
      const searchParams = {
        type: 'all',
        sph: prescriptionData.rightSph || prescriptionData.leftSph,
        cyl: prescriptionData.rightCyl || prescriptionData.leftCyl,
        axis: prescriptionData.rightAxis || prescriptionData.leftAxis,
        add: prescriptionData.rightAdd || prescriptionData.leftAdd,
      };
      
      // Remove undefined values
      Object.keys(searchParams).forEach(key => {
        if (searchParams[key] === undefined || searchParams[key] === '') {
          delete searchParams[key];
        }
      });
      
      const results = await searchLensesBySpecs(searchParams);
      setSearchResults(results);
    } catch (error) {
      console.error('Error auto-searching lenses:', error);
      setError('Auto-search failed. Please try searching manually.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle search form submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    // Check if prescription data is provided (mandatory)
    const hasPrescriptionData = (searchCriteria.rightSph && searchCriteria.rightSph.trim()) || 
                               (searchCriteria.leftSph && searchCriteria.leftSph.trim()) ||
                               (searchCriteria.rightCyl && searchCriteria.rightCyl.trim()) || 
                               (searchCriteria.leftCyl && searchCriteria.leftCyl.trim());
    
    if (!hasPrescriptionData) {
      setError('Please enter prescription details (at least SPH or CYL for one eye) to search for lenses.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setHasSearched(true);
      
      // Build search parameters with prescription as mandatory
      const searchParams = {
        type: searchCriteria.type !== 'all' ? searchCriteria.type : undefined,
        sph: searchCriteria.rightSph || searchCriteria.leftSph,
        cyl: searchCriteria.rightCyl || searchCriteria.leftCyl,
        axis: searchCriteria.rightAxis || searchCriteria.leftAxis,
        add: searchCriteria.rightAdd || searchCriteria.leftAdd,
      };
      
      // Add advanced filters only if provided
      if (searchCriteria.brand) searchParams.brand = searchCriteria.brand;
      if (searchCriteria.material) searchParams.material = searchCriteria.material;
      if (searchCriteria.coatingType) searchParams.coating = searchCriteria.coatingType;
      if (searchCriteria.baseCurve) searchParams.baseCurve = searchCriteria.baseCurve;
      if (searchCriteria.diameter) searchParams.diameter = searchCriteria.diameter;
      
      // Add contact lens specific filters
      if (searchCriteria.contactType) searchParams.contactType = searchCriteria.contactType;
      if (searchCriteria.contactDuration) searchParams.duration = searchCriteria.contactDuration;
      if (searchCriteria.contactTint) searchParams.tint = searchCriteria.contactTint;
      if (searchCriteria.contactColor) searchParams.color = searchCriteria.contactColor;
      
      // Remove undefined values
      Object.keys(searchParams).forEach(key => {
        if (searchParams[key] === undefined || searchParams[key] === '') {
          delete searchParams[key];
        }
      });
      
      const results = await searchLensesBySpecs(searchParams);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching lenses:', error);
      setError('Search failed. Please try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Reset search criteria
  const resetSearch = () => {
    setSearchCriteria({
      type: 'all',
      rightSph: '',
      rightCyl: '',
      rightAxis: '',
      rightAdd: '',
      rightQty: '1',
      leftSph: '',
      leftCyl: '',
      leftAxis: '',
      leftAdd: '',
      leftQty: '1',
      brand: '',
      material: '',
      index: '',
      lensType: '',
      baseTint: '',
      coating: '',
      coatingType: '',
      coatingColour: '',
      diameter: '',
      baseCurve: '',
      contactType: '',
      contactDuration: '',
      contactTint: '',
      contactColor: '',
    });
    setShowAdvancedSearch(false);
    setSearchResults([]);
    setHasSearched(false);
    setError('');
  };
  
  // Handle input changes for prescription
  const handlePrescriptionChange = (e) => {
    const { name, value } = e.target;
    setSearchCriteria(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle input changes for other fields
  const handleInputChange = (field, value) => {
    setSearchCriteria(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle material change
  const handleMaterialChange = (e) => {
    const material = e.target.value;
    setSearchCriteria(prev => ({
      ...prev,
      material: material,
      index: '' // Reset index when material changes
    }));
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return '₹0.00';
    return `₹${parseFloat(amount).toFixed(2)}`;
  };
  
  // Handle contact distributor
  const handleContactDistributor = (lens) => {
    setSelectedLens(lens);
    setShowContactModal(true);
  };
  
  // Contact Modal Component
  const ContactModal = () => (
    <div className="fixed inset-0 overflow-y-auto z-50">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900/50 sm:mx-0 sm:h-10 sm:w-10">
                <svg className="h-6 w-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                  Contact Distributor
                </h3>
                <div className="mt-2">
                  {selectedLens && (
                    <div className="space-y-3">
                      <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-lg">
                        <h4 className="font-medium text-blue-900 dark:text-blue-100">Lens Details:</h4>
                        <p className="text-sm text-blue-800 dark:text-blue-200">
                          Type: {selectedLens.type} | 
                          {selectedLens.sph && ` SPH: ${selectedLens.sph}`}
                          {selectedLens.cyl && ` CYL: ${selectedLens.cyl}`}
                          {selectedLens.axis && ` AXIS: ${selectedLens.axis}`}
                          {selectedLens.add && ` ADD: ${selectedLens.add}`}
                        </p>
                        {selectedLens.brand && (
                          <p className="text-sm text-blue-800 dark:text-blue-200">
                            Brand: {selectedLens.brand}
                          </p>
                        )}
                        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
                          Price: {formatCurrency(selectedLens.price)}
                        </p>
                      </div>
                      
                      <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-lg">
                        <h4 className="font-medium text-gray-900 dark:text-white mb-2">Distributor Information:</h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <strong>Shop:</strong> {selectedLens.userInfo?.opticalName || 'Not specified'}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <strong>City:</strong> {selectedLens.userInfo?.city || 'Not specified'}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <strong>Phone:</strong> {selectedLens.userInfo?.phone || 'Not specified'}
                        </p>
                      </div>
                      
                      <div className="bg-amber-50 dark:bg-amber-900/30 p-3 rounded-lg">
                        <p className="text-xs text-amber-800 dark:text-amber-200">
                          <strong>Note:</strong> Contact the distributor directly to discuss pricing, availability, and place your order. 
                          This marketplace facilitates discovery only - all transactions are between distributors.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={() => {
                setShowContactModal(false);
                setSelectedLens(null);
              }}
              className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
  
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {!hideNavbar && <Navbar />}
      
      <div className="flex-grow">

        <div className="max-w-7xl mx-auto px-4 py-8">
          {error && (
            <div className="mb-6 bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-red-700 dark:text-red-200 font-medium">{error}</p>
              </div>
            </div>
          )}
          
          {/* Auto-search success notification */}
          {location.state?.autoSearch && hasSearched && !loading && !error && (
            <div className="mb-6 bg-green-50 dark:bg-green-900/50 border-l-4 border-green-400 dark:border-green-600 p-4 rounded-lg shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 text-green-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-green-700 dark:text-green-200 font-medium">
                    Search completed! Found {searchResults.length} matching lenses from the marketplace.
                  </p>
                  <p className="text-green-600 dark:text-green-300 text-sm mt-1">
                    Results are filtered based on your prescription requirements.
                  </p>
                </div>
              </div>
            </div>
          )}
          
          {/* Search Filters - Horizontal Split Layout */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 mb-8 overflow-hidden">
            <form onSubmit={handleSearch}>

                
              {/* Horizontally Split Content */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[500px]">
                {/* Left Half - Prescription Section (P) */}
                <div className="p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
                      <span className="text-white font-bold text-sm">P</span>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-left">
                      Lens Prescription
                    </h3>
                  <div className="text-xs text-gray-500 dark:text-gray-400 bg-amber-50 dark:bg-amber-900/30 px-3 py-1 rounded-lg border border-amber-200 dark:border-amber-700">
                      Required
                  </div>
                </div>
                  <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/20 dark:via-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-700 h-full overflow-y-auto">
                  <LensPrescription 
                    formData={searchCriteria} 
                    onChange={handlePrescriptionChange}
                    matchingLenses={[]} 
                    shopMatchingLenses={[]} 
                    shopLoading={false}
                  />
                    
                    {/* Dynamic Additional Options based on category */}
                    {searchCriteria.type === 'contact' ? (
                      /* Contact Lens Options */
                      <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-600">
                        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <div className="w-5 h-5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center mr-2">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                </div>
                          Contact Lens Options
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Type
                            </label>
                            <select
                              value={searchCriteria.contactType}
                              onChange={(e) => handleInputChange('contactType', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                            >
                              <option value="">Any Type</option>
                              {CONTACT_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
              </div>
              
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Duration
                            </label>
                            <select
                              value={searchCriteria.contactDuration}
                              onChange={(e) => handleInputChange('contactDuration', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                            >
                              <option value="">Any Duration</option>
                              {CONTACT_DURATIONS.map(duration => (
                                <option key={duration} value={duration}>{duration}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Basic Lens Options for Prescription/All Categories */
                      <div className="mt-6 pt-4 border-t border-blue-200 dark:border-blue-600">
                        <h4 className="text-md font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                          <div className="w-5 h-5 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mr-2">
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                  </svg>
              </div>
                          Basic Lens Options
                        </h4>
                        
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Lens Design
                            </label>
                            <select
                              value={searchCriteria.lensType}
                              onChange={(e) => handleInputChange('lensType', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                            >
                              <option value="">Any Design</option>
                              {LENS_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Base Tint
                            </label>
                            <select
                              value={searchCriteria.baseTint}
                              onChange={(e) => handleInputChange('baseTint', e.target.value)}
                              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                            >
                              <option value="">Any Tint</option>
                              {BASE_TINTS.map(tint => (
                                <option key={tint} value={tint}>{tint}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                                {/* Right Half - Advanced Filters Section (A) */}
                <div className="p-6">
                                      <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">A</span>
                    </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white text-left">
                        Advanced Filters
                      </h3>
                      <div className="text-xs text-gray-500 dark:text-gray-400 bg-purple-50 dark:bg-purple-900/30 px-3 py-1 rounded-lg border border-purple-200 dark:border-purple-700">
                        Optional
                      </div>
                  </div>
                  
                    {/* Lens Category moved to header */}
                    <div className="flex items-center space-x-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Category:
                    </label>
                    <select
                      value={searchCriteria.type}
                      onChange={(e) => handleInputChange('type', e.target.value)}
                        className="rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-2 px-3 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:focus:ring-purple-400 dark:focus:border-purple-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all text-sm"
                    >
                      <option value="all">All Categories</option>
                      <option value="prescription">Prescription Lenses</option>
                      <option value="contact">Contact Lenses</option>
                    </select>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700 h-full overflow-y-auto space-y-4">
              
                  {/* Lens Specifications */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Contact Lens Specific Properties */}
                    {searchCriteria.type === 'contact' ? (
                      <>
                        {/* Contact Lens Properties */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-900 dark:text-white flex items-center">
                            <div className="w-6 h-6 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </div>
                            Contact Lens Properties
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Brand
                              </label>
                              <input
                                type="text"
                                value={searchCriteria.brand}
                                onChange={(e) => handleInputChange('brand', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                                placeholder="e.g., Acuvue, Biofinity"
                              />
                            </div>
                            

                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Base Curve
                              </label>
                              <input
                                type="number"
                                step="0.1"
                                value={searchCriteria.baseCurve}
                                onChange={(e) => handleInputChange('baseCurve', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                                placeholder="e.g., 8.6"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Diameter
                              </label>
                              <input
                                type="text"
                                value={searchCriteria.diameter}
                                onChange={(e) => handleInputChange('diameter', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 dark:focus:ring-emerald-400 dark:focus:border-emerald-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                                placeholder="e.g., 14.2mm"
                              />
                            </div>
                          </div>
                        </div>
                        
                        {/* Contact Lens Colors & Tints */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-900 dark:text-white flex items-center">
                            <div className="w-6 h-6 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                              </svg>
                            </div>
                            Tint & Colors
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Tint Type
                              </label>
                              <select
                                value={searchCriteria.contactTint}
                                onChange={(e) => handleInputChange('contactTint', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 dark:focus:ring-pink-400 dark:focus:border-pink-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                              >
                                <option value="">Any Tint</option>
                                {CONTACT_TINTS.map(tint => (
                                  <option key={tint} value={tint}>{tint}</option>
                                ))}
                              </select>
                            </div>
                            
                            {showContactColors && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Color
                                </label>
                                <select
                                  value={searchCriteria.contactColor}
                                  onChange={(e) => handleInputChange('contactColor', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500 dark:focus:ring-pink-400 dark:focus:border-pink-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                                >
                                  <option value="">Select Color</option>
                                  {CONTACT_COLORS.map(color => (
                                    <option key={color} value={color}>{color}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* Regular Lens Properties */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-900 dark:text-white flex items-center">
                            <div className="w-6 h-6 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                            </div>
                            Lens Properties
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Brand
                              </label>
                              <input
                                type="text"
                                value={searchCriteria.brand}
                                onChange={(e) => handleInputChange('brand', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:focus:ring-purple-400 dark:focus:border-purple-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                                placeholder="e.g., Essilor, Zeiss"
                              />
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Material
                              </label>
                              <select
                                value={searchCriteria.material}
                                onChange={handleMaterialChange}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:focus:ring-purple-400 dark:focus:border-purple-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                              >
                                <option value="">Any Material</option>
                                {MATERIALS.map(material => (
                                  <option key={material} value={material}>{material}</option>
                                ))}
                              </select>
                            </div>
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Refractive Index
                              </label>
                              <select
                                value={searchCriteria.index}
                                onChange={(e) => handleInputChange('index', e.target.value)}
                                disabled={!searchCriteria.material}
                                className={`w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:focus:ring-purple-400 dark:focus:border-purple-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all ${!searchCriteria.material ? 'opacity-50 cursor-not-allowed' : ''}`}
                              >
                                <option value="">Any Index</option>
                                {searchCriteria.material && INDEX_BY_MATERIAL[searchCriteria.material].map(index => (
                                  <option key={index} value={index}>{index}</option>
                                ))}
                              </select>
                            </div>
                            

                          </div>
                        </div>
                        
                        {/* Coating & Special Features */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-900 dark:text-white flex items-center">
                            <div className="w-6 h-6 bg-gradient-to-r from-teal-500 to-cyan-500 rounded-lg flex items-center justify-center mr-2">
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                              </svg>
                            </div>
                            Coating & Features
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Coating Type
                              </label>
                              <select
                                value={searchCriteria.coatingType}
                                onChange={(e) => handleInputChange('coatingType', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-400 dark:focus:border-teal-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                              >
                                <option value="">Any Coating</option>
                                {COATING_TYPES.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </div>
                            
                            {showCoatingColors && (
                              <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                  Coating Color
                                </label>
                                <select
                                  value={searchCriteria.coatingColour}
                                  onChange={(e) => handleInputChange('coatingColour', e.target.value)}
                                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-400 dark:focus:border-teal-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                                >
                                  <option value="">Any Color</option>
                                  {COATING_COLORS[searchCriteria.coatingType]?.map(color => (
                                    <option key={color} value={color}>{color}</option>
                                  ))}
                                </select>
                              </div>
                            )}
                            
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Diameter
                              </label>
                              <input
                                type="text"
                                value={searchCriteria.diameter}
                                onChange={(e) => handleInputChange('diameter', e.target.value)}
                                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 shadow-sm py-3 px-4 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 dark:focus:ring-teal-400 dark:focus:border-teal-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white transition-all"
                                placeholder="e.g., 65mm"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                  </div>
                </div>
              
              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 p-4 mt-4 mx-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold rounded-lg shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] duration-200"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Searching Marketplace...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Search Lenses
                    </>
                  )}
                </button>
                
                <button
                  type="button"
                  onClick={resetSearch}
                  className="inline-flex items-center justify-center px-8 py-4 border-2 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all transform hover:scale-[1.02] duration-200"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset Filters
                </button>
              </div>
            </form>
          </div>
          
          {/* Search Results */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
            {/* Results Header */}
            <div className="bg-gradient-to-r from-gray-50 to-slate-50 dark:from-gray-700 dark:to-gray-800 px-6 py-5 border-b border-gray-200 dark:border-gray-600">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {hasSearched ? `Search Results` : 'Available Lenses'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {searchResults.length} {searchResults.length === 1 ? 'lens' : 'lenses'} found
                    </p>
                  </div>
                </div>
                
                {hasSearched && searchResults.length > 0 && (
                  <div className="mt-2 sm:mt-0 text-sm text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/30 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-700">
                    ✨ Premium distributors verified
                  </div>
                )}
              </div>
            </div>
            
            {/* Results Content */}
            <div className="p-6">
              {loading ? (
                <div className="flex justify-center items-center py-16">
                  <div className="text-center">
                    <div className="relative">
                      <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto"></div>
                      <svg className="w-6 h-6 text-blue-600 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                    <p className="text-gray-600 dark:text-gray-400 mt-4 font-medium">Searching marketplace...</p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Finding the best lenses for you</p>
                  </div>
                </div>
              ) : !hasSearched ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 dark:bg-gradient-to-r dark:from-blue-900/50 dark:to-purple-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Ready to Find Your Lenses?</h3>
                  <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
                    Enter your prescription details above to search our marketplace of premium lenses from verified distributors.
                  </p>
                  <div className="mt-4 flex items-center justify-center space-x-2 text-sm text-blue-600 dark:text-blue-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Prescription details are required to search</span>
                  </div>
                </div>
              ) : hasSearched && searchResults.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">No matching lenses found</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    We couldn't find any lenses matching your prescription and criteria. Try adjusting your prescription values or use the advanced filters.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <button
                      onClick={resetSearch}
                      className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium rounded-lg transition-all transform hover:scale-105"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
                      Try New Search
                    </button>
                    <button
                      onClick={() => setShowAdvancedSearch(true)}
                      className="inline-flex items-center px-6 py-3 border-2 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300 font-medium rounded-lg bg-white dark:bg-gray-800 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                      </svg>
                      Use Advanced Filters
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.map((lens, index) => (
                    <div
                      key={`${lens.shopId || lens.id}_${index}`}
                      className="group relative bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                    >
                      {/* Lens Type Badge */}
                      <div className="flex justify-between items-start mb-4">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          lens.type === 'prescription' 
                            ? 'bg-gradient-to-r from-blue-100 to-indigo-100 dark:from-blue-900/50 dark:to-indigo-900/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
                            : 'bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/50 dark:to-teal-900/50 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-700'
                        }`}>
                          {lens.type === 'prescription' ? '👓 Prescription' : '👁️ Contact Lens'}
                        </span>
                        
                        <div className="text-right">
                          <p className="text-xl font-bold text-gray-900 dark:text-white">
                            {formatCurrency(lens.price)}
                          </p>
                          {lens.quantity && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-full mt-1">
                              Stock: {lens.quantity}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* Lens Specifications */}
                      <div className="space-y-3 mb-4">
                        {/* Power Specifications */}
                        {(lens.sph || lens.cyl || lens.axis || lens.add) && (
                          <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-3 border border-blue-200 dark:border-blue-700">
                            <h4 className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-2 uppercase tracking-wider">Power Specs</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                              {lens.sph && (
                                <div className="flex justify-between">
                                  <span className="text-blue-600 dark:text-blue-300">SPH:</span>
                                  <span className="font-semibold text-blue-900 dark:text-blue-100">{lens.sph}</span>
                                </div>
                              )}
                              {lens.cyl && (
                                <div className="flex justify-between">
                                  <span className="text-blue-600 dark:text-blue-300">CYL:</span>
                                  <span className="font-semibold text-blue-900 dark:text-blue-100">{lens.cyl}</span>
                                </div>
                              )}
                              {lens.axis && (
                                <div className="flex justify-between">
                                  <span className="text-blue-600 dark:text-blue-300">AXIS:</span>
                                  <span className="font-semibold text-blue-900 dark:text-blue-100">{lens.axis}°</span>
                                </div>
                              )}
                              {lens.add && (
                                <div className="flex justify-between">
                                  <span className="text-blue-600 dark:text-blue-300">ADD:</span>
                                  <span className="font-semibold text-blue-900 dark:text-blue-100">{lens.add}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Contact lens specific fields */}
                        {lens.type === 'contact' && (lens.baseCurve || lens.diameter || lens.eye) && (
                          <div className="bg-emerald-50 dark:bg-emerald-900/30 rounded-lg p-3 border border-emerald-200 dark:border-emerald-700">
                            <h4 className="text-xs font-semibold text-emerald-800 dark:text-emerald-200 mb-2 uppercase tracking-wider">Contact Specs</h4>
                            <div className="space-y-1 text-sm">
                              {lens.baseCurve && (
                                <div className="flex justify-between">
                                  <span className="text-emerald-600 dark:text-emerald-300">Base Curve:</span>
                                  <span className="font-semibold text-emerald-900 dark:text-emerald-100">{lens.baseCurve}</span>
                                </div>
                              )}
                              {lens.diameter && (
                                <div className="flex justify-between">
                                  <span className="text-emerald-600 dark:text-emerald-300">Diameter:</span>
                                  <span className="font-semibold text-emerald-900 dark:text-emerald-100">{lens.diameter}</span>
                                </div>
                              )}
                              {lens.eye && (
                                <div className="flex justify-between">
                                  <span className="text-emerald-600 dark:text-emerald-300">Eye:</span>
                                  <span className="font-semibold text-emerald-900 dark:text-emerald-100 capitalize">{lens.eye}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Contact lens additional specs (type, duration, tint, color) */}
                        {lens.type === 'contact' && (lens.contactType || lens.duration || lens.tint || lens.color) && (
                          <div className="bg-rose-50 dark:bg-rose-900/30 rounded-lg p-3 border border-rose-200 dark:border-rose-700">
                            <h4 className="text-xs font-semibold text-rose-800 dark:text-rose-200 mb-2 uppercase tracking-wider">Contact Details</h4>
                            <div className="space-y-1 text-sm">
                              {lens.contactType && (
                                <div className="flex justify-between">
                                  <span className="text-rose-600 dark:text-rose-300">Type:</span>
                                  <span className="font-semibold text-rose-900 dark:text-rose-100">{lens.contactType}</span>
                                </div>
                              )}
                              {lens.duration && (
                                <div className="flex justify-between">
                                  <span className="text-rose-600 dark:text-rose-300">Duration:</span>
                                  <span className="font-semibold text-rose-900 dark:text-rose-100 capitalize">{lens.duration}</span>
                                </div>
                              )}
                              {lens.tint && (
                                <div className="flex justify-between">
                                  <span className="text-rose-600 dark:text-rose-300">Tint:</span>
                                  <span className="font-semibold text-rose-900 dark:text-rose-100 capitalize">{lens.tint}</span>
                                </div>
                              )}
                              {lens.color && (
                                <div className="flex justify-between">
                                  <span className="text-rose-600 dark:text-rose-300">Color:</span>
                                  <span className="font-semibold text-rose-900 dark:text-rose-100">{lens.color}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        {/* Brand, Material, Coating */}
                        {(lens.brand || lens.material || lens.coating) && (
                          <div className="space-y-2 text-sm">
                            {lens.brand && (
                              <div className="flex items-center justify-between bg-purple-50 dark:bg-purple-900/30 px-3 py-2 rounded-lg">
                                <span className="text-purple-600 dark:text-purple-300 font-medium">Brand:</span>
                                <span className="text-purple-900 dark:text-purple-100 font-semibold">{lens.brand}</span>
                              </div>
                            )}
                            {lens.material && (
                              <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-900/30 px-3 py-2 rounded-lg">
                                <span className="text-orange-600 dark:text-orange-300 font-medium">Material:</span>
                                <span className="text-orange-900 dark:text-orange-100 font-semibold">{lens.material}</span>
                              </div>
                            )}
                            {lens.coating && (
                              <div className="flex items-center justify-between bg-teal-50 dark:bg-teal-900/30 px-3 py-2 rounded-lg">
                                <span className="text-teal-600 dark:text-teal-300 font-medium">Coating:</span>
                                <span className="text-teal-900 dark:text-teal-100 font-semibold">{lens.coating}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Distributor Info */}
                      <div className="border-t border-gray-200 dark:border-gray-600 pt-4 mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-6m-2-5h6m-6 0V9m0 12H5m14 0v-2a2 2 0 00-2-2H9a2 2 0 00-2 2v2m0 0H5" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {lens.userInfo?.opticalName || 'Premium Distributor'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {lens.userInfo?.city || 'India'}
                            </p>
                           </div>
                        </div>
                      </div>
                      
                      {/* Contact Button */}
                      <button
                        onClick={() => handleContactDistributor(lens)}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition-all transform group-hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-lg hover:shadow-xl"
                      >
                        <span className="flex items-center justify-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                          Connect Now
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Contact Modal */}
      {showContactModal && <ContactModal />}
    </div>
  );
};

export default Shop; 
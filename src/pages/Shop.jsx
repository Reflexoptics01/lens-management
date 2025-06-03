import React, { useState, useEffect } from 'react';
import { searchLensesBySpecs, getAllShopLenses } from '../utils/shopAPI';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';

const Shop = () => {
  const { user, isAuthenticated } = useAuth();
  
  // Search criteria
  const [searchCriteria, setSearchCriteria] = useState({
    type: 'all', // 'all', 'prescription', 'contact'
    sph: '',
    cyl: '',
    axis: '',
    add: '',
    brand: '',
    material: '',
    coating: '',
    baseCurve: '', // For contact lenses
    diameter: '', // For contact lenses
  });
  
  // Results and UI states
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedLens, setSelectedLens] = useState(null);
  const [showContactModal, setShowContactModal] = useState(false);
  
  // Load all lenses on component mount
  useEffect(() => {
    if (isAuthenticated()) {
      loadAllLenses();
    }
  }, [isAuthenticated]);
  
  // Load all available lenses from the marketplace
  const loadAllLenses = async () => {
    try {
      setLoading(true);
      setError('');
      const allLenses = await getAllShopLenses(500); // Get up to 500 lenses
      setSearchResults(allLenses);
      setHasSearched(true);
    } catch (error) {
      console.error('Error loading marketplace lenses:', error);
      setError('Failed to load marketplace. Please try again.');
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };
  
  // Handle search form submission
  const handleSearch = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      setHasSearched(true);
      
      // If no criteria provided, load all lenses
      const hasAnyCriteria = Object.values(searchCriteria).some(value => 
        value && value !== 'all' && value.toString().trim()
      );
      
      let results;
      if (hasAnyCriteria) {
        results = await searchLensesBySpecs(searchCriteria);
      } else {
        results = await getAllShopLenses(500);
      }
      
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
      sph: '',
      cyl: '',
      axis: '',
      add: '',
      brand: '',
      material: '',
      coating: '',
      baseCurve: '',
      diameter: '',
    });
    loadAllLenses();
  };
  
  // Handle input changes
  const handleInputChange = (field, value) => {
    setSearchCriteria(prev => ({
      ...prev,
      [field]: value
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
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <strong>Email:</strong> {selectedLens.userInfo?.email || 'Not specified'}
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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="flex-grow p-4 pb-24">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Reflex Shop - Lens Marketplace
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Find lenses from verified distributors in our network. Search by specifications to find exactly what you need.
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 p-4 mb-6 text-red-700 dark:text-red-200">
            <p>{error}</p>
          </div>
        )}
        
        {/* Search Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Search Lenses</h2>
          
          <form onSubmit={handleSearch} className="space-y-4">
            {/* Lens Type */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Lens Type
                </label>
                <select
                  value={searchCriteria.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Types</option>
                  <option value="prescription">Prescription Lenses</option>
                  <option value="contact">Contact Lenses</option>
                </select>
              </div>
            </div>
            
            {/* Power Specifications */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  SPH (Sphere)
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={searchCriteria.sph}
                  onChange={(e) => handleInputChange('sph', e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., -2.00"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  CYL (Cylinder)
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={searchCriteria.cyl}
                  onChange={(e) => handleInputChange('cyl', e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., -0.75"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  AXIS
                </label>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={searchCriteria.axis}
                  onChange={(e) => handleInputChange('axis', e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., 90"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  ADD (Addition)
                </label>
                <input
                  type="number"
                  step="0.25"
                  value={searchCriteria.add}
                  onChange={(e) => handleInputChange('add', e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., +1.50"
                />
              </div>
            </div>
            
            {/* Brand, Material, Coating */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Brand
                </label>
                <input
                  type="text"
                  value={searchCriteria.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Essilor"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Material
                </label>
                <input
                  type="text"
                  value={searchCriteria.material}
                  onChange={(e) => handleInputChange('material', e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Polycarbonate"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Coating
                </label>
                <input
                  type="text"
                  value={searchCriteria.coating}
                  onChange={(e) => handleInputChange('coating', e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Anti-Reflective"
                />
              </div>
            </div>
            
            {/* Contact Lens Specific Fields */}
            {searchCriteria.type === 'contact' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Base Curve
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={searchCriteria.baseCurve}
                    onChange={(e) => handleInputChange('baseCurve', e.target.value)}
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., 8.6"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Diameter
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={searchCriteria.diameter}
                    onChange={(e) => handleInputChange('diameter', e.target.value)}
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g., 14.2"
                  />
                </div>
              </div>
            )}
            
            {/* Search Buttons */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Searching...
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
                className="inline-flex items-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-base font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Show All Lenses
              </button>
            </div>
          </form>
        </div>
        
        {/* Search Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {hasSearched ? `Search Results (${searchResults.length})` : 'Available Lenses'}
              </h2>
              
              {hasSearched && searchResults.length > 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Showing lenses from verified distributors
                </p>
              )}
            </div>
            
            {/* Results Grid */}
            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="text-center">
                  <svg className="animate-spin mx-auto h-8 w-8 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400 mt-2">Searching marketplace...</p>
                </div>
              </div>
            ) : hasSearched && searchResults.length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No lenses found</h3>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Try adjusting your search criteria or browse all available lenses.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {searchResults.map((lens, index) => (
                  <div
                    key={`${lens.shopId || lens.id}_${index}`}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-lg transition-shadow"
                  >
                    {/* Lens Type Badge */}
                    <div className="flex justify-between items-start mb-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        lens.type === 'prescription' 
                          ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200'
                          : 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200'
                      }`}>
                        {lens.type === 'prescription' ? 'Prescription' : 'Contact Lens'}
                      </span>
                      
                      <div className="text-right">
                        <p className="text-lg font-semibold text-gray-900 dark:text-white">
                          {formatCurrency(lens.price)}
                        </p>
                        {lens.quantity && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Qty: {lens.quantity}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Lens Specifications */}
                    <div className="space-y-2 mb-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        {lens.sph && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">SPH:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-white">{lens.sph}</span>
                          </div>
                        )}
                        {lens.cyl && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">CYL:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-white">{lens.cyl}</span>
                          </div>
                        )}
                        {lens.axis && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">AXIS:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-white">{lens.axis}°</span>
                          </div>
                        )}
                        {lens.add && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">ADD:</span>
                            <span className="ml-1 font-medium text-gray-900 dark:text-white">{lens.add}</span>
                          </div>
                        )}
                      </div>
                      
                      {/* Contact lens specific fields */}
                      {lens.type === 'contact' && (
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {lens.baseCurve && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">BC:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">{lens.baseCurve}</span>
                            </div>
                          )}
                          {lens.diameter && (
                            <div>
                              <span className="text-gray-500 dark:text-gray-400">DIA:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white">{lens.diameter}</span>
                            </div>
                          )}
                          {lens.eye && (
                            <div className="col-span-2">
                              <span className="text-gray-500 dark:text-gray-400">Eye:</span>
                              <span className="ml-1 font-medium text-gray-900 dark:text-white capitalize">{lens.eye}</span>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Brand, Material, Coating */}
                      {(lens.brand || lens.material || lens.coating) && (
                        <div className="text-sm space-y-1">
                          {lens.brand && (
                            <p><span className="text-gray-500 dark:text-gray-400">Brand:</span> <span className="text-gray-900 dark:text-white">{lens.brand}</span></p>
                          )}
                          {lens.material && (
                            <p><span className="text-gray-500 dark:text-gray-400">Material:</span> <span className="text-gray-900 dark:text-white">{lens.material}</span></p>
                          )}
                          {lens.coating && (
                            <p><span className="text-gray-500 dark:text-gray-400">Coating:</span> <span className="text-gray-900 dark:text-white">{lens.coating}</span></p>
                          )}
                        </div>
                      )}
                    </div>
                    
                    {/* Distributor Info */}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mb-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {lens.userInfo?.opticalName || 'Unknown Distributor'}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        📍 {lens.userInfo?.city || 'Location not specified'}
                      </p>
                    </div>
                    
                    {/* Contact Button */}
                    <button
                      onClick={() => handleContactDistributor(lens)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 px-4 rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500"
                    >
                      Contact Distributor
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Contact Modal */}
      {showContactModal && <ContactModal />}
    </div>
  );
};

export default Shop; 
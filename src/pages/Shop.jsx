import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { searchMatchingLenses } from '../utils/shopAPI';

const Shop = () => {
  const [searchType, setSearchType] = useState('prescription'); // 'prescription' or 'contact'
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
  const navigate = useNavigate();

  // Prescription lens search form
  const [prescriptionForm, setPrescriptionForm] = useState({
    right: {
      sph: '',
      cyl: '',
      axis: '',
      add: ''
    },
    left: {
      sph: '',
      cyl: '',
      axis: '',
      add: ''
    }
  });

  // Contact lens search form
  const [contactForm, setContactForm] = useState({
    right: {
      sph: '',
      cyl: '',
      axis: '',
      add: ''
    },
    left: {
      sph: '',
      cyl: '',
      axis: '',
      add: ''
    },
    brand: '',
    type: '',
    color: ''
  });

  const handlePrescriptionChange = (eye, field, value) => {
    setPrescriptionForm(prev => ({
      ...prev,
      [eye]: {
        ...prev[eye],
        [field]: value
      }
    }));
  };

  const handleContactChange = (eye, field, value) => {
    setContactForm(prev => ({
      ...prev,
      [eye]: {
        ...prev[eye],
        [field]: value
      }
    }));
  };

  const handleSearch = async () => {
    try {
      setLoading(true);
      setError('');
      setSearchResults([]);

      const searchData = searchType === 'prescription' ? prescriptionForm : contactForm;
      
      // Validate that at least one field is filled
      const hasValidData = Object.values(searchData.right).some(val => val && val.trim() !== '') ||
                          Object.values(searchData.left).some(val => val && val.trim() !== '');

      if (!hasValidData) {
        setError('Please enter at least one prescription value to search');
        setLoading(false);
        return;
      }

      const results = await searchMatchingLenses(searchData);
      setSearchResults(results);
      setHasSearched(true);

      if (results.length === 0) {
        setError('No matching lenses found from other distributors. Try adjusting your search criteria.');
      }

    } catch (error) {
      console.error('Error searching shop:', error);
      setError(`Search failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const clearSearch = () => {
    setPrescriptionForm({
      right: { sph: '', cyl: '', axis: '', add: '' },
      left: { sph: '', cyl: '', axis: '', add: '' }
    });
    setContactForm({
      right: { sph: '', cyl: '', axis: '', add: '' },
      left: { sph: '', cyl: '', axis: '', add: '' },
      brand: '',
      type: '',
      color: ''
    });
    setSearchResults([]);
    setError('');
    setHasSearched(false);
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return 'Price on request';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const contactDistributor = (distributorInfo, lens) => {
    const message = `Hi, I found your ${lens.type} lens in Reflex Shop and I'm interested in purchasing it.

Lens Details:
${lens.type === 'prescription' ? 
  `- Eye: ${lens.matchedFor}
- SPH: ${lens.sph}
- CYL: ${lens.cyl || 'N/A'}
- AXIS: ${lens.axis || 'N/A'}
- ADD: ${lens.add || 'N/A'}
- Brand: ${lens.brandName}
- Material: ${lens.material || 'N/A'}` :
  `- Eye: ${lens.matchedFor}
- Power Series: ${lens.powerSeries || 'N/A'}
- Brand: ${lens.brandName}
- Category: ${lens.category || 'N/A'}
- Type: ${lens.contactType || 'N/A'}`
}
- Price: ${formatCurrency(lens.salePrice)}

Please let me know about availability and ordering process.

Best regards`;

    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = distributorInfo.phone && distributorInfo.phone !== 'Not specified' 
      ? distributorInfo.phone.replace(/\D/g, '') 
      : '';

    if (phoneNumber) {
      // Try WhatsApp first
      window.open(`https://wa.me/91${phoneNumber}?text=${encodedMessage}`, '_blank');
    } else {
      // Copy message to clipboard as fallback
      navigator.clipboard.writeText(message).then(() => {
        alert('Contact message copied to clipboard! You can send this to the distributor.');
      }).catch(() => {
        alert('Unable to copy message. Please manually contact the distributor.');
      });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="flex-grow px-4 py-6 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-2">
                🛒 Reflex Shop
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Find prescription and contact lenses from other distributors in the network
              </p>
            </div>
            <button
              onClick={() => navigate(-1)}
              className="mt-4 sm:mt-0 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
            >
              ← Back
            </button>
          </div>
        </div>

        {/* Search Type Toggle */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap gap-4 mb-6">
            <button
              onClick={() => setSearchType('prescription')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                searchType === 'prescription'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Prescription Lenses
            </button>
            <button
              onClick={() => setSearchType('contact')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                searchType === 'contact'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Contact Lenses
            </button>
          </div>

          {/* Search Form */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Right Eye */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Right Eye (OD)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SPH
                  </label>
                  <input
                    type="text"
                    value={searchType === 'prescription' ? prescriptionForm.right.sph : contactForm.right.sph}
                    onChange={(e) => searchType === 'prescription' 
                      ? handlePrescriptionChange('right', 'sph', e.target.value)
                      : handleContactChange('right', 'sph', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. -2.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CYL
                  </label>
                  <input
                    type="text"
                    value={searchType === 'prescription' ? prescriptionForm.right.cyl : contactForm.right.cyl}
                    onChange={(e) => searchType === 'prescription' 
                      ? handlePrescriptionChange('right', 'cyl', e.target.value)
                      : handleContactChange('right', 'cyl', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. -0.75"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    AXIS
                  </label>
                  <input
                    type="text"
                    value={searchType === 'prescription' ? prescriptionForm.right.axis : contactForm.right.axis}
                    onChange={(e) => searchType === 'prescription' 
                      ? handlePrescriptionChange('right', 'axis', e.target.value)
                      : handleContactChange('right', 'axis', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. 90"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ADD
                  </label>
                  <input
                    type="text"
                    value={searchType === 'prescription' ? prescriptionForm.right.add : contactForm.right.add}
                    onChange={(e) => searchType === 'prescription' 
                      ? handlePrescriptionChange('right', 'add', e.target.value)
                      : handleContactChange('right', 'add', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. +1.50"
                  />
                </div>
              </div>
            </div>

            {/* Left Eye */}
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Left Eye (OS)</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    SPH
                  </label>
                  <input
                    type="text"
                    value={searchType === 'prescription' ? prescriptionForm.left.sph : contactForm.left.sph}
                    onChange={(e) => searchType === 'prescription' 
                      ? handlePrescriptionChange('left', 'sph', e.target.value)
                      : handleContactChange('left', 'sph', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. -2.25"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    CYL
                  </label>
                  <input
                    type="text"
                    value={searchType === 'prescription' ? prescriptionForm.left.cyl : contactForm.left.cyl}
                    onChange={(e) => searchType === 'prescription' 
                      ? handlePrescriptionChange('left', 'cyl', e.target.value)
                      : handleContactChange('left', 'cyl', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. -1.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    AXIS
                  </label>
                  <input
                    type="text"
                    value={searchType === 'prescription' ? prescriptionForm.left.axis : contactForm.left.axis}
                    onChange={(e) => searchType === 'prescription' 
                      ? handlePrescriptionChange('left', 'axis', e.target.value)
                      : handleContactChange('left', 'axis', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. 85"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    ADD
                  </label>
                  <input
                    type="text"
                    value={searchType === 'prescription' ? prescriptionForm.left.add : contactForm.left.add}
                    onChange={(e) => searchType === 'prescription' 
                      ? handlePrescriptionChange('left', 'add', e.target.value)
                      : handleContactChange('left', 'add', e.target.value)
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="e.g. +1.75"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Lens Additional Fields */}
          {searchType === 'contact' && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Brand (Optional)
                </label>
                <input
                  type="text"
                  value={contactForm.brand}
                  onChange={(e) => setContactForm(prev => ({ ...prev, brand: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g. Johnson & Johnson"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type (Optional)
                </label>
                <input
                  type="text"
                  value={contactForm.type}
                  onChange={(e) => setContactForm(prev => ({ ...prev, type: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g. Daily, Monthly"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color (Optional)
                </label>
                <input
                  type="text"
                  value={contactForm.color}
                  onChange={(e) => setContactForm(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g. Blue, Brown"
                />
              </div>
            </div>
          )}

          {/* Search Buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? (
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Searching...
                </div>
              ) : (
                '🔍 Search Reflex Shop'
              )}
            </button>
            <button
              onClick={clearSearch}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors font-medium"
            >
              Clear Search
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Search Results */}
        {hasSearched && searchResults.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Found {searchResults.length} matching lens{searchResults.length > 1 ? 'es' : ''} from other distributors
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((lens, index) => (
                <div key={`${lens.shopId || lens.id}_${index}`} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-lg transition-shadow">
                  {/* Lens Details */}
                  <div className="mb-4">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {lens.brandName || 'Generic Lens'}
                      </h3>
                      <span className="text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-2 py-1 rounded">
                        {lens.matchQuality}% match
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Eye: <span className="font-medium">{lens.matchedFor === 'right' ? 'Right' : 'Left'}</span></div>
                      <div>SPH: <span className="font-medium">{lens.sph}</span></div>
                      {lens.cyl && <div>CYL: <span className="font-medium">{lens.cyl}</span></div>}
                      {lens.axis && <div>AXIS: <span className="font-medium">{lens.axis}</span></div>}
                      {lens.add && <div>ADD: <span className="font-medium">{lens.add}</span></div>}
                      {lens.material && <div>Material: <span className="font-medium">{lens.material}</span></div>}
                      {lens.powerSeries && <div>Power Series: <span className="font-medium">{lens.powerSeries}</span></div>}
                      <div>Quantity: <span className="font-medium">{lens.qty || 1} pairs</span></div>
                      <div className="text-green-600 dark:text-green-400 font-semibold">
                        Price: {formatCurrency(lens.salePrice)}
                      </div>
                    </div>
                  </div>

                  {/* Distributor Info */}
                  <div className="border-t border-gray-200 dark:border-gray-600 pt-3 mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">Distributor</h4>
                    <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                      <div>Shop: <span className="font-medium">{lens.userInfo?.opticalName || 'Optical Store'}</span></div>
                      <div>City: <span className="font-medium">{lens.userInfo?.city || 'Not specified'}</span></div>
                      <div>Phone: <span className="font-medium">{lens.userInfo?.phone || 'Contact via shop'}</span></div>
                    </div>
                  </div>

                  {/* Contact Button */}
                  <button
                    onClick={() => contactDistributor(lens.userInfo, lens)}
                    className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors font-medium"
                  >
                    📞 Contact Distributor
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Results Message */}
        {hasSearched && searchResults.length === 0 && !error && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-400 dark:text-gray-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No matching lenses found</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              No other distributors have lenses matching your search criteria.
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Try adjusting your search parameters or check back later as more distributors join the marketplace.
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Shop; 
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import { ArrowLeftIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

const CreateCustomer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isPopupMode, setIsPopupMode] = useState(location.state?.isPopupMode || false);
  
  // Check if this component is running in popup mode
  useEffect(() => {
    // Check if we are in a popup window
    const checkPopupMode = () => {
      // First check location state
      if (location.state?.isPopupMode) {
        setIsPopupMode(true);
        return;
      }
      
      // Then check for window.opener which indicates we're in a popup
      if (window.opener && window.opener !== window) {
        setIsPopupMode(true);
        return;
      }
    };
    
    checkPopupMode();
    
    // Also listen for popstate events which might be triggered by parent window
    const handlePopState = (event) => {
      if (event.state?.isPopupMode) {
        setIsPopupMode(true);
      }
    };
    
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [location]);
  
  const [formData, setFormData] = useState({
    opticalName: '',
    contactPerson: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    gstNumber: '',
    creditLimit: '',
    openingBalance: '',
    creditPeriod: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    if (!formData.opticalName.trim()) {
      setError('Optical Name is required');
      return false;
    }
    if (!formData.contactPerson.trim()) {
      setError('Contact Person is required');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      return false;
    }
    if (!formData.city.trim()) {
      setError('City is required');
      return false;
    }
    if (!formData.address.trim()) {
      setError('Full Address is required');
      return false;
    }
    if (!formData.pincode.trim()) {
      setError('Pin Code is required');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const customerData = {
        ...formData,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
        openingBalance: formData.openingBalance ? parseFloat(formData.openingBalance) : 0,
        creditPeriod: formData.creditPeriod ? parseInt(formData.creditPeriod, 10) : 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'customers'), customerData);
      
      if (isPopupMode) {
        if (window.opener && typeof window.opener.postMessage === 'function') {
          window.opener.postMessage({
            type: 'CUSTOMER_CREATED',
            customer: { id: docRef.id, name: customerData.opticalName, phone: customerData.phone, city: customerData.city }
          }, '*');
        }
        window.close();
      } else {
        navigate('/customers');
      }
    } catch (error) {
      console.error('Error saving customer:', error);
      setError('Failed to save customer. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const commonInputClassName = "mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm p-2.5";
  const fieldGroupClassName = "bg-slate-50 p-4 rounded-lg border border-gray-200";

  return (
    <div className={`min-h-screen ${isPopupMode ? 'bg-transparent' : 'bg-slate-50'}`}>
      {!isPopupMode && <Navbar />}
      
      <div className={`py-8 px-4 sm:px-6 lg:px-8 ${isPopupMode ? 'max-w-md mx-auto' : 'max-w-4xl mx-auto'}`}>
        <div className={`${isPopupMode ? 'bg-white rounded-xl shadow-2xl p-6' : 'bg-white shadow-xl rounded-lg p-6 md:p-8'}`}>
          {/* Header */}
          <div className="flex justify-between items-center mb-6 md:mb-8">
            <h1 className={`text-xl sm:text-2xl font-semibold ${isPopupMode ? 'text-gray-800' : 'text-gray-900'}`}>
              {isPopupMode ? 'Add New Customer' : 'Create New Customer'}
            </h1>
            <button
              onClick={() => isPopupMode ? window.close() : navigate('/customers')}
              className={`${isPopupMode ? 'text-gray-400 hover:text-gray-600' : 'flex items-center text-sm text-sky-600 hover:text-sky-700 font-medium'}`}
            >
              {isPopupMode ? <XMarkIcon className="w-6 h-6" /> : <><ArrowLeftIcon className="w-5 h-5 mr-1" /> Back to Customers</>}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md">
                <p className="font-medium">Error</p>
                <p className="text-sm">{error}</p>
              </div>
            )}

            {/* Business & Contact Information Section */}
            <div className="space-y-6">
              <h2 className="text-lg font-medium text-gray-700 border-b pb-2">Business & Contact</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                <div>
                  <label htmlFor="opticalName" className="block text-sm font-medium text-gray-700 mb-1">Optical Name *</label>
                  <input id="opticalName" type="text" name="opticalName" value={formData.opticalName} onChange={handleChange} className={commonInputClassName} placeholder="e.g. Vision Plus Optics" required />
                </div>
                <div>
                  <label htmlFor="contactPerson" className="block text-sm font-medium text-gray-700 mb-1">Contact Person *</label>
                  <input id="contactPerson" type="text" name="contactPerson" value={formData.contactPerson} onChange={handleChange} className={commonInputClassName} placeholder="e.g. John Doe" required />
                </div>
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                  <input id="phone" type="tel" name="phone" value={formData.phone} onChange={handleChange} className={commonInputClassName} placeholder="e.g. +919876543210" required />
                </div>
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                  <input id="email" type="email" name="email" value={formData.email} onChange={handleChange} className={commonInputClassName} placeholder="e.g. contact@optical.com" />
                </div>
                <div>
                  <label htmlFor="gstNumber" className="block text-sm font-medium text-gray-700 mb-1">GST Number (Optional)</label>
                  <input id="gstNumber" type="text" name="gstNumber" value={formData.gstNumber} onChange={handleChange} className={commonInputClassName} placeholder="e.g. 29AABBCCDDE1Z5" />
                </div>
              </div>
            </div>

            {/* Address Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-700 border-b pb-2">Address Details</h2>
              <div>
                <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Full Address *</label>
                <textarea id="address" name="address" value={formData.address} onChange={handleChange} rows={3} className={commonInputClassName} placeholder="Enter full address" required />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                  <input id="city" type="text" name="city" value={formData.city} onChange={handleChange} className={commonInputClassName} placeholder="e.g. Mumbai" required />
                </div>
                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">State</label>
                  <input id="state" type="text" name="state" value={formData.state} onChange={handleChange} className={commonInputClassName} placeholder="e.g. Maharashtra" />
                </div>
                <div>
                  <label htmlFor="pincode" className="block text-sm font-medium text-gray-700 mb-1">Pin Code *</label>
                  <input id="pincode" type="text" name="pincode" value={formData.pincode} onChange={handleChange} className={commonInputClassName} placeholder="e.g. 400001" required />
                </div>
              </div>
            </div>

            {/* Financial Information Section */}
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-gray-700 border-b pb-2">Financial Details</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-4">
                <div>
                  <label htmlFor="openingBalance" className="block text-sm font-medium text-gray-700 mb-1">Opening Balance (₹)</label>
                  <input id="openingBalance" type="number" name="openingBalance" value={formData.openingBalance} onChange={handleChange} className={commonInputClassName} placeholder="0.00" min="0" step="0.01" />
                </div>
                <div>
                  <label htmlFor="creditLimit" className="block text-sm font-medium text-gray-700 mb-1">Credit Limit (₹)</label>
                  <input id="creditLimit" type="number" name="creditLimit" value={formData.creditLimit} onChange={handleChange} className={commonInputClassName} placeholder="0.00" min="0" step="0.01" />
                </div>
                <div>
                  <label htmlFor="creditPeriod" className="block text-sm font-medium text-gray-700 mb-1">Credit Period (days)</label>
                  <input id="creditPeriod" type="number" name="creditPeriod" value={formData.creditPeriod} onChange={handleChange} className={commonInputClassName} placeholder="e.g. 30" min="0" step="1" />
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className={`flex ${isPopupMode ? 'justify-end' : 'justify-end border-t pt-6'} space-x-3 mt-8`}>
              <button
                type="button"
                onClick={() => isPopupMode ? window.close() : navigate('/customers')}
                className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </>
                ) : (isPopupMode ? <><PlusIcon className="w-5 h-5 mr-2 -ml-1" /> Add Customer</> : 'Save Customer')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCustomer; 
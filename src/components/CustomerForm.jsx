import { useState, useRef, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { toast } from 'react-hot-toast';
import { useShortcutContext, useKeyboardShortcut } from '../utils/keyboardShortcuts';

const CustomerForm = ({ onClose, customer, isVendor = false }) => {
  const modalRef = useRef(null);
  const [formData, setFormData] = useState({
    opticalName: customer?.opticalName || '',
    contactPerson: customer?.contactPerson || '',
    email: customer?.email || '',
    phone: customer?.phone || '',
    address: customer?.address || '',
    city: customer?.city || '',
    state: customer?.state || '',
    pincode: customer?.pincode || '',
    gstNumber: customer?.gstNumber || '',
    creditLimit: customer?.creditLimit || '',
    openingBalance: customer?.openingBalance || '',
    creditPeriod: customer?.creditPeriod || '',
    type: customer?.type || (isVendor ? 'vendor' : 'customer')
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('business'); // 'business', 'address', 'financial'
  const [savedCustomer, setSavedCustomer] = useState(null);

  // Set entity-specific labels - moved up to be available in all functions
  const entityName = isVendor ? 'Vendor' : 'Customer';
  const businessLabel = isVendor ? 'Business Name' : 'Optical Name';
  const businessPlaceholder = isVendor ? 'e.g. ABC Lens Suppliers' : 'e.g. Vision Plus Optics';

  // Handle modal scrolling when opened
  useEffect(() => {
    // Lock body scroll but allow modal to scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Set up modal context for keyboard shortcuts
  useShortcutContext('customer-form');

  // ESC key to close modal with highest priority
  useKeyboardShortcut('escape', () => {
    onClose(false);
  }, {
    context: 'customer-form',
    priority: 'high',
    description: 'Close customer form modal'
  });

  // Handle ESC key to close modal (fallback)
  useEffect(() => {
    // Listen for custom close modal events
    const handleCloseModal = () => {
      onClose(false);
    };

    window.addEventListener('closeModal', handleCloseModal);
    
    return () => {
      window.removeEventListener('closeModal', handleCloseModal);
    };
  }, [onClose]);

  // Handle notification of creating a new customer if the form was opened from a popup
  useEffect(() => {
    if (savedCustomer && window.opener && typeof window.opener.postMessage === 'function') {
      window.opener.postMessage({
        type: isVendor ? 'VENDOR_CREATED' : 'CUSTOMER_CREATED',
        customer: { 
          id: savedCustomer.id, 
          name: savedCustomer.opticalName, 
          phone: savedCustomer.phone, 
          city: savedCustomer.city 
        }
      }, '*');
    }
  }, [savedCustomer, isVendor]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const validateForm = () => {
    const entityType = isVendor ? 'Business Name' : 'Optical Name';
    
    if (!formData.opticalName.trim()) {
      setError(`${entityType} is required`);
      setActiveSection('business');
      return false;
    }
    if (!formData.contactPerson.trim()) {
      setError('Contact Person is required');
      setActiveSection('business');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('Phone number is required');
      setActiveSection('business');
      return false;
    }
    if (!formData.city.trim()) {
      setError('City is required');
      setActiveSection('address');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      setLoading(true);
      
      // Log form data for debugging
      // REMOVED FOR PRODUCTION: console.log('Submitting customer form with data:', formData);
      // REMOVED FOR PRODUCTION: console.log('Phone field value:', formData.phone);
      
      // Check if it's an edit or create
      if (customer) {
        // Update existing customer
        await updateDoc(getUserDoc('customers', customer.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
        
        // REMOVED FOR PRODUCTION: console.log(`Updated ${entityName}:`, customer.id);
        // REMOVED FOR PRODUCTION: console.log('Updated data includes phone:', formData.phone);
        
        toast.success(`${entityName} updated successfully!`);
      } else {
        // Create new customer
        const docRef = await addDoc(getUserCollection('customers'), {
          ...formData,
          createdAt: serverTimestamp()
        });
        
        // REMOVED FOR PRODUCTION: console.log(`Created new ${entityName}:`, docRef.id);
        // REMOVED FOR PRODUCTION: console.log('New customer data includes phone:', formData.phone);
        
        toast.success(`${entityName} created successfully!`);
      }
      
      // Close the form and refresh the parent component
      onClose(true);
    } catch (error) {
      console.error(`Error saving ${entityName.toLowerCase()}:`, error);
      toast.error(`Failed to save ${entityName.toLowerCase()}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Close modal when clicking outside
  const handleBackdropClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      // Pass false to onClose to indicate no customer was added/updated
      onClose(false);
    }
  };

  const handleCancelClick = () => {
    // Pass false to onClose to indicate no customer was added/updated
    onClose(false);
  };

  const inputClassName = "mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-700 dark:text-gray-100 shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-2 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm focus:outline-none";
  const labelClassName = "block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1";
  const sectionClassName = "transition-all duration-200 ease-in-out";

  return (
    <div 
      className="fixed inset-0 bg-gray-800 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-85 backdrop-blur-sm flex items-start justify-center p-4 z-50 transition-opacity duration-300 ease-in-out opacity-100 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl my-8 transform transition-all duration-300 ease-in-out scale-100"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
      >
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="flex justify-between items-center mb-8 sticky top-0 bg-white dark:bg-gray-800 z-10 pb-3">
            <h3 className="text-2xl font-semibold text-gray-800 dark:text-white">
              {customer ? `Edit ${entityName}` : `Add New ${entityName}`}
            </h3>
            <button
              onClick={() => onClose(false)}
              className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          
          {error && (
            <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 text-red-700 dark:text-red-400 rounded-md">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-gray-200 dark:border-gray-600 mb-6">
            <button 
              type="button" 
              onClick={() => setActiveSection('business')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSection === 'business' 
                  ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400 -mb-px' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Business & Contact
            </button>
            <button 
              type="button" 
              onClick={() => setActiveSection('address')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSection === 'address' 
                  ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400 -mb-px' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Address Details
            </button>
            <button 
              type="button" 
              onClick={() => setActiveSection('financial')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSection === 'financial' 
                  ? 'text-sky-600 dark:text-sky-400 border-b-2 border-sky-600 dark:border-sky-400 -mb-px' 
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Financial Details
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Business & Contact Information Section */}
            <div className={`${sectionClassName} ${activeSection === 'business' ? 'block' : 'hidden'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label htmlFor="opticalName" className={labelClassName}>
                    {businessLabel} <span className="text-red-500">*</span>
                  </label>
                  <input 
                    id="opticalName" 
                    type="text" 
                    name="opticalName" 
                    value={formData.opticalName} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder={businessPlaceholder} 
                    required 
                  />
                </div>
                <div>
                  <label htmlFor="contactPerson" className={labelClassName}>
                    Contact Person <span className="text-red-500">*</span>
                  </label>
                  <input 
                    id="contactPerson" 
                    type="text" 
                    name="contactPerson" 
                    value={formData.contactPerson} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. John Doe" 
                    required 
                  />
                </div>
                <div>
                  <label htmlFor="phone" className={labelClassName}>
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input 
                    id="phone" 
                    type="tel" 
                    name="phone" 
                    value={formData.phone} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. +919876543210" 
                    required 
                  />
                </div>
                <div>
                  <label htmlFor="email" className={labelClassName}>
                    Email
                  </label>
                  <input 
                    id="email" 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. contact@example.com" 
                  />
                </div>
                <div>
                  <label htmlFor="gstNumber" className={labelClassName}>
                    GST Number
                  </label>
                  <input 
                    id="gstNumber" 
                    type="text" 
                    name="gstNumber" 
                    value={formData.gstNumber} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. 29ABCDE1234F1Z5" 
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => setActiveSection('address')}
                  className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 dark:focus:ring-sky-400 transition-colors"
                >
                  Next: Address Details
                </button>
              </div>
            </div>

            {/* Address Section */}
            <div className={`${sectionClassName} ${activeSection === 'address' ? 'block' : 'hidden'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div className="md:col-span-2">
                  <label htmlFor="address" className={labelClassName}>
                    Address
                  </label>
                  <input 
                    id="address" 
                    type="text" 
                    name="address" 
                    value={formData.address} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. 123 Main Street, Building A" 
                  />
                </div>
                <div>
                  <label htmlFor="city" className={labelClassName}>
                    City <span className="text-red-500">*</span>
                  </label>
                  <input 
                    id="city" 
                    type="text" 
                    name="city" 
                    value={formData.city} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. Mumbai" 
                    required 
                  />
                </div>
                <div>
                  <label htmlFor="state" className={labelClassName}>
                    State
                  </label>
                  <input 
                    id="state" 
                    type="text" 
                    name="state" 
                    value={formData.state} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. Maharashtra" 
                  />
                </div>
                <div>
                  <label htmlFor="pincode" className={labelClassName}>
                    PIN Code
                  </label>
                  <input 
                    id="pincode" 
                    type="text" 
                    name="pincode" 
                    value={formData.pincode} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. 400001" 
                  />
                </div>
              </div>
              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveSection('business')}
                  className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-500 dark:focus:ring-gray-400 transition-colors"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('financial')}
                  className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 dark:focus:ring-sky-400 transition-colors"
                >
                  Next: Financial Details
                </button>
              </div>
            </div>

            {/* Financial Section */}
            <div className={`${sectionClassName} ${activeSection === 'financial' ? 'block' : 'hidden'}`}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div>
                  <label htmlFor="creditLimit" className={labelClassName}>
                    Credit Limit (₹)
                  </label>
                  <input 
                    id="creditLimit" 
                    type="number" 
                    name="creditLimit" 
                    value={formData.creditLimit} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. 25000" 
                    min="0" 
                  />
                </div>
                <div>
                  <label htmlFor="openingBalance" className={labelClassName}>
                    Opening Balance (₹)
                  </label>
                  <input 
                    id="openingBalance" 
                    type="number" 
                    name="openingBalance" 
                    value={formData.openingBalance} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. 5000" 
                  />
                </div>
                <div>
                  <label htmlFor="creditPeriod" className={labelClassName}>
                    Credit Period (Days)
                  </label>
                  <input 
                    id="creditPeriod" 
                    type="number" 
                    name="creditPeriod" 
                    value={formData.creditPeriod} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. 30" 
                    min="0" 
                  />
                </div>
              </div>
              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveSection('address')}
                  className="px-4 py-2 text-sm font-medium bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-500 dark:focus:ring-gray-400 transition-colors"
                >
                  Back
                </button>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleCancelClick}
                    className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 dark:focus:ring-sky-400 transition-colors"
                    disabled={loading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 dark:focus:ring-sky-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    disabled={loading}
                  >
                    {loading ? 'Saving...' : (customer ? `Update ${entityName}` : `Save ${entityName}`)}
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CustomerForm; 
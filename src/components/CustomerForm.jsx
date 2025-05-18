import { useState, useRef, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { XMarkIcon } from '@heroicons/react/24/outline';

const CustomerForm = ({ onClose, customer }) => {
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
    creditPeriod: customer?.creditPeriod || ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState('business'); // 'business', 'address', 'financial'
  const [savedCustomer, setSavedCustomer] = useState(null);

  // Handle modal scrolling when opened
  useEffect(() => {
    // Lock body scroll but allow modal to scroll
    document.body.style.overflow = 'hidden';
    
    return () => {
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'auto';
    };
  }, []);

  // Handle notification of creating a new customer if the form was opened from a popup
  useEffect(() => {
    if (savedCustomer && window.opener && typeof window.opener.postMessage === 'function') {
      window.opener.postMessage({
        type: 'CUSTOMER_CREATED',
        customer: { 
          id: savedCustomer.id, 
          name: savedCustomer.opticalName, 
          phone: savedCustomer.phone, 
          city: savedCustomer.city 
        }
      }, '*');
    }
  }, [savedCustomer]);

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
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const customerData = {
        ...formData,
        creditLimit: formData.creditLimit ? parseFloat(formData.creditLimit) : 0,
        openingBalance: formData.openingBalance ? parseFloat(formData.openingBalance) : 0,
        creditPeriod: formData.creditPeriod ? parseInt(formData.creditPeriod, 10) : 0,
        updatedAt: serverTimestamp()
      };

      if (customer) {
        await updateDoc(doc(db, 'customers', customer.id), customerData);
        setSavedCustomer({ id: customer.id, ...customerData });
      } else {
        customerData.createdAt = serverTimestamp();
        const docRef = await addDoc(collection(db, 'customers'), customerData);
        setSavedCustomer({ id: docRef.id, ...customerData });
      }
      // Pass true to onClose to indicate a customer was added/updated
      onClose(true);
    } catch (error) {
      console.error('Error saving customer:', error);
      setError('Failed to save customer. Please try again.');
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

  const inputClassName = "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-700 shadow-sm focus:border-sky-500 focus:ring-2 focus:ring-sky-500 text-sm focus:outline-none";
  const labelClassName = "block text-sm font-medium text-gray-700 mb-1";
  const sectionClassName = "transition-all duration-200 ease-in-out";

  return (
    <div 
      className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm flex items-start justify-center p-4 z-50 transition-opacity duration-300 ease-in-out opacity-100 overflow-y-auto"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl my-8 transform transition-all duration-300 ease-in-out scale-100"
        style={{ maxHeight: 'calc(100vh - 4rem)' }}
      >
        <div className="p-6 overflow-y-auto max-h-[calc(100vh-4rem)]">
          <div className="flex justify-between items-center mb-8 sticky top-0 bg-white z-10 pb-3">
            <h3 className="text-2xl font-semibold text-gray-800">
              {customer ? 'Edit Customer' : 'Add New Customer'}
            </h3>
            <button
              onClick={() => onClose(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors rounded-full p-1 hover:bg-gray-100"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          
          {error && (
            <div className="mb-6 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md">
              <p className="font-medium">Error</p>
              <p className="text-sm">{error}</p>
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b mb-6">
            <button 
              type="button" 
              onClick={() => setActiveSection('business')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSection === 'business' 
                  ? 'text-sky-600 border-b-2 border-sky-600 -mb-px' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Business & Contact
            </button>
            <button 
              type="button" 
              onClick={() => setActiveSection('address')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSection === 'address' 
                  ? 'text-sky-600 border-b-2 border-sky-600 -mb-px' 
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Address Details
            </button>
            <button 
              type="button" 
              onClick={() => setActiveSection('financial')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeSection === 'financial' 
                  ? 'text-sky-600 border-b-2 border-sky-600 -mb-px' 
                  : 'text-gray-500 hover:text-gray-700'
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
                    Optical Name <span className="text-red-500">*</span>
                  </label>
                  <input 
                    id="opticalName" 
                    type="text" 
                    name="opticalName" 
                    value={formData.opticalName} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. Vision Plus Optics" 
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
                    Email Address
                  </label>
                  <input 
                    id="email" 
                    type="email" 
                    name="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. contact@optical.com" 
                  />
                </div>
                <div className="md:col-span-2">
                  <label htmlFor="gstNumber" className={labelClassName}>
                    GST Number (Optional)
                  </label>
                  <input 
                    id="gstNumber" 
                    type="text" 
                    name="gstNumber" 
                    value={formData.gstNumber} 
                    onChange={handleChange} 
                    className={inputClassName} 
                    placeholder="e.g. 29AABBCCDDE1Z5" 
                  />
                </div>
              </div>
              
              <div className="mt-6 text-right">
                <button
                  type="button"
                  onClick={() => setActiveSection('address')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Next: Address Details
                </button>
              </div>
            </div>

            {/* Address Section */}
            <div className={`${sectionClassName} ${activeSection === 'address' ? 'block' : 'hidden'}`}>
              <div className="space-y-5">
                <div>
                  <label htmlFor="address" className={labelClassName}>
                    Full Address
                  </label>
                  <textarea 
                    id="address" 
                    name="address" 
                    value={formData.address} 
                    onChange={handleChange} 
                    rows={3} 
                    className={inputClassName} 
                    placeholder="Enter full address" 
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
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
              </div>
              
              <div className="mt-6 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveSection('business')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSection('financial')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Next: Financial Details
                </button>
              </div>
            </div>

            {/* Financial Information Section */}
            <div className={`${sectionClassName} ${activeSection === 'financial' ? 'block' : 'hidden'}`}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-5">
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
                    placeholder="0.00" 
                    min="0" 
                    step="0.01" 
                  />
                </div>
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
                    placeholder="0.00" 
                    min="0" 
                    step="0.01" 
                  />
                </div>
                <div>
                  <label htmlFor="creditPeriod" className={labelClassName}>
                    Credit Period (days)
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
                    step="1" 
                  />
                </div>
              </div>
              
              <div className="mt-8 flex justify-between">
                <button
                  type="button"
                  onClick={() => setActiveSection('address')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Back
                </button>
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={handleCancelClick}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Saving...
                      </>
                    ) : customer ? 'Update Customer' : 'Add Customer'}
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
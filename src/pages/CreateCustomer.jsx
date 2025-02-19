import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';

const CreateCustomer = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isPopupMode = location.state?.isPopupMode;
  
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
    openingBalance: ''
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'customers'), customerData);
      
      if (isPopupMode && window.opener) {
        // Send message to parent window
        window.opener.postMessage({
          type: 'CUSTOMER_CREATED',
          customer: { id: docRef.id, ...customerData }
        }, '*');
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

  return (
    <div className="min-h-screen bg-[#f7f7f7]">
      {!isPopupMode && <Navbar />}
      
      <div className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow-sm rounded-lg">
          {/* Header */}
          <div className="px-8 py-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-semibold text-gray-900">New Customer Address</h1>
              <button
                onClick={() => isPopupMode ? window.close() : navigate('/customers')}
                className="text-[#4169E1] hover:text-[#3154b3] font-medium"
              >
                {isPopupMode ? 'Close' : 'Back to Customers'}
              </button>
            </div>
          </div>

          <div className="px-8 py-6">
            <form onSubmit={handleSubmit}>
              {error && (
                <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
                  {error}
                </div>
              )}

              {/* ADDRESSES Section */}
              <div className="mb-8">
                <h2 className="text-lg font-medium text-gray-900 mb-6">ADDRESSES</h2>

                {/* Business Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Optical Name *
                    </label>
                    <input
                      type="text"
                      name="opticalName"
                      value={formData.opticalName}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      GST Number
                    </label>
                    <input
                      type="text"
                      name="gstNumber"
                      value={formData.gstNumber}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                    />
                  </div>
                </div>

                {/* Contact Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Contact Person *
                    </label>
                    <input
                      type="text"
                      name="contactPerson"
                      value={formData.contactPerson}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                    />
                  </div>
                </div>

                {/* Address Details */}
                <div className="grid grid-cols-1 gap-6 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address Line 1 *
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                      required
                    />
                  </div>
                </div>

                {/* Location Details */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City *
                    </label>
                    <input
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                      required
                    />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <select
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                    >
                      <option value="">Select State</option>
                      <option value="INDIANA">INDIANA</option>
                      {/* Add other states as needed */}
                    </select>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      name="pincode"
                      value={formData.pincode}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                    />
                  </div>
                </div>

                {/* Credit Information */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Credit Limit
                    </label>
                    <input
                      type="number"
                      name="creditLimit"
                      value={formData.creditLimit}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Opening Balance
                    </label>
                    <input
                      type="number"
                      name="openingBalance"
                      value={formData.openingBalance}
                      onChange={handleChange}
                      className="w-full bg-white border-gray-300 rounded-md shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1]"
                      min="0"
                      step="0.01"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-4 border-t pt-6">
                <button
                  type="button"
                  onClick={() => isPopupMode ? window.close() : navigate('/customers')}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 border border-transparent rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Adding...
                    </span>
                  ) : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCustomer; 
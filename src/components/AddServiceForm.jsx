import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, updateDoc, doc, Timestamp } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';

const SERVICE_TYPES = [
  'Eye Examination',
  'Contact Lens Fitting',
  'Frame Adjustment',
  'Frame Fitting',
  'Lens Replacement',
  'Prescription Update',
  'Eye Pressure Check',
  'Retinal Examination',
  'Consultation',
  'Follow-up Visit',
  'Emergency Service',
  'Home Service',
  'Other'
];

const AddServiceForm = ({ editMode, lensToEdit, onSubmit, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Service form data
  const [serviceData, setServiceData] = useState({
    serviceName: '',
    serviceType: '',
    serviceDescription: '',
    servicePrice: '',
    isActive: true,
    notes: ''
  });

  useEffect(() => {
    if (editMode && lensToEdit) {
      setServiceData({
        serviceName: lensToEdit.brandName || lensToEdit.serviceName || '',
        serviceType: lensToEdit.serviceType || '',
        serviceDescription: lensToEdit.serviceDescription || '',
        servicePrice: lensToEdit.salePrice || lensToEdit.servicePrice || '',
        isActive: lensToEdit.isActive !== undefined ? lensToEdit.isActive : true,
        notes: lensToEdit.notes || ''
      });
    }
  }, [editMode, lensToEdit]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setServiceData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!serviceData.serviceName.trim()) {
      setError('Service name is required');
      return;
    }
    
    if (!serviceData.servicePrice || parseFloat(serviceData.servicePrice) <= 0) {
      setError('Valid service price is required');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const serviceDocData = {
        brandName: serviceData.serviceName, // Using brandName for consistency with other items
        serviceName: serviceData.serviceName,
        serviceType: serviceData.serviceType,
        serviceDescription: serviceData.serviceDescription,
        salePrice: parseFloat(serviceData.servicePrice),
        servicePrice: parseFloat(serviceData.servicePrice),
        isActive: serviceData.isActive,
        notes: serviceData.notes,
        type: 'service',
        qty: 1, // Services always have quantity 1 pair
        name: serviceData.serviceName, // For compatibility with suggestion systems
        price: parseFloat(serviceData.servicePrice) // For compatibility with suggestion systems
      };

      if (editMode && lensToEdit) {
        // Update existing service
        await updateDoc(getUserDoc('lensInventory', lensToEdit.id), {
          ...serviceDocData,
          updatedAt: Timestamp.now()
        });
        setSuccess('Service updated successfully!');
      } else {
        // Create new service
        await addDoc(getUserCollection('lensInventory'), {
          ...serviceDocData,
          createdAt: Timestamp.now()
        });
        setSuccess('Service added successfully!');
      }
      
      // Reset form
      setServiceData({
        serviceName: '',
        serviceType: '',
        serviceDescription: '',
        servicePrice: '',
        isActive: true,
        notes: ''
      });
      
      // Call the parent's onSubmit callback
      if (onSubmit) {
        onSubmit();
      }
      
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Error saving service:', error);
      setError(`Failed to save service: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
          {editMode ? 'Edit Service' : 'Add New Service'}
        </h2>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-lg focus:outline-none text-sm"
        >
          Cancel
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 border-l-4 border-red-400 dark:border-red-500 rounded-r-md text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 border-l-4 border-green-400 dark:border-green-500 rounded-r-md text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/20">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{success}</p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Service Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Service Name *
            </label>
            <input
              type="text"
              name="serviceName"
              value={serviceData.serviceName}
              onChange={handleInputChange}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 px-3 py-2"
              placeholder="e.g., Basic Eye Examination"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Service Type
            </label>
            <select
              name="serviceType"
              value={serviceData.serviceType}
              onChange={handleInputChange}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 px-3 py-2"
            >
              <option value="">Select Service Type</option>
              {SERVICE_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Service Description
          </label>
          <textarea
            name="serviceDescription"
            value={serviceData.serviceDescription}
            onChange={handleInputChange}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 px-3 py-2"
            rows="3"
            placeholder="Detailed description of the service provided..."
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
              Service Price (₹) *
            </label>
            <input
              type="number"
              name="servicePrice"
              value={serviceData.servicePrice}
              onChange={handleInputChange}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 px-3 py-2 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              placeholder="0.00"
              min="0"
              step="0.01"
              required
            />
          </div>

          <div className="flex items-center">
            <div className="mt-6">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="isActive"
                  checked={serviceData.isActive}
                  onChange={handleInputChange}
                  className="rounded border-gray-300 dark:border-gray-600 text-sky-600 dark:text-sky-400 shadow-sm focus:border-sky-300 dark:focus:border-sky-500 focus:ring focus:ring-sky-200 dark:focus:ring-sky-800 focus:ring-opacity-50"
                />
                <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                  Service is active
                </span>
              </label>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
            Additional Notes
          </label>
          <textarea
            name="notes"
            value={serviceData.notes}
            onChange={handleInputChange}
            className="w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 px-3 py-2"
            rows="2"
            placeholder="Any additional information about this service..."
          />
        </div>

        {/* Submit Button */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-500 dark:focus:ring-gray-400"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-6 py-2 bg-teal-600 hover:bg-teal-700 dark:bg-teal-500 dark:hover:bg-teal-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-teal-500 dark:focus:ring-teal-400 disabled:opacity-50"
          >
            {loading && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {loading ? 'Saving...' : editMode ? 'Update Service' : 'Add Service'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddServiceForm; 
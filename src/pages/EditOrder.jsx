import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { collection, getDocs } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import OrderForm from '../components/OrderForm';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import CustomerForm from '../components/CustomerForm';
import { DocumentPlusIcon } from '@heroicons/react/24/outline';

const EditOrder = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    customerName: '',
    consumerName: '',
    brandName: '',
    material: '',
    index: '',
    lensType: '',
    baseTint: '',
    coatingType: '',
    coatingColour: '',
    diameter: '',
    fogMark: false,
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
    expectedDeliveryDate: '',
    price: '',
    specialNotes: ''
  });

  const [customers, setCustomers] = useState([]);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  useEffect(() => {
    fetchOrderDetails();
    fetchCustomers();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        setFormData(orderDoc.data());
      } else {
        setError('Order not found');
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
      setError('Failed to fetch order details');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customersRef = collection(db, 'customers');
      const snapshot = await getDocs(customersRef);
      const customersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to fetch customers');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setUpdating(true);
    setError('');
    setSuccessMessage('');

    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, formData);
      setSuccessMessage('Order updated successfully');
      
      // Show success for 1.5 seconds before redirecting
      setTimeout(() => {
        navigate(`/orders/${orderId}`);
      }, 1500);
      
    } catch (error) {
      console.error('Error updating order:', error);
      setError('Failed to update order');
    } finally {
      setUpdating(false);
    }
  };

  const handleCustomerFormClose = async (refreshNeeded = false) => {
    setShowCustomerForm(false);
    if (refreshNeeded) {
      await fetchCustomers();
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-pulse flex space-x-2 items-center">
            <div className="h-3 w-3 bg-sky-600 rounded-full"></div>
            <div className="h-3 w-3 bg-sky-600 rounded-full"></div>
            <div className="h-3 w-3 bg-sky-600 rounded-full"></div>
            <span className="text-gray-600 ml-2">Loading order details...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Navbar />
      
      <main className="flex-grow pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <button
                onClick={() => navigate('/orders')}
                className="flex items-center text-sm font-medium mb-4 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-400 border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-600 transform hover:scale-[1.02] duration-200"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Orders
              </button>
              <div className="flex items-center">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3.5 rounded-xl shadow-md mr-4">
                  <DocumentPlusIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">Edit Order</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Update the order details below</p>
                </div>
                {formData.displayId && (
                  <span className="ml-4 px-4 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-medium shadow-sm">
                    Order #{formData.displayId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area for OrderForm */}
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 sm:p-8 border-t-4 border-blue-500">
            {/* Error message display - stays above form */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/50 border-l-4 border-red-500 rounded-md text-red-700 dark:text-red-200 shadow-sm animate-pulse">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-red-500 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}
            
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="relative inline-flex">
                  <div className="w-8 h-8 bg-blue-600 rounded-full opacity-60 animate-ping"></div>
                  <div className="w-8 h-8 bg-blue-600 rounded-full absolute top-0 left-0"></div>
                </div>
                <span className="ml-3 text-gray-600 dark:text-gray-400">Loading order...</span>
              </div>
            ) : (
              <OrderForm
                formData={formData}
                onChange={handleInputChange}
                onSubmit={handleSubmit}
                customers={customers}
                onAddNewCustomer={() => setShowCustomerForm(true)}
                loading={updating}
                error={error}
                isEditing={true}
                sectionColors={SECTION_COLORS}
              />
            )}
            
            {/* Submit button for desktop view */}
            {!loading && (
              <div className="mt-10 hidden sm:flex sm:justify-end">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={updating}
                  className="relative px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 transition-all transform hover:scale-[1.02] duration-300 flex items-center justify-center font-medium overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600"></span>
                  <span className="absolute bottom-0 right-0 block w-64 h-64 mb-32 mr-4 transition-all duration-500 origin-bottom-left transform rotate-45 translate-x-24 bg-pink-500 opacity-30 group-hover:rotate-90 ease rounded-full"></span>
                  <span className="relative flex items-center">
                    {updating ? (
                      <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <DocumentPlusIcon className="w-5 h-5 mr-2" />
                    )}
                    {updating ? 'Updating Order...' : 'Update Order'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Floating Submit Button - Mobile Only */}
      {!loading && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-br from-blue-600 to-indigo-600 border-t border-blue-700 shadow-xl z-30 mb-[65px] sm:hidden">
          <div className="relative max-w-5xl mx-auto">
            {/* Animated background element */}
            <div className="absolute inset-0 overflow-hidden rounded-lg">
              <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] animate-pulse-slow bg-gradient-to-br from-blue-500/30 to-indigo-500/30 rounded-full"></div>
            </div>
            
            <button
              type="button"
              onClick={handleSubmit}
              disabled={updating}
              className="relative w-full px-4 py-3.5 bg-white text-blue-700 rounded-lg shadow-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] duration-300 flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updating ? (
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <DocumentPlusIcon className="w-5 h-5 mr-2" />
              )}
              {updating ? 'Updating Order...' : 'Update Order'}
            </button>
          </div>
        </div>
      )}

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerForm 
          onClose={handleCustomerFormClose}
          customer={null}
        />
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                      Order Updated Successfully
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Your order has been successfully updated and saved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate('/orders');
                  }}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EditOrder; 
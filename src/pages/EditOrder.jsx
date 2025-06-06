import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import OrderForm from '../components/OrderForm';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';
import CustomerForm from '../components/CustomerForm';
import { DocumentPlusIcon } from '@heroicons/react/24/outline';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { formatDate, safelyParseDate } from '../utils/dateUtils';

// Define section colors for the OrderForm
const SECTION_COLORS = {
  customer: 'from-blue-500 to-indigo-500',
  lens: 'from-green-500 to-emerald-500', 
  prescription: 'from-purple-500 to-violet-500',
  delivery: 'from-orange-500 to-red-500'
};

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
    if (orderId) {
      fetchOrderDetails();
      fetchCustomers();
    } else {
      setError('Order ID not provided');
      setLoading(false);
    }
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError('');
      const orderRef = getUserDoc('orders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        const rawOrderData = orderDoc.data();
        
        // Helper function to recursively clean timestamp objects from any value
        const cleanTimestampObjects = (obj, fieldName = '') => {
          if (obj === null || obj === undefined) {
            return obj;
          }
          
          // If it's a timestamp object, convert it appropriately
          if (obj && typeof obj === 'object' && obj.seconds !== undefined && obj.nanoseconds !== undefined) {
            // Skip fields that should never be dates - convert to appropriate defaults
            const skipFields = ['displayId', 'orderId', 'id', 'price', 'rightSph', 'rightCyl', 'rightAxis', 'rightAdd', 'rightQty',
                               'leftSph', 'leftCyl', 'leftAxis', 'leftAdd', 'leftQty', 'diameter', 'index', 'material', 'lensType',
                               'baseTint', 'coatingType', 'coatingColour', 'brandName', 'customerName', 'consumerName'];
            
            if (skipFields.includes(fieldName)) {
              if (fieldName === 'displayId' || fieldName === 'orderId') {
                return `ORD-${Math.random().toString(36).substr(2, 9)}`;
              } else if (['rightSph', 'rightCyl', 'rightAdd', 'leftSph', 'leftCyl', 'leftAdd'].includes(fieldName)) {
                return '0.00';
              } else if (['rightAxis', 'leftAxis'].includes(fieldName)) {
                return '0';
              } else if (['rightQty', 'leftQty'].includes(fieldName)) {
                return '1';
              } else if (fieldName === 'price') {
                return '0';
              } else if (fieldName === 'diameter' || fieldName === 'index') {
                return '';
              } else {
                return fieldName.includes('Name') ? 'Unknown' : '';
              }
            }
            
            // For date fields, convert to proper formatted string
            if (fieldName.includes('At') || fieldName.includes('Date') || fieldName.includes('Time') || 
                fieldName === 'createdAt' || fieldName === 'updatedAt' || fieldName === 'deletedAt' ||
                fieldName === 'expectedDeliveryDate' || fieldName === 'deliveryDate') {
              const date = safelyParseDate(obj);
              if (date && !isNaN(date.getTime())) {
                return date.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short', 
                  year: 'numeric'
                });
              }
              return 'Invalid Date';
            }
            
            // For any other timestamp objects, convert to empty string
            return '';
          }
          
          // If it's an array, clean each element
          if (Array.isArray(obj)) {
            return obj.map((item, index) => cleanTimestampObjects(item, `${fieldName}[${index}]`));
          }
          
          // If it's an object, clean each property
          if (obj && typeof obj === 'object') {
            const cleaned = {};
            Object.keys(obj).forEach(key => {
              cleaned[key] = cleanTimestampObjects(obj[key], key);
            });
            return cleaned;
          }
          
          // For primitive values, return as-is
          return obj;
        };
        
        // Clean the entire order data object
        const cleanedOrderData = cleanTimestampObjects(rawOrderData);
        
        setFormData({
          customerName: String(cleanedOrderData.customerName || ''),
          consumerName: String(cleanedOrderData.consumerName || ''),
          brandName: String(cleanedOrderData.brandName || ''),
          material: String(cleanedOrderData.material || ''),
          index: String(cleanedOrderData.index || ''),
          lensType: String(cleanedOrderData.lensType || ''),
          baseTint: String(cleanedOrderData.baseTint || ''),
          coatingType: String(cleanedOrderData.coatingType || ''),
          coatingColour: String(cleanedOrderData.coatingColour || ''),
          diameter: String(cleanedOrderData.diameter || ''),
          fogMark: cleanedOrderData.fogMark || false,
          rightSph: String(cleanedOrderData.rightSph || ''),
          rightCyl: String(cleanedOrderData.rightCyl || ''),
          rightAxis: String(cleanedOrderData.rightAxis || ''),
          rightAdd: String(cleanedOrderData.rightAdd || ''),
          rightQty: String(cleanedOrderData.rightQty || '1'),
          leftSph: String(cleanedOrderData.leftSph || ''),
          leftCyl: String(cleanedOrderData.leftCyl || ''),
          leftAxis: String(cleanedOrderData.leftAxis || ''),
          leftAdd: String(cleanedOrderData.leftAdd || ''),
          leftQty: String(cleanedOrderData.leftQty || '1'),
          expectedDeliveryDate: String(cleanedOrderData.expectedDeliveryDate || ''),
          price: String(cleanedOrderData.price || ''),
          specialNotes: String(cleanedOrderData.specialNotes || ''),
          displayId: String(cleanedOrderData.displayId || '')
        });
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
      const customersRef = getUserCollection('customers');
      const q = query(customersRef, where('type', '!=', 'vendor'));
      const snapshot = await getDocs(q);
      const customersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
      // Don't set error here as it's not critical for editing
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
      const orderRef = getUserDoc('orders', orderId);
      await updateDoc(orderRef, {
        ...formData,
        updatedAt: serverTimestamp()
      });
      
      setSuccessMessage('Order updated successfully');
      setShowSuccessModal(true);
      
    } catch (error) {
      console.error('Error updating order:', error);
      setError('Failed to update order. Please try again.');
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

  // Show error state if there's an error and not loading
  if (error && !loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="text-center">
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/50 border-l-4 border-red-500 rounded-md text-red-700 dark:text-red-200 shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-red-500 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                {error}
              </div>
            </div>
            <button
              onClick={() => navigate('/orders')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="animate-pulse flex space-x-2 items-center">
            <div className="h-3 w-3 bg-sky-600 dark:bg-sky-400 rounded-full animate-bounce"></div>
            <div className="h-3 w-3 bg-sky-600 dark:bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
            <div className="h-3 w-3 bg-sky-600 dark:bg-sky-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            <span className="text-gray-600 dark:text-gray-400 ml-2">Loading order details...</span>
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
                    Order #{String(formData.displayId)}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Success Message */}
          {successMessage && (
            <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/50 border-l-4 border-green-500 rounded-md text-green-700 dark:text-green-200 shadow-sm">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2 text-green-500 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                {successMessage}
              </div>
            </div>
          )}

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
          </div>
        </div>
      </main>

      {/* Floating Submit Button - Mobile Only (smaller size) */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-gradient-to-br from-blue-600 to-indigo-600 border-t border-blue-700 shadow-xl z-30 mb-[65px] sm:hidden">
        <div className="relative max-w-5xl mx-auto">
          {/* Animated background element */}
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] animate-pulse-slow bg-gradient-to-br from-blue-500/30 to-indigo-500/30 rounded-full"></div>
          </div>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={updating}
            className="relative w-full px-3 py-2 bg-white text-blue-700 rounded-lg shadow-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] duration-300 flex items-center justify-center font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {updating ? (
              <svg className="animate-spin -ml-1 mr-1.5 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <DocumentPlusIcon className="w-4 h-4 mr-1.5" />
            )}
            {updating ? 'Updating...' : 'Update Order'}
          </button>
        </div>
      </div>

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
                    navigate(`/orders/${orderId}`);
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
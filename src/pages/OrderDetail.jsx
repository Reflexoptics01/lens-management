import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// Helper functions to handle different timestamp formats after restore
const isFirestoreTimestamp = (value) => {
  return value && typeof value === 'object' && typeof value.toDate === 'function';
};

const isISODateString = (value) => {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value);
};

const convertToDate = (value) => {
  if (!value) return null;
  
  try {
    if (isFirestoreTimestamp(value)) {
      return value.toDate();
    } else if (isISODateString(value)) {
      return new Date(value);
    } else if (value instanceof Date) {
      return value;
    }
    return null;
  } catch (error) {
    console.error('Error converting timestamp:', error, value);
    return null;
  }
};

const ORDER_STATUSES = [
  'PENDING',
  'PLACED',
  'RECEIVED',
  'DISPATCHED',
  'DELIVERED',
  'CANCELLED',
  'DECLINED'
];

const STATUS_COLORS = {
  'PENDING': { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-300', gradient: 'from-amber-500 to-amber-600', icon: '⏳' },
  'PLACED': { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-300', gradient: 'from-blue-500 to-blue-600', icon: '📝' },
  'RECEIVED': { bg: 'bg-indigo-100 dark:bg-indigo-900/30', text: 'text-indigo-800 dark:text-indigo-300', gradient: 'from-indigo-500 to-indigo-600', icon: '✓' },
  'DISPATCHED': { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-300', gradient: 'from-purple-500 to-purple-600', icon: '🚚' },
  'DELIVERED': { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-300', gradient: 'from-green-500 to-green-600', icon: '📦' },
  'CANCELLED': { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-800 dark:text-red-300', gradient: 'from-red-500 to-red-600', icon: '❌' },
  'DECLINED': { bg: 'bg-gray-100 dark:bg-gray-900/30', text: 'text-gray-800 dark:text-gray-300', gradient: 'from-gray-500 to-gray-600', icon: '⛔' }
};

const OrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [vendorPhone, setVendorPhone] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [statusUpdateMessage, setStatusUpdateMessage] = useState('');
  const [progressStep, setProgressStep] = useState(0);

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  useEffect(() => {
    if (order?.status) {
      const statusIndex = ORDER_STATUSES.indexOf(order.status);
      setProgressStep(statusIndex);
    }
  }, [order?.status]);

  const fetchOrderDetails = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      
      console.log('Fetching order details for ID:', orderId);
      
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (!orderDoc.exists()) {
        console.log('Order document does not exist');
        setError('Order not found');
        return;
      }
      
      const rawOrderData = orderDoc.data();
      console.log('Raw order data:', rawOrderData);
      
      // Safely process the order data with fallbacks
      const processedOrderData = {
        id: orderDoc.id,
        // Required fields with fallbacks
        displayId: rawOrderData.displayId || 'Unknown',
        customerName: rawOrderData.customerName || 'Unknown Customer',
        consumerName: rawOrderData.consumerName || '',
        brandName: rawOrderData.brandName || 'Unknown Brand',
        status: rawOrderData.status || 'PENDING',
        
        // Handle timestamps safely
        createdAt: convertToDate(rawOrderData.createdAt) || new Date(),
        
        // Prescription data with fallbacks
        rightSph: rawOrderData.rightSph || '0.00',
        rightCyl: rawOrderData.rightCyl || '0.00',
        rightAxis: rawOrderData.rightAxis || '0',
        rightAdd: rawOrderData.rightAdd || '0.00',
        rightQty: rawOrderData.rightQty || '1',
        
        leftSph: rawOrderData.leftSph || '0.00',
        leftCyl: rawOrderData.leftCyl || '0.00',
        leftAxis: rawOrderData.leftAxis || '0',
        leftAdd: rawOrderData.leftAdd || '0.00',
        leftQty: rawOrderData.leftQty || '1',
        
        // Lens details with fallbacks
        material: rawOrderData.material || '',
        index: rawOrderData.index || '',
        lensType: rawOrderData.lensType || '',
        baseTint: rawOrderData.baseTint || '',
        diameter: rawOrderData.diameter || '',
        
        // Coating details with fallbacks
        coatingType: rawOrderData.coatingType || '',
        coatingColour: rawOrderData.coatingColour || '',
        fogMark: rawOrderData.fogMark || false,
        
        // Other details with fallbacks
        price: rawOrderData.price || '0',
        expectedDeliveryDate: rawOrderData.expectedDeliveryDate || '',
        specialNotes: rawOrderData.specialNotes || '',
        
        // Keep all other original fields
        ...rawOrderData
      };
      
      console.log('Processed order data:', processedOrderData);
      setOrder(processedOrderData);
      setSelectedStatus(processedOrderData.status);
      
      // Set progress step based on current status
      const statusIndex = ORDER_STATUSES.indexOf(processedOrderData.status);
      setProgressStep(statusIndex >= 0 ? statusIndex : 0);
      
    } catch (error) {
      console.error('Error fetching order details:', error);
      console.error('Error stack:', error.stack);
      setError(`Failed to fetch order details: ${error.message}. Please try refreshing the page.`);
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async () => {
    if (!order || !selectedStatus) return;
    
    setUpdatingStatus(true);
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: selectedStatus
      });
      
      // Update the local order state
      setOrder(prev => ({
        ...prev,
        status: selectedStatus
      }));
      
      // Update progress step based on new status
      const statusIndex = ORDER_STATUSES.indexOf(selectedStatus);
      setProgressStep(statusIndex >= 0 ? statusIndex : 0);
      
      setStatusUpdateMessage('Order status updated successfully');
      
      // Hide the success message after 3 seconds
      setTimeout(() => {
        setStatusUpdateMessage('');
        setShowStatusModal(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error updating order status:', error);
      setError('Failed to update order status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const sendWhatsAppMessage = (type, phone) => {
    if (!order || !phone) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    
    // Always use the displayId
    const displayOrderId = order.displayId;
    
    const message = type === 'vendor' 
      ? `🔔 *New Order #${displayOrderId}*\n\n` +
        `👤 *Consumer Details:*\n` +
        `Name: ${order.consumerName || 'N/A'}\n\n` +
        `🕶 *Order Details:*\n` +
        `Brand: ${order.brandName}\n` +
        `Expected Delivery: ${order.expectedDeliveryDate}\n\n` +
        `*Lens Details:*\n` +
        `📍 Material: ${order.material}\n` +
        `📍 Index: ${order.index}\n` +
        `📍 Type: ${order.lensType}\n` +
        `📍 Base Tint: ${order.baseTint}\n` +
        `📍 Coating: ${order.coatingType}${order.coatingColour ? ` - ${order.coatingColour}` : ''}\n` +
        `📍 Diameter: ${order.diameter}\n\n` +
        `*Prescription Details:*\n` +
        `Right Eye:\n` +
        `• SPH: ${order.rightSph || '0.00'}\n` +
        `• CYL: ${order.rightCyl || '0.00'}\n` +
        `• AXIS: ${order.rightAxis || '0'}\n` +
        `• ADD: ${order.rightAdd || '0.00'}\n` +
        `• Qty: ${order.rightQty || '1'} pieces\n\n` +
        `Left Eye:\n` +
        `• SPH: ${order.leftSph || '0.00'}\n` +
        `• CYL: ${order.leftCyl || '0.00'}\n` +
        `• AXIS: ${order.leftAxis || '0'}\n` +
        `• ADD: ${order.leftAdd || '0.00'}\n` +
        `• Qty: ${order.leftQty || '1'} pieces\n\n` +
        `💰 Price: ₹${order.price}\n` +
        (order.specialNotes ? `\n📝 *Special Notes:*\n${order.specialNotes}` : '')
      : `🎉 *Order Confirmation*\n\n` +
        `Dear ${order.customerName || 'Customer'},\n\n` +
        `Your order has been successfully placed!\n\n` +
        `*Order Details:*\n` +
        `Order Reference: #${displayOrderId}\n` +
        `Brand: ${order.brandName}\n` +
        `Expected Delivery: ${order.expectedDeliveryDate}\n\n` +
        `*Lens Details:*\n` +
        `${order.material ? `📍 Material: ${order.material}\n` : ''}` +
        `${order.index ? `📍 Index: ${order.index}\n` : ''}` +
        `${order.lensType ? `📍 Type: ${order.lensType}\n` : ''}` +
        `${order.baseTint ? `📍 Base Tint: ${order.baseTint}\n` : ''}` +
        `${order.coatingType ? `📍 Coating: ${order.coatingType}${order.coatingColour ? ` - ${order.coatingColour}` : ''}\n` : ''}` +
        `${order.diameter ? `📍 Diameter: ${order.diameter}\n` : ''}` +
        `\n*Prescription Details:*\n` +
        `Right Eye:\n` +
        `• SPH: ${order.rightSph || '0.00'}\n` +
        `• CYL: ${order.rightCyl || '0.00'}\n` +
        `• AXIS: ${order.rightAxis || '0'}\n` +
        `• ADD: ${order.rightAdd || '0.00'}\n` +
        `• Qty: ${order.rightQty || '1'} pieces\n\n` +
        `Left Eye:\n` +
        `• SPH: ${order.leftSph || '0.00'}\n` +
        `• CYL: ${order.leftCyl || '0.00'}\n` +
        `• AXIS: ${order.leftAxis || '0'}\n` +
        `• ADD: ${order.leftAdd || '0.00'}\n` +
        `• Qty: ${order.leftQty || '1'} pieces\n\n` +
        `💰 Amount: ₹${order.price}\n` +
        (order.specialNotes ? `\n📝 *Special Notes:*\n${order.specialNotes}\n\n` : '\n\n') +
        `Thank you for choosing our services! We'll keep you updated on your order status.`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  };

  const DataItem = ({ label, value, className = "" }) => (
    <div className={`${className} group transition-all duration-300 hover:bg-sky-50 dark:hover:bg-sky-900/30 hover:rounded-md p-1`}>
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 group-hover:text-sky-700 dark:group-hover:text-sky-300">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100 font-medium group-hover:text-sky-900 dark:group-hover:text-sky-200">{value || '-'}</dd>
    </div>
  );

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="relative inline-flex">
            <div className="w-12 h-12 bg-sky-600 rounded-full opacity-60 animate-ping"></div>
            <div className="w-12 h-12 bg-sky-600 rounded-full absolute top-0 left-0 flex items-center justify-center">
              <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
          </div>
          <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">Loading order details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 dark:from-gray-900 dark:to-red-900/30 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center border-t-4 border-red-500">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">Error</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">{error}</p>
          <button
            onClick={() => navigate('/orders')}
            className="w-full px-4 py-3 bg-gradient-to-r from-sky-500 to-sky-600 text-white font-medium rounded-lg hover:from-sky-600 hover:to-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 transition-all transform hover:scale-[1.02] duration-300 shadow-md"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-amber-50 dark:from-gray-900 dark:to-amber-900/30 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center border-t-4 border-amber-500">
          <div className="text-amber-500 text-6xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">Order Not Found</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8 bg-amber-50 dark:bg-amber-900/30 p-4 rounded-lg">We couldn't find the order you're looking for.</p>
          <button
            onClick={() => navigate('/orders')}
            className="w-full px-4 py-3 bg-gradient-to-r from-sky-500 to-sky-600 text-white font-medium rounded-lg hover:from-sky-600 hover:to-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 transition-all transform hover:scale-[1.02] duration-300 shadow-md"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // Protective wrapper to catch any rendering errors
  const renderOrderContent = () => {
    try {
      return (
        <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 to-sky-50 dark:from-gray-900 dark:to-gray-800">
          {/* Main content */}
          <main className="flex-grow pb-6">
            <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
                <div className="flex items-center">
                  <div className="bg-gradient-to-r from-sky-600 to-indigo-600 p-3 rounded-lg shadow-md mr-4">
                    <svg className="w-6 h-6 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-700 to-indigo-700 dark:from-sky-400 dark:to-indigo-400 bg-clip-text text-transparent">Order Details</h1>
                </div>
                <button
                  onClick={() => navigate('/orders')}
                  className="mt-4 sm:mt-0 inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 transition-all transform hover:scale-[1.02] duration-300"
                >
                  <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Orders
                </button>
              </div>

              {/* Status Update Message */}
              {statusUpdateMessage && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 text-green-700 dark:text-green-300 rounded-md shadow-sm animate-pulse">
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                    </svg>
                    {statusUpdateMessage}
                  </div>
                </div>
              )}

              {/* Order Progress Tracker */}
              <div className="mb-8 p-5 bg-white dark:bg-gray-800 rounded-xl shadow-md">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-gray-800 dark:text-white">Order Progress</h2>
                  <div className="flex items-center">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                      STATUS_COLORS[order?.status || 'PENDING']?.bg || 'bg-gray-100 dark:bg-gray-700'
                    } ${
                      STATUS_COLORS[order?.status || 'PENDING']?.text || 'text-gray-800 dark:text-gray-200'
                    }`}>
                      {STATUS_COLORS[order?.status || 'PENDING']?.icon} {order?.status || 'PENDING'}
                    </span>
                    <span className="ml-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
                      Order #{order?.displayId}
                    </span>
                    <span className="ml-4 font-semibold px-3 py-1 bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
                      ₹{order?.price}
                    </span>
                  </div>
                </div>
                
                {/* Progress Steps */}
                <div className="relative">
                  <div className="overflow-hidden h-2 mt-4 mb-6 text-xs flex rounded bg-gray-200 dark:bg-gray-700">
                    <div style={{ width: `${(progressStep / (ORDER_STATUSES.length - 1)) * 100}%` }} 
                      className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-gradient-to-r ${
                        STATUS_COLORS[order?.status || 'PENDING']?.gradient || 'from-sky-500 to-sky-600'
                      } transition-all duration-500 ease-in-out`}>
                    </div>
                  </div>
                  
                  <div className="flex justify-between -mt-2">
                    {ORDER_STATUSES.map((status, index) => (
                      <div key={status} className="relative flex flex-col items-center">
                        <div className={`w-5 h-5 rounded-full ${
                          index <= progressStep 
                            ? `bg-gradient-to-r ${STATUS_COLORS[order?.status || 'PENDING']?.gradient || 'from-sky-500 to-sky-600'}`
                            : 'bg-gray-300 dark:bg-gray-600'
                        } z-10 flex items-center justify-center`}>
                          {index <= progressStep && (
                            <svg className="w-3 h-3 text-white" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <div className={`text-xs mt-1 ${
                          index <= progressStep 
                            ? 'font-semibold text-gray-700 dark:text-gray-200' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {status.charAt(0) + status.slice(1).toLowerCase()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column */}
                <div className="lg:col-span-2 space-y-8">
                  {/* Order Information Card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-transform duration-300 hover:shadow-lg transform hover:-translate-y-1">
                    <div className="bg-gradient-to-r from-sky-600 to-indigo-600 px-6 py-4">
                      <h2 className="text-lg font-semibold text-white flex items-center">
                        <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Order Information
                      </h2>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                        <DataItem label="Order ID" value={`#${order.displayId}`} />
                        <DataItem label="Expected Delivery" value={order.expectedDeliveryDate} />
                        <DataItem label="Customer Name" value={order.customerName} />
                        <DataItem label="Consumer Name" value={order.consumerName} />
                        <DataItem label="Brand Name" value={order.brandName} />
                        
                        {order.specialNotes && (
                          <div className="sm:col-span-2 mt-4 p-4 bg-amber-50 dark:bg-amber-900/30 rounded-lg border-l-4 border-amber-400">
                            <h3 className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2 flex items-center">
                              <svg className="w-4 h-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              Special Instructions
                            </h3>
                            <p className="text-sm text-gray-700 dark:text-gray-300">{order.specialNotes}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Lens & Coating Details Card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-transform duration-300 hover:shadow-lg transform hover:-translate-y-1">
                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                      <h2 className="text-lg font-semibold text-white flex items-center">
                        <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                        </svg>
                        Lens & Coating Details
                      </h2>
                    </div>
                    <div className="p-6">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-8">
                        <div className="bg-gradient-to-br from-sky-50 to-sky-100 dark:from-sky-900/30 dark:to-sky-800/30 p-4 rounded-lg border border-sky-200 dark:border-sky-700">
                          <h3 className="text-sm font-semibold bg-gradient-to-r from-sky-700 to-indigo-700 dark:from-sky-300 dark:to-indigo-300 bg-clip-text text-transparent mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-1 text-sky-700 dark:text-sky-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Lens Details
                          </h3>
                          <div className="space-y-3">
                            <DataItem label="Material" value={order.material} />
                            <DataItem label="Index" value={order.index} />
                            <DataItem label="Lens Type" value={order.lensType} />
                            <DataItem label="Base Tint" value={order.baseTint} />
                            <DataItem label="Diameter" value={order.diameter} />
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                          <h3 className="text-sm font-semibold bg-gradient-to-r from-purple-700 to-pink-700 dark:from-purple-300 dark:to-pink-300 bg-clip-text text-transparent mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-1 text-purple-700 dark:text-purple-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                            </svg>
                            Coating
                          </h3>
                          <div className="space-y-3">
                            <DataItem label="Coating Type" value={order.coatingType} />
                            <DataItem label="Coating Colour" value={order.coatingColour} />
                            <DataItem label="Fog Mark" value={order.fogMark ? "Yes" : "No"} />
                          </div>
                        </div>
                        
                        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
                          <h3 className="text-sm font-semibold bg-gradient-to-r from-green-700 to-teal-700 dark:from-green-300 dark:to-teal-300 bg-clip-text text-transparent mb-3 flex items-center">
                            <svg className="w-4 h-4 mr-1 text-green-700 dark:text-green-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Additional Info
                          </h3>
                          <div className="mt-2 text-gray-600 dark:text-gray-300">
                            <DataItem label="Price" value={`₹${order.price}`} />
                            <DataItem label="Created" 
                              value={order.createdAt ? (() => {
                                try {
                                  const date = convertToDate(order.createdAt);
                                  return date ? date.toLocaleString('en-IN', {
                                    day: '2-digit',
                                    month: 'short', 
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : 'Invalid Date';
                                } catch (error) {
                                  console.error('Error formatting created date:', error);
                                  return 'Invalid Date';
                                }
                              })() : 'Not available'} />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-8">
                  {/* Prescription Details Card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-transform duration-300 hover:shadow-lg transform hover:-translate-y-1">
                    <div className="bg-gradient-to-r from-teal-600 to-green-600 px-6 py-4">
                      <h2 className="text-lg font-semibold text-white flex items-center">
                        <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Prescription
                      </h2>
                    </div>
                    
                    <div className="p-4 sm:p-6 bg-gradient-to-br from-white via-white to-green-50 dark:from-gray-800 dark:via-gray-800 dark:to-green-900/20">
                      {/* Professional Prescription Format */}
                      <div className="border-2 border-green-600 dark:border-green-500 rounded-lg overflow-hidden max-w-full">
                        {/* Prescription Header */}
                        <div className="bg-green-100 dark:bg-green-900/30 border-b border-green-600 dark:border-green-500 px-2 sm:px-4 py-2">
                          <div className="flex flex-wrap justify-between items-center gap-y-1">
                            <div className="flex items-center">
                              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-700 dark:text-green-300 mr-1 sm:mr-2 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                              <h3 className="font-bold text-green-800 dark:text-green-200 text-sm sm:text-base">Optical Prescription</h3>
                            </div>
                            <span className="text-xs sm:text-sm text-green-700 dark:text-green-300">Order #{order.displayId}</span>
                          </div>
                        </div>
                        
                        {/* Prescription Table */}
                        <div className="px-2 py-4 overflow-x-auto">
                          <table className="w-full text-sm border-collapse table-fixed">
                            <thead>
                              <tr className="bg-green-50 dark:bg-green-900/20">
                                <th className="py-2 px-1 text-left font-semibold text-green-800 dark:text-green-200 border border-green-200 dark:border-green-600 w-[25%]">Eye</th>
                                <th className="py-2 px-1 text-center font-semibold text-green-800 dark:text-green-200 border border-green-200 dark:border-green-600 w-[15%]">SPH</th>
                                <th className="py-2 px-1 text-center font-semibold text-green-800 dark:text-green-200 border border-green-200 dark:border-green-600 w-[15%]">CYL</th>
                                <th className="py-2 px-1 text-center font-semibold text-green-800 dark:text-green-200 border border-green-200 dark:border-green-600 w-[15%]">AXIS</th>
                                <th className="py-2 px-1 text-center font-semibold text-green-800 dark:text-green-200 border border-green-200 dark:border-green-600 w-[15%]">ADD</th>
                                <th className="py-2 px-1 text-center font-semibold text-green-800 dark:text-green-200 border border-green-200 dark:border-green-600 w-[15%]">QTY</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="bg-white dark:bg-gray-800 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
                                <td className="py-2 px-1 border border-green-200 dark:border-green-600 font-medium text-green-800 dark:text-green-200">
                                  <div className="flex items-center">
                                    <span className="w-2 h-2 bg-sky-600 mr-1 rounded-full inline-block"></span>
                                    <span className="truncate">OD (Right)</span>
                                  </div>
                                </td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.rightSph || '0.00'}</td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.rightCyl || '0.00'}</td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.rightAxis || '0'}</td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.rightAdd || '0.00'}</td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.rightQty || '1'}</td>
                              </tr>
                              <tr className="bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
                                <td className="py-2 px-1 border border-green-200 dark:border-green-600 font-medium text-green-800 dark:text-green-200">
                                  <div className="flex items-center">
                                    <span className="w-2 h-2 bg-sky-600 mr-1 rounded-full inline-block"></span>
                                    <span className="truncate">OS (Left)</span>
                                  </div>
                                </td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.leftSph || '0.00'}</td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.leftCyl || '0.00'}</td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.leftAxis || '0'}</td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.leftAdd || '0.00'}</td>
                                <td className="py-2 px-1 text-center border border-green-200 dark:border-green-600 font-medium text-gray-900 dark:text-gray-100 truncate">{order.leftQty || '1'}</td>
                              </tr>
                            </tbody>
                          </table>
                          
                          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 px-1">
                            <div className="flex flex-wrap gap-x-2 gap-y-1">
                              <span>SPH: Sphere</span>
                              <span>CYL: Cylinder</span>
                              <span>AXIS: Axis</span>
                              <span>ADD: Addition</span>
                              <span>QTY: Quantity</span>
                            </div>
                            <div className="flex flex-wrap gap-x-2 mt-1">
                              <span>OD: Oculus Dexter (Right Eye)</span>
                              <span>OS: Oculus Sinister (Left Eye)</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions Card */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-transform duration-300 hover:shadow-lg transform hover:-translate-y-1">
                    <div className="bg-gradient-to-r from-indigo-600 to-blue-600 px-6 py-4">
                      <h2 className="text-lg font-semibold text-white flex items-center">
                        <svg className="w-5 h-5 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        Actions
                      </h2>
                    </div>
                    <div className="p-6 bg-gradient-to-br from-white via-white to-blue-50 dark:from-gray-800 dark:via-gray-800 dark:to-blue-900/20">
                      <div className="space-y-4">
                        <button
                          onClick={() => setShowWhatsAppModal(true)} 
                          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-green-500 transition-all transform hover:scale-[1.02] duration-300"
                        >
                          <span className="mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592z"/>
                            </svg>
                          </span>
                          Send WhatsApp Messages
                        </button>
                        
                        <button
                          onClick={() => navigate(`/orders/edit/${order?.id}`)}
                          className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 transition-all transform hover:scale-[1.02] duration-300"
                        >
                          <span className="mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                            </svg>
                          </span>
                          Edit Order
                        </button>
                        
                        <button
                          onClick={() => setShowStatusModal(true)}
                          className="w-full flex items-center justify-center px-4 py-3 border-2 border-indigo-500 text-sm font-medium rounded-lg text-indigo-600 dark:text-indigo-400 bg-white dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 transition-all transform hover:scale-[1.02] duration-300 shadow-sm"
                        >
                          <span className="mr-2">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
                              <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                              <path d="M10.97 4.97a.235.235 0 0 0-.02.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-1.071-1.05z"/>
                            </svg>
                          </span>
                          Update Status
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </main>

          {/* WhatsApp Modal */}
          {showWhatsAppModal && (
            <div className="fixed inset-0 bg-gray-800 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-85 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out opacity-100">
              <div className="bg-gradient-to-br from-white to-green-50 dark:from-gray-800 dark:to-green-900/30 rounded-xl shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 p-6 border-t-4 border-green-500">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center">
                    <div className="bg-gradient-to-r from-green-500 to-green-600 p-2 rounded-lg mr-3 shadow-sm">
                      <svg className="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 16 16">
                        <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592z"/>
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold bg-gradient-to-r from-green-700 to-teal-700 dark:from-green-300 dark:to-teal-300 bg-clip-text text-transparent">Send Order Details</h3>
                  </div>
                  <button onClick={() => { setShowWhatsAppModal(false); setVendorPhone(''); }} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                
                <div className="space-y-5">
                  {/* Customer Phone Input */}
                  <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-green-100 dark:border-green-800">
                    <label htmlFor="customerPhone" className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-1 text-green-600 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Customer's Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 dark:text-gray-400 sm:text-sm">+</span>
                      </div>
                      <input
                        id="customerPhone"
                        type="tel"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="Country code and number (e.g., 911234567890)"
                        className="w-full rounded-lg border-green-200 dark:border-green-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white pl-7 px-3 py-2.5 shadow-sm focus:border-green-500 dark:focus:border-green-400 focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* Vendor Phone Input */}
                  <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-green-100 dark:border-green-800">
                    <label htmlFor="vendorPhone" className="block text-sm font-medium text-green-700 dark:text-green-300 mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-1 text-green-600 dark:text-green-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      Vendor's Phone Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-gray-500 dark:text-gray-400 sm:text-sm">+</span>
                      </div>
                      <input
                        id="vendorPhone"
                        type="tel"
                        value={vendorPhone}
                        onChange={(e) => setVendorPhone(e.target.value)}
                        placeholder="Country code and number (e.g., 911234567890)"
                        className="w-full rounded-lg border-green-200 dark:border-green-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white pl-7 px-3 py-2.5 shadow-sm focus:border-green-500 dark:focus:border-green-400 focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-3 sm:space-y-0">
                  <button
                    type="button"
                    onClick={() => {
                      setShowWhatsAppModal(false);
                      setVendorPhone('');
                      setCustomerPhone('');
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-400 shadow-sm transition-all"
                  >
                    Cancel
                  </button>
                  {customerPhone && (
                    <button
                      type="button"
                      onClick={() => sendWhatsAppMessage('customer', customerPhone)}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-blue-500 transition-all transform hover:scale-[1.02] duration-300"
                    >
                      <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send to Customer
                    </button>
                  )}
                  {vendorPhone && (
                    <button
                      type="button"
                      onClick={() => sendWhatsAppMessage('vendor', vendorPhone)}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-green-500 transition-all transform hover:scale-[1.02] duration-300"
                    >
                      <svg className="w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send to Vendor
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Status Update Modal */}
          {showStatusModal && (
            <div className="fixed inset-0 bg-gray-800 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-85 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out opacity-100">
              <div className="bg-gradient-to-br from-white to-indigo-50 dark:from-gray-800 dark:to-indigo-900/30 rounded-xl shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 p-6 border-t-4 border-indigo-500">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center">
                    <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-2 rounded-lg mr-3 shadow-sm">
                      <svg className="w-5 h-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold bg-gradient-to-r from-indigo-700 to-purple-700 bg-clip-text text-transparent">Update Order Status</h3>
                  </div>
                  <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                  </button>
                </div>
                
                <div className="space-y-4">
                  <div className="bg-white dark:bg-gray-700 p-4 rounded-lg shadow-sm border border-indigo-100 dark:border-indigo-800">
                    <label htmlFor="status" className="block text-sm font-medium text-indigo-700 dark:text-indigo-300 mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-1 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Order Status
                    </label>
                    <div className="relative mt-1">
                      <select
                        id="status"
                        value={selectedStatus}
                        onChange={(e) => setSelectedStatus(e.target.value)}
                        className="w-full rounded-lg border-indigo-200 dark:border-indigo-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-white px-3 py-2.5 shadow-sm focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 text-sm appearance-none pr-10"
                      >
                        {ORDER_STATUSES.map(status => (
                          <option key={status} value={status}>
                            {STATUS_COLORS[status]?.icon} {status}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-indigo-500 dark:text-indigo-400">
                        <svg className="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Preview */}
                  <div className="mt-2 p-3 bg-white dark:bg-gray-700 rounded-lg border border-indigo-100 dark:border-indigo-800 shadow-sm">
                    <div className="flex items-center">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mr-2 ${
                        STATUS_COLORS[selectedStatus]?.bg || 'bg-gray-100 dark:bg-gray-700'
                      } ${
                        STATUS_COLORS[selectedStatus]?.text || 'text-gray-800 dark:text-gray-200'
                      }`}>
                        {STATUS_COLORS[selectedStatus]?.icon} {selectedStatus}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">Preview</span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="px-4 py-2.5 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-400 shadow-sm transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={updateOrderStatus}
                    disabled={updatingStatus}
                    className="inline-flex items-center px-5 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-indigo-500 disabled:opacity-50 transition-all transform hover:scale-[1.02] duration-300"
                  >
                    {updatingStatus ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Updating...
                      </>
                    ) : 'Update Status'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    } catch (error) {
      console.error('Error rendering order content:', error);
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-red-50 dark:from-gray-900 dark:to-red-900/30 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg max-w-md w-full text-center border-t-4 border-red-500">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-3">Error</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-8 bg-red-50 dark:bg-red-900/30 p-4 rounded-lg">Failed to render order details. Please try refreshing the page.</p>
            <button
              onClick={() => navigate('/orders')}
              className="w-full px-4 py-3 bg-gradient-to-r from-sky-500 to-sky-600 text-white font-medium rounded-lg hover:from-sky-600 hover:to-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 transition-all transform hover:scale-[1.02] duration-300 shadow-md"
            >
              Back to Orders
            </button>
          </div>
        </div>
      );
    }
  };

  return renderOrderContent();
};

export default OrderDetail; 
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

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
  'PENDING': 'bg-yellow-100 text-yellow-800',
  'PLACED': 'bg-blue-100 text-blue-800',
  'RECEIVED': 'bg-indigo-100 text-indigo-800',
  'DISPATCHED': 'bg-purple-100 text-purple-800',
  'DELIVERED': 'bg-green-100 text-green-800',
  'CANCELLED': 'bg-red-100 text-red-800',
  'DECLINED': 'bg-gray-100 text-gray-800'
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

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() };
        setOrder(orderData);
        setSelectedStatus(orderData.status || 'PENDING');
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
    <div className={`${className}`}>
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900">{value || '-'}</dd>
    </div>
  );

  if (loading) {
    return (
      <div className="flex-grow flex items-center justify-center">
        <div className="animate-pulse flex space-x-2 items-center">
          <div className="h-3 w-3 bg-sky-600 rounded-full"></div>
          <div className="h-3 w-3 bg-sky-600 rounded-full"></div>
          <div className="h-3 w-3 bg-sky-600 rounded-full"></div>
          <span className="text-gray-600 ml-2">Loading order details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={() => navigate('/orders')}
            className="w-full px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <div className="text-yellow-500 text-5xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Order Not Found</h2>
          <p className="text-gray-600 mb-6">We couldn't find the order you're looking for.</p>
          <button
            onClick={() => navigate('/orders')}
            className="w-full px-4 py-2 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
          >
            Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      {/* Main content */}
      <main className="flex-grow pb-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <h1 className="text-2xl font-bold text-gray-800">Order Details</h1>
            <button
              onClick={() => navigate('/orders')}
              className="mt-2 sm:mt-0 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
            >
              Back to Orders
            </button>
          </div>

          {/* Status Update Message */}
          {statusUpdateMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-md">
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
                {statusUpdateMessage}
              </div>
            </div>
          )}

          {/* Order Status Banner */}
          <div className={`mb-6 p-4 rounded-lg ${
            order?.status === 'PENDING' ? 'bg-yellow-50 border border-yellow-200' : 
            order?.status === 'DELIVERED' ? 'bg-green-50 border border-green-200' : 
            order?.status === 'CANCELLED' ? 'bg-red-50 border border-red-200' : 
            'bg-gray-50 border border-gray-200'
          }`}>
            <div className="flex items-center">
              <div className={`w-2 h-2 rounded-full mr-2 ${
                order?.status === 'PENDING' ? 'bg-yellow-500' : 
                order?.status === 'DELIVERED' ? 'bg-green-500' : 
                order?.status === 'CANCELLED' ? 'bg-red-500' : 
                'bg-gray-500'
              }`}></div>
              <span className="font-medium text-sm capitalize">
                Status: {order?.status || 'PENDING'}
              </span>
              <span className="ml-4 text-sm text-gray-500">
                Order #{order?.displayId}
              </span>
              <span className="ml-auto font-medium text-sm">
                ₹{order?.price}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Order Information Card */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-800">Order Information</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                    <DataItem label="Order ID" value={`#${order.displayId}`} />
                    <DataItem label="Expected Delivery" value={order.expectedDeliveryDate} />
                    <DataItem label="Customer Name" value={order.customerName} />
                    <DataItem label="Consumer Name" value={order.consumerName} />
                    <DataItem label="Brand Name" value={order.brandName} />
                    <DataItem label="Special Instructions" value={order.specialNotes} className="sm:col-span-2" />
                  </div>
                </div>
              </div>

              {/* Lens & Coating Details Card */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-800">Lens & Coating Details</h2>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <div>
                      <h3 className="text-sm font-semibold text-sky-700 mb-3">Lens Details</h3>
                      <div className="space-y-3">
                        <DataItem label="Material" value={order.material} />
                        <DataItem label="Index" value={order.index} />
                        <DataItem label="Lens Type" value={order.lensType} />
                        <DataItem label="Base Tint" value={order.baseTint} />
                        <DataItem label="Diameter" value={order.diameter} />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-semibold text-sky-700 mb-3">Coating</h3>
                      <div className="space-y-3">
                        <DataItem label="Coating Type" value={order.coatingType} />
                        <DataItem label="Coating Colour" value={order.coatingColour} />
                        <DataItem label="Fog Mark" value={order.fogMark ? "Yes" : "No"} />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-sm font-semibold text-sky-700 mb-3">Additional Info</h3>
                      <div className="space-y-3">
                        <DataItem label="Price" value={`₹${order.price}`} />
                        <DataItem label="Created" 
                          value={order.createdAt ? new Date(order.createdAt.toDate()).toLocaleString() : '-'} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Prescription Details Card */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-800">Prescription</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="flex items-center text-sm font-semibold text-sky-700 mb-3">
                        <span className="w-3 h-3 bg-sky-600 mr-2 rounded-full inline-block"></span>
                        Right Eye
                      </h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <DataItem label="SPH" value={order.rightSph} />
                        <DataItem label="CYL" value={order.rightCyl} />
                        <DataItem label="AXIS" value={order.rightAxis} />
                        <DataItem label="ADD" value={order.rightAdd} />
                        <DataItem label="QTY" value={`${order.rightQty || '1'} pcs`} />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="flex items-center text-sm font-semibold text-sky-700 mb-3">
                        <span className="w-3 h-3 bg-sky-600 mr-2 rounded-full inline-block"></span>
                        Left Eye
                      </h3>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                        <DataItem label="SPH" value={order.leftSph} />
                        <DataItem label="CYL" value={order.leftCyl} />
                        <DataItem label="AXIS" value={order.leftAxis} />
                        <DataItem label="ADD" value={order.leftAdd} />
                        <DataItem label="QTY" value={`${order.leftQty || '1'} pcs`} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Actions Card */}
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="border-b border-gray-200 px-6 py-4">
                  <h2 className="text-lg font-semibold text-gray-800">Actions</h2>
                </div>
                <div className="p-6">
                  <div className="space-y-3">
                    <button
                      onClick={() => setShowWhatsAppModal(true)} 
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
                    >
                      <span className="mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
                        </svg>
                      </span>
                      Send WhatsApp Messages
                    </button>
                    <button
                      onClick={() => navigate(`/orders/edit/${order?.id}`)}
                      className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
                    >
                      <span className="mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                          <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168l10-10zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293l6.5-6.5zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325z"/>
                        </svg>
                      </span>
                      Edit Order
                    </button>
                    <button
                      onClick={() => setShowStatusModal(true)}
                      className="w-full flex items-center justify-center px-4 py-2 border border-sky-600 text-sm font-medium rounded-md text-sky-600 bg-white hover:bg-sky-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors"
                    >
                      <span className="mr-2">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
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
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out opacity-100">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Send Order Details</h3>
              <button onClick={() => { setShowWhatsAppModal(false); setVendorPhone(''); }} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="space-y-4">
              {/* Customer Phone Input */}
              <div>
                <label htmlFor="customerPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Customer's Phone Number
                </label>
                <input
                  id="customerPhone"
                  type="tel"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Enter with country code (e.g., +911234567890)"
                  className="w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm"
                />
              </div>
              
              {/* Vendor Phone Input */}
              <div>
                <label htmlFor="vendorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor's Phone Number
                </label>
                <input
                  id="vendorPhone"
                  type="tel"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="Enter with country code (e.g., +911234567890)"
                  className="w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-2 sm:space-y-0">
              <button
                type="button"
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setVendorPhone('');
                  setCustomerPhone('');
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                Cancel
              </button>
              {customerPhone && (
                <button
                  type="button"
                  onClick={() => sendWhatsAppMessage('customer', customerPhone)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Send to Customer
                </button>
              )}
              {vendorPhone && (
                <button
                  type="button"
                  onClick={() => sendWhatsAppMessage('vendor', vendorPhone)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Send to Vendor
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Status Update Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out opacity-100">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Update Order Status</h3>
              <button onClick={() => setShowStatusModal(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Order Status
                </label>
                <select
                  id="status"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm"
                >
                  {ORDER_STATUSES.map(status => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={updateOrderStatus}
                disabled={updatingStatus}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
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
};

export default OrderDetail; 
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, Timestamp, query, orderBy } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import OrderForm from '../components/OrderForm';
import { ArrowLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import CustomerForm from '../components/CustomerForm';

const CreateOrder = () => {
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
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [vendorPhone, setVendorPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderId, setOrderId] = useState(null);
  const [nextOrderDisplayId, setNextOrderDisplayId] = useState('');

  useEffect(() => {
    fetchCustomers();
    calculateNextOrderDisplayId();
  }, []);

  const calculateNextOrderDisplayId = async () => {
    try {
      const ordersRef = collection(db, 'orders');
      const orderQuery = query(ordersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(orderQuery);
      
      // Calculate the next order number
      const orderCount = snapshot.docs.length;
      const nextId = (orderCount + 1).toString().padStart(3, '0');
      setNextOrderDisplayId(nextId);
    } catch (error) {
      console.error('Error calculating next order ID:', error);
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
    setLoading(true);
    setError('');

    try {
      // Use the pre-calculated next order display ID
      const displayId = nextOrderDisplayId;

      const orderData = {
        ...formData,
        status: 'PENDING',
        displayId,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      setOrderId(docRef.id);
      
      const customer = customers.find(c => c.opticalName === formData.customerName);
      if (customer?.phone) {
        setCustomerPhone(customer.phone);
      }
      
      setShowWhatsAppModal(true);
      
    } catch (error) {
      console.error('Error creating order:', error);
      setError('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerFormClose = async (refreshNeeded = false) => {
    setShowCustomerForm(false);
    if (refreshNeeded) {
      await fetchCustomers();
    }
  };

  const sendWhatsAppMessage = (type, phone) => {
    if (!phone || !orderId) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    
    // Get the display ID from the form data or use the first 3 characters of the ID as fallback
    const displayOrderId = formData.displayId || orderId.substring(0, 3);
    
    const message = type === 'vendor' 
      ? `🔔 *New Order #${displayOrderId}*\n\n` +
        `👤 *Consumer Details:*\n` +
        `Name: ${formData.consumerName || 'N/A'}\n\n` +
        `🕶 *Order Details:*\n` +
        `Brand: ${formData.brandName}\n` +
        `Expected Delivery: ${formData.expectedDeliveryDate}\n\n` +
        `*Lens Details:*\n` +
        `📍 Material: ${formData.material}\n` +
        `📍 Index: ${formData.index}\n` +
        `📍 Type: ${formData.lensType}\n` +
        `📍 Base Tint: ${formData.baseTint}\n` +
        `📍 Coating: ${formData.coatingType}${formData.coatingColour ? ` - ${formData.coatingColour}` : ''}\n` +
        `📍 Diameter: ${formData.diameter}\n\n` +
        `*Prescription Details:*\n` +
        `Right Eye:\n` +
        `• SPH: ${formData.rightSph || '0.00'}\n` +
        `• CYL: ${formData.rightCyl || '0.00'}\n` +
        `• AXIS: ${formData.rightAxis || '0'}\n` +
        `• ADD: ${formData.rightAdd || '0.00'}\n` +
        `• Qty: ${formData.rightQty || '1'} pieces\n\n` +
        `Left Eye:\n` +
        `• SPH: ${formData.leftSph || '0.00'}\n` +
        `• CYL: ${formData.leftCyl || '0.00'}\n` +
        `• AXIS: ${formData.leftAxis || '0'}\n` +
        `• ADD: ${formData.leftAdd || '0.00'}\n` +
        `• Qty: ${formData.leftQty || '1'} pieces\n\n` +
        `💰 Price: ₹${formData.price}\n` +
        (formData.specialNotes ? `\n📝 *Special Notes:*\n${formData.specialNotes}` : '')
      : `🎉 *Order Confirmation*\n\n` +
        `Dear ${formData.customerName || 'Customer'},\n\n` +
        `Your order has been successfully placed!\n\n` +
        `*Order Details:*\n` +
        `Order Reference: #${displayOrderId}\n` +
        `Brand: ${formData.brandName}\n` +
        `Expected Delivery: ${formData.expectedDeliveryDate}\n\n` +
        `*Lens Details:*\n` +
        `${formData.material ? `📍 Material: ${formData.material}\n` : ''}` +
        `${formData.index ? `📍 Index: ${formData.index}\n` : ''}` +
        `${formData.lensType ? `📍 Type: ${formData.lensType}\n` : ''}` +
        `${formData.baseTint ? `📍 Base Tint: ${formData.baseTint}\n` : ''}` +
        `${formData.coatingType ? `📍 Coating: ${formData.coatingType}${formData.coatingColour ? ` - ${formData.coatingColour}` : ''}\n` : ''}` +
        `${formData.diameter ? `📍 Diameter: ${formData.diameter}\n` : ''}` +
        `\n*Prescription Details:*\n` +
        `Right Eye:\n` +
        `• SPH: ${formData.rightSph || '0.00'}\n` +
        `• CYL: ${formData.rightCyl || '0.00'}\n` +
        `• AXIS: ${formData.rightAxis || '0'}\n` +
        `• ADD: ${formData.rightAdd || '0.00'}\n` +
        `• Qty: ${formData.rightQty || '1'} pieces\n\n` +
        `Left Eye:\n` +
        `• SPH: ${formData.leftSph || '0.00'}\n` +
        `• CYL: ${formData.leftCyl || '0.00'}\n` +
        `• AXIS: ${formData.leftAxis || '0'}\n` +
        `• ADD: ${formData.leftAdd || '0.00'}\n` +
        `• Qty: ${formData.leftQty || '1'} pieces\n\n` +
        `💰 Amount: ₹${formData.price}\n` +
        (formData.specialNotes ? `\n📝 *Special Notes:*\n${formData.specialNotes}\n\n` : '\n\n') +
        `Thank you for choosing our services! We'll keep you updated on your order status.`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    console.log('Opening WhatsApp URL:', whatsappUrl);
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 page-with-bottom-content">
      <Navbar />
      
      <main className="flex-grow pb-6">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 pt-3 sm:pt-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4">
            <div>
              <button
                onClick={() => navigate('/orders')}
                className="flex items-center text-sm text-sky-600 hover:text-sky-700 font-medium mb-1"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-1" />
                Back to Orders
              </button>
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-800">Create New Order</h1>
                {nextOrderDisplayId && (
                  <span className="ml-3 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                    Order #{nextOrderDisplayId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area for OrderForm */}
          <div className="bg-white shadow-md rounded-lg p-4 sm:p-5">
            <OrderForm
              formData={formData}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              customers={customers}
              onAddNewCustomer={() => setShowCustomerForm(true)}
              loading={loading}
              error={error}
            />
          </div>
        </div>
      </main>

      {/* Floating Create Order Button (mobile only) */}
      <div className="mobile-only">
        <button
          onClick={(e) => handleSubmit(e)}
          disabled={loading}
          className="floating-action-button"
          aria-label="Create Order"
        >
          {loading ? (
            <svg className="animate-spin h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          ) : (
            <PlusIcon className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerForm 
          onClose={handleCustomerFormClose}
          customer={null}
        />
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out opacity-100">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Send Order Details</h3>
               <button onClick={() => { setShowWhatsAppModal(false); setVendorPhone(''); navigate('/orders');}} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="vendorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor's Phone Number (Optional)
                </label>
                <input
                  id="vendorPhone"
                  type="tel"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="Enter with country code (e.g., +911234567890)"
                  className="w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank if you don't want to message the vendor.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-2 sm:space-y-0">
              <button
                type="button"
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setVendorPhone('');
                  navigate('/orders');
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                Skip & Close
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
    </div>
  );
};

export default CreateOrder; 
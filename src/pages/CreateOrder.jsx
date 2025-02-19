import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, Timestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import OrderForm from '../components/OrderForm';

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
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState({ name: '', phone: '', city: '' });
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [vendorPhone, setVendorPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderId, setOrderId] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

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
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const orderData = {
        ...formData,
        status: 'pending',
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      
      // Store the order ID
      setOrderId(docRef.id);
      
      // Find the customer's phone number
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

  const handleAddNewCustomer = async () => {
    try {
      const docRef = await addDoc(collection(db, 'customers'), newCustomer);
      setCustomers(prev => [...prev, { id: docRef.id, ...newCustomer }]);
      setShowNewCustomerModal(false);
      setNewCustomer({ name: '', phone: '', city: '' });
    } catch (error) {
      console.error('Error adding customer:', error);
      setError('Failed to add customer');
    }
  };

  const sendWhatsAppMessage = (type, phone) => {
    if (!phone || !orderId) return;

    // Clean the phone number - remove any spaces, dashes, or other characters
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    
    const message = type === 'vendor' 
      ? `🔔 *New Order #${orderId}*\n\n` +
        `🏪 *Optical Details:*\n` +
        `Name: ${formData.customerName}\n` +
        `Phone: ${customerPhone}\n\n` +
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
        `Dear ${formData.consumerName || 'Customer'},\n\n` +
        `Your order has been successfully placed!\n\n` +
        `*Order Details:*\n` +
        `Order Reference: #${orderId}\n` +
        `Brand: ${formData.brandName}\n` +
        `Expected Delivery: ${formData.expectedDeliveryDate}\n\n` +
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
        `💰 Amount: ₹${formData.price}\n` +
        (formData.specialNotes ? `\n📝 *Special Notes:*\n${formData.specialNotes}\n\n` : '\n\n') +
        `Thank you for choosing our services! We'll keep you updated on your order status.`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
    console.log('Opening WhatsApp URL:', whatsappUrl);
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-xl font-medium text-gray-900">Create Order</h1>
            <p className="mt-1 text-sm text-gray-500">Fill in the details to create a new order</p>
          </div>
          <button
            onClick={() => navigate('/orders')}
            className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
          >
            Back to Orders
          </button>
        </div>

        {/* Main Content */}
        <div className="space-y-6">
          <OrderForm
            formData={formData}
            onChange={handleInputChange}
            onSubmit={handleSubmit}
            customers={customers}
            onAddNewCustomer={() => setShowNewCustomerModal(true)}
            loading={loading}
            error={error}
          />
        </div>

        {/* Modals */}
        {showNewCustomerModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg transform transition-all fade-in p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Add New Customer</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={newCustomer.name}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, name: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1] sm:text-sm"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={newCustomer.phone}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, phone: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1] sm:text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    City
                  </label>
                  <input
                    type="text"
                    value={newCustomer.city}
                    onChange={(e) => setNewCustomer(prev => ({ ...prev, city: e.target.value }))}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1] sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowNewCustomerModal(false)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddNewCustomer}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
                >
                  Add Customer
                </button>
              </div>
            </div>
          </div>
        )}

        {showWhatsAppModal && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg transform transition-all fade-in p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Send Order Details</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor's Phone Number
                  </label>
                  <input
                    type="tel"
                    value={vendorPhone}
                    onChange={(e) => setVendorPhone(e.target.value)}
                    placeholder="Enter with country code (e.g., +1234567890)"
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1] sm:text-sm"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowWhatsAppModal(false);
                    setVendorPhone('');
                    navigate('/orders');
                  }}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
                >
                  Skip & Close
                </button>
                {vendorPhone && (
                  <button
                    type="button"
                    onClick={() => sendWhatsAppMessage('vendor', vendorPhone)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
                  >
                    Send to Vendor
                  </button>
                )}
                {customerPhone && (
                  <button
                    type="button"
                    onClick={() => sendWhatsAppMessage('customer', customerPhone)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
                  >
                    Send to Customer
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateOrder; 
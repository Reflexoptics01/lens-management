import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';

const OrderDetail = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [vendorPhone, setVendorPhone] = useState('');

  useEffect(() => {
    fetchOrderDetails();
  }, [orderId]);

  const fetchOrderDetails = async () => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      const orderDoc = await getDoc(orderRef);
      
      if (orderDoc.exists()) {
        setOrder({ id: orderDoc.id, ...orderDoc.data() });
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

  const sendWhatsAppMessage = (type, phone) => {
    if (!order) return;

    const message = type === 'vendor' 
      ? `Order Details:\nCustomer: ${order.customerName}\nBrand: ${order.brandName}\nLens Details:\n- Material: ${order.material}\n- Index: ${order.index}\n- Type: ${order.lensType}\n- Power: SPH ${order.sph} CYL ${order.cyl} AXIS ${order.axis}\nQuantity: ${order.quantity}`
      : `Order Status Update:\nOrder ID: ${order.id}\nBrand: ${order.brandName}\nExpected Delivery: ${order.expectedDeliveryDate}\nTotal Amount: ${order.price}`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg text-red-600">{error}</div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-lg text-gray-600">Order not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Order Details</h1>
          <button
            onClick={() => navigate('/orders')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
          >
            Back to Orders
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Order Information</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Order ID</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.id}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Customer Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.customerName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Brand Name</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.brandName}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Status</dt>
                  <dd className="mt-1">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      order.status === 'pending'
                        ? 'bg-yellow-100 text-yellow-800'
                        : order.status === 'completed'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {order.status}
                    </span>
                  </dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Lens Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Material</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.material || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Index</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.index || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Lens Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.lensType || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Base Tint</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.baseTint || '-'}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Coating Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Coating Type</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.coatingType || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Coating Colour</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.coatingColour || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Diameter</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.diameter || '-'}</dd>
                </div>
              </dl>
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Power Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">SPH</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.sph || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">CYL</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.cyl || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Axis</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.axis || '-'}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Add</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.add || '-'}</dd>
                </div>
              </dl>
            </div>

            <div className="md:col-span-2">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Order Details</h3>
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm font-medium text-gray-500">Expected Delivery Date</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.expectedDeliveryDate}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Quantity</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.quantity}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Price</dt>
                  <dd className="mt-1 text-sm text-gray-900">${order.price}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-gray-500">Special Notes</dt>
                  <dd className="mt-1 text-sm text-gray-900">{order.specialNotes || '-'}</dd>
                </div>
              </dl>
            </div>
          </div>

          <div className="mt-8 flex justify-end space-x-4">
            <button
              onClick={() => setShowWhatsAppModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
            >
              Send to Vendor
            </button>
            <button
              onClick={() => sendWhatsAppMessage('customer', order.customerPhone)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
            >
              Send to Customer
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
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
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => sendWhatsAppMessage('vendor', vendorPhone)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
              >
                Send to Vendor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderDetail; 
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

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

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingStatus, setEditingStatus] = useState(null);
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const ordersRef = collection(db, 'orders');
      const q = query(ordersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const ordersList = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        displayId: `${(snapshot.docs.length - index).toString().padStart(3, '0')}`,
        ...doc.data()
      }));
      setOrders(ordersList);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to fetch orders');
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
    }
  };

  const handleStatusChange = async (e, orderId, newStatus) => {
    e.stopPropagation(); // Prevent row click when changing status
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, {
        status: newStatus
      });
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      setEditingStatus(null);
    } catch (error) {
      console.error('Error updating order status:', error);
      setError('Failed to update order status');
    }
  };

  const handleDeleteOrder = async (e, orderId) => {
    e.stopPropagation(); // Prevent row click when deleting
    if (!window.confirm('Are you sure you want to delete this order?')) return;
    
    try {
      await deleteDoc(doc(db, 'orders', orderId));
      setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
    } catch (error) {
      console.error('Error deleting order:', error);
      setError('Failed to delete order');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getCustomerDetails = (customerName) => {
    return customers.find(c => c.opticalName === customerName);
  };

  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
            <p className="mt-1 text-sm text-gray-500">Manage and track your orders</p>
          </div>
          <button
            onClick={() => navigate('/orders/new')}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="desktop-only">Add New Order</span>
          </button>
        </div>

        {/* Mobile Search */}
        <div className="mb-4 mobile-only">
          <input
            type="text"
            placeholder="Search orders..."
            className="mobile-search"
          />
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-[#4169E1] border-t-transparent rounded-full"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">{error}</div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500">No orders found</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                          Order ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-[140px]">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider pl-6">
                          Optical Details
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider pl-6">
                          Brand
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-[120px]">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {orders.map((order) => {
                        const { date, time } = formatDate(order.createdAt);
                        const customerDetails = getCustomerDetails(order.customerName);
                        return (
                          <tr 
                            key={order.id} 
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                          >
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-[#4169E1]">#{order.displayId}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{date}</div>
                              <div className="text-sm text-gray-500">{time}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">{order.customerName}</span>
                                {customerDetails?.city && (
                                  <span className="text-xs text-gray-500">
                                    {customerDetails.city}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900">{order.brandName}</span>
                            </td>
                            <td className="px-6 py-4">
                              {editingStatus === order.id ? (
                                <select
                                  value={order.status}
                                  onChange={(e) => handleStatusChange(e, order.id, e.target.value)}
                                  onBlur={() => setEditingStatus(null)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="text-sm rounded-lg border-gray-300 focus:border-[#4169E1] focus:ring-[#4169E1] w-full"
                                >
                                  {ORDER_STATUSES.map(status => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingStatus(order.id);
                                  }}
                                  className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full cursor-pointer ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}
                                >
                                  {order.status}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-3">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/orders/${order.id}`);
                                  }}
                                  className="text-[#4169E1] hover:text-[#3154b3] transition-colors duration-150"
                                  title="Edit Order"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteOrder(e, order.id)}
                                  className="text-red-600 hover:text-red-900 transition-colors duration-150"
                                  title="Delete Order"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="mobile-only space-y-3">
              {orders.map((order) => {
                const { date, time } = formatDate(order.createdAt);
                const customerDetails = getCustomerDetails(order.customerName);
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="mobile-card"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-[#4169E1]">#{order.displayId}</span>
                      {editingStatus === order.id ? (
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(e, order.id, e.target.value)}
                          onBlur={() => setEditingStatus(null)}
                          onClick={(e) => { e.stopPropagation(); }}
                          onTouchStart={(e) => e.stopPropagation()}
                          autoFocus
                          className="text-sm rounded-lg border-gray-300 focus:border-[#4169E1] focus:ring-[#4169E1]"
                        >
                          {ORDER_STATUSES.map(status => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          onClick={(e) => { e.stopPropagation(); setEditingStatus(order.id); }}
                          onTouchStart={(e) => { e.stopPropagation(); setEditingStatus(order.id); }}
                          className={`px-2 py-1 text-xs font-semibold rounded-full cursor-pointer ${STATUS_COLORS[order.status] || 'bg-gray-100 text-gray-800'}`}
                        >
                          {order.status}
                        </span>
                      )}
                    </div>
                    
                    <div className="mb-3">
                      <h3 className="text-base font-medium text-gray-900">{order.customerName}</h3>
                      {customerDetails?.city && (
                        <p className="text-sm text-gray-500">{customerDetails.city}</p>
                      )}
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{order.brandName}</p>
                        <p className="text-xs text-gray-500">{date} • {time}</p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingStatus(order.id);
                          }}
                          className="p-2 text-gray-600 hover:text-[#4169E1]"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteOrder(e, order.id)}
                          className="p-2 text-gray-600 hover:text-red-600"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Mobile FAB */}
      <div className="fixed right-4 bottom-20 mobile-only">
        <button
          onClick={() => navigate('/orders/new')}
          className="h-14 w-14 rounded-full bg-[#4169E1] text-white shadow-lg flex items-center justify-center"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Orders; 
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc, writeBatch, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

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
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingStatus, setEditingStatus] = useState(null);
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  
  // Filter states
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, []);
  
  // Apply filters whenever orders or filter values change
  useEffect(() => {
    applyFilters();
  }, [orders, fromDate, toDate, searchTerm, statusFilter]);
  
  // Apply all filters
  const applyFilters = () => {
    let result = [...orders];
    
    // Apply date range filter if both dates are set
    if (fromDate && toDate) {
      const fromDateObj = new Date(fromDate);
      fromDateObj.setHours(0, 0, 0, 0);
      
      const toDateObj = new Date(toDate);
      toDateObj.setHours(23, 59, 59, 999);
      
      result = result.filter(order => {
        const orderDate = convertToDate(order.createdAt);
        return orderDate && orderDate >= fromDateObj && orderDate <= toDateObj;
      });
    }
    
    // Apply search term filter
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(order => 
        // Search in customer name
        (order.customerName && 
          order.customerName.toLowerCase().includes(searchLower)) ||
        // Search in order ID/display ID
        (order.displayId && 
          order.displayId.toString().includes(searchLower))
      );
    }
    
    // Apply status filter
    if (statusFilter) {
      result = result.filter(order => order.status === statusFilter);
    }
    
    setFilteredOrders(result);
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError('');
      
      const ordersRef = collection(db, 'orders');
      let ordersList = [];
      
      try {
        // Try the standard query first
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        ordersList = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            displayId: data.displayId,
            ...data,
            // Convert timestamps to proper format
            createdAt: data.createdAt 
          };
        });
      } catch (error) {
        console.error('Error with standard query, trying fallback:', error);
        
        // Fallback: Get all orders without sorting
        const snapshot = await getDocs(ordersRef);
        
        ordersList = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            displayId: data.displayId,
            ...data
          };
        });
        
        // Sort manually by createdAt if possible
        ordersList.sort((a, b) => {
          const dateA = convertToDate(a.createdAt);
          const dateB = convertToDate(b.createdAt);
          
          if (dateA && dateB) {
            return dateB - dateA; // Descending order
          }
          return 0;
        });
      }
      
      setOrders(ordersList);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to fetch orders. Please try reloading the page.');
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
      // Get the current order to access its data
      const orderDoc = await getDoc(doc(db, 'orders', orderId));
      
      if (!orderDoc.exists()) {
        setError('Order not found');
        return;
      }
      
      const orderData = { id: orderId, ...orderDoc.data() };
      const oldStatus = orderData.status;
      
      // Update order status
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus
      });
      
      // Update lens inventory based on status change
      await updateLensStatusForOrder(orderData, oldStatus, newStatus);
      
      setOrders(prevOrders =>
        prevOrders.map(order =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      
      setEditingStatus(null);
    } catch (error) {
      console.error('Error updating status:', error);
      setError('Failed to update order status');
    }
  };

  // Enhanced function to update lens status in inventory
  const updateLensStatusForOrder = async (orderData, oldStatus, newStatus) => {
    try {
      // Check what kind of transition this is
      const invalidStatuses = ['CANCELLED', 'DECLINED'];
      const validStatuses = ['RECEIVED', 'DISPATCHED', 'DELIVERED'];
      
      const wasInvalid = invalidStatuses.includes(oldStatus);
      const isNowValid = validStatuses.includes(newStatus);
      const isNowInvalid = invalidStatuses.includes(newStatus);
      
      // Find existing lenses in inventory
      const lensRef = collection(db, 'lens_inventory');
      const q = query(lensRef, where('orderId', '==', orderData.id));
      const snapshot = await getDocs(q);
      
      // Case 1: Status changing to CANCELLED/DECLINED - remove lenses
      if (isNowInvalid) {
        if (!snapshot.empty) {
          // Remove lenses from inventory
          const batch = writeBatch(db);
          
          snapshot.docs.forEach(lensDoc => {
            const lensRef = doc(db, 'lens_inventory', lensDoc.id);
            batch.delete(lensRef);
          });
          
          // Commit the batch
          await batch.commit();
          console.log(`Removed ${snapshot.docs.length} lenses from inventory due to ${newStatus} status`);
        }
        return;
      }
      
      // Case 2: Status changing from CANCELLED/DECLINED to valid - add lenses back
      if (wasInvalid && isNowValid) {
        // Check if lenses already exist (they shouldn't, but check anyway)
        if (!snapshot.empty) {
          console.log('Lenses exist despite invalid previous status - updating them');
          
          const batch = writeBatch(db);
          snapshot.docs.forEach(lensDoc => {
            const lensRef = doc(db, 'lens_inventory', lensDoc.id);
            batch.update(lensRef, { 
              status: newStatus,
              updatedAt: serverTimestamp()
            });
          });
          
          await batch.commit();
        } else {
          // No lenses found - recreate them from order data
          await createLensesFromOrder(orderData, newStatus);
        }
        return;
      }
      
      // Case 3: Status changing between valid states - just update status
      if (!snapshot.empty) {
        const batch = writeBatch(db);
        
        snapshot.docs.forEach(lensDoc => {
          const lensRef = doc(db, 'lens_inventory', lensDoc.id);
          batch.update(lensRef, { 
            status: newStatus,
            updatedAt: serverTimestamp()
          });
        });
        
        // Commit the batch
        await batch.commit();
        console.log(`Updated status for ${snapshot.docs.length} lenses to ${newStatus}`);
      } else if (isNowValid) {
        // No lenses found but status is valid - create them
        await createLensesFromOrder(orderData, newStatus);
      }
    } catch (error) {
      console.error('Error updating lens status:', error);
    }
  };
  
  // Helper function to create lenses from order data
  const createLensesFromOrder = async (orderData, status) => {
    try {
      // Check if the order has prescription data
      const hasRightEye = orderData.rightSph || orderData.rightCyl;
      const hasLeftEye = orderData.leftSph || orderData.leftCyl;
      
      if (!hasRightEye && !hasLeftEye) {
        console.log('No prescription data to add to inventory');
        return;
      }
      
      // Batch for creating lenses
      const batch = writeBatch(db);
      let lensCount = 0;
      
      // Create lens inventory items
      if (hasRightEye) {
        const rightLensRef = doc(collection(db, 'lens_inventory'));
        const rightLensData = {
          orderId: orderData.id,
          orderDisplayId: orderData.displayId,
          brandName: orderData.brandName || '',
          eye: 'right',
          sph: orderData.rightSph || '',
          cyl: orderData.rightCyl || '',
          axis: orderData.rightAxis || '',
          add: orderData.rightAdd || '',
          material: orderData.material || '',
          index: orderData.index || '',
          baseTint: orderData.baseTint || '',
          coatingType: orderData.coatingType || '',
          coatingColor: orderData.coatingColour || '',
          diameter: orderData.diameter || '',
          qty: parseInt(orderData.rightQty) || 1,
          purchasePrice: orderData.price || 0,
          salePrice: (parseFloat(orderData.price || 0) * 1.3), // 30% markup for sale price
          type: 'prescription',
          status: status,
          location: 'Main Cabinet',
          notes: `Added from Order #${orderData.displayId}`,
          createdAt: serverTimestamp()
        };
        
        batch.set(rightLensRef, rightLensData);
        lensCount++;
      }
      
      if (hasLeftEye) {
        const leftLensRef = doc(collection(db, 'lens_inventory'));
        const leftLensData = {
          orderId: orderData.id,
          orderDisplayId: orderData.displayId,
          brandName: orderData.brandName || '',
          eye: 'left',
          sph: orderData.leftSph || '',
          cyl: orderData.leftCyl || '',
          axis: orderData.leftAxis || '',
          add: orderData.leftAdd || '',
          material: orderData.material || '',
          index: orderData.index || '',
          baseTint: orderData.baseTint || '',
          coatingType: orderData.coatingType || '',
          coatingColor: orderData.coatingColour || '',
          diameter: orderData.diameter || '',
          qty: parseInt(orderData.leftQty) || 1,
          purchasePrice: orderData.price || 0,
          salePrice: (parseFloat(orderData.price || 0) * 1.3), // 30% markup for sale price
          type: 'prescription',
          status: status,
          location: 'Main Cabinet',
          notes: `Added from Order #${orderData.displayId}`,
          createdAt: serverTimestamp()
        };
        
        batch.set(leftLensRef, leftLensData);
        lensCount++;
      }
      
      if (lensCount > 0) {
        // Commit the batch
        await batch.commit();
        console.log(`Created ${lensCount} lenses for order ${orderData.displayId}`);
      }
    } catch (error) {
      console.error('Error creating lenses from order:', error);
    }
  };

  const handleDeleteOrder = async (e, orderId) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this order?')) {
      try {
        // Delete the order
        await deleteDoc(doc(db, 'orders', orderId));
        
        // Also delete any associated lenses in inventory
        await deleteLensesForOrder(orderId);
        
        // Update local state
        setOrders(prevOrders => prevOrders.filter(order => order.id !== orderId));
      } catch (error) {
        console.error('Error deleting order:', error);
        setError('Failed to delete order');
      }
    }
  };
  
  // New function to delete lenses for an order
  const deleteLensesForOrder = async (orderId) => {
    try {
      // Find lenses associated with this order
      const lensRef = collection(db, 'lens_inventory');
      const q = query(lensRef, where('orderId', '==', orderId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        console.log('No lenses found in inventory for this order');
        return;
      }
      
      // Create batch to delete all lenses
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(lensDoc => {
        const lensRef = doc(db, 'lens_inventory', lensDoc.id);
        batch.delete(lensRef);
      });
      
      // Commit the batch
      await batch.commit();
      console.log(`Deleted ${snapshot.docs.length} lenses from inventory for order ${orderId}`);
    } catch (error) {
      console.error('Error deleting lenses from inventory:', error);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return { date: '', time: '' };
    
    try {
      // Check if timestamp is a valid Firestore timestamp object
      if (timestamp && typeof timestamp.toDate === 'function') {
        const date = timestamp.toDate();
        return {
          date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
      } 
      // Handle string ISO dates from backup/restore
      else if (typeof timestamp === 'string' && timestamp.match(/^\d{4}-\d{2}-\d{2}T/)) {
        const date = new Date(timestamp);
        return {
          date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
      }
      // Handle date objects directly
      else if (timestamp instanceof Date) {
        return {
          date: timestamp.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
          time: timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        };
      }
      
      // Return empty strings if format can't be determined
      return { date: '', time: '' };
    } catch (error) {
      console.error('Error formatting date:', error, timestamp);
      return { date: '', time: '' };
    }
  };

  const getCustomerDetails = (customerName) => {
    return customers.find(c => c.opticalName === customerName);
  };

  // Reset all filters
  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setSearchTerm('');
    setStatusFilter('');
  };

  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
        {/* Header - Single line with filters and button */}
        <div className="flex flex-wrap items-end gap-2 mb-4">
          {/* Date Range */}
          <div className="flex gap-2 items-center">
            <div className="w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-md border-gray-300 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1.5"
              />
            </div>
            
            <div className="w-[140px]">
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-md border-gray-300 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1.5"
              />
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="w-[160px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1.5"
            >
              <option value="">All Statuses</option>
              {ORDER_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          {/* Search Box - Grows to fill available space */}
          <div className="flex-grow min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search by Name or Order ID</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search orders by optical name or order ID..."
              className="w-full rounded-md border-gray-300 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1.5"
            />
          </div>
          
          {/* Reset Filters Button - only visible when filters are applied */}
          {(fromDate || toDate || searchTerm || statusFilter) && (
            <button 
              onClick={resetFilters}
              className="h-[38px] px-3 py-2 text-sm text-indigo-600 hover:text-indigo-800 flex items-center hover:bg-indigo-50 rounded-md transition-colors"
            >
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear
            </button>
          )}
          
          {/* Daily Dispatch Log Button */}
          <button
            onClick={() => navigate('/daily-dispatch-log')}
            className="h-[38px] btn-secondary inline-flex items-center space-x-2 px-4 py-1.5 border border-gray-300 hover:bg-gray-50"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Daily Dispatch Log</span>
          </button>
          
          {/* Add New Order Button */}
          <button
            onClick={() => navigate('/orders/new')}
            className="h-[38px] btn-primary inline-flex items-center space-x-2 px-4 py-1.5 bg-[#4169E1] hover:bg-[#3154b3]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Order</span>
          </button>
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
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500">No matching orders for your filters</p>
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
                      {filteredOrders.map((order) => {
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
                                    navigate(`/orders/edit/${order.id}`);
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
              {filteredOrders.map((order) => {
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
                            navigate(`/orders/edit/${order.id}`);
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

      {/* Mobile FABs */}
      <div className="fixed right-4 bottom-20 mobile-only flex flex-col space-y-3">
        {/* Daily Dispatch Log FAB */}
        <button
          onClick={() => navigate('/daily-dispatch-log')}
          className="h-14 w-14 rounded-full bg-[#3154b3] text-white shadow-lg flex items-center justify-center"
          title="Daily Dispatch Log"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
        
        {/* Add New Order FAB */}
        <button
          onClick={() => navigate('/orders/new')}
          className="h-14 w-14 rounded-full bg-[#4169E1] text-white shadow-lg flex items-center justify-center"
          title="Add New Order"
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
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, updateDoc, doc, deleteDoc, writeBatch, where, serverTimestamp, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { safelyParseDate, formatDate, formatDateTime } from '../utils/dateUtils';
import { getUserCollection, getUserDoc, diagnoseAuthIssues, attemptAuthFix } from '../utils/multiTenancy';
import { useAuth } from '../contexts/AuthContext';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

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

  // Authentication check and fix on component mount
  useEffect(() => {
    const checkAndFixAuth = () => {
      const diagnosis = diagnoseAuthIssues();
      
      if (diagnosis.issues.length > 0) {
        // Try to fix authentication
        attemptAuthFix();
        
        // If still no auth after fix attempt, show error
        setTimeout(() => {
          if (!localStorage.getItem('userUid')) {
            setError('Authentication issue detected. Please logout and login again to access your data.');
          }
        }, 1000);
      }
    };
    
    checkAndFixAuth();
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchCustomers();
  }, []);
  
  // Force data reload on component mount (helps after backup restoration)
  useEffect(() => {
    fetchOrders();
  }, []);
  
  // Apply filters whenever orders or filter values change
  useEffect(() => {
    applyFilters();
  }, [orders, fromDate, toDate, searchTerm, statusFilter]);
  
  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Only trigger if not typing in an input field
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'o':
          navigate('/orders/new');
          break;
        case 'd':
          navigate('/daily-dispatch-log');
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [navigate]);
  
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
        const orderDate = safelyParseDate(order.createdAt);
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
      
      // Add debugging for user authentication
      const userUid = localStorage.getItem('userUid');
      
      if (!userUid) {
        console.error('fetchOrders: No user UID found in localStorage');
        setError('User not authenticated. Please logout and login again.');
        setOrders([]); // Set empty array to prevent undefined issues
        return;
      }
      
      let ordersRef;
      try {
        ordersRef = getUserCollection('orders');
      } catch (authError) {
        console.error('fetchOrders: Authentication error getting collection:', authError);
        setError('Authentication error. Please logout and login again.');
        setOrders([]); // Set empty array to prevent undefined issues
        return;
      }
      
      let ordersList = [];
      
      try {
        // Try the standard query first
        const q = query(ordersRef, orderBy('createdAt', 'desc'));
        const snapshot = await getDocs(q);
        
        if (snapshot.docs.length > 0) {
          // Sample first document for debugging if needed
        }
        
        ordersList = snapshot.docs
          .filter(doc => doc.data() && !doc.data()._placeholder) // Filter out placeholder documents and ensure data exists
          .map((doc) => {
            const data = doc.data();
            // Create a safe copy with all timestamp objects properly converted
            const processedData = {};
            Object.keys(data).forEach(key => {
              const value = data[key];
              
              // Skip converting certain fields that should never be dates
              const skipFields = ['displayId', 'orderId', 'orderNumber', 'invoiceNumber', 'id', 'price', 'quantity', 'total', 'amount', 
                                 'leftQty', 'rightQty', 'diameter', 'leftSph', 'rightSph', 'leftCyl', 'rightCyl', 'leftAxis', 'rightAxis',
                                 'leftAdd', 'rightAdd', 'index', 'material', 'lensType', 'brandName', 'customerName', 'consumerName'];
              if (skipFields.includes(key)) {
                // Even in skip fields, if it's a timestamp object, convert to string or appropriate default
                if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
                  processedData[key] = key === 'displayId' ? `ORD-${Math.random().toString(36).substr(2, 9)}` : '';
                } else {
                  processedData[key] = value;
                }
                return;
              }
              
              // Check if value is a timestamp object by structure (has seconds and nanoseconds)
              if (value && typeof value === 'object' && 
                  value.seconds !== undefined && value.nanoseconds !== undefined) {
                // Convert timestamp objects to proper Date objects only for date-related fields
                if (key.includes('At') || key.includes('Date') || key.includes('Time') || 
                    key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt' ||
                    key === 'expectedDeliveryDate' || key === 'deliveryDate') {
                  processedData[key] = safelyParseDate(value) || new Date();
                } else {
                  // For non-date fields that somehow have timestamp objects, convert to null or default
                  processedData[key] = null;
                }
              } else if (key.includes('At') || key.includes('Date') || key === 'createdAt' || key === 'updatedAt') {
                // Also convert common date field names
                processedData[key] = safelyParseDate(value) || new Date();
              } else {
                processedData[key] = value;
              }
            });
            
            return {
              id: doc.id,
              displayId: data.displayId || `ORD-${doc.id.slice(-6)}`, // Fallback displayId
              ...processedData
            };
          });
      } catch (queryError) {
        console.error('Error with standard query, trying fallback:', queryError);
        
        try {
          // Fallback: Get all orders without sorting
          const snapshot = await getDocs(ordersRef);
          
          ordersList = snapshot.docs
            .filter(doc => doc.data() && !doc.data()._placeholder) // Filter out placeholder documents and ensure data exists
            .map((doc) => {
              const data = doc.data();
              // Create a safe copy with all timestamp objects properly converted
              const processedData = {};
              Object.keys(data).forEach(key => {
                const value = data[key];
                
                // Skip converting certain fields that should never be dates
                const skipFields = ['displayId', 'orderId', 'orderNumber', 'invoiceNumber', 'id', 'price', 'quantity', 'total', 'amount', 
                                   'leftQty', 'rightQty', 'diameter', 'leftSph', 'rightSph', 'leftCyl', 'rightCyl', 'leftAxis', 'rightAxis',
                                   'leftAdd', 'rightAdd', 'index', 'material', 'lensType', 'brandName', 'customerName', 'consumerName'];
                if (skipFields.includes(key)) {
                  // Even in skip fields, if it's a timestamp object, convert to string or appropriate default
                  if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
                    processedData[key] = key === 'displayId' ? `ORD-${Math.random().toString(36).substr(2, 9)}` : '';
                  } else {
                    processedData[key] = value;
                  }
                  return;
                }
                
                // Check if value is a timestamp object by structure (has seconds and nanoseconds)
                if (value && typeof value === 'object' && 
                    value.seconds !== undefined && value.nanoseconds !== undefined) {
                  // Convert timestamp objects to proper Date objects only for date-related fields
                  if (key.includes('At') || key.includes('Date') || key.includes('Time') || 
                      key === 'createdAt' || key === 'updatedAt' || key === 'deletedAt' ||
                      key === 'expectedDeliveryDate' || key === 'deliveryDate') {
                    processedData[key] = safelyParseDate(value) || new Date();
                  } else {
                    // For non-date fields that somehow have timestamp objects, convert to null or default
                    processedData[key] = null;
                  }
                } else if (key.includes('At') || key.includes('Date') || key === 'createdAt' || key === 'updatedAt') {
                  // Also convert common date field names
                  processedData[key] = safelyParseDate(value) || new Date();
                } else {
                  processedData[key] = value;
                }
              });
              
              return {
                id: doc.id,
                displayId: data.displayId || `ORD-${doc.id.slice(-6)}`, // Fallback displayId
                ...processedData
              };
            });
          
          // Sort manually by createdAt (newest first)
          ordersList.sort((a, b) => {
            const dateA = safelyParseDate(a.createdAt);
            const dateB = safelyParseDate(b.createdAt);
            
            if (dateA && dateB) {
              return dateB - dateA; // Descending order (newest first)
            }
            // If one date is invalid, put the valid one first
            if (dateA && !dateB) return -1;
            if (!dateA && dateB) return 1;
            // If both dates are invalid, maintain original order
            return 0;
          });
        } catch (fallbackError) {
          console.error('Both standard and fallback queries failed:', fallbackError);
          setError('Failed to fetch orders. Please check your internet connection and try again.');
          setOrders([]); // Set empty array to prevent undefined issues
          return;
        }
      }
      
      // Process and validate data
      let processedCount = 0;
      let invalidCount = 0;
      
      const processedOrders = ordersList.map((order, index) => {
        try {
          // Validate createdAt timestamp
          const date = safelyParseDate(order.createdAt);
          if (!date) {
            invalidCount++;
            // Set a default date if createdAt is invalid
            order.createdAt = new Date(); // Use current date as fallback
          } else {
            processedCount++;
          }
          
          // Ensure displayId exists
          if (!order.displayId) {
            order.displayId = `ORD-${index + 1}`;
          }
          
          // Ensure required fields exist
          order.customerName = order.customerName || 'Unknown Customer';
          order.status = order.status || 'PENDING';
          order.brandName = order.brandName || 'Unknown Brand';
          
          return order;
        } catch (error) {
          console.error('Error processing order:', order.id, error);
          invalidCount++;
          // Return order with defaults to prevent crashes
          return {
            ...order,
            displayId: order.displayId || `ORD-${index + 1}`,
            customerName: order.customerName || 'Unknown Customer',
            status: order.status || 'PENDING',
            brandName: order.brandName || 'Unknown Brand',
            createdAt: order.createdAt || new Date()
          };
        }
      });
      
      // Sort processed orders by converted date (newest first)
      processedOrders.sort((a, b) => {
        const dateA = safelyParseDate(a.createdAt);
        const dateB = safelyParseDate(b.createdAt);
        
        // Both dates valid - sort by date (newest first)
        if (dateA && dateB && !isNaN(dateA.getTime()) && !isNaN(dateB.getTime())) {
          return dateB - dateA;
        }
        
        // If one date is invalid, put the valid one first
        if (dateA && !isNaN(dateA.getTime()) && (!dateB || isNaN(dateB.getTime()))) {
          return -1;
        }
        if ((!dateA || isNaN(dateA.getTime())) && dateB && !isNaN(dateB.getTime())) {
          return 1;
        }
        
        // Both dates invalid - try to sort by displayId (newer display IDs typically have higher numbers)
        if (a.displayId && b.displayId) {
          const numA = parseInt(a.displayId.replace(/\D/g, '')) || 0;
          const numB = parseInt(b.displayId.replace(/\D/g, '')) || 0;
          return numB - numA; // Higher numbers first
        }
        
        // Fallback to original order
        return 0;
      });
      
      // Always set the orders array, even if empty
      setOrders(processedOrders || []);
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Failed to fetch orders. Please try reloading the page or contact support if the issue persists.');
      setOrders([]); // Set empty array to prevent undefined issues
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customersRef = getUserCollection('customers');
      const snapshot = await getDocs(customersRef);
      const customersList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => ({
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
      // Get the current order to access its data - using user-specific collection
      const orderDoc = await getDoc(getUserDoc('orders', orderId));
      
      if (!orderDoc.exists()) {
        setError('Order not found');
        return;
      }
      
      const orderData = { id: orderId, ...orderDoc.data() };
      const oldStatus = orderData.status;
      
      // Update order status - using user-specific collection
      await updateDoc(getUserDoc('orders', orderId), {
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
      const lensRef = getUserCollection('lensInventory');
      const q = query(lensRef, where('orderId', '==', orderData.id));
      const snapshot = await getDocs(q);
      
      // Case 1: Status changing to CANCELLED/DECLINED - remove lenses
      if (isNowInvalid) {
        if (!snapshot.empty) {
          // Remove lenses from inventory
          const batch = writeBatch(db);
          
          snapshot.docs.forEach(lensDoc => {
            const lensRef = getUserDoc('lensInventory', lensDoc.id);
            batch.delete(lensRef);
          });
          
          // Commit the batch
          await batch.commit();
        }
        return;
      }
      
      // Case 2: Status changing from CANCELLED/DECLINED to valid - add lenses back
      if (wasInvalid && isNowValid) {
        // Check if lenses already exist (they shouldn't, but check anyway)
        if (!snapshot.empty) {
          const batch = writeBatch(db);
          snapshot.docs.forEach(lensDoc => {
            const lensRef = getUserDoc('lensInventory', lensDoc.id);
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
          const lensRef = getUserDoc('lensInventory', lensDoc.id);
          batch.update(lensRef, { 
            status: newStatus,
            updatedAt: serverTimestamp()
          });
        });
        
        // Commit the batch
        await batch.commit();
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
        return;
      }
      
      // Batch for creating lenses
      const batch = writeBatch(db);
      let lensCount = 0;
      
      // Create lens inventory items
      if (hasRightEye) {
        const rightLensRef = getUserDoc('lensInventory', `${orderData.id}_right`);
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
        const leftLensRef = getUserDoc('lensInventory', `${orderData.id}_left`);
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
          notes: `Added from Order #${orderData.id}`,
          createdAt: serverTimestamp()
        };
        
        batch.set(leftLensRef, leftLensData);
        lensCount++;
      }
      
      if (lensCount > 0) {
        // Commit the batch
        await batch.commit();
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
        await deleteDoc(getUserDoc('orders', orderId));
        
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
      const lensRef = getUserCollection('lensInventory');
      const q = query(lensRef, where('orderId', '==', orderId));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        return;
      }
      
      // Create batch to delete all lenses
      const batch = writeBatch(db);
      
      snapshot.docs.forEach(lensDoc => {
        const lensDocRef = getUserDoc('lensInventory', lensDoc.id);
        batch.delete(lensDocRef);
      });
      
      // Commit the batch
      await batch.commit();
    } catch (error) {
      console.error('Error deleting lenses from inventory:', error);
    }
  };

  const formatDisplayDate = (timestamp) => {
    if (!timestamp) {
      return { date: 'No Date', time: '' };
    }
    
    try {
      // Use the safelyParseDate helper function for robust timestamp conversion
      const date = safelyParseDate(timestamp);
      
      if (!date) {
        return { date: 'Invalid Date', time: '' };
      }
      
      if (isNaN(date.getTime())) {
        return { date: 'Invalid Date', time: '' };
      }
      
      // Use formatDate from dateUtils for consistency
      const formattedDate = formatDate(date);
      
      const formattedTime = date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      
      return {
        date: formattedDate,
        time: formattedTime
      };
    } catch (error) {
      console.error('formatDisplayDate: Error formatting date:', error, timestamp);
      return { date: 'Date Error', time: '' };
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
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            
            <div className="w-[140px]">
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
          
          {/* Status Filter */}
          <div className="w-[160px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">All Statuses</option>
              {ORDER_STATUSES.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
          
          {/* Search Box - Grows to fill available space */}
          <div className="flex-grow min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Search by Name or Order ID</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search orders by optical name or order ID..."
              className="w-full rounded-md border-gray-300 dark:border-gray-600 border shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm py-1.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
            />
          </div>
          
          {/* Reset Filters Button - only visible when filters are applied */}
          {(fromDate || toDate || searchTerm || statusFilter) && (
            <button 
              onClick={resetFilters}
              className="h-[38px] px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
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
            className="h-[38px] btn-secondary inline-flex items-center space-x-2 px-4 py-1.5 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Daily Dispatch Log (d)</span>
          </button>
          
          {/* Add New Order Button */}
          <button
            onClick={() => navigate('/orders/new')}
            className="h-[38px] btn-primary inline-flex items-center space-x-2 px-4 py-1.5 bg-[#4169E1] hover:bg-[#3154b3] dark:bg-[#4169E1] dark:hover:bg-[#3154b3]"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Order (o)</span>
          </button>
        </div>

        {/* Orders List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-[#4169E1] dark:border-[#4169E1] border-t-transparent rounded-full"></div>
          </div>
        ) : error ? (
          <div className="space-y-4">
            <div className="p-4 text-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <div className="font-medium mb-2">⚠️ Error Loading Orders</div>
              <div className="text-sm">{error}</div>
            </div>
            
            {/* System Status Panel */}
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4">
              <div className="flex items-center">
                <ExclamationTriangleIcon className="h-5 w-5 text-yellow-400 mr-3" />
                <div>
                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                    Unable to Load Orders
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    <p>If you expected to see orders here, try:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Refreshing the page</li>
                      <li>Checking your internet connection</li>
                      <li>Verifying you're logged in correctly</li>
                    </ul>
                  </div>
                  
                  <div className="mt-3 space-x-2">
                    <button
                      onClick={() => {
                        fetchOrders();
                      }}
                      className="px-3 py-1 text-xs bg-yellow-100 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-200 rounded-md hover:bg-yellow-200 dark:hover:bg-yellow-700"
                    >
                      Retry Loading
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No orders found</p>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No matching orders for your filters</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[100px]">
                          Order ID
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[140px]">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider pl-6">
                          Optical Details
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider pl-6">
                          Brand
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[120px]">
                          Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[100px] text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredOrders.map((order) => {
                        const { date, time } = formatDisplayDate(order.createdAt);
                        const customerDetails = getCustomerDetails(order.customerName);
                        return (
                          <tr 
                            key={order.id} 
                            onClick={() => navigate(`/orders/${order.id}`)}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150"
                          >
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-[#4169E1] dark:text-[#4169E1]">#{order.displayId}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 dark:text-white">{date}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{time}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">{order.customerName}</span>
                                {customerDetails?.city && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {customerDetails.city}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="text-sm text-gray-900 dark:text-white">{order.brandName}</span>
                            </td>
                            <td className="px-6 py-4">
                              {editingStatus === order.id ? (
                                <select
                                  value={order.status}
                                  onChange={(e) => handleStatusChange(e, order.id, e.target.value)}
                                  onBlur={() => setEditingStatus(null)}
                                  onClick={(e) => e.stopPropagation()}
                                  autoFocus
                                  className="text-sm rounded-lg border-gray-300 dark:border-gray-600 focus:border-[#4169E1] focus:ring-[#4169E1] w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                                  className="text-[#4169E1] dark:text-[#4169E1] hover:text-[#3154b3] dark:hover:text-[#3154b3] transition-colors duration-150"
                                  title="Edit Order"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteOrder(e, order.id)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300 transition-colors duration-150"
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
                const { date, time } = formatDisplayDate(order.createdAt);
                const customerDetails = getCustomerDetails(order.customerName);
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="mobile-card bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-[#4169E1] dark:text-[#4169E1]">#{order.displayId}</span>
                      {editingStatus === order.id ? (
                        <select
                          value={order.status}
                          onChange={(e) => handleStatusChange(e, order.id, e.target.value)}
                          onBlur={() => setEditingStatus(null)}
                          onClick={(e) => { e.stopPropagation(); }}
                          onTouchStart={(e) => e.stopPropagation()}
                          autoFocus
                          className="text-sm rounded-lg border-gray-300 dark:border-gray-600 focus:border-[#4169E1] focus:ring-[#4169E1] bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                      <h3 className="text-base font-medium text-gray-900 dark:text-white">{order.customerName}</h3>
                      {customerDetails?.city && (
                        <p className="text-sm text-gray-500 dark:text-gray-400">{customerDetails.city}</p>
                      )}
                    </div>

                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{order.brandName}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{date} • {time}</p>
                      </div>
                      
                      <div className="flex space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/orders/edit/${order.id}`);
                          }}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-[#4169E1] dark:hover:text-[#4169E1]"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => handleDeleteOrder(e, order.id)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
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
          className="h-14 w-14 rounded-full bg-[#3154b3] dark:bg-[#3154b3] text-white shadow-lg flex items-center justify-center"
          title="Daily Dispatch Log (d)"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        </button>
        
        {/* Add New Order FAB */}
        <button
          onClick={() => navigate('/orders/new')}
          className="h-14 w-14 rounded-full bg-[#4169E1] dark:bg-[#4169E1] text-white shadow-lg flex items-center justify-center"
          title="Add New Order (o)"
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
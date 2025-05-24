import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import PrintInvoiceModal from '../components/PrintInvoiceModal';

const SaleDetail = () => {
  const { saleId } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State for print invoice modal
  const [showPrintModal, setShowPrintModal] = useState(false);

  useEffect(() => {
    fetchSaleDetails();
  }, [saleId]);

  const fetchSaleDetails = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      
      console.log('Fetching sale details for ID:', saleId);
      
      const saleDoc = await getDoc(doc(db, 'sales', saleId));
      
      if (!saleDoc.exists()) {
        setError('Sale not found');
        return;
      }
      
      const saleData = saleDoc.data();
      console.log('Raw sale data:', saleData);
      console.log('Sale data keys:', Object.keys(saleData));
      
      // Log specific problematic fields
      console.log('createdAt type:', typeof saleData.createdAt, saleData.createdAt);
      console.log('invoiceDate type:', typeof saleData.invoiceDate, saleData.invoiceDate);
      console.log('dueDate type:', typeof saleData.dueDate, saleData.dueDate);
      console.log('items:', saleData.items);
      
      // Helper function to safely convert timestamps
      const convertTimestamp = (timestamp, fieldName) => {
        if (!timestamp) {
          console.log(`${fieldName} is null/undefined`);
          return null;
        }
        
        console.log(`Converting ${fieldName}:`, timestamp, 'Type:', typeof timestamp);
        
        try {
          // Handle Firestore Timestamp
          if (timestamp && typeof timestamp.toDate === 'function') {
            const result = timestamp.toDate();
            console.log(`${fieldName} converted from Firestore timestamp:`, result);
            return result;
          }
          // Handle Date object
          else if (timestamp instanceof Date) {
            console.log(`${fieldName} is already a Date object:`, timestamp);
            return timestamp;
          }
          // Handle string dates
          else if (typeof timestamp === 'string') {
            const date = new Date(timestamp);
            console.log(`${fieldName} converted from string:`, timestamp, 'to:', date);
            return isNaN(date.getTime()) ? null : date;
          }
          // Handle timestamp numbers
          else if (typeof timestamp === 'number') {
            const date = new Date(timestamp);
            console.log(`${fieldName} converted from number:`, timestamp, 'to:', date);
            return date;
          }
          // Handle objects with seconds (Firestore timestamp-like objects)
          else if (timestamp && typeof timestamp === 'object' && timestamp.seconds) {
            const date = new Date(timestamp.seconds * 1000);
            console.log(`${fieldName} converted from seconds object:`, timestamp, 'to:', date);
            return date;
          }
          // Handle objects with _seconds (another possible format)
          else if (timestamp && typeof timestamp === 'object' && timestamp._seconds) {
            const date = new Date(timestamp._seconds * 1000);
            console.log(`${fieldName} converted from _seconds object:`, timestamp, 'to:', date);
            return date;
          }
          // Handle any other object format
          else if (timestamp && typeof timestamp === 'object') {
            console.log(`${fieldName} unknown object format:`, timestamp);
            // Try to find any timestamp-like properties
            const possibleTimestamp = timestamp.seconds || timestamp._seconds || timestamp.nanoseconds || timestamp._nanoseconds;
            if (possibleTimestamp) {
              const date = new Date(possibleTimestamp * 1000);
              console.log(`${fieldName} found timestamp in object:`, possibleTimestamp, 'converted to:', date);
              return date;
            }
          }
          else {
            const date = new Date(timestamp);
            console.log(`${fieldName} fallback conversion:`, timestamp, 'to:', date);
            return isNaN(date.getTime()) ? null : date;
          }
        } catch (error) {
          console.error(`Error converting ${fieldName}:`, error, timestamp);
          return null;
        }
      };
      
      // Convert all timestamp fields
      const createdAt = convertTimestamp(saleData.createdAt, 'createdAt') || new Date();
      const invoiceDate = convertTimestamp(saleData.invoiceDate, 'invoiceDate') || new Date();
      const dueDate = convertTimestamp(saleData.dueDate, 'dueDate');
      
      // Validate other required fields
      const validatedSaleData = {
        id: saleDoc.id,
        ...saleData,
        createdAt,
        invoiceDate,
        dueDate,
        // Ensure required fields have fallback values
        invoiceNumber: saleData.invoiceNumber || 'Unknown',
        customerName: saleData.customerName || 'Unknown Customer',
        customerAddress: saleData.customerAddress || '',
        customerCity: saleData.customerCity || '',
        customerGst: saleData.customerGst || '',
        items: Array.isArray(saleData.items) ? saleData.items : [],
        subtotal: saleData.subtotal || 0,
        totalAmount: saleData.totalAmount || 0,
        taxAmount: saleData.taxAmount || 0,
        taxRate: saleData.taxRate || 0,
        discountAmount: saleData.discountAmount || 0,
        discountType: saleData.discountType || 'amount',
        discountValue: saleData.discountValue || 0,
        frieghtCharge: saleData.frieghtCharge || 0,
        amountPaid: saleData.amountPaid || 0,
        balanceDue: saleData.balanceDue || 0,
        paymentStatus: saleData.paymentStatus || 'UNPAID',
        notes: saleData.notes || ''
      };
      
      console.log('Final validated sale data:', validatedSaleData);
      setSale(validatedSaleData);
      
    } catch (error) {
      console.error('Error fetching sale details:', error);
      console.error('Error stack:', error.stack);
      setError(`Failed to fetch sale details: ${error.message}. Check browser console for more details.`);
    } finally {
      setLoading(false);
    }
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    
    try {
      let dateObj;
      
      // Handle different date formats
      if (date && typeof date.toDate === 'function') {
        dateObj = date.toDate();
      } else if (date instanceof Date) {
        dateObj = date;
      } else if (typeof date === 'string') {
        dateObj = new Date(date);
      } else if (typeof date === 'number') {
        dateObj = new Date(date);
      } else if (date && typeof date === 'object' && date.seconds) {
        dateObj = new Date(date.seconds * 1000);
      } else {
        dateObj = new Date(date);
      }
      
      // Check if date is valid
      if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
      }
      
      return dateObj.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      console.error('Error formatting date:', error, date);
      return 'Invalid Date';
    }
  };

  const getStatusColor = (status) => {
    switch(status) {
      case 'PAID': return 'bg-green-100 text-green-800 border-green-300';
      case 'PARTIAL': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'UNPAID': return 'bg-red-100 text-red-800 border-red-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const handlePrintInvoice = () => {
    if (saleId) {
      setShowPrintModal(true);
    } else {
      setError('Sale ID not found');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Compact Header */}
          <div className="mb-4">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => navigate('/sales')}
                  className="inline-flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-1"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Sales
                </button>
                <div className="flex items-center space-x-3">
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Invoice #{sale?.invoiceNumber}</h1>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sale?.paymentStatus)}`}>
                    {sale?.paymentStatus || 'UNPAID'}
                  </span>
                </div>
              </div>
              
              {/* Compact Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => navigate(`/sales/edit/${saleId}`)}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
                
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700"
                >
                  <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 2l3 3.5L6 9M18 2l-3 3.5L18 9M8 21v-3a2 2 0 012-2h4a2 2 0 012 2v3M6 13h12a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2v-4a2 2 0 012-2z" />
                  </svg>
                  Print
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-600 rounded-md p-4">
              <div className="text-red-800 dark:text-red-200">{error}</div>
            </div>
          ) : sale ? (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              {/* Left Column - Main Content (3/4 width) */}
              <div className="lg:col-span-3 space-y-4">
                
                {/* Compact Invoice & Customer Info - Side by Side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Invoice Information */}
                  <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Invoice Details
                    </h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Number:</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{sale.invoiceNumber}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Date:</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(sale.invoiceDate)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Due Date:</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(sale.dueDate) !== '-' ? formatDate(sale.dueDate) : 'Not specified'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Created:</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(sale.createdAt)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Customer Information */}
                  <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      Customer Details
                    </h3>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Name:</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{sale.customerName}</p>
                      </div>
                      <div>
                        <span className="text-gray-500 dark:text-gray-400">Address:</span>
                        <p className="font-medium text-gray-900 dark:text-gray-100">{sale.customerAddress || 'Not provided'}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">City:</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{sale.customerCity || 'Not provided'}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">GST:</span>
                          <p className="font-medium text-gray-900 dark:text-gray-100">{sale.customerGst || 'Not provided'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Invoice Items */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Invoice Items ({sale.items?.length || 0})
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Order ID</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Item</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">SPH</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">CYL</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">AXIS</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">ADD</th>
                          <th className="px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">QTY</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Price</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                        {sale.items && sale.items.map((item, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                            <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100">{item.orderId || '-'}</td>
                            <td className="px-3 py-2 text-xs text-gray-900 dark:text-gray-100 max-w-32 truncate" title={item.itemName}>{item.itemName || '-'}</td>
                            <td className="px-2 py-2 text-xs text-center text-gray-900 dark:text-gray-100">{item.sph || '-'}</td>
                            <td className="px-2 py-2 text-xs text-center text-gray-900 dark:text-gray-100">{item.cyl || '-'}</td>
                            <td className="px-2 py-2 text-xs text-center text-gray-900 dark:text-gray-100">{item.axis || '-'}</td>
                            <td className="px-2 py-2 text-xs text-center text-gray-900 dark:text-gray-100">{item.add || '-'}</td>
                            <td className="px-2 py-2 text-xs text-center text-gray-900 dark:text-gray-100">{item.qty || 1}</td>
                            <td className="px-3 py-2 text-xs text-right text-gray-900 dark:text-gray-100">{formatCurrency(item.price || 0)}</td>
                            <td className="px-3 py-2 text-xs text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.total || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes - Only show if exists */}
                {sale.notes && (
                  <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 flex items-center">
                      <svg className="w-4 h-4 mr-2 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                      Notes
                    </h3>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sale.notes}</p>
                  </div>
                )}
              </div>

              {/* Right Column - Summary (1/4 width) */}
              <div className="space-y-4">
                {/* Invoice Summary */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Summary
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Subtotal:</span>
                      <span className="text-gray-900 dark:text-gray-100">{formatCurrency(sale.subtotal)}</span>
                    </div>
                    {sale.discountAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Discount:</span>
                        <span className="text-red-600 dark:text-red-400">-{formatCurrency(sale.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-500 dark:text-gray-400">Tax ({sale.taxRate}%):</span>
                      <span className="text-gray-900 dark:text-gray-100">{formatCurrency(sale.taxAmount)}</span>
                    </div>
                    {(sale.frieghtCharge || 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Freight:</span>
                        <span className="text-gray-900 dark:text-gray-100">{formatCurrency(sale.frieghtCharge || 0)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                      <div className="flex justify-between text-base font-semibold">
                        <span className="text-gray-900 dark:text-white">Total:</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(sale.totalAmount)}</span>
                      </div>
                    </div>
                    {sale.amountPaid > 0 && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Paid:</span>
                          <span className="text-green-600 dark:text-green-400">{formatCurrency(sale.amountPaid)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Balance:</span>
                          <span className="text-red-600 dark:text-red-400">{formatCurrency(sale.balanceDue)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Payment Status Card */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                    Payment
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Status:</span>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sale.paymentStatus)}`}>
                          {sale.paymentStatus}
                        </span>
                      </div>
                    </div>
                    {sale.paymentStatus !== 'UNPAID' && (
                      <>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400">Amount Paid:</span>
                          <p className="font-medium text-green-600 dark:text-green-400">{formatCurrency(sale.amountPaid)}</p>
                        </div>
                        {sale.balanceDue > 0 && (
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Remaining:</span>
                            <p className="font-medium text-red-600 dark:text-red-400">{formatCurrency(sale.balanceDue)}</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Additional Info Card */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-4 border border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                    <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Details
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Discount Type:</span>
                      <p className="text-gray-900 dark:text-gray-100">
                        {sale.discountType === 'percentage' ? `${sale.discountValue}%` : formatCurrency(sale.discountValue)}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Items Count:</span>
                      <p className="text-gray-900 dark:text-gray-100">{sale.items?.length || 0}</p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Created Time:</span>
                      <p className="text-gray-900 dark:text-gray-100">
                        {sale.createdAt ? sale.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {/* Print Modal */}
      {showPrintModal && (
        <PrintInvoiceModal 
          isOpen={showPrintModal}
          saleId={saleId}
          onClose={() => setShowPrintModal(false)}
          title={`Invoice #${sale?.invoiceNumber || ''}`}
        />
      )}
    </div>
  );
};

export default SaleDetail; 
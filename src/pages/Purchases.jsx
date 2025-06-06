import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { formatDate, formatDateTime, safelyParseDate } from '../utils/dateUtils';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PrintInvoiceModal from '../components/PrintInvoiceModal';

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);

  // State for print invoice modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);
  const [printData, setPrintData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);

  useEffect(() => {
    fetchPurchases();
    fetchVendors();
  }, []);

  // Add print-specific styles when printing
  useEffect(() => {
    if (isPrinting) {
      const originalTitle = document.title;
      document.title = `Purchase Order - ${printData?.purchaseNumber || 'Print'}`;
      
      // Add the print-specific styles
      const style = document.createElement('style');
      style.id = 'print-styles';
      style.innerHTML = `
        @media print {
          body * {
            visibility: hidden;
          }
          #print-content, #print-content * {
            visibility: visible;
          }
          #print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
        }
      `;
      document.head.appendChild(style);
      
      // Trigger print
      window.print();
      
      // Clean up
      return () => {
        document.title = originalTitle;
        const printStyles = document.getElementById('print-styles');
        if (printStyles) printStyles.remove();
        setIsPrinting(false);
      };
    }
  }, [isPrinting, printData]);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      
      // Add debugging for user authentication
      const userUid = localStorage.getItem('userUid');
      console.log('fetchPurchases: Current user UID:', userUid);
      
      if (!userUid) {
        console.error('fetchPurchases: No user UID found in localStorage');
        setError('User not authenticated');
        return;
      }
      
      const purchasesRef = getUserCollection('purchases');
      console.log('fetchPurchases: Got purchases collection reference');
      
      const q = query(purchasesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      
      console.log('fetchPurchases: Query executed, got', snapshot.docs.length, 'documents');
      console.log('fetchPurchases: Current user path should be: users/' + userUid + '/purchases');
      
      if (snapshot.docs.length > 0) {
        console.log('fetchPurchases: First document data sample:', snapshot.docs[0].data());
      }
      
      const purchasesList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map((doc) => {
          const data = doc.data();
          // Create a safe copy with all timestamp fields properly converted
          const processedData = {};
          Object.keys(data).forEach(key => {
            if (key.includes('At') || key.includes('Date') || key === 'createdAt' || key === 'updatedAt') {
              // Convert any timestamp-like fields to proper Date objects
              processedData[key] = safelyParseDate(data[key]) || new Date();
            } else {
              processedData[key] = data[key];
            }
          });
          
          return {
            id: doc.id,
            // Use the actual stored purchaseNumber instead of calculating displayId
            displayId: data.purchaseNumber || `P-${doc.id.slice(-3)}`,
            ...processedData
          };
        });
      setPurchases(purchasesList);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      setError('Failed to fetch purchases');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const customersRef = getUserCollection('customers');
      const q = query(customersRef, where('type', '==', 'vendor'));
      const snapshot = await getDocs(q);
      const vendorsList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      setVendors(vendorsList);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const handleDeletePurchase = async (e, purchaseId) => {
    e.stopPropagation(); // Prevent row click when deleting
    if (!window.confirm('Are you sure you want to delete this purchase?')) return;
    
    try {
      await deleteDoc(getUserDoc('purchases', purchaseId));
      setPurchases(prevPurchases => prevPurchases.filter(purchase => purchase.id !== purchaseId));
    } catch (error) {
      console.error('Error deleting purchase:', error);
      setError('Failed to delete purchase');
    }
  };

  const formatDisplayDate = (timestamp) => {
    if (!timestamp) return { date: '-', time: '-' };
    
    // Use safelyParseDate from dateUtils for consistent parsing
    const date = safelyParseDate(timestamp);
    
    if (!date || isNaN(date.getTime())) {
      return { date: 'Invalid Date', time: '-' };
    }
    
    return {
      date: formatDate(date), // Use formatDate from dateUtils  
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const getVendorDetails = (vendorId) => {
    return vendors.find(v => v.id === vendorId);
  };

  const handlePrintPurchase = async (e, purchaseId) => {
    e.stopPropagation();
    try {
      // Fetch the full purchase data
      const purchaseDoc = await getDoc(getUserDoc('purchases', purchaseId));
      if (!purchaseDoc.exists()) {
        console.error('Purchase not found');
        return;
      }
      
      const purchaseData = purchaseDoc.data();
      
      // Get vendor details
      let vendorData = null;
      if (purchaseData.vendorId) {
        const vendorDoc = await getDoc(getUserDoc('customers', purchaseData.vendorId));
        if (vendorDoc.exists()) {
          vendorData = vendorDoc.data();
        }
      }
      
      // Set the print data
      setPrintData({ 
        ...purchaseData,
        id: purchaseId,
        displayId: purchases.find(p => p.id === purchaseId)?.displayId || purchaseId,
        vendor: vendorData
      });
      
      // Trigger printing
      setIsPrinting(true);
    } catch (error) {
      console.error('Error preparing purchase for print:', error);
    }
  };

  // Function to get tax label
  const getTaxLabel = (taxId) => {
    const TAX_OPTIONS = [
      { id: 'TAX_FREE', label: 'Tax Free', rate: 0 },
      { id: 'GST_6', label: 'GST 6%', rate: 6 },
      { id: 'GST_12', label: 'GST 12%', rate: 12 },
      { id: 'GST_18', label: 'GST 18%', rate: 18 },
      { id: 'CGST_SGST_6', label: 'CGST/SGST 6%', rate: 6, split: true },
      { id: 'CGST_SGST_12', label: 'CGST/SGST 12%', rate: 12, split: true },
      { id: 'CGST_SGST_18', label: 'CGST/SGST 18%', rate: 18, split: true },
      { id: 'IGST_6', label: 'IGST 6%', rate: 6 },
      { id: 'IGST_12', label: 'IGST 12%', rate: 12 },
      { id: 'IGST_18', label: 'IGST 18%', rate: 18 }
    ];
    const tax = TAX_OPTIONS.find(tax => tax.id === taxId);
    return tax ? tax.label : 'No Tax';
  };

  // Get payment status badge
  const getPaymentStatusText = (status) => {
    if (!status) return 'Unknown';
    
    switch(status.toUpperCase()) {
      case 'PAID':
        return 'Paid';
      case 'PARTIAL':
        return 'Partially Paid';
      case 'UNPAID':
        return 'Unpaid';
      default:
        return status;
    }
  };

  return (
    <div className="mobile-page bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Navbar />
      
      <div className="mobile-content">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Purchases</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage your purchases and invoices</p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => navigate('/purchases/new')}
              className="btn-primary inline-flex items-center space-x-2 bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="desktop-only">Create Purchase</span>
            </button>
            
            {/* Returns Button */}
            <button
              onClick={() => navigate('/purchase-returns')}
              className="btn-secondary inline-flex items-center space-x-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white rounded-lg shadow-sm px-3 py-1.5 text-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
              </svg>
              <span className="desktop-only">View Returns</span>
            </button>
          </div>
        </div>

        {/* Mobile Search */}
        <div className="mb-4 mobile-only">
          <input
            type="text"
            placeholder="Search purchases..."
            className="mobile-search bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-sky-500 focus:border-sky-500"
          />
        </div>

        {/* Purchases List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-sky-600 dark:border-sky-400 border-t-transparent rounded-full"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No purchase records found</p>
            <button
              onClick={() => navigate('/purchases/new')}
              className="mt-4 inline-flex items-center px-4 py-2 bg-sky-600 dark:bg-sky-500 text-white rounded-lg hover:bg-sky-700 dark:hover:bg-sky-600"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create First Purchase
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only">
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[100px]">
                          Purchase #
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[140px]">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider pl-6">
                          Vendor
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-right">
                          Amount
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider text-center">
                          Payment Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[100px] text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {purchases.map((purchase) => {
                        const { date: purchaseDate, time: purchaseTime } = formatDisplayDate(purchase.createdAt);
                        const vendorDetails = getVendorDetails(purchase.vendorId);
                        return (
                          <tr 
                            key={purchase.id} 
                            onClick={() => navigate(`/purchases/${purchase.id}`)}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150"
                          >
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{purchase.displayId}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900 dark:text-white">{purchaseDate}</div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">{purchaseTime}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900 dark:text-white">
                                  {vendorDetails?.opticalName || 'Unknown Vendor'}
                                </span>
                                {vendorDetails?.city && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {vendorDetails.city}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {formatCurrency(purchase.totalAmount)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${purchase.paymentStatus === 'PAID' 
                                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                  : purchase.paymentStatus === 'PARTIAL' 
                                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}
                              >
                                {purchase.paymentStatus || 'UNPAID'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/purchases/edit/${purchase.id}`);
                                  }}
                                  className="text-sky-600 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-300"
                                  title="Edit Purchase"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handlePrintPurchase(e, purchase.id)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                                  title="Print Purchase"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2 2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDeletePurchase(e, purchase.id)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
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

            {/* Mobile List View */}
            <div className="mobile-only space-y-4">
              {purchases.map((purchase) => {
                const { date: mobileDate } = formatDisplayDate(purchase.createdAt);
                const vendorDetails = getVendorDetails(purchase.vendorId);
                return (
                  <div 
                    key={purchase.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                    onClick={() => navigate(`/purchases/${purchase.id}`)}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{purchase.displayId}</span>
                        <span className={`px-2 py-1 text-xs leading-none rounded-full 
                          ${purchase.paymentStatus === 'PAID' 
                            ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                            : purchase.paymentStatus === 'PARTIAL' 
                              ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'}`}
                        >
                          {purchase.paymentStatus || 'UNPAID'}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {vendorDetails?.opticalName || 'Unknown Vendor'}
                        </div>
                        {vendorDetails?.city && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {vendorDetails.city}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="text-gray-500 dark:text-gray-400">{mobileDate}</div>
                        <div className="font-medium text-gray-900 dark:text-white">{formatCurrency(purchase.totalAmount)}</div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-between">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/purchases/edit/${purchase.id}`);
                          }}
                          className="text-sky-600 dark:text-sky-400 text-sm hover:text-sky-700 dark:hover:text-sky-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => handlePrintPurchase(e, purchase.id)}
                          className="text-indigo-600 dark:text-indigo-400 text-sm hover:text-indigo-700 dark:hover:text-indigo-300"
                        >
                          Print
                        </button>
                        <button
                          onClick={(e) => handleDeletePurchase(e, purchase.id)}
                          className="text-red-600 dark:text-red-400 text-sm hover:text-red-700 dark:hover:text-red-300"
                        >
                          Delete
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
      
      {/* Print Modal - Only visible when showPrintModal is true */}
      {showPrintModal && (
        <PrintInvoiceModal
          invoiceId={selectedPurchaseId}
          onClose={() => setShowPrintModal(false)}
          isPurchase={true}
        />
      )}

      {/* Print Content - Hidden until print is triggered */}
      {isPrinting && printData && (
        <div id="print-content" className="hidden print:block p-8 max-w-full bg-white">
          <div className="text-center border-b-2 border-gray-200 pb-4 mb-6">
            <h1 className="text-2xl font-bold text-gray-900">PURCHASE ORDER</h1>
            <p className="text-xl">{printData.displayId || `#${printData.purchaseNumber || 'N/A'}`}</p>
          </div>
          
          <div className="flex justify-between mb-8">
            <div>
              <p className="text-gray-700 font-bold">Vendor:</p>
              <p className="font-semibold text-gray-900">{printData.vendor?.opticalName || printData.vendorName || 'N/A'}</p>
              {printData.vendor?.contactPerson && <p>{printData.vendor.contactPerson}</p>}
              {printData.vendor?.address && <p>{printData.vendor.address}</p>}
              {printData.vendor?.city && <p>{printData.vendor.city}{printData.vendor?.pincode ? `, ${printData.vendor.pincode}` : ''}</p>}
              {printData.vendor?.phone && <p>Phone: {printData.vendor.phone}</p>}
            </div>
            <div className="text-right">
              <p><span className="font-bold">Date: </span>{formatDisplayDate(printData.purchaseDate).date}</p>
              <p><span className="font-bold">Invoice #: </span>{printData.vendorInvoiceNumber || 'N/A'}</p>
              <p><span className="font-bold">Payment Status: </span>{getPaymentStatusText(printData.paymentStatus)}</p>
            </div>
          </div>
          
          <table className="w-full mb-8 border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border border-gray-300 px-4 py-2 text-left">Item</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Qty</th>
                <th className="border border-gray-300 px-4 py-2 text-center">Unit</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Price</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Discount</th>
                <th className="border border-gray-300 px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {printData.items?.length > 0 ? (
                printData.items.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="border border-gray-300 px-4 py-2">
                      <div className="font-semibold">{item.itemName}</div>
                      {item.description && <div className="text-sm text-gray-600">{item.description}</div>}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{item.qty}</td>
                    <td className="border border-gray-300 px-4 py-2 text-center">{item.unit}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">{formatCurrency(item.price)}</td>
                    <td className="border border-gray-300 px-4 py-2 text-right">
                      {item.itemDiscountType === 'percentage' 
                        ? `${item.itemDiscount}%` 
                        : formatCurrency(item.itemDiscount)}
                    </td>
                    <td className="border border-gray-300 px-4 py-2 text-right font-semibold">{formatCurrency(item.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="border border-gray-300 px-4 py-4 text-center text-gray-500">No items in this purchase</td>
                </tr>
              )}
            </tbody>
          </table>
          
          <div className="flex justify-end mb-8">
            <div className="w-64">
              <div className="flex justify-between py-2">
                <span className="font-semibold">Subtotal:</span>
                <span>{formatCurrency(printData.subtotal)}</span>
              </div>
              
              <div className="flex justify-between py-2 border-t border-gray-200">
                <span className="font-semibold">Discount:</span>
                <span>{formatCurrency(printData.discountAmount)}</span>
              </div>
              
              <div className="flex justify-between py-2 border-t border-gray-200">
                <span className="font-semibold">Tax ({getTaxLabel(printData.taxOption)}):</span>
                <span>{formatCurrency(printData.taxAmount)}</span>
              </div>
              
              <div className="flex justify-between py-2 border-t border-gray-200">
                <span className="font-semibold">Freight:</span>
                <span>{formatCurrency(printData.frieghtCharge)}</span>
              </div>
              
              <div className="flex justify-between py-2 border-t-2 border-gray-900">
                <span className="font-bold text-lg">Total:</span>
                <span className="font-bold text-lg">{formatCurrency(printData.totalAmount)}</span>
              </div>
              
              <div className="flex justify-between py-2 border-t border-gray-200">
                <span className="font-semibold">Amount Paid:</span>
                <span>{formatCurrency(printData.amountPaid)}</span>
              </div>
              
              <div className="flex justify-between py-2 border-t border-gray-200">
                <span className="font-semibold">Balance Due:</span>
                <span className={printData.balance > 0 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>
                  {formatCurrency(printData.balance)}
                </span>
              </div>
            </div>
          </div>
          
          {printData.notes && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <p className="font-bold">Notes:</p>
              <p className="text-gray-700">{printData.notes}</p>
            </div>
          )}
          
          <div className="mt-16 pt-8 border-t border-gray-300 text-center text-sm text-gray-600">
            <p>Thank you for your business</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases; 
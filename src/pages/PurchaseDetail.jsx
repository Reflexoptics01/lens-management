import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDoc, doc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { safelyParseDate, formatDate } from '../utils/dateUtils';

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

const PurchaseDetail = () => {
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const [purchase, setPurchase] = useState(null);
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchPurchaseData();
  }, [purchaseId]);

  const fetchPurchaseData = async () => {
    try {
      setLoading(true);
      const purchaseDoc = await getDoc(doc(db, 'purchases', purchaseId));
      
      if (!purchaseDoc.exists()) {
        setError('Purchase not found');
        return;
      }
      
      const purchaseData = purchaseDoc.data();
      setPurchase(purchaseData);
      
      // Fetch vendor details if vendorId exists
      if (purchaseData.vendorId) {
        const vendorDoc = await getDoc(doc(db, 'customers', purchaseData.vendorId));
        if (vendorDoc.exists()) {
          setVendor(vendorDoc.data());
        }
      }
    } catch (error) {
      console.error('Error fetching purchase data:', error);
      setError('Failed to fetch purchase data');
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

  // Get tax label
  const getTaxLabel = (taxId) => {
    const tax = TAX_OPTIONS.find(tax => tax.id === taxId);
    return tax ? tax.label : 'No Tax';
  };

  // Get payment status badge
  const getPaymentStatusBadge = (status) => {
    if (!status) return null;
    
    let bgColor = 'bg-gray-100 dark:bg-gray-700';
    let textColor = 'text-gray-800 dark:text-gray-200';
    let bgHoverColor = 'hover:bg-gray-200 dark:hover:bg-gray-600';
    
    switch(status.toUpperCase()) {
      case 'PAID':
        bgColor = 'bg-green-100 dark:bg-green-900';
        textColor = 'text-green-800 dark:text-green-200';
        bgHoverColor = 'hover:bg-green-200 dark:hover:bg-green-800';
        break;
      case 'PARTIAL':
        bgColor = 'bg-amber-100 dark:bg-amber-900';
        textColor = 'text-amber-800 dark:text-amber-200';
        bgHoverColor = 'hover:bg-amber-200 dark:hover:bg-amber-800';
        break;
      case 'UNPAID':
        bgColor = 'bg-red-100 dark:bg-red-900';
        textColor = 'text-red-800 dark:text-red-200';
        bgHoverColor = 'hover:bg-red-200 dark:hover:bg-red-800';
        break;
      default:
        break;
    }
    
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium transition-colors ${bgColor} ${textColor} ${bgHoverColor}`}>
        {status === 'PARTIAL' ? 'Partially Paid' : status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="mobile-page bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <div className="mobile-content">
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-indigo-600 dark:border-indigo-400"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-page bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <div className="mobile-content">
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 p-4 mb-4 rounded-lg shadow">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400 dark:text-red-500" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/purchases')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:ring-offset-gray-900 transition-colors"
          >
            Back to Purchases
          </button>
        </div>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="mobile-page bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <div className="mobile-content">
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Purchase not found</p>
            <button
              onClick={() => navigate('/purchases')}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:ring-offset-gray-900 transition-colors"
            >
              Back to Purchases
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page bg-slate-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="mobile-content">
        {/* Header - Enhanced with gradient background */}
        <div className="bg-gradient-to-r from-indigo-600 to-sky-500 dark:from-indigo-800 dark:to-sky-700 rounded-xl shadow-lg p-6 mb-6 text-white">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold">Purchase Details</h1>
              <p className="mt-1 text-indigo-100 dark:text-indigo-200 flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {purchase.purchaseNumber ? `#${purchase.purchaseNumber}` : `ID: ${purchaseId.substring(0, 8)}`}
              </p>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => navigate('/purchases')}
                className="inline-flex items-center px-3 py-2 border border-indigo-300 dark:border-indigo-400 shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-indigo-700 dark:bg-indigo-800 bg-opacity-50 hover:bg-opacity-70 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white focus:ring-offset-indigo-600 dark:focus:ring-offset-indigo-800 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back
              </button>
              <button
                onClick={() => navigate(`/purchases/edit/${purchaseId}`)}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-indigo-700 dark:text-indigo-800 bg-white dark:bg-gray-100 hover:bg-indigo-50 dark:hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-white focus:ring-offset-indigo-600 dark:focus:ring-offset-indigo-800 transition-all"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            </div>
          </div>
          
          {/* Status Badge */}
          <div className="mt-4 flex items-center">
            {getPaymentStatusBadge(purchase.paymentStatus)}
            <span className="ml-3 text-sm text-indigo-100 dark:text-indigo-200 flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {formatDate(purchase.purchaseDate)}
            </span>
          </div>
        </div>

        {/* Vendor Card - New design with icon */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="px-6 py-5 bg-gradient-to-r from-emerald-500 to-teal-500 dark:from-emerald-700 dark:to-teal-700 text-white">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h3 className="text-lg leading-6 font-medium">Vendor Information</h3>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="text-xl font-bold text-gray-900 dark:text-white">
                  {purchase.vendorName || (vendor && vendor.opticalName) || '-'}
                </h4>
                {vendor && vendor.contactPerson && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Contact Person: {vendor.contactPerson}</p>
                )}
                {vendor && vendor.city && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{vendor.city}</p>
                )}
              </div>
              
              <div className="mt-3 md:mt-0 flex flex-col text-right">
                <div className="flex items-center justify-end mb-1 text-sm text-gray-600 dark:text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Purchase #: <span className="font-medium ml-1 text-gray-900 dark:text-white">{purchase.purchaseNumber || '-'}</span>
                </div>
                <div className="flex items-center justify-end text-sm text-gray-600 dark:text-gray-400">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Invoice #: <span className="font-medium ml-1 text-gray-900 dark:text-white">{purchase.vendorInvoiceNumber || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table - Enhanced with better visual design */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="px-6 py-5 bg-gradient-to-r from-purple-500 to-indigo-500 dark:from-purple-700 dark:to-indigo-700 text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <h3 className="text-lg leading-6 font-medium">Purchase Items</h3>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-200 dark:bg-purple-800 text-purple-800 dark:text-purple-200">
                {purchase.items?.length || 0} items
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900">
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Qty
                  </th>
                  <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Unit
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Price
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Discount
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {purchase.items && purchase.items.length > 0 ? (
                  purchase.items.map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-indigo-50 dark:bg-gray-700'}>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        <div className="font-medium">{item.itemName}</div>
                        {item.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{item.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right font-medium">
                        {item.qty}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-center">
                        {item.unit}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right">
                        {formatCurrency(item.price)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white text-right">
                        {item.itemDiscountType === 'percentage' 
                          ? <span className="text-amber-600 dark:text-amber-400">{item.itemDiscount}%</span> 
                          : <span className="text-amber-600 dark:text-amber-400">{formatCurrency(item.itemDiscount)}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900 dark:text-white text-right">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-sm text-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-900">
                      <div className="flex flex-col items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-gray-400 dark:text-gray-600 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                        <p>No items in this purchase</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Card - Enhanced with better visual hierarchy */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          {/* Tax Details */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow md:col-span-1">
            <div className="px-6 py-4 bg-gradient-to-r from-cyan-500 to-sky-500 dark:from-cyan-700 dark:to-sky-700 text-white">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
                </svg>
                <h3 className="text-base font-medium">Tax Details</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Tax Type</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{getTaxLabel(purchase.taxOption)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Tax Amount</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatCurrency(purchase.taxAmount)}</span>
              </div>
            </div>
          </div>

          {/* Discount Info */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow md:col-span-1">
            <div className="px-6 py-4 bg-gradient-to-r from-rose-500 to-pink-500 dark:from-rose-700 dark:to-pink-700 text-white">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="text-base font-medium">Discount Info</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Discount Type</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {purchase.discountType === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Discount Value</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {purchase.discountType === 'percentage' 
                    ? `${purchase.discountValue}%` 
                    : formatCurrency(purchase.discountValue)}
                </span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Discount Amount</span>
                <span className="text-sm font-medium text-rose-600 dark:text-rose-400">{formatCurrency(purchase.discountAmount)}</span>
              </div>
            </div>
          </div>

          {/* Additional Charges */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow md:col-span-1">
            <div className="px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-700 dark:to-orange-700 text-white">
              <div className="flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
                </svg>
                <h3 className="text-base font-medium">Additional Charges</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">Freight Charges</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatCurrency(purchase.frieghtCharge)}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-100 dark:border-gray-700">
                <span className="text-sm text-gray-500 dark:text-gray-400">Subtotal (before tax)</span>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{formatCurrency(purchase.subtotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Payment Summary Card */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden mb-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-shadow">
          <div className="px-6 py-5 bg-gradient-to-r from-green-500 to-emerald-500 dark:from-green-700 dark:to-emerald-700 text-white">
            <div className="flex items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2z" />
              </svg>
              <h3 className="text-lg leading-6 font-medium">Payment Information</h3>
            </div>
          </div>
          <div className="px-6 py-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Payment Status</span>
                <div>{getPaymentStatusBadge(purchase.paymentStatus)}</div>
              </div>
              
              <div className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Amount Paid</span>
                <span className="text-base font-medium text-gray-900 dark:text-white">{formatCurrency(purchase.amountPaid)}</span>
              </div>
              
              <div className="flex flex-col items-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Balance Due</span>
                <span className={`text-base font-medium ${purchase.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                  {formatCurrency(purchase.balance)}
                </span>
              </div>
            </div>
            
            <div className="mt-6 p-5 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-gray-700 dark:text-gray-300">Total Amount</span>
                <span className="text-2xl font-bold text-indigo-700 dark:text-indigo-400">{formatCurrency(purchase.totalAmount)}</span>
              </div>
            </div>
            
            {purchase.notes && (
              <div className="mt-6 p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Notes:
                </h4>
                <p className="text-sm text-gray-600 dark:text-gray-400 italic">{purchase.notes}</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-center space-x-4 mb-10">
          <button
            onClick={() => navigate('/purchases')}
            className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:ring-offset-gray-900 transition-colors"
          >
            Back to List
          </button>
          <button
            onClick={() => navigate(`/purchases/edit/${purchaseId}`)}
            className="px-4 py-2 bg-indigo-600 dark:bg-indigo-500 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:ring-offset-gray-900 transition-colors"
          >
            Edit Purchase
          </button>
        </div>
      </div>
    </div>
  );
};

export default PurchaseDetail; 
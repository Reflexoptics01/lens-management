import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';

const BalanceDueView = ({ formatCurrency, navigateToInvoiceLedger }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('customers'); // 'customers' or 'vendors'
  const [balanceAsOfDate, setBalanceAsOfDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [customerBalances, setCustomerBalances] = useState([]);
  const [vendorBalances, setVendorBalances] = useState([]);

  useEffect(() => {
    calculateBalanceSummary();
  }, []);

  // Helper function to parse dates consistently
  const parseDate = (dateInput) => {
    if (!dateInput) return null;
    
    let date;
    
    // If it's a Firestore timestamp
    if (typeof dateInput.toDate === 'function') {
      date = dateInput.toDate();
    } 
    // If it's a string (like '2023-05-17')
    else if (typeof dateInput === 'string') {
      const parts = dateInput.split('-'); // Expect YYYY-MM-DD
      if (parts.length === 3) {
        // Year, month (0-based), day. Directly to local midnight.
        date = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0, 0);
      } else {
        // Fallback for other string formats, attempts to parse, then normalize
        try {
          date = new Date(dateInput);
        } catch (error) {
          console.error('[BalanceDueView] Failed to parse date string (fallback):', dateInput, error);
          return null;
        }
      }
    } 
    // If it's already a Date object
    else if (dateInput instanceof Date) {
      date = dateInput; // Will be normalized below
    } 
    // Fallback for other types
    else {
      try {
        date = new Date(dateInput);
      } catch (error) {
        console.error('[BalanceDueView] Failed to parse date (unknown type):', dateInput, error);
        return null;
      }
    }

    // Normalize to local midnight of that date to ensure consistent comparisons
    // This creates a new Date object, crucial for not mutating original Firestore Timestamps if 'date' was a direct reference
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  };

  const calculateCustomerBalances = async (cutoffDate) => {
    try {
      // Fetch all customers
      const customersSnapshot = await getDocs(collection(db, 'customers'));
      const customersList = customersSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().opticalName,
        type: 'customer',
        ...doc.data()
      }));
      
      // For each customer, calculate their balance
      const summaryPromises = customersList.map(async (customer) => {
        // Fetch all sales (invoices) for this customer
        const salesQuery = query(collection(db, 'sales'), where('customerId', '==', customer.id));
        const salesSnapshot = await getDocs(salesQuery);
        
        const totalInvoiced = salesSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          const invoiceDate = parseDate(data.invoiceDate);
          
          if (invoiceDate && invoiceDate < cutoffDate) {
            return sum + parseFloat(data.totalAmount || 0);
          }
          return sum;
        }, 0);
        
        // Fetch all transactions for this customer
        const transactionsQuery = query(collection(db, 'transactions'), where('entityId', '==', customer.id));
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        const totalPaid = transactionsSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          const transactionDate = parseDate(data.date) || parseDate(data.createdAt);
          
          if (transactionDate && transactionDate < cutoffDate) {
            // For customers: 'received' reduces balance, 'paid' increases balance (refund)
            if (data.type === 'received') {
              return sum + parseFloat(data.amount || 0);
            } else if (data.type === 'paid') {
              return sum - parseFloat(data.amount || 0);
            }
          }
          return sum;
        }, 0);
        
        const balance = totalInvoiced - totalPaid;
        
        if (balance === 0 && totalInvoiced === 0 && totalPaid === 0) {
          return null; 
        }
        
        return { 
          id: customer.id, 
          name: customer.name, 
          address: customer.address || customer.customerAddress || '',
          city: customer.city || customer.customerCity || '',
          phone: customer.phoneNumber || customer.phone || customer.contactNumber || '',
          balance, 
          type: 'customer' 
        };
      });
      
      let customerBalances = await Promise.all(summaryPromises);
      customerBalances = customerBalances.filter(summary => summary !== null);
      customerBalances.sort((a, b) => b.balance - a.balance);
      
      return customerBalances;
    } catch (error) {
      console.error('[BalanceDueView] Error calculating customer balances:', error);
      return [];
    }
  };

  const calculateVendorBalances = async (cutoffDate) => {
    try {
      // Fetch all vendors (assuming they might be in 'vendors' collection or 'customers' with a type field)
      // Let's first try 'vendors' collection, then fall back to customers with vendor type
      let vendorsList = [];
      
      try {
        const vendorsSnapshot = await getDocs(collection(db, 'vendors'));
        vendorsList = vendorsSnapshot.docs.map(doc => ({
          id: doc.id,
          name: doc.data().name || doc.data().vendorName || doc.data().opticalName,
          type: 'vendor',
          ...doc.data()
        }));
      } catch (vendorError) {
        console.log('[BalanceDueView] No vendors collection found, checking customers with vendor type');
        
        // Fallback: look for customers marked as vendors
        const customersSnapshot = await getDocs(collection(db, 'customers'));
        vendorsList = customersSnapshot.docs
          .map(doc => ({
            id: doc.id,
            name: doc.data().opticalName,
            type: 'vendor',
            ...doc.data()
          }))
          .filter(customer => customer.isVendor || customer.type === 'vendor');
      }
      
      // If still no vendors found, let's try to get unique vendors from purchases
      if (vendorsList.length === 0) {
        const purchasesSnapshot = await getDocs(collection(db, 'purchases'));
        const vendorIds = new Set();
        const vendorData = new Map();
        
        purchasesSnapshot.docs.forEach(doc => {
          const purchase = doc.data();
          if (purchase.vendorId && purchase.vendorName) {
            vendorIds.add(purchase.vendorId);
            vendorData.set(purchase.vendorId, {
              name: purchase.vendorName,
              address: purchase.vendorAddress || '',
              city: purchase.vendorCity || '',
              phone: purchase.vendorPhone || purchase.vendorContactNumber || ''
            });
          }
        });
        
        // Try to fetch complete vendor details from customers collection
        const customersSnapshot = await getDocs(collection(db, 'customers'));
        const customerVendors = new Map();
        
        customersSnapshot.docs.forEach(doc => {
          const customer = doc.data();
          if (vendorIds.has(doc.id)) {
            customerVendors.set(doc.id, {
              name: customer.opticalName || customer.name,
              address: customer.address || customer.customerAddress || '',
              city: customer.city || customer.customerCity || '',
              phone: customer.phoneNumber || customer.phone || customer.contactNumber || ''
            });
          }
        });
        
        vendorsList = Array.from(vendorIds).map(vendorId => {
          // Prefer customer data if available, otherwise use purchase data
          const vendorInfo = customerVendors.get(vendorId) || vendorData.get(vendorId);
          return {
            id: vendorId,
            name: vendorInfo.name,
            address: vendorInfo.address,
            city: vendorInfo.city,
            phone: vendorInfo.phone,
            type: 'vendor'
          };
        });
      }
      
      console.log('[BalanceDueView] Found vendors:', vendorsList);
      
      // For each vendor, calculate their balance
      const summaryPromises = vendorsList.map(async (vendor) => {
        // Fetch all purchases from this vendor
        const purchasesQuery = query(collection(db, 'purchases'), where('vendorId', '==', vendor.id));
        const purchasesSnapshot = await getDocs(purchasesQuery);
        
        const totalPurchased = purchasesSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          const purchaseDate = parseDate(data.purchaseDate || data.date || data.createdAt);
          
          if (purchaseDate && purchaseDate < cutoffDate) {
            return sum + parseFloat(data.totalAmount || data.total || 0);
          }
          return sum;
        }, 0);
        
        // Fetch all transactions for this vendor
        const transactionsQuery = query(collection(db, 'transactions'), where('entityId', '==', vendor.id));
        const transactionsSnapshot = await getDocs(transactionsQuery);
        
        const totalPaid = transactionsSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          const transactionDate = parseDate(data.date) || parseDate(data.createdAt);
          
          if (transactionDate && transactionDate < cutoffDate) {
            // For vendors: 'paid' reduces balance (we paid them), 'received' increases balance (they paid us back)
            if (data.type === 'paid') {
              return sum + parseFloat(data.amount || 0);
            } else if (data.type === 'received') {
              return sum - parseFloat(data.amount || 0);
            }
          }
          return sum;
        }, 0);
        
        const balance = totalPurchased - totalPaid;
        
        if (balance === 0 && totalPurchased === 0 && totalPaid === 0) {
          return null; 
        }
        
        return { 
          id: vendor.id, 
          name: vendor.name, 
          address: vendor.address || vendor.vendorAddress || '',
          city: vendor.city || vendor.vendorCity || '',
          phone: vendor.phone || '',
          balance, 
          type: 'vendor' 
        };
      });
      
      let vendorBalances = await Promise.all(summaryPromises);
      vendorBalances = vendorBalances.filter(summary => summary !== null);
      vendorBalances.sort((a, b) => b.balance - a.balance);
      
      return vendorBalances;
    } catch (error) {
      console.error('[BalanceDueView] Error calculating vendor balances:', error);
      return [];
    }
  };

  const calculateBalanceSummary = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors

      const selectedAsOfDate = parseDate(balanceAsOfDate);
      if (!selectedAsOfDate) {
        setError("Invalid 'as of' date. Please select a valid date.");
        setLoading(false);
        setCustomerBalances([]);
        setVendorBalances([]);
        return;
      }

      // Cutoff is the START of the day AFTER the selected "as of" date.
      // Items must be strictly BEFORE this cutoff.
      const cutoffDate = new Date(selectedAsOfDate.getFullYear(), selectedAsOfDate.getMonth(), selectedAsOfDate.getDate() + 1, 0, 0, 0, 0);
      
      console.log(`[BalanceDueView] Calculating balances for items strictly BEFORE ${cutoffDate.toISOString()} (selected 'as of' date: ${selectedAsOfDate.toISOString()})`);
      
      // Calculate customer and vendor balances in parallel
      const [customerBalances, vendorBalances] = await Promise.all([
        calculateCustomerBalances(cutoffDate),
        calculateVendorBalances(cutoffDate)
      ]);
      
      console.log('[BalanceDueView] Customer balances:', customerBalances);
      console.log('[BalanceDueView] Vendor balances:', vendorBalances);
      
      setCustomerBalances(customerBalances);
      setVendorBalances(vendorBalances);
      
    } catch (error) {
      console.error('[BalanceDueView] Error calculating balance summary:', error);
      setError('Failed to calculate balance summary. Please check console for details.');
      setCustomerBalances([]); // Clear summary on error
      setVendorBalances([]);
    } finally {
      setLoading(false);
    }
  };

  // useEffect to recalculate when balanceAsOfDate changes
  useEffect(() => {
    calculateBalanceSummary();
  }, [balanceAsOfDate]); // Dependency array includes balanceAsOfDate

  // Format the date for display
  const formatDisplayDate = (dateString) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-GB', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch (error) {
      return dateString;
    }
  };

  // Function to handle printing the table
  const handlePrint = () => {
    const printContents = document.getElementById('balance-table-container').innerHTML;
    const originalContents = document.body.innerHTML;
    
    // Create a styled print layout
    const printPage = `
      <html>
        <head>
          <title>Balance Due Report - ${formatDisplayDate(balanceAsOfDate)}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .text-right { text-align: right; }
            .balance-negative { color: green; }
            .balance-positive { color: red; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            h2 { margin-bottom: 5px; }
            .subtitle { margin-top: 0; color: #666; }
          </style>
        </head>
        <body>
          <h2>Balance Due Report</h2>
          <p class="subtitle">As of ${formatDisplayDate(balanceAsOfDate)}</p>
          ${printContents}
        </body>
      </html>
    `;
    
    document.body.innerHTML = printPage;
    window.print();
    document.body.innerHTML = originalContents;
    
    // Force a refresh of the app after printing
    window.location.reload();
  };

  // Function to export as Excel
  const exportToExcel = () => {
    const currentBalances = viewMode === 'customers' ? customerBalances : vendorBalances;
    if (!currentBalances.length) return;
    
    // Create CSV content
    let csvContent = "Party Type,Party Name,Address,City,Phone,Balance Due\n";
    
    // Add data rows for current view
    currentBalances.forEach(summary => {
      const partyType = viewMode === 'customers' ? 'Customer' : 'Vendor';
      csvContent += `"${partyType}","${summary.name}","${summary.address || ''}","${summary.city || ''}","${summary.phone || ''}",${summary.balance}\n`;
    });
    
    // Add total
    const total = currentBalances.reduce((sum, item) => sum + item.balance, 0);
    csvContent += `"","Total ${viewMode === 'customers' ? 'Customer' : 'Vendor'} Balance","","","",${total}\n`;
    
    // Create a hidden download link
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${viewMode === 'customers' ? 'Customer' : 'Vendor'}_Balance_Due_${balanceAsOfDate}.csv`);
    document.body.appendChild(link);
    
    // Trigger download and clean up
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-6">
      <div className="p-3 border-b border-gray-200 dark:border-gray-600">
        <div className="flex flex-wrap items-center justify-between">
          <div className="flex items-center">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">
              As of:
            </label>
            <input
              type="date"
              value={balanceAsOfDate}
              onChange={(e) => {
                setBalanceAsOfDate(e.target.value);
              }}
              className="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-400 dark:border-gray-500 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 text-sm"
            />
          </div>
          
          {/* Switch buttons for customer/vendor view */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mt-2 sm:mt-0">
            <button
              onClick={() => setViewMode('customers')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'customers'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Customers
            </button>
            <button
              onClick={() => setViewMode('vendors')}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'vendors'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              Vendors
            </button>
          </div>
          
          <div className="flex gap-2 mt-2 sm:mt-0">
            <button 
              onClick={handlePrint}
              className="flex items-center px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded border border-gray-300 dark:border-gray-600 text-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button 
              onClick={exportToExcel}
              className="flex items-center px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300 rounded border border-green-300 dark:border-green-700 text-sm hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export as Excel
            </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="p-4 text-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="flex flex-col items-center justify-center py-12 bg-gray-50 dark:bg-gray-700/50">
          <div className="animate-spin w-10 h-10 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full mb-4"></div>
          <p className="text-gray-500 dark:text-gray-400">Calculating balances as of {formatDisplayDate(balanceAsOfDate)}...</p>
        </div>
      ) : (
        <div id="balance-table-container" className="overflow-x-auto">
          {/* Customer Balances Section */}
          {viewMode === 'customers' && customerBalances.length > 0 && (
            <div className="mb-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="border-b border-gray-300 dark:border-gray-600">
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600 w-[60px]">S.No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Customer Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">City</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Phone</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[150px]">Balance Due</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                  {customerBalances.map((summary, index) => (
                    <tr 
                      key={`customer-${summary.id}`} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600"
                      onClick={() => navigateToInvoiceLedger(summary)}
                    >
                      <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {summary.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {summary.address}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {summary.city}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {summary.phone}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                        summary.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatCurrency(summary.balance)}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Customer Total row */}
                  <tr className="bg-blue-100 dark:bg-blue-900/30 border-t-2 border-blue-300 dark:border-blue-600">
                    <td colSpan="5" className="px-4 py-3 font-semibold text-blue-900 dark:text-blue-100 border-r border-blue-200 dark:border-blue-600">
                      Total Customer Balance
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-blue-900 dark:text-blue-100">
                      {formatCurrency(customerBalances.reduce((sum, item) => sum + item.balance, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Vendor Balances Section */}
          {viewMode === 'vendors' && vendorBalances.length > 0 && (
            <div className="mb-6">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr className="border-b border-gray-300 dark:border-gray-600">
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600 w-[60px]">S.No</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Vendor Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Address</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">City</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Phone</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[150px]">Balance Payable</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                  {vendorBalances.map((summary, index) => (
                    <tr 
                      key={`vendor-${summary.id}`} 
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600"
                      onClick={() => navigateToInvoiceLedger(summary)}
                    >
                      <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {summary.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {summary.address}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {summary.city}
                      </td>
                      <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                        {summary.phone}
                      </td>
                      <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                        summary.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                      }`}>
                        {formatCurrency(summary.balance)}
                      </td>
                    </tr>
                  ))}
                  
                  {/* Vendor Total row */}
                  <tr className="bg-orange-100 dark:bg-orange-900/30 border-t-2 border-orange-300 dark:border-orange-600">
                    <td colSpan="5" className="px-4 py-3 font-semibold text-orange-900 dark:text-orange-100 border-r border-orange-200 dark:border-orange-600">
                      Total Vendor Balance
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-orange-900 dark:text-orange-100">
                      {formatCurrency(vendorBalances.reduce((sum, item) => sum + item.balance, 0))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* No data message for selected view */}
          {((viewMode === 'customers' && customerBalances.length === 0) || 
            (viewMode === 'vendors' && vendorBalances.length === 0)) && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <p>No outstanding {viewMode === 'customers' ? 'customer' : 'vendor'} balances found as of {formatDisplayDate(balanceAsOfDate)}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BalanceDueView; 
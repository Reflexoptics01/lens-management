import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AccountStatementView from '../components/AccountStatementView';
import InvoiceLedgerView from '../components/InvoiceLedgerView';
import BalanceDueView from '../components/BalanceDueView';
import LedgerFilters from '../components/LedgerFilters';

const Ledger = () => {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('accountStatement'); // 'accountStatement', 'invoiceOnly', 'balanceView'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filter states
  const [fromDate, setFromDate] = useState(() => {
    const date = new Date();
    date.setDate(1); // First day of current month
    return date.toISOString().split('T')[0];
  });
  
  const [toDate, setToDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  
  const [selectedEntity, setSelectedEntity] = useState(null);
  
  // Ledger data
  const [ledgerData, setLedgerData] = useState([]);
  
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
      date = new Date(dateInput);
    } 
    // If it's already a Date object
    else if (dateInput instanceof Date) {
      date = dateInput;
    } 
    // Fallback
    else {
      try {
        date = new Date(dateInput);
      } catch (error) {
        console.error('Failed to parse date:', dateInput);
        return null;
      }
    }
    
    // Set to noon to avoid timezone issues
    date.setHours(12, 0, 0, 0);
    
    return date;
  };
  
  const fetchLedgerData = async () => {
    if (!selectedEntity) {
      setError('Please select a party first');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Create date objects for range filtering
      const startDateObj = new Date(fromDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      
      const endDateObj = new Date(toDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      
      console.log('Filtering ledger data between:', startDateObj, 'and', endDateObj);
      
      // Fetch invoices from the sales collection
      const salesRef = collection(db, 'sales');
      const salesQuery = query(
        salesRef,
        where('customerId', '==', selectedEntity.id),
        where('invoiceDate', '>=', startDateObj),
        where('invoiceDate', '<=', endDateObj),
        orderBy('invoiceDate', 'asc')
      );
      
      const invoicesSnapshot = await getDocs(salesQuery);
      const invoices = invoicesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          type: 'invoice',
          ...data,
          // Use proper field names from sales collection
          invoiceNumber: data.invoiceNumber,
          totalAmount: data.totalAmount,
          items: data.items || [],
          date: data.invoiceDate ? data.invoiceDate.toDate() : null
        };
      });
      
      // Fetch transactions for the selected entity 
      const transactionsRef = collection(db, 'transactions');
      const transactionsQuery = query(
        transactionsRef,
        where('entityId', '==', selectedEntity.id)
      );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      // Process all transactions and filter by date range
      let allTransactions = transactionsSnapshot.docs.map(doc => {
        const data = doc.data();
        
        // Parse date consistently
        const transactionDate = parseDate(data.date) || parseDate(data.createdAt);
        
        return {
          id: doc.id,
          type: 'transaction',
          ...data,
          date: transactionDate
        };
      });
      
      // Filter by date range
      const transactions = allTransactions.filter(transaction => {
        if (!transaction.date) return false;
        
        return transaction.date >= startDateObj && transaction.date <= endDateObj;
      });
      
      // Combine and sort both by date
      const combinedData = [...invoices, ...transactions].sort((a, b) => {
        if (!a.date) return -1;
        if (!b.date) return 1;
        return a.date - b.date;
      });
      
      // Calculate running balance
      let balance = 0;
      const dataWithBalance = combinedData.map(item => {
        if (item.type === 'invoice') {
          // For invoices, add to the balance (customer owes money)
          const amount = parseFloat(item.totalAmount || item.total || item.amount || 0);
          balance += amount;
        } else if (item.type === 'transaction' || item.type === 'received' || item.type === 'paid') {
          // For payments received, subtract from balance
          const amount = parseFloat(item.amount || 0);
          balance -= amount;
        }
        
        return {
          ...item,
          runningBalance: balance
        };
      });
      
      setLedgerData(dataWithBalance);
      
      // Setup window functions as soon as we have the data
      if (dataWithBalance.length > 0) {
        window.printLedger = () => handlePrint(viewMode);
        window.exportToExcel = () => exportToExcel(viewMode);
        window.shareViaWhatsApp = () => shareViaWhatsApp(viewMode);
      }
      
    } catch (error) {
      console.error('Error fetching ledger data:', error);
      setError('Failed to fetch ledger data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSearch = () => {
    fetchLedgerData();
    // Save filter state after search
    saveFilterState();
  };
  
  // Navigate to invoice ledger when clicking a party in balance view
  const navigateToInvoiceLedger = (entity) => {
    console.log('Navigating to invoice ledger for entity:', entity);
    
    // Set selected entity 
    const entityData = {
      id: entity.id,
      opticalName: entity.name
    };
    
    setSelectedEntity(entityData);
    
    // Set date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setFromDate(firstDay.toISOString().split('T')[0]);
    setToDate(now.toISOString().split('T')[0]);
    
    // Change view mode
    setViewMode('invoiceOnly');
    
    // Trigger search after state updates
    setTimeout(() => {
      fetchLedgerData();
    }, 300);
  };
  
  // Navigation functions for clicking on invoice or transaction
  const navigateToInvoiceDetail = (invoiceId) => {
    // Save current filter state to sessionStorage
    saveFilterState();
    navigate(`/sales/${invoiceId}`);
  };
  
  const navigateToTransactionDetail = (transactionId) => {
    // Save current filter state to sessionStorage
    saveFilterState();
    // Pass the transactionId as state so the Transactions page can open it for editing
    navigate('/transactions', { state: { editTransactionId: transactionId } });
  };
  
  // Save filter state to sessionStorage
  const saveFilterState = () => {
    const filterState = {
      viewMode,
      fromDate,
      toDate,
      selectedEntity: selectedEntity ? {
        id: selectedEntity.id,
        opticalName: selectedEntity.opticalName
      } : null
    };
    sessionStorage.setItem('ledgerFilterState', JSON.stringify(filterState));
  };
  
  // Restore filter state from sessionStorage
  const restoreFilterState = () => {
    const savedState = sessionStorage.getItem('ledgerFilterState');
    if (savedState) {
      try {
        const filterState = JSON.parse(savedState);
        if (filterState.viewMode) setViewMode(filterState.viewMode);
        if (filterState.fromDate) setFromDate(filterState.fromDate);
        if (filterState.toDate) setToDate(filterState.toDate);
        if (filterState.selectedEntity) setSelectedEntity(filterState.selectedEntity);
      } catch (error) {
        console.error('Error restoring filter state:', error);
      }
    }
  };
  
  // Try to restore filter state on component mount
  useEffect(() => {
    restoreFilterState();
  }, []);
  
  // Effect to fetch ledger data when filter state is restored
  useEffect(() => {
    if (selectedEntity && viewMode !== 'balanceView') {
      fetchLedgerData();
    }
  }, [selectedEntity, viewMode]); // Only trigger fetch when these keys change
  
  const formatDate = (date) => {
    if (!date) return '-';
    
    // Check if date is a Firebase timestamp or a Date object
    const dateObj = typeof date.toDate === 'function' ? date.toDate() : date;
    
    return dateObj.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };
  
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };
  
  const getPaymentMethodLabel = (method) => {
    if (!method) return '';
    switch(method) {
      case 'cash': return 'Cash';
      case 'upi': return 'UPI';
      case 'check': return 'Check';
      case 'bank_transfer': return 'Bank Transfer';
      default: return method;
    }
  };
  
  // Function to handle printing
  const handlePrint = (viewMode) => {
    let printContents = '';
    let title = '';
    
    if (viewMode === 'accountStatement') {
      printContents = document.getElementById('account-statement-container').innerHTML;
      title = `Account Statement - ${selectedEntity?.opticalName}`;
    } else if (viewMode === 'invoiceOnly') {
      printContents = document.getElementById('invoice-ledger-container').innerHTML;
      title = `Invoice Ledger - ${selectedEntity?.opticalName}`;
    }
    
    // Use a popup window for printing instead of replacing the current document
    const printWindow = window.open('', '_blank');
    
    // Create print content
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Arial, sans-serif; }
            table { width: 100%; border-collapse: collapse; }
            th, td { padding: 8px; text-align: left; border: 1px solid #ddd; }
            th { background-color: #f2f2f2; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .balance-negative { color: green; }
            .balance-positive { color: red; }
            .total-row { font-weight: bold; background-color: #f9f9f9; }
            h2 { margin-bottom: 5px; }
            .subtitle { margin-top: 0; color: #666; }
            .text-xs { font-size: 12px; }
                        .text-\[10px\] { font-size: 10px; }            .font-medium { font-weight: 500; }            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }            .mt-0\.5 { margin-top: 0.125rem; }
            .gap-2 { gap: 0.5rem; }
            .flex { display: flex; }
            .flex-wrap { flex-wrap: wrap; }
            .ml-2 { margin-left: 0.5rem; }
            .ml-4 { margin-left: 1rem; }
          </style>
        </head>
        <body>
          <h2>${title}</h2>
          <p class="subtitle">${formatDate(new Date(fromDate))} to ${formatDate(new Date(toDate))}</p>
          ${printContents}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    printWindow.focus();
    
    // Print after content is loaded
    printWindow.onload = function() {
      printWindow.print();
      // Don't close automatically so user can interact with print dialog
    };
  };
  
  // Function to export as Excel
  const exportToExcel = (viewMode) => {
    if (!ledgerData.length) return;
    
    let csvContent = '';
    let fileName = '';
    
    if (viewMode === 'accountStatement') {
      // Headers for Account Statement
      csvContent = "Date,Particulars,Invoice/Reference,Debit,Credit,Balance\n";
      
      // Add data rows
      ledgerData.forEach(item => {
        const date = formatDate(item.date);
        let particulars = '';
        
        if (item.type === 'invoice') {
          particulars = 'Invoice';
        } else if (item.type === 'transaction' || item.type === 'received' || item.type === 'paid') {
          particulars = 'Payment Received';
        }
        
        const reference = item.type === 'invoice' ? item.invoiceNumber : (item.notes || '-');
        const debit = item.type === 'invoice' ? (item.totalAmount || item.total || item.amount || 0) : '';
        const credit = (item.type === 'transaction' || item.type === 'received' || item.type === 'paid') ? (item.amount || 0) : '';
        const balance = item.runningBalance || 0;
        
        csvContent += `"${date}","${particulars}","${reference}","${debit}","${credit}","${balance}"\n`;
      });
      
      fileName = `Account_Statement_${selectedEntity?.opticalName}_${fromDate}_to_${toDate}.csv`;
    } else if (viewMode === 'invoiceOnly') {
      // Headers for Invoice Ledger
      csvContent = "Date,Type,Reference,Amount\n";
      
      // Add data rows
      ledgerData.forEach(item => {
        const date = formatDate(item.date);
        const type = item.type === 'invoice' ? 'Invoice' : 'Payment';
        const reference = item.type === 'invoice' ? item.invoiceNumber : (item.notes || item.paymentMethod || '-');
        const amount = item.type === 'invoice' 
          ? (item.totalAmount || item.total || item.amount || 0)
          : (item.amount || 0);
        
        csvContent += `"${date}","${type}","${reference}","${amount}"\n`;
      });
      
      fileName = `Invoice_Ledger_${selectedEntity?.opticalName}_${fromDate}_to_${toDate}.csv`;
    }
    
    // Create a hidden download link
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    
    // Trigger download and clean up
    link.click();
    document.body.removeChild(link);
  };
  
  // Function to share via WhatsApp
  const shareViaWhatsApp = (viewMode) => {
    if (!selectedEntity) return;
    
    let message = '';
    
    if (viewMode === 'accountStatement') {
      // Calculate total balance
      const totalInvoices = ledgerData
        .filter(item => item.type === 'invoice')
        .reduce((sum, invoice) => sum + parseFloat(invoice.totalAmount || invoice.total || invoice.amount || 0), 0);
      
      const totalTransactions = ledgerData
        .filter(item => item.type === 'transaction' || item.type === 'received' || item.type === 'paid')
        .reduce((sum, transaction) => sum + parseFloat(transaction.amount || 0), 0);
      
      const balance = totalInvoices - totalTransactions;
      
      message = `*Account Statement*\n\n` +
                `*Party:* ${selectedEntity.opticalName}\n` +
                `*Period:* ${formatDate(new Date(fromDate))} to ${formatDate(new Date(toDate))}\n` +
                `*Closing Balance:* ${formatCurrency(balance)}\n\n` +
                `To view the complete statement, please contact us.`;
    } else if (viewMode === 'invoiceOnly') {
      // Calculate net amount
      const totalInvoices = ledgerData
        .filter(item => item.type === 'invoice')
        .reduce((sum, invoice) => sum + parseFloat(invoice.totalAmount || invoice.total || invoice.amount || 0), 0);
      
      const totalPayments = ledgerData
        .filter(item => item.type !== 'invoice')
        .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      
      const netAmount = totalInvoices - totalPayments;
      
      message = `*Invoice Ledger*\n\n` +
                `*Party:* ${selectedEntity.opticalName}\n` +
                `*Period:* ${formatDate(new Date(fromDate))} to ${formatDate(new Date(toDate))}\n` +
                `*Net Amount:* ${formatCurrency(netAmount)}\n\n` +
                `To view the complete ledger, please contact us.`;
    }
    
    // Encode the message and create WhatsApp URL
    const encodedMessage = encodeURIComponent(message);
    const whatsappURL = `https://api.whatsapp.com/send?text=${encodedMessage}`;
    
    // Open WhatsApp in a new window
    window.open(whatsappURL, '_blank');
  };
  
  // Cleanup window functions when component unmounts
  useEffect(() => {
    return () => {
      window.printLedger = undefined;
      window.exportToExcel = undefined;
      window.shareViaWhatsApp = undefined;
    };
  }, []);
  
  // Update window functions when viewMode changes
  useEffect(() => {
    if (selectedEntity && ledgerData.length > 0) {
      window.printLedger = () => handlePrint(viewMode);
      window.exportToExcel = () => exportToExcel(viewMode);
      window.shareViaWhatsApp = () => shareViaWhatsApp(viewMode);
    }
  }, [viewMode, ledgerData]);
  
  return (
    <div className="mobile-page dark:bg-gray-900">
      <Navbar />
      
      <div className="mobile-content dark:bg-gray-900">
        {/* View Toggle Buttons */}
        <div className="my-2 flex bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
          <button
            className={`flex-1 py-1 px-2 rounded-md text-sm font-medium ${
              viewMode === 'accountStatement' 
                ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            onClick={() => {
              setViewMode('accountStatement');
              saveFilterState();
            }}
          >
            Account Statement
          </button>
          <button
            className={`flex-1 py-1 px-2 rounded-md text-sm font-medium ${
              viewMode === 'invoiceOnly' 
                ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            onClick={() => {
              setViewMode('invoiceOnly');
              saveFilterState();
            }}
          >
            Invoice Ledger
          </button>
          <button
            className={`flex-1 py-1 px-2 rounded-md text-sm font-medium ${
              viewMode === 'balanceView' 
                ? 'bg-white dark:bg-gray-700 text-blue-700 dark:text-blue-300 shadow-sm' 
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
            }`}
            onClick={() => {
              setViewMode('balanceView');
              saveFilterState();
            }}
          >
            Balance Due
          </button>
        </div>
        
        {/* Error Messages */}
        {error && (
          <div className="mb-2 p-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-md text-sm border border-red-200 dark:border-red-700">
            {error}
          </div>
        )}
        
        {/* Filters (only shown for transaction views, not balance view) */}
        {viewMode !== 'balanceView' && (
          <LedgerFilters 
            fromDate={fromDate}
            setFromDate={setFromDate}
            toDate={toDate}
            setToDate={setToDate}
            selectedEntity={selectedEntity}
            setSelectedEntity={setSelectedEntity}
            handleSearch={handleSearch}
            loading={loading}
          />
        )}
        
        {/* Account Statement View */}
        {viewMode === 'accountStatement' && ledgerData.length > 0 && (
          <div>
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedEntity?.opticalName} • {formatDate(new Date(fromDate))} to {formatDate(new Date(toDate))}
              </h3>
            </div>
            
            <AccountStatementView 
              ledgerData={ledgerData}
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              getPaymentMethodLabel={getPaymentMethodLabel}
              onInvoiceClick={navigateToInvoiceDetail}
              onTransactionClick={navigateToTransactionDetail}
            />
          </div>
        )}
        
        {/* Invoice Ledger View */}
        {viewMode === 'invoiceOnly' && ledgerData.length > 0 && (
          <div>
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedEntity?.opticalName} • {formatDate(new Date(fromDate))} to {formatDate(new Date(toDate))}
              </h3>
            </div>
            
            <InvoiceLedgerView 
              ledgerData={ledgerData} 
              formatDate={formatDate}
              formatCurrency={formatCurrency}
              onInvoiceClick={navigateToInvoiceDetail}
              onTransactionClick={navigateToTransactionDetail}
            />
          </div>
        )}
        
        {/* Balance Due View */}
        {viewMode === 'balanceView' && (
          <BalanceDueView 
            formatCurrency={formatCurrency} 
            navigateToInvoiceLedger={navigateToInvoiceLedger}
          />
        )}
        
        {/* No Data Message */}
        {viewMode !== 'balanceView' && !loading && ledgerData.length === 0 && selectedEntity && (
          <div className="text-center py-4 bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
            <svg className="w-10 h-10 text-gray-400 dark:text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 text-sm">No transactions found for selected criteria</p>
          </div>
        )}
        
        {/* Loading Indicator */}
        {loading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin w-6 h-6 border-3 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Ledger; 
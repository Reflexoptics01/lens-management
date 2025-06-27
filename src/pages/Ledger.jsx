import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import { formatDate, formatDateTime, safelyParseDate } from '../utils/dateUtils';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AccountStatementView from '../components/AccountStatementView';
import InvoiceLedgerView from '../components/InvoiceLedgerView';
import BalanceDueView from '../components/BalanceDueView';
import LedgerFilters from '../components/LedgerFilters';
import { securePrint, getSecureElementContent } from '../utils/securePrint';
import { toast } from 'react-hot-toast';

const Ledger = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
  
  const fetchLedgerData = async () => {
    if (!selectedEntity) {
      setError('Please select a party first');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Ensure we have complete customer/vendor data including opening balance
      let completeEntityData = selectedEntity;
      
      // If opening balance is missing or entity data is incomplete, fetch from database
      if (selectedEntity.openingBalance === undefined || selectedEntity.openingBalance === null) {
        try {
          const customersRef = getUserCollection('customers');
          const customerQuery = query(customersRef, where('__name__', '==', selectedEntity.id));
          const customerSnapshot = await getDocs(customerQuery);
          
          if (!customerSnapshot.empty) {
            const customerDoc = customerSnapshot.docs[0];
            const fullCustomerData = { id: customerDoc.id, ...customerDoc.data() };
            completeEntityData = {
              ...selectedEntity,
              openingBalance: fullCustomerData.openingBalance || 0,
              type: fullCustomerData.type || (fullCustomerData.isVendor ? 'vendor' : 'customer'),
              isVendor: fullCustomerData.isVendor || fullCustomerData.type === 'vendor',
              // Update selectedEntity with complete data for future use
              address: fullCustomerData.address,
              city: fullCustomerData.city,
              state: fullCustomerData.state,
              phone: fullCustomerData.phone,
              gstNumber: fullCustomerData.gstNumber
            };
            // Update the selectedEntity state with complete data
            setSelectedEntity(completeEntityData);
          }
        } catch (fetchError) {
          console.error('Error fetching complete customer data:', fetchError);
          // Continue with existing data, defaulting opening balance to 0
          completeEntityData = {
            ...selectedEntity,
            openingBalance: 0
          };
        }
      }
      
      // Create date objects for range filtering
      const startDateObj = new Date(fromDate);
      startDateObj.setHours(0, 0, 0, 0); // Start of day
      
      const endDateObj = new Date(toDate);
      endDateObj.setHours(23, 59, 59, 999); // End of day
      
      // REMOVED FOR PRODUCTION: console.log('Filtering ledger data between:', startDateObj, 'and', endDateObj);
      // REMOVED FOR PRODUCTION: console.log('Selected entity:', selectedEntity);
      
      let invoices = [];
      let purchases = [];
      
      // Determine if this is a customer or vendor entity
      const isVendor = completeEntityData.type === 'vendor' || completeEntityData.isVendor;
      
      // REMOVED FOR PRODUCTION: console.log('[Ledger] Entity detection:', {
      //   selectedEntity,
      //   isVendor,
      //   entityType: selectedEntity.type,
      //   entityIsVendor: selectedEntity.isVendor
      // });
      
      if (!isVendor) {
        // For customers: Fetch invoices from the sales collection
        const salesRef = getUserCollection('sales');
        const salesQuery = query(
          salesRef,
          where('customerId', '==', completeEntityData.id),
          where('invoiceDate', '>=', startDateObj),
          where('invoiceDate', '<=', endDateObj),
          orderBy('invoiceDate', 'asc')
        );
        
        const invoicesSnapshot = await getDocs(salesQuery);
        invoices = invoicesSnapshot.docs
          .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
          .map(doc => {
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
      } else {
        // For vendors: Fetch purchases from the purchases collection
        const purchasesRef = getUserCollection('purchases');
        const purchasesQuery = query(
          purchasesRef,
          where('vendorId', '==', completeEntityData.id)
        );
        
        const purchasesSnapshot = await getDocs(purchasesQuery);
        
        // Filter purchases by date range and process them
        purchases = purchasesSnapshot.docs
          .map(doc => {
            const data = doc.data();
            const purchaseDate = safelyParseDate(data.purchaseDate || data.date || data.createdAt);
            
            return {
              id: doc.id,
              type: 'purchase',
              ...data,
              date: purchaseDate,
              purchaseNumber: data.purchaseNumber || data.invoiceNumber,
              totalAmount: data.totalAmount || data.total,
              items: data.items || []
            };
          })
          .filter(purchase => {
            if (!purchase.date) return false;
            return purchase.date >= startDateObj && purchase.date <= endDateObj;
          });
      }
      
      // Fetch transactions for the selected entity 
      const transactionsRef = getUserCollection('transactions');
      const transactionsQuery = query(
        transactionsRef,
        where('entityId', '==', completeEntityData.id)
      );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      // Process all transactions and filter by date range
      let allTransactions = transactionsSnapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => {
          const data = doc.data();
          
          // Parse date consistently
          const transactionDate = safelyParseDate(data.date) || safelyParseDate(data.createdAt);
          
          return {
            id: doc.id,
            type: data.type, // Use the actual transaction type ('received' or 'paid')
            ...data,
            date: transactionDate
          };
        });
      
      // Filter by date range
      const transactions = allTransactions.filter(transaction => {
        if (!transaction.date) return false;
        
        return transaction.date >= startDateObj && transaction.date <= endDateObj;
      });
      
      // Create opening balance entry if it exists
      const openingBalanceEntries = [];
      // More robust opening balance parsing - handle null, undefined, empty strings, and non-numeric values
      let openingBalance = 0;
      
      if (completeEntityData.openingBalance !== null && completeEntityData.openingBalance !== undefined) {
        const parsedBalance = parseFloat(completeEntityData.openingBalance);
        if (!isNaN(parsedBalance)) {
          openingBalance = parsedBalance;
        }
      }
      
      // Always show opening balance if it's not exactly zero (could be positive or negative)
      if (openingBalance !== 0) {
        openingBalanceEntries.push({
          id: 'opening-balance',
          type: 'opening',
          date: startDateObj,
          description: 'Opening Balance',
          totalAmount: openingBalance,
          amount: openingBalance
        });
      }
      
      // Combine opening balance, invoices/purchases and transactions, then sort by date
      const combinedData = [...openingBalanceEntries, ...invoices, ...purchases, ...transactions].sort((a, b) => {
        if (!a.date) return -1;
        if (!b.date) return 1;
        return a.date - b.date;
      });
      
      // Calculate running balance
      let balance = 0;
      const dataWithBalance = combinedData.map(item => {
        if (item.type === 'opening') {
          // Opening balance sets the initial balance - use robust parsing
          const parsedOpeningBalance = parseFloat(item.amount || 0);
          balance = !isNaN(parsedOpeningBalance) ? parsedOpeningBalance : 0;
        } else if (item.type === 'invoice') {
          // For customer invoices, add to the balance (customer owes us money)
          const amount = parseFloat(item.totalAmount || item.total || item.amount || 0);
          balance += amount;
        } else if (item.type === 'purchase') {
          // For vendor purchases, add to the balance (we owe vendor money)
          const amount = parseFloat(item.totalAmount || item.total || item.amount || 0);
          balance += amount;
        } else if (item.type === 'received' || item.type === 'paid') {
          // Handle transactions based on entity type and transaction type
          const amount = parseFloat(item.amount || 0);
          
          if (!isVendor) {
            // For customers:
            if (item.type === 'received') {
              // Payment received from customer reduces their balance
              balance -= amount;
            } else if (item.type === 'paid') {
              // Payment made to customer (refund) increases their balance
              balance += amount;
            }
          } else {
            // For vendors:
            if (item.type === 'paid') {
              // Payment made to vendor reduces what we owe them
              balance -= amount;
            } else if (item.type === 'received') {
              // Payment received from vendor (rare, but could be refund) increases what we owe
              balance += amount;
            }
          }
        }
        
        return {
          ...item,
          runningBalance: balance
        };
      });
      
      setLedgerData(dataWithBalance);
      
      // Setup window functions as soon as we have the data
      if (dataWithBalance.length > 0) {
        window.printLedger = () => handlePrint();
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
    // REMOVED FOR PRODUCTION: console.log('Navigating to invoice ledger for entity:', entity);
    
    // Set selected entity with proper type information including opening balance
    const entityData = {
      id: entity.id,
      opticalName: entity.name,
      openingBalance: entity.openingBalance || 0, // Include opening balance
      type: entity.type, // This will be 'customer' or 'vendor'
      isVendor: entity.type === 'vendor'
    };
    
    setSelectedEntity(entityData);
    
    // Set date range to current month
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setFromDate(firstDay.toISOString().split('T')[0]);
    setToDate(now.toISOString().split('T')[0]);
    
    // Change view mode
    setViewMode('invoiceOnly');
    
    // Trigger search after state updates - use longer timeout to ensure all state is set
    setTimeout(() => {
      fetchLedgerData();
    }, 500);
  };
  
  // Navigation functions for clicking on invoice or transaction
  const navigateToInvoiceDetail = (invoiceId) => {
    // Save current filter state to sessionStorage
    saveFilterState();
    navigate(`/sales/${invoiceId}`);
  };
  
  const navigateToPurchaseDetail = (purchaseId) => {
    // Save current filter state to sessionStorage
    saveFilterState();
    navigate(`/purchases/${purchaseId}`);
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

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Only trigger if not typing in an input field
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' || event.target.tagName === 'SELECT') {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'b':
          setViewMode('balanceView');
          break;
        case 'i':
          setViewMode('invoiceOnly');
          break;
        case 'a':
          setViewMode('accountStatement');
          break;
        default:
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []);
  
  // Handle navigation state from other pages (like CreateSale.jsx)
  useEffect(() => {
    if (location.state) {
      const { selectedCustomer, viewMode: stateViewMode } = location.state;
      
      if (selectedCustomer) {
        setSelectedEntity(selectedCustomer);
      }
      
      if (stateViewMode) {
        setViewMode(stateViewMode);
      }
      
      // Set date range to current month when coming from external navigation
      if (selectedCustomer) {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        setFromDate(firstDay.toISOString().split('T')[0]);
        setToDate(now.toISOString().split('T')[0]);
      }
      
      // Save the new filter state and clear navigation state
      setTimeout(() => {
        saveFilterState();
        // Clear the navigation state to prevent reprocessing
        window.history.replaceState({}, document.title, window.location.pathname);
      }, 200);
    }
  }, [location.state]);
  
  // Effect to fetch ledger data when filter state is restored or navigation state is processed
  useEffect(() => {
    if (selectedEntity && viewMode !== 'balanceView') {
      // Add a delay to ensure state is fully set and avoid race conditions
      const timeoutId = setTimeout(() => {
        fetchLedgerData();
      }, 200);
      
      return () => clearTimeout(timeoutId);
    }
  }, [selectedEntity, viewMode, fromDate, toDate]); // Add date dependencies to refetch when dates change
  
  const formatDateDisplay = (date) => {
    if (!date) return '-';
    
    // Use safelyParseDate from dateUtils for consistent parsing
    const dateObj = safelyParseDate(date);
    
    if (!dateObj || isNaN(dateObj.getTime())) {
      return 'Invalid Date';
    }
    
    // Use formatDate from dateUtils for consistent formatting
    return formatDate(dateObj);
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
  const handlePrint = () => {
    try {
      let content = '';
      
      if (viewMode === 'accountStatement') {
        content = getSecureElementContent('account-statement-container');
      } else {
        content = getSecureElementContent('invoice-ledger-container');
      }
      
      if (!content) {
        throw new Error('Content not found for printing');
      }

      const printOptions = {
        title: viewMode === 'accountStatement' ? 'Account Statement' : 'Invoice Ledger',
        styles: `
          .ledger-table {
            width: 100%;
            border-collapse: collapse;
          }
          .ledger-table th,
          .ledger-table td {
            padding: 8px;
            text-align: left;
            border: 1px solid #ddd;
          }
          .ledger-table th {
            background-color: #f5f5f5;
            font-weight: bold;
          }
          .text-right { text-align: right; }
          .font-semibold { font-weight: 600; }
        `
      };

      const success = securePrint(content, printOptions);
      if (!success) {
        throw new Error('Print operation failed');
      }
    } catch (error) {
      toast.error(`Print failed: ${error.message}`);
    }
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
        const date = formatDateDisplay(item.date);
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
        const date = formatDateDisplay(item.date);
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
                `*Period:* ${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}\n` +
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
                `*Period:* ${formatDateDisplay(fromDate)} to ${formatDateDisplay(toDate)}\n` +
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
      window.printLedger = () => handlePrint();
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
            Account Statement (a)
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
            Invoice Ledger (i)
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
            Balance Due (b)
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
                {selectedEntity?.opticalName} • {formatDateDisplay(fromDate)} to {formatDateDisplay(toDate)}
              </h3>
            </div>
            
            <AccountStatementView 
              ledgerData={ledgerData}
              formatDate={formatDateDisplay}
              formatCurrency={formatCurrency}
              getPaymentMethodLabel={getPaymentMethodLabel}
              onInvoiceClick={navigateToInvoiceDetail}
              onPurchaseClick={navigateToPurchaseDetail}
              onTransactionClick={navigateToTransactionDetail}
            />
          </div>
        )}
        
        {/* Invoice Ledger View */}
        {viewMode === 'invoiceOnly' && ledgerData.length > 0 && (
          <div>
            <div className="p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 rounded-t-lg shadow-md">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                {selectedEntity?.opticalName} • {formatDateDisplay(fromDate)} to {formatDateDisplay(toDate)}
              </h3>
            </div>
            
            <InvoiceLedgerView 
              ledgerData={ledgerData} 
              formatDate={formatDateDisplay}
              formatCurrency={formatCurrency}
              onInvoiceClick={navigateToInvoiceDetail}
              onPurchaseClick={navigateToPurchaseDetail}
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
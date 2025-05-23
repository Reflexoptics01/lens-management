import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';

const BalanceDueView = ({ formatCurrency, navigateToInvoiceLedger }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [balanceAsOfDate, setBalanceAsOfDate] = useState(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [balanceSummary, setBalanceSummary] = useState([]);

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

  const calculateBalanceSummary = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors

      const selectedAsOfDate = parseDate(balanceAsOfDate);
      if (!selectedAsOfDate) {
        setError("Invalid 'as of' date. Please select a valid date.");
        setLoading(false);
        setBalanceSummary([]);
        return;
      }

      // Cutoff is the START of the day AFTER the selected "as of" date.
      // Items must be strictly BEFORE this cutoff.
      const cutoffDate = new Date(selectedAsOfDate.getFullYear(), selectedAsOfDate.getMonth(), selectedAsOfDate.getDate() + 1, 0, 0, 0, 0);
      
      console.log(`[BalanceDueView] Calculating balances for items strictly BEFORE ${cutoffDate.toISOString()} (selected 'as of' date: ${selectedAsOfDate.toISOString()})`);
      
      // Fetch all entities
      const entitiesSnapshot = await getDocs(collection(db, 'customers'));
      const entitiesList = entitiesSnapshot.docs.map(doc => ({
        id: doc.id,
        name: doc.data().opticalName,
        ...doc.data()
      }));
      
      // For each entity, calculate their balance
      const summaryPromises = entitiesList.map(async (entity) => {
        // Fetch all invoices
        const salesQuery = query(collection(db, 'sales'), where('customerId', '==', entity.id));
        const salesSnapshot = await getDocs(salesQuery);
        
        const totalInvoiced = salesSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          const invoiceDate = parseDate(data.invoiceDate);
          
          if (invoiceDate && invoiceDate < cutoffDate) {
            // console.log(`[BalanceDueView] Including INVOICE for ${entity.name}: ${data.invoiceNumber}, Date: ${invoiceDate.toISOString()}, Amount: ${data.totalAmount}`);
            return sum + parseFloat(data.totalAmount || 0);
          } else if (invoiceDate) {
            // console.log(`[BalanceDueView] Excluding INVOICE for ${entity.name}: ${data.invoiceNumber}, Date: ${invoiceDate.toISOString()} (Cutoff: ${cutoffDate.toISOString()})`);
          }
          return sum;
        }, 0);
        
        // Fetch all transactions
        const paymentsQuery = query(collection(db, 'transactions'), where('entityId', '==', entity.id));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        const totalPaid = paymentsSnapshot.docs.reduce((sum, doc) => {
          const data = doc.data();
          const transactionDate = parseDate(data.date) || parseDate(data.createdAt);
          
          if (transactionDate && transactionDate < cutoffDate) {
            // console.log(`[BalanceDueView] Including TRANSACTION for ${entity.name}: ${doc.id}, Date: ${transactionDate.toISOString()}, Amount: ${data.amount}`);
            return sum + parseFloat(data.amount || 0);
          } else if (transactionDate) {
            // console.log(`[BalanceDueView] Excluding TRANSACTION for ${entity.name}: ${doc.id}, Date: ${transactionDate.toISOString()} (Cutoff: ${cutoffDate.toISOString()})`);
          }
          return sum;
        }, 0);
        
        const balance = totalInvoiced - totalPaid;
        
        if (balance === 0 && totalInvoiced === 0 && totalPaid === 0) {
             return null; 
        }
        
        return { id: entity.id, name: entity.opticalName, balance };
      });
      
      let balanceSummaries = await Promise.all(summaryPromises);
      balanceSummaries = balanceSummaries.filter(summary => summary !== null);
      balanceSummaries.sort((a, b) => b.balance - a.balance);
      
      console.log('[BalanceDueView] Final balance summaries:', balanceSummaries);
      setBalanceSummary(balanceSummaries);
      
    } catch (error) {
      console.error('[BalanceDueView] Error calculating balance summary:', error);
      setError('Failed to calculate balance summary. Please check console for details.');
      setBalanceSummary([]); // Clear summary on error
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
    if (!balanceSummary.length) return;
    
    // Create CSV content
    let csvContent = "Party Name,Balance Due\n";
    
    // Add data rows
    balanceSummary.forEach(summary => {
      csvContent += `"${summary.name}",${summary.balance}\n`;
    });
    
    // Add total row
    const totalBalance = balanceSummary.reduce((sum, item) => sum + item.balance, 0);
    csvContent += `"Total Balance",${totalBalance}\n`;
    
    // Create a hidden download link
    const encodedUri = encodeURI("data:text/csv;charset=utf-8," + csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Balance_Due_${balanceAsOfDate}.csv`);
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
      ) : balanceSummary.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">
          <p>No outstanding balances found as of {formatDisplayDate(balanceAsOfDate)}</p>
        </div>
      ) : (
        <div id="balance-table-container" className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 border-collapse">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr className="border-b border-gray-300 dark:border-gray-600">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Party Name</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[150px]">Balance Due</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
              {balanceSummary.map((summary) => (
                <tr 
                  key={summary.id} 
                  className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600"
                  onClick={() => navigateToInvoiceLedger(summary)}
                >
                  <td className="px-4 py-3 text-sm text-left text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                    {summary.name}
                  </td>
                  <td className={`px-4 py-3 whitespace-nowrap text-sm text-right font-medium ${
                    summary.balance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                  }`}>
                    {formatCurrency(summary.balance)}
                  </td>
                </tr>
              ))}
              
              {/* Total row */}
              {balanceSummary.length > 0 && (
                <tr className="bg-gray-100 dark:bg-gray-700 border-t border-gray-300 dark:border-gray-600">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                    Total Balance
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-gray-100">
                    {formatCurrency(balanceSummary.reduce((sum, item) => sum + item.balance, 0))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default BalanceDueView; 
import { useState, useEffect } from 'react';

const InvoiceLedgerView = ({ ledgerData, formatDate, formatCurrency, onInvoiceClick, onTransactionClick, onPurchaseClick }) => {
  // Function to handle navigation for purchases
  const handlePurchaseClick = (purchaseId) => {
    // Navigate to purchase detail page
    if (onPurchaseClick) {
      onPurchaseClick(purchaseId);
    } else {
      // Fallback navigation if onPurchaseClick is not provided
      window.location.href = `/purchases/${purchaseId}`;
    }
  };

  return (
    <div id="invoice-ledger-container" className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[110px] border-r border-gray-200 dark:border-gray-600">Date</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Type</th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Reference</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[120px]">Amount</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
            {ledgerData.map((item, index) => (
              <tr 
                key={item.id + '-' + index} 
                className={`hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 ${
                  (item.type === 'invoice' && onInvoiceClick) || 
                  (item.type === 'purchase' && handlePurchaseClick) ||
                  ((item.type === 'transaction' || item.type === 'received' || item.type === 'paid' || item.type === 'payment') && onTransactionClick) 
                    ? 'cursor-pointer' 
                    : ''
                }`}
                onClick={() => {
                  if (item.type === 'invoice' && onInvoiceClick) {
                    onInvoiceClick(item.id);
                  } else if (item.type === 'purchase' && handlePurchaseClick) {
                    handlePurchaseClick(item.id);
                  } else if ((item.type === 'transaction' || item.type === 'received' || item.type === 'paid' || item.type === 'payment') && onTransactionClick) {
                    onTransactionClick(item.id);
                  }
                }}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                  {formatDate(item.date)}
                </td>
                <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                  {item.type === 'invoice' ? (
                    <div className="font-medium text-blue-800 dark:text-blue-200">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900/30">
                        📄 Invoice
                      </span>
                    </div>
                  ) : item.type === 'purchase' ? (
                    <div className="font-medium text-orange-800 dark:text-orange-200">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 dark:bg-orange-900/30">
                        🛒 Purchase
                      </span>
                    </div>
                  ) : (item.type === 'opening' || item.type === 'opening_balance' || item.type === 'openingBalance') ? (
                    <div className="font-medium text-purple-800 dark:text-purple-200">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-100 dark:bg-purple-900/30">
                        📊 Opening Balance
                      </span>
                    </div>
                  ) : (
                    <div className="font-medium text-green-800 dark:text-green-200">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-green-100 dark:bg-green-900/30">
                        💳 Payment
                      </span>
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                  {item.type === 'invoice' ? (
                    <span className="font-medium">{item.invoiceNumber}</span>
                  ) : item.type === 'purchase' ? (
                    <span className="font-medium">{item.purchaseNumber || item.invoiceNumber || 'Purchase'}</span>
                  ) : (item.type === 'opening' || item.type === 'opening_balance' || item.type === 'openingBalance') ? (
                    <span className="font-medium text-purple-600 dark:text-purple-400">Opening Balance</span>
                  ) : (
                    <span>{item.notes || item.paymentMethod || '-'}</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                  {item.type === 'invoice' || item.type === 'purchase' ? (
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatCurrency((() => {
                        // Show outstanding balance for invoices/purchases
                        if (item.balanceDue !== undefined && item.balanceDue !== null) {
                          return item.balanceDue;
                        }
                        const totalAmount = item.totalAmount || item.total || item.amount || 0;
                        const amountPaid = item.amountPaid || 0;
                        return totalAmount - amountPaid;
                      })())}
                    </span>
                  ) : (item.type === 'opening' || item.type === 'opening_balance' || item.type === 'openingBalance') ? (
                    <span className="font-medium text-purple-600 dark:text-purple-400">
                      {formatCurrency(item.totalAmount || item.total || item.amount || 0)}
                    </span>
                  ) : (
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(item.amount || 0)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            
            {/* Closing Balance Row */}
            <tr className="bg-gray-100 dark:bg-gray-700 border-t border-gray-300 dark:border-gray-600">
              <td colSpan="3" className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                Net Outstanding:
              </td>
              <td className="px-4 py-3 text-right font-bold">
                {(() => {
                  // Helper function to safely parse numbers
                  const safeParseFloat = (value) => {
                    if (value === null || value === undefined || value === '') return 0;
                    const parsed = parseFloat(value);
                    return isNaN(parsed) ? 0 : parsed;
                  };

                  // Get amount from item with multiple field fallbacks
                  const getItemAmount = (item) => {
                    return safeParseFloat(item.totalAmount) || 
                           safeParseFloat(item.total) || 
                           safeParseFloat(item.amount) || 0;
                  };

                  // Get outstanding balance for invoices/purchases (what's actually owed)
                  const getOutstandingAmount = (item) => {
                    // For invoices and purchases, use balanceDue if available, otherwise totalAmount - amountPaid
                    if (item.type === 'invoice' || item.type === 'purchase') {
                      // First check if balanceDue is available and valid
                      if (item.balanceDue !== undefined && item.balanceDue !== null) {
                        return safeParseFloat(item.balanceDue);
                      }
                      
                      // Otherwise calculate: totalAmount - amountPaid
                      const totalAmount = getItemAmount(item);
                      const amountPaid = safeParseFloat(item.amountPaid) || 0;
                      return totalAmount - amountPaid;
                    }
                    
                    // For other types, use the standard amount
                    return getItemAmount(item);
                  };

                  // Calculate opening balance - check multiple possible type values
                  const openingBalance = ledgerData
                    .filter(item => item.type === 'opening' || item.type === 'opening_balance' || item.type === 'openingBalance')
                    .reduce((sum, item) => {
                      const amount = getItemAmount(item);
                      return sum + amount;
                    }, 0);
                  
                  // Calculate total debits (invoices + purchases) - use outstanding amounts
                  const totalDebits = ledgerData
                    .filter(item => item.type === 'invoice' || item.type === 'purchase')
                    .reduce((sum, item) => {
                      const outstandingAmount = getOutstandingAmount(item);
                      return sum + outstandingAmount;
                    }, 0);
                  
                  // Calculate total credits (payments/transactions)
                  const totalCredits = ledgerData
                    .filter(item => item.type === 'transaction' || item.type === 'received' || item.type === 'paid' || item.type === 'payment')
                    .reduce((sum, item) => {
                      const amount = getItemAmount(item);
                      return sum + amount;
                    }, 0);
                  
                  // Net outstanding = Opening Balance + Debits - Credits
                  const netAmount = openingBalance + totalDebits - totalCredits;
                  

                  
                  const className = netAmount > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
                  return <span className={className}>{formatCurrency(netAmount)}</span>;
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default InvoiceLedgerView; 
import { useState, useEffect } from 'react';
import React from 'react';

const AccountStatementView = ({ ledgerData, formatDate, formatCurrency, getPaymentMethodLabel, onInvoiceClick, onTransactionClick, onPurchaseClick }) => {
  return (
    <div id="account-statement-container" className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden mb-6">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600 border-collapse">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr className="border-b border-gray-300 dark:border-gray-600">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[110px] border-r border-gray-200 dark:border-gray-600">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider border-r border-gray-200 dark:border-gray-600">Particulars</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[120px] border-r border-gray-200 dark:border-gray-600">Invoice/Ref</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[100px] border-r border-gray-200 dark:border-gray-600">Debit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[100px] border-r border-gray-200 dark:border-gray-600">Credit</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[120px]">Balance</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
            {ledgerData.map((item, index) => (
              <React.Fragment key={item.id + '-' + index}>
                {/* Main row with date, invoice/ref, debit, credit, balance */}
                <tr 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 ${
                    (item.type === 'invoice' && onInvoiceClick) || 
                    (item.type === 'purchase' && onPurchaseClick) ||
                    ((item.type === 'transaction' || item.type === 'received' || item.type === 'paid') && onTransactionClick) 
                      ? 'cursor-pointer' 
                      : ''
                  }`}
                  onClick={() => {
                    if (item.type === 'invoice' && onInvoiceClick) {
                      onInvoiceClick(item.id);
                    } else if (item.type === 'purchase' && onPurchaseClick) {
                      onPurchaseClick(item.id);
                    } else if ((item.type === 'transaction' || item.type === 'received' || item.type === 'paid') && onTransactionClick) {
                      onTransactionClick(item.id);
                    }
                  }}
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                    {formatDate(item.date)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                    {item.type === 'invoice' 
                      ? <div className="font-medium">Invoice</div>
                      : item.type === 'purchase'
                        ? <div className="font-medium">Purchase</div>
                        : item.type === 'transaction' || item.type === 'received' || item.type === 'paid' 
                          ? <div className="font-medium">Payment {item.type === 'received' ? 'Received' : 'Made'}</div>
                          : ''}
                    {item.type === 'transaction' || item.type === 'received' || item.type === 'paid' 
                      ? <div className="text-xs text-gray-600 dark:text-gray-400">{getPaymentMethodLabel(item.paymentMethod)} {item.notes ? `- ${item.notes}` : ''}</div>
                      : null}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                    {item.type === 'invoice' ? item.invoiceNumber 
                      : item.type === 'purchase' ? (item.purchaseNumber || item.invoiceNumber || 'Purchase')
                      : item.notes || '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                    {(item.type === 'invoice' || item.type === 'purchase')
                      ? <span className="font-medium">{formatCurrency(item.totalAmount || item.total || item.amount || 0)}</span> 
                      : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                    {(item.type === 'transaction' || item.type === 'received' || item.type === 'paid')
                      ? <span className="font-medium text-green-600 dark:text-green-400">{formatCurrency(item.amount || 0)}</span> 
                      : '-'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">
                    {formatCurrency(item.runningBalance)}
                  </td>
                </tr>
                
                {/* Details row for invoice/purchase items - only shown for invoices and purchases with items */}
                {(item.type === 'invoice' || item.type === 'purchase') && item.items && item.items.length > 0 && (
                  <tr className="bg-gray-50 dark:bg-gray-700/50">
                    <td className="border-r border-gray-200 dark:border-gray-600"></td>
                    <td colSpan="5" className="px-4 py-2 text-xs text-gray-600 dark:text-gray-300">
                      <div className="ml-4">
                        {item.items.map((i, idx) => (
                          <div key={idx} className="py-1 border-b border-gray-100 dark:border-gray-600 last:border-b-0">
                            <div className="flex justify-between">
                              <span className="font-medium text-xs">
                                <span className="inline-block w-5 text-gray-500 dark:text-gray-400">{idx + 1}.</span>
                                {i.itemName || i.name} {i.qty > 1 ? `(${i.qty})` : ''}
                              </span>
                              <span className="ml-2 text-xs">{formatCurrency(i.total)}</span>
                            </div>
                            {/* Show prescription details for invoice items */}
                            {item.type === 'invoice' && (i.sph || i.cyl || i.axis || i.add) && (
                              <div className="flex flex-wrap gap-2 text-gray-600 dark:text-gray-400 mt-0.5 text-[10px]">
                                {i.sph && <span>SPH: {i.sph}</span>}
                                {i.cyl && <span>CYL: {i.cyl}</span>}
                                {i.axis && <span>AXIS: {i.axis}</span>}
                                {i.add && <span>ADD: {i.add}</span>}
                                {i.qty && <span>QTY: {i.qty}</span>}
                              </div>
                            )}
                            {/* Show purchase item details */}
                            {item.type === 'purchase' && (
                              <div className="text-gray-600 dark:text-gray-400 mt-0.5 text-[10px]">
                                {i.unit && <span>Unit: {i.unit}</span>}
                                {i.price && <span className="ml-2">Price: {formatCurrency(i.price)}</span>}
                                {i.description && <span className="ml-2">Desc: {i.description}</span>}
                              </div>
                            )}
                            {/* Display eye details if available */}
                            {item.type === 'invoice' && i.eye && (
                              <div className="text-gray-600 dark:text-gray-400 mt-0.5 text-[10px]">
                                Eye: {i.eye}
                              </div>
                            )}
                            {/* Display prescription as fallback if detailed fields aren't available */}
                            {item.type === 'invoice' && i.prescription && !(i.sph || i.cyl || i.axis || i.add) && (
                              <div className="text-gray-600 dark:text-gray-400 mt-0.5 text-[10px]">
                                Prescription: {i.prescription}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            
            {/* Final balance row */}
            <tr className="bg-gray-100 dark:bg-gray-700 border-t border-gray-300 dark:border-gray-600">
              <td colSpan="5" className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                Closing Balance:
              </td>
              <td className="px-4 py-3 text-right font-bold">
                {(() => {
                  // Recalculate the balance directly from the displayed items
                  let recalculatedBalance = 0;
                  
                  // Calculate total invoices and purchases
                  const totalInvoicesAndPurchases = ledgerData
                    .filter(item => item.type === 'invoice' || item.type === 'purchase')
                    .reduce((sum, item) => sum + parseFloat(item.totalAmount || item.total || item.amount || 0), 0);
                  
                  // Calculate total transactions
                  const totalTransactions = ledgerData
                    .filter(item => item.type === 'transaction' || item.type === 'received' || item.type === 'paid')
                    .reduce((sum, transaction) => sum + parseFloat(transaction.amount || 0), 0);
                  
                  recalculatedBalance = totalInvoicesAndPurchases - totalTransactions;
                  console.log('Recalculated balance:', recalculatedBalance, 'Total invoices/purchases:', totalInvoicesAndPurchases, 'Total transactions:', totalTransactions);
                  
                  const className = recalculatedBalance > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400';
                  return <span className={className}>{formatCurrency(recalculatedBalance)}</span>;
                })()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AccountStatementView; 
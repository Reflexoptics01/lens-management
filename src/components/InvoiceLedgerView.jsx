import { useState, useEffect } from 'react';

const InvoiceLedgerView = ({ ledgerData, formatDate, formatCurrency, onInvoiceClick, onTransactionClick }) => {
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
                  ((item.type === 'transaction' || item.type === 'received' || item.type === 'paid') && onTransactionClick) 
                    ? 'cursor-pointer' 
                    : ''
                }`}
                onClick={() => {
                  if (item.type === 'invoice' && onInvoiceClick) {
                    onInvoiceClick(item.id);
                  } else if ((item.type === 'transaction' || item.type === 'received' || item.type === 'paid') && onTransactionClick) {
                    onTransactionClick(item.id);
                  }
                }}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                  {formatDate(item.date)}
                </td>
                <td className="px-4 py-3 text-sm text-center text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                  {item.type === 'invoice' ? (
                    <div className="font-medium text-gray-800 dark:text-gray-200">Invoice</div>
                  ) : (
                    <div className="font-medium text-gray-800 dark:text-gray-200">Payment</div>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                  {item.type === 'invoice' ? (
                    <span className="font-medium">{item.invoiceNumber}</span>
                  ) : (
                    <span>{item.notes || item.paymentMethod || '-'}</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                  {item.type === 'invoice' ? (
                    <span className="font-medium text-red-600 dark:text-red-400">
                      {formatCurrency(item.totalAmount || item.total || item.amount || 0)}
                    </span>
                  ) : (
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {formatCurrency(item.amount)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
            
            {/* Closing Balance Row */}
            <tr className="bg-gray-100 dark:bg-gray-700 border-t border-gray-300 dark:border-gray-600">
              <td colSpan="3" className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600">
                Net Amount:
              </td>
              <td className="px-4 py-3 text-right font-bold">
                {(() => {
                  // Calculate net amount (invoices - payments)
                  const totalInvoices = ledgerData
                    .filter(item => item.type === 'invoice')
                    .reduce((sum, invoice) => sum + parseFloat(invoice.totalAmount || invoice.total || invoice.amount || 0), 0);
                  
                  const totalPayments = ledgerData
                    .filter(item => item.type !== 'invoice')
                    .reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
                  
                  const netAmount = totalInvoices - totalPayments;
                  
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
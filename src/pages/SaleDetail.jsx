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
      const saleDoc = await getDoc(doc(db, 'sales', saleId));
      
      if (!saleDoc.exists()) {
        setError('Sale not found');
        return;
      }
      
      setSale({
        id: saleDoc.id,
        ...saleDoc.data(),
        createdAt: saleDoc.data().createdAt?.toDate() || new Date(),
        invoiceDate: saleDoc.data().invoiceDate?.toDate() || new Date(),
        dueDate: saleDoc.data().dueDate?.toDate() || null
      });
    } catch (error) {
      console.error('Error fetching sale details:', error);
      setError('Failed to fetch sale details');
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
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
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
      
      <main className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <button
                  onClick={() => navigate('/sales')}
                  className="inline-flex items-center text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 mb-2"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back to Sales
                </button>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Invoice Details</h1>
                <p className="text-gray-500 dark:text-gray-400">Invoice #{sale?.invoiceNumber}</p>
              </div>
              
              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => navigate(`/sales/edit/${saleId}`)}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit Invoice
                </button>
                
                <button
                  onClick={() => setShowPrintModal(true)}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print Invoice
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-600 rounded-md p-4">
              <div className="text-red-800 dark:text-red-200">{error}</div>
            </div>
          ) : sale ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2 space-y-6">
                {/* Invoice Information */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Invoice Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{sale.invoiceNumber}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Date</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{sale.invoiceDate}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{sale.dueDate || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Payment Status</label>
                      <div className="mt-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sale.paymentStatus)}`}>
                          {sale.paymentStatus}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Information */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Customer Information</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Customer Name</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{sale.customerName}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Address</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{sale.customerAddress}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">City</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{sale.customerCity}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">GST Number</label>
                      <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{sale.customerGst}</p>
                    </div>
                  </div>
                </div>

                {/* Invoice Items */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Invoice Items</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
                      <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Order ID</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item Name</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SPH</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CYL</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">AXIS</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ADD</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">QTY</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                        {sale.items && sale.items.map((item, index) => (
                          <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.orderId || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{item.itemName || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">{item.sph || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">{item.cyl || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">{item.axis || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">{item.add || '-'}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900 dark:text-gray-100">{item.qty || 1}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900 dark:text-gray-100">{formatCurrency(item.price || 0)}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900 dark:text-gray-100">{formatCurrency(item.total || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Notes */}
                {sale.notes && (
                  <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Notes</h2>
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{sale.notes}</p>
                  </div>
                )}
              </div>

              {/* Right Column - Invoice Summary */}
              <div className="space-y-6">
                {/* Invoice Summary */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Invoice Summary</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Subtotal:</span>
                      <span className="text-gray-900 dark:text-gray-100">{formatCurrency(sale.subtotal)}</span>
                    </div>
                    {sale.discountAmount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Discount:</span>
                        <span className="text-red-600 dark:text-red-400">-{formatCurrency(sale.discountAmount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">Tax ({sale.taxRate}%):</span>
                      <span className="text-gray-900 dark:text-gray-100">{formatCurrency(sale.taxAmount)}</span>
                    </div>
                    {(sale.frieghtCharge || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500 dark:text-gray-400">Freight:</span>
                        <span className="text-gray-900 dark:text-gray-100">{formatCurrency(sale.frieghtCharge || 0)}</span>
                      </div>
                    )}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
                      <div className="flex justify-between text-base font-medium">
                        <span className="text-gray-900 dark:text-white">Total:</span>
                        <span className="text-gray-900 dark:text-white">{formatCurrency(sale.totalAmount)}</span>
                      </div>
                    </div>
                    {sale.amountPaid > 0 && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Amount Paid:</span>
                          <span className="text-green-600 dark:text-green-400">{formatCurrency(sale.amountPaid)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 dark:text-gray-400">Balance:</span>
                          <span className="text-red-600 dark:text-red-400">{formatCurrency(sale.balanceDue)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Payment Information */}
                {sale.paymentStatus !== 'UNPAID' && (
                  <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Payment Information</h2>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Payment Status</label>
                        <div className="mt-1">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(sale.paymentStatus)}`}>
                            {sale.paymentStatus}
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Amount Paid</label>
                        <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">{formatCurrency(sale.amountPaid)}</p>
                      </div>
                      {sale.balanceDue > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Remaining Balance</label>
                          <p className="mt-1 text-sm font-medium text-red-600 dark:text-red-400">{formatCurrency(sale.balanceDue)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Additional Information */}
                <div className="bg-white dark:bg-gray-800 shadow-sm rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                  <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Additional Information</h2>
                  <div className="space-y-3 text-sm">
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Created Date</label>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {sale.createdAt ? new Date(sale.createdAt.toDate()).toLocaleString() : 'N/A'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-500 dark:text-gray-400">Discount</label>
                      <p className="mt-1 text-gray-900 dark:text-gray-100">
                        {sale.discountType === 'percentage' ? `${sale.discountValue}%` : formatCurrency(sale.discountValue)}
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
          saleId={saleId}
          onClose={() => setShowPrintModal(false)}
        />
      )}
    </div>
  );
};

export default SaleDetail; 
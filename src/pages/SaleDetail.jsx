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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header with actions */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice Details</h1>
            <p className="text-sm text-gray-500 mt-1">View and manage invoice information</p>
          </div>
          
          <div className="mt-4 md:mt-0 flex space-x-2">
            <button
              onClick={() => navigate('/sales')}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back
            </button>
            
            <button
              onClick={() => navigate(`/sales/edit/${saleId}`)}
              className="px-4 py-2 border border-blue-500 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit
            </button>
            
            <button
              onClick={handlePrintInvoice}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
              disabled={loading}
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              {loading ? 'Processing...' : 'Print'}
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
            <p>{error}</p>
          </div>
        )}
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        ) : sale ? (
          <>
            {/* Invoice Header Card */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
              {/* Invoice Information */}
              <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-blue-500">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Information</h2>
                
                <div className="space-y-3">
                  <div className="flex items-center">
                    <span className="text-gray-500 w-1/3">Invoice #:</span>
                    <span className="font-medium text-gray-900">{sale.invoiceNumber}</span>
                  </div>
                  
                  <div className="flex items-center">
                    <span className="text-gray-500 w-1/3">Date:</span>
                    <span className="text-gray-900">{formatDate(sale.invoiceDate)}</span>
                  </div>
                  
                  {sale.dueDate && (
                    <div className="flex items-center">
                      <span className="text-gray-500 w-1/3">Due Date:</span>
                      <span className="text-gray-900">{formatDate(sale.dueDate)}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center">
                    <span className="text-gray-500 w-1/3">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(sale.paymentStatus)}`}>
                      {sale.paymentStatus}
                    </span>
                  </div>
                </div>
              </div>
              
              {/* Customer Information */}
              <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-purple-500">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Customer</h2>
                
                <div className="space-y-3">
                  <div>
                    <h3 className="font-medium text-gray-900 text-lg">{sale.customerName}</h3>
                    {sale.customerAddress && (
                      <p className="text-gray-500 text-sm mt-1">{sale.customerAddress}</p>
                    )}
                    {(sale.customerCity || sale.customerState) && (
                      <p className="text-gray-500 text-sm">
                        {sale.customerCity}
                        {sale.customerState ? `, ${sale.customerState}` : ''}
                      </p>
                    )}
                  </div>
                  
                  {sale.customerGst && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="text-gray-500">GST Number:</span>
                      <span className="text-gray-900 ml-2">{sale.customerGst}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Payment Summary */}
              <div className="bg-white rounded-lg shadow-md p-6 border-t-4 border-green-500">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Payment</h2>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-500">Subtotal:</span>
                    <span className="text-gray-900">{formatCurrency(sale.subtotal)}</span>
                  </div>
                  
                  {sale.discountAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">
                        Discount{sale.discountType === 'percentage' ? ` (${sale.discountValue}%)` : ''}:
                      </span>
                      <span className="text-red-500">-{formatCurrency(sale.discountAmount)}</span>
                    </div>
                  )}
                  
                  {sale.taxAmount > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Tax ({sale.taxRate}%):</span>
                      <span className="text-gray-900">{formatCurrency(sale.taxAmount)}</span>
                    </div>
                  )}
                  
                  {sale.frieghtCharge > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-500">Freight:</span>
                      <span className="text-gray-900">{formatCurrency(sale.frieghtCharge)}</span>
                    </div>
                  )}
                  
                  <div className="pt-2 border-t border-gray-200">
                    <div className="flex justify-between items-center text-lg font-bold">
                      <span>Total:</span>
                      <span className="text-blue-600">{formatCurrency(sale.totalAmount)}</span>
                    </div>
                  </div>
                  
                  {sale.amountPaid > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500">Paid:</span>
                        <span className="text-green-600">{formatCurrency(sale.amountPaid)}</span>
                      </div>
                      <div className="flex justify-between items-center font-medium">
                        <span>Balance:</span>
                        <span className="text-red-600">{formatCurrency(sale.balanceDue)}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Invoice Items */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Invoice Items</h2>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        SPH
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        CYL
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        AXIS
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ADD
                      </th>
                      <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        QTY
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Price
                      </th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {sale.items && sale.items.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{item.itemName}</div>
                            {item.orderId && <div className="text-xs text-gray-500">Order ID: {item.orderId}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                          {item.sph || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                          {item.cyl || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                          {item.axis || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-500">
                          {item.add || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-center text-gray-900">
                          {item.qty}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                          {formatCurrency(item.price)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan="7" className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        Subtotal:
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-medium text-gray-900">
                        {formatCurrency(sale.subtotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            
            {/* Notes */}
            {sale.notes && (
              <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-2">Notes</h2>
                <p className="text-gray-700 whitespace-pre-line">{sale.notes}</p>
              </div>
            )}
            
            {/* Actions Footer */}
            <div className="mt-8 flex justify-end space-x-4">
              <button
                onClick={() => navigate(`/sales/edit/${saleId}`)}
                className="px-6 py-3 border border-blue-500 rounded-lg text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit Invoice
              </button>
              
              <button
                onClick={handlePrintInvoice}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center"
                disabled={loading}
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                {loading ? 'Processing...' : 'Print Invoice'}
              </button>
            </div>
          </>
        ) : (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Invoice not found</h3>
            <p className="text-gray-600 mb-4">The requested invoice could not be found or may have been deleted</p>
            <button
              onClick={() => navigate('/sales')}
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Return to Sales
            </button>
          </div>
        )}
      </div>
      
      {/* Print Invoice Modal */}
      <PrintInvoiceModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        saleId={saleId}
        title={sale ? `Invoice #${sale.invoiceNumber}` : 'Print Invoice'}
      />
    </div>
  );
};

export default SaleDetail; 
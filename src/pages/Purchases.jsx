import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PrintInvoiceModal from '../components/PrintInvoiceModal';

const Purchases = () => {
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);

  // State for print invoice modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState(null);

  useEffect(() => {
    fetchPurchases();
    fetchVendors();
  }, []);

  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const purchasesRef = collection(db, 'purchases');
      const q = query(purchasesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const purchasesList = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        displayId: `P-${(snapshot.docs.length - index).toString().padStart(3, '0')}`,
        ...doc.data()
      }));
      setPurchases(purchasesList);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      setError('Failed to fetch purchases');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where('type', '==', 'vendor'));
      const snapshot = await getDocs(q);
      const vendorsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVendors(vendorsList);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const handleDeletePurchase = async (e, purchaseId) => {
    e.stopPropagation(); // Prevent row click when deleting
    if (!window.confirm('Are you sure you want to delete this purchase?')) return;
    
    try {
      await deleteDoc(doc(db, 'purchases', purchaseId));
      setPurchases(prevPurchases => prevPurchases.filter(purchase => purchase.id !== purchaseId));
    } catch (error) {
      console.error('Error deleting purchase:', error);
      setError('Failed to delete purchase');
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return { date: '-', time: '-' };
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return {
      date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    };
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const getVendorDetails = (vendorId) => {
    return vendors.find(v => v.id === vendorId);
  };

  const handlePrintPurchase = (e, purchaseId) => {
    e.stopPropagation();
    setSelectedPurchaseId(purchaseId);
    setShowPrintModal(true);
  };

  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Purchases</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your purchases and invoices</p>
          </div>
          <button
            onClick={() => navigate('/purchases/new')}
            className="btn-primary inline-flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span className="desktop-only">Create Purchase</span>
          </button>
        </div>

        {/* Mobile Search */}
        <div className="mb-4 mobile-only">
          <input
            type="text"
            placeholder="Search purchases..."
            className="mobile-search"
          />
        </div>

        {/* Purchases List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500">{error}</div>
        ) : purchases.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500">No purchase records found</p>
            <button
              onClick={() => navigate('/purchases/new')}
              className="mt-4 inline-flex items-center px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create First Purchase
            </button>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="desktop-only">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                          Purchase #
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-[140px]">
                          Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider pl-6">
                          Vendor
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                          Amount
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider text-center">
                          Payment Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px] text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {purchases.map((purchase) => {
                        const { date, time } = formatDate(purchase.createdAt);
                        const vendorDetails = getVendorDetails(purchase.vendorId);
                        return (
                          <tr 
                            key={purchase.id} 
                            onClick={() => navigate(`/purchases/${purchase.id}`)}
                            className="hover:bg-gray-50 cursor-pointer transition-colors duration-150"
                          >
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-sky-600">{purchase.displayId}</span>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm text-gray-900">{date}</div>
                              <div className="text-sm text-gray-500">{time}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col">
                                <span className="text-sm font-medium text-gray-900">
                                  {vendorDetails?.opticalName || 'Unknown Vendor'}
                                </span>
                                {vendorDetails?.city && (
                                  <span className="text-xs text-gray-500">
                                    {vendorDetails.city}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-sm font-medium text-gray-900">
                                {formatCurrency(purchase.totalAmount)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${purchase.paymentStatus === 'PAID' 
                                  ? 'bg-green-100 text-green-800' 
                                  : purchase.paymentStatus === 'PARTIAL' 
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-red-100 text-red-800'}`}
                              >
                                {purchase.paymentStatus || 'UNPAID'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/purchases/edit/${purchase.id}`);
                                  }}
                                  className="text-sky-600 hover:text-sky-900"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handlePrintPurchase(e, purchase.id)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDeletePurchase(e, purchase.id)}
                                  className="text-red-600 hover:text-red-900"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile List View */}
            <div className="mobile-only space-y-4">
              {purchases.map((purchase) => {
                const { date } = formatDate(purchase.createdAt);
                const vendorDetails = getVendorDetails(purchase.vendorId);
                return (
                  <div 
                    key={purchase.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden"
                    onClick={() => navigate(`/purchases/${purchase.id}`)}
                  >
                    <div className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-sm font-medium text-sky-600">{purchase.displayId}</span>
                        <span className={`px-2 py-1 text-xs leading-none rounded-full 
                          ${purchase.paymentStatus === 'PAID' 
                            ? 'bg-green-100 text-green-800' 
                            : purchase.paymentStatus === 'PARTIAL' 
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'}`}
                        >
                          {purchase.paymentStatus || 'UNPAID'}
                        </span>
                      </div>
                      <div className="mb-2">
                        <div className="text-sm font-medium text-gray-900">
                          {vendorDetails?.opticalName || 'Unknown Vendor'}
                        </div>
                        {vendorDetails?.city && (
                          <div className="text-xs text-gray-500">
                            {vendorDetails.city}
                          </div>
                        )}
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <div className="text-gray-500">{date}</div>
                        <div className="font-medium text-gray-900">{formatCurrency(purchase.totalAmount)}</div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100 flex justify-between">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/purchases/edit/${purchase.id}`);
                          }}
                          className="text-sky-600 text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => handlePrintPurchase(e, purchase.id)}
                          className="text-indigo-600 text-sm"
                        >
                          Print
                        </button>
                        <button
                          onClick={(e) => handleDeletePurchase(e, purchase.id)}
                          className="text-red-600 text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
      
      {/* Print Modal */}
      {showPrintModal && (
        <PrintInvoiceModal
          invoiceId={selectedPurchaseId}
          onClose={() => setShowPrintModal(false)}
          isPurchase={true}
        />
      )}
    </div>
  );
};

export default Purchases; 
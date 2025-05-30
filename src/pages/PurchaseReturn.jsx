import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, where, Timestamp, addDoc } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';

const PurchaseReturn = ({ isCreate = false, newReturn = false, isView = false }) => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [vendors, setVendors] = useState([]);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(isCreate && newReturn);
  const [purchases, setPurchases] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredPurchases, setFilteredPurchases] = useState([]);
  const [returnData, setReturnData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Add state for filters for the returns list view
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [filteredReturns, setFilteredReturns] = useState([]);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');
  const [showVendorSearch, setShowVendorSearch] = useState(false);
  const [filteredVendors, setFilteredVendors] = useState([]);
  
  // Form state for return creation
  const [returnItems, setReturnItems] = useState([]);
  const [returnNote, setReturnNote] = useState('');
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnAmount, setReturnAmount] = useState(0);

  useEffect(() => {
    // If we're viewing a return, fetch the return details
    if (isView && id) {
      fetchReturnDetails(id);
    }
    // If we're creating a return, we'll need to fetch the original purchase
    else if (isCreate) {
      fetchVendors();
      
      if (id && id !== 'new') {
        fetchPurchase(id);
      } else if (newReturn) {
        fetchPurchases();
        setLoading(false);
      }
    } else {
      fetchReturns();
      fetchVendors();
    }
  }, [isCreate, isView, id, newReturn]);
  
  const fetchPurchases = async () => {
    try {
      setLoading(true);
      const purchasesRef = getUserCollection('purchases');
      const q = query(purchasesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const purchasesList = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        displayId: `P-${(snapshot.docs.length - index).toString().padStart(3, '0')}`,
        ...doc.data()
      }));
      
      setPurchases(purchasesList);
      setFilteredPurchases(purchasesList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      setError('Failed to fetch purchases');
      setLoading(false);
    }
  };
  
  // Effect to filter purchases based on search query
  useEffect(() => {
    if (purchases.length === 0) return;
    
    if (searchQuery.trim() === '') {
      setFilteredPurchases(purchases);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = purchases.filter(purchase => 
      (purchase.displayId && purchase.displayId.toLowerCase().includes(query)) ||
      (purchase.purchaseNumber && purchase.purchaseNumber.toLowerCase().includes(query)) ||
      (getVendorName(purchase.vendorId) && getVendorName(purchase.vendorId).toLowerCase().includes(query))
    );
    
    setFilteredPurchases(filtered);
  }, [searchQuery, purchases]);
  
  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.opticalName : 'Unknown Vendor';
  };
  
  const fetchPurchase = async (purchaseId) => {
    try {
      setLoading(true);
      const purchaseDoc = await getDoc(getUserDoc('purchases', purchaseId));
      if (purchaseDoc.exists()) {
        const purchaseData = { id: purchaseId, ...purchaseDoc.data() };
        setSelectedPurchase(purchaseData);
        
        // Initialize return items from purchase items
        if (purchaseData.items && purchaseData.items.length > 0) {
          setReturnItems(purchaseData.items.map(item => ({
            ...item,
            qtyToReturn: 0,
            maxQty: item.qty,
            returnAmount: 0
          })));
        }
      } else {
        setError('Purchase not found');
        navigate('/purchase-returns');
      }
    } catch (error) {
      console.error('Error fetching purchase:', error);
      setError('Failed to fetch purchase details');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePurchaseSelection = (purchase) => {
    setSelectedPurchase(purchase);
    setShowInvoiceSelector(false);
    
    // Initialize return items from selected purchase
    if (purchase.items && purchase.items.length > 0) {
      setReturnItems(purchase.items.map(item => ({
        ...item,
        qtyToReturn: 0,
        maxQty: item.qty,
        returnAmount: 0
      })));
    }
  };
  
  const handleReturnItemChange = (index, field, value) => {
    const updatedItems = [...returnItems];
    const item = updatedItems[index];
    
    if (field === 'qtyToReturn') {
      const qty = parseInt(value) || 0;
      // Ensure quantity doesn't exceed max
      if (qty > item.maxQty) {
        value = item.maxQty;
      }
      
      // Update return amount based on quantity
      const returnAmount = (parseFloat(item.price) || 0) * value;
      item.returnAmount = returnAmount;
    }
    
    item[field] = value;
    setReturnItems(updatedItems);
    
    // Recalculate total return amount
    calculateTotalReturn(updatedItems);
  };
  
  const calculateTotalReturn = (items) => {
    const total = items.reduce((sum, item) => sum + (item.returnAmount || 0), 0);
    setReturnAmount(total);
  };
  
  const handleCreateReturn = async () => {
    try {
      setLoading(true);
      
      const itemsToReturn = returnItems.filter(item => item.qtyToReturn > 0);
      
      if (itemsToReturn.length === 0) {
        setError('Please select at least one item to return');
        setLoading(false);
        return;
      }
      
      const returnData = {
        originalInvoiceId: selectedPurchase ? selectedPurchase.id : null,
        originalInvoiceNumber: selectedPurchase ? selectedPurchase.purchaseNumber || selectedPurchase.displayId : null,
        vendorId: selectedPurchase ? selectedPurchase.vendorId : null,
        items: itemsToReturn,
        totalAmount: returnAmount,
        returnDate: Timestamp.fromDate(new Date(returnDate)),
        notes: returnNote,
        createdAt: Timestamp.now()
      };
      
      // Add the return document to Firestore
      await addDoc(getUserCollection('purchaseReturns'), returnData);
      
      // Navigate back to the returns list
      navigate('/purchase-returns');
      
    } catch (error) {
      console.error('Error creating return:', error);
      setError(`Failed to create return: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    if (returns.length > 0) {
      applyFilters();
    } else {
      setFilteredReturns([]);
    }
  }, [returns, dateFrom, dateTo, selectedVendorId]);
  
  useEffect(() => {
    if (vendorSearchTerm.trim()) {
      const lowercasedFilter = vendorSearchTerm.toLowerCase();
      const filtered = vendors.filter(vendor => 
        vendor.opticalName.toLowerCase().includes(lowercasedFilter) ||
        (vendor.city && vendor.city.toLowerCase().includes(lowercasedFilter))
      );
      setFilteredVendors(filtered);
      setShowVendorSearch(true);
    } else {
      setFilteredVendors([]);
      setShowVendorSearch(false);
    }
  }, [vendorSearchTerm, vendors]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const returnsRef = getUserCollection('purchaseReturns');
      const q = query(returnsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const returnsList = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        displayId: `PR-${(snapshot.docs.length - index).toString().padStart(3, '0')}`,
        ...doc.data()
      }));
      setReturns(returnsList);
    } catch (error) {
      console.error('Error fetching purchase returns:', error);
      setError('Failed to fetch purchase returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const vendorsRef = getUserCollection('customers');
      const snapshot = await getDocs(vendorsRef);
      const vendorsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVendors(vendorsList);
    } catch (error) {
      console.error('Error fetching vendors:', error);
    }
  };

  const handleDeleteReturn = async (e, returnId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this return?')) return;
    
    try {
      await deleteDoc(getUserDoc('purchaseReturns', returnId));
      setReturns(prevReturns => prevReturns.filter(returnItem => returnItem.id !== returnId));
    } catch (error) {
      console.error('Error deleting return:', error);
      setError('Failed to delete return');
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

  // Add filter function
  const applyFilters = () => {
    let filtered = [...returns];
    
    // Apply date from filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(returnItem => {
        const returnDate = returnItem.createdAt?.toDate ? returnItem.createdAt.toDate() : new Date(returnItem.createdAt);
        return returnDate >= fromDate;
      });
    }
    
    // Apply date to filter
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(returnItem => {
        const returnDate = returnItem.createdAt?.toDate ? returnItem.createdAt.toDate() : new Date(returnItem.createdAt);
        return returnDate <= toDate;
      });
    }
    
    // Apply vendor filter
    if (selectedVendorId) {
      filtered = filtered.filter(returnItem => returnItem.vendorId === selectedVendorId);
    }
    
    setFilteredReturns(filtered);
  };

  // Function to handle vendor selection
  const handleVendorSelect = (vendor) => {
    setSelectedVendorId(vendor.id);
    setVendorSearchTerm(vendor.opticalName);
    setShowVendorSearch(false);
  };

  // Function to reset filters
  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedVendorId('');
    setVendorSearchTerm('');
  };

  // Invoice selector component
  const InvoiceSelector = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Invoice to Return</h2>
      
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by invoice number or vendor..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-500 dark:focus:border-indigo-500"
        />
      </div>
      
      <div className="overflow-y-auto max-h-96 border border-gray-200 dark:border-gray-700 rounded-md">
        {filteredPurchases.length === 0 ? (
          <div className="p-4 text-gray-500 dark:text-gray-400 text-center">No invoices found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Vendor</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredPurchases.map(purchase => {
                const { date } = formatDate(purchase.createdAt);
                return (
                  <tr key={purchase.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-sky-600 dark:text-sky-400">{purchase.displayId || purchase.purchaseNumber}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{date}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{getVendorName(purchase.vendorId)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">{formatCurrency(purchase.totalAmount)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-center">
                      <button
                        onClick={() => handlePurchaseSelection(purchase)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-800 px-3 py-1 rounded-md text-sm"
                      >
                        Select
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
  
  // Return form component
  const ReturnForm = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
        <div className="flex flex-wrap items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Return Details</h2>
          {selectedPurchase && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Original Invoice:</span>
              <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{selectedPurchase.displayId || selectedPurchase.purchaseNumber}</span>
              <button 
                onClick={() => {
                  setSelectedPurchase(null);
                  setShowInvoiceSelector(true);
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 underline"
              >
                Change
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Vendor</label>
            <div className="mt-1 text-sm text-gray-900 dark:text-white">
              {selectedPurchase ? getVendorName(selectedPurchase.vendorId) : 'N/A'}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Original Amount</label>
            <div className="mt-1 text-sm text-gray-900 dark:text-white">
              {selectedPurchase ? formatCurrency(selectedPurchase.totalAmount) : 'N/A'}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Return Date</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>
        </div>
      </div>
      
      <div className="mb-4">
        <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2">Items to Return</h3>
        
        {returnItems.length === 0 ? (
          <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-md text-gray-500 dark:text-gray-400">
            No items available to return
          </div>
        ) : (
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-md">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Original Qty</th>
                  <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Return Qty</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Return Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {returnItems.map((item, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'}>
                    <td className="px-4 py-2 text-sm text-gray-900 dark:text-white">{item.itemName}</td>
                    <td className="px-4 py-2 text-center text-sm text-gray-500 dark:text-gray-400">{item.qty}</td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min="0"
                        max={item.maxQty}
                        value={item.qtyToReturn}
                        onChange={(e) => handleReturnItemChange(index, 'qtyToReturn', e.target.value)}
                        className="block w-20 mx-auto rounded-md border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-900 dark:text-white">{formatCurrency(item.price)}</td>
                    <td className="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(item.returnAmount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <td colSpan="4" className="px-4 py-2 text-right text-sm font-medium text-gray-900 dark:text-white">Total Return Amount:</td>
                  <td className="px-4 py-2 text-right text-sm font-medium text-indigo-600 dark:text-indigo-400">{formatCurrency(returnAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
      
      <div className="mb-4">
        <label htmlFor="returnNote" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Return Note</label>
        <textarea
          id="returnNote"
          rows="3"
          value={returnNote}
          onChange={(e) => setReturnNote(e.target.value)}
          placeholder="Reason for return or additional notes"
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
        ></textarea>
      </div>
      
      <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/purchase-returns')}
          className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleCreateReturn}
          disabled={loading || returnItems.length === 0 || returnAmount <= 0}
          className={`py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white 
            ${loading || returnItems.length === 0 || returnAmount <= 0 
              ? 'bg-indigo-300 cursor-not-allowed dark:bg-indigo-700 dark:cursor-not-allowed' 
              : 'bg-indigo-600 dark:bg-indigo-800 hover:bg-indigo-700 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800'}`}
        >
          {loading ? 'Processing...' : 'Create Return'}
        </button>
      </div>
    </div>
  );

  const fetchReturnDetails = async (returnId) => {
    try {
      setLoading(true);
      const returnDoc = await getDoc(getUserDoc('purchaseReturns', returnId));
      
      if (returnDoc.exists()) {
        const returnData = {
          id: returnId,
          ...returnDoc.data()
        };
        
        // Get vendor details
        if (returnData.vendorId) {
          const vendorDoc = await getDoc(getUserDoc('customers', returnData.vendorId));
          if (vendorDoc.exists()) {
            returnData.vendor = vendorDoc.data();
          }
        }
        
        // Get original purchase details if available
        if (returnData.originalInvoiceId) {
          const purchaseDoc = await getDoc(getUserDoc('purchases', returnData.originalInvoiceId));
          if (purchaseDoc.exists()) {
            returnData.originalPurchase = purchaseDoc.data();
          }
        }
        
        setReturnData(returnData);
      } else {
        setError('Return not found');
        navigate('/purchase-returns');
      }
    } catch (error) {
      console.error('Error fetching return details:', error);
      setError('Failed to fetch return details');
    } finally {
      setLoading(false);
    }
  };
  
  const handlePrintReturn = () => {
    if (returnData) {
      setIsPrinting(true);
      setTimeout(() => {
        window.print();
        setTimeout(() => {
          setIsPrinting(false);
        }, 500);
      }, 300);
    }
  };

  // Return details view component
  const ReturnDetailsView = () => (
    <div className="mb-6">
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Purchase Return Details
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              View details for this purchase return
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => navigate('/purchase-returns')}
              className="btn-secondary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-sky-600 dark:bg-sky-700 hover:bg-sky-700 dark:hover:bg-sky-800 text-white rounded-lg shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Returns</span>
            </button>
            <button
              onClick={handlePrintReturn}
              className="btn-secondary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 text-white rounded-lg shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              <span>Print</span>
            </button>
          </div>
        </div>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-sky-600 dark:border-sky-400 border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
          {error}
        </div>
      ) : returnData ? (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row justify-between mb-6 pb-6 border-b border-gray-200 dark:border-gray-700">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Return #</p>
              <p className="text-lg font-semibold text-indigo-600 dark:text-sky-400">{returnData.displayId || 'PR-001'}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 mb-1">Return Date</p>
              <p className="font-medium text-gray-900 dark:text-white">{formatDate(returnData.returnDate || returnData.createdAt).date}</p>
            </div>
            
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Vendor</p>
              <p className="font-semibold text-gray-900 dark:text-white">{returnData.vendor?.opticalName || 'Unknown Vendor'}</p>
              {returnData.vendor?.city && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{returnData.vendor.city}</p>
              )}
              {returnData.vendor?.phone && (
                <p className="text-sm text-gray-500 dark:text-gray-400">{returnData.vendor.phone}</p>
              )}
            </div>
            
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Original Invoice</p>
              {returnData.originalInvoiceId ? (
                <p 
                  className="font-semibold text-sky-600 dark:text-sky-400 cursor-pointer" 
                  onClick={() => navigate(`/purchases/${returnData.originalInvoiceId}`)}
                >
                  {returnData.originalInvoiceNumber || '#'}
                </p>
              ) : (
                <p className="font-medium text-gray-500 dark:text-gray-400">N/A</p>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 mb-1">Return Total</p>
              <p className="text-lg font-bold text-indigo-600 dark:text-sky-400">{formatCurrency(returnData.totalAmount)}</p>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Returned Items</h3>
            <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {returnData.items && returnData.items.length > 0 ? (
                    returnData.items.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-gray-50 dark:bg-gray-700' : 'bg-gray-100 dark:bg-gray-800'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">{item.itemName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">{item.qtyToReturn}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">{formatCurrency(item.price)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-right">{formatCurrency(item.returnAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">No items in this return</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <td colSpan="3" className="px-6 py-3 text-right text-sm font-medium text-gray-900 dark:text-white">Total:</td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-indigo-600 dark:text-sky-400">{formatCurrency(returnData.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          {returnData.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Notes</h3>
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-gray-700 dark:text-white">{returnData.notes}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
          <p className="text-gray-500 dark:text-gray-400">No return data found</p>
        </div>
      )}
      
      {/* Print content - Hidden until print is triggered */}
      {isPrinting && (
        <div className="print-only fixed inset-0 bg-white p-8 z-50 hidden print:block">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900">PURCHASE RETURN RECEIPT</h1>
              <p className="text-lg">{returnData?.displayId || 'PR-001'}</p>
              <p className="text-sm text-gray-600">{formatDate(returnData?.returnDate || returnData?.createdAt).date}</p>
            </div>
            
            <div className="flex justify-between mb-6">
              <div>
                <p className="font-bold text-sm">Vendor:</p>
                <p className="text-sm">{returnData?.vendor?.opticalName || 'Unknown Vendor'}</p>
                {returnData?.vendor?.city && <p className="text-sm">{returnData?.vendor.city}</p>}
              </div>
              <div className="text-right">
                <p className="text-sm"><span className="font-bold">Original Invoice: </span>{returnData?.originalInvoiceNumber || 'N/A'}</p>
              </div>
            </div>
            
            <table className="w-full mb-6 text-sm">
              <thead>
                <tr className="border-b-2 border-gray-300">
                  <th className="py-2 text-left">Item</th>
                  <th className="py-2 text-center">Qty</th>
                  <th className="py-2 text-right">Price</th>
                  <th className="py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {returnData?.items?.length > 0 ? (
                  returnData.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      <td className="py-2">{item.itemName}</td>
                      <td className="py-2 text-center">{item.qtyToReturn}</td>
                      <td className="py-2 text-right">{formatCurrency(item.price)}</td>
                      <td className="py-2 text-right">{formatCurrency(item.returnAmount)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="py-2 text-center">No items in this return</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300">
                  <td colSpan="3" className="py-2 text-right font-bold">Total:</td>
                  <td className="py-2 text-right font-bold">{formatCurrency(returnData?.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
            
            {returnData?.notes && (
              <div className="mb-6 text-sm">
                <p className="font-bold">Notes:</p>
                <p>{returnData.notes}</p>
              </div>
            )}
            
            <div className="mt-10 pt-4 border-t border-gray-300 text-center text-xs text-gray-600">
              <p>This is a computer generated receipt.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
        {isView ? (
          <ReturnDetailsView />
        ) : isCreate ? (
          // Show return creation form when isCreate is true
          <div>
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    {newReturn ? 'Create New Purchase Return' : 'Return Items from Purchase'}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {newReturn ? 'Create a return referencing an existing purchase' : 'Select items to return from this purchase'}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/purchase-returns')}
                  className="btn-secondary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-sky-600 dark:bg-sky-700 hover:bg-sky-700 dark:hover:bg-sky-800 text-white rounded-lg shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Returns</span>
                </button>
              </div>
            </div>
            
            {loading && !showInvoiceSelector && !selectedPurchase ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-sky-600 dark:border-sky-400 border-t-transparent rounded-full"></div>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                {error}
              </div>
            ) : (
              <>
                {showInvoiceSelector ? (
                  <InvoiceSelector />
                ) : selectedPurchase ? (
                  <ReturnForm />
                ) : (
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-4">No invoice selected. Please select an invoice to process the return.</p>
                    <button
                      onClick={() => setShowInvoiceSelector(true)}
                      className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
                    >
                      Select Invoice
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          // Show returns list when isCreate is false (default view)
          <>
            {/* Replace header with filter bar */}
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3 flex-grow">
                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-white dark:bg-gray-700 shadow-sm">
                    <div className="px-3 py-2 bg-gray-50 dark:bg-gray-600 border-r border-gray-300 dark:border-gray-600">
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="border-none focus:ring-0 text-sm w-32 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="From"
                    />
                    <span className="mx-1 text-gray-400 dark:text-gray-500">to</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="border-none focus:ring-0 text-sm w-32 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="To"
                    />
                  </div>
                  
                  <div className="relative flex-grow max-w-xs">
                    <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-white dark:bg-gray-700 shadow-sm">
                      <div className="px-3 py-2 bg-gray-50 dark:bg-gray-600 border-r border-gray-300 dark:border-gray-600">
                        <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={vendorSearchTerm}
                        onChange={(e) => setVendorSearchTerm(e.target.value)}
                        className="border-none focus:ring-0 text-sm w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="Search Vendor Name"
                        onFocus={() => vendorSearchTerm.trim() && setShowVendorSearch(true)}
                      />
                      {vendorSearchTerm && (
                        <button 
                          onClick={() => {
                            setVendorSearchTerm('');
                            setSelectedVendorId('');
                          }}
                          className="px-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    {/* Vendor search suggestions */}
                    {showVendorSearch && filteredVendors.length > 0 && (
                      <div className="absolute mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-10 max-h-60 overflow-auto">
                        {filteredVendors.map(vendor => (
                          <div
                            key={vendor.id}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => handleVendorSelect(vendor)}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{vendor.opticalName}</div>
                            {vendor.city && <div className="text-xs text-gray-500 dark:text-gray-400">{vendor.city}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {(dateFrom || dateTo || selectedVendorId) && (
                    <button 
                      onClick={resetFilters}
                      className="px-3 py-2 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-md transition-colors"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear Filters
                    </button>
                  )}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => navigate('/purchases')}
                    className="btn-secondary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-sky-600 dark:bg-sky-700 hover:bg-sky-700 dark:hover:bg-sky-800 text-white rounded-lg shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Back to Purchases</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Purchase Returns</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage purchase returns and vendor credits</p>
                </div>
                <button
                  onClick={() => navigate('/purchases/return/new')}
                  className="btn-primary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-indigo-600 dark:bg-indigo-700 hover:bg-indigo-700 dark:hover:bg-indigo-800 text-white rounded-lg shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Create Return</span>
                </button>
              </div>
            </div>

            {/* Returns List */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-8 h-8 border-4 border-sky-600 dark:border-sky-400 border-t-transparent rounded-full"></div>
              </div>
            ) : error ? (
              <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>
            ) : filteredReturns.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">No Returns Found</h3>
                <p className="text-gray-500 dark:text-gray-400">There are no purchase returns matching your filters.</p>
              </div>
            ) : (
              <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[100px]">
                        Return #
                      </th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[140px]">
                        Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider pl-6">
                        Vendor
                      </th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-right">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider text-center">
                        Original Invoice
                      </th>
                      <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[100px] text-center">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredReturns.map((returnItem) => {
                      const { date, time } = formatDate(returnItem.createdAt);
                      const vendorDetails = getVendorDetails(returnItem.vendorId);
                      return (
                        <tr 
                          key={returnItem.id} 
                          onClick={() => navigate(`/purchase-returns/${returnItem.id}`)}
                          className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150"
                        >
                          <td className="px-6 py-4">
                            <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{returnItem.displayId}</span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900 dark:text-white">{date}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">{time}</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {vendorDetails?.opticalName || 'Unknown Vendor'}
                              </span>
                              {vendorDetails?.city && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {vendorDetails.city}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {formatCurrency(returnItem.totalAmount)}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            {returnItem.originalInvoiceId ? (
                              <span className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 cursor-pointer"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/purchases/${returnItem.originalInvoiceId}`);
                                }}
                              >
                                {returnItem.originalInvoiceNumber || 'View'}
                              </span>
                            ) : (
                              <span className="text-sm text-gray-400 dark:text-gray-500">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={(e) => handleDeleteReturn(e, returnItem.id)}
                                className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                                title="Delete Return"
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
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PurchaseReturn; 
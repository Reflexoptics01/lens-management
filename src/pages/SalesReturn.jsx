import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, where, Timestamp, addDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';

const SalesReturn = ({ isCreate = false, newReturn = false, isView = false }) => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [customers, setCustomers] = useState([]);
  const [selectedSale, setSelectedSale] = useState(null);
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(isCreate && newReturn);
  const [sales, setSales] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSales, setFilteredSales] = useState([]);
  const [returnData, setReturnData] = useState(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const navigate = useNavigate();
  const { id } = useParams();
  
  // Add state for filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [filteredReturns, setFilteredReturns] = useState([]);
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [showPartySearch, setShowPartySearch] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  
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
    // If we're creating a return, we'll need to fetch the original sale
    else if (isCreate) {
      fetchCustomers();
      
      if (id && id !== 'new') {
        fetchSale(id);
      } else if (newReturn) {
        fetchSales();
        setLoading(false);
      }
    } else {
      fetchReturns();
      fetchCustomers();
    }
  }, [isCreate, isView, id, newReturn]);
  
  const fetchSales = async () => {
    try {
      setLoading(true);
      const salesRef = collection(db, 'sales');
      const q = query(salesRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const salesList = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        displayId: `S-${(snapshot.docs.length - index).toString().padStart(3, '0')}`,
        ...doc.data()
      }));
      
      setSales(salesList);
      setFilteredSales(salesList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching sales:', error);
      setError('Failed to fetch sales');
      setLoading(false);
    }
  };
  
  // Effect to filter sales based on search query
  useEffect(() => {
    if (sales.length === 0) return;
    
    if (searchQuery.trim() === '') {
      setFilteredSales(sales);
      return;
    }
    
    const query = searchQuery.toLowerCase();
    const filtered = sales.filter(sale => 
      (sale.displayId && sale.displayId.toLowerCase().includes(query)) ||
      (sale.invoiceNumber && sale.invoiceNumber.toLowerCase().includes(query)) ||
      (getCustomerName(sale.customerId) && getCustomerName(sale.customerId).toLowerCase().includes(query))
    );
    
    setFilteredSales(filtered);
  }, [searchQuery, sales]);
  
  const getCustomerName = (customerId) => {
    const customer = customers.find(c => c.id === customerId);
    return customer ? customer.opticalName : 'Unknown Customer';
  };
  
  const fetchSale = async (saleId) => {
    try {
      setLoading(true);
      const saleDoc = await getDoc(doc(db, 'sales', saleId));
      if (saleDoc.exists()) {
        const saleData = { id: saleId, ...saleDoc.data() };
        setSelectedSale(saleData);
        
        // Initialize return items from sale items
        if (saleData.items && saleData.items.length > 0) {
          setReturnItems(saleData.items.map(item => ({
            ...item,
            qtyToReturn: 0,
            maxQty: item.qty,
            returnAmount: 0
          })));
        }
      } else {
        setError('Sale not found');
        navigate('/sales-returns');
      }
    } catch (error) {
      console.error('Error fetching sale:', error);
      setError('Failed to fetch sale details');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaleSelection = (sale) => {
    setSelectedSale(sale);
    setShowInvoiceSelector(false);
    
    // Initialize return items from selected sale
    if (sale.items && sale.items.length > 0) {
      setReturnItems(sale.items.map(item => ({
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
        originalInvoiceId: selectedSale ? selectedSale.id : null,
        originalInvoiceNumber: selectedSale ? selectedSale.invoiceNumber || selectedSale.displayId : null,
        customerId: selectedSale ? selectedSale.customerId : null,
        items: itemsToReturn,
        totalAmount: returnAmount,
        returnDate: Timestamp.fromDate(new Date(returnDate)),
        notes: returnNote,
        createdAt: Timestamp.now()
      };
      
      // Add the return document to Firestore
      await addDoc(collection(db, 'sales_returns'), returnData);
      
      // Navigate back to the returns list
      navigate('/sales-returns');
      
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
  }, [returns, dateFrom, dateTo, selectedCustomerId]);
  
  useEffect(() => {
    if (partySearchTerm.trim()) {
      const lowercasedFilter = partySearchTerm.toLowerCase();
      const filtered = customers.filter(customer => 
        customer.opticalName.toLowerCase().includes(lowercasedFilter) ||
        (customer.city && customer.city.toLowerCase().includes(lowercasedFilter))
      );
      setFilteredCustomers(filtered);
      setShowPartySearch(true);
    } else {
      setFilteredCustomers([]);
      setShowPartySearch(false);
    }
  }, [partySearchTerm, customers]);

  const fetchReturns = async () => {
    try {
      setLoading(true);
      const returnsRef = collection(db, 'sales_returns');
      const q = query(returnsRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const returnsList = snapshot.docs.map((doc, index) => ({
        id: doc.id,
        displayId: `SR-${(snapshot.docs.length - index).toString().padStart(3, '0')}`,
        ...doc.data()
      }));
      setReturns(returnsList);
    } catch (error) {
      console.error('Error fetching sales returns:', error);
      setError('Failed to fetch sales returns');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customersRef = collection(db, 'customers');
      const snapshot = await getDocs(customersRef);
      const customersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleDeleteReturn = async (e, returnId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this return?')) return;
    
    try {
      await deleteDoc(doc(db, 'sales_returns', returnId));
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

  const getCustomerDetails = (customerId) => {
    return customers.find(c => c.id === customerId);
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
    
    // Apply customer filter
    if (selectedCustomerId) {
      filtered = filtered.filter(returnItem => returnItem.customerId === selectedCustomerId);
    }
    
    setFilteredReturns(filtered);
  };

  // Function to handle party selection
  const handlePartySelect = (customer) => {
    setSelectedCustomerId(customer.id);
    setPartySearchTerm(customer.opticalName);
    setShowPartySearch(false);
  };

  // Function to reset filters
  const resetFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedCustomerId('');
    setPartySearchTerm('');
  };

  // Invoice selector component
  const InvoiceSelector = () => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Select Invoice to Return</h2>
      
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by invoice number or customer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-500 dark:focus:border-indigo-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        />
      </div>
      
      <div className="overflow-y-auto max-h-96 border border-gray-200 dark:border-gray-700 rounded-md">
        {filteredSales.length === 0 ? (
          <div className="p-4 text-gray-500 dark:text-gray-400 text-center">No invoices found</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Invoice #</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredSales.map(sale => {
                const { date } = formatDate(sale.createdAt);
                return (
                  <tr key={sale.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-sky-600 dark:text-sky-400">{sale.displayId || sale.invoiceNumber}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{date}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white">{getCustomerName(sale.customerId)}</td>
                    <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-white text-right">{formatCurrency(sale.totalAmount)}</td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() => handleSaleSelection(sale)}
                        className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-800 px-3 py-1 rounded-md text-sm"
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
          {selectedSale && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Original Invoice:</span>
              <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{selectedSale.displayId || selectedSale.invoiceNumber}</span>
              <button 
                onClick={() => {
                  setSelectedSale(null);
                  setShowInvoiceSelector(true);
                }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 underline"
              >
                Change
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Customer</label>
            <div className="mt-1 text-sm text-gray-900 dark:text-white">
              {selectedSale ? getCustomerName(selectedSale.customerId) : 'N/A'}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Original Amount</label>
            <div className="mt-1 text-sm text-gray-900 dark:text-white">
              {selectedSale ? formatCurrency(selectedSale.totalAmount) : 'N/A'}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Return Date</label>
            <input
              type="date"
              value={returnDate}
              onChange={(e) => setReturnDate(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
                        className="block w-20 mx-auto rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
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
          className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
        ></textarea>
      </div>
      
      <div className="flex justify-end space-x-3 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => navigate('/sales-returns')}
          className="py-2 px-4 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800"
        >
          Cancel
        </button>
        <button
          onClick={handleCreateReturn}
          disabled={loading || returnItems.length === 0 || returnAmount <= 0}
          className={`py-2 px-4 rounded-md shadow-sm text-sm font-medium text-white 
            ${loading || returnItems.length === 0 || returnAmount <= 0 
              ? 'bg-indigo-300 dark:bg-indigo-700 cursor-not-allowed' 
              : 'bg-indigo-600 dark:bg-indigo-600 hover:bg-indigo-700 dark:hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 dark:focus:ring-offset-gray-800'}`}
        >
          {loading ? 'Processing...' : 'Create Return'}
        </button>
      </div>
    </div>
  );

  const fetchReturnDetails = async (returnId) => {
    try {
      setLoading(true);
      const returnDoc = await getDoc(doc(db, 'sales_returns', returnId));
      
      if (returnDoc.exists()) {
        const returnData = {
          id: returnId,
          ...returnDoc.data()
        };
        
        // Get customer details
        if (returnData.customerId) {
          const customerDoc = await getDoc(doc(db, 'customers', returnData.customerId));
          if (customerDoc.exists()) {
            returnData.customer = customerDoc.data();
          }
        }
        
        // Get original sale details if available
        if (returnData.originalInvoiceId) {
          const saleDoc = await getDoc(doc(db, 'sales', returnData.originalInvoiceId));
          if (saleDoc.exists()) {
            returnData.originalSale = saleDoc.data();
          }
        }
        
        setReturnData(returnData);
        setLoading(false);
      } else {
        setError('Return not found');
        navigate('/sales-returns');
      }
    } catch (error) {
      console.error('Error fetching return details:', error);
      setError('Failed to fetch return details');
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
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mb-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 mb-2">
              Sales Return Details
            </h1>
            <p className="text-sm text-gray-500">
              View details for this sales return
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => navigate('/sales-returns')}
              className="btn-secondary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Returns</span>
            </button>
            <button
              onClick={handlePrintReturn}
              className="btn-secondary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm"
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
          <div className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full"></div>
        </div>
      ) : error ? (
        <div className="p-4 text-center text-red-500 bg-red-50 rounded-lg border border-red-200">
          {error}
        </div>
      ) : returnData ? (
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col md:flex-row justify-between mb-6 pb-6 border-b border-gray-200">
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-gray-500 mb-1">Return #</p>
              <p className="text-lg font-semibold text-indigo-600">{returnData.displayId || 'SR-001'}</p>
              <p className="text-sm text-gray-500 mt-3 mb-1">Return Date</p>
              <p className="font-medium">{formatDate(returnData.returnDate || returnData.createdAt).date}</p>
            </div>
            
            <div className="mb-4 md:mb-0">
              <p className="text-sm text-gray-500 mb-1">Customer</p>
              <p className="font-semibold">{returnData.customer?.opticalName || 'Unknown Customer'}</p>
              {returnData.customer?.city && (
                <p className="text-sm text-gray-600">{returnData.customer.city}</p>
              )}
              {returnData.customer?.phone && (
                <p className="text-sm text-gray-600">{returnData.customer.phone}</p>
              )}
            </div>
            
            <div>
              <p className="text-sm text-gray-500 mb-1">Original Invoice</p>
              {returnData.originalInvoiceId ? (
                <p 
                  className="font-semibold text-sky-600 cursor-pointer" 
                  onClick={() => navigate(`/sales/${returnData.originalInvoiceId}`)}
                >
                  {returnData.originalInvoiceNumber || '#'}
                </p>
              ) : (
                <p className="font-medium">N/A</p>
              )}
              <p className="text-sm text-gray-500 mt-3 mb-1">Return Total</p>
              <p className="text-lg font-bold text-indigo-600">{formatCurrency(returnData.totalAmount)}</p>
            </div>
          </div>
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3">Returned Items</h3>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Price</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {returnData.items && returnData.items.length > 0 ? (
                    returnData.items.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{item.itemName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{item.qtyToReturn}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatCurrency(item.price)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-right">{formatCurrency(item.returnAmount)}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">No items in this return</td>
                    </tr>
                  )}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="3" className="px-6 py-3 text-right text-sm font-medium text-gray-900">Total:</td>
                    <td className="px-6 py-3 text-right text-sm font-bold text-indigo-600">{formatCurrency(returnData.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
          
          {returnData.notes && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3">Notes</h3>
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="text-gray-700">{returnData.notes}</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 text-center">
          <p className="text-gray-500">No return data found</p>
        </div>
      )}
      
      {/* Print content - Hidden until print is triggered */}
      {isPrinting && (
        <div className="print-only fixed inset-0 bg-white p-8 z-50 hidden print:block">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold text-gray-900">SALES RETURN RECEIPT</h1>
              <p className="text-lg">{returnData?.displayId || 'SR-001'}</p>
              <p className="text-sm text-gray-600">{formatDate(returnData?.returnDate || returnData?.createdAt).date}</p>
            </div>
            
            <div className="flex justify-between mb-6">
              <div>
                <p className="font-bold text-sm">Customer:</p>
                <p className="text-sm">{returnData?.customer?.opticalName || 'Unknown Customer'}</p>
                {returnData?.customer?.city && <p className="text-sm">{returnData?.customer.city}</p>}
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
                    {newReturn ? 'Create New Sales Return' : 'Return Items from Sale'}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {newReturn ? 'Create a return referencing an existing sale' : 'Select items to return from this sale'}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/sales-returns')}
                  className="btn-secondary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-700 text-white rounded-lg shadow-sm"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Returns</span>
                </button>
              </div>
            </div>
            
            {loading && !showInvoiceSelector && !selectedSale ? (
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
                ) : selectedSale ? (
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
          // Show returns list when neither isView nor isCreate is true (default view)
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
                        value={partySearchTerm}
                        onChange={(e) => setPartySearchTerm(e.target.value)}
                        className="border-none focus:ring-0 text-sm w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        placeholder="Search Party Name"
                        onFocus={() => partySearchTerm.trim() && setShowPartySearch(true)}
                      />
                      {partySearchTerm && (
                        <button 
                          onClick={() => {
                            setPartySearchTerm('');
                            setSelectedCustomerId('');
                          }}
                          className="px-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    {/* Party search suggestions */}
                    {showPartySearch && filteredCustomers.length > 0 && (
                      <div className="absolute mt-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-10 max-h-60 overflow-auto">
                        {filteredCustomers.map(customer => (
                          <div
                            key={customer.id}
                            className="px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
                            onClick={() => handlePartySelect(customer)}
                          >
                            <div className="font-medium text-gray-900 dark:text-white">{customer.opticalName}</div>
                            {customer.city && <div className="text-xs text-gray-500 dark:text-gray-400">{customer.city}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {(dateFrom || dateTo || selectedCustomerId) && (
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
                    onClick={() => navigate('/sales')}
                    className="btn-secondary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-sky-600 hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-700 text-white rounded-lg shadow-sm"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Back to Sales</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Sales Returns</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Manage returned sales and credit notes</p>
                </div>
                <button
                  onClick={() => navigate('/sales/return/new')}
                  className="btn-primary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700 text-white rounded-lg shadow-sm"
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
            ) : returns.length === 0 ? (
              <div className="text-center py-8">
                <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p className="text-gray-500 dark:text-gray-400">No sales return records found</p>
                <div className="mt-4 flex justify-center space-x-4">
                  <button
                    onClick={() => navigate('/sales')}
                    className="inline-flex items-center px-4 py-2 bg-sky-600 dark:bg-sky-600 text-white rounded-lg hover:bg-sky-700 dark:hover:bg-sky-700"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    Return to Sales
                  </button>
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table View */}
                <div className="desktop-only">
                  {filteredReturns.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center text-gray-500 dark:text-gray-400">
                      No matching returns found. Try adjusting your filters.
                    </div>
                  ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                    <div className="overflow-x-auto">
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
                              Customer
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
                            const customerDetails = getCustomerDetails(returnItem.customerId);
                            return (
                              <tr 
                                key={returnItem.id} 
                                onClick={() => navigate(`/sales-returns/${returnItem.id}`)}
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
                                      {customerDetails?.opticalName || 'Unknown Customer'}
                                    </span>
                                    {customerDetails?.city && (
                                      <span className="text-xs text-gray-500 dark:text-gray-400">
                                        {customerDetails.city}
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
                                        navigate(`/sales/${returnItem.originalInvoiceId}`);
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
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/sales-returns/edit/${returnItem.id}`);
                                      }}
                                      className="text-sky-600 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-300"
                                      title="Edit Return"
                                    >
                                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                      </svg>
                                    </button>
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
                  </div>
                  )}
                </div>

                {/* Mobile Card View */}
                <div className="mobile-only space-y-4">
                  {filteredReturns.length === 0 ? (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400">
                      No matching returns found. Try adjusting your filters.
                    </div>
                  ) : (
                    filteredReturns.map((returnItem) => {
                    const { date } = formatDate(returnItem.createdAt);
                    const customerDetails = getCustomerDetails(returnItem.customerId);
                    return (
                      <div 
                        key={returnItem.id}
                        onClick={() => navigate(`/sales-returns/${returnItem.id}`)}
                        className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{returnItem.displayId}</span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatCurrency(returnItem.totalAmount)}
                          </span>
                        </div>
                        <div className="mb-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {customerDetails?.opticalName || 'Unknown Customer'}
                          </h3>
                          {customerDetails?.city && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {customerDetails.city}
                            </p>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-500 dark:text-gray-400">{date}</div>
                          {returnItem.originalInvoiceId && (
                            <div className="text-xs text-sky-600 dark:text-sky-400" 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/sales/${returnItem.originalInvoiceId}`);
                              }}
                              >
                              Original: {returnItem.originalInvoiceNumber || 'View'}
                            </div>
                          )}
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/sales-returns/edit/${returnItem.id}`);
                            }}
                            className="text-sky-600 dark:text-sky-400 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            Edit
                          </button>
                          <button
                            onClick={(e) => handleDeleteReturn(e, returnItem.id)}
                            className="text-red-600 dark:text-red-400 flex items-center"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                    })
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SalesReturn; 
import { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, doc, getDoc, deleteDoc, updateDoc, where } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { Link, useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PrintInvoiceModal from '../components/PrintInvoiceModal';
import { formatDate, formatDateTime, safelyParseDate } from '../utils/dateUtils';

const Sales = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);

  // State for print invoice modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [selectedSaleId, setSelectedSaleId] = useState(null);

  // Add state for filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [filteredSales, setFilteredSales] = useState([]);

  // Add state for party filter autocomplete
  const [partySearchTerm, setPartySearchTerm] = useState('');
  const [showPartySearch, setShowPartySearch] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const partySearchRef = useRef(null);

  useEffect(() => {
    fetchSales();
    fetchCustomers();
  }, []);

  useEffect(() => {
    if (sales.length > 0) {
      applyFilters();
    } else {
      setFilteredSales([]);
    }
  }, [sales, dateFrom, dateTo, selectedCustomerId]);

  // Update useEffect to handle outside clicks for party search
  useEffect(() => {
    function handleClickOutside(event) {
      if (partySearchRef.current && !partySearchRef.current.contains(event.target)) {
        setShowPartySearch(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Update useEffect to filter customers when search term changes
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

  const fetchSales = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      
      // Add debugging for user authentication
      const userUid = localStorage.getItem('userUid');
      console.log('fetchSales: Current user UID:', userUid);
      
      if (!userUid) {
        console.error('fetchSales: No user UID found in localStorage');
        setError('User not authenticated');
        return;
      }
      
      const salesRef = getUserCollection('sales');
      console.log('fetchSales: Got sales collection reference');
      
      // Remove orderBy from query since we'll sort after fetching
      const snapshot = await getDocs(salesRef);
      
      console.log('fetchSales: Query executed, got', snapshot.docs.length, 'documents');
      console.log('fetchSales: Current user path should be: users/' + userUid + '/sales');
      
      if (snapshot.docs.length > 0) {
        console.log('fetchSales: First document data sample:', snapshot.docs[0].data());
      }
      
      const salesList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map((doc, index) => {
        try {
          const data = doc.data();
          
          // Process timestamps early to ensure they're handled correctly
          let processedData = { ...data };
          
          // Handle createdAt timestamp explicitly
          if (data.createdAt) {
            try {
              // If it's a Firestore timestamp with toDate method
              if (typeof data.createdAt.toDate === 'function') {
                processedData.createdAt = data.createdAt.toDate();
              } else if (data.createdAt._seconds !== undefined) {
                // Handle serverTimestamp format
                processedData.createdAt = new Date(data.createdAt._seconds * 1000);
              } else if (typeof data.createdAt === 'string') {
                // Handle ISO string
                processedData.createdAt = new Date(data.createdAt);
              }
            } catch (e) {
              console.warn('Error processing createdAt timestamp', e);
              processedData.createdAt = new Date(); // fallback
            }
          }
          
          // Handle invoiceDate timestamp explicitly
          if (data.invoiceDate) {
            try {
              if (typeof data.invoiceDate.toDate === 'function') {
                processedData.invoiceDate = data.invoiceDate.toDate();
              } else if (data.invoiceDate._seconds !== undefined) {
                processedData.invoiceDate = new Date(data.invoiceDate._seconds * 1000);
              } else if (typeof data.invoiceDate === 'string') {
                processedData.invoiceDate = new Date(data.invoiceDate);
              }
            } catch (e) {
              console.warn('Error processing invoiceDate timestamp', e);
              processedData.invoiceDate = new Date(); // fallback
            }
          }
          
          // Handle dueDate timestamp explicitly (if it exists)
          if (data.dueDate) {
            try {
              if (typeof data.dueDate.toDate === 'function') {
                processedData.dueDate = data.dueDate.toDate();
              } else if (data.dueDate._seconds !== undefined) {
                processedData.dueDate = new Date(data.dueDate._seconds * 1000);
              } else if (typeof data.dueDate === 'string') {
                processedData.dueDate = new Date(data.dueDate);
              }
            } catch (e) {
              console.warn('Error processing dueDate timestamp', e);
              processedData.dueDate = null; // fallback
            }
          }

          // Ensure phone property exists
          if (!processedData.phone && processedData.customerId) {
            // We could fetch the customer data here to get the phone number,
            // but that would be a lot of extra queries. Instead, we'll leave it empty
            // and rely on future edits to populate it.
            processedData.phone = '';
          }
          
          // Ensure gstNumber property exists (may be stored as customerGst in older records)
          if (!processedData.gstNumber && processedData.customerGst) {
            processedData.gstNumber = processedData.customerGst;
          }
          
          return {
            id: doc.id,
            ...processedData
          };
        } catch (docError) {
          console.error(`Error processing sale document at index ${index}:`, docError);
          return {
            id: doc.id,
            error: true,
            errorMessage: docError.message,
            ...doc.data()
          };
        }
      });
      
      // Sort by invoice number value (highest first)
      salesList.sort((a, b) => {
        const parseInvoiceNumber = (invoiceNumber) => {
          if (!invoiceNumber) return { year: 0, number: 0 };
          
          // Handle different invoice formats:
          // "2024-25/01" -> year: 2024, number: 1
          // "2023-24/15" -> year: 2023, number: 15  
          // "INV-0001" -> year: 0, number: 1
          // "123" -> year: 0, number: 123
          
          let year = 0;
          let number = 0;
          
          // Try to extract year from financial year format (2024-25, 2023-24, etc.)
          const yearMatch = invoiceNumber.match(/(\d{4})-\d{2}/);
          if (yearMatch) {
            year = parseInt(yearMatch[1]);
          }
          
          // Extract the final numeric part
          const numberMatch = invoiceNumber.match(/(\d+)$/);
          if (numberMatch) {
            number = parseInt(numberMatch[1]);
          }
          
          return { year, number };
        };
        
        const aParsed = parseInvoiceNumber(a.invoiceNumber);
        const bParsed = parseInvoiceNumber(b.invoiceNumber);
        
        // Sort by year first (newest year first)
        if (bParsed.year !== aParsed.year) {
          return bParsed.year - aParsed.year;
        }
        
        // Then sort by number (highest number first)
        if (bParsed.number !== aParsed.number) {
          return bParsed.number - aParsed.number;
        }
        
        // If invoice numbers are identical, fall back to creation date (newest first)
        const aDate = a.createdAt instanceof Date ? a.createdAt : new Date(0);
        const bDate = b.createdAt instanceof Date ? b.createdAt : new Date(0);
        return bDate - aDate;
      });
      
      // Assign displayId based on sorted order (highest invoice number = S-001)
      salesList.forEach((sale, index) => {
        sale.displayId = `S-${(index + 1).toString().padStart(3, '0')}`;
      });
      
      console.log('Processed sales data:', salesList.slice(0, 3));
      setSales(salesList);
    } catch (error) {
      console.error('Error fetching sales:', error);
      setError(`Failed to fetch sales: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customersRef = getUserCollection('customers');
      const snapshot = await getDocs(customersRef);
      const customersList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const handleDeleteSale = async (e, saleId) => {
    e.stopPropagation(); // Prevent row click when deleting
    if (!window.confirm('Are you sure you want to delete this sale?')) return;
    
    try {
      await deleteDoc(getUserDoc('sales', saleId));
      setSales(prevSales => prevSales.filter(sale => sale.id !== saleId));
    } catch (error) {
      console.error('Error deleting sale:', error);
      setError('Failed to delete sale');
    }
  };

  // Replace the existing formatDisplayDate function with dateUtils version
  const formatDisplayDate = (timestamp) => {
    if (!timestamp) return { date: '-', time: '-' };
    
    try {
      console.log('Formatting date, original value:', timestamp);
      
      // Use safelyParseDate from dateUtils for consistent parsing
      const date = safelyParseDate(timestamp);
      console.log('After safelyParseDate:', date);
      
      // Check if date is valid
      if (!date || isNaN(date.getTime())) {
        console.warn('Invalid date after parsing:', date, 'Original:', timestamp);
        return { date: 'Invalid Date', time: '-' };
      }
      
      return {
        date: formatDate(date), // Use formatDate from dateUtils
        time: date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      };
    } catch (error) {
      console.error('Error formatting date:', error, 'Original timestamp:', timestamp);
      return { date: 'Invalid Date', time: '-' };
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

  const getCustomerDetails = (customerId) => {
    return customers.find(c => c.id === customerId);
  };

  const handlePrintSale = (e, saleId) => {
    e.stopPropagation();
    setSelectedSaleId(saleId);
    setShowPrintModal(true);
  };

  // Add filter function
  const applyFilters = () => {
    let filtered = [...sales];
    
    // Apply date from filter
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      console.log('Filtering by from date:', fromDate);
      
      filtered = filtered.filter(sale => {
        try {
          // Use our utility function to safely parse dates
          const saleDate = sale.createdAt instanceof Date 
            ? sale.createdAt 
            : safelyParseDate(sale.createdAt);
          
          // Debug info for date comparison
          if (!saleDate || isNaN(saleDate.getTime())) {
            console.warn('Invalid sale date during filtering:', sale.createdAt, 'for sale:', sale.id);
            return false;
          }
          
          // Debug date comparison
          const result = saleDate >= fromDate;
          if (!result) {
            console.log('Sale date excluded by fromDate filter:', saleDate, '>=', fromDate, '=', result);
          }
          
          return result;
        } catch (error) {
          console.error('Error parsing sale date for filtering:', error, sale);
          return false;
        }
      });
      
      console.log(`After fromDate filter: ${filtered.length} sales remaining`);
    }
    
    // Apply date to filter
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      console.log('Filtering by to date:', toDate);
      
      filtered = filtered.filter(sale => {
        try {
          // Use our utility function to safely parse dates
          const saleDate = sale.createdAt instanceof Date 
            ? sale.createdAt 
            : safelyParseDate(sale.createdAt);
          
          if (!saleDate || isNaN(saleDate.getTime())) {
            console.warn('Invalid sale date during filtering:', sale.createdAt, 'for sale:', sale.id);
            return false;
          }
          
          // Debug date comparison
          const result = saleDate <= toDate;
          if (!result) {
            console.log('Sale date excluded by toDate filter:', saleDate, '<=', toDate, '=', result);
          }
          
          return result;
        } catch (error) {
          console.error('Error parsing sale date for filtering:', error, sale);
          return false;
        }
      });
      
      console.log(`After toDate filter: ${filtered.length} sales remaining`);
    }
    
    // Apply customer filter
    if (selectedCustomerId) {
      filtered = filtered.filter(sale => sale.customerId === selectedCustomerId);
      console.log(`After customer filter: ${filtered.length} sales remaining`);
    }
    
    setFilteredSales(filtered);
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

  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
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
              
              <div className="relative flex-grow max-w-xs" ref={partySearchRef}>
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
                onClick={() => navigate('/sales/new')}
                className="btn-primary inline-flex items-center space-x-2 whitespace-nowrap px-4 py-2 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-700"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>New Invoice</span>
              </button>
              
              {/* Returns Button */}
              <button
                onClick={() => navigate('/sales-returns')}
                className="btn-secondary inline-flex items-center space-x-1.5 whitespace-nowrap px-3 py-1.5 bg-amber-600 hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-700 text-white rounded-lg shadow-sm text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                </svg>
                <span>View Returns</span>
              </button>
            </div>
          </div>
        </div>

        {/* Sales List */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-sky-600 dark:border-sky-400 border-t-transparent rounded-full"></div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>
        ) : sales.length === 0 ? (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No sales records found</p>
            <button
              onClick={() => navigate('/sales/new')}
              className="mt-4 inline-flex items-center px-4 py-2 bg-sky-600 dark:bg-sky-600 text-white rounded-lg hover:bg-sky-700 dark:hover:bg-sky-700"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              Create First Sale
            </button>
          </div>
        ) : (
          <>
            {/* Use filtered results */}
            
            {/* Desktop Table View */}
            <div className="desktop-only">
              {filteredSales.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-xl p-4 text-center text-gray-500 dark:text-gray-400">
                  No matching invoices found. Try adjusting your filters.
                </div>
              ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[100px]">
                          Invoice #
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
                          Payment Status
                        </th>
                        <th scope="col" className="px-6 py-3 text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-[100px] text-center">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {filteredSales.map((sale) => {
                        const { date, time } = formatDisplayDate(sale.createdAt);
                        const customerDetails = getCustomerDetails(sale.customerId);
                        return (
                          <tr 
                            key={sale.id} 
                            onClick={() => navigate(`/sales/${sale.id}`)}
                            className="hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors duration-150"
                          >
                            <td className="px-6 py-4">
                              <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{sale.invoiceNumber || sale.displayId}</span>
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
                                {formatCurrency(sale.totalAmount)}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                                ${sale.paymentStatus === 'PAID' 
                                  ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' 
                                  : sale.paymentStatus === 'PARTIAL' 
                                    ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200'
                                    : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}
                              >
                                {sale.paymentStatus || 'UNPAID'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="flex items-center justify-center space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/sales/edit/${sale.id}`);
                                  }}
                                  className="text-sky-600 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-300"
                                  title="Edit Sale"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handlePrintSale(e, sale.id)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                                  title="Print Invoice"
                                >
                                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                                  </svg>
                                </button>
                                <button
                                  onClick={(e) => handleDeleteSale(e, sale.id)}
                                  className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
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
              {filteredSales.length === 0 ? (
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 text-center text-gray-500 dark:text-gray-400">
                  No matching invoices found. Try adjusting your filters.
                </div>
              ) : (
                filteredSales.map((sale) => {
                const { date } = formatDisplayDate(sale.createdAt);
                const customerDetails = getCustomerDetails(sale.customerId);
                return (
                  <div 
                    key={sale.id}
                    onClick={() => navigate(`/sales/${sale.id}`)}
                    className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 cursor-pointer"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-sm font-medium text-sky-600 dark:text-sky-400">{sale.invoiceNumber || sale.displayId}</span>
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full 
                        ${sale.paymentStatus === 'PAID' 
                          ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-200' 
                          : sale.paymentStatus === 'PARTIAL' 
                            ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-200'
                            : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200'}`}
                      >
                        {sale.paymentStatus || 'UNPAID'}
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
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatCurrency(sale.totalAmount)}
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 flex justify-end space-x-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/sales/edit/${sale.id}`);
                        }}
                        className="text-sky-600 dark:text-sky-400 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </button>
                      <button
                        onClick={(e) => handlePrintSale(e, sale.id)}
                        className="text-indigo-600 dark:text-indigo-400 flex items-center"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print
                      </button>
                      <button
                        onClick={(e) => handleDeleteSale(e, sale.id)}
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
      </div>

      {/* Print Invoice Modal */}
      <PrintInvoiceModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        saleId={selectedSaleId}
        title={selectedSaleId ? `Invoice #${sales.find(s => s.id === selectedSaleId)?.invoiceNumber || ''}` : 'Print Invoice'}
      />
    </div>
  );
};

export default Sales; 
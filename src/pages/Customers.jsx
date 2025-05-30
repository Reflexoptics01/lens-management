import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, deleteDoc, doc, onSnapshot, query, where, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { getUserCollection, getUserDoc, getUserSettings } from '../utils/multiTenancy';
import Navbar from '../components/Navbar';
import CustomerForm from '../components/CustomerForm';
import CustomerCard from '../components/CustomerCard';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  UserGroupIcon, 
  ArrowPathIcon,
  BuildingStorefrontIcon
} from '@heroicons/react/24/outline';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('customers'); // 'customers' or 'vendors'
  const [isAddingVendor, setIsAddingVendor] = useState(false);
  const [componentError, setComponentError] = useState(null); // For overall component errors
  const navigate = useNavigate();

  // States for address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [shopInfo, setShopInfo] = useState(null);

  // Global error handler to prevent white screen
  useEffect(() => {
    const originalConsoleError = console.error;
    console.error = (...args) => {
      originalConsoleError(...args);
      // Check if this is a React error
      const errorString = args.join(' ');
      if (errorString.includes('React') || errorString.includes('rendering')) {
        setComponentError(`An error occurred: ${errorString}`);
      }
    };

    // Enable error recovery
    window.addEventListener('error', (event) => {
      setComponentError(`App error: ${event.message}`);
      event.preventDefault();
    });

    return () => {
      console.error = originalConsoleError;
    };
  }, []);

  // Reset errors when key states change
  useEffect(() => {
    if (componentError) {
      setComponentError(null);
    }
  }, [customers, vendors, activeTab, searchTerm]);

  useEffect(() => {
    console.log("Mounting Customers component");
    let unsubscribeCustomers;
    let unsubscribeVendors;

    const initializeContacts = async () => {
      try {
        if (!auth.currentUser) {
          navigate('/login');
          return;
        }

        console.log("Setting up listeners for customers and vendors");
        // Set up real-time listener for customers collection
        const customersRef = getUserCollection('customers');
        const customersQuery = query(customersRef, where('type', '!=', 'vendor'));
        
        unsubscribeCustomers = onSnapshot(customersQuery, (snapshot) => {
          console.log(`Received ${snapshot.docs.length} customer(s) from Firestore`);
          const customersList = snapshot.docs
            .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data
              };
            });
          setCustomers(customersList);
          setError('');
          setLoading(false);
        }, (err) => {
          console.error('Error fetching customers:', err);
          setError('Failed to load customers. Please try again.');
          setLoading(false);
        });
        
        // Set up real-time listener for vendors collection
        const vendorsQuery = query(customersRef, where('type', '==', 'vendor'));
        
        unsubscribeVendors = onSnapshot(vendorsQuery, (snapshot) => {
          console.log(`Received ${snapshot.docs.length} vendor(s) from Firestore`);
          const vendorsList = snapshot.docs
            .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
            .map(doc => {
              const data = doc.data();
              return {
                id: doc.id,
                ...data
              };
            });
          setVendors(vendorsList);
        }, (err) => {
          console.error('Error fetching vendors:', err);
        });

        // Fetch shop information for address printing
        fetchShopInfo();

      } catch (error) {
        console.error('Error initializing contacts:', error);
        setError('Failed to initialize contacts view');
        setLoading(false);
      }
    };

    initializeContacts();
    
    return () => {
      console.log("Unmounting Customers component");
      if (unsubscribeCustomers) unsubscribeCustomers();
      if (unsubscribeVendors) unsubscribeVendors();
    };
  }, [navigate]);

  // Fetch shop information for address modal
  const fetchShopInfo = async () => {
    try {
      console.log('Fetching shop info...');
      const shopSettingsDoc = await getDoc(getUserSettings());
      if (shopSettingsDoc.exists()) {
        const shopData = shopSettingsDoc.data();
        console.log('Shop info fetched successfully:', shopData);
        setShopInfo(shopData);
      } else {
        console.warn('Shop settings document does not exist');
        setShopInfo({}); // Set empty object to prevent infinite loading
      }
    } catch (error) {
      console.error('Error fetching shop info:', error);
      setShopInfo({}); // Set empty object to prevent infinite loading
    }
  };

  // Handle printing address
  const handlePrintAddress = (customer) => {
    console.log('Print address clicked for customer:', customer);
    
    if (!customer) {
      console.error('No customer provided for address printing');
      return;
    }
    
    setSelectedCustomer(customer);
    setShowAddressModal(true);
    
    // Ensure shop info is fetched if not available
    if (!shopInfo) {
      console.log('Shop information not available, fetching...');
      fetchShopInfo();
    }
  };

  const handleDelete = async (itemId) => {
    const itemType = activeTab === 'customers' ? 'customer' : 'vendor';
    
    if (!window.confirm(`Are you sure you want to delete this ${itemType}?`)) {
      return;
    }

    try {
      await deleteDoc(getUserDoc('customers', itemId));
      console.log(`${itemType} deleted successfully`);
      // No need to update state as the onSnapshot listener will handle it
    } catch (error) {
      console.error(`Error deleting ${itemType}:`, error);
      setError(`Failed to delete ${itemType}`);
    }
  };

  const handleEdit = (item) => {
    console.log("Editing item:", item);
    setEditingCustomer(item);
    setIsAddingVendor(item.type === 'vendor' || activeTab === 'vendors');
    setShowAddModal(true);
  };

  const handleCloseModal = (wasSaved) => {
    try {
      console.log("Modal closed, customer/vendor saved:", wasSaved);
      
      // First, clear the search term if a customer was saved
      if (wasSaved) {
        setSearchTerm('');
      }
      
      // Use setTimeout to ensure state updates have time to process
      setTimeout(() => {
        setShowAddModal(false);
        setEditingCustomer(null);
        setIsAddingVendor(false);
      }, 0);
    } catch (err) {
      console.error("Error in handleCloseModal:", err);
      // If an error occurs, force a page reload
      alert("An error occurred. The page will reload.");
      window.location.reload();
    }
  };
  
  const handleAddNew = () => {
    console.log("Adding new", activeTab === 'customers' ? 'customer' : 'vendor');
    setIsAddingVendor(activeTab === 'vendors');
    setShowAddModal(true);
  };

  // Safely access properties that might be undefined
  const safeGet = (obj, path, fallback = '') => {
    try {
      const result = path.split('.').reduce((o, key) => o?.[key], obj);
      return result !== undefined && result !== null ? result : fallback;
    } catch (e) {
      return fallback;
    }
  };

  // Filter items based on search term with error handling
  const getFilteredItems = () => {
    const items = activeTab === 'customers' ? customers : vendors;
    console.log(`Filtering ${items.length} ${activeTab} with search term: "${searchTerm}"`);
    
    if (!searchTerm || !searchTerm.trim()) {
      return items;
    }
    
    const term = searchTerm.toLowerCase().trim();
    return items.filter(item => {
      try {
        return (
          safeGet(item, 'opticalName', '').toLowerCase().includes(term) ||
          safeGet(item, 'contactPerson', '').toLowerCase().includes(term) ||
          safeGet(item, 'phone', '').includes(term) ||
          safeGet(item, 'city', '').toLowerCase().includes(term)
        );
      } catch (error) {
        console.error("Error filtering item:", error, item);
        return false;
      }
    });
  };
  
  // Format currency for display with error handling
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    try {
      return `₹${parseFloat(amount).toLocaleString('en-IN', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2 
      })}`;
    } catch (error) {
      console.error("Error formatting currency:", error, amount);
      return '₹0.00';
    }
  };

  // Get filtered items with error handling
  let filteredItems = [];
  try {
    filteredItems = getFilteredItems();
    console.log(`Filtered items: ${filteredItems.length}`);
  } catch (error) {
    console.error("Error getting filtered items:", error);
    filteredItems = activeTab === 'customers' ? customers : vendors;
  }
  
  // Create debugging information
  console.log("Current state:", {
    customersCount: customers.length,
    vendorsCount: vendors.length,
    activeTab,
    loading,
    showAddModal,
    error: error || 'none',
    searchTerm: searchTerm || 'none',
    filteredItemsCount: filteredItems.length
  });

  // Function to print the address content
  const printAddressContent = () => {
    const content = document.getElementById('address-content');
    if (!content) {
      console.error('Address content element not found');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error('Failed to open print window');
      return;
    }

    const htmlContent = `
      <html>
        <head>
          <title>Print Address</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
            }
            .address-wrapper {
              display: flex;
              flex-direction: column;
              gap: 30px;
              max-width: 400px;
              margin: 0 auto;
            }
            .address-block {
              border: 1px solid #000;
              padding: 15px;
              margin-bottom: 20px;
            }
            .address-label {
              font-weight: bold;
              font-size: 14px;
              margin-bottom: 5px;
              text-transform: uppercase;
            }
            .address-text {
              font-size: 16px;
              line-height: 1.4;
            }
            h2 {
              margin-top: 0;
              margin-bottom: 10px;
              font-size: 18px;
              text-align: center;
            }
            .divider {
              border-bottom: 1px dashed #000;
              margin: 15px 0;
            }
            @media print {
              body {
                padding: 0;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
          <div class="no-print" style="margin-top: 20px; text-align: center;">
            <button onclick="window.print();" style="padding: 10px 20px; background: #4a90e2; color: white; border: none; border-radius: 4px; cursor: pointer;">
              Print
            </button>
            <button onclick="window.close();" style="padding: 10px 20px; background: #e74c3c; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px;">
              Close
            </button>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Auto-print after a delay to ensure content is loaded
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  // Address Modal Component
  const AddressModal = () => {
    if (!selectedCustomer) {
      console.error('No selected customer for address modal');
      return null;
    }
    
    // If shop info is not available, show a loading state or fetch it
    if (!shopInfo) {
      console.log('Shop info not available, fetching...');
      fetchShopInfo();
      return (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="text-center">
                  <p>Loading shop information...</p>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => setShowAddressModal(false)}
                  className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className="fixed inset-0 overflow-y-auto z-50">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

          <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
            <div id="address-content" className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
              <div className="address-wrapper">
                <div className="address-block">
                  <h2>FROM</h2>
                  <div className="divider"></div>
                  <div className="address-label">Sender:</div>
                  <div className="address-text">
                    <strong>{shopInfo.shopName || 'Your Shop Name'}</strong><br />
                    {shopInfo.address || ''}<br />
                    {shopInfo.city && shopInfo.state ? `${shopInfo.city}, ${shopInfo.state}` : shopInfo.city || shopInfo.state || ''} 
                    {shopInfo.pincode ? ` - ${shopInfo.pincode}` : ''}<br />
                    {shopInfo.phone && `Phone: ${shopInfo.phone}`}<br />
                    {shopInfo.email && `Email: ${shopInfo.email}`}<br />
                    {shopInfo.gstNumber && `GSTIN: ${shopInfo.gstNumber}`}
                  </div>
                </div>

                <div className="address-block">
                  <h2>TO</h2>
                  <div className="divider"></div>
                  <div className="address-label">Recipient:</div>
                  <div className="address-text">
                    <strong>{selectedCustomer.opticalName || selectedCustomer.name || 'Customer Name'}</strong><br />
                    {selectedCustomer.address || ''}<br />
                    {selectedCustomer.city && selectedCustomer.state ? `${selectedCustomer.city}, ${selectedCustomer.state}` : selectedCustomer.city || selectedCustomer.state || ''}<br />
                    {selectedCustomer.phone && `Phone: ${selectedCustomer.phone}`}<br />
                    {selectedCustomer.gstNumber && `GSTIN: ${selectedCustomer.gstNumber}`}<br />
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                onClick={printAddressContent}
                className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Print
              </button>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center p-8 text-gray-600">
            <ArrowPathIcon className="animate-spin w-12 h-12 mb-4 text-sky-600" />
            <p>Loading contacts...</p>
          </div>
        </main>
      </div>
    );
  }

  if (componentError) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <main className="flex-grow p-4">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 text-red-700 rounded-md">
            <h3 className="font-bold text-lg">Something went wrong</h3>
            <p className="mb-2">{componentError}</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Reload Page
            </button>
          </div>
          <div className="bg-white rounded-lg shadow-md p-4 mt-4">
            <h3 className="text-lg font-medium">Actions</h3>
            <div className="mt-2 space-y-2">
              <button
                onClick={() => {
                  setSearchTerm('');
                  setActiveTab('customers');
                  setCustomers([]);
                  setVendors([]);
                  setComponentError(null);
                  window.location.reload();
                }}
                className="bg-gray-200 text-gray-800 px-4 py-2 rounded mr-2"
              >
                Reset & Reload
              </button>
              <button
                onClick={() => navigate('/')}
                className="bg-sky-600 text-white px-4 py-2 rounded"
              >
                Go to Dashboard
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Vendors & Customers</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Manage your business relationships</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5" style={{ color: 'var(--text-muted)' }} />
              </div>
              <input
                type="text"
                placeholder={`Search ${activeTab === 'customers' ? 'customers' : 'vendors'}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 form-input block w-full sm:w-auto"
              />
            </div>
            
            <button
              onClick={handleAddNew}
              className="btn-primary inline-flex items-center justify-center px-4 py-2"
            >
              <PlusIcon className="w-5 h-5 mr-2 -ml-1" />
              <span>Add {activeTab === 'customers' ? 'Customer' : 'Vendor'}</span>
            </button>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="mb-6" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex -mb-px">
            <button
              onClick={() => {
                setActiveTab('customers');
                setSearchTerm('');
              }}
              className={`py-3 px-6 text-sm font-medium rounded-t-lg focus:outline-none ${
                activeTab === 'customers'
                  ? 'text-sky-600 border-t border-l border-r'
                  : 'hover:bg-opacity-50'
              }`}
              style={{
                backgroundColor: activeTab === 'customers' ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                color: activeTab === 'customers' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderColor: activeTab === 'customers' ? 'var(--border-primary)' : 'transparent'
              }}
            >
              <div className="flex items-center space-x-2">
                <UserGroupIcon className="w-5 h-5" />
                <span>Customers</span>
                <span className="ml-1 bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full text-xs">
                  {customers?.length || 0}
                </span>
              </div>
            </button>
            <button
              onClick={() => {
                setActiveTab('vendors');
                setSearchTerm('');
              }}
              className={`py-3 px-6 text-sm font-medium rounded-t-lg focus:outline-none ${
                activeTab === 'vendors'
                  ? 'text-sky-600 border-t border-l border-r'
                  : 'hover:bg-opacity-50'
              }`}
              style={{
                backgroundColor: activeTab === 'vendors' ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                color: activeTab === 'vendors' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderColor: activeTab === 'vendors' ? 'var(--border-primary)' : 'transparent'
              }}
            >
              <div className="flex items-center space-x-2">
                <BuildingStorefrontIcon className="w-5 h-5" />
                <span>Vendors</span>
                <span className="ml-1 bg-gray-100 text-gray-700 py-0.5 px-2 rounded-full text-xs">
                  {vendors?.length || 0}
                </span>
              </div>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 border-l-4 border-red-400 text-red-700 rounded-md" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}
        
        {/* No Items State */}
        {!filteredItems || filteredItems.length === 0 ? (
          <div className="card p-8 text-center">
            {activeTab === 'customers' ? (
              <UserGroupIcon className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            ) : (
              <BuildingStorefrontIcon className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--text-muted)' }} />
            )}
            <h3 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              {searchTerm 
                ? `No ${activeTab === 'customers' ? 'customers' : 'vendors'} matching "${searchTerm}"` 
                : `No ${activeTab === 'customers' ? 'customers' : 'vendors'} found`}
            </h3>
            <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
              {searchTerm 
                ? (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="text-sky-600 hover:text-sky-800"
                  >
                    Clear search
                  </button>
                ) 
                : `Get started by adding your first ${activeTab === 'customers' ? 'customer' : 'vendor'}`}
            </p>
            {!searchTerm && (
              <button
                onClick={handleAddNew}
                className="btn-primary inline-flex items-center justify-center px-4 py-2"
              >
                <PlusIcon className="w-5 h-5 mr-2 -ml-1" />
                Add New {activeTab === 'customers' ? 'Customer' : 'Vendor'}
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Search Results Summary */}
            {searchTerm && (
              <div className="mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                Found {filteredItems.length} {filteredItems.length === 1 
                  ? (activeTab === 'customers' ? 'customer' : 'vendor') 
                  : (activeTab === 'customers' ? 'customers' : 'vendors')} 
                matching "{searchTerm}"
                <button 
                  onClick={() => setSearchTerm('')}
                  className="ml-2 text-sky-600 hover:text-sky-800"
                >
                  Clear search
                </button>
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block mb-8">
              <div className="card overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                    <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          {activeTab === 'customers' ? 'Optical Name' : 'Business Name'}
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Contact Person
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Phone / City
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Financial
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                      {filteredItems.map((item) => (
                        <tr key={item.id} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {safeGet(item, 'opticalName', '[No Name]')}
                            </div>
                            {item.gstNumber && (
                              <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">GST</span> {item.gstNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {safeGet(item, 'contactPerson')}
                            </div>
                            {item.email && (
                              <div className="text-sm text-sky-600 truncate max-w-[200px]">
                                <a href={`mailto:${item.email}`}>{item.email}</a>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-sky-600">
                              {item.phone && <a href={`tel:${item.phone}`}>{item.phone}</a>}
                            </div>
                            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              {safeGet(item, 'city')}{item.state ? `, ${item.state}` : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {(item.creditLimit !== undefined || item.openingBalance !== undefined || item.creditPeriod !== undefined) && (
                              <div className="space-y-1 text-sm">
                                {item.creditLimit !== undefined && (
                                  <div className="flex justify-between">
                                    <span style={{ color: 'var(--text-muted)' }}>Credit Limit:</span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.creditLimit)}</span>
                                  </div>
                                )}
                                {item.openingBalance !== undefined && (
                                  <div className="flex justify-between">
                                    <span style={{ color: 'var(--text-muted)' }}>Opening Bal:</span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.openingBalance)}</span>
                                  </div>
                                )}
                                {item.creditPeriod !== undefined && (
                                  <div className="flex justify-between">
                                    <span style={{ color: 'var(--text-muted)' }}>Credit Period:</span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.creditPeriod} days</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(item)}
                              className="text-sky-600 hover:text-sky-900 mr-4"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handlePrintAddress(item)}
                              className="text-purple-600 hover:text-purple-900 mr-4"
                            >
                              Print Address
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4">
              {filteredItems.map((item) => (
                <CustomerCard
                  key={item.id}
                  customer={item}
                  onEdit={() => handleEdit(item)}
                  onDelete={() => handleDelete(item.id)}
                  onPrintAddress={() => handlePrintAddress(item)}
                  formatCurrency={formatCurrency}
                  isVendor={activeTab === 'vendors'}
                />
              ))}
            </div>
          </>
        )}
      </main>
      
      {/* Customer/Vendor Form Modal */}
      {showAddModal && (
        <CustomerForm 
          onClose={handleCloseModal} 
          customer={editingCustomer} 
          isVendor={isAddingVendor} 
        />
      )}

      {/* Address Modal */}
      {showAddressModal && (
        <AddressModal />
      )}
    </div>
  );
};

export default Customers; 
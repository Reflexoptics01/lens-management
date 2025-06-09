import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, deleteDoc, doc, onSnapshot, query, where, getDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { getUserCollection, getUserDoc, getUserSettings } from '../utils/multiTenancy';
import { dateToISOString, formatDate, formatDateTime, processRestoredData } from '../utils/dateUtils';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import CustomerForm from '../components/CustomerForm';
import CustomerCard from '../components/CustomerCard';
import * as XLSX from 'xlsx';
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

  // Import/Export states
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState('');

  // States for address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [shopInfo, setShopInfo] = useState(null);

  // States for batch selection and delete
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Use centralized auth
  const { isAuthenticated } = useAuth();

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

  // Reset selections when switching tabs or search changes
  useEffect(() => {
    setSelectedItems([]);
    setSelectAll(false);
    setIsBatchMode(false);
    setShowDeleteModal(false);
    setItemToDelete(null);
  }, [activeTab, searchTerm]);

  useEffect(() => {
    console.log("Mounting Customers component");
    let unsubscribeCustomers;
    let unsubscribeVendors;

    const initializeContacts = async () => {
      try {
        if (!isAuthenticated()) {
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

  const handleDelete = (itemId, item) => {
    setItemToDelete({ id: itemId, item });
    setShowDeleteModal(true);
  };

  const confirmSingleDelete = async () => {
    const itemType = activeTab === 'customers' ? 'customer' : 'vendor';
    
    try {
      await deleteDoc(getUserDoc('customers', itemToDelete.id));
      console.log(`${itemType} deleted successfully`);
      setShowDeleteModal(false);
      setItemToDelete(null);
    } catch (error) {
      console.error(`Error deleting ${itemType}:`, error);
      setError(`Failed to delete ${itemType}`);
    }
  };

  const startBatchMode = () => {
    setIsBatchMode(true);
    setShowDeleteModal(false);
    setItemToDelete(null);
  };

  const cancelBatchMode = () => {
    setIsBatchMode(false);
    setSelectedItems([]);
    setSelectAll(false);
  };

  // Handle batch delete
  const handleBatchDelete = async () => {
    const itemType = activeTab === 'customers' ? 'customers' : 'vendors';
    const count = selectedItems.length;
    
    if (count === 0) {
      alert('No items selected for deletion');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${count} selected ${itemType}? This action cannot be undone.`)) {
      return;
    }

    try {
      setLoading(true);
      const deletePromises = selectedItems.map(itemId => 
        deleteDoc(getUserDoc('customers', itemId))
      );
      
      await Promise.all(deletePromises);
      console.log(`${count} ${itemType} deleted successfully`);
      
      // Clear selections
      setSelectedItems([]);
      setSelectAll(false);
      
      // Success message
      alert(`Successfully deleted ${count} ${itemType}`);
      
    } catch (error) {
      console.error(`Error deleting ${itemType}:`, error);
      setError(`Failed to delete some ${itemType}. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  // Handle individual item selection
  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => {
      const newSelection = prev.includes(itemId) 
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId];
      
      // Update select all state
      const filteredItemIds = filteredItems.map(item => item.id);
      setSelectAll(newSelection.length === filteredItemIds.length && filteredItemIds.length > 0);
      
      return newSelection;
    });
  };

  // Handle select all toggle
  const handleSelectAll = () => {
    const filteredItemIds = filteredItems.map(item => item.id);
    
    if (selectAll) {
      // Deselect all
      setSelectedItems([]);
      setSelectAll(false);
    } else {
      // Select all visible items
      setSelectedItems(filteredItemIds);
      setSelectAll(true);
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

  // Filter and sort items based on search term with error handling
  const getFilteredItems = () => {
    const items = activeTab === 'customers' ? customers : vendors;
    console.log(`Filtering ${items.length} ${activeTab} with search term: "${searchTerm}"`);
    
    let filteredItems;
    if (!searchTerm || !searchTerm.trim()) {
      filteredItems = items;
    } else {
      const term = searchTerm.toLowerCase().trim();
      filteredItems = items.filter(item => {
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
    }
    
    // Sort alphabetically by optical name
    return filteredItems.sort((a, b) => {
      const nameA = safeGet(a, 'opticalName', '').toLowerCase();
      const nameB = safeGet(b, 'opticalName', '').toLowerCase();
      return nameA.localeCompare(nameB);
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

  // Import function for customers/vendors
  const handleImport = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const fileType = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(fileType)) {
      setImportError('Please select a valid Excel file (.xlsx or .xls)');
      event.target.value = '';
      return;
    }

    setImportLoading(true);
    setImportError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          setImportError('The Excel file appears to be empty');
          setImportLoading(false);
          event.target.value = '';
          return;
        }

        // Validate required columns based on active tab
        const requiredColumns = activeTab === 'customers' 
          ? ['optical name', 'contact person', 'phone', 'city']
          : ['business name', 'contact person', 'phone', 'city'];
        
        const fileColumns = Object.keys(jsonData[0]).map(col => col.toLowerCase().trim());
        const missingColumns = requiredColumns.filter(col => 
          !fileColumns.includes(col.toLowerCase())
        );

        if (missingColumns.length > 0) {
          setImportError(`Missing required columns: ${missingColumns.join(', ')}`);
          setImportLoading(false);
          event.target.value = '';
          return;
        }

        // Process and import data
        let successCount = 0;
        let errorCount = 0;
        const errors = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          try {
            const getColumnValue = (row, columnName) => {
              const key = Object.keys(row).find(k => 
                k.toLowerCase().trim() === columnName.toLowerCase()
              );
              return key ? row[key] : '';
            };

            const opticalName = getColumnValue(row, activeTab === 'customers' ? 'optical name' : 'business name');
            const contactPerson = getColumnValue(row, 'contact person');
            const phone = getColumnValue(row, 'phone');
            const city = getColumnValue(row, 'city');
            const state = getColumnValue(row, 'state');
            const address = getColumnValue(row, 'address');
            const email = getColumnValue(row, 'email');
            const gstNumber = getColumnValue(row, 'gst number');
            const creditLimit = getColumnValue(row, 'credit limit');
            const openingBalance = getColumnValue(row, 'opening balance');

            // Validate required fields
            if (!opticalName?.toString().trim()) {
              errors.push(`Row ${i + 2}: ${activeTab === 'customers' ? 'Optical Name' : 'Business Name'} is required`);
              errorCount++;
              continue;
            }

            if (!contactPerson?.toString().trim()) {
              errors.push(`Row ${i + 2}: Contact Person is required`);
              errorCount++;
              continue;
            }

            if (!phone?.toString().trim()) {
              errors.push(`Row ${i + 2}: Phone is required`);
              errorCount++;
              continue;
            }

            if (!city?.toString().trim()) {
              errors.push(`Row ${i + 2}: City is required`);
              errorCount++;
              continue;
            }

            // Create customer/vendor data
            const itemData = {
              opticalName: opticalName.toString().trim(),
              contactPerson: contactPerson.toString().trim(),
              phone: phone.toString().trim(),
              city: city.toString().trim(),
              state: state?.toString().trim() || '',
              address: address?.toString().trim() || '',
              email: email?.toString().trim() || '',
              gstNumber: gstNumber?.toString().trim() || '',
              type: activeTab === 'vendors' ? 'vendor' : 'customer',
              isImported: true,
              importedAt: serverTimestamp(),
              createdAt: serverTimestamp()
            };

            // Add financial fields if provided
            if (creditLimit && !isNaN(parseFloat(creditLimit))) {
              itemData.creditLimit = parseFloat(creditLimit);
            }
            if (openingBalance && !isNaN(parseFloat(openingBalance))) {
              itemData.openingBalance = parseFloat(openingBalance);
            }

            // Add to Firestore
            await addDoc(getUserCollection('customers'), itemData);
            successCount++;

          } catch (error) {
            console.error(`Error importing row ${i + 2}:`, error);
            errors.push(`Row ${i + 2}: ${error.message}`);
            errorCount++;
          }
        }

        // Show results
        let message = `Import completed!\n`;
        message += `✅ Successfully imported: ${successCount} ${activeTab}\n`;
        if (errorCount > 0) {
          message += `❌ Failed to import: ${errorCount} records\n\n`;
          if (errors.length > 0) {
            message += `Errors:\n${errors.slice(0, 10).join('\n')}`;
            if (errors.length > 10) {
              message += `\n... and ${errors.length - 10} more errors`;
            }
          }
        }

        alert(message);
        event.target.value = '';

      } catch (error) {
        console.error('Error parsing Excel file:', error);
        setImportError('Failed to parse Excel file. Please check the file format.');
        event.target.value = '';
      } finally {
        setImportLoading(false);
      }
    };

    reader.onerror = () => {
      setImportError('Failed to read the file');
      setImportLoading(false);
      event.target.value = '';
    };

    reader.readAsArrayBuffer(file);
  };

  // Download template function
  const downloadImportTemplate = () => {
    const templateData = activeTab === 'customers' 
      ? [
          {
            'optical name': 'ABC Vision Center',
            'contact person': 'John Doe',
            'phone': '9876543210',
            'city': 'Mumbai',
            'state': 'Maharashtra',
            'address': '123 Main Street',
            'email': 'john@abcvision.com',
            'gst number': '27ABCDE1234F1Z5',
            'credit limit': 50000,
            'opening balance': 0
          },
          {
            'optical name': 'XYZ Optical Store',
            'contact person': 'Jane Smith',
            'phone': '9876543211',
            'city': 'Delhi',
            'state': 'Delhi',
            'address': '456 Market Road',
            'email': 'jane@xyzoptical.com',
            'gst number': '07FGHIJ5678K2L9',
            'credit limit': 75000,
            'opening balance': 5000
          }
        ]
      : [
          {
            'business name': 'Lens Suppliers Pvt Ltd',
            'contact person': 'Mike Johnson',
            'phone': '9876543212',
            'city': 'Bangalore',
            'state': 'Karnataka',
            'address': '789 Industrial Area',
            'email': 'mike@lenssuppliers.com',
            'gst number': '29MNOPQ9012R3S4',
            'credit limit': 100000,
            'opening balance': 0
          },
          {
            'business name': 'Frame Distributors Inc',
            'contact person': 'Sarah Wilson',
            'phone': '9876543213',
            'city': 'Chennai',
            'state': 'Tamil Nadu',
            'address': '321 Commerce Street',
            'email': 'sarah@framedist.com',
            'gst number': '33TUVWX3456Y7Z8',
            'credit limit': 150000,
            'opening balance': 10000
          }
        ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Import Template`);

    // Set column widths
    const columnWidths = [
      { wch: 25 }, // optical/business name
      { wch: 20 }, // contact person
      { wch: 15 }, // phone
      { wch: 15 }, // city
      { wch: 15 }, // state
      { wch: 30 }, // address
      { wch: 25 }, // email
      { wch: 20 }, // gst number
      { wch: 15 }, // credit limit
      { wch: 15 }  // opening balance
    ];
    ws['!cols'] = columnWidths;

    XLSX.writeFile(wb, `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}_Import_Template.xlsx`);
  };

  // Export function
  const handleExport = () => {
    const dataToExport = activeTab === 'customers' ? customers : vendors;
    
    if (dataToExport.length === 0) {
      alert(`No ${activeTab} to export`);
      return;
    }

    const exportData = dataToExport.map(item => ({
      [activeTab === 'customers' ? 'Optical Name' : 'Business Name']: item.opticalName || '',
      'Contact Person': item.contactPerson || '',
      'Phone': item.phone || '',
      'City': item.city || '',
      'State': item.state || '',
      'Address': item.address || '',
      'Email': item.email || '',
      'GST Number': item.gstNumber || '',
      'Credit Limit': item.creditLimit || 0,
      'Opening Balance': item.openingBalance || 0,
      'Credit Period': item.creditPeriod || 0,
      'Created Date': item.createdAt ? formatDate(item.createdAt) : ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab.charAt(0).toUpperCase() + activeTab.slice(1));

    // Set column widths
    const columnWidths = [
      { wch: 25 }, // name
      { wch: 20 }, // contact person
      { wch: 15 }, // phone
      { wch: 15 }, // city
      { wch: 15 }, // state
      { wch: 30 }, // address
      { wch: 25 }, // email
      { wch: 20 }, // gst number
      { wch: 15 }, // credit limit
      { wch: 15 }, // opening balance
      { wch: 15 }, // credit period
      { wch: 15 }  // created date
    ];
    ws['!cols'] = columnWidths;

    XLSX.writeFile(wb, `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

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
            
            {/* Import Template Button */}
            <button
              onClick={downloadImportTemplate}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              title={`Download ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} Import Template`}
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Template
            </button>

            {/* Import Button */}
            <label className="inline-flex items-center px-3 py-2 border border-orange-300 text-sm font-medium rounded-lg text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 cursor-pointer">
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              {importLoading ? 'Importing...' : `Import ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImport}
                className="sr-only"
                disabled={importLoading}
              />
            </label>

            {/* Export Button */}
            <button
              onClick={handleExport}
              className="inline-flex items-center px-3 py-2 border border-green-300 text-sm font-medium rounded-lg text-green-700 bg-green-50 hover:bg-green-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Export {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}
            </button>
            
            {/* Batch Mode Controls - Only show in batch mode */}
            {isBatchMode && (
              <div className="flex items-center space-x-3">
                <button
                  onClick={handleBatchDelete}
                  disabled={selectedItems.length === 0}
                  className={`inline-flex items-center px-4 py-2 border text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    selectedItems.length > 0
                      ? 'border-red-300 text-red-700 bg-red-50 hover:bg-red-100 focus:ring-red-500'
                      : 'border-gray-300 text-gray-400 bg-gray-50 cursor-not-allowed'
                  }`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete Selected ({selectedItems.length})
                </button>
                <button
                  onClick={cancelBatchMode}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              </div>
            )}
            
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

        {/* Import Error Display */}
        {importError && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md">
            <p className="font-medium">Import Error</p>
            <p className="text-sm">{importError}</p>
            <button 
              onClick={() => setImportError('')}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Dismiss
            </button>
          </div>
        )}

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
                        {isBatchMode && (
                          <th className="px-4 py-3 text-left" style={{ width: '50px' }}>
                            <input
                              type="checkbox"
                              checked={selectAll}
                              onChange={handleSelectAll}
                              className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                              disabled={filteredItems.length === 0}
                            />
                          </th>
                        )}
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '60px' }}>
                          S.No
                        </th>
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
                        <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                      {filteredItems.map((item, index) => (
                        <tr key={item.id} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                          {isBatchMode && (
                            <td className="px-4 py-4 whitespace-nowrap text-left">
                              <input
                                type="checkbox"
                                checked={selectedItems.includes(item.id)}
                                onChange={() => handleItemSelect(item.id)}
                                className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                              />
                            </td>
                          )}
                          <td className="px-4 py-4 whitespace-nowrap text-left">
                            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                              {index + 1}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-left">
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
                                  <div className="text-left">
                                    <span style={{ color: 'var(--text-muted)' }}>Credit Limit: </span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.creditLimit)}</span>
                                  </div>
                                )}
                                {item.openingBalance !== undefined && (
                                  <div className="text-left">
                                    <span style={{ color: 'var(--text-muted)' }}>Opening Bal: </span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{formatCurrency(item.openingBalance)}</span>
                                  </div>
                                )}
                                {item.creditPeriod !== undefined && (
                                  <div className="text-left">
                                    <span style={{ color: 'var(--text-muted)' }}>Credit Period: </span>
                                    <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.creditPeriod} days</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-left text-sm font-medium">
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
                              onClick={() => handleDelete(item.id, item)}
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
            <div className="md:hidden">
              {/* Mobile Select All - Only show in batch mode */}
              {isBatchMode && filteredItems.length > 0 && (
                <div className="mb-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={handleSelectAll}
                      className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                    />
                    <span className="text-sm font-medium text-gray-700">
                      {selectAll ? 'Deselect All' : 'Select All'} ({filteredItems.length})
                    </span>
                  </label>
                  {selectedItems.length > 0 && (
                    <span className="text-sm text-gray-600">
                      {selectedItems.length} selected
                    </span>
                  )}
                </div>
              )}
              
                              <div className="space-y-4">
                  {filteredItems.map((item) => (
                    <CustomerCard
                      key={item.id}
                      customer={item}
                      onEdit={() => handleEdit(item)}
                      onDelete={() => handleDelete(item.id, item)}
                      onPrintAddress={() => handlePrintAddress(item)}
                      formatCurrency={formatCurrency}
                      isVendor={activeTab === 'vendors'}
                      isSelected={isBatchMode ? selectedItems.includes(item.id) : false}
                      onSelect={isBatchMode ? handleItemSelect : null}
                    />
                  ))}
              </div>
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

      {/* Delete Options Modal */}
      {showDeleteModal && itemToDelete && (
        <div className="fixed inset-0 overflow-y-auto z-50">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity" aria-hidden="true">
              <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
            </div>

            <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="sm:flex sm:items-start">
                  <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 sm:mx-0 sm:h-10 sm:w-10">
                    <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                    <h3 className="text-lg leading-6 font-medium text-gray-900">
                      Delete {activeTab === 'customers' ? 'Customer' : 'Vendor'}
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500 mb-4">
                        You're about to delete "{itemToDelete.item.opticalName}". Choose how you'd like to proceed:
                      </p>
                      
                      <div className="space-y-3">
                        <button
                          onClick={confirmSingleDelete}
                          className="w-full inline-flex items-center justify-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-red-50 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete This {activeTab === 'customers' ? 'Customer' : 'Vendor'} Only
                        </button>
                        
                        <button
                          onClick={startBatchMode}
                          className="w-full inline-flex items-center justify-center px-4 py-2 border border-orange-300 text-sm font-medium rounded-md text-orange-700 bg-orange-50 hover:bg-orange-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Select Multiple {activeTab === 'customers' ? 'Customers' : 'Vendors'} to Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteModal(false);
                    setItemToDelete(null);
                  }}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers; 
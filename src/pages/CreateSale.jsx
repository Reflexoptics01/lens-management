import { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, doc, getDoc, updateDoc, setDoc, deleteDoc, serverTimestamp, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomerSearch from '../components/CustomerSearch';
import CustomerForm from '../components/CustomerForm';
import ItemSuggestions from '../components/ItemSuggestions';
import PrintInvoiceModal from '../components/PrintInvoiceModal';
import BottomActionBar from '../components/BottomActionBar';
import PowerSelectionModal from '../components/PowerSelectionModal';
import QuickTransactionModal from '../components/QuickTransactionModal';
import AddNewProductModal from '../components/AddNewProductModal';
import { calculateCustomerBalance, calculateVendorBalance, formatCurrency as formatCurrencyUtil, getBalanceColorClass, getBalanceStatusText } from '../utils/ledgerUtils';

const TAX_OPTIONS = [
  { id: 'TAX_FREE', label: 'Tax Free', rate: 0 },
  { id: 'CGST_SGST_6', label: 'CGST/SGST 6%', rate: 6, split: true },
  { id: 'CGST_SGST_12', label: 'CGST/SGST 12%', rate: 12, split: true },
  { id: 'CGST_SGST_18', label: 'CGST/SGST 18%', rate: 18, split: true },
  { id: 'IGST_6', label: 'IGST 6%', rate: 6 },
  { id: 'IGST_12', label: 'IGST 12%', rate: 12 },
  { id: 'IGST_18', label: 'IGST 18%', rate: 18 }
];

const CreateSale = () => {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerBalance, setCustomerBalance] = useState(0);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Invoice details
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoicePrefix, setInvoicePrefix] = useState(''); // e.g., "2024-2025"
  const [invoiceSimpleNumber, setInvoiceSimpleNumber] = useState(''); // e.g., "61"
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState('');
  const [selectedTaxOption, setSelectedTaxOption] = useState(TAX_OPTIONS[0].id);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percentage'
  const [discountValue, setDiscountValue] = useState(0);
  const [frieghtCharge, setFrieghtCharge] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('UNPAID'); // 'UNPAID', 'PARTIAL', 'PAID'
  const [amountPaid, setAmountPaid] = useState(0);
  
  // Table rows (invoice items)
  const [tableRows, setTableRows] = useState(Array(5).fill().map(() => ({
    orderId: '',
    orderDetails: null,
    itemName: '',
    sph: '',
    cyl: '',
    axis: '',
    add: '',
    qty: 1,
    unit: 'Pairs', // Default unit
    price: '', // Changed from 0 to empty string
    total: 0
  })));

  // UI state for table rows
  const [showAllRows, setShowAllRows] = useState(false);
  const [displayRowCount, setDisplayRowCount] = useState(5);
  
  // Add more rows
  const addMoreRows = (count = 10) => {
    const newRows = Array(count).fill().map(() => ({
      orderId: '',
      orderDetails: null,
      itemName: '',
      sph: '',
      cyl: '',
      axis: '',
      add: '',
      qty: 1,
      unit: 'Pairs', // Default unit
      price: '', // Changed from 0 to empty string
      total: 0
    }));
    
    setTableRows([...tableRows, ...newRows]);
  };

  // Delete a specific row
  const handleDeleteRow = (indexToDelete) => {
    // Prevent deletion if it would leave us with no rows
    if (tableRows.length <= 1) {
      alert('Cannot delete the last row. At least one row is required.');
      return;
    }
    
    // Filter out the row at the specified index
    const updatedRows = tableRows.filter((_, index) => index !== indexToDelete);
    setTableRows(updatedRows);
    
    // Clear any power range warnings for deleted row and adjust indices for remaining rows
    setPowerRangeWarnings(prev => {
      const newWarnings = {};
      Object.keys(prev).forEach(key => {
        const rowIndex = parseInt(key);
        if (rowIndex < indexToDelete) {
          // Keep warnings for rows before the deleted row
          newWarnings[rowIndex] = prev[key];
        } else if (rowIndex > indexToDelete) {
          // Shift warnings for rows after the deleted row
          newWarnings[rowIndex - 1] = prev[key];
        }
        // Skip warnings for the deleted row (rowIndex === indexToDelete)
      });
      return newWarnings;
    });
    
    // Clear any selected stock powers for deleted row and adjust indices
    setSelectedStockPowers(prev => {
      const newPowers = {};
      Object.keys(prev).forEach(key => {
        const rowIndex = parseInt(key);
        if (rowIndex < indexToDelete) {
          // Keep powers for rows before the deleted row
          newPowers[rowIndex] = prev[key];
        } else if (rowIndex > indexToDelete) {
          // Shift powers for rows after the deleted row
          newPowers[rowIndex - 1] = prev[key];
        }
        // Skip powers for the deleted row (rowIndex === indexToDelete)
      });
      return newPowers;
    });
  };

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState(null);
  const [hasPrintedInvoice, setHasPrintedInvoice] = useState(false);
  
  // Add state for address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [shopInfo, setShopInfo] = useState(null);

  const [searchCustomer, setSearchCustomer] = useState('');

  // Add state for showing the customer form modal
  const [showCustomerForm, setShowCustomerForm] = useState(false);

  // Add state for item suggestions
  const [itemSuggestions, setItemSuggestions] = useState([]);
  const [showItemSuggestions, setShowItemSuggestions] = useState(false);
  const [activeItemIndex, setActiveItemIndex] = useState(-1);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const itemSuggestionsRef = useRef(null);

  // New state for fallback print
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Add state for dispatch logs
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [showDispatchLogs, setShowDispatchLogs] = useState(false);
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const [isSearchingLogs, setIsSearchingLogs] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [selectedLogDate, setSelectedLogDate] = useState(new Date().toISOString().split('T')[0]); // Add state for selected log date

  // PowerSelectionModal state - ONLY for stock lenses
  const [showPowerSelectionModal, setShowPowerSelectionModal] = useState(false);
  const [powerSelectionRowIndex, setPowerSelectionRowIndex] = useState(null);
  const [selectedStockPowers, setSelectedStockPowers] = useState({}); // Track selected powers by row index
  const [selectedLensForPowerModal, setSelectedLensForPowerModal] = useState(null); // Store the lens object for the modal

  // Power range validation state
  const [powerRangeWarnings, setPowerRangeWarnings] = useState({}); // Track warnings for each row

  // Section navigation state
  const [currentSectionIndex, setCurrentSectionIndex] = useState(0);

  // Quick Transaction Modal state
  const [showQuickTransactionModal, setShowQuickTransactionModal] = useState(false);

  // AddNewProductModal state
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [currentItemName, setCurrentItemName] = useState('');
  const [currentRowIndex, setCurrentRowIndex] = useState(null);



  // Format optical values (SPH, CYL, ADD) to "0.00" format with signs
  const formatOpticalValue = (value) => {
    if (!value || value === '') return '';
    
    // Convert to number
    let numValue = parseFloat(value);
    if (isNaN(numValue)) return value; // Return original if not a valid number
    
    // Format to 2 decimal places and add + sign for positive values
    let formattedValue = numValue.toFixed(2);
    
    // Add plus sign for positive values (including zero with a plus sign if it has no sign)
    if (numValue > 0 || (numValue === 0 && !value.includes('-'))) {
      formattedValue = '+' + formattedValue;
    }
    
    return formattedValue;
  };

  // Validate power range for SPH/CYL values
  const validatePowerRange = (rowIndex, field, value) => {
    const row = tableRows[rowIndex];
    
    if (!row || !value || value === '') {
      // Clear any existing warning for this field
      setPowerRangeWarnings(prev => {
        const newWarnings = { ...prev };
        if (newWarnings[rowIndex]) {
          delete newWarnings[rowIndex][field];
          if (Object.keys(newWarnings[rowIndex]).length === 0) {
            delete newWarnings[rowIndex];
          }
        }
        return newWarnings;
      });
      return;
    }

    // Check multiple possible sources for power range data
    let stockData = null;
    if (row.stockLensData) {
      stockData = row.stockLensData.stockData || row.stockLensData;
    } else {
      // For regular stock lens items, the maxSph/maxCyl might be directly in the row
      stockData = row;
    }
    
    // If we still don't have power range data, exit
    if (!stockData || (!stockData.maxSph && !stockData.maxCyl)) {
      return;
    }
    
    const numValue = parseFloat(value);
    
    if (isNaN(numValue)) return;

    let isOutOfRange = false;
    let rangeText = '';

    if (field === 'sph' && stockData.maxSph) {
      const maxSph = parseFloat(stockData.maxSph);
      // For SPH: if maxSph is positive, range is 0 to +maxSph; if negative, range is maxSph to 0
      let minSph, maxSphRange;
      if (maxSph >= 0) {
        minSph = 0;
        maxSphRange = maxSph;
        rangeText = `0 to +${maxSph.toFixed(2)}`;
      } else {
        minSph = maxSph;
        maxSphRange = 0;
        rangeText = `${maxSph.toFixed(2)} to 0`;
      }
      isOutOfRange = numValue < minSph || numValue > maxSphRange;
    } else if (field === 'cyl' && stockData.maxCyl) {
      const maxCyl = parseFloat(stockData.maxCyl);
      // For CYL: if maxCyl is positive, range is 0 to +maxCyl; if negative, range is maxCyl to 0
      let minCyl, maxCylRange;
      if (maxCyl >= 0) {
        minCyl = 0;
        maxCylRange = maxCyl;
        rangeText = `0 to +${maxCyl.toFixed(2)}`;
      } else {
        minCyl = maxCyl;
        maxCylRange = 0;
        rangeText = `${maxCyl.toFixed(2)} to 0`;
      }
      isOutOfRange = numValue < minCyl || numValue > maxCylRange;
    }

    if (isOutOfRange) {
      setPowerRangeWarnings(prev => ({
        ...prev,
        [rowIndex]: {
          ...prev[rowIndex],
          [field]: `⚠️ ${rangeText}` // Remove "Out of range!" to make it shorter
        }
      }));
    } else {
      // Clear warning if value is in range
      setPowerRangeWarnings(prev => {
        const newWarnings = { ...prev };
        if (newWarnings[rowIndex]) {
          delete newWarnings[rowIndex][field];
          if (Object.keys(newWarnings[rowIndex]).length === 0) {
            delete newWarnings[rowIndex];
          }
        }
        return newWarnings;
      });
    }
  };

  // Handlers for tax calculations
  const getTaxOption = (taxId) => {
    return TAX_OPTIONS.find(option => option.id === taxId) || TAX_OPTIONS[0];
  };
  
  // Calculate subtotal before tax/discount
  const calculateSubtotal = () => {
    return tableRows.reduce((sum, row) => sum + (row.total || 0), 0);
  };
  
  // Calculate discount amount
  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    if (discountType === 'percentage') {
      return (subtotal * parseFloat(discountValue || 0)) / 100;
    }
    return parseFloat(discountValue || 0);
  };
  
  // Calculate tax amount
  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const taxableAmount = subtotal - discountAmount;
    const taxOption = getTaxOption(selectedTaxOption);
    return (taxableAmount * taxOption.rate) / 100;
  };
  
  // Calculate grand total
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const taxAmount = calculateTaxAmount();
    const freight = parseFloat(frieghtCharge || 0);
    return subtotal - discountAmount + taxAmount + freight;
  };

  // Calculate total quantities with service separation
  const calculateTotalQuantities = () => {
    const filledRows = tableRows.filter(row => row.total > 0);
    
    let totalPairs = 0;
    let totalServices = 0;
    let totalOthers = 0;
    
    filledRows.forEach(row => {
      const qty = parseFloat(row.qty) || 0;
      const unit = (row.unit || '').toLowerCase();
      
      if (unit === 'service') {
        totalServices += qty;
      } else if (unit === 'pairs') {
        totalPairs += qty;
      } else {
        totalOthers += qty;
      }
    });
    
    return { totalPairs, totalServices, totalOthers };
  };

  // Define navigation sections for keyboard shortcuts
  const navigationSections = [
    {
      name: 'Customer Selection',
      selector: '[data-section="customer-search"] input',
      focusElement: () => document.querySelector('[data-section="customer-search"] input')
    },
    {
      name: 'Invoice Date',
      selector: '[data-section="invoice-date"]',
      focusElement: () => document.querySelector('[data-section="invoice-date"]')
    },
    {
      name: 'First Row Order ID',
      selector: '[data-section="table-row-0"] input[placeholder="Order ID"]',
      focusElement: () => document.querySelector('[data-section="table-row-0"] input[placeholder="Order ID"]')
    },
    {
      name: 'First Row Item Name',
      selector: '[data-section="table-row-0"] [data-section="item-input"]',
      focusElement: () => document.querySelector('[data-section="table-row-0"] [data-section="item-input"]')
    },
    {
      name: 'Tax Options',
      selector: '[data-section="tax-option"]',
      focusElement: () => document.querySelector('[data-section="tax-option"]')
    },
    {
      name: 'Discount',
      selector: '[data-section="discount-type"]',
      focusElement: () => document.querySelector('[data-section="discount-type"]')
    },
    {
      name: 'Save Button',
      selector: '[data-section="save-button"]',
      focusElement: () => document.querySelector('[data-section="save-button"]')
    }
  ];



  // Format quantity display
  const formatQuantityDisplay = () => {
    const { totalPairs, totalServices, totalOthers } = calculateTotalQuantities();
    const parts = [];
    
    if (totalPairs > 0) {
      parts.push(`${totalPairs} PR`);
    }
    
    if (totalServices > 0) {
      parts.push(`${totalServices} SV`);
    }
    
    if (totalOthers > 0) {
      parts.push(`${totalOthers} PC`);
    }
    
    return parts.length > 0 ? parts.join(' & ') : '0';
  };

  useEffect(() => {
    fetchCustomers();
    previewNextInvoiceNumber();
    fetchItems();
    fetchShopInfo();
  }, []);

  // Add keyboard navigation listener
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Handle 'S' key for section navigation when not typing in input fields
      if (event.key.toLowerCase() === 's' && 
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) &&
          !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        
        // Use functional update to get the most current value
        setCurrentSectionIndex(prevIndex => {
          const nextIndex = (prevIndex + 1) % navigationSections.length;
          const nextSection = navigationSections[nextIndex];
          
          const element = nextSection.focusElement();
          if (element) {
            element.focus();
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Show a brief indicator of which section we're in
            const toast = document.createElement('div');
            toast.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity';
            toast.textContent = `Navigation: ${nextSection.name}`;
            document.body.appendChild(toast);
            
            setTimeout(() => {
              toast.style.opacity = '0';
              setTimeout(() => {
                if (document.body.contains(toast)) {
                  document.body.removeChild(toast);
                }
              }, 300);
            }, 1500);
          }
          
          return nextIndex;
        });
      }
      
      // Handle 'O' key for Quick Transaction Modal
      if (event.key.toLowerCase() === 'o' && 
          !['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName) &&
          !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault();
        setShowQuickTransactionModal(true);
        
        // Show a brief notification
        const toast = document.createElement('div');
        toast.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 transition-opacity';
        toast.textContent = '🚀 Quick Transaction Entry';
        document.body.appendChild(toast);
        
        setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => {
            if (document.body.contains(toast)) {
              document.body.removeChild(toast);
            }
          }, 300);
        }, 1500);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, []); // Remove currentSectionIndex from dependency array

  // Add useEffect to fetch dispatch logs when invoice date changes
  useEffect(() => {
    if (selectedLogDate) {
      fetchDispatchLogs(selectedLogDate);
    }
  }, [selectedLogDate]);

  // Auto-update amount paid for cash customers
  useEffect(() => {
    if (selectedCustomer && 
        selectedCustomer.opticalName && 
        selectedCustomer.opticalName.toUpperCase().includes('CASH CUSTOMER') &&
        paymentStatus === 'PAID') {
      const total = calculateTotal();
      setAmountPaid(total);
    }
  }, [selectedCustomer, paymentStatus, tableRows, discountValue, discountType, selectedTaxOption, frieghtCharge]);
  
  // Fetch shop information for the address
  const fetchShopInfo = async () => {
    try {
      // Use user-specific settings collection
      const shopSettingsDoc = await getDoc(getUserDoc('settings', 'shopSettings'));
      if (shopSettingsDoc.exists()) {
        setShopInfo(shopSettingsDoc.data());
      }
    } catch (error) {
      console.error('Error fetching shop info:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      
      // Fetch customers
      const customersRef = getUserCollection('customers');
      const customersQuery = query(customersRef, orderBy('opticalName'));
      const customersSnapshot = await getDocs(customersQuery);
      const customersList = customersSnapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      
      // Include customers marked as vendors (no need to fetch from global vendors collection)
      const customersAsVendors = customersList.filter(customer => 
        customer.isVendor || customer.type === 'vendor'
      ).map(customer => ({
        ...customer,
        type: 'vendor',
        isVendor: true
      }));
      
      // Merge all entities and remove duplicates by ID
      const allEntities = [...customersList, ...customersAsVendors];
      const uniqueEntities = allEntities.reduce((acc, entity) => {
        const existingIndex = acc.findIndex(e => e.id === entity.id);
        if (existingIndex >= 0) {
          // If entity exists, prefer vendor type if either is marked as vendor
          if (entity.isVendor || entity.type === 'vendor') {
            acc[existingIndex] = { ...acc[existingIndex], ...entity, type: 'vendor', isVendor: true };
          }
        } else {
          acc.push(entity);
        }
        return acc;
      }, []);
      
      // Sort by name
      uniqueEntities.sort((a, b) => {
        const nameA = a.opticalName || a.name || '';
        const nameB = b.opticalName || b.name || '';
        return nameA.toLowerCase().localeCompare(nameB.toLowerCase());
      });
      
      setCustomers(uniqueEntities);
    } catch (error) {
      console.error('Error fetching customers and vendors:', error);
      setError('Failed to fetch customers and vendors');
    } finally {
      setLoading(false);
    }
  };

  // Preview the next invoice number without incrementing the counter
  const previewNextInvoiceNumber = async () => {
    try {
      const { previewNextInvoiceNumber: getPreview } = await import('../utils/invoiceNumberingImproved');
      const preview = await getPreview();
      
      // Store both the display format and separated components
      setInvoiceNumber(preview.fullDisplay);
      setInvoicePrefix(preview.prefix);
      setInvoiceSimpleNumber(preview.paddedNumber);
    } catch (error) {
      console.error('Error previewing invoice number:', error);
      // Fallback preview
      setInvoiceNumber('PREVIEW-ERROR');
      setInvoicePrefix('2024-2025');
      setInvoiceSimpleNumber('01');
    }
  };

  // Generate actual invoice number and increment counter (only used when saving)
  const generateInvoiceNumberForSave = async () => {
    try {
      const { generateInvoiceNumber } = await import('../utils/invoiceNumberingImproved');
      const invoice = await generateInvoiceNumber();
      
      return invoice.fullDisplay;
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Fall back to the old method if there's an error
      try {
        const salesRef = getUserCollection('sales');
        const snapshot = await getDocs(salesRef);
        const newInvoiceNumber = `INV-${(snapshot.docs.length + 1).toString().padStart(4, '0')}`;
        return newInvoiceNumber;
      } catch (fallbackError) {
        console.error('Error in fallback invoice numbering:', fallbackError);
        return 'ERROR-GENERATING-NUMBER';
      }
    }
  };

  const handleCustomerSelect = async (customer) => {
    // Selected customer/vendor from search suggestions
    setSelectedCustomer(customer);
    if (customer) {
      setLoadingBalance(true);
      try {
        // Detect if this is a vendor and use appropriate balance calculation
        const entityIsVendor = customer.isVendor || customer.type === 'vendor';
        
        let currentBalance;
        if (entityIsVendor) {
          // Use vendor balance calculation
          currentBalance = await calculateVendorBalance(customer.id, customer.openingBalance || 0);
        } else {
          // Use customer balance calculation
          currentBalance = await calculateCustomerBalance(customer.id, customer.openingBalance || 0);
        }
        
        setCustomerBalance(currentBalance);
      } catch (error) {
        console.error('Error calculating balance:', error);
        // Fallback to opening balance
        setCustomerBalance(customer.openingBalance || 0);
      } finally {
        setLoadingBalance(false);
      }
    } else {
      setCustomerBalance(0);
    }
  };

  const handleAddNewCustomer = () => {
    setShowCustomerForm(true);
  };

  // Handle cash sale - auto-select cash customer
  const handleCashSale = async () => {
    try {
      setLoading(true);
      
      // Look for existing cash customer
      let cashCustomer = customers.find(customer => 
        customer.opticalName && customer.opticalName.toUpperCase().includes('CASH CUSTOMER')
      );
      
      // If no cash customer exists, create one
      if (!cashCustomer) {
        const cashCustomerData = {
          opticalName: 'CASH CUSTOMER',
          contactPerson: 'Walk-in Customer',
          phone: '',
          address: '',
          city: shopInfo?.city || '',
          state: shopInfo?.state || '',
          pincode: '',
          gstNumber: '',
          openingBalance: 0,
          createdAt: serverTimestamp(),
          isVendor: false,
          type: 'customer'
        };
        
        const docRef = await addDoc(getUserCollection('customers'), cashCustomerData);
        
        // Create the cash customer object with ID
        cashCustomer = {
          id: docRef.id,
          ...cashCustomerData
        };
        
        // Add to customers list
        setCustomers(prev => [...prev, cashCustomer]);
      }
      
      // Select the cash customer
      await handleCustomerSelect(cashCustomer);
      
      // Set payment status to PAID (since it's cash)
      setPaymentStatus('PAID');
      setAmountPaid(0); // Will be updated when total is calculated
      
    } catch (error) {
      console.error('Error setting up cash sale:', error);
      setError('Failed to set up cash sale: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerFormClose = (customerWasAdded) => {
    setShowCustomerForm(false);
    if (customerWasAdded) {
      // Refresh the customers list
      fetchCustomers();
    }
  };

  const fetchOrderDetails = async (orderId, rowIndex) => {
    try {
      if (!orderId) return;
      
      // First, try the exact display ID as entered
      let orderDoc = null;
      let snapshot = null;
      
      // Search in orders collection by displayId
      const ordersRef = getUserCollection('orders');
      const queryByDisplayId = query(ordersRef, where('displayId', '==', orderId));
      snapshot = await getDocs(queryByDisplayId);
      
      if (snapshot.empty) {
        const paddedDisplayId = orderId.toString().padStart(3, '0');
        
        let q = query(ordersRef, where('displayId', '==', paddedDisplayId));
        snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          return;
        }
      }
      
      if (!snapshot.empty) {
        orderDoc = snapshot.docs[0];

      if (orderDoc && orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() };
        
        // Calculate proper quantity in pairs
        let quantity = 1; // default
        const rightQty = parseInt(orderData.rightQty || 0);
        const leftQty = parseInt(orderData.leftQty || 0);
        
        // If both right and left are present, this is a pair
        if (rightQty > 0 && leftQty > 0) {
          // In optical terms, 1 right + 1 left = 1 pair
          // We take the maximum since you can't have a partial pair
          quantity = Math.max(rightQty, leftQty);
        } else {
          // If only one side is ordered, then count just that side
          quantity = Math.max(rightQty, leftQty);
        }
        
        // Ensure we have at least 1 quantity
        quantity = quantity || 1;
        
        // Update the row with order details
        const updatedRows = [...tableRows];
        updatedRows[rowIndex] = {
          ...updatedRows[rowIndex],
          // Use the displayId for showing in the UI
          orderId: orderData.displayId, 
          orderDetails: orderData,
          itemName: orderData.brandName || '',
          // Extract prescription from either the right or left eye and format it
          sph: formatOpticalValue(orderData.rightSph || orderData.leftSph || ''),
          cyl: formatOpticalValue(orderData.rightCyl || orderData.leftCyl || ''),
          axis: orderData.rightAxis || orderData.leftAxis || '', // No formatting for AXIS
          add: formatOpticalValue(orderData.rightAdd || orderData.leftAdd || ''),
          qty: quantity,
          unit: 'Pairs', // Always use 'Pairs' regardless of the unit in the order
          price: orderData.price || 0,
          total: (orderData.price || 0) * quantity
        };
        setTableRows(updatedRows);
        }
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  // New function to deduct lenses from inventory
  const deductLensesFromInventory = async (orderData) => {
    try {
      // Only proceed if we have an orderID
      if (!orderData || !orderData.id) {
        return;
      }
      
      // Check order status - only deduct from inventory for valid statuses
      const validStatuses = ['RECEIVED', 'DISPATCHED', 'DELIVERED'];
      if (!validStatuses.includes(orderData.status)) {
        return;
      }
      
      // First try searching by orderId
      const lensRef = getUserCollection('lensInventory');
      let q = query(lensRef, where('orderId', '==', orderData.id));
      let snapshot = await getDocs(q);
      
      // If no lenses found by orderId, try by orderDisplayId
      if (snapshot.empty && orderData.displayId) {
        q = query(lensRef, where('orderDisplayId', '==', orderData.displayId));
        snapshot = await getDocs(q);
        
        // Try with padded displayId too
        if (snapshot.empty) {
          const paddedDisplayId = orderData.displayId.toString().padStart(3, '0');
          q = query(lensRef, where('orderDisplayId', '==', paddedDisplayId));
          snapshot = await getDocs(q);
        }
      }
      
      if (snapshot.empty) {
        return;
      }
      
      // Process each lens in inventory
      const batch = [];
      snapshot.docs.forEach(lensDoc => {
        const lens = lensDoc.data();
        const lensId = lensDoc.id;
        
        // Determine if we should deduct or delete
        if (lens.qty > 1) {
          // Deduct one from the quantity
          batch.push({
            id: lensId,
            action: 'update',
            data: {
              qty: lens.qty - 1,
              updatedAt: Timestamp.fromDate(new Date())
            }
          });
        } else {
          // Remove the lens from inventory if qty is 1 or less
          batch.push({
            id: lensId,
            action: 'delete'
          });
        }
      });
      
      // Execute all updates/deletes
      for (const operation of batch) {
        const lensDocRef = getUserDoc('lensInventory', operation.id);
        
        if (operation.action === 'update') {
          await updateDoc(lensDocRef, operation.data);
        } else if (operation.action === 'delete') {
          await deleteDoc(lensDocRef);
        }
      }
      
      
    } catch (error) {
      console.error('Error deducting lenses from inventory:', error);
    }
  };

  const handleTableRowChange = (index, field, value) => {
    const updatedRows = [...tableRows];
    
    // Format SPH, CYL, and ADD values when they're changed
    if (field === 'sph' || field === 'cyl' || field === 'add') {
      // Only format when the field loses focus or user presses Enter
      updatedRows[index] = {
        ...updatedRows[index],
        [field]: value
      };
    } else {
      updatedRows[index] = {
        ...updatedRows[index],
        [field]: value
      };
    }

    // Handle unit change - if changed to Service, clear optical values and set service flags
    if (field === 'unit' && value === 'Service') {
      updatedRows[index] = {
        ...updatedRows[index],
        isService: true,
        type: 'service',
        sph: '',
        cyl: '',
        axis: '',
        add: ''
      };
    } else if (field === 'unit' && value !== 'Service') {
      // If unit changed from Service to something else, remove service flags
      updatedRows[index] = {
        ...updatedRows[index],
        isService: false,
        type: ''
      };
    }

    // Recalculate total for the row if price or qty changes
    if (field === 'price' || field === 'qty') {
      updatedRows[index].total = 
        parseFloat(updatedRows[index].price || 0) * 
        parseFloat(updatedRows[index].qty || 0);
      
      // Save item to database when price is updated and we have an item name
      if (field === 'price' && updatedRows[index].itemName.trim() !== '') {
        saveItemToDatabase(updatedRows[index].itemName, value);
      }
    }

    setTableRows(updatedRows);
  };
  
  // Format SPH, CYL, and ADD when the field loses focus
  const handleOpticalValueBlur = (index, field, value) => {
    const formattedValue = formatOpticalValue(value);
    const updatedRows = [...tableRows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: formattedValue
    };
    setTableRows(updatedRows);
    
    // Validate power range for SPH and CYL
    if (field === 'sph' || field === 'cyl') {
      validatePowerRange(index, field, formattedValue);
    }
  };

  // Function to register payment transaction in ledger
  const registerPaymentTransaction = async (customer, amountPaid, invoiceNumber, saleId) => {
    try {

      
      // Determine transaction type based on customer/vendor
      const isVendorEntity = customer.isVendor || customer.type === 'vendor';
      const transactionType = isVendorEntity ? 'paid' : 'received';
      
      const transactionData = {
        entityId: customer.id,
        entityName: customer.opticalName,
        entityType: isVendorEntity ? 'vendor' : 'customer',
        type: transactionType,
        amount: amountPaid,
        date: new Date(invoiceDate),
        description: `Payment ${transactionType === 'received' ? 'received from' : 'made to'} ${customer.opticalName} for Invoice ${invoiceNumber}`,
        invoiceId: saleId,
        invoiceNumber: invoiceNumber,
        paymentMethod: 'cash', // Default to cash, could be made configurable
        createdAt: serverTimestamp(),
        createdBy: 'system', // Could be replaced with actual user info
        source: 'sale_creation'
      };
      
      await addDoc(getUserCollection('transactions'), transactionData);

      
    } catch (error) {
      console.error('Error registering payment transaction:', error);
      // Don't throw error to prevent sale creation from failing
              // Sale was created successfully, but payment transaction registration failed
    }
  };

  const handleSaveSale = async () => {
    if (!selectedCustomer || !selectedCustomer.id) {
      setError('Please select a customer');
      return;
    }

    const filledRows = tableRows.filter(row => row.total > 0);
    if (filledRows.length === 0) {
      setError('Please add at least one item to the invoice');
      return;
    }

    try {
      setLoading(true);
      setError('');



      // Generate the actual invoice number only when saving
      const finalInvoiceNumber = await generateInvoiceNumberForSave();

      // Create sale document
      const saleData = {
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.opticalName || selectedCustomer.name || '',
        customerAddress: selectedCustomer.address || '',
        customerCity: selectedCustomer.city || '',
        customerState: selectedCustomer.state || '',
        phone: selectedCustomer.phone || '', // Add phone number from customer
        gstNumber: selectedCustomer.gstNumber || '',
        invoiceNumber: finalInvoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        items: filledRows.map(row => {
          // Make sure SPH, CYL, and ADD are properly formatted for each item
          const formattedRow = {
            ...row,
            sph: formatOpticalValue(row.sph),
            cyl: formatOpticalValue(row.cyl),
            add: formatOpticalValue(row.add)
            // AXIS is not formatted, keeping the original value
          };
          
          return {
            orderId: formattedRow.orderId,
            itemName: formattedRow.itemName,
            sph: formattedRow.sph,
            cyl: formattedRow.cyl,
            axis: formattedRow.axis, // Using original AXIS value
            add: formattedRow.add,
            qty: parseFloat(formattedRow.qty),
            unit: formattedRow.unit,
            price: parseFloat(formattedRow.price),
            total: parseFloat(formattedRow.total)
          };
        }),
        subtotal: calculateSubtotal(),
        discountType,
        discountValue: parseFloat(discountValue || 0),
        discountAmount: calculateDiscountAmount(),
        taxOption: selectedTaxOption,
        taxRate: getTaxOption(selectedTaxOption).rate,
        taxAmount: calculateTaxAmount(),
        frieghtCharge: parseFloat(frieghtCharge || 0),
        totalAmount: calculateTotal(),
        amountPaid: parseFloat(amountPaid || 0),
        balanceDue: calculateTotal() - parseFloat(amountPaid || 0),
        paymentStatus,
        notes,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(getUserCollection('sales'), saleData);
      
      // Update the invoice number state for UI display (this is the actual saved number)
      setInvoiceNumber(finalInvoiceNumber);
      
      // Register payment in ledger if amountPaid > 0
      if (parseFloat(amountPaid || 0) > 0) {
        await registerPaymentTransaction(selectedCustomer, parseFloat(amountPaid), finalInvoiceNumber, docRef.id);
      }
      
      // Process all order IDs to mark lenses as sold in inventory
      await processOrderIdsForInventory(filledRows);
      
      // Also deduct any inventory items that match the sold items
      await deductInventoryItems(filledRows);
      
      setSavedSaleId(docRef.id);
      setShowSuccessModal(true);
      setSuccess(true);
    } catch (error) {
      console.error('Error saving sale:', error);
      setError('Failed to save sale. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // New function to process order IDs from the sale items
  const processOrderIdsForInventory = async (saleItems) => {
    try {
      // Collect order IDs from items
      const orderIds = saleItems
        .filter(item => item.orderId && item.orderId.trim() !== '')
        .map(item => item.orderId);
      
      if (orderIds.length === 0) {
        return;
      }
      
      // For each order ID, find the actual order document
      for (const displayId of orderIds) {
        try {
          // Find the order by displayId using multi-tenant collection
          const ordersRef = getUserCollection('orders');
          const q = query(ordersRef, where('displayId', '==', displayId));
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            // Try with padding to see if that helps
            const paddedDisplayId = displayId.toString().padStart(3, '0');
            
            const q2 = query(ordersRef, where('displayId', '==', paddedDisplayId));
            const snapshot2 = await getDocs(q2);
            
            if (snapshot2.empty) {
              continue;
            } else {
              const orderDoc = snapshot2.docs[0];
              const orderData = { id: orderDoc.id, ...orderDoc.data() };
              
              // Skip orders with invalid statuses
              const invalidStatuses = ['PENDING', 'PLACED', 'CANCELLED', 'DECLINED'];
              if (invalidStatuses.includes(orderData.status)) {
  
                continue;
              }
              
              // Mark this order as DELIVERED in the orders collection using multi-tenant reference
              await updateDoc(getUserDoc('orders', orderData.id), {
                status: 'DELIVERED',
                updatedAt: serverTimestamp()
              });

              
              // Deduct lenses from inventory
              await deductLensesFromInventory(orderData);
              

              continue; // Skip to next order since we found this one with padding
            }
          }
          
          const orderDoc = snapshot.docs[0];
          const orderData = { id: orderDoc.id, ...orderDoc.data() };
          

          
          // Skip orders with invalid statuses
          const invalidStatuses = ['PENDING', 'PLACED', 'CANCELLED', 'DECLINED'];
          if (invalidStatuses.includes(orderData.status)) {

            continue;
          }
          
          // Mark this order as DELIVERED in the orders collection using multi-tenant reference
          await updateDoc(getUserDoc('orders', orderData.id), {
            status: 'DELIVERED',
            updatedAt: serverTimestamp()
          });

          
          // Deduct lenses from inventory
          await deductLensesFromInventory(orderData);
          

        } catch (error) {
          console.error(`Error processing order ID ${displayId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error processing order IDs for inventory:', error);
    }
  };

  // New comprehensive function to deduct inventory items
  const deductInventoryItems = async (saleItems) => {
    try {
      // First, handle stock lens power deductions (NEW FEATURE - for individual powers)
      for (const item of saleItems) {
        // Check if this is a stock lens with power selection
        if (item.lensType === 'stockLens' && item.lensId && item.powerKey && item.pieceQuantity) {

          
          try {
            // Get the current lens document
            const lensDocRef = getUserDoc('lensInventory', item.lensId);
            const lensDoc = await getDoc(lensDocRef);
            
            if (!lensDoc.exists()) {
              // Lens document not found
              continue;
            }
            
            const lensData = lensDoc.data();
            
            if (!lensData.powerInventory || !lensData.powerInventory[item.powerKey]) {
              // Power not found in lens inventory
              continue;
            }
            
            const currentPowerQty = parseInt(lensData.powerInventory[item.powerKey].quantity) || 0;
            const qtyToDeduct = parseInt(item.pieceQuantity) || 0;
            
            if (currentPowerQty < qtyToDeduct) {
              // Insufficient stock for power
              continue;
            }
            
            const newPowerQty = currentPowerQty - qtyToDeduct;
            
            // Update power inventory
            const updatedPowerInventory = { ...lensData.powerInventory };
            updatedPowerInventory[item.powerKey] = {
              ...updatedPowerInventory[item.powerKey],
              quantity: newPowerQty
            };
            
            // Recalculate total quantity
            const newTotalQuantity = Object.values(updatedPowerInventory)
              .reduce((sum, power) => sum + (parseInt(power.quantity) || 0), 0);
            
            // Update the lens document
            await updateDoc(lensDocRef, {
              powerInventory: updatedPowerInventory,
              totalQuantity: newTotalQuantity,
              updatedAt: Timestamp.fromDate(new Date())
            });
            

            
          } catch (error) {
            console.error(`❌ Error deducting stock lens power ${item.powerKey} from lens ${item.lensId}:`, error);
            throw error;
          }
        }
      }
      
      // Now handle regular inventory deduction (skip stock lens power items)
      for (const item of saleItems) {
        try {
          // Skip items with order IDs as they are handled by processOrderIdsForInventory
          if (item.orderId && item.orderId.trim() !== '') {
            continue;
          }
          
          // Skip stock lenses with power selection as they're already handled above
          if (item.lensType === 'stockLens' && item.lensId && item.powerKey) {
            continue;
          }
          
          // Skip services - they shouldn't be deducted from inventory
          // Check multiple ways services can be identified
          const isServiceItem = item.isService || 
                              item.type === 'service' || 
                              item.unit === 'Service' || 
                              item.unit === 'service' ||
                              (item.itemName && item.itemName.toLowerCase().includes('service')) ||
                              (item.serviceData && Object.keys(item.serviceData).length > 0);
          
          if (isServiceItem) {

            continue;
          }
          
          // Validate item has necessary data
          if (!item.itemName || item.itemName.trim() === '') {
            continue;
          }
          
          if (!item.qty || parseFloat(item.qty) <= 0) {
            continue;
          }
          
          // Search for matching items in lensInventory using multi-tenant collection
          const lensRef = getUserCollection('lensInventory');
          let matchingLenses = [];
          
          // Method 1: Try to find exact matches by brand name
          if (item.itemName && item.itemName.trim() !== '') {
            const brandQuery = query(lensRef, where('brandName', '==', item.itemName.trim()));
            const brandSnapshot = await getDocs(brandQuery);
            
            brandSnapshot.docs.forEach(doc => {
              const lensData = doc.data();
              
              // Skip lenses that are hidden from inventory (created via AddNewProductModal for suggestions only)
              if (lensData.hiddenFromInventory || lensData.createdForSale) {
                return;
              }
              
              // Skip lenses with zero or negative quantity
              if (parseFloat(lensData.qty || 0) <= 0) {
                return;
              }
              
              matchingLenses.push({
                id: doc.id,
                ...lensData
              });
            });
          }
          
                      // Method 2: If no matches by brand name, try searching by service name for services
            if (matchingLenses.length === 0 && item.itemName && item.itemName.trim() !== '') {
              const serviceQuery = query(lensRef, where('serviceName', '==', item.itemName.trim()));
              const serviceSnapshot = await getDocs(serviceQuery);
              
              serviceSnapshot.docs.forEach(doc => {
                const lensData = doc.data();
                
                // Skip lenses that are hidden from inventory (created via AddNewProductModal for suggestions only)
                if (lensData.hiddenFromInventory || lensData.createdForSale) {
                  return;
                }
                
                // Skip lenses with zero or negative quantity
                if (parseFloat(lensData.qty || 0) <= 0) {
                  return;
                }
                
                matchingLenses.push({
                  id: doc.id,
                  ...lensData
                });
              });
            }
          
                      // Method 2.5: If no matches by service name, try searching by item name for general items
            if (matchingLenses.length === 0 && item.itemName && item.itemName.trim() !== '') {
              const itemQuery = query(lensRef, where('itemName', '==', item.itemName.trim()));
              const itemSnapshot = await getDocs(itemQuery);
              
              itemSnapshot.docs.forEach(doc => {
                const lensData = doc.data();
                
                // Skip lenses that are hidden from inventory (created via AddNewProductModal for suggestions only)
                if (lensData.hiddenFromInventory || lensData.createdForSale) {
                  return;
                }
                
                // Skip lenses with zero or negative quantity
                if (parseFloat(lensData.qty || 0) <= 0) {
                  return;
                }
                
                matchingLenses.push({
                  id: doc.id,
                  ...lensData
                });
              });
            }
          
                      // Method 3: If we have prescription details, try to match RX lenses
            if (matchingLenses.length === 0 && (item.sph || item.cyl)) {
              // Get all prescription lenses
              const rxQuery = query(lensRef, where('type', '==', 'prescription'));
              const rxSnapshot = await getDocs(rxQuery);
              
              rxSnapshot.docs.forEach(doc => {
                const lensData = doc.data();
                
                // Skip lenses that are hidden from inventory (created via AddNewProductModal for suggestions only)
                if (lensData.hiddenFromInventory || lensData.createdForSale) {
                  return;
                }
                
                // Skip lenses with zero or negative quantity
                if (parseFloat(lensData.qty || 0) <= 0) {
                  return;
                }
                
                // Check if prescription matches (with some tolerance)
                const sphMatch = !item.sph || !lensData.sph || Math.abs(parseFloat(item.sph) - parseFloat(lensData.sph)) <= 0.25;
                const cylMatch = !item.cyl || !lensData.cyl || Math.abs(parseFloat(item.cyl) - parseFloat(lensData.cyl)) <= 0.25;
                
                // Also check brand name if provided
                const brandMatch = !item.itemName || !lensData.brandName || 
                                 lensData.brandName.toLowerCase().includes(item.itemName.toLowerCase()) ||
                                 item.itemName.toLowerCase().includes(lensData.brandName.toLowerCase());
                
                if (sphMatch && cylMatch && brandMatch) {
                  matchingLenses.push({
                    id: doc.id,
                    ...lensData
                  });
                }
              });
            }
          
                      // Method 4: Try partial name matching for other inventory types
            if (matchingLenses.length === 0) {
              const allQuery = query(lensRef);
              const allSnapshot = await getDocs(allQuery);
              
              const searchTerm = item.itemName.toLowerCase().trim();
              allSnapshot.docs.forEach(doc => {
                const lensData = doc.data();
                
                // Skip lenses that are hidden from inventory (created via AddNewProductModal for suggestions only)
                if (lensData.hiddenFromInventory || lensData.createdForSale) {
                  return;
                }
                
                // Skip lenses with zero or negative quantity
                if (parseFloat(lensData.qty || 0) <= 0) {
                  return;
                }
                
                const brandName = (lensData.brandName || '').toLowerCase();
                const serviceName = (lensData.serviceName || '').toLowerCase();
                const itemName = (lensData.itemName || '').toLowerCase(); // Support for Items type
                
                if (brandName.includes(searchTerm) || searchTerm.includes(brandName) ||
                    serviceName.includes(searchTerm) || searchTerm.includes(serviceName) ||
                    itemName.includes(searchTerm) || searchTerm.includes(itemName)) {
                  matchingLenses.push({
                    id: doc.id,
                    ...lensData
                  });
                }
              });
            }
          
          if (matchingLenses.length === 0) {
            continue;
          }
          
          // Deduct the sold quantity from matching lenses
          let remainingQtyToDeduct = parseFloat(item.qty) || 1;
          
          for (const lens of matchingLenses) {
            if (remainingQtyToDeduct <= 0) {
              break;
            }
            
            const currentQty = parseFloat(lens.qty) || 0;
            
            if (currentQty <= 0) {
              continue;
            }
            
            const qtyToDeductFromThisLens = Math.min(remainingQtyToDeduct, currentQty);
            const newQty = currentQty - qtyToDeductFromThisLens;
            
            try {
              // Always update the quantity, even if it goes negative
              await updateDoc(getUserDoc('lensInventory', lens.id), {
                qty: newQty,
                updatedAt: Timestamp.fromDate(new Date())
              });
              
              remainingQtyToDeduct -= qtyToDeductFromThisLens;
            
          } catch (dbError) {
            console.error(`❌ Database error updating lens ${lens.id}:`, dbError);
            throw dbError; // Re-throw to be caught by outer try-catch
          }
        }
        
        
        
      } catch (itemError) {
        console.error(`❌ Error processing inventory for item "${item.itemName}":`, itemError);
        // Don't throw error for individual items - continue processing others
      }
    }
    
    
    
  } catch (error) {
    console.error('❌ Critical error in deductInventoryItems:', error);
    throw error; // Re-throw critical errors
  }
};

  const handlePrintBill = () => {
    if (savedSaleId) {
      // Use the PrintInvoiceModal component for printing
      setShowPrintModal(true);
      setHasPrintedInvoice(true);
      // Clear any previous errors when opening print
      setError('');
    } else {
      console.error('No sale ID found for printing');
      setError('No sale ID found. Please save the invoice first.');
      alert('Error: Cannot print - No sale ID found. Please save the invoice first.');
    }
  };

  // Enhanced print function with auto-close modal option
  const handleQuickPrint = () => {
    if (savedSaleId) {
      // Keep success modal open and also open print modal
      setShowPrintModal(true);
      setHasPrintedInvoice(true);
      
      // Use a timeout to allow modal to render, then trigger quick print
      setTimeout(() => {
        // The FallbackInvoicePrint component will handle auto-close
      }, 100);
    }
  };

  // Alternative print method - opens sale detail in new window
  const handlePrintBillAlternative = () => {
    if (savedSaleId) {
      // Open the sale detail page in a new window for printing
      const printUrl = `/sales/${savedSaleId}`;
      const printWindow = window.open(printUrl, '_blank');
      
      // Auto-trigger print dialog after page loads
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 1000);
        };
      }
    } else {
      console.error('No sale ID found for printing');
      alert('Error: Cannot print - No sale ID found. Please save the invoice first.');
    }
  };

  const resetForm = () => {
    setSelectedCustomer(null);
    setCustomerBalance(0);
    setInvoiceNumber('');
    setInvoicePrefix('');
    setInvoiceSimpleNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setDueDate('');
    setSelectedTaxOption(TAX_OPTIONS[0].id);
    setDiscountType('amount');
    setDiscountValue(0);
    setFrieghtCharge(0);
    setNotes('');
    setPaymentStatus('UNPAID');
    setAmountPaid(0);
    setTableRows(Array(5).fill().map(() => ({
      orderId: '',
      orderDetails: null,
      itemName: '',
      sph: '',
      cyl: '',
      axis: '',
      add: '',
      qty: 1,
      unit: 'Pairs',
      price: '',
      total: 0
    })));
    setSelectedStockPowers({});
    setPowerRangeWarnings({});
    setError('');
    setHasPrintedInvoice(false);
    previewNextInvoiceNumber();
  };

  const handleSendWhatsApp = () => {
    if (!selectedCustomer) {
      alert('Please select a customer first.');
      return;
    }
    
    if (!selectedCustomer.phone) {
      alert(`No phone number found for ${selectedCustomer.opticalName || 'this customer'}. Please add a phone number to the customer record.`);
      return;
    }
    
    const phone = selectedCustomer.phone.replace(/[^0-9+]/g, '');
    
    if (phone.length < 10) {
      alert('Invalid phone number format. Please check the customer\'s phone number.');
      return;
    }
    
    const total = calculateTotal().toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR'
    });
    
    const customerName = (selectedCustomer.opticalName || 'Customer').replace(/[^\w\s]/g, '');
    const safeInvoiceNumber = (invoiceNumber || 'N/A').replace(/[^\w\s-]/g, '');
    
    const message = 
      `*Invoice from PRISM OPTICAL*\n\n` +
      `Dear ${customerName},\n\n` +
      `Your invoice ${safeInvoiceNumber} has been generated with amount ${total}.\n\n` +
      `Thank you for your business!\n` +
      `For any questions, please contact us.`;
    
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    
    try {
      window.open(whatsappUrl, '_blank');
    } catch (error) {
      console.error('Error opening WhatsApp:', error);
      alert('Could not open WhatsApp. Please check if your browser allows popups.');
    }
  };

  // Format currency for display - use the utility function
  const formatCurrency = (amount) => {
    return formatCurrencyUtil(amount);
  };

  // Get visible rows based on current state
  const getVisibleRows = () => {
    if (showAllRows) {
      return tableRows;
    }
    return tableRows.slice(0, displayRowCount);
  };

  // Add function to fetch saved items
  const fetchItems = async () => {
    try {
      // Only fetch items from 'lensInventory' collection to restrict suggestions using multi-tenant collection
      const lensRef = getUserCollection('lensInventory');
      const allSnapshot = await getDocs(lensRef);
      
      // Process all items from lens_inventory - NO DEDUPLICATION to show all variants
      const itemsList = [];
      
      // Process all items from lens_inventory - Include ALL items regardless of quantity
      allSnapshot.docs.forEach(doc => {
        const lens = { id: doc.id, ...doc.data() };
        
        // Skip only placeholder documents
        if (lens._placeholder) {
          return;
        }
        
        // Include ALL items for suggestions, even those hidden from inventory
        // (hiddenFromInventory RX lenses are still available for suggestions)
        
        let itemName = '';
        let displayName = '';
        let itemPrice = 0;
        
        // Determine item name and price based on lens type
        if (lens.type === 'stock') {
          // For stock lenses, show full name with power series for distinction
          itemName = lens.brandName || '';
          displayName = lens.powerSeries ? `${lens.brandName} (${lens.powerSeries})` : lens.brandName;
          itemPrice = lens.salePrice || 0;
        } else if (lens.type === 'service') {
          itemName = lens.serviceName || lens.brandName || '';
          displayName = itemName;
          itemPrice = lens.salePrice || lens.servicePrice || 0;
        } else if (lens.type === 'prescription') {
          itemName = lens.brandName || '';
          displayName = itemName;
          itemPrice = lens.salePrice || 0;
        } else if (lens.type === 'contact') {
          // For contact lenses, show full name with power series for distinction
          itemName = lens.brandName || '';
          displayName = lens.powerSeries ? `${lens.brandName} (${lens.powerSeries})` : lens.brandName;
          itemPrice = lens.salePrice || 0;
        } else if (lens.type === 'item') {
          // For general optical items (frames, boxes, accessories, etc.)
          itemName = lens.itemName || lens.brandName || '';
          displayName = itemName;
          itemPrice = lens.salePrice || lens.price || 0;
        }
        
        // Include ALL items with a name, regardless of quantity (even 0 or negative)
        if (itemName.trim()) {
          itemsList.push({
            id: lens.id,
            name: displayName, // Full display name with power series
            itemName: itemName, // Clean brand name for form fields
            price: itemPrice,
            qty: lens.qty || lens.totalQuantity || 0, // Include quantity info for display
            createdAt: lens.createdAt,
            isStockLens: lens.type === 'stock',
            isService: lens.type === 'service',
            isContactLens: lens.type === 'contact',
            isPrescription: lens.type === 'prescription',
            isItem: lens.type === 'item',
            stockData: lens.type === 'stock' ? lens : null,
            serviceData: lens.type === 'service' ? lens : null,
            contactData: lens.type === 'contact' ? lens : null,
            prescriptionData: lens.type === 'prescription' ? lens : null,
            itemData: lens.type === 'item' ? lens : null,
            // Store powerSeries and additional lens details
            powerSeries: lens.powerSeries || '',
            maxSph: lens.maxSph,
            maxCyl: lens.maxCyl,
            type: lens.type,
            brandName: lens.brandName,
            // Additional fields for proper identification
            material: lens.material,
            index: lens.index,
            axis: lens.axis,
            lensType: lens.lensType,
            // Item-specific fields
            category: lens.category,
            brand: lens.brand,
            unit: lens.unit
          });
        }
      });
      
      // Sort by display name (with power series) and then by price
      itemsList.sort((a, b) => {
        const nameCompare = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        if (nameCompare !== 0) return nameCompare;
        return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
      });
      
      setItemSuggestions(itemsList);

    } catch (error) {
      console.error('Error fetching items:', error);
    }
  };

  // Add new function to save item to Firebase - completely replace all items with this name
  const saveItemToDatabase = async (itemName, price) => {
    if (!itemName.trim()) return;
    
    try {
      const normalizedName = itemName.trim();
      const itemsRef = getUserCollection('items');
      
      // First check if item with this name already exists
      const q = query(itemsRef, where('name', '==', normalizedName));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        // Create new item
        await addDoc(itemsRef, {
          name: normalizedName,
          price: parseFloat(price) || 0,
          createdAt: serverTimestamp()
        });
      } else {
        // Update existing item
        const existingItem = snapshot.docs[0];
        await updateDoc(getUserDoc('items', existingItem.id), {
          price: parseFloat(price) || 0,
          updatedAt: serverTimestamp()
        });
      }
      
      // Refresh items list
      await fetchItems();
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  // Handle item selection from the ItemSuggestions component
  const handleItemSelect = (index, itemData) => {
    // Get the price - prioritize the main price field that ItemSuggestions passes
    let itemPrice = parseFloat(itemData.price || 0);
    
    // If no price in main field, try service-specific fields
    if (itemPrice === 0 && itemData.isService && itemData.serviceData) {
      itemPrice = parseFloat(
        itemData.serviceData.salePrice || 
        itemData.serviceData.servicePrice || 
        0
      );
    }
    
    // If still no price, try stock lens fields
    if (itemPrice === 0 && itemData.isStockLens && itemData.stockData) {
      itemPrice = parseFloat(itemData.stockData.salePrice || 0);
    }
    
    // If still no price, try item-specific fields
    if (itemPrice === 0 && itemData.isItem && itemData.itemData) {
      itemPrice = parseFloat(
        itemData.itemData.salePrice || 
        itemData.itemData.price || 
        0
      );
    }
    
    // Update the rows directly to ensure the full item name is set
    const updatedRows = [...tableRows];
    const currentRow = updatedRows[index];
    
    // Extract proper item name based on type - prioritize the display name from suggestions
    let cleanItemName = '';
    
    // First priority: use the display name from the suggestion (this is what user saw and selected)
    if (itemData.name && itemData.name.trim()) {
      cleanItemName = itemData.name.trim();
    }
    // Second priority: use itemName field
    else if (itemData.itemName && itemData.itemName.trim()) {
      cleanItemName = itemData.itemName.trim();
    }
    // Third priority: use brandName
    else if (itemData.brandName && itemData.brandName.trim()) {
      cleanItemName = itemData.brandName.trim();
    }
    
    // For services, prioritize serviceName if available
    if (itemData.isService && itemData.serviceData && itemData.serviceData.serviceName) {
      cleanItemName = itemData.serviceData.serviceName.trim();
    }
    
    // For items, prioritize itemName from itemData if available
    if (itemData.isItem && itemData.itemData && itemData.itemData.itemName) {
      cleanItemName = itemData.itemData.itemName.trim();
    }
    
    // Remove any power series info from display name for cleaner item names
    // Only remove parenthetical content that looks like power ranges, not service names
    if (cleanItemName.includes('(') && cleanItemName.includes(')')) {
      // Check if the parenthetical content looks like power range (contains numbers or "to")
      const parentheticalContent = cleanItemName.match(/\(([^)]+)\)/);
      if (parentheticalContent && parentheticalContent[1]) {
        const content = parentheticalContent[1].toLowerCase();
        // Only remove if it looks like power range: contains numbers, "to", "+", "-", "D", "sph", "cyl"
        const isPowerRange = /[\d\+\-]|to|sph|cyl|axis|add|progressive|bifocal/i.test(content);
        
        if (isPowerRange) {
          const baseItemName = cleanItemName.split('(')[0].trim();
          // Only use base name if it's not too short and the original was clearly a power range
          if (baseItemName.length >= 3) {
            cleanItemName = baseItemName;
          }
        }
        // For service names like "full frame fitting", keep the full name
      }
    }
    
    // Fallback to ensure we have some name
    if (!cleanItemName) {
      cleanItemName = itemData.name || itemData.itemName || itemData.brandName || '';
    }
    
    // Check if this is a re-selection of the same item (like from dispatch import)
    const isSameItem = currentRow.itemName && (
      currentRow.itemName.toLowerCase().trim() === cleanItemName.toLowerCase().trim() ||
      currentRow.itemName.toLowerCase().includes(cleanItemName.toLowerCase()) ||
      cleanItemName.toLowerCase().includes(currentRow.itemName.toLowerCase())
    );
    
    // Preserve existing power values if this is the same item and they already exist
    const preservePowerValues = isSameItem && (
      currentRow.sph || currentRow.cyl || currentRow.axis || currentRow.add
    );
    
    // Preserve existing quantity if it's different from default
    const preserveQuantity = isSameItem && currentRow.qty && currentRow.qty !== 1;
    
    // Ensure the item name is set to the clean name
    updatedRows[index] = {
      ...updatedRows[index],
      itemName: cleanItemName.trim()
    };
    
    // Preserve quantity if it was already set
    if (preserveQuantity) {
      // Keep existing quantity
    } else if (currentRow.qty && currentRow.qty !== 1) {
      // Keep existing quantity if it's different from default
    } else {
      // Set default quantity
      updatedRows[index].qty = 1;
    }
    
    // Set the price if available
    if (itemPrice > 0) {
      updatedRows[index].price = itemPrice.toString();
      // Recalculate total with current quantity
      updatedRows[index].total = itemPrice * parseFloat(updatedRows[index].qty || 1);
    }
    
    // Set appropriate unit for services and store service flag
    if (itemData.isService || itemData.type === 'service') {
      updatedRows[index].unit = 'Service';
      updatedRows[index].isService = true; // Explicitly set the service flag
      updatedRows[index].type = 'service'; // Also set the type for consistency
      // Clear optical values for services as they don't apply (don't preserve for services)
      updatedRows[index].sph = '';
      updatedRows[index].cyl = '';
      updatedRows[index].axis = '';
      updatedRows[index].add = '';
    } else if (itemData.isItem || itemData.type === 'item') {
      // For general optical items, set appropriate unit and flags
      updatedRows[index].unit = itemData.unit || itemData.itemData?.unit || 'Pieces';
      updatedRows[index].isItem = true; // Set the item flag
      updatedRows[index].type = 'item'; // Set the type for consistency
      // Clear optical values for items as they don't apply
      updatedRows[index].sph = '';
      updatedRows[index].cyl = '';
      updatedRows[index].axis = '';
      updatedRows[index].add = '';
    } else {
      // For lenses (stock, prescription, contact), set unit to Pairs
      updatedRows[index].unit = 'Pairs';
    }
    
    // Store lens data for stock lenses - check multiple ways to identify stock lenses
    const isStockLens = itemData.isStockLens || 
                       (itemData.maxSph || itemData.maxCyl) || 
                       (itemData.stockData && (itemData.stockData.maxSph || itemData.stockData.maxCyl));
    
    if (isStockLens) {
      // Store power series from various sources
      updatedRows[index].powerSeries = itemData.powerSeries || 
                                      (itemData.stockData && itemData.stockData.powerSeries) || '';
      
      // Store complete lens data for modal use and power range validation
      updatedRows[index].stockLensData = itemData;
      
      // Also store power range values directly in the row for easy access
      updatedRows[index].maxSph = itemData.maxSph || (itemData.stockData && itemData.stockData.maxSph) || '';
      updatedRows[index].maxCyl = itemData.maxCyl || (itemData.stockData && itemData.stockData.maxCyl) || '';
      updatedRows[index].maxAxis = itemData.maxAxis || (itemData.stockData && itemData.stockData.maxAxis) || '';
      updatedRows[index].maxAdd = itemData.maxAdd || (itemData.stockData && itemData.stockData.maxAdd) || '';
      
      // For stock lenses with PowerSelectionModal, only clear optical values if they weren't preserved
      if (itemData.isStockLens && itemData.stockData && !preservePowerValues) {
        updatedRows[index].sph = '';
        updatedRows[index].cyl = '';
        updatedRows[index].axis = '';
        updatedRows[index].add = '';
      }
      
      // Clear any existing power range warnings for this row
      setPowerRangeWarnings(prev => {
        const newWarnings = { ...prev };
        delete newWarnings[index];
        return newWarnings;
      });
    } else {
      // For non-stock lenses, preserve power values if it's the same item
      if (!preservePowerValues) {
        // Only clear if not preserving
        delete updatedRows[index].stockLensData;
        delete updatedRows[index].maxSph;
        delete updatedRows[index].maxCyl;
        delete updatedRows[index].maxAxis;
        delete updatedRows[index].maxAdd;
      } else {
        // Store power range data for validation even for non-stock lenses
        if (itemData.sph || itemData.cyl || itemData.axis || itemData.add) {
          updatedRows[index].maxSph = itemData.sph || '';
          updatedRows[index].maxCyl = itemData.cyl || '';
          updatedRows[index].maxAxis = itemData.axis || '';
          updatedRows[index].maxAdd = itemData.add || '';
        }
      }
      
      setPowerRangeWarnings(prev => {
        const newWarnings = { ...prev };
        delete newWarnings[index];
        return newWarnings;
      });
    }
    
    // Update the table with all changes at once
    setTableRows(updatedRows);
    
    // Auto-focus the power selection button for stock lenses with PowerSelectionModal after a short delay
    // But only if this is not a re-selection of the same item
    if (itemData.isStockLens && itemData.stockData && !preservePowerValues) {
      setTimeout(() => {
        const powerButton = document.querySelector(`[data-power-button="${index}"]`);
        if (powerButton) {
          powerButton.focus();
          powerButton.classList.add('animate-pulse');
          setTimeout(() => {
            powerButton.classList.remove('animate-pulse');
          }, 2000);
        }
      }, 100);
    }
  };

  // Add function to fetch dispatch logs
  const fetchDispatchLogs = async (date) => {
    try {
      const dispatchRef = getUserCollection('dispatchLogs');
      
      // Query for dispatch logs with the specific date
      const dateQuery = query(dispatchRef, where('date', '==', date));
      const snapshot = await getDocs(dateQuery);
      
      if (snapshot.empty) {
        // If no logs found for the specific date, set empty array
        setDispatchLogs([]);
      } else {
        // Filter out placeholder documents and return only logs for the specific date
        const logsList = snapshot.docs
          .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(log => log.date === date); // Double-check date filtering
        
        setDispatchLogs(logsList);
      }
    } catch (error) {
      console.error('Error fetching dispatch logs:', error);
      // Try fallback method with manual filtering if the query fails
      try {
        const allSnapshot = await getDocs(getUserCollection('dispatchLogs'));
        const logsList = allSnapshot.docs
          .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          .filter(log => log.date === date); // Filter by date manually
        
        setDispatchLogs(logsList);
      } catch (fallbackError) {
        console.error('Error in fallback dispatch logs fetch:', fallbackError);
        setDispatchLogs([]);
      }
    }
  };
  
  // Add function to import dispatch log entries to invoice
  const importDispatchLog = (log) => {
    
    // First check if we have a customer selected, if not try to find matching customer
    if (!selectedCustomer) {
      const matchingCustomer = customers.find(
        customer => customer.opticalName && log.opticalShop && 
        customer.opticalName.toLowerCase() === log.opticalShop.toLowerCase()
      );
      
      if (matchingCustomer) {
        handleCustomerSelect(matchingCustomer);
      } else {
        setError(`Please select a customer first. Could not find customer matching "${log.opticalShop}"`);
        return;
      }
    }
    
    try {
      if (!log.items || !Array.isArray(log.items) || log.items.length === 0) {
        setError("No items found in this dispatch log");
        return;
      }
      
      // Find the first empty row index in the current table
      let insertIndex = tableRows.findIndex(row => row.itemName.trim() === '');
      if (insertIndex === -1) {
        // If no empty rows, add new ones
        insertIndex = tableRows.length;
        addMoreRows(log.items.length);
      }
      
      // Create updated rows array
      const updatedRows = [...tableRows];
      
      // Import each item from the dispatch log
      log.items.forEach((item, index) => {
        const targetIndex = insertIndex + index;
        
        // Ensure we have enough rows
        if (targetIndex >= updatedRows.length) {
          // Add more empty rows if needed
          const newRowsNeeded = targetIndex - updatedRows.length + 1;
          for (let i = 0; i < newRowsNeeded; i++) {
            updatedRows.push({
              orderId: '',
              orderDetails: null,
              itemName: '',
              sph: '',
              cyl: '',
              axis: '',
              add: '',
              qty: 1,
              unit: 'Pairs',
              price: 0,
              total: 0
            });
          }
        }
        
        // Try to find matching item from lens inventory
        const matchingItem = itemSuggestions.find(inventoryItem => {
          const inventoryName = (inventoryItem.brandName || inventoryItem.serviceName || inventoryItem.name || '').toLowerCase().trim();
          const dispatchItemName = (item.itemName || '').toLowerCase().trim();
          
          // Check exact match first
          if (inventoryName === dispatchItemName) {
            return true;
          }
          
          // Check if the inventory item name is contained in dispatch item name
          if (dispatchItemName.includes(inventoryName) && inventoryName.length > 3) {
            return true;
          }
          
          // Check if dispatch item name is contained in inventory item name
          if (inventoryName.includes(dispatchItemName) && dispatchItemName.length > 3) {
            return true;
          }
          
          return false;
        });
        
        if (matchingItem) {
          // Use handleItemSelect to properly set up the item with all its properties
          // First set the basic row data
          updatedRows[targetIndex] = {
            ...updatedRows[targetIndex],
            orderId: log.logId || '',
            itemName: matchingItem.brandName || matchingItem.serviceName || matchingItem.name || item.itemName,
            sph: item.sph || '',
            cyl: item.cyl || '',
            axis: item.axis || '',
            add: item.add || '',
            qty: parseFloat(item.qty) || 1,
            unit: 'Pairs',
            price: parseFloat(matchingItem.salePrice || matchingItem.servicePrice || matchingItem.price || 0),
            total: (parseFloat(matchingItem.salePrice || matchingItem.servicePrice || matchingItem.price || 0)) * (parseFloat(item.qty) || 1)
          };
          
          // Set additional properties based on item type
          if (matchingItem.isService || matchingItem.type === 'service') {
            updatedRows[targetIndex].unit = 'Service';
            updatedRows[targetIndex].isService = true;
            updatedRows[targetIndex].type = 'service';
            // Services don't have optical values
            updatedRows[targetIndex].sph = '';
            updatedRows[targetIndex].cyl = '';
            updatedRows[targetIndex].axis = '';
            updatedRows[targetIndex].add = '';
          } else if (matchingItem.isStockLens || matchingItem.type === 'stock') {
            // For stock lenses, store the lens data for power selection
            updatedRows[targetIndex].stockLensData = matchingItem;
            updatedRows[targetIndex].powerSeries = matchingItem.powerSeries || '';
            updatedRows[targetIndex].maxSph = matchingItem.maxSph || '';
            updatedRows[targetIndex].maxCyl = matchingItem.maxCyl || '';
            updatedRows[targetIndex].maxAxis = matchingItem.maxAxis || '';
            updatedRows[targetIndex].maxAdd = matchingItem.maxAdd || '';
          } else {
            // For regular lenses (made-to-order), keep the power values from dispatch log
            // and store lens data for power range validation
            if (matchingItem.sph || matchingItem.cyl || matchingItem.axis || matchingItem.add) {
              updatedRows[targetIndex].maxSph = matchingItem.sph || '';
              updatedRows[targetIndex].maxCyl = matchingItem.cyl || '';
              updatedRows[targetIndex].maxAxis = matchingItem.axis || '';
              updatedRows[targetIndex].maxAdd = matchingItem.add || '';
            }
          }
        } else {
          // If no matching item found, import as is with a note
          updatedRows[targetIndex] = {
            ...updatedRows[targetIndex],
            orderId: log.logId || '',
            itemName: item.itemName || '',
            sph: item.sph || '',
            cyl: item.cyl || '',
            axis: item.axis || '',
            add: item.add || '',
            qty: parseFloat(item.qty) || 1,
            unit: 'Pairs',
            price: 0, // Price will need to be filled manually
            total: 0
          };
        }
      });
      
      // Update the table with imported data
      setTableRows(updatedRows);
      
              // Set success message
        setTimeout(() => {
          const matchedItems = log.items.filter(item => {
            const itemName = (item.itemName || '').toLowerCase().trim();
            return itemSuggestions.some(inventoryItem => {
              const inventoryName = (inventoryItem.brandName || inventoryItem.serviceName || inventoryItem.name || '').toLowerCase().trim();
              return inventoryName === itemName || 
                     (itemName.includes(inventoryName) && inventoryName.length > 3) ||
                     (inventoryName.includes(itemName) && itemName.length > 3);
            });
          });
          
          const importedItemDetails = log.items.map(item => {
            const isMatched = itemSuggestions.some(inventoryItem => {
              const inventoryName = (inventoryItem.brandName || inventoryItem.serviceName || inventoryItem.name || '').toLowerCase().trim();
              const itemName = (item.itemName || '').toLowerCase().trim();
              return inventoryName === itemName || 
                     (itemName.includes(inventoryName) && inventoryName.length > 3) ||
                     (inventoryName.includes(itemName) && itemName.length > 3);
            });
            return `${item.itemName} (Qty: ${item.qty})${isMatched ? ' ✓' : ' ⚠️'}`;
          }).join('\n');
          
          alert(`Successfully imported ${log.items.length} items from dispatch log ${log.logId}:\n\n${importedItemDetails}\n\n✓ = Matched with inventory\n⚠️ = Manual price entry needed`);
        }, 100);
      
    } catch (error) {
      console.error("Error importing dispatch log:", error);
      setError(`Failed to import dispatch log: ${error.message}`);
    }
    
    // Close the dispatch logs modal
    setShowDispatchLogs(false);
  };

  // PowerSelectionModal handlers - ONLY for stock lenses
  const handleOpenPowerSelection = (rowIndex, itemData) => {
    // Check if it's a stock lens and has stockData
    if (!itemData || !itemData.isStockLens || !itemData.stockData) {
      setError('Please select a stock lens first from the suggestions');
      return;
    }
    
    setPowerSelectionRowIndex(rowIndex);
    setSelectedLensForPowerModal(itemData.stockData);
    setShowPowerSelectionModal(true);
  };

  const handlePowerSelection = (rowIndex, powerSelections) => {
    // powerSelections is now an array of multiple power selections
    const updatedRows = [...tableRows];
    const updatedStockPowers = {...selectedStockPowers};
    
    // Find the starting row index for insertion
    let insertIndex = rowIndex;
    
    // If we have multiple selections, we need to ensure we have enough rows
    if (powerSelections.length > 1) {
      // Check if we need to add more rows
      const rowsNeeded = insertIndex + powerSelections.length;
      if (rowsNeeded > updatedRows.length) {
        const additionalRowsNeeded = rowsNeeded - updatedRows.length;
        const newRows = Array(additionalRowsNeeded).fill().map(() => ({
          orderId: '',
          orderDetails: null,
          itemName: '',
          sph: '',
          cyl: '',
          axis: '',
          add: '',
          qty: 1,
          unit: 'Pairs',
          price: '',
          total: 0
        }));
        updatedRows.push(...newRows);
      }
    }
    
    // Insert each power selection into consecutive rows
    powerSelections.forEach((powerSelection, index) => {
      const targetRowIndex = insertIndex + index;
      
      updatedRows[targetRowIndex] = {
        ...updatedRows[targetRowIndex],
        itemName: `${powerSelection.lensName} (${powerSelection.powerDisplay})`,
        sph: powerSelection.sph.toString(),
        cyl: powerSelection.cyl.toString(),
        axis: powerSelection.axis.toString(),
        add: powerSelection.addition ? powerSelection.addition.toString() : '',
        qty: powerSelection.quantity,
        unit: powerSelection.eyeSelection === 'both' ? 'Pairs' : 'Piece',
        price: powerSelection.price,
        total: powerSelection.price * powerSelection.quantity,
        // Store lens inventory info for deduction
        lensId: powerSelection.lensId,
        powerKey: powerSelection.powerKey,
        pieceQuantity: powerSelection.pieceQuantity,
        eyeSelection: powerSelection.eyeSelection,
        lensType: 'stockLens' // Mark as stock lens for inventory deduction
      };

      // Track selected power for this row
      updatedStockPowers[targetRowIndex] = powerSelection;
    });

    setTableRows(updatedRows);
    setSelectedStockPowers(updatedStockPowers);
    setShowPowerSelectionModal(false);
    setPowerSelectionRowIndex(null);
    setSelectedLensForPowerModal(null);
  };

  const handleClosePowerSelection = () => {
    setShowPowerSelectionModal(false);
    setPowerSelectionRowIndex(null);
    setSelectedLensForPowerModal(null);
  };

  // Quick Transaction Modal handlers
  const handleQuickTransactionSaved = async (transactionData) => {
    // Refresh customer balance if the transaction is for the selected customer
    if (selectedCustomer && transactionData.entityId === selectedCustomer.id) {
      try {
        setLoadingBalance(true);
        const entityIsVendor = selectedCustomer.isVendor || selectedCustomer.type === 'vendor';
        
        let currentBalance;
        if (entityIsVendor) {
          currentBalance = await calculateVendorBalance(selectedCustomer.id, selectedCustomer.openingBalance || 0);
        } else {
          currentBalance = await calculateCustomerBalance(selectedCustomer.id, selectedCustomer.openingBalance || 0);
        }
        
        setCustomerBalance(currentBalance);
      } catch (error) {
        console.error('Error refreshing customer balance:', error);
      } finally {
        setLoadingBalance(false);
      }
    }
  };

  const handleCloseQuickTransaction = () => {
    setShowQuickTransactionModal(false);
  };

  // Handle opening the AddNewProductModal
  const handleShowAddProduct = (currentItemName = '', rowIndex = null) => {
    setCurrentRowIndex(rowIndex);
    setCurrentItemName(currentItemName);
    setShowAddProductModal(true);
  };

  // Handle product creation from modal
  const handleProductCreated = (productData) => {
    setShowAddProductModal(false);
    
    // If we have a current row index, update that row with the new product
    if (currentRowIndex !== null && productData) {
      const updatedRows = [...tableRows];
      updatedRows[currentRowIndex] = {
        ...updatedRows[currentRowIndex],
        itemName: productData.name || productData.brandName || currentItemName
      };
      setTableRows(updatedRows);
    }
    
    // Reset modal state
    setCurrentItemName('');
    setCurrentRowIndex(null);
    
    // Refresh the items to include the new product
    fetchItems();
  };

  // Add function to fetch dispatch logs by search query
  const searchDispatchLogs = async (query) => {
    if (!query || query.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearchingLogs(true);
      
      const normalizedQuery = query.toLowerCase().trim();
      
      // Search across ALL dispatch logs (not filtered by date)
      const dispatchRef = getUserCollection('dispatchLogs');
      const snapshot = await getDocs(dispatchRef);
      
      const matchingLogs = [];
      snapshot.docs.forEach(doc => {
        const log = { id: doc.id, ...doc.data() };
        
        // Skip placeholder documents
        if (log._placeholder) return;
        
        // Check if log matches search criteria
        const matchesLogId = log.logId && log.logId.toLowerCase().includes(normalizedQuery);
        const matchesOpticalShop = log.opticalShop && log.opticalShop.toLowerCase().includes(normalizedQuery);
        
        // Check if any item name matches
        let matchesItemName = false;
        if (log.items && Array.isArray(log.items)) {
          matchesItemName = log.items.some(item => 
            item.itemName && item.itemName.toLowerCase().includes(normalizedQuery)
          );
        }
        
        if (matchesLogId || matchesOpticalShop || matchesItemName) {
          matchingLogs.push(log);
        }
      });
      
      // Sort by creation date (newest first)
      matchingLogs.sort((a, b) => {
        const dateA = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate() : new Date(a.createdAt || 0);
        const dateB = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate() : new Date(b.createdAt || 0);
        return dateB - dateA;
      });
      
      setSearchResults(matchingLogs);
    } catch (error) {
      console.error('Error searching dispatch logs:', error);
      setSearchResults([]);
    } finally {
      setIsSearchingLogs(false);
    }
  };

  // Function to handle ledger button click
  const handleViewLedger = async (customer) => {
    // Navigate to Ledger page with customer data
    navigate('/ledger', { 
      state: { 
        selectedCustomer: {
          id: customer.id,
          opticalName: customer.opticalName
        },
        viewMode: 'invoiceOnly'
      } 
    });
  };

  // Function to handle printing the address
  const handlePrintAddress = () => {
    if (!selectedCustomer || !shopInfo) {
      console.error('Customer or shop info not available');
      return;
    }
    
    setShowAddressModal(true);
  };

  // Function to actually print the address content
  const printAddressContent = () => {
    const content = document.getElementById('address-content');
    if (!content) return;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
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
    `);
    printWindow.document.close();
    
    // Auto-print after a delay to ensure content is loaded
    setTimeout(() => {
      printWindow.focus();
      printWindow.print();
    }, 500);
  };

  // Address Modal Component
  const AddressModal = () => {
    if (!selectedCustomer || !shopInfo) return null;
    

    
    return (
      <div className="fixed inset-0 overflow-y-auto z-50">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
          <div className="fixed inset-0 transition-opacity" aria-hidden="true">
            <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
          </div>

          <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

          <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
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
                    <strong>{selectedCustomer.opticalName || 'Customer Name'}</strong><br />
                    {selectedCustomer.address || ''}<br />
                    {selectedCustomer.city && selectedCustomer.state ? `${selectedCustomer.city}, ${selectedCustomer.state}` : selectedCustomer.city || selectedCustomer.state || ''}<br />
                    {selectedCustomer.phone && `Phone: ${selectedCustomer.phone}`}<br />
                    {selectedCustomer.gstNumber && `GSTIN: ${selectedCustomer.gstNumber}`}<br />
                    {`Invoice: ${invoiceNumber || ''}`}<br />
                    {`Date: ${new Date(invoiceDate).toLocaleDateString()}`}
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

  // Success Modal
  const SuccessModal = () => {
    // Handle keyboard shortcuts and ESC key
    useEffect(() => {
      // Create a modal-specific handler that completely overrides global shortcuts
      const handleModalKeyDown = (e) => {
        // Only handle if the modal is actually visible and not typing in an input
        if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) {
          
          switch (e.key) {
            case 'Escape':
              e.preventDefault();
              e.stopImmediatePropagation(); // Stop ALL other handlers
              setShowSuccessModal(false);
              navigate('/sales');
              return false;
            case 'n':
            case 'N':
              e.preventDefault();
              e.stopImmediatePropagation(); // Stop ALL other handlers
              setShowSuccessModal(false);
              resetForm();
              return false;
            case 'd':
            case 'D':
              e.preventDefault();
              e.stopImmediatePropagation(); // Stop ALL other handlers
              setShowSuccessModal(false);
              navigate(`/sales/${savedSaleId}`);
              return false;
            case 'p':
            case 'P':
              e.preventDefault();
              e.stopImmediatePropagation(); // Stop ALL other handlers
              handleQuickPrint();
              return false;
            case 'w':
            case 'W':
              e.preventDefault();
              e.stopImmediatePropagation(); // Stop ALL other handlers
              handleSendWhatsApp();
              return false;
          }
        }
      };

      // Add modal overlay to capture events with highest priority
      const modalOverlay = document.querySelector('.fixed.inset-0.bg-gray-600');
      if (modalOverlay) {
        modalOverlay.addEventListener('keydown', handleModalKeyDown, { capture: true });
      }
      
      // Also add to document with capture and high priority
      document.addEventListener('keydown', handleModalKeyDown, { capture: true });
      
      // Set a flag to indicate modal is open (for global handler to check)
      window.__successModalOpen = true;
      
      return () => {
        if (modalOverlay) {
          modalOverlay.removeEventListener('keydown', handleModalKeyDown, { capture: true });
        }
        document.removeEventListener('keydown', handleModalKeyDown, { capture: true });
        window.__successModalOpen = false;
      };
    }, [savedSaleId]);

    const handleCloseModal = () => {
      setShowSuccessModal(false);
      navigate('/sales');
    };

    return (
      <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
        <div className="relative top-20 mx-auto p-6 border border-gray-200 dark:border-gray-700 w-full max-w-lg shadow-lg rounded-lg bg-white dark:bg-gray-800">
          {/* Close Button */}
          <button
            onClick={handleCloseModal}
            className="absolute top-4 right-4 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <svg className="h-6 w-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>

            {/* Title */}
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Sale Saved Successfully!
            </h3>
            
            {/* Message */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Invoice #{invoiceNumber} has been created and saved.
              {hasPrintedInvoice && (
                <span className="block mt-1 text-green-600 dark:text-green-400 font-medium">
                  ✓ Printed successfully
                </span>
              )}
            </p>
            


            {/* Action Buttons */}
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    resetForm();
                  }}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors text-sm font-medium"
                >
                  New Bill (N)
                </button>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    navigate(`/sales/${savedSaleId}`);
                  }}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-colors text-sm font-medium"
                >
                  Details (D)
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                                  <button
                    onClick={handleQuickPrint}
                    className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors text-sm font-medium"
                    title="One-click print with auto-close and pre-filled filename"
                  >
                    Quick Print (P)
                  </button>
                <button
                  onClick={handleSendWhatsApp}
                  disabled={!selectedCustomer || !selectedCustomer.phone}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  WhatsApp (W)
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
      <style>
        {`
          /* Hide webkit number input spinners */
          input[type="number"]::-webkit-outer-spin-button,
          input[type="number"]::-webkit-inner-spin-button {
            -webkit-appearance: none;
            margin: 0;
          }
          
          /* Hide Firefox number input spinners */
          input[type="number"] {
            -moz-appearance: textfield;
          }
        `}
      </style>
      <Navbar />
      
      <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create Invoice</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Create a new sales invoice</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowQuickTransactionModal(true)}
              className="px-2 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 transition-colors flex items-center gap-1 text-sm"
              title="Quick Payment Entry (Press O)"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Payment
            </button>
            <button
              onClick={() => navigate('/sales')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-500 text-red-700 dark:text-red-200">
            <p>{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Customer/Vendor Information</h2>
              <div className="mb-4" data-section="customer-search">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Customer/Vendor</label>
                <CustomerSearch 
                  customers={customers}
                  value={selectedCustomer?.opticalName || ''}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  onSelect={handleCustomerSelect}
                  onAddNew={handleAddNewCustomer}
                  onViewLedger={handleViewLedger}
                  onCashSale={handleCashSale}
                />
              </div>

              {selectedCustomer && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-md p-4 bg-gray-50 dark:bg-gray-700">
                  <div className="flex items-center">
                    <h3 className="font-medium text-gray-900 dark:text-white">{selectedCustomer.opticalName}</h3>
                    {(selectedCustomer.isVendor || selectedCustomer.type === 'vendor') && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 rounded-full">
                        Vendor
                      </span>
                    )}
                  </div>
                  {selectedCustomer.address && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{selectedCustomer.address}</p>
                  )}
                  {(selectedCustomer.city || selectedCustomer.state) && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedCustomer.city}{selectedCustomer.state ? `, ${selectedCustomer.state}` : ''}
                    </p>
                  )}
                  {selectedCustomer.gstNumber && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <span className="font-medium">GST:</span> {selectedCustomer.gstNumber}
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                    {loadingBalance ? (
                      <div className="flex items-center">
                        <svg className="animate-spin h-4 w-4 text-blue-500 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm text-gray-500 dark:text-gray-400">Calculating balance...</span>
                      </div>
                    ) : (
                      <div 
                        onClick={() => handleViewLedger(selectedCustomer)}
                        className="flex justify-between items-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 p-2 rounded-md transition-colors"
                        title="Click to view complete ledger"
                      >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          {(selectedCustomer.isVendor || selectedCustomer.type === 'vendor') ? 'Amount Payable:' : 'Current Balance:'}
                        </span>
                        <div className="text-right">
                          <span className={`text-sm font-semibold ${getBalanceColorClass(customerBalance)}`}>
                            {formatCurrency(Math.abs(customerBalance))}
                          </span>
                          <span className={`text-xs ml-1 px-2 py-0.5 rounded-full ${customerBalance > 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' : customerBalance < 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300'}`}>
                            {(selectedCustomer.isVendor || selectedCustomer.type === 'vendor') 
                              ? (customerBalance > 0 ? 'Payable' : customerBalance < 0 ? 'Credit' : 'Settled')
                              : getBalanceStatusText(customerBalance)
                            }
                          </span>
                          <svg className="w-4 h-4 inline-block ml-1 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* View Ledger Button - COMMENTED OUT: Using clickable balance instead */}
                  </div>
                )}
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Invoice Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Number</label>
                  <div className="mt-1 flex items-center space-x-2">
                    {/* Financial Year Prefix - Non-editable */}
                    <div className="flex-shrink-0">
                      <input
                        type="text"
                        value={invoicePrefix}
                        className="block w-24 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-center font-medium"
                        readOnly
                        placeholder="2024-2025"
                      />
                    </div>
                    
                    {/* Separator */}
                    <span className="text-gray-500 dark:text-gray-400 font-medium">/</span>
                    
                    {/* Simple Invoice Number - Non-editable */}
                    <div className="flex-shrink-0">
                      <input
                        type="text"
                        value={invoiceSimpleNumber}
                        className="block w-16 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 text-center font-bold text-lg"
                        readOnly
                        placeholder="61"
                      />
                    </div>
                  </div>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    data-section="invoice-date"
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PARTIAL">Partially Paid</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Invoice Items */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Invoice Items</h2>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setShowDispatchLogs(true)}
                className="ml-2 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900/70 text-sm flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Import from Dispatch Log
              </button>
              <div className="text-sm text-gray-500 dark:text-gray-400 ml-4">
                Showing {getVisibleRows().length} of {tableRows.length} rows
              </div>
            </div>
          </div>
          
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[100px]">
                  Order ID
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[260px]">
                  Item Name
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  SPH
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  CYL
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  AXIS
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  ADD
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  QTY
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  UNIT
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Price
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-[60px]">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {getVisibleRows().map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'} data-section={`table-row-${index}`}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.orderId}
                      onChange={(e) => handleTableRowChange(index, 'orderId', e.target.value)}
                      onBlur={(e) => fetchOrderDetails(e.target.value, index)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Order ID"
                    />
                  </td>
                  
                  <td className="px-3 py-2 whitespace-nowrap relative w-[260px]">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <ItemSuggestions
                          items={itemSuggestions}
                          value={row.itemName}
                          onChange={handleTableRowChange}
                          onSelect={handleItemSelect}
                          index={index}
                          rowQty={row.qty}
                          saveItemToDatabase={saveItemToDatabase}
                          onRefreshItems={fetchItems}
                          currentPrice={parseFloat(row.price) || 0}
                          dataSection="create-sale"
                          onShowAddProduct={(itemName, rowIndex) => handleShowAddProduct(itemName, rowIndex)}
                        />
                        {row.powerSeries && (
                          <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                            {row.powerSeries}
                          </div>
                        )}
                      </div>
                      
                      {/* Stock Lens Power Selection Button - ONLY for stock lenses */}
                      {row.stockLensData && row.stockLensData.isStockLens && (
                        <button
                          type="button"
                          onClick={() => handleOpenPowerSelection(index, row.stockLensData)}
                          data-power-button={index}
                          className="flex-shrink-0 px-2 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 transition-colors"
                          title="Click to select specific power from stock lens inventory"
                        >
                          👓
                        </button>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.sph}
                      onChange={(e) => handleTableRowChange(index, 'sph', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'sph', e.target.value)}
                      disabled={row.isService || row.type === 'service' || row.unit === 'Service'}
                      className={`block w-full rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center ${
                        row.isService || row.type === 'service' || row.unit === 'Service'
                          ? 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                      } ${
                        powerRangeWarnings[index]?.sph 
                          ? 'border-red-300 dark:border-red-600' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder={row.isService || row.type === 'service' || row.unit === 'Service' ? 'N/A' : 'SPH'}
                    />
                    {powerRangeWarnings[index]?.sph && !(row.isService || row.type === 'service' || row.unit === 'Service') && (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1 text-center truncate">
                        {powerRangeWarnings[index].sph}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={row.cyl}
                      onChange={(e) => handleTableRowChange(index, 'cyl', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'cyl', e.target.value)}
                      disabled={row.isService || row.type === 'service' || row.unit === 'Service'}
                      className={`block w-full rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center ${
                        row.isService || row.type === 'service' || row.unit === 'Service'
                          ? 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                      } ${
                        powerRangeWarnings[index]?.cyl 
                          ? 'border-red-300 dark:border-red-600' 
                          : 'border-gray-300 dark:border-gray-600'
                      }`}
                      placeholder={row.isService || row.type === 'service' || row.unit === 'Service' ? 'N/A' : 'CYL'}
                    />
                    {powerRangeWarnings[index]?.cyl && !(row.isService || row.type === 'service' || row.unit === 'Service') && (
                      <div className="text-xs text-red-600 dark:text-red-400 mt-1 text-center truncate">
                        {powerRangeWarnings[index].cyl}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.axis}
                      onChange={(e) => handleTableRowChange(index, 'axis', e.target.value)}
                      disabled={row.isService || row.type === 'service' || row.unit === 'Service'}
                      className={`block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center ${
                        row.isService || row.type === 'service' || row.unit === 'Service'
                          ? 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                      placeholder={row.isService || row.type === 'service' || row.unit === 'Service' ? 'N/A' : 'AXIS'}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.add}
                      onChange={(e) => handleTableRowChange(index, 'add', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'add', e.target.value)}
                      disabled={row.isService || row.type === 'service' || row.unit === 'Service'}
                      className={`block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center ${
                        row.isService || row.type === 'service' || row.unit === 'Service'
                          ? 'bg-gray-100 dark:bg-gray-600 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                      }`}
                      placeholder={row.isService || row.type === 'service' || row.unit === 'Service' ? 'N/A' : 'ADD'}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) => handleTableRowChange(index, 'qty', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="QTY"
                      min="0.1"
                      step="0.1"
                      style={{
                        appearance: 'textfield',
                        MozAppearance: 'textfield'
                      }}
                      onWheel={(e) => e.preventDefault()}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      value={row.unit}
                      onChange={(e) => handleTableRowChange(index, 'unit', e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    >
                      <option value="Pairs">Pairs</option>
                      <option value="Pieces">Pieces</option>
                      <option value="Dozen">Dozen</option>
                      <option value="Box">Box</option>
                      <option value="Pair">Pair</option>
                      <option value="Set">Set</option>
                      <option value="Pack">Pack</option>
                      <option value="Roll">Roll</option>
                      <option value="Meter">Meter</option>
                      <option value="Gram">Gram</option>
                      <option value="Kilogram">Kilogram</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.price}
                      onChange={(e) => handleTableRowChange(index, 'price', e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-right bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Price"
                      style={{
                        appearance: 'textfield',
                        MozAppearance: 'textfield'
                      }}
                      onWheel={(e) => e.preventDefault()}
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right text-gray-900 dark:text-white">
                    {formatCurrency(row.total)}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(index)}
                      className="inline-flex items-center justify-center w-8 h-8 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-1"
                      title="Delete this row"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Table Controls */}
          <div className="mt-4 flex flex-wrap gap-3">
            {!showAllRows && tableRows.length > displayRowCount && (
              <button
                type="button"
                onClick={() => setShowAllRows(true)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                <svg className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Show All Rows ({tableRows.length})
              </button>
            )}
            
            {showAllRows && (
              <button
                type="button"
                onClick={() => setShowAllRows(false)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                <svg className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Show Less
              </button>
            )}
            
            <button
              type="button"
              onClick={() => addMoreRows(5)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            >
              <svg className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add 5 More Rows
            </button>
            
            {tableRows.length >= 50 && (
              <button
                type="button"
                onClick={() => addMoreRows(10)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                <svg className="mr-2 h-4 w-4 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add 10 More Rows
              </button>
            )}
          </div>
        </div>

        {/* Invoice Summary */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Tax and Discount Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Additional Charges</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tax Option</label>
                <select
                  value={selectedTaxOption}
                  onChange={(e) => setSelectedTaxOption(e.target.value)}
                  data-section="tax-option"
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {TAX_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Discount</label>
                <div className="flex space-x-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    data-section="discount-type"
                    className="block w-1/3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="amount">Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="block w-2/3 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder={discountType === 'amount' ? "Discount Amount" : "Discount %"}
                    min="0"
                    step={discountType === 'amount' ? "0.01" : "0.1"}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Freight Charge</label>
                <input
                  type="number"
                  value={frieghtCharge}
                  onChange={(e) => setFrieghtCharge(e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Freight/Shipping Charge"
                  min="0"
                  step="0.01"
                />
              </div>

              {paymentStatus !== 'UNPAID' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount Paid</label>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Amount Paid"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Additional information or special instructions"
                  rows="3"
                ></textarea>
              </div>
            </div>
          </div>
          
          {/* Summary Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Invoice Summary</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Subtotal:</span>
                <span className="font-medium text-gray-900 dark:text-white">{formatCurrency(calculateSubtotal())}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Discount:</span>
                <span className="text-red-500 dark:text-red-400">-{formatCurrency(calculateDiscountAmount())}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">
                  Tax ({getTaxOption(selectedTaxOption).label}):
                </span>
                <span className="text-gray-800 dark:text-gray-200">{formatCurrency(calculateTaxAmount())}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Freight Charge:</span>
                <span className="text-gray-800 dark:text-gray-200">{formatCurrency(parseFloat(frieghtCharge || 0))}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                <span className="text-gray-600 dark:text-gray-400">Total Quantity:</span>
                <span className="font-medium text-gray-800 dark:text-gray-200">{formatQuantityDisplay()}</span>
              </div>
              
              <div className="flex justify-between py-3 border-b border-gray-200 dark:border-gray-600 text-lg">
                <span className="font-semibold text-gray-900 dark:text-white">Total:</span>
                <span className="font-bold text-sky-700 dark:text-sky-400">{formatCurrency(calculateTotal())}</span>
              </div>
              
              {paymentStatus !== 'UNPAID' && (
                <>
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Amount Paid:</span>
                    <span className="text-green-600 dark:text-green-400">{formatCurrency(parseFloat(amountPaid || 0))}</span>
                  </div>
                  
                  <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
                    <span className="text-gray-600 dark:text-gray-400">Balance Due:</span>
                    <span className="font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(Math.max(0, calculateTotal() - parseFloat(amountPaid || 0)))}
                    </span>
                  </div>
                </>
              )}
            </div>
            
            {/* Replace the button with BottomActionBar on mobile */}
            <div className="mt-6 desktop-only">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSaveSale}
                  disabled={loading}
                  data-section="save-button"
                  className="w-full px-4 py-3 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors disabled:opacity-50"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </span>
                  ) : (
                    'Save Invoice'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Save Button - Fixed at bottom*/}
        <div className="mobile-only">
          <BottomActionBar fixed={true} bgColor="bg-gray-50 dark:bg-gray-800">
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowQuickTransactionModal(true)}
                className="px-4 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors flex items-center"
                title="Quick Payment Entry"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={handleSaveSale}
                disabled={loading}
                data-section="save-button"
                className="flex-1 px-4 py-3 bg-sky-600 text-white font-medium rounded-lg hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving...
                  </span>
                ) : (
                  'Save Invoice'
                )}
              </button>
            </div>
          </BottomActionBar>
        </div>

        {/* Success Modal */}
        {showSuccessModal && <SuccessModal />}

        {/* Address Modal */}
        {showAddressModal && <AddressModal />}

        {/* Customer Form Modal */}
        {showCustomerForm && (
          <CustomerForm
            onClose={handleCustomerFormClose}
            customer={null}
            initialData={{
              name: searchCustomer
            }}
          />
        )}

        {/* Add Dispatch Logs Modal */}
        {showDispatchLogs && (
          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                          Dispatch Logs
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowDispatchLogs(false)}
                          className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
                        >
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="mt-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <div className="flex-grow">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Search by Log ID, Optical Name, or Lens Name
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={searchLogQuery}
                                onChange={(e) => setSearchLogQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && searchDispatchLogs(searchLogQuery)}
                                placeholder="Enter search term..."
                                className="flex-grow px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                              <button
                                type="button"
                                onClick={() => searchDispatchLogs(searchLogQuery)}
                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                              >
                                Search
                              </button>
                            </div>
                          </div>
                          
                          <div className="md:w-48">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              Select Date
                            </label>
                            <input
                              type="date"
                              value={selectedLogDate}
                              onChange={(e) => {
                                setSelectedLogDate(e.target.value);
                                setSearchLogQuery('');
                                setSearchResults([]);
                                fetchDispatchLogs(e.target.value);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 max-h-[60vh] overflow-y-auto">
                        {isSearchingLogs ? (
                          <div className="flex justify-center py-8">
                            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        ) : searchResults.length > 0 ? (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Search Results:</h4>
                            <ul className="space-y-3">
                              {searchResults.map(log => (
                                <li key={log.logId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-medium text-gray-900 dark:text-white">{log.opticalShop}</h4>
                                      <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Log ID: {log.logId} ({log.items ? log.items.length : 0} items) - 
                                        {log.date && typeof log.date === 'object' && log.date.toDate 
                                          ? log.date.toDate().toLocaleDateString() 
                                          : log.date || 'No date'
                                        }
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => importDispatchLog(log)}
                                      className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900/70 text-sm"
                                    >
                                      Import
                                    </button>
                                  </div>
                                  <div className="mt-2">
                                    <ul className="text-sm text-gray-600 dark:text-gray-400">
                                      {log.items && log.items.slice(0, 3).map((item, idx) => (
                                        <li key={idx} className="truncate">
                                          • {item.itemName} {item.sph && `(SPH: ${item.sph})`} {item.qty && `- Qty: ${item.qty}`}
                                        </li>
                                      ))}
                                      {log.items && log.items.length > 3 && (
                                        <li className="text-gray-400">+ {log.items.length - 3} more items</li>
                                      )}
                                    </ul>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : dispatchLogs.length === 0 ? (
                          <p className="text-gray-500 dark:text-gray-400 text-center py-4">No dispatch logs found for {new Date(selectedLogDate).toLocaleDateString()}</p>
                        ) : (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Logs for {new Date(selectedLogDate).toLocaleDateString()}:</h4>
                            <ul className="space-y-3">
                              {dispatchLogs.map(log => (
                                <li key={log.logId} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-medium text-gray-900 dark:text-white">{log.opticalShop}</h4>
                                      <p className="text-sm text-gray-500 dark:text-gray-400">
                                        Log ID: {log.logId} ({log.items ? log.items.length : 0} items)
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => importDispatchLog(log)}
                                      className="px-3 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 rounded-md hover:bg-green-200 dark:hover:bg-green-900/70 text-sm"
                                    >
                                      Import
                                    </button>
                                  </div>
                                  <div className="mt-2">
                                    <ul className="text-sm text-gray-600 dark:text-gray-400">
                                      {log.items && log.items.slice(0, 3).map((item, idx) => (
                                        <li key={idx} className="truncate">
                                          • {item.itemName} {item.sph && `(SPH: ${item.sph})`} {item.qty && `- Qty: ${item.qty}`}
                                        </li>
                                      ))}
                                      {log.items && log.items.length > 3 && (
                                        <li className="text-gray-400">+ {log.items.length - 3} more items</li>
                                      )}
                                    </ul>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={() => setShowDispatchLogs(false)}
                      className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* Print Invoice Modal */}
      {showPrintModal && savedSaleId && (
        <PrintInvoiceModal 
          isOpen={showPrintModal}
          saleId={savedSaleId} 
          onClose={() => {
            setShowPrintModal(false);
            // Ensure success modal remains visible after print modal closes
            setShowSuccessModal(true);
          }}
          title={`Invoice #${invoiceNumber}`}
        />
      )}

      {/* Power Selection Modal - ONLY for stock lenses */}
      <PowerSelectionModal
        isOpen={showPowerSelectionModal}
        onClose={handleClosePowerSelection}
        onSelectPower={handlePowerSelection}
        selectedLens={selectedLensForPowerModal}
        rowIndex={powerSelectionRowIndex}
      />

      {/* Quick Transaction Modal */}
      <QuickTransactionModal
        isOpen={showQuickTransactionModal}
        onClose={handleCloseQuickTransaction}
        preSelectedCustomer={selectedCustomer}
        onTransactionSaved={handleQuickTransactionSaved}
      />

      {/* AddNewProductModal */}
      {showAddProductModal && (
        <AddNewProductModal
          isOpen={showAddProductModal}
          onClose={() => {
            setShowAddProductModal(false);
            setCurrentItemName('');
            setCurrentRowIndex(null);
          }}
          onProductCreated={handleProductCreated}
          initialProductName={currentItemName}
          dataSection="create-sale"
        />
      )}
    </div>
  );
};

export default CreateSale; 
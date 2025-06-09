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

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState(null);
  
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

  useEffect(() => {
    fetchCustomers();
    previewNextInvoiceNumber();
    fetchItems();
    fetchShopInfo();
  }, []);

  // Add useEffect to fetch dispatch logs when invoice date changes
  useEffect(() => {
    if (selectedLogDate) {
      fetchDispatchLogs(selectedLogDate);
    }
  }, [selectedLogDate]);
  
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
    // Show the customer form modal instead of opening a new window
    setShowCustomerForm(true);
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

    // Recalculate total for the row if price or qty changes
    if (field === 'price' || field === 'qty') {
      updatedRows[index].total = 
        parseFloat(updatedRows[index].price || 0) * 
        parseInt(updatedRows[index].qty || 0);
      
      // Save item to database when price is updated and we have an item name
      if (field === 'price' && updatedRows[index].itemName.trim() !== '') {
        saveItemToDatabase(updatedRows[index].itemName, value);
      }
    }

    setTableRows(updatedRows);
  };
  
  // Format SPH, CYL, and ADD when the field loses focus
  const handleOpticalValueBlur = (index, field, value) => {
    const updatedRows = [...tableRows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: formatOpticalValue(value)
    };
    setTableRows(updatedRows);
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
              console.warn('Sale was created successfully, but payment transaction registration failed');
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
            qty: parseInt(formattedRow.qty),
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
                console.log(`Skipping order ${paddedDisplayId} due to status: ${orderData.status}`);
                continue;
              }
              
              // Mark this order as DELIVERED in the orders collection using multi-tenant reference
              await updateDoc(getUserDoc('orders', orderData.id), {
                status: 'DELIVERED',
                updatedAt: serverTimestamp()
              });
              console.log(`Updated order ${paddedDisplayId} status to DELIVERED`);
              
              // Deduct lenses from inventory
              await deductLensesFromInventory(orderData);
              
              console.log(`Processed order ${paddedDisplayId} for inventory`);
              continue; // Skip to next order since we found this one with padding
            }
          }
          
          const orderDoc = snapshot.docs[0];
          const orderData = { id: orderDoc.id, ...orderDoc.data() };
          
          console.log(`Order details: ID=${orderData.id}, Status=${orderData.status}, DisplayID=${orderData.displayId}`);
          
          // Skip orders with invalid statuses
          const invalidStatuses = ['PENDING', 'PLACED', 'CANCELLED', 'DECLINED'];
          if (invalidStatuses.includes(orderData.status)) {
            console.log(`Skipping order ${displayId} due to status: ${orderData.status}`);
            continue;
          }
          
          // Mark this order as DELIVERED in the orders collection using multi-tenant reference
          await updateDoc(getUserDoc('orders', orderData.id), {
            status: 'DELIVERED',
            updatedAt: serverTimestamp()
          });
          console.log(`Updated order ${displayId} status to DELIVERED`);
          
          // Deduct lenses from inventory
          await deductLensesFromInventory(orderData);
          
          console.log(`Processed order ${displayId} for inventory`);
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
              console.warn(`⚠️ Lens document ${item.lensId} not found`);
              continue;
            }
            
            const lensData = lensDoc.data();
            
            if (!lensData.powerInventory || !lensData.powerInventory[item.powerKey]) {
              console.warn(`⚠️ Power ${item.powerKey} not found in lens ${item.lensId} inventory`);
              continue;
            }
            
            const currentPowerQty = parseInt(lensData.powerInventory[item.powerKey].quantity) || 0;
            const qtyToDeduct = parseInt(item.pieceQuantity) || 0;
            
            if (currentPowerQty < qtyToDeduct) {
              console.warn(`⚠️ Insufficient stock for power ${item.powerKey}. Available: ${currentPowerQty}, Requested: ${qtyToDeduct}`);
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
          
          // Validate item has necessary data
          if (!item.itemName || item.itemName.trim() === '') {
            continue;
          }
          
          if (!item.qty || parseInt(item.qty) <= 0) {
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
                const brandName = (lensData.brandName || '').toLowerCase();
                const serviceName = (lensData.serviceName || '').toLowerCase();
                
                if (brandName.includes(searchTerm) || searchTerm.includes(brandName) ||
                    serviceName.includes(searchTerm) || searchTerm.includes(serviceName)) {
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
            let remainingQtyToDeduct = parseInt(item.qty) || 1;
          
                      for (const lens of matchingLenses) {
              if (remainingQtyToDeduct <= 0) {
                break;
              }
              
              const currentQty = parseInt(lens.qty) || 0;
              
              if (currentQty <= 0) {
                continue;
              }
              
              const qtyToDeductFromThisLens = Math.min(remainingQtyToDeduct, currentQty);
              const newQty = currentQty - qtyToDeductFromThisLens;
              
              try {
                if (newQty <= 0) {
                  // Remove the lens from inventory if quantity becomes zero or negative
                  await deleteDoc(getUserDoc('lensInventory', lens.id));
                } else {
                  // Update the quantity
                  await updateDoc(getUserDoc('lensInventory', lens.id), {
                    qty: newQty,
                    updatedAt: Timestamp.fromDate(new Date())
                  });
                }
                
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
      // Clear any previous errors when opening print
      setError('');
    } else {
      console.error('No sale ID found for printing');
      setError('No sale ID found. Please save the invoice first.');
      alert('Error: Cannot print - No sale ID found. Please save the invoice first.');
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
    setError('');
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
      
      // Create a map to deduplicate items by name
      const uniqueItems = {};
      
      // Process all items from lens_inventory
      allSnapshot.docs.forEach(doc => {
        const lens = { id: doc.id, ...doc.data() };
        
        let itemName = '';
        let itemPrice = 0;
        
        // Determine item name and price based on lens type
        if (lens.type === 'stock') {
          // Use only brandName, not powerSeries to avoid long detailed strings
          itemName = lens.brandName || '';
          itemPrice = lens.salePrice || 0;
        } else if (lens.type === 'service') {
          itemName = lens.serviceName || lens.brandName || '';
          itemPrice = lens.salePrice || lens.servicePrice || 0;
        } else if (lens.type === 'prescription') {
          itemName = lens.brandName || '';
          itemPrice = lens.salePrice || 0;
        } else if (lens.type === 'contact') {
          // Use only brandName for contact lenses too
          itemName = lens.brandName || '';
          itemPrice = lens.salePrice || 0;
        }
        
        if (itemName.trim()) {
          const normalizedName = itemName.toLowerCase();
          
          // Add to uniqueItems if it doesn't exist or if this is a newer entry
          if (!uniqueItems[normalizedName] || 
              (lens.createdAt && uniqueItems[normalizedName].createdAt && 
               lens.createdAt.toDate() > uniqueItems[normalizedName].createdAt.toDate())) {
            
            uniqueItems[normalizedName] = {
              id: lens.id,
              name: itemName,
              price: itemPrice,
              createdAt: lens.createdAt,
              isStockLens: lens.type === 'stock',
              isService: lens.type === 'service',
              isContactLens: lens.type === 'contact',
              isPrescription: lens.type === 'prescription',
              stockData: lens.type === 'stock' ? lens : null,
              serviceData: lens.type === 'service' ? lens : null,
              contactData: lens.type === 'contact' ? lens : null,
              prescriptionData: lens.type === 'prescription' ? lens : null,
              // Store powerSeries separately for display purposes but not in the main name
              powerSeries: lens.powerSeries || '',
              // Store additional lens details for reference
              maxSph: lens.maxSph,
              maxCyl: lens.maxCyl,
              type: lens.type,
              brandName: lens.brandName
            };
          }
        }
      });
      
      // Convert to array and sort by name
      const itemsList = Object.values(uniqueItems).sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      
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
    
    // Update the rows directly to ensure the full item name is set
    const updatedRows = [...tableRows];
    
    // Extract just the clean brand name, avoiding any power series details
    let cleanItemName = '';
    if (itemData.brandName) {
      // Use brandName if available (most reliable)
      cleanItemName = itemData.brandName;
    } else if (itemData.name) {
      // Use name field, but ensure it's clean
      cleanItemName = itemData.name;
    } else if (itemData.itemName) {
      // Fallback to itemName
      cleanItemName = itemData.itemName;
    }
    
    // For services, use serviceName if available
    if (itemData.isService && itemData.serviceData && itemData.serviceData.serviceName) {
      cleanItemName = itemData.serviceData.serviceName;
    }
    
    // Ensure the item name is set to the clean name
    updatedRows[index] = {
      ...updatedRows[index],
      itemName: cleanItemName.trim()
    };
    
    // Set the price if available
    if (itemPrice > 0) {
      updatedRows[index].price = itemPrice.toString();
      // Recalculate total
      updatedRows[index].total = itemPrice * parseInt(updatedRows[index].qty || 1);
    }
    
    // Set appropriate unit for services
    if (itemData.isService) {
      updatedRows[index].unit = 'Service';
      // Clear optical values for services as they don't apply
      updatedRows[index].sph = '';
      updatedRows[index].cyl = '';
      updatedRows[index].axis = '';
      updatedRows[index].add = '';
    }
    
    // Store lens data for stock lenses to be used by PowerSelectionModal
    if (itemData.isStockLens && itemData.stockData) {
      updatedRows[index].powerSeries = itemData.stockData.powerSeries || itemData.powerSeries || '';
      updatedRows[index].stockLensData = itemData; // Store complete lens data for modal use
      
      // For stock lenses, clear optical values and guide user to use PowerSelectionModal
      updatedRows[index].sph = '';
      updatedRows[index].cyl = '';
      updatedRows[index].axis = '';
      updatedRows[index].add = '';
    }
    
    // Update the table with all changes at once
    setTableRows(updatedRows);
    
    // Auto-focus the power selection button for stock lenses after a short delay
    if (itemData.isStockLens && itemData.stockData) {
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
      
      // Try without orderBy first to see if we get any results
      const simpleQuery = query(dispatchRef, where('date', '==', date));
      const snapshot = await getDocs(simpleQuery);
      
      if (snapshot.empty) {
        // Try getting all logs and filter in memory
        const allSnapshot = await getDocs(dispatchRef);
        
        // Filter manually
        const logsList = allSnapshot.docs
          .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        
        setDispatchLogs(logsList);
      } else {
        const logsList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setDispatchLogs(logsList);
      }
    } catch (error) {
      console.error('Error fetching dispatch logs:', error);
      setDispatchLogs([]);
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
              price: 0, // Price will need to be filled manually
              total: 0
            });
          }
        }
        
        // Import the item data
        updatedRows[targetIndex] = {
          ...updatedRows[targetIndex],
          orderId: log.logId || '', // Put log ID in order ID column
          itemName: item.itemName || '',
          sph: item.sph || '',
          cyl: item.cyl || '',
          axis: item.axis || '',
          add: item.add || '',
          qty: parseFloat(item.qty) || 1, // Use parseFloat to handle decimal quantities like 0.5
          unit: 'Pairs',
          price: 0, // Price will need to be filled manually
          total: 0
        };
      });
      
      // Update the table with imported data
      setTableRows(updatedRows);
      
      // Set success message instead of error
      setTimeout(() => {
        const importedItemDetails = log.items.map(item => 
          `${item.itemName} (Qty: ${item.qty})`
        ).join(', ');
        alert(`Successfully imported ${log.items.length} items from dispatch log ${log.logId}:\n${importedItemDetails}`);
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

  // Add function to fetch dispatch logs by search query
  const searchDispatchLogs = async (query) => {
    if (!query || query.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearchingLogs(true);
      
      const normalizedQuery = query.toLowerCase().trim();
      
      // Search in dispatch logs
      const dispatchRef = getUserCollection('dispatchLogs');
      const snapshot = await getDocs(dispatchRef);
      
      const matchingLogs = [];
      snapshot.docs.forEach(doc => {
        const log = { id: doc.id, ...doc.data() };
        
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
      const handleKeyDown = (e) => {
        // Prevent default behavior for our custom shortcuts
        if (['Escape', 'n', 'N', 'd', 'D', 'p', 'P', 'w', 'W'].includes(e.key)) {
          e.preventDefault();
        }
        
        switch (e.key) {
          case 'Escape':
            // ESC key - go to Sales page
            setShowSuccessModal(false);
            navigate('/sales');
            break;
          case 'n':
          case 'N':
            // N key - New bill
            setShowSuccessModal(false);
            resetForm();
            break;
          case 'd':
          case 'D':
            // D key - View details
            setShowSuccessModal(false);
            navigate(`/sales/${savedSaleId}`);
            break;
          case 'p':
          case 'P':
            // P key - Print bill
            handlePrintBill();
            break;
          case 'w':
          case 'W':
            // W key - Send WhatsApp
            handleSendWhatsApp();
            break;
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
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
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Invoice #{invoiceNumber} has been created and saved.
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
                  onClick={handlePrintBill}
                  className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors text-sm font-medium"
                >
                  Print Bill (P)
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
          <button
            onClick={() => navigate('/sales')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
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
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Select Customer/Vendor</label>
                <CustomerSearch 
                  customers={customers}
                  value={selectedCustomer?.opticalName || ''}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  onSelect={handleCustomerSelect}
                  onAddNew={handleAddNewCustomer}
                  onViewLedger={handleViewLedger}
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
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {getVisibleRows().map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
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
                  
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.sph}
                      onChange={(e) => handleTableRowChange(index, 'sph', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'sph', e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="SPH"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.cyl}
                      onChange={(e) => handleTableRowChange(index, 'cyl', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'cyl', e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="CYL"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.axis}
                      onChange={(e) => handleTableRowChange(index, 'axis', e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="AXIS"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.add}
                      onChange={(e) => handleTableRowChange(index, 'add', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'add', e.target.value)}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="ADD"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.qty}
                      onChange={(e) => handleTableRowChange(index, 'qty', e.target.value)}
                      onFocus={(e) => {
                        // Clear default value of 1 when focused
                        if (e.target.value === '1') {
                          handleTableRowChange(index, 'qty', '');
                        }
                      }}
                      className="block w-full border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="QTY"
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
                      <option value="Pack">Pack</option>
                      <option value="Box">Box</option>
                    </select>
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.price}
                      onChange={(e) => handleTableRowChange(index, 'price', e.target.value)}
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
            <button
              type="button"
              onClick={handleSaveSale}
              disabled={loading}
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
                                        {log.date}
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
            // Print modal closed
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
    </div>
  );
};

export default CreateSale; 
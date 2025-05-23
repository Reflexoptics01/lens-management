import { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, getDoc, doc, addDoc, serverTimestamp, query, where, orderBy, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomerSearch from '../components/CustomerSearch';
import CustomerForm from '../components/CustomerForm';
import ItemSuggestions from '../components/ItemSuggestions';
import FallbackInvoicePrint from '../components/FallbackInvoicePrint';
import BottomActionBar from '../components/BottomActionBar';
import { Timestamp } from 'firebase/firestore';

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Invoice details
  const [invoiceNumber, setInvoiceNumber] = useState('');
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
    price: 0,
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
      price: 0,
      total: 0
    }));
    
    setTableRows([...tableRows, ...newRows]);
  };

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [savedSaleId, setSavedSaleId] = useState(null);

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
  const [showFallbackPrint, setShowFallbackPrint] = useState(false);

  // Add state for dispatch logs
  const [dispatchLogs, setDispatchLogs] = useState([]);
  const [showDispatchLogs, setShowDispatchLogs] = useState(false);
  const [searchLogQuery, setSearchLogQuery] = useState('');
  const [isSearchingLogs, setIsSearchingLogs] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

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
    generateInvoiceNumber();
    fetchItems();
  }, []);

  // Add useEffect to fetch dispatch logs when invoice date changes
  useEffect(() => {
    if (invoiceDate) {
      fetchDispatchLogs(invoiceDate);
    }
  }, [invoiceDate]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, orderBy('opticalName'));
      const snapshot = await getDocs(q);
      const customersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  };

  const generateInvoiceNumber = async () => {
    try {
      // Get the current financial year from settings
      const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
      if (!settingsDoc.exists()) {
        throw new Error('Settings not found');
      }
      
      const settings = settingsDoc.data();
      const financialYear = settings.financialYear;
      
      if (!financialYear) {
        // If no financial year is set, fall back to old method
        const salesRef = collection(db, 'sales');
        const snapshot = await getDocs(salesRef);
        const newInvoiceNumber = `INV-${(snapshot.docs.length + 1).toString().padStart(4, '0')}`;
        setInvoiceNumber(newInvoiceNumber);
        return;
      }
      
      // Get or create the counter document for this financial year
      const counterRef = doc(db, 'counters', `invoices_${financialYear}`);
      const counterDoc = await getDoc(counterRef);
      
      let counter;
      if (!counterDoc.exists()) {
        // If counter doesn't exist, create it
        counter = {
          count: 0,
          prefix: financialYear,
          separator: '/',
          format: '${prefix}${separator}${number}'
        };
        await setDoc(counterRef, {
          ...counter,
          createdAt: serverTimestamp()
        });
      } else {
        counter = counterDoc.data();
      }
      
      // Increment the counter
      const newCount = (counter.count || 0) + 1;
      
      // Update the counter in Firestore
      await updateDoc(counterRef, {
        count: newCount,
        updatedAt: serverTimestamp()
      });
      
      // Format the invoice number
      const paddedNumber = newCount.toString().padStart(2, '0');
      
      // Use the format specified in the counter or fall back to default
      let invoiceNumber;
      if (counter.format) {
        // Replace placeholders in the format string
        invoiceNumber = counter.format
          .replace('${prefix}', counter.prefix || '')
          .replace('${separator}', counter.separator || '')
          .replace('${number}', paddedNumber);
      } else {
        // Default format if none specified
        invoiceNumber = `${counter.prefix || financialYear}${counter.separator || '/'}${paddedNumber}`;
      }
      
      setInvoiceNumber(invoiceNumber);
    } catch (error) {
      console.error('Error generating invoice number:', error);
      // Fall back to the old method if there's an error
      try {
        const salesRef = collection(db, 'sales');
        const snapshot = await getDocs(salesRef);
        const newInvoiceNumber = `INV-${(snapshot.docs.length + 1).toString().padStart(4, '0')}`;
        setInvoiceNumber(newInvoiceNumber);
      } catch (fallbackError) {
        console.error('Error in fallback invoice numbering:', fallbackError);
        setInvoiceNumber('ERROR-GENERATING-NUMBER');
      }
    }
  };

  const handleCustomerSelect = (customer) => {
    // Selected customer from search suggestions
    setSelectedCustomer(customer);
    if (customer) {
      const balance = customer.openingBalance || 0;
      setCustomerBalance(balance);
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
      
      console.log(`Fetching details for order ${orderId}`);
      
      // First, try the exact display ID as entered
      let orderDoc = null;
      let snapshot = null;
      
      // Try with the original displayId
        const ordersRef = collection(db, 'orders');
      let q = query(ordersRef, where('displayId', '==', orderId));
      snapshot = await getDocs(q);
        
      // If no results, try with padding
      if (snapshot.empty) {
        console.log(`No order found with display ID: "${orderId}", trying with padding`);
        const paddedDisplayId = orderId.toString().padStart(3, '0');
        console.log(`Trying with padded display ID: "${paddedDisplayId}"`);
        
        q = query(ordersRef, where('displayId', '==', paddedDisplayId));
        snapshot = await getDocs(q);
        
        if (snapshot.empty) {
          console.log(`No order found with padded display ID: "${paddedDisplayId}" either`);
          return;
        }
      }
      
      if (!snapshot.empty) {
        orderDoc = snapshot.docs[0];

      if (orderDoc && orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() };
          console.log(`Found order: ${orderData.id} with display ID: ${orderData.displayId}`);
        
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
        console.log('Cannot deduct: No orderData or orderData.id available', orderData);
        return;
      }
      
      console.log('Attempting to deduct lenses for order:', orderData.id, 'with display ID:', orderData.displayId);
      
      // Check order status - only deduct from inventory for valid statuses
      const validStatuses = ['RECEIVED', 'DISPATCHED', 'DELIVERED'];
      if (!validStatuses.includes(orderData.status)) {
        console.log(`Not deducting from inventory due to order status: ${orderData.status}`);
        return;
      }
      
      // First try searching by orderId
      console.log('Searching for lenses with orderId:', orderData.id);
      const lensRef = collection(db, 'lens_inventory');
      let q = query(lensRef, where('orderId', '==', orderData.id));
      let snapshot = await getDocs(q);
      
      // If no lenses found by orderId, try by orderDisplayId
      if (snapshot.empty && orderData.displayId) {
        console.log('No lenses found with orderId, trying orderDisplayId:', orderData.displayId);
        q = query(lensRef, where('orderDisplayId', '==', orderData.displayId));
        snapshot = await getDocs(q);
        
        // Try with padded displayId too
        if (snapshot.empty) {
          const paddedDisplayId = orderData.displayId.toString().padStart(3, '0');
          console.log('Still no lenses found, trying with padded orderDisplayId:', paddedDisplayId);
          q = query(lensRef, where('orderDisplayId', '==', paddedDisplayId));
          snapshot = await getDocs(q);
        }
      }
      
      if (snapshot.empty) {
        console.log('No lenses found in inventory for this order ID or display ID');
        return;
      }
      
      console.log(`Found ${snapshot.docs.length} lenses in inventory for order ${orderData.id}`);
      
      // Process each lens in inventory
      const batch = [];
      snapshot.docs.forEach(lensDoc => {
        const lens = lensDoc.data();
        const lensId = lensDoc.id;
        
        console.log(`Processing lens ${lensId}, current qty: ${lens.qty}`);
        
        // Determine if we should deduct or delete
        if (lens.qty > 1) {
          // Deduct one from the quantity
          batch.push({
            id: lensId,
            action: 'update',
            data: {
              qty: lens.qty - 1,
              updatedAt: Timestamp.now()
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
        const lensDocRef = doc(db, 'lens_inventory', operation.id);
        
        if (operation.action === 'update') {
          await updateDoc(lensDocRef, operation.data);
          console.log(`Updated lens quantity for ${operation.id}`);
        } else if (operation.action === 'delete') {
          await deleteDoc(lensDocRef);
          console.log(`Removed lens ${operation.id} from inventory`);
        }
      }
      
      console.log(`Processed ${batch.length} lenses from inventory for order ${orderData.id}`);
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

      // Create sale document
      const saleData = {
        invoiceNumber,
        invoiceDate: new Date(invoiceDate),
        dueDate: dueDate ? new Date(dueDate) : null,
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.opticalName,
        customerAddress: selectedCustomer.address,
        customerCity: selectedCustomer.city,
        customerState: selectedCustomer.state,
        customerGst: selectedCustomer.gstNumber,
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

      const docRef = await addDoc(collection(db, 'sales'), saleData);
      
      // Process all order IDs to mark lenses as sold in inventory
      await processOrderIdsForInventory(filledRows);
      
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
        console.log('No order IDs to process for inventory');
        return;
      }
      
      console.log(`Processing ${orderIds.length} order IDs for inventory:`, orderIds);
      
      // For each order ID, find the actual order document
      for (const displayId of orderIds) {
        try {
          console.log(`Looking up order by displayId: "${displayId}"`);
          
          // Find the order by displayId
          const ordersRef = collection(db, 'orders');
          const q = query(ordersRef, where('displayId', '==', displayId));
          const snapshot = await getDocs(q);
          
          if (snapshot.empty) {
            console.log(`No order found with display ID: "${displayId}"`);
            
            // Try with padding to see if that helps
            const paddedDisplayId = displayId.toString().padStart(3, '0');
            console.log(`Trying with padded display ID: "${paddedDisplayId}"`);
            
            const q2 = query(ordersRef, where('displayId', '==', paddedDisplayId));
            const snapshot2 = await getDocs(q2);
            
            if (snapshot2.empty) {
              console.log(`No order found with padded display ID: "${paddedDisplayId}" either`);
              continue;
            } else {
              console.log(`Found order with padded display ID: "${paddedDisplayId}"`);
              const orderDoc = snapshot2.docs[0];
              const orderData = { id: orderDoc.id, ...orderDoc.data() };
              
              console.log(`Order details: ID=${orderData.id}, Status=${orderData.status}, DisplayID=${orderData.displayId}`);
              
              // Skip orders with invalid statuses
              const invalidStatuses = ['PENDING', 'PLACED', 'CANCELLED', 'DECLINED'];
              if (invalidStatuses.includes(orderData.status)) {
                console.log(`Skipping order ${paddedDisplayId} due to status: ${orderData.status}`);
                continue;
              }
              
              // Mark this order as DELIVERED in the orders collection
              await updateDoc(doc(db, 'orders', orderData.id), {
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
          
          // Mark this order as DELIVERED in the orders collection
          await updateDoc(doc(db, 'orders', orderData.id), {
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

  const handlePrintBill = () => {
    if (savedSaleId) {
      // Use the FallbackInvoicePrint component for printing
      setShowFallbackPrint(true);
      // Don't trigger automatic printing - let user click the Print Now button
    } else {
      setError('No sale ID found. Please save the invoice first.');
    }
  };

  const handleSendWhatsApp = () => {
    if (!selectedCustomer || !selectedCustomer.phone) return;
    
    const phone = selectedCustomer.phone.replace(/[^0-9+]/g, '');
    const total = calculateTotal().toLocaleString('en-IN', {
      style: 'currency',
      currency: 'INR'
    });
    
    const message = 
      `*Invoice from PRISM OPTICAL*\n\n` +
      `Dear ${selectedCustomer.opticalName},\n\n` +
      `Your invoice ${invoiceNumber} has been generated for amount ${total}.\n\n` +
      `Thank you for your business!\n` +
      `For any questions, please contact us.`;
    
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
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
      // Fetch regular items from 'items' collection
      const itemsRef = collection(db, 'items');
      const itemsSnapshot = await getDocs(itemsRef);
      
      // Create a map to deduplicate items by name
      const uniqueItems = {};
      
      itemsSnapshot.docs.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };
        const normalizedName = item.name.trim().toLowerCase();
        
        // Only keep the latest version of each item (by name)
        if (!uniqueItems[normalizedName] || 
            (item.updatedAt && uniqueItems[normalizedName].updatedAt && 
             item.updatedAt.toDate() > uniqueItems[normalizedName].updatedAt.toDate())) {
          uniqueItems[normalizedName] = item;
        }
      });

      // Fetch stock lenses from 'lens_inventory' collection
      const lensRef = collection(db, 'lens_inventory');
      const q = query(lensRef, where('type', '==', 'stock'));
      const lensSnapshot = await getDocs(q);
      
      // Add stock lenses to the unique items
      lensSnapshot.docs.forEach(doc => {
        const lens = { id: doc.id, ...doc.data() };
        
        // Create a unique name that includes brand and power series
        const itemName = `${lens.brandName || ''} ${lens.powerSeries || ''}`.trim();
        if (itemName) {
          const normalizedName = itemName.toLowerCase();
          
          // Add to uniqueItems if it doesn't exist or if this is a newer entry
          if (!uniqueItems[normalizedName] || 
              (lens.createdAt && uniqueItems[normalizedName].createdAt && 
               lens.createdAt.toDate() > uniqueItems[normalizedName].createdAt.toDate())) {
            uniqueItems[normalizedName] = {
              id: lens.id,
              name: itemName,
              price: lens.salePrice || 0,
              createdAt: lens.createdAt,
              isStockLens: true,
              stockData: lens
            };
          }
        }
      });
      
      // Convert to array and sort by name
      const itemsList = Object.values(uniqueItems).sort((a, b) => 
        a.name.toLowerCase().localeCompare(b.name.toLowerCase())
      );
      
      console.log("Fetched unique items:", itemsList.length);
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
      const itemsRef = collection(db, 'items');
      
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
        console.log(`Created new item: ${normalizedName} - ₹${price}`);
      } else {
        // Update existing item
        const existingItem = snapshot.docs[0];
        await updateDoc(doc(db, 'items', existingItem.id), {
          price: parseFloat(price) || 0,
          updatedAt: serverTimestamp()
        });
        console.log(`Updated existing item: ${normalizedName} - ₹${price}`);
      }
      
      // Refresh items list
      await fetchItems();
    } catch (error) {
      console.error('Error saving item:', error);
    }
  };

  // Handle item selection from the ItemSuggestions component
  const handleItemSelect = (index, itemData) => {
    const updatedRows = [...tableRows];
    
    // Check if this is a stock lens item
    if (itemData.isStockLens && itemData.stockData) {
      const stockData = itemData.stockData;
      
      // For stock lenses, we can pre-populate power series info
      updatedRows[index] = {
        ...updatedRows[index],
        itemName: itemData.name,
        price: parseFloat(stockData.salePrice || 0),
        total: parseFloat(stockData.salePrice || 0) * parseInt(updatedRows[index].qty || 1),
        // Additional stock lens info that might be useful
        powerSeries: stockData.powerSeries || ''
      };
    } else {
      // Regular item handling (unchanged)
      updatedRows[index] = {
        ...updatedRows[index],
        ...itemData // This contains itemName, price, and total
      };
    }
    
    setTableRows(updatedRows);
  };

  // Add function to fetch dispatch logs
  const fetchDispatchLogs = async (date) => {
    try {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      
      const dispatchRef = collection(db, 'dispatch_logs');
      const q = query(
        dispatchRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      // Group entries by logId
      const groupedLogs = {};
      snapshot.docs.forEach(doc => {
        const log = { id: doc.id, ...doc.data() };
        if (!groupedLogs[log.logId]) {
          groupedLogs[log.logId] = {
            logId: log.logId,
            opticalName: log.opticalName,
            entries: []
          };
        }
        groupedLogs[log.logId].entries.push(log);
      });
      
      // Convert to array for rendering
      const logsArray = Object.values(groupedLogs);
      setDispatchLogs(logsArray);
    } catch (error) {
      console.error('Error fetching dispatch logs:', error);
    }
  };
  
  // Add function to import dispatch log entries to invoice
  const importDispatchLog = (log) => {
    console.log("Importing dispatch log:", log);
    
    // First check if we have a customer selected
    if (!selectedCustomer) {
      // Check if the optical name matches one of our customers
      const matchingCustomer = customers.find(
        customer => customer.opticalName === log.opticalName
      );
      
      if (matchingCustomer) {
        handleCustomerSelect(matchingCustomer);
      } else {
        setError(`Please select a customer first or ensure the optical name "${log.opticalName}" matches a customer in your system.`);
        return;
      }
    }
    
    try {
      // Create blank rows just like when we initialize the form
      // Using the exact same structure as when we initialize tableRows in the component
      const importedRows = Array(log.entries.length * 2).fill().map(() => ({
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
      }));
      
      // Now fill in the data from log entries
      log.entries.forEach((entry, index) => {
        const rightIdx = index * 2;
        const leftIdx = index * 2 + 1;
        
        // Base item name without log reference
        const baseName = entry.lensName || 'Lens';
        
        // Check if we have right eye data
        if (entry.rightSph || entry.rightCyl || entry.rightAxis || entry.rightAdd || entry.rightQty) {
          importedRows[rightIdx].itemName = `${baseName} - RIGHT`;
          importedRows[rightIdx].orderId = log.logId; // Put log ID in order ID field
          importedRows[rightIdx].sph = entry.rightSph || '';
          importedRows[rightIdx].cyl = entry.rightCyl || '';
          importedRows[rightIdx].axis = entry.rightAxis || '';
          importedRows[rightIdx].add = entry.rightAdd || '';
          importedRows[rightIdx].qty = parseInt(entry.rightQty || 1);
        }
        
        // Check if we have left eye data
        if (entry.leftSph || entry.leftCyl || entry.leftAxis || entry.leftAdd || entry.leftQty) {
          importedRows[leftIdx].itemName = `${baseName} - LEFT`;
          importedRows[leftIdx].orderId = log.logId; // Put log ID in order ID field
          importedRows[leftIdx].sph = entry.leftSph || '';
          importedRows[leftIdx].cyl = entry.leftCyl || '';
          importedRows[leftIdx].axis = entry.leftAxis || '';
          importedRows[leftIdx].add = entry.leftAdd || '';
          importedRows[leftIdx].qty = parseInt(entry.leftQty || 1);
        }
      });
      
      // Filter out empty rows (where itemName is still empty)
      const validRows = importedRows.filter(row => row.itemName !== '');
      
      console.log("Valid imported rows:", validRows);
      
      // Add imported rows to the top of the table
      // First check if we have any existing filled rows
      const existingFilledRows = tableRows.filter(row => row.itemName.trim() !== '');
      const existingEmptyRows = tableRows.filter(row => row.itemName.trim() === '');
      
      // If we have some filled rows, put new rows after them, otherwise at the top
      let newTableRows;
      
      if (existingFilledRows.length > 0) {
        // Add the imported rows after the last filled row
        newTableRows = [
          ...existingFilledRows,
          ...validRows,
          ...existingEmptyRows
        ];
      } else {
        // Add imported rows at the top, then the empty rows
        newTableRows = [
          ...validRows,
          ...existingEmptyRows
        ];
      }
      
      // Update state with the new combined array
      setTableRows(newTableRows);
      
      // Give a success message
      console.log(`Successfully imported ${validRows.length} items from dispatch log`);
      setError(''); // Clear any previous errors
      
    } catch (error) {
      console.error("Error importing dispatch log:", error);
      setError(`Failed to import: ${error.message}`);
    }
    
    // Close the dispatch logs modal
    setShowDispatchLogs(false);
  };

  // Add function to fetch dispatch logs by search query
  const searchDispatchLogs = async (query) => {
    if (!query || query.trim() === '') {
      setSearchResults([]);
      return;
    }
    
    try {
      setIsSearchingLogs(true);
      
      // Normalize the search query to lowercase for case-insensitive comparison
      const normalizedQuery = query.toLowerCase().trim();
      
      // Get all dispatch logs (limited to last 100 days to avoid too much data)
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 100); // Last 100 days
      
      const dispatchRef = collection(db, 'dispatch_logs');
      const q = query(
        dispatchRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'desc')
      );
      
      const snapshot = await getDocs(q);
      
      // First group by logId
      const groupedLogs = {};
      snapshot.docs.forEach(doc => {
        const log = { id: doc.id, ...doc.data() };
        
        // Skip if this doesn't match our search
        const matchesLogId = log.logId && log.logId.toLowerCase().includes(normalizedQuery);
        const matchesOpticalName = log.opticalName && log.opticalName.toLowerCase().includes(normalizedQuery);
        const matchesLensName = log.lensName && log.lensName.toLowerCase().includes(normalizedQuery);
        
        if (!matchesLogId && !matchesOpticalName && !matchesLensName) {
          return;
        }
        
        if (!groupedLogs[log.logId]) {
          groupedLogs[log.logId] = {
            logId: log.logId,
            opticalName: log.opticalName,
            date: log.date,
            entries: []
          };
        }
        
        groupedLogs[log.logId].entries.push(log);
      });
      
      // Convert to array and sort by date (newest first)
      const searchResultsArray = Object.values(groupedLogs).sort((a, b) => {
        // Convert to JavaScript Date objects if they're Firestore timestamps
        const dateA = a.date && a.date.toDate ? a.date.toDate() : new Date(a.date);
        const dateB = b.date && b.date.toDate ? b.date.toDate() : new Date(b.date);
        return dateB - dateA;
      });
      
      setSearchResults(searchResultsArray);
    } catch (error) {
      console.error('Error searching dispatch logs:', error);
    } finally {
      setIsSearchingLogs(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create Invoice</h1>
            <p className="text-sm text-gray-500">Create a new sales invoice</p>
          </div>
          <button
            onClick={() => navigate('/sales')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700">
            <p>{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Customer Information</h2>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Customer</label>
                <CustomerSearch 
                  customers={customers}
                  value={selectedCustomer?.opticalName || ''}
                  onChange={(e) => setSearchCustomer(e.target.value)}
                  onSelect={handleCustomerSelect}
                  onAddNew={handleAddNewCustomer}
                />
              </div>

              {selectedCustomer && (
                <div className="border border-gray-200 rounded-md p-4 bg-gray-50">
                  <h3 className="font-medium text-gray-900">{selectedCustomer.opticalName}</h3>
                  {selectedCustomer.address && (
                    <p className="text-sm text-gray-500 mt-1">{selectedCustomer.address}</p>
                  )}
                  {(selectedCustomer.city || selectedCustomer.state) && (
                    <p className="text-sm text-gray-500">
                      {selectedCustomer.city}{selectedCustomer.state ? `, ${selectedCustomer.state}` : ''}
                    </p>
                  )}
                  {selectedCustomer.gstNumber && (
                    <p className="text-sm text-gray-500 mt-1">
                      <span className="font-medium">GST:</span> {selectedCustomer.gstNumber}
                    </p>
                  )}
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-sm">
                      <span className="font-medium">Previous Balance:</span> 
                      <span className={`ml-2 ${customerBalance < 0 ? 'text-red-600' : customerBalance > 0 ? 'text-green-600' : 'text-gray-600'}`}>
                        {formatCurrency(customerBalance)}
                      </span>
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-4">Invoice Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Invoice Number</label>
                  <input
                    type="text"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                    readOnly
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Invoice Date</label>
                  <input
                    type="date"
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Due Date (Optional)</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500"
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
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-900">Invoice Items</h2>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => setShowDispatchLogs(true)}
                className="ml-2 px-3 py-1 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 text-sm flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Import from Dispatch Log
              </button>
              <div className="text-sm text-gray-500 ml-4">
                Showing {getVisibleRows().length} of {tableRows.length} rows
              </div>
            </div>
          </div>
          
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[100px]">
                  Order ID
                </th>
                <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[260px]">
                  Item Name
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  SPH
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  CYL
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  AXIS
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  ADD
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  QTY
                </th>
                <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  UNIT
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Price
                </th>
                <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {getVisibleRows().map((row, index) => (
                <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.orderId}
                      onChange={(e) => handleTableRowChange(index, 'orderId', e.target.value)}
                      onBlur={(e) => fetchOrderDetails(e.target.value, index)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                      placeholder="Order ID"
                    />
                  </td>
                  
                  <td className="px-3 py-2 whitespace-nowrap relative w-[260px]">
                    <ItemSuggestions
                      items={itemSuggestions}
                      value={row.itemName}
                      onChange={handleTableRowChange}
                      onSelect={handleItemSelect}
                      index={index}
                      rowQty={row.qty}
                      saveItemToDatabase={saveItemToDatabase}
                    />
                    {row.powerSeries && (
                      <div className="text-xs text-emerald-600 mt-1">
                        {row.powerSeries}
                      </div>
                    )}
                  </td>
                  
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.sph}
                      onChange={(e) => handleTableRowChange(index, 'sph', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'sph', e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center"
                      placeholder="SPH"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.cyl}
                      onChange={(e) => handleTableRowChange(index, 'cyl', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'cyl', e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center"
                      placeholder="CYL"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.axis}
                      onChange={(e) => handleTableRowChange(index, 'axis', e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center"
                      placeholder="AXIS"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="text"
                      value={row.add}
                      onChange={(e) => handleTableRowChange(index, 'add', e.target.value)}
                      onBlur={(e) => handleOpticalValueBlur(index, 'add', e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center"
                      placeholder="ADD"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <input
                      type="number"
                      value={row.qty}
                      onChange={(e) => handleTableRowChange(index, 'qty', e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center"
                      placeholder="QTY"
                      min="1"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <select
                      value={row.unit}
                      onChange={(e) => handleTableRowChange(index, 'unit', e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center"
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
                      type="number"
                      value={row.price}
                      onChange={(e) => handleTableRowChange(index, 'price', e.target.value)}
                      className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-right"
                      placeholder="Price"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-right">
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
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                Show All Rows ({tableRows.length})
              </button>
            )}
            
            {showAllRows && (
              <button
                type="button"
                onClick={() => setShowAllRows(false)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
                Show Less
              </button>
            )}
            
            <button
              type="button"
              onClick={() => addMoreRows(5)}
              className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            >
              <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add 5 More Rows
            </button>
            
            {tableRows.length >= 50 && (
              <button
                type="button"
                onClick={() => addMoreRows(10)}
                className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
              >
                <svg className="mr-2 h-4 w-4 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Additional Charges</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Option</label>
                <select
                  value={selectedTaxOption}
                  onChange={(e) => setSelectedTaxOption(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                >
                  {TAX_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Discount</label>
                <div className="flex space-x-2">
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value)}
                    className="block w-1/3 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                  >
                    <option value="amount">Amount</option>
                    <option value="percentage">Percentage</option>
                  </select>
                  <input
                    type="number"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="block w-2/3 border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    placeholder={discountType === 'amount' ? "Discount Amount" : "Discount %"}
                    min="0"
                    step={discountType === 'amount' ? "0.01" : "0.1"}
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Freight Charge</label>
                <input
                  type="number"
                  value={frieghtCharge}
                  onChange={(e) => setFrieghtCharge(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                  placeholder="Freight/Shipping Charge"
                  min="0"
                  step="0.01"
                />
              </div>

              {paymentStatus !== 'UNPAID' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Amount Paid</label>
                  <input
                    type="number"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                    placeholder="Amount Paid"
                    min="0"
                    step="0.01"
                  />
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                  placeholder="Additional information or special instructions"
                  rows="3"
                ></textarea>
              </div>
            </div>
          </div>
          
          {/* Summary Section */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Invoice Summary</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-medium">{formatCurrency(calculateSubtotal())}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Discount:</span>
                <span className="text-red-500">-{formatCurrency(calculateDiscountAmount())}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">
                  Tax ({getTaxOption(selectedTaxOption).label}):
                </span>
                <span className="text-gray-800">{formatCurrency(calculateTaxAmount())}</span>
              </div>
              
              <div className="flex justify-between py-2 border-b border-gray-100">
                <span className="text-gray-600">Freight Charge:</span>
                <span className="text-gray-800">{formatCurrency(parseFloat(frieghtCharge || 0))}</span>
              </div>
              
              <div className="flex justify-between py-3 border-b border-gray-200 text-lg">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="font-bold text-sky-700">{formatCurrency(calculateTotal())}</span>
              </div>
              
              {paymentStatus !== 'UNPAID' && (
                <>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Amount Paid:</span>
                    <span className="text-green-600">{formatCurrency(parseFloat(amountPaid || 0))}</span>
                  </div>
                  
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Balance Due:</span>
                    <span className="font-semibold text-red-600">
                      {formatCurrency(Math.max(0, calculateTotal() - parseFloat(amountPaid || 0)))}
                    </span>
                  </div>
                </>
              )}
            </div>
            
            {/* Replace the button with BottomActionBar on mobile */}
            <div className="mt-6 desktop-only">
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
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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

        {/* Mobile Save Button - Fixed at bottom*/}
        <div className="mobile-only">
          <BottomActionBar fixed={true} bgColor="bg-gray-50">
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
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
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
        {showSuccessModal && (
          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
                      <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Invoice Created Successfully
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Your invoice has been successfully created and saved.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handlePrintBill}
                    className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm"
                    disabled={loading}
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                    </svg>
                    Print Bill
                  </button>
                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-teal-600 text-base font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:w-auto sm:text-sm"
                    disabled={loading}
                  >
                    <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    Send via WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/sales')}
                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:w-auto sm:text-sm"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Dispatch Logs Modal */}
        {showDispatchLogs && (
          <div className="fixed inset-0 overflow-y-auto z-50">
            <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
              <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
              </div>

              <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

              <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
                <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                  <div className="sm:flex sm:items-start">
                    <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                      <div className="flex justify-between items-center">
                        <h3 className="text-lg leading-6 font-medium text-gray-900">
                          Dispatch Logs
                        </h3>
                        <button
                          type="button"
                          onClick={() => setShowDispatchLogs(false)}
                          className="text-gray-400 hover:text-gray-500"
                        >
                          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      
                      <div className="mt-4 border-b border-gray-200 pb-4">
                        <div className="flex flex-col md:flex-row md:items-center gap-3">
                          <div className="flex-grow">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Search by Log ID, Optical Name, or Lens Name
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={searchLogQuery}
                                onChange={(e) => setSearchLogQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && searchDispatchLogs(searchLogQuery)}
                                placeholder="Enter search term..."
                                className="flex-grow px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Today's Logs
                            </label>
                            <button
                              type="button"
                              onClick={() => {
                                setSearchLogQuery('');
                                setSearchResults([]);
                              }}
                              className="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-700 hover:bg-gray-100"
                            >
                              Show Today's Logs
                            </button>
                          </div>
                        </div>
                      </div>
                      
                      <div className="mt-4 max-h-[60vh] overflow-y-auto">
                        {isSearchingLogs ? (
                          <div className="flex justify-center py-8">
                            <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                          </div>
                        ) : searchResults.length > 0 ? (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Search Results:</h4>
                            <ul className="space-y-3">
                              {searchResults.map(log => (
                                <li key={log.logId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-medium text-gray-900">{log.opticalName}</h4>
                                      <p className="text-sm text-gray-500">
                                        Log ID: {log.logId} ({log.entries.length} items) - 
                                        {log.date && (log.date.toDate ? 
                                          log.date.toDate().toLocaleDateString() : 
                                          new Date(log.date).toLocaleDateString()
                                        )}
                                      </p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => importDispatchLog(log)}
                                      className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-sm"
                                    >
                                      Import
                                    </button>
                                  </div>
                                  <div className="mt-2">
                                    <ul className="text-sm text-gray-600">
                                      {log.entries.slice(0, 3).map((entry, idx) => (
                                        <li key={idx} className="truncate">• {entry.lensName}</li>
                                      ))}
                                      {log.entries.length > 3 && (
                                        <li className="text-gray-400">+ {log.entries.length - 3} more items</li>
                                      )}
                                    </ul>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : dispatchLogs.length === 0 ? (
                          <p className="text-gray-500 text-center py-4">No dispatch logs found for {new Date(invoiceDate).toLocaleDateString()}</p>
                        ) : (
                          <div>
                            <h4 className="text-sm font-medium text-gray-500 mb-2">Today's Logs ({new Date(invoiceDate).toLocaleDateString()}):</h4>
                            <ul className="space-y-3">
                              {dispatchLogs.map(log => (
                                <li key={log.logId} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <h4 className="font-medium text-gray-900">{log.opticalName}</h4>
                                      <p className="text-sm text-gray-500">Log ID: {log.logId} ({log.entries.length} items)</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => importDispatchLog(log)}
                                      className="px-3 py-1 bg-green-100 text-green-700 rounded-md hover:bg-green-200 text-sm"
                                    >
                                      Import
                                    </button>
                                  </div>
                                  <div className="mt-2">
                                    <ul className="text-sm text-gray-600">
                                      {log.entries.slice(0, 3).map((entry, idx) => (
                                        <li key={idx} className="truncate">• {entry.lensName}</li>
                                      ))}
                                      {log.entries.length > 3 && (
                                        <li className="text-gray-400">+ {log.entries.length - 3} more items</li>
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
                  <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                    <button
                      type="button"
                      onClick={() => setShowDispatchLogs(false)}
                      className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
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
      
      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerForm 
          onClose={handleCustomerFormClose}
          customer={null}
        />
      )}

      {/* Fallback Print Component */}
      {showFallbackPrint && savedSaleId && (
        <FallbackInvoicePrint 
          saleId={savedSaleId} 
          onClose={() => setShowFallbackPrint(false)}
          autoPrint={false}
        />
      )}
    </div>
  );
};

export default CreateSale; 
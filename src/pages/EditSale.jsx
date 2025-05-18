import { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, getDoc, doc, updateDoc, serverTimestamp, query, where, orderBy, setDoc, addDoc } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomerSearch from '../components/CustomerSearch';
import CustomerForm from '../components/CustomerForm';
import ItemSuggestions from '../components/ItemSuggestions';
import PrintInvoiceModal from '../components/PrintInvoiceModal';

const TAX_OPTIONS = [
  { id: 'TAX_FREE', label: 'Tax Free', rate: 0 },
  { id: 'GST_6', label: 'GST 6%', rate: 6 },
  { id: 'GST_12', label: 'GST 12%', rate: 12 },
  { id: 'GST_18', label: 'GST 18%', rate: 18 },
  { id: 'CGST_SGST_6', label: 'CGST/SGST 6%', rate: 6, split: true },
  { id: 'CGST_SGST_12', label: 'CGST/SGST 12%', rate: 12, split: true },
  { id: 'CGST_SGST_18', label: 'CGST/SGST 18%', rate: 18, split: true },
  { id: 'IGST_6', label: 'IGST 6%', rate: 6 },
  { id: 'IGST_12', label: 'IGST 12%', rate: 12 },
  { id: 'IGST_18', label: 'IGST 18%', rate: 18 }
];

const EditSale = () => {
  const navigate = useNavigate();
  const { saleId } = useParams();
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
  const [tableRows, setTableRows] = useState([]);

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
  
  // Add state for item suggestions (only keep what's needed)
  const [itemSuggestions, setItemSuggestions] = useState([]);

  // Change the PDF modal state
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Fetch sale data and customers when component mounts
  useEffect(() => {
    fetchCustomers();
    fetchSaleData();
    fetchItems();
  }, [saleId]);

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

  const fetchSaleData = async () => {
    try {
      setLoading(true);
      const saleDoc = await getDoc(doc(db, 'sales', saleId));
      
      if (!saleDoc.exists()) {
        setError('Sale not found');
        return;
      }
      
      const saleData = saleDoc.data();
      
      // Set invoice details
      setInvoiceNumber(saleData.invoiceNumber || '');
      setInvoiceDate(saleData.invoiceDate?.toDate?.().toISOString().split('T')[0] || new Date().toISOString().split('T')[0]);
      setDueDate(saleData.dueDate?.toDate?.().toISOString().split('T')[0] || '');
      setSelectedTaxOption(saleData.taxOption || TAX_OPTIONS[0].id);
      setDiscountType(saleData.discountType || 'amount');
      setDiscountValue(saleData.discountValue || 0);
      setFrieghtCharge(saleData.frieghtCharge || 0);
      setNotes(saleData.notes || '');
      setPaymentStatus(saleData.paymentStatus || 'UNPAID');
      setAmountPaid(saleData.amountPaid || 0);
      
      // Set customer
      if (saleData.customerId) {
        const customer = { 
          id: saleData.customerId,
          opticalName: saleData.customerName,
          city: saleData.customerCity,
          address: saleData.customerAddress,
          state: saleData.customerState,
          gstNumber: saleData.customerGst
        };
        setSelectedCustomer(customer);
      }
      
      // Set table rows
      if (saleData.items && saleData.items.length > 0) {
        setTableRows(saleData.items.map(item => ({
          orderId: item.orderId || '',
          orderDetails: null,
          itemName: item.itemName || '',
          sph: item.sph || '',
          cyl: item.cyl || '',
          axis: item.axis || '',
          add: item.add || '',
          qty: item.qty || 1,
          price: item.price || 0,
          total: item.total || 0
        })));
      } else {
        // Default empty rows if no items
        setTableRows(Array(5).fill().map(() => ({
          orderId: '',
          orderDetails: null,
          itemName: '',
          sph: '',
          cyl: '',
          axis: '',
          add: '',
          qty: 1,
          price: 0,
          total: 0
        })));
      }
      
    } catch (error) {
      console.error('Error fetching sale data:', error);
      setError('Failed to fetch sale data');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
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
    if (!orderId || orderId.trim() === '') {
      // Clear the row if order ID is empty
      const updatedRows = [...tableRows];
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        orderId: '',
        orderDetails: null,
        itemName: '',
        sph: '',
        cyl: '',
        axis: '',
        add: '',
        qty: 1,
        price: 0,
        total: 0
      };
      setTableRows(updatedRows);
      return;
    }

    try {
      // First try to find the order by displayId
      let orderDoc = null;
      
      // Check if the input looks like a displayId (like "007")
      const isDisplayIdFormat = /^\d{1,3}$/.test(orderId.trim());
      
      if (isDisplayIdFormat) {
        // Pad the number to ensure it matches format in database (e.g. "7" becomes "007")
        const paddedDisplayId = orderId.trim().padStart(3, '0');
        
        // Search by displayId
        const ordersRef = collection(db, 'orders');
        const q = query(ordersRef, where('displayId', '==', paddedDisplayId));
        const snapshot = await getDocs(q);
        
        if (!snapshot.empty) {
          orderDoc = snapshot.docs[0];
        }
      }
      
      // If not found by displayId, try direct ID lookup
      if (!orderDoc) {
        try {
          orderDoc = await getDoc(doc(db, 'orders', orderId));
        } catch (e) {
          // If direct ID fails, no order was found
          console.log('Order not found by ID:', e);
        }
      }

      if (orderDoc && orderDoc.exists()) {
        const orderData = { id: orderDoc.id, ...orderDoc.data() };
        
        // Update the row with order details
        const updatedRows = [...tableRows];
        updatedRows[rowIndex] = {
          ...updatedRows[rowIndex],
          // Use the displayId for showing in the UI
          orderId: orderData.displayId, 
          orderDetails: orderData,
          itemName: orderData.brandName || '',
          // Extract prescription from either the right or left eye
          sph: orderData.rightSph || orderData.leftSph || '',
          cyl: orderData.rightCyl || orderData.leftCyl || '',
          axis: orderData.rightAxis || orderData.leftAxis || '',
          add: orderData.rightAdd || orderData.leftAdd || '',
          qty: (parseInt(orderData.rightQty || 0) + parseInt(orderData.leftQty || 0)) || 1,
          price: orderData.price || 0,
          total: (orderData.price || 0) * ((parseInt(orderData.rightQty || 0) + parseInt(orderData.leftQty || 0)) || 1)
        };
        setTableRows(updatedRows);
      } else {
        // Order not found, just update the orderId in the row
        const updatedRows = [...tableRows];
        updatedRows[rowIndex] = {
          ...updatedRows[rowIndex],
          orderId
        };
        setTableRows(updatedRows);
        console.log('Order not found');
      }
    } catch (error) {
      console.error('Error fetching order details:', error);
    }
  };

  const handleTableRowChange = (index, field, value) => {
    const updatedRows = [...tableRows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };

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

  const handleUpdateSale = async () => {
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

      // Create updated sale document
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
        items: filledRows.map(row => ({
          orderId: row.orderId,
          itemName: row.itemName,
          sph: row.sph,
          cyl: row.cyl,
          axis: row.axis,
          add: row.add,
          qty: parseInt(row.qty),
          price: parseFloat(row.price),
          total: parseFloat(row.total)
        })),
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
        updatedAt: serverTimestamp()
      };

      await updateDoc(doc(db, 'sales', saleId), saleData);
      
      setSavedSaleId(saleId);
      setShowSuccessModal(true);
      setSuccess(true);
    } catch (error) {
      console.error('Error updating sale:', error);
      setError('Failed to update sale. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintBill = () => {
    if (saleId) {
      setShowPrintModal(true);
    } else {
      setError('Sale ID not found');
    }
  };

  const handleViewPDF = () => {
    // This can now also use the print invoice modal
    if (saleId) {
      setShowPrintModal(true);
    } else {
      setError('Sale ID not found');
    }
  };

  const handleDownloadPDF = () => {
    // You can either implement a direct download feature or use print modal
    if (saleId) {
      setShowPrintModal(true);
    } else {
      setError('Sale ID not found');
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
      `*Updated Invoice from PRISM OPTICAL*\n\n` +
      `Dear ${selectedCustomer.opticalName},\n\n` +
      `Your invoice ${invoiceNumber} has been updated with amount ${total}.\n\n` +
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
      const itemsRef = collection(db, 'items');
      const snapshot = await getDocs(itemsRef);
      
      // Create a map to deduplicate items by name
      const uniqueItems = {};
      
      snapshot.docs.forEach(doc => {
        const item = { id: doc.id, ...doc.data() };
        const normalizedName = item.name.trim().toLowerCase();
        
        // Only keep the latest version of each item (by name)
        if (!uniqueItems[normalizedName] || 
            (item.updatedAt && uniqueItems[normalizedName].updatedAt && 
             item.updatedAt.toDate() > uniqueItems[normalizedName].updatedAt.toDate())) {
          uniqueItems[normalizedName] = item;
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
    updatedRows[index] = {
      ...updatedRows[index],
      ...itemData // This contains itemName, price, and total
    };
    setTableRows(updatedRows);
  };

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Edit Invoice</h1>
            <p className="text-sm text-gray-500">Update sales invoice details</p>
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

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full"></div>
          </div>
        ) : (
          <>
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
                <div className="text-sm text-gray-500">
                  Showing {getVisibleRows().length} of {tableRows.length} rows
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
                      </td>
                      
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={row.sph}
                          onChange={(e) => handleTableRowChange(index, 'sph', e.target.value)}
                          className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm text-center"
                          placeholder="SPH"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="text"
                          value={row.cyl}
                          onChange={(e) => handleTableRowChange(index, 'cyl', e.target.value)}
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
                
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={handleUpdateSale}
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
                      'Update Invoice'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      
      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerForm 
          onClose={handleCustomerFormClose}
          customer={null}
        />
      )}
      
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
                      Invoice Updated Successfully
                    </h3>
                    <div className="mt-2">
                      <p className="text-sm text-gray-500">
                        Your invoice has been successfully updated and saved.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handlePrintBill}
                  className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-indigo-600 text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:w-auto sm:text-sm"
                  disabled={loading}
                >
                  {loading ? 'Processing...' : 'Print Bill'}
                </button>
                <button
                  type="button" 
                  onClick={handleViewPDF}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:w-auto sm:text-sm"
                  disabled={loading}
                >
                  View PDF
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPDF}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-green-600 text-base font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 sm:mt-0 sm:w-auto sm:text-sm"
                  disabled={loading}
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={handleSendWhatsApp}
                  className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-teal-600 text-base font-medium text-white hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 sm:mt-0 sm:w-auto sm:text-sm"
                  disabled={loading}
                >
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

      {/* Print Invoice Modal */}
      <PrintInvoiceModal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        saleId={saleId}
        title={`Invoice #${invoiceNumber}`}
      />
    </div>
  );
};

export default EditSale; 
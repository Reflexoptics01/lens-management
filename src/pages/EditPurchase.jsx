import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, getDoc, doc, updateDoc, serverTimestamp, query, where, orderBy } from 'firebase/firestore';
import { useNavigate, useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomerForm from '../components/CustomerForm';
import ItemSuggestions from '../components/ItemSuggestions';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';

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

const UNIT_OPTIONS = [
  'Pairs',
  'Pcs',
  'Boxes',
  'Sets',
  'Bottles',
  'Cases'
];

const EditPurchase = () => {
  const navigate = useNavigate();
  const { purchaseId } = useParams();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [originalPurchase, setOriginalPurchase] = useState(null);
  
  // Purchase details
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTaxOption, setSelectedTaxOption] = useState(TAX_OPTIONS[0].id);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percentage'
  const [discountValue, setDiscountValue] = useState(0);
  const [frieghtCharge, setFrieghtCharge] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('UNPAID'); // 'UNPAID', 'PARTIAL', 'PAID'
  const [amountPaid, setAmountPaid] = useState(0);
  
  // Table rows (purchase items)
  const [tableRows, setTableRows] = useState([]);

  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');

  useEffect(() => {
    fetchVendors();
    fetchPurchaseData();
  }, [purchaseId]);

  // Listen for messages from popup windows
  useEffect(() => {
    const handleMessage = (event) => {
      // Check if the message is about a new vendor being created
      if (event.data && event.data.type === "VENDOR_CREATED") {
        console.log("Received vendor creation message:", event.data);
        fetchVendors().then(() => {
          // Find the newly created vendor in our updated vendors list
          const newVendor = vendors.find(v => v.id === event.data.customer.id);
          if (newVendor) {
            setSelectedVendor(newVendor);
            setVendorSearchTerm('');
          }
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [vendors]);

  const fetchPurchaseData = async () => {
    try {
      setLoading(true);
      const purchaseDoc = await getDoc(getUserDoc('purchases', purchaseId));
      
      if (!purchaseDoc.exists()) {
        setError('Purchase not found');
        return;
      }
      
      const purchaseData = purchaseDoc.data();
      setOriginalPurchase(purchaseData);
      
      // Set purchase details
      setPurchaseNumber(purchaseData.purchaseNumber || '');
      setVendorInvoiceNumber(purchaseData.vendorInvoiceNumber || '');
      
      // Format the date if it's a timestamp
      if (purchaseData.purchaseDate) {
        if (purchaseData.purchaseDate.toDate) {
          // Firebase timestamp
          setPurchaseDate(purchaseData.purchaseDate.toDate().toISOString().split('T')[0]);
        } else if (typeof purchaseData.purchaseDate === 'string') {
          // Already a string date
          setPurchaseDate(purchaseData.purchaseDate);
        } else {
          // Default to today
          setPurchaseDate(new Date().toISOString().split('T')[0]);
        }
      }
      
      setSelectedTaxOption(purchaseData.taxOption || TAX_OPTIONS[0].id);
      setDiscountType(purchaseData.discountType || 'amount');
      setDiscountValue(purchaseData.discountValue || 0);
      setFrieghtCharge(purchaseData.frieghtCharge || 0);
      setNotes(purchaseData.notes || '');
      setPaymentStatus(purchaseData.paymentStatus || 'UNPAID');
      setAmountPaid(purchaseData.amountPaid || 0);
      
      // Set vendor
      if (purchaseData.vendorId) {
        const vendorDoc = await getDoc(getUserDoc('customers', purchaseData.vendorId));
        if (vendorDoc.exists()) {
          setSelectedVendor(vendorDoc.data());
        }
      }
      
      // Set table rows
      if (purchaseData.items && purchaseData.items.length > 0) {
        setTableRows(purchaseData.items.map(item => ({
          itemName: item.itemName || '',
          description: item.description || '',
          qty: item.qty || 1,
          unit: item.unit || 'Pairs',
          itemDiscount: item.itemDiscount || 0,
          itemDiscountType: item.itemDiscountType || 'amount',
          price: item.price || 0,
          total: item.total || 0
        })));
      } else {
        // Default empty rows
        setTableRows(Array(5).fill().map(() => ({
          itemName: '',
          description: '',
          qty: 1,
          unit: 'Pairs',
          itemDiscount: 0,
          itemDiscountType: 'amount',
          price: 0,
          total: 0
        })));
      }
      
    } catch (error) {
      console.error('Error fetching purchase data:', error);
      setError('Failed to fetch purchase data');
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const customersRef = collection(db, 'customers');
      const q = query(customersRef, where('type', '==', 'vendor'));
      const snapshot = await getDocs(q);
      const vendorsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVendors(vendorsList);
      return vendorsList;
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setError('Failed to fetch vendors');
      return [];
    } finally {
      setLoading(false);
    }
  };

  // Calculate item discount
  const calculateItemDiscount = (item) => {
    if (item.itemDiscountType === 'percentage') {
      return (item.price * item.qty * parseFloat(item.itemDiscount || 0)) / 100;
    }
    return parseFloat(item.itemDiscount || 0);
  };

  // Calculate row total with discount
  const calculateRowTotal = (item) => {
    const subtotal = item.qty * item.price;
    const discountAmount = calculateItemDiscount(item);
    return subtotal - discountAmount;
  };

  // Calculate subtotal before tax/discount
  const calculateSubtotal = () => {
    return tableRows.reduce((sum, row) => {
      // Recalculate total with item discount
      return sum + calculateRowTotal(row);
    }, 0);
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
    const taxOption = TAX_OPTIONS.find(option => option.id === selectedTaxOption) || TAX_OPTIONS[0];
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

  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor);
    setShowVendorDropdown(false);
  };

  const handleTableRowChange = (index, field, value) => {
    const updatedRows = [...tableRows];
    
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };
    
    // Update the total when relevant fields change
    if (['qty', 'price', 'itemDiscount', 'itemDiscountType'].includes(field)) {
      updatedRows[index].total = calculateRowTotal(updatedRows[index]);
    }
    
    setTableRows(updatedRows);
  };

  const handleVendorModalClose = async (vendorCreated) => {
    setShowVendorModal(false);
    if (vendorCreated) {
      // Refresh vendors list
      const updatedVendors = await fetchVendors();
      // Find the most recently created vendor
      if (updatedVendors.length > 0) {
        const sortedVendors = [...updatedVendors].sort((a, b) => {
          // If createdAt is a timestamp, convert to Date objects
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        
        setSelectedVendor(sortedVendors[0]);
      }
    }
  };

  const handleUpdatePurchase = async () => {
    if (!selectedVendor) {
      setError('Please select a vendor');
      return;
    }

    const filteredRows = tableRows.filter(row => row.itemName && row.qty > 0 && row.price > 0);
    
    if (filteredRows.length === 0) {
      setError('Please add at least one item to the purchase');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const purchaseData = {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.opticalName,
        vendorInvoiceNumber,
        purchaseNumber,
        purchaseDate,
        items: filteredRows.map(row => ({
          ...row,
          itemDiscountAmount: calculateItemDiscount(row)
        })),
        subtotal: calculateSubtotal(),
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        discountAmount: calculateDiscountAmount(),
        taxOption: selectedTaxOption,
        taxAmount: calculateTaxAmount(),
        frieghtCharge: parseFloat(frieghtCharge) || 0,
        totalAmount: calculateTotal(),
        amountPaid: parseFloat(amountPaid) || 0,
        paymentStatus,
        balance: calculateTotal() - (parseFloat(amountPaid) || 0),
        notes,
        updatedAt: serverTimestamp()
      };

      await updateDoc(getUserDoc('purchases', purchaseId), purchaseData);
      setSuccess(true);
      navigate('/purchases');
    } catch (error) {
      console.error('Error updating purchase:', error);
      setError('Failed to update purchase. Please try again.');
    } finally {
      setLoading(false);
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

  const filteredVendors = vendorSearchTerm
    ? vendors.filter(vendor => 
        vendor.opticalName.toLowerCase().includes(vendorSearchTerm.toLowerCase()) ||
        vendor.contactPerson?.toLowerCase().includes(vendorSearchTerm.toLowerCase())
      )
    : vendors;

  if (loading && !originalPurchase) {
    return (
      <div className="mobile-page bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="mobile-content">
          <div className="flex items-center justify-center h-screen">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-sky-500 dark:border-sky-400"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="mobile-content">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Edit Purchase</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update purchase details</p>
          </div>
          <button
            onClick={() => navigate('/purchases')}
            className="btn-secondary inline-flex items-center space-x-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
          >
            <span>Cancel</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 text-red-700 dark:text-red-300 rounded-md">
            {error}
          </div>
        )}

        {/* Purchase Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-white mb-4">Purchase Information</h2>
          
          {/* Vendor Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Vendor *
            </label>
            <div className="flex space-x-2">
              <div className="relative flex-1">
                <input 
                  type="text" 
                  value={selectedVendor ? selectedVendor.opticalName : vendorSearchTerm}
                  onChange={(e) => {
                    setVendorSearchTerm(e.target.value);
                    setSelectedVendor(null);
                    setShowVendorDropdown(true);
                  }}
                  onClick={() => setShowVendorDropdown(true)}
                  className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                  placeholder="Search for vendor..."
                />
                
                {showVendorDropdown && (
                  <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 border border-gray-200 dark:border-gray-600">
                    {filteredVendors.length === 0 ? (
                      <div className="py-2 px-3 text-gray-500 dark:text-gray-400">No vendors found</div>
                    ) : (
                      filteredVendors.map(vendor => (
                        <div
                          key={vendor.id}
                          className="cursor-pointer py-2 px-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                          onClick={() => handleVendorSelect(vendor)}
                        >
                          <div className="font-medium">{vendor.opticalName}</div>
                          {vendor.contactPerson && (
                            <div className="text-xs text-gray-500 dark:text-gray-400">{vendor.contactPerson}</div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowVendorModal(true)}
                className="flex items-center justify-center px-3 py-2 border border-gray-300 dark:border-gray-600 shadow-sm text-sm font-medium rounded-md text-sky-600 dark:text-sky-400 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:ring-offset-gray-900"
              >
                + Add Vendor
              </button>
            </div>
          </div>

          {/* Purchase Details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purchase Number
              </label>
              <input 
                type="text" 
                value={purchaseNumber}
                onChange={(e) => setPurchaseNumber(e.target.value)}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Vendor Invoice Number
              </label>
              <input 
                type="text" 
                value={vendorInvoiceNumber}
                onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                placeholder="Enter vendor's invoice number"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Purchase Date
              </label>
              <input 
                type="date" 
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Purchase Items */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6 overflow-x-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-800 dark:text-white">Purchase Items</h2>
            <div>
              <button
                onClick={() => {
                  const newRows = Array(5).fill().map(() => ({
                    itemName: '',
                    description: '',
                    qty: 1,
                    unit: 'Pairs',
                    itemDiscount: 0,
                    itemDiscountType: 'amount',
                    price: 0,
                    total: 0
                  }));
                  setTableRows([...tableRows, ...newRows]);
                }}
                className="px-3 py-1.5 text-sm font-medium rounded-md text-white bg-sky-600 dark:bg-sky-500 hover:bg-sky-700 dark:hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:ring-offset-gray-900 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add 5 Rows
              </button>
            </div>
          </div>
          
          <div className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-12">
                    #
                  </th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Item Details
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                    Qty
                  </th>
                  <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                    Unit
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                    Discount
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                    Price
                  </th>
                  <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                    Total
                  </th>
                  <th scope="col" className="px-3 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider w-16">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {tableRows.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-750'}>
                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 text-center">
                      {index + 1}
                    </td>
                    <td className="px-3 py-2">
                      <input 
                        type="text" 
                        value={row.itemName}
                        onChange={(e) => handleTableRowChange(index, 'itemName', e.target.value)}
                        className="block w-full border-0 bg-transparent text-gray-900 dark:text-white focus:ring-0 focus:border-b-2 focus:border-sky-500 text-sm font-medium"
                        placeholder="Item name"
                      />
                      <input 
                        type="text" 
                        value={row.description}
                        onChange={(e) => handleTableRowChange(index, 'description', e.target.value)}
                        className="block w-full border-0 bg-transparent text-gray-500 dark:text-gray-400 text-xs focus:ring-0 focus:border-b focus:border-sky-400 mt-1"
                        placeholder="Description (optional)"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <input 
                        type="number" 
                        value={row.qty}
                        onChange={(e) => handleTableRowChange(index, 'qty', e.target.value)}
                        className="block w-full border-0 bg-transparent text-gray-900 dark:text-white text-right focus:ring-0 focus:border-b-2 focus:border-sky-500 text-sm"
                        min="1"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <select
                        value={row.unit}
                        onChange={(e) => handleTableRowChange(index, 'unit', e.target.value)}
                        className="block w-full border-0 bg-transparent text-gray-900 dark:text-white focus:ring-0 focus:border-b-2 focus:border-sky-500 text-sm text-center"
                      >
                        {UNIT_OPTIONS.map(unit => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center space-x-1">
                        <select
                          value={row.itemDiscountType}
                          onChange={(e) => handleTableRowChange(index, 'itemDiscountType', e.target.value)}
                          className="w-12 border-0 bg-transparent text-gray-900 dark:text-white focus:ring-0 focus:border-b-2 focus:border-sky-500 text-xs pr-0"
                        >
                          <option value="amount">₹</option>
                          <option value="percentage">%</option>
                        </select>
                        <input 
                          type="number" 
                          value={row.itemDiscount}
                          onChange={(e) => handleTableRowChange(index, 'itemDiscount', e.target.value)}
                          className="block w-full border-0 bg-transparent text-gray-900 dark:text-white text-right focus:ring-0 focus:border-b-2 focus:border-sky-500 text-sm"
                          min="0"
                          step="0.01"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <input 
                        type="number" 
                        value={row.price}
                        onChange={(e) => handleTableRowChange(index, 'price', e.target.value)}
                        className="block w-full border-0 bg-transparent text-gray-900 dark:text-white text-right focus:ring-0 focus:border-b-2 focus:border-sky-500 text-sm"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-right font-medium text-gray-900 dark:text-white">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-center">
                      <button
                        onClick={() => {
                          const updatedRows = [...tableRows];
                          updatedRows.splice(index, 1);
                          setTableRows(updatedRows);
                        }}
                        className="text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 focus:outline-none"
                        title="Remove item"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {tableRows.length === 0 && (
                  <tr>
                    <td colSpan="8" className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                      No items added yet. Click the "Add 5 Rows" button to add purchase items.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 flex justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {tableRows.length} items
            </div>
            <button
              onClick={() => {
                const newRows = Array(5).fill().map(() => ({
                  itemName: '',
                  description: '',
                  qty: 1,
                  unit: 'Pairs',
                  itemDiscount: 0,
                  itemDiscountType: 'amount',
                  price: 0,
                  total: 0
                }));
                setTableRows([...tableRows, ...newRows]);
              }}
              className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add 5 More Items
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-white mb-4">Summary</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Subtotal:</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(calculateSubtotal())}</span>
            </div>
            
            <div className="flex items-center gap-2 pb-2">
              <span className="text-gray-500 dark:text-gray-400">Discount:</span>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
              >
                <option value="amount">₹</option>
                <option value="percentage">%</option>
              </select>
              <input 
                type="number" 
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="block w-24 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                min="0"
                step={discountType === 'percentage' ? "0.01" : "1"}
              />
              <span className="ml-auto text-gray-900 dark:text-white">{formatCurrency(calculateDiscountAmount())}</span>
            </div>
            
            <div className="flex justify-between items-center pb-2">
              <div className="flex gap-2 items-center">
                <span className="text-gray-500 dark:text-gray-400">Tax:</span>
                <select
                  value={selectedTaxOption}
                  onChange={(e) => setSelectedTaxOption(e.target.value)}
                  className="rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                >
                  {TAX_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <span className="text-gray-900 dark:text-white">{formatCurrency(calculateTaxAmount())}</span>
            </div>
            
            <div className="flex justify-between items-center pb-2 border-b border-gray-200 dark:border-gray-700">
              <div className="flex gap-2 items-center">
                <span className="text-gray-500 dark:text-gray-400">Freight Charges:</span>
                <input 
                  type="number" 
                  value={frieghtCharge}
                  onChange={(e) => setFrieghtCharge(e.target.value)}
                  className="block w-24 rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                  min="0"
                />
              </div>
              <span className="text-gray-900 dark:text-white">{formatCurrency(parseFloat(frieghtCharge) || 0)}</span>
            </div>
            
            <div className="flex justify-between font-medium text-lg pt-2">
              <span className="text-gray-900 dark:text-white">Total:</span>
              <span className="text-gray-900 dark:text-white">{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-white mb-4">Payment Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Payment Status
              </label>
              <select
                value={paymentStatus}
                onChange={(e) => {
                  setPaymentStatus(e.target.value);
                  if (e.target.value === 'PAID') {
                    setAmountPaid(calculateTotal());
                  } else if (e.target.value === 'UNPAID') {
                    setAmountPaid(0);
                  }
                }}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
              >
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            
            {paymentStatus !== 'UNPAID' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount Paid
                </label>
                <input 
                  type="number" 
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                  min="0"
                  max={calculateTotal()}
                  step="0.01"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (Optional)
              </label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full rounded border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                rows="2"
                placeholder="Additional notes about this purchase"
              ></textarea>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end space-x-3 mb-10">
          <button
            onClick={() => navigate('/purchases')}
            className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            onClick={handleUpdatePurchase}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-sky-600 dark:bg-sky-500 hover:bg-sky-700 dark:hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 dark:ring-offset-gray-900 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Update Purchase'}
          </button>
        </div>
      </div>

      {/* Vendor Modal */}
      {showVendorModal && (
        <CustomerForm isVendor={true} onClose={handleVendorModalClose} />
      )}
    </div>
  );
};

export default EditPurchase; 
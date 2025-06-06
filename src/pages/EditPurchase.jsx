import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { collection, getDocs, query, where, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { dateToISOString, safelyParseDate } from '../utils/dateUtils';
import CustomerForm from '../components/CustomerForm';
import PowerInventoryModal from '../components/PowerInventoryModal';

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

const LENS_TYPES = [
  'Not Lens',
  'Stock Lens',
  'Contact Lens'
];

// CSS to remove number input arrows
const numberInputStyles = `
  .no-arrows::-webkit-outer-spin-button,
  .no-arrows::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  .no-arrows[type=number] {
    -moz-appearance: textfield;
  }
`;

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
  const [purchaseDate, setPurchaseDate] = useState(dateToISOString(new Date()).split('T')[0]);
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

  // PowerInventoryModal states
  const [showPowerInventoryModal, setShowPowerInventoryModal] = useState(false);
  const [pendingStockLens, setPendingStockLens] = useState(null);

  const auth = useAuth();

  // Check authentication
  useEffect(() => {
    if (!auth.isAuthenticated()) {
      navigate('/login');
    }
  }, [auth, navigate]);

  useEffect(() => {
    fetchVendors();
    fetchPurchaseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [purchaseId]);

  // Listen for messages from popup windows
  useEffect(() => {
    const handleMessage = (event) => {
      // Check if the message is about a new vendor being created
      if (event.data && event.data.type === "VENDOR_CREATED") {
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
      
      const rawPurchaseData = purchaseDoc.data();
      
      // Helper function to recursively clean timestamp objects from any value
      const cleanTimestampObjects = (obj, fieldName = '') => {
        if (obj === null || obj === undefined) {
          return obj;
        }
        
        // If it's a timestamp object, convert it appropriately
        if (obj && typeof obj === 'object' && obj.seconds !== undefined && obj.nanoseconds !== undefined) {
          // Skip fields that should never be dates - convert to appropriate defaults
          const skipFields = ['displayId', 'purchaseId', 'purchaseNumber', 'invoiceNumber', 'id', 'price', 'quantity', 'total', 'amount',
                             'vendorId', 'vendorName', 'itemName', 'itemCode', 'category', 'brand', 'unit', 'rate', 'discount', 'tax',
                             'vendorInvoiceNumber', 'frieghtCharge', 'subtotal', 'discountAmount', 'taxAmount', 'totalAmount', 'amountPaid', 'balance',
                             'maxSph', 'maxCyl', 'lensType', 'qty'];
          
          if (skipFields.includes(fieldName)) {
            if (fieldName === 'displayId' || fieldName === 'purchaseId' || fieldName === 'purchaseNumber') {
              return `P-${Math.random().toString(36).substr(2, 9)}`;
            } else if (['price', 'quantity', 'total', 'amount', 'rate', 'discount', 'frieghtCharge', 'subtotal', 
                       'discountAmount', 'taxAmount', 'totalAmount', 'amountPaid', 'balance'].includes(fieldName)) {
              return 0;
            } else if (['maxSph', 'maxCyl'].includes(fieldName)) {
              return '';
            } else if (fieldName === 'qty') {
              return 1;
            } else if (fieldName === 'lensType') {
              return 'Stock Lens';
            } else {
              return '';
            }
          }
          
          // For date fields, convert to proper formatted string or keep as date for processing
          if (fieldName.includes('At') || fieldName.includes('Date') || fieldName.includes('Time') || 
              fieldName === 'createdAt' || fieldName === 'updatedAt' || fieldName === 'deletedAt' ||
              fieldName === 'purchaseDate' || fieldName === 'deliveryDate') {
            // For purchaseDate specifically, we want to keep it as a date for form processing
            if (fieldName === 'purchaseDate') {
              const date = safelyParseDate(obj);
              return date && !isNaN(date.getTime()) ? date : new Date();
            } else {
              const date = safelyParseDate(obj);
              if (date && !isNaN(date.getTime())) {
                return date.toLocaleDateString('en-IN', {
                  day: '2-digit',
                  month: 'short', 
                  year: 'numeric'
                });
              }
              return 'Invalid Date';
            }
          }
          
          // For any other timestamp objects, convert to empty string
          return '';
        }
        
        // If it's an array, clean each element
        if (Array.isArray(obj)) {
          return obj.map((item, index) => cleanTimestampObjects(item, `${fieldName}[${index}]`));
        }
        
        // If it's an object, clean each property
        if (obj && typeof obj === 'object') {
          const cleaned = {};
          Object.keys(obj).forEach(key => {
            cleaned[key] = cleanTimestampObjects(obj[key], key);
          });
          return cleaned;
        }
        
        // For primitive values, return as-is
        return obj;
      };
      
      // Clean the entire purchase data object
      const cleanedPurchaseData = cleanTimestampObjects(rawPurchaseData);
      setOriginalPurchase(cleanedPurchaseData);
      
      // Set purchase details
      setPurchaseNumber(String(cleanedPurchaseData.purchaseNumber || ''));
      setVendorInvoiceNumber(String(cleanedPurchaseData.vendorInvoiceNumber || ''));
      
      // Format the date if it's a timestamp
      if (cleanedPurchaseData.purchaseDate) {
        if (cleanedPurchaseData.purchaseDate instanceof Date) {
          // Already converted to Date by our cleaning function
          setPurchaseDate(dateToISOString(cleanedPurchaseData.purchaseDate).split('T')[0]);
        } else if (cleanedPurchaseData.purchaseDate.toDate) {
          // Firebase timestamp
          setPurchaseDate(dateToISOString(cleanedPurchaseData.purchaseDate.toDate()).split('T')[0]);
        } else if (typeof cleanedPurchaseData.purchaseDate === 'string') {
          // Already a string date
          setPurchaseDate(cleanedPurchaseData.purchaseDate);
        } else {
          // Default to today
          setPurchaseDate(dateToISOString(new Date()).split('T')[0]);
        }
      }
      
      setSelectedTaxOption(String(cleanedPurchaseData.taxOption || TAX_OPTIONS[0].id));
      setDiscountType(String(cleanedPurchaseData.discountType || 'amount'));
      setDiscountValue(parseFloat(cleanedPurchaseData.discountValue) || 0);
      setFrieghtCharge(parseFloat(cleanedPurchaseData.frieghtCharge) || 0);
      setNotes(String(cleanedPurchaseData.notes || ''));
      setPaymentStatus(String(cleanedPurchaseData.paymentStatus || 'UNPAID'));
      setAmountPaid(parseFloat(cleanedPurchaseData.amountPaid) || 0);
      
      // Set vendor
      if (cleanedPurchaseData.vendorId) {
        const vendorDoc = await getDoc(getUserDoc('customers', cleanedPurchaseData.vendorId));
        if (vendorDoc.exists()) {
          const rawVendorData = vendorDoc.data();
          // Clean vendor data as well
          const cleanedVendorData = cleanTimestampObjects(rawVendorData);
          setSelectedVendor({
            id: vendorDoc.id,
            ...cleanedVendorData
          });
        }
      }
      
      // Set table rows - simplified structure to match CreatePurchase
      if (cleanedPurchaseData.items && cleanedPurchaseData.items.length > 0) {
        setTableRows(cleanedPurchaseData.items.map(item => ({
          itemName: String(item.itemName || ''),
          lensType: String(item.lensType || 'Stock Lens'),
          maxSph: String(item.maxSph || ''),
          maxCyl: String(item.maxCyl || ''),
          powerInventorySetup: item.powerInventorySetup || false,
          powerInventoryData: item.powerInventoryData || null,
          qty: parseInt(item.qty) || 1,
          unit: String(item.unit || 'Pairs'),
          price: parseFloat(item.price) || 0,
          total: parseFloat(item.total) || 0,
          rowKey: Math.random().toString(36).substr(2, 9)
        })));
      } else {
        // Default empty rows
        setTableRows(Array(5).fill().map(() => ({
          itemName: '',
          lensType: 'Stock Lens',
          maxSph: '',
          maxCyl: '',
          powerInventorySetup: false,
          powerInventoryData: null,
          qty: 1,
          unit: 'Pairs',
          price: 0,
          total: 0,
          rowKey: Math.random().toString(36).substr(2, 9)
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
      const customersRef = getUserCollection('customers');
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

  // Calculate row total - simplified without item discount  
  const calculateRowTotal = (item) => {
    // If power inventory is set up, use the total quantity from power inventory data
    const quantity = item.powerInventorySetup && item.powerInventoryData 
      ? item.powerInventoryData.totalQuantity 
      : item.qty;
    return quantity * item.price;
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
    if (['qty', 'price'].includes(field)) {
      updatedRows[index].total = calculateRowTotal(updatedRows[index]);
    }
    
    setTableRows(updatedRows);
  };

  // PowerInventoryModal handler functions
  const handleSetupPowerInventory = (index) => {
    const row = tableRows[index];
    if (row.lensType === 'Stock Lens') {
      setPendingStockLens({
        index,
        name: row.itemName,
        maxSph: parseFloat(row.maxSph) || 0,
        maxCyl: parseFloat(row.maxCyl) || 0,
        sphMin: parseFloat(row.maxSph) ? -Math.abs(parseFloat(row.maxSph)) : -6,
        sphMax: parseFloat(row.maxSph) || 6,
        cylMin: parseFloat(row.maxCyl) ? -Math.abs(parseFloat(row.maxCyl)) : -2,
        cylMax: 0,
        powerRange: `SPH: ${parseFloat(row.maxSph) ? -Math.abs(parseFloat(row.maxSph)) : -6} to ${parseFloat(row.maxSph) || 6}, CYL: ${parseFloat(row.maxCyl) ? -Math.abs(parseFloat(row.maxCyl)) : -2} to 0`
      });
      setShowPowerInventoryModal(true);
    }
  };

  const handlePowerInventoryModalSave = async (inventoryData) => {
    try {
      if (pendingStockLens && pendingStockLens.index !== undefined) {
        const updatedRows = [...tableRows];
        const index = pendingStockLens.index;
        
        updatedRows[index] = {
          ...updatedRows[index],
          powerInventorySetup: true,
          powerInventoryData: inventoryData.data,
          qty: inventoryData.data.totalQuantity || 1,
          total: calculateRowTotal({
            ...updatedRows[index],
            qty: inventoryData.data.totalQuantity || 1
          })
        };
        
        setTableRows(updatedRows);
        setShowPowerInventoryModal(false);
        setPendingStockLens(null);
      }
    } catch (error) {
      console.error('Error saving power inventory:', error);
      setError('Failed to save power inventory setup');
    }
  };

  const handlePowerInventoryModalClose = () => {
    setShowPowerInventoryModal(false);
    setPendingStockLens(null);
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
          ...row
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
    <>
      {/* Add custom styles */}
      <style>{numberInputStyles}</style>
      
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Navbar />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Enhanced Header with Progress */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/50 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-orange-600 dark:text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      Edit Purchase Order
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Update purchase information and item details
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Purchase Number</div>
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{String(purchaseNumber)}</div>
                </div>
                <button
                  onClick={() => navigate('/purchases')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 border-l-4 border-red-400 dark:border-red-500 rounded-r-lg" 
                 style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Vendor Selection Card */}
            <div className="card p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Vendor Information
                </h2>
              </div>
              
              {/* Selected Vendor Display */}
              {selectedVendor && (
                <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {String(selectedVendor.opticalName)}
                      </h3>
                      <div className="mt-2 space-y-1">
                        {selectedVendor.contactPerson && (
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">Contact:</span> {String(selectedVendor.contactPerson)}
                          </div>
                        )}
                        {selectedVendor.phone && (
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">Phone:</span> {String(selectedVendor.phone)}
                          </div>
                        )}
                        {selectedVendor.email && (
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">Email:</span> {String(selectedVendor.email)}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedVendor(null);
                        setVendorSearchTerm('');
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium"
                    >
                      Change Vendor
                    </button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vendor Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {selectedVendor ? 'Selected Vendor' : 'Select Vendor'} *
                    </label>
                    {!selectedVendor ? (
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            value={vendorSearchTerm}
                            onChange={(e) => {
                              setVendorSearchTerm(e.target.value);
                              setShowVendorDropdown(true);
                            }}
                            onClick={() => setShowVendorDropdown(true)}
                            className="form-input w-full"
                            placeholder="Search for vendor..."
                          />
                          
                          {showVendorDropdown && (
                            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 border border-gray-200 dark:border-gray-600">
                              {filteredVendors.length === 0 ? (
                                <div className="py-3 px-4 text-gray-500 dark:text-gray-400 text-center">No vendors found</div>
                              ) : (
                                filteredVendors.map(vendor => (
                                  <div
                                    key={vendor.id}
                                    className="cursor-pointer py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                                    onClick={() => handleVendorSelect(vendor)}
                                  >
                                    <div className="font-medium text-gray-900 dark:text-white">{String(vendor.opticalName)}</div>
                                    {vendor.contactPerson && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Contact: {String(vendor.contactPerson)}</div>
                                    )}
                                    {vendor.phone && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">Phone: {String(vendor.phone)}</div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setShowVendorModal(true)}
                          className="btn-primary flex items-center px-4 py-2 text-sm whitespace-nowrap"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Add New
                        </button>
                      </div>
                    ) : (
                      <div className="text-base font-medium text-gray-900 dark:text-white">
                        {String(selectedVendor.opticalName)}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Vendor Invoice Number
                    </label>
                    <input 
                      type="text" 
                      value={vendorInvoiceNumber}
                      onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                      className="form-input w-full"
                      placeholder="Enter vendor's invoice number"
                    />
                  </div>
                </div>
                
                {/* Purchase Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Purchase Date *
                    </label>
                    <input 
                      type="date" 
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="form-input w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Purchase Number
                    </label>
                    <input 
                      type="text" 
                      value={purchaseNumber}
                      onChange={(e) => setPurchaseNumber(e.target.value)}
                      className="form-input w-full"
                      placeholder="Purchase number"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Items Card */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Purchase Items
                  </h2>
                </div>
                
                <button
                  onClick={() => {
                    const newRows = Array(5).fill().map(() => ({
                      itemName: '',
                      lensType: 'Stock Lens',
                      maxSph: '',
                      maxCyl: '',
                      powerInventorySetup: false,
                      powerInventoryData: null,
                      qty: 1,
                      unit: 'Pairs',
                      price: 0,
                      total: 0,
                      rowKey: Math.random().toString(36).substr(2, 9)
                    }));
                    setTableRows([...tableRows, ...newRows]);
                  }}
                  className="btn-primary flex items-center px-4 py-2 text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add 5 Rows
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-primary)' }}>
                    <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                      <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <tr>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '50px' }}>
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', minWidth: '250px' }}>
                            Item Details
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '120px' }}>
                            Lens Type
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '100px' }}>
                            Max SPH
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '100px' }}>
                            Max CYL
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '80px' }}>
                            Qty
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '80px' }}>
                            Unit
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '100px' }}>
                            Price
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '100px' }}>
                            Total
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '80px' }}>
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        {tableRows.map((row, index) => (
                          <tr key={`${row.rowKey}-${index}`} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                            <td className="px-3 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <input 
                                type="text" 
                                value={row.itemName}
                                onChange={(e) => handleTableRowChange(index, 'itemName', e.target.value)}
                                className="w-full px-3 py-2 text-sm border rounded-lg form-input"
                                placeholder="Enter item name..."
                              />
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={row.lensType}
                                onChange={(e) => handleTableRowChange(index, 'lensType', e.target.value)}
                                className="form-input w-full text-sm text-center"
                              >
                                {LENS_TYPES.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <input 
                                type="number" 
                                value={row.maxSph || ''}
                                onChange={(e) => handleTableRowChange(index, 'maxSph', e.target.value)}
                                disabled={row.lensType === 'Not Lens'}
                                className="form-input w-full text-sm text-center no-arrows"
                                placeholder="-6.00"
                                step="0.25"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input 
                                type="number" 
                                value={row.maxCyl || ''}
                                onChange={(e) => handleTableRowChange(index, 'maxCyl', e.target.value)}
                                disabled={row.lensType === 'Not Lens'}
                                className="form-input w-full text-sm text-center no-arrows"
                                placeholder="-2.00"
                                step="0.25"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <div className="relative">
                                <input 
                                  type="number" 
                                  value={row.qty}
                                  onChange={(e) => handleTableRowChange(index, 'qty', e.target.value)}
                                  disabled={row.powerInventorySetup}
                                  className={`form-input w-full text-sm text-center no-arrows ${
                                    row.powerInventorySetup ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600' : ''
                                  }`}
                                  min="1"
                                />
                                {row.powerInventorySetup && (
                                  <div className="absolute inset-y-0 right-1 flex items-center">
                                    <svg className="w-3 h-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={row.unit}
                                onChange={(e) => handleTableRowChange(index, 'unit', e.target.value)}
                                className="form-input w-full text-sm text-center"
                              >
                                {UNIT_OPTIONS.map(unit => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <input 
                                type="number" 
                                value={row.price}
                                onChange={(e) => handleTableRowChange(index, 'price', e.target.value)}
                                className="form-input w-full text-sm text-center no-arrows"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(row.total)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="flex items-center justify-center space-x-1">
                                {/* Power Inventory Setup Button */}
                                {row.lensType === 'Stock Lens' && (
                                  <button
                                    onClick={() => handleSetupPowerInventory(index)}
                                    className="w-8 h-8 rounded-lg bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 transition-colors"
                                    title="Setup Power Inventory"
                                  >
                                    <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                    </svg>
                                  </button>
                                )}
                                
                                {/* Delete Button */}
                                <button
                                  onClick={() => {
                                    const updatedRows = [...tableRows];
                                    updatedRows.splice(index, 1);
                                    setTableRows(updatedRows);
                                  }}
                                  className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                                  title="Remove item"
                                >
                                  <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {tableRows.length === 0 && (
                          <tr>
                            <td colSpan="10" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center">
                                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No items added yet</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Click the "Add 5 Rows" button to start adding purchase items.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              {tableRows.length > 0 && (
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">{tableRows.length}</span> items added
                  </div>
                  <button
                    onClick={() => {
                      const newRows = Array(5).fill().map(() => ({
                        itemName: '',
                        lensType: 'Stock Lens',
                        maxSph: '',
                        maxCyl: '',
                        powerInventorySetup: false,
                        powerInventoryData: null,
                        qty: 1,
                        unit: 'Pairs',
                        price: 0,
                        total: 0,
                        rowKey: Math.random().toString(36).substr(2, 9)
                      }));
                      setTableRows([...tableRows, ...newRows]);
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center font-medium"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add 5 More Items
                  </button>
                </div>
              )}
            </div>

            {/* Purchase Summary Card */}
            <div className="card p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Purchase Summary
                </h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Side - Input Controls */}
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Adjustments & Settings
                  </h4>
                  
                  {/* Discount Section */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Discount
                    </label>
                    <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                        className="form-input w-20 text-sm border-0 bg-transparent focus:ring-0"
                      >
                        <option value="amount">₹</option>
                        <option value="percentage">%</option>
                      </select>
                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                      <input 
                        type="number" 
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white no-arrows"
                        min="0"
                        step={discountType === 'percentage' ? "0.01" : "1"}
                        placeholder={discountType === 'percentage' ? "Enter percentage (e.g., 10.5)" : "Enter amount (e.g., 500)"}
                      />
                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                      <div className="text-sm font-medium min-w-[80px] text-right text-green-600 dark:text-green-400">
                        {calculateDiscountAmount() > 0 ? formatCurrency(calculateDiscountAmount()) : '₹0.00'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Tax Section */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Tax Option
                    </label>
                    <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                      <select
                        value={selectedTaxOption}
                        onChange={(e) => setSelectedTaxOption(e.target.value)}
                        className="form-input flex-1 text-sm border-0 bg-transparent focus:ring-0"
                      >
                        {TAX_OPTIONS.map(option => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                      <div className="text-sm font-medium min-w-[80px] text-right text-blue-600 dark:text-blue-400">
                        {calculateTaxAmount() > 0 ? formatCurrency(calculateTaxAmount()) : '₹0.00'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Freight Section */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Freight Charges
                    </label>
                    <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                      <input 
                        type="number" 
                        value={frieghtCharge}
                        onChange={(e) => setFrieghtCharge(e.target.value)}
                        className="form-input flex-1 text-sm border-0 bg-transparent focus:ring-0 no-arrows"
                        min="0"
                        step="0.01"
                        placeholder="Enter freight charges (e.g., 200.00)"
                      />
                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                      <div className="text-sm font-medium min-w-[80px] text-right text-purple-600 dark:text-purple-400">
                        {parseFloat(frieghtCharge) > 0 ? formatCurrency(parseFloat(frieghtCharge) || 0) : '₹0.00'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Side - Calculation Summary */}
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Calculation Breakdown
                  </h4>
                  
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Subtotal
                      </span>
                      <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(calculateSubtotal())}
                      </span>
                    </div>
                    
                    {/* Discount Applied */}
                    {calculateDiscountAmount() > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-red-600 dark:text-red-400">
                          Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Amount'})
                        </span>
                        <span className="text-base font-semibold text-red-600 dark:text-red-400">
                          -{formatCurrency(calculateDiscountAmount())}
                        </span>
                      </div>
                    )}
                    
                    {/* Tax Applied */}
                    {calculateTaxAmount() > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-600 dark:text-blue-400">
                          {TAX_OPTIONS.find(opt => opt.id === selectedTaxOption)?.label || 'Tax'}
                        </span>
                        <span className="text-base font-semibold text-blue-600 dark:text-blue-400">
                          +{formatCurrency(calculateTaxAmount())}
                        </span>
                      </div>
                    )}
                    
                    {/* Freight Applied */}
                    {parseFloat(frieghtCharge) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-600 dark:text-green-400">
                          Freight Charges
                        </span>
                        <span className="text-base font-semibold text-green-600 dark:text-green-400">
                          +{formatCurrency(parseFloat(frieghtCharge) || 0)}
                        </span>
                      </div>
                    )}
                    
                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                          Total Amount
                        </span>
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(calculateTotal())}
                        </span>
                      </div>
                    </div>
                    
                    {/* Items Summary */}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                        <div className="flex justify-between">
                          <span>Total Items:</span>
                          <span>{tableRows.filter(row => row.itemName && row.itemName.trim()).length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Quantity:</span>
                          <span>
                            {tableRows.reduce((sum, row) => {
                              if (!row.itemName || !row.itemName.trim()) return sum;
                              const qty = row.powerInventorySetup && row.powerInventoryData 
                                ? row.powerInventoryData.totalQuantity 
                                : row.qty;
                              return sum + (parseInt(qty) || 0);
                            }, 0)} pieces
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Details Card */}
            <div className="card p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Payment Details
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
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
                    className="form-input w-full"
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PARTIAL">Partially Paid</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
                
                {paymentStatus !== 'UNPAID' && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Amount Paid
                    </label>
                    <input 
                      type="number" 
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="form-input w-full no-arrows"
                      min="0"
                      max={calculateTotal()}
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                )}
                
                <div className={paymentStatus === 'UNPAID' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Notes (Optional)
                  </label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="form-input w-full"
                    rows="3"
                    placeholder="Additional notes about this purchase..."
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pb-8">
              <button
                onClick={() => navigate('/purchases')}
                className="px-6 py-3 text-base font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel & Return
              </button>
              
              <button
                onClick={handleUpdatePurchase}
                disabled={loading || !selectedVendor || tableRows.filter(row => row.itemName).length === 0}
                className="btn-primary px-6 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating Purchase...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Update Purchase Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showVendorModal && (
        <CustomerForm isVendor={true} onClose={handleVendorModalClose} />
      )}
      
      {/* PowerInventoryModal */}
      {showPowerInventoryModal && pendingStockLens && (
        <PowerInventoryModal
          isOpen={showPowerInventoryModal}
          onClose={handlePowerInventoryModalClose}
          onSave={handlePowerInventoryModalSave}
          lensData={pendingStockLens}
          isEdit={false}
        />
      )}
    </>
  );
};

export default EditPurchase; 
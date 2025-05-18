import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, serverTimestamp, query, where, doc, getDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';

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

const CreatePurchase = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  
  // Purchase details
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedTaxOption, setSelectedTaxOption] = useState(TAX_OPTIONS[0].id);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percentage'
  const [discountValue, setDiscountValue] = useState(0);
  const [frieghtCharge, setFrieghtCharge] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('UNPAID'); // 'UNPAID', 'PARTIAL', 'PAID'
  const [amountPaid, setAmountPaid] = useState(0);
  
  // Table rows (purchase items)
  const [tableRows, setTableRows] = useState(Array(5).fill().map(() => ({
    itemName: '',
    description: '',
    qty: 1,
    unit: 'Pairs', // Default unit
    price: 0,
    total: 0
  })));

  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');

  useEffect(() => {
    fetchVendors();
    generatePurchaseNumber();
  }, []);

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
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setError('Failed to fetch vendors');
    } finally {
      setLoading(false);
    }
  };

  const generatePurchaseNumber = async () => {
    try {
      // Get the current number of purchases
      const purchasesRef = collection(db, 'purchases');
      const snapshot = await getDocs(purchasesRef);
      const newPurchaseNumber = `P-${(snapshot.docs.length + 1).toString().padStart(4, '0')}`;
      setPurchaseNumber(newPurchaseNumber);
    } catch (error) {
      console.error('Error generating purchase number:', error);
      setPurchaseNumber('P-0001');
    }
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
    
    // Calculate total for this row
    if (field === 'qty' || field === 'price') {
      const qty = field === 'qty' ? parseFloat(value) || 0 : parseFloat(updatedRows[index].qty) || 0;
      const price = field === 'price' ? parseFloat(value) || 0 : parseFloat(updatedRows[index].price) || 0;
      updatedRows[index].total = qty * price;
    }
    
    setTableRows(updatedRows);
  };

  const handleSavePurchase = async () => {
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
        purchaseNumber,
        purchaseDate,
        items: filteredRows,
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
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'purchases'), purchaseData);
      setSuccess(true);
      navigate('/purchases');
    } catch (error) {
      console.error('Error saving purchase:', error);
      setError('Failed to save purchase. Please try again.');
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

  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Create Purchase</h1>
            <p className="mt-1 text-sm text-gray-500">Add new purchase details</p>
          </div>
          <button
            onClick={() => navigate('/purchases')}
            className="btn-secondary inline-flex items-center space-x-2"
          >
            <span>Cancel</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md">
            {error}
          </div>
        )}

        {/* Purchase Form */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Purchase Information</h2>
          
          {/* Vendor Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Vendor *
            </label>
            <div className="relative">
              <input 
                type="text" 
                value={selectedVendor ? selectedVendor.opticalName : vendorSearchTerm}
                onChange={(e) => {
                  setVendorSearchTerm(e.target.value);
                  setSelectedVendor(null);
                  setShowVendorDropdown(true);
                }}
                onClick={() => setShowVendorDropdown(true)}
                className="block w-full rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                placeholder="Search for vendor..."
              />
              
              {showVendorDropdown && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5">
                  {filteredVendors.length === 0 ? (
                    <div className="py-2 px-3 text-gray-500">No vendors found</div>
                  ) : (
                    filteredVendors.map(vendor => (
                      <div
                        key={vendor.id}
                        className="cursor-pointer py-2 px-3 hover:bg-gray-100"
                        onClick={() => handleVendorSelect(vendor)}
                      >
                        <div className="font-medium">{vendor.opticalName}</div>
                        {vendor.contactPerson && (
                          <div className="text-xs text-gray-500">{vendor.contactPerson}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Purchase Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Number
              </label>
              <input 
                type="text" 
                value={purchaseNumber}
                onChange={(e) => setPurchaseNumber(e.target.value)}
                className="block w-full rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm bg-gray-50"
                readOnly
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Purchase Date
              </label>
              <input 
                type="date" 
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="block w-full rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
              />
            </div>
          </div>
        </div>

        {/* Purchase Items */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6 overflow-x-auto">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Purchase Items</h2>
          
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left text-xs font-medium text-gray-500 uppercase py-2">Item</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 w-20">Qty</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 w-20">Price</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase py-2 w-24">Total</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2 pr-2">
                    <input 
                      type="text" 
                      value={row.itemName}
                      onChange={(e) => handleTableRowChange(index, 'itemName', e.target.value)}
                      className="block w-full bg-transparent border-0 border-b border-transparent focus:border-sky-500 focus:ring-0 sm:text-sm"
                      placeholder="Item name"
                    />
                    <input 
                      type="text" 
                      value={row.description}
                      onChange={(e) => handleTableRowChange(index, 'description', e.target.value)}
                      className="block w-full bg-transparent border-0 text-gray-500 text-xs focus:border-sky-500 focus:ring-0"
                      placeholder="Description (optional)"
                    />
                  </td>
                  <td className="py-2">
                    <input 
                      type="number" 
                      value={row.qty}
                      onChange={(e) => handleTableRowChange(index, 'qty', e.target.value)}
                      className="block w-full bg-transparent border-0 text-right focus:border-sky-500 focus:ring-0 sm:text-sm"
                      min="1"
                    />
                  </td>
                  <td className="py-2">
                    <input 
                      type="number" 
                      value={row.price}
                      onChange={(e) => handleTableRowChange(index, 'price', e.target.value)}
                      className="block w-full bg-transparent border-0 text-right focus:border-sky-500 focus:ring-0 sm:text-sm"
                      min="0"
                      step="0.01"
                    />
                  </td>
                  <td className="py-2 text-right font-medium">
                    {formatCurrency(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <button
            onClick={() => setTableRows([...tableRows, { itemName: '', description: '', qty: 1, unit: 'Pairs', price: 0, total: 0 }])}
            className="mt-4 text-sm text-sky-600 hover:text-sky-800"
          >
            + Add More Items
          </button>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Summary</h2>
          
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Subtotal:</span>
              <span>{formatCurrency(calculateSubtotal())}</span>
            </div>
            
            <div className="flex items-center gap-2 pb-2">
              <span className="text-gray-500">Discount:</span>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
                className="rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
              >
                <option value="amount">₹</option>
                <option value="percentage">%</option>
              </select>
              <input 
                type="number" 
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="block w-24 rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                min="0"
                step={discountType === 'percentage' ? "0.01" : "1"}
              />
              <span className="ml-auto">{formatCurrency(calculateDiscountAmount())}</span>
            </div>
            
            <div className="flex justify-between items-center pb-2">
              <div className="flex gap-2 items-center">
                <span className="text-gray-500">Tax:</span>
                <select
                  value={selectedTaxOption}
                  onChange={(e) => setSelectedTaxOption(e.target.value)}
                  className="rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                >
                  {TAX_OPTIONS.map(option => (
                    <option key={option.id} value={option.id}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <span>{formatCurrency(calculateTaxAmount())}</span>
            </div>
            
            <div className="flex justify-between items-center pb-2 border-b">
              <div className="flex gap-2 items-center">
                <span className="text-gray-500">Freight Charges:</span>
                <input 
                  type="number" 
                  value={frieghtCharge}
                  onChange={(e) => setFrieghtCharge(e.target.value)}
                  className="block w-24 rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                  min="0"
                />
              </div>
              <span>{formatCurrency(parseFloat(frieghtCharge) || 0)}</span>
            </div>
            
            <div className="flex justify-between font-medium text-lg pt-2">
              <span>Total:</span>
              <span>{formatCurrency(calculateTotal())}</span>
            </div>
          </div>
        </div>

        {/* Payment Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Payment Details</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
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
                className="block w-full rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
              >
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIAL">Partially Paid</option>
                <option value="PAID">Paid</option>
              </select>
            </div>
            
            {paymentStatus !== 'UNPAID' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount Paid
                </label>
                <input 
                  type="number" 
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="block w-full rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
                  min="0"
                  max={calculateTotal()}
                  step="0.01"
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes (Optional)
              </label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full rounded border-gray-300 shadow-sm focus:border-sky-500 focus:ring-sky-500 sm:text-sm"
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
            className="px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSavePurchase}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Purchase'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreatePurchase; 
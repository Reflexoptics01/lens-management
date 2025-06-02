import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import PrintInvoiceModal from '../components/PrintInvoiceModal';
import { safelyParseDate, formatDate, formatDateTime } from '../utils/dateUtils';
import { getUserDoc } from '../utils/multiTenancy';

const SaleDetail = () => {
  const { saleId } = useParams();
  const navigate = useNavigate();
  const [sale, setSale] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // State for print invoice modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  
  // State for print address modal
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [shopInfo, setShopInfo] = useState(null);

  useEffect(() => {
    fetchSaleDetails();
    fetchShopInfo();
  }, [saleId]);

  // Add debugging effect to log sale data when it changes
  useEffect(() => {
    if (sale) {
      console.log('Current sale state:', sale);
      console.log('Items in state:', sale.items);
      
      if (sale.items && sale.items.length > 0) {
        console.log('First item properties:', Object.keys(sale.items[0]));
        console.log('First item sample:', sale.items[0]);
      }
    }
  }, [sale]);

  const fetchSaleDetails = async () => {
    try {
      setLoading(true);
      setError(''); // Clear any previous errors
      
      console.log('Fetching sale details for ID:', saleId);
      
      // Use user-specific collection instead of global collection
      const saleDoc = await getDoc(getUserDoc('sales', saleId));
      
      if (!saleDoc.exists()) {
        setError('Sale not found');
        return;
      }
      
      const saleData = saleDoc.data();
      console.log('Raw sale data:', saleData);
      
      // Log specific phone information to help debug
      console.log('Sale phone number:', saleData.phone);
      console.log('Sale customerPhone:', saleData.customerPhone);
      
      // If phone is not in the sale data, try to fetch it from customer record
      let customerPhone = saleData.phone || saleData.customerPhone || '';
      
      if (!customerPhone && saleData.customerId) {
        try {
          console.log('Fetching customer details for ID:', saleData.customerId);
          // Use user-specific customer collection
          const customerDoc = await getDoc(getUserDoc('customers', saleData.customerId));
          if (customerDoc.exists()) {
            const customerData = customerDoc.data();
            customerPhone = customerData.phone || '';
            console.log('Retrieved customer phone from customer record:', customerPhone);
          }
        } catch (error) {
          console.error('Error fetching customer details:', error);
        }
      }
      
      // Debug items array to help diagnose issues
      if (saleData.items && Array.isArray(saleData.items)) {
        console.log(`Found ${saleData.items.length} items in the sale`);
        saleData.items.forEach((item, index) => {
          console.log(`Item ${index + 1}:`, item);
          // Check what properties are available
          if (item) {
            console.log(`Item ${index + 1} properties:`, Object.keys(item));
          }
        });
      } else {
        console.warn('No items array found in sale data or items is not an array');
          }
      
      // Use our utility function to safely parse dates
      const createdAt = safelyParseDate(saleData.createdAt) || new Date();
      const invoiceDate = safelyParseDate(saleData.invoiceDate) || new Date();
      const dueDate = safelyParseDate(saleData.dueDate);
      
      // Process items array to ensure consistent property names
      let processedItems = [];
      
      if (saleData.items && Array.isArray(saleData.items)) {
        processedItems = saleData.items.map(item => {
          // Create a new object with standardized properties
          return {
            // Common item properties
            itemName: item.itemName || '',
            // Handling different quantity property names
            qty: item.qty || item.quantity || 0,
            quantity: item.qty || item.quantity || 0,
            // Handling different price property names
            price: item.price || item.rate || 0,
            rate: item.rate || item.price || 0,
            // Handling different discount property names
            discount: item.discount || 0,
            // Handling different tax property names
            tax: item.tax || item.taxRate || 0,
            taxRate: item.taxRate || item.tax || 0,
            // Handling different total property names
            total: item.total || item.totalAmount || 0,
            totalAmount: item.totalAmount || item.total || 0,
            // Optical properties
            power: item.power || '',
            sph: item.sph || '',
            cyl: item.cyl || '',
            axis: item.axis || '',
            add: item.add || '',
            // Unit property
            unit: item.unit || 'Pairs',
            // Additional properties
            ...item
          };
        });
      }
      
      // Process the sale data
      const processedSale = {
        ...saleData,
        id: saleId,
        createdAt,
        invoiceDate,
        dueDate,
        // Make sure phone is included
        phone: customerPhone,
        // Process any other timestamps in the data
        updatedAt: safelyParseDate(saleData.updatedAt),
        items: processedItems
      };
      
      console.log('Processed sale data:', processedSale);
      
      setSale(processedSale);
    } catch (error) {
      console.error('Error fetching sale details:', error);
      setError('Failed to load sale details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

  // Function to handle printing the address
  const handlePrintAddress = () => {
    if (!sale || !shopInfo) {
      console.error('Sale or shop info not available');
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
    if (!sale || !shopInfo) return null;
    
    // Log the phone number for debugging
    console.log('Phone number in address modal:', sale.phone);
    
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
                    <strong>{sale.customerName || 'Customer Name'}</strong><br />
                    {sale.customerAddress || ''}<br />
                    {sale.customerCity && sale.customerState ? `${sale.customerCity}, ${sale.customerState}` : sale.customerCity || sale.customerState || ''}<br />
                    {sale.phone && `Phone: ${sale.phone}`}<br />
                    {sale.gstNumber && `GSTIN: ${sale.gstNumber}`}<br />
                    {`Invoice: ${sale.invoiceNumber || ''}`}<br />
                    {`Date: ${formatDate(sale.invoiceDate)}`}
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
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex-grow flex items-center justify-center">
          <div className="spinner"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex-grow container mx-auto px-4 py-8">
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400 dark:text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/sales')}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded"
          >
            Back to Sales
          </button>
        </div>
      </div>
    );
    }

  if (!sale) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex-grow container mx-auto px-4 py-8">
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 dark:border-yellow-500 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400 dark:text-yellow-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">No sale data found</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/sales')}
            className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded"
          >
            Back to Sales
          </button>
        </div>
      </div>
    );
    }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="flex-grow container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sale Details</h1>
          <div className="flex space-x-2">
                <button
                  onClick={() => navigate('/sales')}
              className="bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-semibold py-2 px-4 rounded"
                >
              Back
                </button>
                <button
                  onClick={() => navigate(`/sales/edit/${saleId}`)}
              className="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded"
                >
                  Edit
                </button>
                <button
                  onClick={() => setShowPrintModal(true)}
              className="bg-green-500 hover:bg-green-600 dark:bg-green-600 dark:hover:bg-green-700 text-white font-semibold py-2 px-4 rounded flex items-center"
                >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
              Print Invoice
                </button>
                <button
                  onClick={handlePrintAddress}
                  className="bg-purple-500 hover:bg-purple-600 dark:bg-purple-600 dark:hover:bg-purple-700 text-white font-semibold py-2 px-4 rounded flex items-center"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Print Address
                </button>
            </div>
          </div>

        <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden mb-6">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Invoice Information</h2>
                <div className="grid grid-cols-2 gap-4">
                      <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-white">{sale.invoiceNumber || 'N/A'}</p>
                      </div>
                      <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Date</p>
                    <p className="text-lg text-gray-900 dark:text-white">{formatDate(sale.invoiceDate)}</p>
                      </div>
                      <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Due Date</p>
                    <p className="text-lg text-gray-900 dark:text-white">{formatDate(sale.dueDate) || 'N/A'}</p>
                      </div>
                      <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Status</p>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      sale.paymentStatus === 'PAID' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                        : sale.paymentStatus === 'PARTIAL' 
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' 
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    }`}>
                      {sale.paymentStatus || 'UNPAID'}
                    </span>
                      </div>
                    </div>
                  </div>

                      <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Customer Information</h2>
                      <div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Optical Name</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">{sale.customerName || 'N/A'}</p>
                      </div>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact</p>
                  <p className="text-lg text-gray-900 dark:text-white">{sale.phone || 'N/A'}</p>
                        </div>
                <div className="mt-2">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">GST Number</p>
                  <p className="text-lg text-gray-900 dark:text-white">{sale.gstNumber || 'N/A'}</p>
                    </div>
                  </div>
                </div>

            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Items</h2>
                  <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Item</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SPH</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CYL</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">AXIS</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ADD</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Qty</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Rate</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Discount</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tax</th>
                      <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {sale.items && sale.items.length > 0 ? (
                      sale.items.map((item, index) => {
                        // Display separate optical values if they exist directly on the item
                        // Otherwise try to parse from power string
                        let sph = item.sph || '-';
                        let cyl = item.cyl || '-';
                        let axis = item.axis || '-';
                        let add = item.add || '-';
                        
                        // If we have direct values, use them
                        if (!sph || sph === '-') {
                          // Try to parse from power if it exists
                          if (item.power) {
                            const powerParts = item.power.split('/');
                            if (powerParts.length >= 1 && powerParts[0]) sph = powerParts[0];
                            if (powerParts.length >= 2 && powerParts[1]) cyl = powerParts[1];
                            if (powerParts.length >= 3 && powerParts[2]) axis = powerParts[2];
                            if (powerParts.length >= 4 && powerParts[3]) add = powerParts[3];
                          }
                        }
                        
                        // Get quantity, accommodating different property names
                        const quantity = item.qty || item.quantity || 0;
                        
                        // Get unit (default to "Pairs" if not specified)
                        const unit = item.unit || "Pairs";
                        
                        // Get rate/price, accommodating different property names
                        const rate = item.rate || item.price || 0;
                        
                        // Get discount, accommodating different property names
                        const discount = item.discount || 0;
                        
                        // Get tax, accommodating different property names
                        const tax = item.tax || item.taxRate || 0;
                        
                        // Get total amount, accommodating different property names
                        const totalAmount = item.totalAmount || item.total || 0;
                        
                        // Format axis display with degree symbol only if it's a number
                        const axisDisplay = axis !== '-' && !isNaN(parseFloat(axis)) ? 
                          `${axis}°` : axis;
                        
                        return (
                          <tr key={index}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white text-center">{item.itemName || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">{sph}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">{cyl}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">{axisDisplay}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">{add}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">{quantity} {unit}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">₹{typeof rate === 'number' ? rate.toFixed(2) : parseFloat(rate || 0).toFixed(2)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">{discount}%</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">{tax}%</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">₹{typeof totalAmount === 'number' ? totalAmount.toFixed(2) : parseFloat(totalAmount || 0).toFixed(2)}</td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="10" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 text-center">No items found</td>
                      </tr>
                    )}
                      </tbody>
                    </table>
                  </div>
                </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Payment Information</h2>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Method</p>
                    <p className="text-lg text-gray-900 dark:text-white">{sale.paymentMethod || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Status</p>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      sale.paymentStatus === 'PAID' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
                        : sale.paymentStatus === 'PARTIAL' 
                          ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' 
                          : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                    }`}>
                      {sale.paymentStatus || 'UNPAID'}
                    </span>
                  </div>
                    <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Amount Paid</p>
                    <p className="text-lg text-gray-900 dark:text-white">₹{sale.amountPaid?.toFixed(2) || '0.00'}</p>
                    </div>
                        <div>
                    <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Balance Due</p>
                    <p className="text-lg text-gray-900 dark:text-white">₹{sale.balanceDue?.toFixed(2) || '0.00'}</p>
                          </div>
                  </div>
                </div>

                    <div>
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Summary</h2>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-300">Subtotal:</span>
                    <span className="font-medium text-gray-900 dark:text-white">₹{sale.subtotal?.toFixed(2) || '0.00'}</span>
                    </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-300">Discount:</span>
                    <span className="font-medium text-gray-900 dark:text-white">₹{sale.totalDiscount?.toFixed(2) || '0.00'}</span>
                    </div>
                  <div className="flex justify-between mb-2">
                    <span className="text-gray-600 dark:text-gray-300">Tax:</span>
                    <span className="font-medium text-gray-900 dark:text-white">₹{sale.totalTax?.toFixed(2) || '0.00'}</span>
                    </div>
                  <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600">
                    <span className="text-gray-800 dark:text-gray-200 font-medium">Total:</span>
                    <span className="text-gray-800 dark:text-white font-bold">₹{sale.totalAmount?.toFixed(2) || '0.00'}</span>
                  </div>
                </div>
              </div>
            </div>
            
            {sale.notes && (
              <div className="mt-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Notes</h2>
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-md">
                  <p className="text-gray-700 dark:text-gray-300">{sale.notes}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showPrintModal && (
        <PrintInvoiceModal 
          isOpen={showPrintModal}
          onClose={() => setShowPrintModal(false)}
          saleId={saleId}
          sale={sale}
          title={`Invoice #${sale.invoiceNumber || ''}`}
        />
      )}

      {showAddressModal && <AddressModal />}
    </div>
  );
};

export default SaleDetail; 
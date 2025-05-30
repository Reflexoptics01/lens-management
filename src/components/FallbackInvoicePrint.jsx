import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const FallbackInvoicePrint = ({ saleId, onClose, autoPrint = false }) => {
  const [saleData, setSaleData] = useState(null);
  const [shopSettings, setShopSettings] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        console.log('Starting to fetch data for invoice:', saleId);
        setLoading(true);
        
        // Fetch sale data
        const saleDoc = await getDoc(doc(db, 'sales', saleId));
        if (!saleDoc.exists()) {
          throw new Error('Sale not found');
        }
        
        const data = { id: saleId, ...saleDoc.data() };
        setSaleData(data);
        
        // Fetch shop settings
        const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
        let bankDetailsData = null;
        let settingsData = null;
        
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          settingsData = settings;
          console.log('Shop settings loaded successfully');
          setShopSettings(settings);
          
          // Check if bank details are stored within the shopSettings document
          if (settings.bankDetails) {
            console.log('Using bank details from shopSettings.bankDetails');
            bankDetailsData = settings.bankDetails;
          } else {
            // Try to extract bank details directly from settings
            bankDetailsData = {
              accountName: settings.accountName || settings.accountHolderName || settings.businessName,
              bankName: settings.bankName,
              accountNumber: settings.accountNumber,
              branchName: settings.branchName || settings.branch,
              ifscCode: settings.ifscCode,
              upiId: settings.upiId
            };
            
            // Extract QR code URL from settings
            if (settings.qrCodeUrl || settings.qrCode || settings.qrcode) {
              bankDetailsData.qrCodeUrl = settings.qrCodeUrl || settings.qrCode || settings.qrcode;
            }
            
            // Remove undefined fields
            Object.keys(bankDetailsData).forEach(key => {
              if (bankDetailsData[key] === undefined) {
                delete bankDetailsData[key];
              }
            });
          }
        }
        
        // If bank details are not complete, try dedicated bankDetails document
        if (!bankDetailsData || Object.keys(bankDetailsData).filter(k => bankDetailsData[k]).length < 3) {
          try {
            console.log('Trying to fetch from dedicated bankDetails document');
            const bankDoc = await getDoc(doc(db, 'settings', 'bankDetails'));
            
            if (bankDoc.exists()) {
              const bankData = bankDoc.data();
              console.log('Found dedicated bank details document');
              bankDetailsData = bankData;
            } else {
              console.log('No dedicated bank details document found, searching in other settings');
              
              // Try to find bank details in any settings document
              const settingsCollection = await getDocs(collection(db, 'settings'));
              settingsCollection.forEach(doc => {
                if (doc.id !== 'shopSettings') {
                  const docData = doc.data();
                  if (docData.bankName || docData.accountNumber || docData.accountName) {
                    console.log(`Found bank details in document: ${doc.id}`);
                    
                    // Create or update bank details
                    if (!bankDetailsData) {
                      bankDetailsData = {};
                    }
                    
                    // Copy all relevant fields
                    ['accountName', 'bankName', 'accountNumber', 'branchName', 
                     'branch', 'ifscCode', 'upiId', 'qrCodeUrl', 'qrCode'].forEach(field => {
                      if (docData[field] && !bankDetailsData[field]) {
                        bankDetailsData[field] = docData[field];
                      }
                    });
                    
                    // If the document has a bankDetails object, use that too
                    if (docData.bankDetails) {
                      Object.assign(bankDetailsData, docData.bankDetails);
                    }
                  }
                }
              });
            }
          } catch (error) {
            console.error('Error fetching bank details from settings:', error);
          }
        }
        
        // Set the bank details in state
        if (bankDetailsData) {
          // Make sure we have account name - use business name if needed
          if (!bankDetailsData.accountName && settingsData?.businessName) {
            bankDetailsData.accountName = settingsData.businessName;
          }
          
          console.log('Using bank details:', bankDetailsData);
          setBankDetails(bankDetailsData);
        } else {
          console.warn('No bank details found in settings');
        }
        
        setLoading(false);
        
        // If autoPrint is true, trigger the print dialog after data is loaded
        if (autoPrint) {
          // Allow more time for all images and resources to load
          setTimeout(() => {
            handlePrint();
          }, 1200);
        }
      } catch (err) {
        console.error('Error:', err);
        setError(err.message || 'Failed to load invoice');
        setLoading(false);
      }
    };

    fetchData();
  }, [saleId, onClose, autoPrint]);

  // Add print handler function
  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      console.error("Couldn't open print window. Make sure popup blocker is disabled.");
      alert("Please allow popups to print the invoice.");
      return;
    }

    // Get the HTML content of the print-only div
    const content = document.querySelector('.print-only');
    if (!content) {
      console.error("Print content not found");
      return;
    }

    // Write to the new window
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice #${saleData?.invoiceNumber || 'Print'}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 0;
              padding: 20px;
              background-color: white;
            }
            table {
              border-collapse: collapse;
              width: 100%;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 4px;
            }
            @media print {
              @page {
                margin: 10mm;
              }
              body {
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          </style>
        </head>
        <body>
          ${content.innerHTML}
        </body>
      </html>
    `);

    printWindow.document.close();
    
    // Wait for images to load before printing
    printWindow.addEventListener('load', () => {
      printWindow.focus();
      printWindow.print();
      // Uncomment this line if you want to close the print window after printing:
      // printWindow.addEventListener('afterprint', () => printWindow.close());
    });
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  // Format date
  const formatDate = (date) => {
    if (!date) return '-';
    const dateObj = date instanceof Date ? date : date.toDate?.() || new Date(date);
    return dateObj.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get unit for an item
  const getItemUnit = (item) => {
    if (!item) return 'Pcs';
    
    // Try to determine unit based on item category or type
    if (item.category === 'lenses' || item.type === 'lenses' || 
        item.itemName?.toLowerCase().includes('lens')) {
      return 'Pairs';
    }
    
    // Default unit
    return item.unit || 'Pcs';
  };

  // Determine if the tax is IGST or CGST/SGST
  const isCGSTSGST = (taxOption) => {
    if (!taxOption) return false;
    return taxOption.includes('CGST_SGST') || 
          (typeof taxOption === 'string' && taxOption.toLowerCase().includes('cgst'));
  };

  // Format address for display
  const formatAddress = () => {
    if (!shopSettings) return '';
    
    const addressParts = [];
    
    if (shopSettings.address) addressParts.push(shopSettings.address);
    
    if (shopSettings.city || shopSettings.state || shopSettings.pincode) {
      const locationParts = [];
      if (shopSettings.city) locationParts.push(shopSettings.city);
      if (shopSettings.state) locationParts.push(shopSettings.state);
      if (shopSettings.pincode) locationParts.push(shopSettings.pincode);
      addressParts.push(locationParts.join(', '));
    }
    
    return addressParts.join(', ');
  };
  
  // Format customer address details from various possible fields
  const formatCustomerAddress = () => {
    const addressParts = [];
    
    // Add the main address if available
    if (saleData.customerAddress) {
      addressParts.push(saleData.customerAddress);
    }
    
    // Add the location line (city, state, pincode)
    const locationParts = [];
    if (saleData.customerCity) locationParts.push(saleData.customerCity);
    if (saleData.customerState) locationParts.push(saleData.customerState);
    if (saleData.customerPincode) locationParts.push(saleData.customerPincode);
    
    if (locationParts.length > 0) {
      addressParts.push(locationParts.join(', '));
    }
    
    return addressParts;
  };

  if (loading) {
    return <div className="p-4" style={{ color: '#374151' }}>Loading invoice data...</div>;
  }

  if (error) {
    return <div className="p-4" style={{ color: '#dc2626' }}>Error: {error}</div>;
  }

  // saleData might be null here if there was an error before this point or if loading is slow
  // Adding a check for saleData before trying to access its properties.
  if (!saleData) {
    // Or return a specific message indicating saleData is not available yet
    return <div className="p-4" style={{ color: '#374151' }}>Invoice data is not available.</div>;
  }

  console.log('Shop settings:', shopSettings);
  console.log('Bank details when rendering:', bankDetails);

  // Create a fallback bank details object if nothing was found
  const displayBankDetails = bankDetails || {};
  // If we have shop settings but no bank details, extract relevant fields
  if (!bankDetails && shopSettings) {
    console.log('Creating fallback bank details from shop settings');
    if (shopSettings.accountName) displayBankDetails.accountName = shopSettings.accountName;
    if (shopSettings.accountNumber) displayBankDetails.accountNumber = shopSettings.accountNumber;
    if (shopSettings.bankName) displayBankDetails.bankName = shopSettings.bankName;
    if (shopSettings.branchName) displayBankDetails.branchName = shopSettings.branchName;
    if (shopSettings.ifscCode) displayBankDetails.ifscCode = shopSettings.ifscCode;
    
    // Also check for fields in different formats
    if (shopSettings.bankDetails) {
      console.log('Using bank details from shop settings');
      Object.assign(displayBankDetails, shopSettings.bankDetails);
    }
  }
  
  // Determine tax type based on taxOption or other data
  const taxType = saleData.taxOption ? 
    (isCGSTSGST(saleData.taxOption) ? 'cgst_sgst' : 'igst') : 
    (saleData.taxType || 'igst');

  return (
    <div className="print-container">
      <style>
        {`
          /* Force light theme for the entire print container */
          .print-container {
            background-color: white !important;
            color: #374151 !important;
          }
          
          /* Override any dark mode styles in the no-print header */
          .print-container .no-print {
            background-color: #f3f4f6 !important;
            color: #374151 !important;
          }
          
          .print-container .no-print h2 {
            color: #111827 !important;
          }
          
          .print-container .no-print button {
            transition: all 0.2s ease;
          }
          
          @media print {
            body * {
              visibility: hidden;
            }
            .print-container, .print-container * {
              visibility: visible;
            }
            .no-print {
              display: none !important;
            }
            .print-only {
              display: block !important;
            }
            .print-container {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            @page {
              size: auto;
              margin: 10mm;
            }
            /* Ensure print uses white background and black text */
            * {
              background-color: white !important;
              color: black !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
          .print-only {
            display: block;
            background-color: white !important;
            color: black !important;
          }
        `}
      </style>
      
      <div className="no-print mb-4 p-4" style={{ backgroundColor: '#f3f4f6', color: '#374151' }}>
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Invoice #{saleData.invoiceNumber}</h2>
          <div className="flex space-x-2">
            <button 
              onClick={handlePrint} 
              className="px-4 py-2 text-white rounded flex items-center transition-colors"
              style={{ backgroundColor: '#2563eb' }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#1d4ed8'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#2563eb'}
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Invoice
            </button>
            <button 
              onClick={onClose} 
              className="px-4 py-2 text-white rounded flex items-center transition-colors"
              style={{ backgroundColor: '#6b7280' }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#4b5563'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#6b7280'}
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Close
            </button>
          </div>
        </div>
      </div>
      
      <div className="print-only">
        <div style={{ maxWidth: '800px', margin: '0 auto', fontSize: '12px' }}>
          {/* Header with Logo */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              {/* Logo on the left */}
              {(shopSettings?.logoDataURL || shopSettings?.logoUrl) && (
                <div style={{ marginRight: '15px' }}>
                  <img 
                    src={shopSettings.logoDataURL || shopSettings.logoUrl} 
                    alt="Business Logo" 
                    style={{ 
                      maxWidth: '80px', 
                      maxHeight: '80px', 
                      objectFit: 'contain'
                    }} 
                  />
                </div>
              )}
              
              {/* Business info */}
              <div>
                <h1 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '5px' }}>
                  {shopSettings?.businessName || 'PRISM OPTICAL ENTERPRISES'}
                </h1>
                <p style={{ fontSize: '11px', marginBottom: '2px' }}>{formatAddress() || '#340, 1st floor Dr.Rajkumar road, 6th block, Rajajinagar Bengaluru'}</p>
                {shopSettings?.phone && <p style={{ fontSize: '11px', marginBottom: '2px' }}>Phone: {shopSettings.phone}</p>}
                {shopSettings?.email && <p style={{ fontSize: '11px', marginBottom: '2px' }}>Email: {shopSettings.email}</p>}
                <p style={{ fontSize: '11px', marginBottom: '2px' }}>GSTIN: {shopSettings?.gstNumber || '29CLFPM4136F1Z2'}</p>
              </div>
            </div>
            
            <div>
              <h2 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '5px' }}>INVOICE</h2>
              <p style={{ fontSize: '11px', marginBottom: '2px' }}>#{saleData.invoiceNumber}</p>
              <p style={{ fontSize: '11px', marginBottom: '2px' }}>Date: {formatDate(saleData.invoiceDate)}</p>
            </div>
          </div>
          
          <hr style={{ margin: '5px 0', border: '1px solid #ddd' }} />
          
          {/* Customer Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ maxWidth: '60%' }}>
              <h3 style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '3px' }}>Bill To:</h3>
              <p style={{ fontWeight: 'bold', fontSize: '11px', marginBottom: '2px' }}>{saleData.customerName}</p>
              
              {/* Format and display customer address components */}
              {formatCustomerAddress().map((addressLine, index) => (
                <p key={`addr-${index}`} style={{ fontSize: '11px', marginBottom: '2px' }}>{addressLine}</p>
              ))}
              
              {/* Customer phone number */}
              {saleData.customerPhone && (
                <p style={{ fontSize: '11px', marginBottom: '2px' }}>
                  Phone: {saleData.customerPhone}
                </p>
              )}
              
              {/* Customer GST number */}
              {saleData.customerGst && (
                <p style={{ fontSize: '11px', marginBottom: '2px', fontWeight: 'bold' }}>
                  GSTIN: {saleData.customerGst}
                </p>
              )}
            </div>
            <div>
              <h3 style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '3px' }}>Payment Status:</h3>
              <p style={{ fontSize: '11px', marginBottom: '2px' }}>{saleData.paymentStatus || 'UNPAID'}</p>
            </div>
          </div>
          
          {/* Items */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '15px', fontSize: '10px' }}>
            <thead>
              <tr>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'left' }}>S.No</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'left' }}>Order ID</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'left' }}>Particulars</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>SPH</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>CYL</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>AXIS</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>ADD</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>QTY</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>Unit</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'right' }}>Price</th>
                <th style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'right' }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {saleData.items?.map((item, index) => (
                <tr key={index}>
                  <td style={{ border: '1px solid #ddd', padding: '4px' }}>{index + 1}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px' }}>{item.orderId || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px' }}>{item.itemName}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{item.sph || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{item.cyl || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{item.axis || '0'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{item.add || '-'}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{item.qty}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'center' }}>{getItemUnit(item)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'right' }}>{formatCurrency(item.price)}</td>
                  <td style={{ border: '1px solid #ddd', padding: '4px', textAlign: 'right' }}>{formatCurrency(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {/* Summary */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
            <div style={{ width: '250px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                <span>Subtotal:</span>
                <span>{formatCurrency(saleData.subtotal)}</span>
              </div>
              
              {saleData.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                  <span>Discount:</span>
                  <span>-{formatCurrency(saleData.discountAmount)}</span>
                </div>
              )}
              
              {saleData.taxAmount > 0 && (
                <>
                  {taxType === 'igst' ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                      <span>IGST ({saleData.taxRate}%):</span>
                      <span>{formatCurrency(saleData.taxAmount)}</span>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                        <span>CGST ({saleData.taxRate / 2}%):</span>
                        <span>{formatCurrency(saleData.taxAmount / 2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                        <span>SGST ({saleData.taxRate / 2}%):</span>
                        <span>{formatCurrency(saleData.taxAmount / 2)}</span>
                      </div>
                    </>
                  )}
                </>
              )}
              
              {saleData.frieghtCharge > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                  <span>Freight Charge:</span>
                  <span>{formatCurrency(saleData.frieghtCharge)}</span>
                </div>
              )}
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #eee', fontWeight: 'bold' }}>
                <span>Total:</span>
                <span>{formatCurrency(saleData.totalAmount)}</span>
              </div>
              
              {saleData.paymentStatus !== 'UNPAID' && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                    <span>Amount Paid:</span>
                    <span>{formatCurrency(saleData.amountPaid)}</span>
                  </div>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontWeight: 'bold' }}>
                    <span>Balance Due:</span>
                    <span>{formatCurrency(saleData.totalAmount - saleData.amountPaid)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {/* Footer with Bank Details and UPI */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #ddd', paddingTop: '12px', fontSize: '11px' }}>
            {/* Centered thank you message */}
            <div style={{ width: '100%', textAlign: 'center', marginBottom: '15px' }}>
              <p style={{ fontWeight: 'bold', fontSize: '12px' }}>Thank you for your business!</p>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '15px' }}>
              {/* Left side - Bank Details */}
              <div style={{ flex: '3', textAlign: 'left' }}>
                <div style={{ marginTop: '5px', border: '1px solid #ddd', padding: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '11px', color: '#333' }}>Bank Details</p>
                  
                  {/* Always show this section regardless of bankDetails being null */}
                  <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                    <tbody>
                      {/* Only show account name if it comes from settings */}
                      {displayBankDetails.accountName && (
                        <tr>
                          <td style={{ padding: '2px 5px 2px 0', fontWeight: 'bold', fontSize: '10px' }}>Account Name:</td>
                          <td style={{ padding: '2px 0', fontSize: '10px' }}>{displayBankDetails.accountName}</td>
                        </tr>
                      )}
                      
                      {/* Only show bank name if it comes from settings */}
                      {displayBankDetails.bankName && (
                        <tr>
                          <td style={{ padding: '2px 5px 2px 0', fontWeight: 'bold', fontSize: '10px' }}>Bank Name:</td>
                          <td style={{ padding: '2px 0', fontSize: '10px' }}>{displayBankDetails.bankName}</td>
                        </tr>
                      )}
                      
                      {/* Only show account number if it comes from settings */}
                      {displayBankDetails.accountNumber && (
                        <tr>
                          <td style={{ padding: '2px 5px 2px 0', fontWeight: 'bold', fontSize: '10px' }}>Account Number:</td>
                          <td style={{ padding: '2px 0', fontSize: '10px' }}>{displayBankDetails.accountNumber}</td>
                        </tr>
                      )}
                      
                      {/* Show branch if available */}
                      {(displayBankDetails.branchName || displayBankDetails.branch) && (
                        <tr>
                          <td style={{ padding: '2px 5px 2px 0', fontWeight: 'bold', fontSize: '10px' }}>Branch:</td>
                          <td style={{ padding: '2px 0', fontSize: '10px' }}>{displayBankDetails.branchName || displayBankDetails.branch}</td>
                        </tr>
                      )}
                      
                      {/* Only show IFSC if it comes from settings */}
                      {displayBankDetails.ifscCode && (
                        <tr>
                          <td style={{ padding: '2px 5px 2px 0', fontWeight: 'bold', fontSize: '10px' }}>IFSC Code:</td>
                          <td style={{ padding: '2px 0', fontSize: '10px' }}>{displayBankDetails.ifscCode}</td>
                        </tr>
                      )}
                      
                      {/* Only show in development and only if nothing is found */}
                      {false && process.env.NODE_ENV === 'development' && Object.keys(displayBankDetails).length === 0 && (
                        <tr>
                          <td colSpan="2" style={{ color: 'red', fontSize: '8px', padding: '2px 0' }}>
                            No bank details found in settings.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                
                {shopSettings?.termsAndConditions && (
                  <p style={{ fontSize: '8px', marginTop: '7px' }}>{shopSettings.termsAndConditions}</p>
                )}
              </div>
              
              {/* Right side - UPI & QR Code */}
              <div style={{ flex: '2', textAlign: 'center' }}>
                {/* Payment Information Box */}
                <div style={{ border: '1px solid #ddd', padding: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                  <p style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '11px', color: '#333' }}>Payment Options</p>
                  
                  {/* Always show UPI if available */}
                  {(bankDetails?.upiId || displayBankDetails.upiId) && (
                    <div style={{ marginBottom: '5px' }}>
                      <p style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10px' }}>UPI Payment</p>
                      <p style={{ fontSize: '9px', padding: '2px', backgroundColor: '#eee', borderRadius: '2px' }}>
                        {bankDetails?.upiId || displayBankDetails.upiId}
                      </p>
                    </div>
                  )}
                  
                  {/* Display QR code without debug information */}
                  {(() => {
                    // Determine QR code URL from various possible sources
                    const qrCodeUrl = 
                      bankDetails?.qrCodeUrl || 
                      bankDetails?.qrCode || 
                      bankDetails?.qrcode || 
                      shopSettings?.qrCodeDataURL ||  // Add support for the new data URL format
                      shopSettings?.qrCodeUrl || 
                      shopSettings?.qrCode || 
                      shopSettings?.qrcode;
                      
                    // If we have a QR code URL, display it
                    if (qrCodeUrl) {
                      return (
                        <div style={{ marginTop: '5px' }}>
                          <p style={{ fontWeight: 'bold', marginBottom: '3px', fontSize: '10px' }}>Scan QR Code to Pay</p>
                          <div style={{ border: '1px solid #ddd', padding: '4px', borderRadius: '4px', backgroundColor: 'white', display: 'inline-block' }}>
                            <img 
                              src={qrCodeUrl}
                              alt="QR Code for payment" 
                              style={{ width: '90px', height: '90px', objectFit: 'contain' }} 
                            />
                          </div>
                        </div>
                      );
                    }
                    
                    return null;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FallbackInvoicePrint; 
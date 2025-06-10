import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getUserDoc, getUserCollection } from '../utils/multiTenancy';

const FallbackInvoicePrint = ({ saleId, onClose, autoPrint = false }) => {
  const [saleData, setSaleData] = useState(null);
  const [shopSettings, setShopSettings] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [customerOutstanding, setCustomerOutstanding] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [printing, setPrinting] = useState(false);

  // Function to calculate customer's total outstanding balance (excluding current invoice)
  const calculateCustomerOutstanding = async (customerName, customerPhone, currentSaleId) => {
    try {
      // Fetch all data in parallel for better performance
      const [customersSnapshot, salesSnapshot, transactionsSnapshot] = await Promise.all([
        getDocs(getUserCollection('customers')),
        getDocs(getUserCollection('sales')),
        getDocs(getUserCollection('transactions'))
      ]);
      
      // Find customer record
      let customer = null;
      let openingBalance = 0;
      
      customersSnapshot.forEach(doc => {
        const customerData = doc.data();
        const customerOpticalName = customerData.opticalName;
        const customerPhoneNumber = customerData.phone || customerData.phoneNumber;
        
        // Match customer by name or phone (case insensitive for names)
        const nameMatch = customerName && customerOpticalName && 
          customerOpticalName.toLowerCase().trim() === customerName.toLowerCase().trim();
        const phoneMatch = customerPhone && customerPhoneNumber && 
          customerPhoneNumber.toString().trim() === customerPhone.toString().trim();
        
        if (nameMatch || phoneMatch) {
          customer = { id: doc.id, ...customerData };
          openingBalance = parseFloat(customerData.openingBalance) || 0;
        }
      });
      
      if (!customer) {
        return 0;
      }
      
      // Calculate total sales (including current invoice)
      let totalSales = 0;
      let matchedSales = 0;
      
      salesSnapshot.forEach(doc => {
        const sale = doc.data();
        
        // Include all sales for this customer (including current invoice)
        if (sale.customerId === customer.id) {
          matchedSales++;
          // Use 'total' field first, fallback to 'totalAmount'
          totalSales += parseFloat(sale.total || sale.totalAmount) || 0;
        }
      });
      
      // Calculate total payments from transactions
      let totalPayments = 0;
      
      transactionsSnapshot.forEach(doc => {
        const transaction = doc.data();
        if (transaction.entityId === customer.id) {
          const amount = parseFloat(transaction.amount) || 0;
          
          // For customers: 'received' payments reduce balance, 'paid' increases balance
          if (transaction.type === 'received') {
            totalPayments += amount;
          } else if (transaction.type === 'paid') {
            totalPayments -= amount; // Negative because it's money paid TO customer (refund)
          }
        }
      });
      
      // Calculate final outstanding balance
      const currentBalance = openingBalance + totalSales - totalPayments;
      
      // Return positive balance only (outstanding amount)
      return Math.max(0, currentBalance);
      
    } catch (error) {
              // Error calculating customer outstanding - fail silently and show 0
      return 0;
    }
  };

  // Add keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (event) => {
      // Only handle if not typing in input fields
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) {
        return;
      }

      switch (event.key.toLowerCase()) {
        case 'p':
          event.preventDefault();
          if (!printing && !loading) {
            handlePrint();
          }
          break;
        case 'd':
          event.preventDefault();
          if (!loading) {
            handleDirectDownload();
          }
          break;
        case 'escape':
          event.preventDefault();
          if (onClose) {
            onClose();
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [printing, loading, onClose]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetching invoice data
        setLoading(true);
        
        // Fetch sale data from user-specific collection
        const saleDoc = await getDoc(getUserDoc('sales', saleId));
        if (!saleDoc.exists()) {
          throw new Error('Sale not found');
        }
        
        const data = { id: saleId, ...saleDoc.data() };
        setSaleData(data);
        
        // Fetch shop settings from user-specific collection
        const settingsDoc = await getDoc(getUserDoc('settings', 'shopSettings'));
        let bankDetailsData = null;
        let settingsData = null;
        
        if (settingsDoc.exists()) {
          const settings = settingsDoc.data();
          settingsData = settings;
          // Shop settings loaded
          setShopSettings(settings);
          
          // Check if bank details are stored within the shopSettings document
          if (settings.bankDetails) {
            // Using bank details from shop settings
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
            if (settings.qrCodeDataURL || settings.qrCodeUrl || settings.qrCode || settings.qrcode) {
              bankDetailsData.qrCodeUrl = settings.qrCodeDataURL || settings.qrCodeUrl || settings.qrCode || settings.qrcode;
            }
            
            // Remove undefined fields
            Object.keys(bankDetailsData).forEach(key => {
              if (bankDetailsData[key] === undefined) {
                delete bankDetailsData[key];
              }
            });
          }
        }
        
        // If bank details are not complete, try dedicated bankDetails document from user-specific collection
        if (!bankDetailsData || Object.keys(bankDetailsData).filter(k => bankDetailsData[k]).length < 3) {
          try {
                          // Fetching bank details from dedicated document
            const bankDoc = await getDoc(getUserDoc('settings', 'bankDetails'));
            
            if (bankDoc.exists()) {
              const bankData = bankDoc.data();
                              // Found dedicated bank details document
              bankDetailsData = bankData;
            } else {
                              // Searching in other settings documents
              
              // Try to find bank details in any settings document from user-specific collection
              const settingsCollection = await getDocs(getUserCollection('settings'));
              settingsCollection.forEach(doc => {
                if (doc.id !== 'shopSettings') {
                  const docData = doc.data();
                  if (docData.bankName || docData.accountNumber || docData.accountName) {
                    // Create or update bank details
                    if (!bankDetailsData) {
                      bankDetailsData = {};
                    }
                    
                    // Copy all relevant fields
                    ['accountName', 'bankName', 'accountNumber', 'branchName', 
                     'branch', 'ifscCode', 'upiId', 'qrCodeUrl', 'qrCode', 'qrCodeDataURL'].forEach(field => {
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
            // Error fetching bank details - use defaults
          }
        }
        
        // Set the bank details in state
        if (bankDetailsData) {
          // Make sure we have account name - use business name if needed
          if (!bankDetailsData.accountName && settingsData?.businessName) {
            bankDetailsData.accountName = settingsData.businessName;
          }
          
        setBankDetails(bankDetailsData);
      }
      
      setLoading(false);
      
      // Calculate customer outstanding balance asynchronously (non-blocking)
      const customerName = data.customerName || data.selectedCustomer?.opticalName;
      const customerPhone = data.customerPhone || data.selectedCustomer?.phone;
      
      if (customerName || customerPhone) {
        // Don't block the UI loading, calculate outstanding in background
        calculateCustomerOutstanding(customerName, customerPhone, saleId)
          .then(outstanding => {
            setCustomerOutstanding(outstanding);
          })
          .catch(error => {
            // Error calculating outstanding - fail silently
            setCustomerOutstanding(0);
          });
      }
              
        // If autoPrint is true, trigger the print dialog after data is loaded
        if (autoPrint) {
          // Allow more time for all images and resources to load
          setTimeout(() => {
            handlePrint();
          }, 1200);
        }
      } catch (err) {
        // Error during setup - fail silently
        setError(err.message || 'Failed to load invoice');
        setLoading(false);
      }
    };

    fetchData();
  }, [saleId, onClose, autoPrint]);

  // Add print handler function
  const handlePrint = () => {
    if (printing) {
      return;
    }

    if (!saleData) {
      alert("Please wait for the invoice data to load completely before printing.");
      return;
    }

    setPrinting(true);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
              // Print window blocked - user will need to allow popups
      alert("Please allow popups to print the invoice. Check your browser's popup blocker settings.");
      setPrinting(false);
      return;
    }

    // Get the HTML content of the print-only div
    const content = document.querySelector('.print-only');
    if (!content) {
              // Print content not ready yet
      alert("Print content is not ready. Please wait for the invoice to load completely.");
      printWindow.close();
      setPrinting(false);
      return;
    }

    // Generate intelligent filename with customer name and invoice number
    const customerName = (saleData.customerName || saleData.selectedCustomer?.opticalName || 'Customer')
      .replace(/[^a-zA-Z0-9\s]/g, '') // Remove special characters
      .replace(/\s+/g, '_'); // Replace spaces with underscores
    
    const invoiceNum = getInvoiceSuffix(saleData?.invoiceNumber) || 'Invoice';
    const suggestedFilename = `${customerName}_Invoice_${invoiceNum}`;

    try {
      // Write to the new window
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${suggestedFilename}</title>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: white;
                color: black;
                font-size: 12px;
              }
              table {
                border-collapse: collapse;
                width: 100%;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 4px;
                font-size: 10px;
              }
              th {
                background-color: #f5f5f5;
                font-weight: bold;
              }
              img {
                max-width: 100%;
                height: auto;
              }
              @media print {
                @page {
                  margin: 10mm;
                  size: A4;
                }
                body {
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                  background-color: white !important;
                  color: black !important;
                }
                * {
                  background-color: white !important;
                  color: black !important;
                }
              }
              .print-header {
                margin-bottom: 15px;
              }
              .print-footer {
                margin-top: 20px;
              }
            </style>
          </head>
          <body>
            ${content.innerHTML}
            <script>
              // Set document title for better PDF naming
              document.title = '${suggestedFilename}';
              
              // Wait for images to load before printing
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                }, 500);
              };
              
              // Handle print dialog events
              window.onafterprint = function() {
                // Auto-close the print window after printing is complete
                setTimeout(function() {
                  window.close();
                }, 1000);
              };
              
              // Also handle if user cancels the print dialog
              window.onbeforeunload = function() {
                // This will trigger when window is about to close
                return null;
              };
            </script>
          </body>
        </html>
      `);

      printWindow.document.close();
      
      // Enhanced fallback handling
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.focus();
          try {
            printWindow.print();
          } catch (e) {
            // Error during printing - fail silently
          }
        }
        setPrinting(false);
        
        // Auto-close the print modal after a delay (user will be in print dialog)
        setTimeout(() => {
          if (onClose) {
            onClose();
          }
        }, 2000);
      }, 1000);

    } catch (error) {
              // Error setting up print window
      alert('Error preparing the invoice for printing. Please try again.');
      if (printWindow) {
        printWindow.close();
      }
      setPrinting(false);
    }
  };

  // Add direct PDF download function
  const handleDirectDownload = async () => {
    if (!saleData) {
      alert("Please wait for the invoice data to load completely.");
      return;
    }

    try {
      // Generate filename
      const customerName = (saleData.customerName || saleData.selectedCustomer?.opticalName || 'Customer')
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_');
      
      const invoiceNum = getInvoiceSuffix(saleData?.invoiceNumber) || 'Invoice';
      const filename = `${customerName}_Invoice_${invoiceNum}.pdf`;

      // Create a temporary link to trigger download
      const content = document.querySelector('.print-only');
      if (!content) {
        alert("Invoice content not ready. Please wait.");
        return;
      }

      // Use window.print() but with a different approach for direct download
      const printCSS = `
        @media print {
          @page { margin: 10mm; size: A4; }
          body { margin: 0; padding: 20px; font-family: Arial, sans-serif; font-size: 12px; }
          * { background-color: white !important; color: black !important; }
        }
      `;

      const printWindow = window.open('', '_blank');
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>${filename}</title>
            <style>${printCSS}</style>
          </head>
          <body>
            ${content.innerHTML}
            <script>
              document.title = '${filename}';
              window.onload = function() {
                setTimeout(function() {
                  window.print();
                  setTimeout(function() { window.close(); }, 2000);
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();

      // Close the modal immediately since user wanted direct download
      setTimeout(() => {
        if (onClose) onClose();
      }, 1000);

    } catch (error) {
              // Error creating download
      alert('Error preparing download. Please try the regular print option.');
    }
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
    
    // Use the actual unit from the item if available
    if (item.unit) {
      return item.unit;
    }
    
    // Try to determine unit based on item category or type if unit is missing
    if (item.category === 'lenses' || item.type === 'lenses' || 
        item.itemName?.toLowerCase().includes('lens')) {
      return 'Pairs';
    }
    
    // Default unit for items without specific unit
    return 'Pcs';
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
    if (saleData.customerAddress || saleData.selectedCustomer?.address) {
      addressParts.push(saleData.customerAddress || saleData.selectedCustomer?.address);
    }
    
    // Add the location line (city, state, pincode)
    const locationParts = [];
    if (saleData.customerCity || saleData.selectedCustomer?.city) {
      locationParts.push(saleData.customerCity || saleData.selectedCustomer?.city);
    }
    if (saleData.customerState || saleData.selectedCustomer?.state) {
      locationParts.push(saleData.customerState || saleData.selectedCustomer?.state);
    }
    if (saleData.customerPincode || saleData.selectedCustomer?.pincode || saleData.selectedCustomer?.pinCode) {
      locationParts.push(saleData.customerPincode || saleData.selectedCustomer?.pincode || saleData.selectedCustomer?.pinCode);
    }
    
    if (locationParts.length > 0) {
      addressParts.push(locationParts.join(', '));
    }
    
    return addressParts;
  };

  // Get customer phone number from various possible sources
  const getCustomerPhone = () => {
    return saleData.customerPhone || 
           saleData.selectedCustomer?.phone || 
           saleData.selectedCustomer?.phoneNumber || 
           saleData.selectedCustomer?.mobile || 
           null;
  };

  // Get customer GST number from various possible sources
  const getCustomerGST = () => {
    return saleData.customerGst || 
           saleData.customerGstNumber || 
           saleData.selectedCustomer?.gstNumber || 
           saleData.selectedCustomer?.gst || 
           null;
  };

  // Extract only the suffix (number part) from invoice number
  const getInvoiceSuffix = (invoiceNumber) => {
    if (!invoiceNumber) return '';
    
    // Try to match pattern like "2024-2025/61" and extract "61"
    const match = invoiceNumber.match(/^(\d{4}-\d{4})\/(\d+)$/);
    if (match) {
      return match[2]; // Return just the number part
    }
    
    // If no match, try to extract any trailing numbers
    const fallbackMatch = invoiceNumber.match(/(\d+)$/);
    if (fallbackMatch) {
      return fallbackMatch[1];
    }
    
    // If still no match, return the original
    return invoiceNumber;
  };

  // Calculate total quantities with service separation
  const calculateTotalQuantities = () => {
    if (!saleData?.items) return { totalPairs: 0, totalServices: 0, totalOthers: 0 };
    
    let totalPairs = 0;
    let totalServices = 0;
    let totalOthers = 0;
    
    saleData.items.forEach(item => {
      const qty = parseInt(item.qty) || 0;
      const unit = getItemUnit(item).toLowerCase();
      
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

  // Create a fallback bank details object if nothing was found
  const displayBankDetails = bankDetails || {};
  // If we have shop settings but no bank details, extract relevant fields
  if (!bankDetails && shopSettings) {
    if (shopSettings.accountName) displayBankDetails.accountName = shopSettings.accountName;
    if (shopSettings.accountNumber) displayBankDetails.accountNumber = shopSettings.accountNumber;
    if (shopSettings.bankName) displayBankDetails.bankName = shopSettings.bankName;
    if (shopSettings.branchName) displayBankDetails.branchName = shopSettings.branchName;
    if (shopSettings.ifscCode) displayBankDetails.ifscCode = shopSettings.ifscCode;
    
    // Also check for fields in different formats
    if (shopSettings.bankDetails) {
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
          <h2 className="text-xl font-bold" style={{ color: '#111827' }}>Invoice #{getInvoiceSuffix(saleData.invoiceNumber)}</h2>
          <div className="flex space-x-2">
            <button 
              onClick={handlePrint} 
              disabled={printing || loading}
              className="px-4 py-2 text-white rounded flex items-center transition-colors"
              style={{ backgroundColor: printing || loading ? '#9ca3af' : '#2563eb' }}
              onMouseOver={(e) => {
                if (!printing && !loading) {
                  e.target.style.backgroundColor = '#1d4ed8';
                }
              }}
              onMouseOut={(e) => {
                if (!printing && !loading) {
                  e.target.style.backgroundColor = '#2563eb';
                }
              }}
            >
              {printing ? (
                <>
                  <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Preparing Print...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Quick Print (P)
                </>
              )}
            </button>

            {/* Direct Download */}
            <button 
              onClick={handleDirectDownload} 
              disabled={loading}
              className="px-3 py-2 text-white rounded flex items-center transition-colors"
              style={{ backgroundColor: loading ? '#9ca3af' : '#059669' }}
              onMouseOver={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#047857';
                }
              }}
              onMouseOut={(e) => {
                if (!loading) {
                  e.target.style.backgroundColor = '#059669';
                }
              }}
              title="Direct download with customer name in filename (Press D)"
            >
              <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download (D)
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
              Close (ESC)
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
              <p style={{ fontSize: '11px', marginBottom: '2px' }}>#{getInvoiceSuffix(saleData.invoiceNumber)}</p>
              <p style={{ fontSize: '11px', marginBottom: '2px' }}>Date: {formatDate(saleData.invoiceDate)}</p>
            </div>
          </div>
          
          <hr style={{ margin: '5px 0', border: '1px solid #ddd' }} />
          
          {/* Customer Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ maxWidth: '60%' }}>
              <h3 style={{ fontWeight: 'bold', fontSize: '12px', marginBottom: '3px' }}>Bill To:</h3>
              <p style={{ fontWeight: 'bold', fontSize: '14px', marginBottom: '2px' }}>{saleData.customerName || saleData.selectedCustomer?.opticalName}</p>
              
              {/* Format and display customer address components */}
              {formatCustomerAddress().map((addressLine, index) => (
                <p key={`addr-${index}`} style={{ fontSize: '11px', marginBottom: '2px' }}>{addressLine}</p>
              ))}
              
              {/* Customer phone number */}
              {getCustomerPhone() && (
                <p style={{ fontSize: '11px', marginBottom: '2px' }}>
                  Phone: {getCustomerPhone()}
                </p>
              )}
              
              {/* Customer GST number */}
              {getCustomerGST() && (
                <p style={{ fontSize: '11px', marginBottom: '2px', fontWeight: 'bold' }}>
                  GSTIN: {getCustomerGST()}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '10px' }}>
            {/* Left side - Customer Outstanding Balance */}
            <div style={{ width: '300px', fontSize: '11px' }}>
              {customerOutstanding > 0 && (
                <div style={{ padding: '8px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px' }}>
                  <p style={{ fontWeight: 'bold', fontSize: '11px', color: '#856404', marginBottom: '4px' }}>
                    Outstanding Balance:
                  </p>
                  <p style={{ fontWeight: 'bold', fontSize: '13px', color: '#856404', margin: '0' }}>
                    {formatCurrency(customerOutstanding)}
                  </p>
                </div>
              )}
            </div>
            
            {/* Right side - Invoice Summary */}
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
              
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #eee' }}>
                <span>Total Quantity:</span>
                <span style={{ fontWeight: 'bold' }}>{formatQuantityDisplay()}</span>
              </div>
              
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
                  
                  {/* Bank details without table structure */}
                  <div>
                    {/* Only show account name if it comes from settings */}
                    {displayBankDetails.accountName && (
                      <div style={{ marginBottom: '3px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Account Name: </span>
                        <span style={{ fontSize: '10px' }}>{displayBankDetails.accountName}</span>
                      </div>
                    )}
                    
                    {/* Only show bank name if it comes from settings */}
                    {displayBankDetails.bankName && (
                      <div style={{ marginBottom: '3px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Bank Name: </span>
                        <span style={{ fontSize: '10px' }}>{displayBankDetails.bankName}</span>
                      </div>
                    )}
                    
                    {/* Only show account number if it comes from settings */}
                    {displayBankDetails.accountNumber && (
                      <div style={{ marginBottom: '3px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Account Number: </span>
                        <span style={{ fontSize: '10px' }}>{displayBankDetails.accountNumber}</span>
                      </div>
                    )}
                    
                    {/* Show branch if available */}
                    {(displayBankDetails.branchName || displayBankDetails.branch) && (
                      <div style={{ marginBottom: '3px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '10px' }}>Branch: </span>
                        <span style={{ fontSize: '10px' }}>{displayBankDetails.branchName || displayBankDetails.branch}</span>
                      </div>
                    )}
                    
                    {/* Only show IFSC if it comes from settings */}
                    {displayBankDetails.ifscCode && (
                      <div style={{ marginBottom: '3px' }}>
                        <span style={{ fontWeight: 'bold', fontSize: '10px' }}>IFSC Code: </span>
                        <span style={{ fontSize: '10px' }}>{displayBankDetails.ifscCode}</span>
                      </div>
                    )}
                    
                    {/* Only show in development and only if nothing is found */}
                    {false && process.env.NODE_ENV === 'development' && Object.keys(displayBankDetails).length === 0 && (
                      <div style={{ color: 'red', fontSize: '8px', marginBottom: '3px' }}>
                        No bank details found in settings.
                      </div>
                    )}
                  </div>
                </div>
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
            
            {/* Terms and Conditions Section */}
            {shopSettings?.termsAndConditions && (
              <div style={{ marginTop: '15px', border: '1px solid #ddd', padding: '8px', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
                <p style={{ fontWeight: 'bold', marginBottom: '5px', fontSize: '11px', color: '#333' }}>Terms and Conditions</p>
                <div style={{ fontSize: '8px', lineHeight: '1.4', color: '#555' }}>
                  {shopSettings.termsAndConditions.split('\n').map((line, index) => {
                    const trimmedLine = line.trim();
                    if (!trimmedLine) return null;
                    
                    // Check if line starts with bullet point indicators
                    const isBulletPoint = trimmedLine.startsWith('•') || 
                                        trimmedLine.startsWith('-') || 
                                        trimmedLine.startsWith('*') ||
                                        /^\d+\./.test(trimmedLine);
                    
                    if (isBulletPoint) {
                      return (
                        <div key={index} style={{ marginBottom: '2px', paddingLeft: '8px' }}>
                          {trimmedLine}
                        </div>
                      );
                    } else {
                      return (
                        <div key={index} style={{ marginBottom: '3px' }}>
                          {trimmedLine}
                        </div>
                      );
                    }
                  }).filter(Boolean)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FallbackInvoicePrint; 
import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import * as XLSX from 'xlsx';

const GSTReturns = () => {
  const [fromDate, setFromDate] = useState(() => {
    // Default to first day of current month
    const date = new Date();
    date.setDate(1);
    return date.toISOString().split('T')[0];
  });
  
  const [toDate, setToDate] = useState(() => {
    // Default to today
    return new Date().toISOString().split('T')[0];
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('gstr1'); // 'gstr1' or 'gstr3b'
  
  // Data for reports
  const [reportData, setReportData] = useState({
    b2bInvoices: [],
    b2cInvoices: [],
    invoiceCount: 0,
    receiptCount: 0,
    totalAmount: 0,
    totalTaxAmount: 0,
    b2bTotalAmount: 0,
    b2bTaxAmount: 0, 
    b2cTotalAmount: 0,
    b2cTaxAmount: 0
  });

  // GSTR-3B specific data
  const [gstr3bData, setGstr3bData] = useState({
    outwardSupplies: {
      taxableSupplies: { taxableValue: 0, integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
      zeroRatedSupplies: { taxableValue: 0, integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
      exemptSupplies: { taxableValue: 0, integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
      nilRatedSupplies: { taxableValue: 0, integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 }
    },
    inputTaxCredit: {
      inwardSupplies: { integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
      reversalItc: { integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
      netItc: { integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 }
    },
    taxPayable: {
      integratedTax: 0,
      centralTax: 0,
      stateTax: 0,
      cess: 0
    },
    interestAndFees: {
      interestOnDelay: 0,
      lateFees: 0,
      penaltyAmount: 0
    }
  });
  
  // Handle generating reports
  const generateReports = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Create date objects for filtering
      const startDate = new Date(fromDate);
      startDate.setHours(0, 0, 0, 0); // Start of day
      
      const endDate = new Date(toDate);
      endDate.setHours(23, 59, 59, 999); // End of day
      
      console.log('Generating GST reports from:', startDate, 'to:', endDate);
      
      // Fetch all sales within date range
      const salesRef = collection(db, 'sales');
      const salesQuery = query(
        salesRef,
        where('invoiceDate', '>=', startDate),
        where('invoiceDate', '<=', endDate),
        orderBy('invoiceDate', 'asc')
      );
      
      const salesSnapshot = await getDocs(salesQuery);
      const allSales = salesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        invoiceDate: doc.data().invoiceDate.toDate()
      }));

      // Fetch all purchases within date range for ITC calculation
      const purchasesRef = collection(db, 'purchases');
      const purchasesQuery = query(
        purchasesRef,
        where('purchaseDate', '>=', startDate),
        where('purchaseDate', '<=', endDate),
        orderBy('purchaseDate', 'asc')
      );
      
      const purchasesSnapshot = await getDocs(purchasesQuery);
      const allPurchases = purchasesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        purchaseDate: doc.data().purchaseDate.toDate ? doc.data().purchaseDate.toDate() : new Date(doc.data().purchaseDate)
      }));
      
      // Fetch transactions (receipts) within date range
      const transactionsRef = collection(db, 'transactions');
      const transactionsQuery = query(
        transactionsRef,
        where('date', '>=', startDate),
        where('date', '<=', endDate),
        orderBy('date', 'asc')
      );
      
      const transactionsSnapshot = await getDocs(transactionsQuery);
      const allTransactions = transactionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        date: doc.data().date.toDate()
      }));
      
      // Process invoices - ensure numbers are properly parsed
      const processedSales = allSales.map(sale => {
        // Make sure numeric values are properly parsed
        return {
          ...sale,
          totalAmount: parseFloat(sale.totalAmount || 0),
          subtotal: parseFloat(sale.subtotal || 0),
          taxAmount: parseFloat(sale.taxAmount || 0),
          taxRate: parseFloat(sale.taxRate || 0)
        };
      });
      
      // Separate B2B (with GST) and B2C (without GST) invoices
      const b2bInvoices = processedSales.filter(sale => sale.customerGst && sale.customerGst.length > 0);
      const b2cInvoices = processedSales.filter(sale => !sale.customerGst || sale.customerGst.length === 0);
      
      // Calculate totals with properly parsed numeric values
      const totalAmount = processedSales.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      const totalTaxAmount = processedSales.reduce((sum, sale) => sum + (sale.taxAmount || 0), 0);
      
      // Calculate B2B specific totals
      const b2bTotalAmount = b2bInvoices.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      const b2bTaxAmount = b2bInvoices.reduce((sum, sale) => sum + (sale.taxAmount || 0), 0);
      
      // Calculate B2C specific totals
      const b2cTotalAmount = b2cInvoices.reduce((sum, sale) => sum + (sale.totalAmount || 0), 0);
      const b2cTaxAmount = b2cInvoices.reduce((sum, sale) => sum + (sale.taxAmount || 0), 0);

      // Calculate GSTR-3B data
      const gstr3bCalculated = calculateGSTR3BData(processedSales, allPurchases);
      
      setReportData({
        b2bInvoices,
        b2cInvoices,
        invoiceCount: processedSales.length,
        receiptCount: allTransactions.length,
        totalAmount,
        totalTaxAmount,
        b2bTotalAmount,
        b2bTaxAmount,
        b2cTotalAmount,
        b2cTaxAmount
      });

      setGstr3bData(gstr3bCalculated);
      
      setSuccess('GST return data generated successfully');
      
    } catch (error) {
      console.error('Error generating GST reports:', error);
      setError('Failed to generate GST return data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Calculate GSTR-3B specific data
  const calculateGSTR3BData = (sales, purchases) => {
    const data = {
      outwardSupplies: {
        taxableSupplies: { taxableValue: 0, integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
        zeroRatedSupplies: { taxableValue: 0, integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
        exemptSupplies: { taxableValue: 0, integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
        nilRatedSupplies: { taxableValue: 0, integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 }
      },
      inputTaxCredit: {
        inwardSupplies: { integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
        reversalItc: { integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 },
        netItc: { integratedTax: 0, centralTax: 0, stateTax: 0, cess: 0 }
      },
      taxPayable: {
        integratedTax: 0,
        centralTax: 0,
        stateTax: 0,
        cess: 0
      },
      interestAndFees: {
        interestOnDelay: 0,
        lateFees: 0,
        penaltyAmount: 0
      }
    };

    // Calculate outward supplies (from sales)
    sales.forEach(sale => {
      const taxableValue = parseFloat(sale.subtotal || 0);
      const taxAmount = parseFloat(sale.taxAmount || 0);
      const taxRate = parseFloat(sale.taxRate || 0);

      if (taxRate > 0) {
        // Taxable supplies
        data.outwardSupplies.taxableSupplies.taxableValue += taxableValue;
        
        // Determine tax type based on sale location/customer
        if (sale.taxOption && sale.taxOption.includes('IGST')) {
          data.outwardSupplies.taxableSupplies.integratedTax += taxAmount;
        } else if (sale.taxOption && sale.taxOption.includes('CGST_SGST')) {
          data.outwardSupplies.taxableSupplies.centralTax += taxAmount / 2;
          data.outwardSupplies.taxableSupplies.stateTax += taxAmount / 2;
        }
      } else {
        // Exempt/nil rated supplies
        data.outwardSupplies.exemptSupplies.taxableValue += taxableValue;
      }
    });

    // Calculate input tax credit (from purchases)
    purchases.forEach(purchase => {
      const taxAmount = parseFloat(purchase.taxAmount || 0);
      
      if (taxAmount > 0) {
        // Determine tax type based on purchase
        if (purchase.taxOption && purchase.taxOption.includes('IGST')) {
          data.inputTaxCredit.inwardSupplies.integratedTax += taxAmount;
        } else if (purchase.taxOption && purchase.taxOption.includes('CGST_SGST')) {
          data.inputTaxCredit.inwardSupplies.centralTax += taxAmount / 2;
          data.inputTaxCredit.inwardSupplies.stateTax += taxAmount / 2;
        }
      }
    });

    // Calculate net ITC (inward supplies - reversal)
    data.inputTaxCredit.netItc.integratedTax = data.inputTaxCredit.inwardSupplies.integratedTax - data.inputTaxCredit.reversalItc.integratedTax;
    data.inputTaxCredit.netItc.centralTax = data.inputTaxCredit.inwardSupplies.centralTax - data.inputTaxCredit.reversalItc.centralTax;
    data.inputTaxCredit.netItc.stateTax = data.inputTaxCredit.inwardSupplies.stateTax - data.inputTaxCredit.reversalItc.stateTax;
    data.inputTaxCredit.netItc.cess = data.inputTaxCredit.inwardSupplies.cess - data.inputTaxCredit.reversalItc.cess;

    // Calculate tax payable (outward tax - net ITC)
    data.taxPayable.integratedTax = Math.max(0, data.outwardSupplies.taxableSupplies.integratedTax - data.inputTaxCredit.netItc.integratedTax);
    data.taxPayable.centralTax = Math.max(0, data.outwardSupplies.taxableSupplies.centralTax - data.inputTaxCredit.netItc.centralTax);
    data.taxPayable.stateTax = Math.max(0, data.outwardSupplies.taxableSupplies.stateTax - data.inputTaxCredit.netItc.stateTax);
    data.taxPayable.cess = Math.max(0, data.outwardSupplies.taxableSupplies.cess - data.inputTaxCredit.netItc.cess);

    return data;
  };
  
  // Export data as Excel with multiple sheets
  const exportGSTData = () => {
    if (activeTab === 'gstr1') {
      exportGSTR1Data();
    } else {
      exportGSTR3BData();
    }
  };

  // Export GSTR-1 data (existing functionality)
  const exportGSTR1Data = () => {
    if (reportData.b2bInvoices.length === 0 && reportData.b2cInvoices.length === 0) {
      setError('No invoice data to export');
      return;
    }
    
    // Create workbook and worksheets
    const workbook = XLSX.utils.book_new();
    
    // Create summary sheet data
    const summaryData = [
      ['GST Return Summary'],
      ['Period:', `${formatDate(fromDate)} to ${formatDate(toDate)}`],
      [''],
      ['Overall Summary'],
      ['Total Invoices:', reportData.invoiceCount],
      ['Total Receipts:', reportData.receiptCount],
      ['Total Amount:', reportData.totalAmount.toFixed(2)],
      ['Total Tax Amount:', reportData.totalTaxAmount.toFixed(2)],
      [''],
      ['B2B Summary (GST Registered)'],
      ['Total B2B Invoices:', reportData.b2bInvoices.length],
      ['Total B2B Amount:', reportData.b2bTotalAmount.toFixed(2)],
      ['Total B2B Tax:', reportData.b2bTaxAmount.toFixed(2)],
      [''],
      ['B2C Summary (Non-GST)'],
      ['Total B2C Invoices:', reportData.b2cInvoices.length],
      ['Total B2C Amount:', reportData.b2cTotalAmount.toFixed(2)],
      ['Total B2C Tax:', reportData.b2cTaxAmount.toFixed(2)]
    ];
    
    // Create summary worksheet
    const summaryWorksheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Summary');
    
    // Create B2B sheet data
    if (reportData.b2bInvoices.length > 0) {
      // B2B header row
      const b2bHeader = [
        'GSTIN/UIN of Recipient', 
        'Receiver Name', 
        'Invoice Number', 
        'Invoice date', 
        'Invoice Value', 
        'Place Of Supply', 
        'Reverse Charge', 
        'Applicable % of Tax Rate', 
        'Invoice Type', 
        'E-Commerce GSTIN', 
        'Rate', 
        'Taxable Value', 
        'Cess Amount'
      ];
      
      // B2B data rows
      const b2bData = reportData.b2bInvoices.map(invoice => {
        const invoiceDate = formatDate(invoice.invoiceDate, 'dd/MM/yyyy');
        const placeOfSupply = invoice.customerState || '';
        const reverseCharge = 'N'; // Default to No
        const applicableTaxRate = ''; // Usually empty
        const invoiceType = 'Regular'; // Default
        const ecommerceGSTIN = ''; // Usually empty
        const taxRate = invoice.taxRate || 0;
        const taxableValue = invoice.subtotal || 0;
        const cessAmount = 0; // Usually 0
        
        return [
          invoice.customerGst,
          invoice.customerName,
          invoice.invoiceNumber,
          invoiceDate,
          invoice.totalAmount,
          placeOfSupply,
          reverseCharge,
          applicableTaxRate,
          invoiceType,
          ecommerceGSTIN,
          taxRate,
          taxableValue,
          cessAmount
        ];
      });
      
      // Create B2B worksheet with header + data
      const b2bWorksheet = XLSX.utils.aoa_to_sheet([b2bHeader, ...b2bData]);
      XLSX.utils.book_append_sheet(workbook, b2bWorksheet, 'B2B');
    }
    
    // Create B2C sheet data
    if (reportData.b2cInvoices.length > 0) {
      // B2C header row
      const b2cHeader = [
        'Invoice Number',
        'Invoice date',
        'Invoice Value',
        'Place Of Supply',
        'Rate',
        'Taxable Value',
        'Cess Amount',
        'E-Commerce GSTIN'
      ];
      
      // B2C data rows
      const b2cData = reportData.b2cInvoices.map(invoice => {
        const invoiceDate = formatDate(invoice.invoiceDate, 'dd/MM/yyyy');
        const placeOfSupply = invoice.customerState || '';
        const taxRate = invoice.taxRate || 0;
        const taxableValue = invoice.subtotal || 0;
        const cessAmount = 0; // Usually 0
        const ecommerceGSTIN = ''; // Usually empty
        
        return [
          invoice.invoiceNumber,
          invoiceDate,
          invoice.totalAmount,
          placeOfSupply,
          taxRate,
          taxableValue,
          cessAmount,
          ecommerceGSTIN
        ];
      });
      
      // Create B2C worksheet with header + data
      const b2cWorksheet = XLSX.utils.aoa_to_sheet([b2cHeader, ...b2cData]);
      XLSX.utils.book_append_sheet(workbook, b2cWorksheet, 'B2C');
    }
    
    // Generate the Excel file and trigger download
    const fileName = `GSTR1_Return_${fromDate}_to_${toDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    setSuccess(`Excel file "${fileName}" generated successfully with all GST data`);
  };

  // Export GSTR-3B data
  const exportGSTR3BData = () => {
    const workbook = XLSX.utils.book_new();
    
    // GSTR-3B Summary Sheet
    const gstr3bSummaryData = [
      ['GSTR-3B Return'],
      ['Period:', `${formatDate(fromDate)} to ${formatDate(toDate)}`],
      [''],
      ['3.1 Details of Outward Supplies and inward supplies liable to reverse charge'],
      ['Nature of Supplies', 'Total Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess'],
      [
        '(a) Outward taxable supplies (other than zero rated, nil rated and exempted)',
        gstr3bData.outwardSupplies.taxableSupplies.taxableValue.toFixed(2),
        gstr3bData.outwardSupplies.taxableSupplies.integratedTax.toFixed(2),
        gstr3bData.outwardSupplies.taxableSupplies.centralTax.toFixed(2),
        gstr3bData.outwardSupplies.taxableSupplies.stateTax.toFixed(2),
        gstr3bData.outwardSupplies.taxableSupplies.cess.toFixed(2)
      ],
      [
        '(b) Outward taxable supplies (zero rated)',
        gstr3bData.outwardSupplies.zeroRatedSupplies.taxableValue.toFixed(2),
        gstr3bData.outwardSupplies.zeroRatedSupplies.integratedTax.toFixed(2),
        gstr3bData.outwardSupplies.zeroRatedSupplies.centralTax.toFixed(2),
        gstr3bData.outwardSupplies.zeroRatedSupplies.stateTax.toFixed(2),
        gstr3bData.outwardSupplies.zeroRatedSupplies.cess.toFixed(2)
      ],
      [
        '(c) Other outward supplies (Nil rated, exempted)',
        gstr3bData.outwardSupplies.exemptSupplies.taxableValue.toFixed(2),
        gstr3bData.outwardSupplies.exemptSupplies.integratedTax.toFixed(2),
        gstr3bData.outwardSupplies.exemptSupplies.centralTax.toFixed(2),
        gstr3bData.outwardSupplies.exemptSupplies.stateTax.toFixed(2),
        gstr3bData.outwardSupplies.exemptSupplies.cess.toFixed(2)
      ],
      [''],
      ['4. Eligible ITC'],
      ['Details', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess'],
      [
        '(A) ITC Available (whether in full or part)',
        gstr3bData.inputTaxCredit.inwardSupplies.integratedTax.toFixed(2),
        gstr3bData.inputTaxCredit.inwardSupplies.centralTax.toFixed(2),
        gstr3bData.inputTaxCredit.inwardSupplies.stateTax.toFixed(2),
        gstr3bData.inputTaxCredit.inwardSupplies.cess.toFixed(2)
      ],
      [
        '(D) Ineligible ITC',
        gstr3bData.inputTaxCredit.reversalItc.integratedTax.toFixed(2),
        gstr3bData.inputTaxCredit.reversalItc.centralTax.toFixed(2),
        gstr3bData.inputTaxCredit.reversalItc.stateTax.toFixed(2),
        gstr3bData.inputTaxCredit.reversalItc.cess.toFixed(2)
      ],
      [
        'Net ITC Available',
        gstr3bData.inputTaxCredit.netItc.integratedTax.toFixed(2),
        gstr3bData.inputTaxCredit.netItc.centralTax.toFixed(2),
        gstr3bData.inputTaxCredit.netItc.stateTax.toFixed(2),
        gstr3bData.inputTaxCredit.netItc.cess.toFixed(2)
      ],
      [''],
      ['6.1 Payment of Tax'],
      ['Description', 'Tax payable', 'Integrated Tax', 'Central Tax', 'State/UT Tax', 'Cess'],
      [
        'Tax Liability',
        '',
        gstr3bData.taxPayable.integratedTax.toFixed(2),
        gstr3bData.taxPayable.centralTax.toFixed(2),
        gstr3bData.taxPayable.stateTax.toFixed(2),
        gstr3bData.taxPayable.cess.toFixed(2)
      ],
      [''],
      ['Interest and Late Fees'],
      ['Description', 'Amount'],
      ['Interest on delayed payment', gstr3bData.interestAndFees.interestOnDelay.toFixed(2)],
      ['Late fees', gstr3bData.interestAndFees.lateFees.toFixed(2)],
      ['Penalty', gstr3bData.interestAndFees.penaltyAmount.toFixed(2)]
    ];
    
    const gstr3bWorksheet = XLSX.utils.aoa_to_sheet(gstr3bSummaryData);
    XLSX.utils.book_append_sheet(workbook, gstr3bWorksheet, 'GSTR-3B');
    
    // Generate the Excel file and trigger download
    const fileName = `GSTR3B_Return_${fromDate}_to_${toDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    setSuccess(`Excel file "${fileName}" generated successfully with GSTR-3B data`);
  };
  
  // Format date in specified format
  const formatDate = (date, format = 'MMM dd, yyyy') => {
    if (!date) return '';
    
    const d = new Date(date);
    
    if (format === 'dd/MM/yyyy') {
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    }
    
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };
  
  // Format currency
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '₹0.00';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };
  
  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">GST Returns</h1>
          <p className="mt-1 text-sm text-gray-500">Generate GST returns data for GSTR-1 and GSTR-3B</p>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow mb-4">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-4">
              <button
                onClick={() => setActiveTab('gstr1')}
                className={`${
                  activeTab === 'gstr1'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                GSTR-1 (B2B/B2C)
              </button>
              <button
                onClick={() => setActiveTab('gstr3b')}
                className={`${
                  activeTab === 'gstr3b'
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              >
                GSTR-3B (Summary)
              </button>
            </nav>
          </div>
        </div>
        
        {/* Filter Section */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
              />
            </div>
            
            <div>
              <button
                onClick={generateReports}
                disabled={loading}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {loading ? 'Generating...' : 'Generate Reports'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-50 text-green-700 rounded-md">
            {success}
          </div>
        )}
        
        {/* Export Button */}
        {((activeTab === 'gstr1' && (reportData.b2bInvoices.length > 0 || reportData.b2cInvoices.length > 0)) ||
          (activeTab === 'gstr3b' && gstr3bData.outwardSupplies.taxableSupplies.taxableValue > 0)) && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={exportGSTData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Export {activeTab === 'gstr1' ? 'GSTR-1' : 'GSTR-3B'} Return
            </button>
          </div>
        )}

        {/* GSTR-1 Content */}
        {activeTab === 'gstr1' && (
          <>
            {/* Summary Section */}
            {(reportData.b2bInvoices.length > 0 || reportData.b2cInvoices.length > 0) && (
              <div className="bg-white rounded-lg shadow mb-4">
                <div className="p-4 border-b">
                  <h2 className="text-lg font-medium text-gray-900">Summary</h2>
                  <p className="text-sm text-gray-500">Data for period: {formatDate(fromDate)} to {formatDate(toDate)}</p>
                </div>
                
                <div className="p-4">
                  <h3 className="text-md font-medium text-gray-800 mb-3">Overall Totals</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                    <div className="bg-blue-50 p-3 rounded-lg">
                      <p className="text-sm text-blue-800 font-medium">Total Invoices</p>
                      <p className="text-xl font-bold text-blue-900">{reportData.invoiceCount}</p>
                    </div>
                    
                    <div className="bg-green-50 p-3 rounded-lg">
                      <p className="text-sm text-green-800 font-medium">Total Receipts</p>
                      <p className="text-xl font-bold text-green-900">{reportData.receiptCount}</p>
                    </div>
                    
                    <div className="bg-purple-50 p-3 rounded-lg">
                      <p className="text-sm text-purple-800 font-medium">Total Amount</p>
                      <p className="text-xl font-bold text-purple-900">{formatCurrency(reportData.totalAmount)}</p>
                    </div>
                    
                    <div className="bg-yellow-50 p-3 rounded-lg">
                      <p className="text-sm text-yellow-800 font-medium">Total Tax</p>
                      <p className="text-xl font-bold text-yellow-900">{formatCurrency(reportData.totalTaxAmount)}</p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4">
                    {/* B2B Summary */}
                    {reportData.b2bInvoices.length > 0 && (
                      <div className="flex-1 border border-gray-200 rounded-lg p-3">
                        <h3 className="text-md font-medium text-gray-800 mb-2">B2B (With GST)</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Invoices:</span>
                            <span className="text-sm font-medium">{reportData.b2bInvoices.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Total Amount:</span>
                            <span className="text-sm font-medium">{formatCurrency(reportData.b2bTotalAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Total Tax:</span>
                            <span className="text-sm font-medium">{formatCurrency(reportData.b2bTaxAmount)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* B2C Summary */}
                    {reportData.b2cInvoices.length > 0 && (
                      <div className="flex-1 border border-gray-200 rounded-lg p-3">
                        <h3 className="text-md font-medium text-gray-800 mb-2">B2C (Without GST)</h3>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Invoices:</span>
                            <span className="text-sm font-medium">{reportData.b2cInvoices.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Total Amount:</span>
                            <span className="text-sm font-medium">{formatCurrency(reportData.b2cTotalAmount)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Total Tax:</span>
                            <span className="text-sm font-medium">{formatCurrency(reportData.b2cTaxAmount)}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
            
            {/* B2B Data */}
            {reportData.b2bInvoices.length > 0 && (
              <div className="bg-white rounded-lg shadow mb-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">B2B Invoices (with GST)</h2>
                    <p className="text-sm text-gray-500">{reportData.b2bInvoices.length} invoices - Preview of data (Sheet 1 in Excel export)</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">GSTIN</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable Value</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Amount</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.b2bInvoices.slice(0, 10).map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{invoice.invoiceNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{formatDate(invoice.invoiceDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{invoice.customerName}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{invoice.customerGst}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(invoice.subtotal)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(invoice.taxAmount)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</td>
                        </tr>
                      ))}
                      
                      {reportData.b2bInvoices.length > 10 && (
                        <tr>
                          <td colSpan="7" className="px-3 py-2 text-sm text-gray-500 text-center">
                            {reportData.b2bInvoices.length - 10} more invoices not shown. Export to see all data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* B2C Data */}
            {reportData.b2cInvoices.length > 0 && (
              <div className="bg-white rounded-lg shadow mb-4">
                <div className="p-4 border-b flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">B2C Invoices (without GST)</h2>
                    <p className="text-sm text-gray-500">{reportData.b2cInvoices.length} invoices - Preview of data (Sheet 2 in Excel export)</p>
                  </div>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Party</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Taxable Value</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Tax Amount</th>
                        <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {reportData.b2cInvoices.slice(0, 10).map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{invoice.invoiceNumber}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">{formatDate(invoice.invoiceDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{invoice.customerName}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(invoice.subtotal)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right text-gray-900">{formatCurrency(invoice.taxAmount)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-sm text-right font-medium text-gray-900">{formatCurrency(invoice.totalAmount)}</td>
                        </tr>
                      ))}
                      
                      {reportData.b2cInvoices.length > 10 && (
                        <tr>
                          <td colSpan="6" className="px-3 py-2 text-sm text-gray-500 text-center">
                            {reportData.b2cInvoices.length - 10} more invoices not shown. Export to see all data.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* GSTR-3B Content */}
        {activeTab === 'gstr3b' && (
          <>
            {/* GSTR-3B Form Header */}
            <div className="bg-white rounded-lg shadow mb-4">
              <div className="p-4 border-b bg-blue-50">
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-lg font-medium text-gray-900">FORM GSTR-3B</h2>
                    <p className="text-sm text-gray-600">[See rule 61(5)]</p>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600">Year: {new Date(fromDate).getFullYear()}</div>
                    <div className="text-sm text-gray-600">Month: {new Date(fromDate).toLocaleDateString('en-US', { month: 'long' })}</div>
                  </div>
                </div>
              </div>
            </div>

            {gstr3bData.outwardSupplies.taxableSupplies.taxableValue > 0 && (
              <>
                {/* 3.1 Details of Outward Supplies */}
                <div className="bg-white rounded-lg shadow mb-4">
                  <div className="p-4 border-b">
                    <h3 className="text-lg font-medium text-gray-900">3.1 Details of Outward Supplies and inward supplies liable to reverse charge</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nature of Supplies</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Total Taxable Value</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Integrated Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Central Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">State/UT Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cess</th>
                        </tr>
                        <tr className="bg-blue-100">
                          <td className="px-4 py-2 text-xs text-center font-medium">1</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">2</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">3</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">4</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">5</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">6</td>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.taxableSupplies.taxableValue)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.taxableSupplies.integratedTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.taxableSupplies.centralTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.taxableSupplies.stateTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.taxableSupplies.cess)}</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">(b) Outward taxable supplies (zero rated)</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.zeroRatedSupplies.taxableValue)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.zeroRatedSupplies.integratedTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.zeroRatedSupplies.centralTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.zeroRatedSupplies.stateTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.zeroRatedSupplies.cess)}</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">(c) Other outward supplies (Nil rated, exempted)</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.exemptSupplies.taxableValue)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.exemptSupplies.integratedTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.exemptSupplies.centralTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.exemptSupplies.stateTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.outwardSupplies.exemptSupplies.cess)}</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">(d) Inward supplies (liable to reverse charge)</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">(e) Non-GST outward supplies</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4. Eligible ITC */}
                <div className="bg-white rounded-lg shadow mb-4">
                  <div className="p-4 border-b">
                    <h3 className="text-lg font-medium text-gray-900">4. Eligible ITC</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-green-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Details</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Integrated Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Central Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">State/UT Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cess</th>
                        </tr>
                        <tr className="bg-green-100">
                          <td className="px-4 py-2 text-xs text-center font-medium">1</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">2</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">3</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">4</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">5</td>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">(A) ITC Available (whether in full or part)</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.inputTaxCredit.inwardSupplies.integratedTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.inputTaxCredit.inwardSupplies.centralTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.inputTaxCredit.inwardSupplies.stateTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.inputTaxCredit.inwardSupplies.cess)}</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">(B) ITC Reversed</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">(C) Net ITC Available (A) - (B)</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(gstr3bData.inputTaxCredit.netItc.integratedTax)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(gstr3bData.inputTaxCredit.netItc.centralTax)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(gstr3bData.inputTaxCredit.netItc.stateTax)}</td>
                          <td className="px-4 py-2 text-sm text-right font-medium">{formatCurrency(gstr3bData.inputTaxCredit.netItc.cess)}</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">(D) Ineligible ITC</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.inputTaxCredit.reversalItc.integratedTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.inputTaxCredit.reversalItc.centralTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.inputTaxCredit.reversalItc.stateTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.inputTaxCredit.reversalItc.cess)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 6.1 Payment of Tax */}
                <div className="bg-white rounded-lg shadow mb-4">
                  <div className="p-4 border-b">
                    <h3 className="text-lg font-medium text-gray-900">6.1 Payment of tax</h3>
                  </div>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-yellow-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Tax payable</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Integrated Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Central Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">State/UT Tax</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Cess</th>
                        </tr>
                        <tr className="bg-yellow-100">
                          <td className="px-4 py-2 text-xs text-center font-medium">1</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">2</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">3</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">4</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">5</td>
                          <td className="px-4 py-2 text-xs text-center font-medium">6</td>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">Integrated Tax</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.taxPayable.integratedTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.taxPayable.integratedTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">Central Tax</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.taxPayable.centralTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.taxPayable.centralTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 text-sm text-gray-900">State/UT Tax</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.taxPayable.stateTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.taxPayable.stateTax)}</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                        </tr>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">Cess</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.taxPayable.cess)}</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">₹0.00</td>
                          <td className="px-4 py-2 text-sm text-right">{formatCurrency(gstr3bData.taxPayable.cess)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Interest and Late Fees */}
                <div className="bg-white rounded-lg shadow mb-4">
                  <div className="p-4 border-b">
                    <h3 className="text-lg font-medium text-gray-900">Interest and Late Fees</h3>
                  </div>
                  
                  <div className="p-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-red-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-red-800 mb-2">Interest on delayed payment</h4>
                        <p className="text-lg font-bold text-red-900">{formatCurrency(gstr3bData.interestAndFees.interestOnDelay)}</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-orange-800 mb-2">Late fees</h4>
                        <p className="text-lg font-bold text-orange-900">{formatCurrency(gstr3bData.interestAndFees.lateFees)}</p>
                      </div>
                      <div className="bg-purple-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-purple-800 mb-2">Penalty</h4>
                        <p className="text-lg font-bold text-purple-900">{formatCurrency(gstr3bData.interestAndFees.penaltyAmount)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
        
        {/* Empty State */}
        {!loading && activeTab === 'gstr1' && reportData.b2bInvoices.length === 0 && reportData.b2cInvoices.length === 0 && (
          <div className="bg-white p-6 text-center rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No GST data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Select a date range and generate reports to view GST return data.
            </p>
          </div>
        )}

        {/* Empty State for GSTR-3B */}
        {!loading && activeTab === 'gstr3b' && gstr3bData.outwardSupplies.taxableSupplies.taxableValue === 0 && (
          <div className="bg-white p-6 text-center rounded-lg shadow">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No GSTR-3B data</h3>
            <p className="mt-1 text-sm text-gray-500">
              Select a date range and generate reports to view GSTR-3B summary data.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default GSTReturns; 
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
      
      setSuccess('GST return data generated successfully');
      
    } catch (error) {
      console.error('Error generating GST reports:', error);
      setError('Failed to generate GST return data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Export data as Excel with multiple sheets
  const exportGSTData = () => {
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
    const fileName = `GST_Return_${fromDate}_to_${toDate}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    
    setSuccess(`Excel file "${fileName}" generated successfully with all GST data`);
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
          <p className="mt-1 text-sm text-gray-500">Generate GST returns data for B2B and B2C invoices</p>
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
        {(reportData.b2bInvoices.length > 0 || reportData.b2cInvoices.length > 0) && (
          <div className="mb-4 flex justify-end">
            <button
              onClick={exportGSTData}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Export Complete GST Return
            </button>
          </div>
        )}
        
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
        
        {/* Empty State */}
        {!loading && reportData.b2bInvoices.length === 0 && reportData.b2cInvoices.length === 0 && (
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
      </div>
    </div>
  );
};

export default GSTReturns; 
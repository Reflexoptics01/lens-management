import { useState } from 'react';
import { diagnoseInvoiceNumbering, quickFixInvoiceNumbering } from '../utils/invoiceNumberFixer';

const InvoiceNumberingTest = () => {
  const [diagnostics, setDiagnostics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleDiagnose = async () => {
    setLoading(true);
    try {
      const diag = await diagnoseInvoiceNumbering();
      setDiagnostics(diag);
      console.log('Diagnostics:', diag);
    } catch (error) {
      console.error('Error:', error);
      alert('Error during diagnosis. Check console.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickFix = async () => {
    if (!confirm('This will fix the invoice numbering. Continue?')) return;
    
    setLoading(true);
    try {
      const fixResult = await quickFixInvoiceNumbering();
      setResult(fixResult);
      console.log('Fix result:', fixResult);
      
      if (fixResult.success) {
        alert(`Fixed! Next invoice: ${fixResult.financialYear}/${fixResult.nextNumber.toString().padStart(2, '0')}`);
      } else {
        alert(`Error: ${fixResult.error}`);
      }
    } catch (error) {
      console.error('Error:', error);
      alert('Error during fix. Check console.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Invoice Numbering Test</h2>
      
      <div className="flex gap-4 mb-6">
        <button
          onClick={handleDiagnose}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Running...' : 'Diagnose System'}
        </button>
        
        <button
          onClick={handleQuickFix}
          disabled={loading}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? 'Fixing...' : 'Quick Fix'}
        </button>
      </div>

      {diagnostics && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded">
          <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Diagnostics</h3>
          <div className="text-sm space-y-2 text-gray-700 dark:text-gray-300">
            <p><strong>Settings:</strong> {diagnostics.settingsExists ? '✅ Found' : '❌ Missing'}</p>
            <p><strong>Counters:</strong> {diagnostics.countersCount} found</p>
            <p><strong>Sales:</strong> {diagnostics.salesCount} records</p>
            {diagnostics.latestSale && (
              <p><strong>Latest Invoice:</strong> {diagnostics.latestSale.invoiceNumber}</p>
            )}
            {diagnostics.settings && (
              <p><strong>Financial Year:</strong> {diagnostics.settings.financialYear}</p>
            )}
          </div>
        </div>
      )}

      {result && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded">
          <h3 className="text-lg font-semibold mb-2 text-green-900 dark:text-green-200">Fix Results</h3>
          <div className="text-sm space-y-2 text-green-800 dark:text-green-300">
            <p><strong>Status:</strong> {result.success ? '✅ Success' : '❌ Failed'}</p>
            {result.success && (
              <>
                <p><strong>Financial Year:</strong> {result.financialYear}</p>
                <p><strong>Highest Found:</strong> {result.highestNumber}</p>
                <p><strong>Next Number:</strong> {result.nextNumber}</p>
                <p><strong>Total Sales:</strong> {result.totalSales}</p>
              </>
            )}
            {result.error && <p><strong>Error:</strong> {result.error}</p>}
          </div>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded">
        <h3 className="text-lg font-semibold mb-2 text-blue-900 dark:text-blue-200">Instructions</h3>
        <ol className="text-sm space-y-1 text-blue-800 dark:text-blue-300 list-decimal list-inside">
          <li>Click "Diagnose System" to check current state</li>
          <li>Click "Quick Fix" to automatically fix invoice numbering</li>
          <li>Check browser console for detailed logs</li>
          <li>Test creating a new sale to verify numbering continues correctly</li>
        </ol>
      </div>
    </div>
  );
};

export default InvoiceNumberingTest; 
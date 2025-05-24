import { db } from '../firebaseConfig';
import { collection, getDocs, getDoc, doc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';

/**
 * Automatically detect and fix invoice numbering issues
 * This will run on app startup and when needed
 */
export const autoFixInvoiceNumbering = async () => {
  console.log('🔧 AUTO-FIX: Starting invoice numbering check...');
  
  try {
    // 1. Check if settings exist
    await ensureSettingsExist();
    
    // 2. Check and fix counters
    await ensureCountersExist();
    
    // 3. Detect and fix duplicates
    await detectAndReportDuplicates();
    
    console.log('✅ AUTO-FIX: Invoice numbering check completed');
    return { success: true, message: 'Invoice numbering is properly configured' };
    
  } catch (error) {
    console.error('❌ AUTO-FIX: Error during invoice numbering check:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Ensure settings exist
 */
const ensureSettingsExist = async () => {
  const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
  
  if (!settingsDoc.exists()) {
    console.log('⚠️ AUTO-FIX: Settings not found, creating default...');
    await setDoc(doc(db, 'settings', 'shopSettings'), {
      financialYear: '2024-25',
      createdAt: serverTimestamp(),
      note: 'Auto-created by invoice numbering fix'
    });
    console.log('✅ AUTO-FIX: Default settings created');
  } else {
    console.log('✅ AUTO-FIX: Settings exist');
  }
};

/**
 * Ensure counters exist for the current financial year
 */
const ensureCountersExist = async () => {
  const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
  const settings = settingsDoc.data();
  const financialYear = settings.financialYear || '2024-25';
  
  const counterRef = doc(db, 'counters', `invoices_${financialYear}`);
  const counterDoc = await getDoc(counterRef);
  
  if (!counterDoc.exists()) {
    console.log('⚠️ AUTO-FIX: Counter not found, analyzing existing invoices with date-based logic...');
    
    // Analyze existing sales to find the highest invoice number from recent invoices
    const salesRef = collection(db, 'sales');
    const salesSnapshot = await getDocs(salesRef);
    
    let highestNumber = 0;
    let totalInvoices = 0;
    let salesByDate = [];
    
    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      const invoiceNum = sale.invoiceNumber;
      totalInvoices++;
      
      // Collect sales with dates for analysis
      let saleDate = null;
      try {
        if (sale.createdAt && typeof sale.createdAt.toDate === 'function') {
          saleDate = sale.createdAt.toDate();
        } else if (sale.createdAt instanceof Date) {
          saleDate = sale.createdAt;
        } else if (sale.invoiceDate && typeof sale.invoiceDate.toDate === 'function') {
          saleDate = sale.invoiceDate.toDate();
        } else if (sale.invoiceDate instanceof Date) {
          saleDate = sale.invoiceDate;
        }
      } catch (error) {
        console.warn('Could not parse date for sale:', doc.id, error);
      }
      
      if (invoiceNum && saleDate) {
        // Try to extract number from different formats
        const matches = invoiceNum.match(/(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1]);
          salesByDate.push({
            invoiceNumber: invoiceNum,
            numericPart: num,
            date: saleDate,
            saleId: doc.id
          });
        }
      }
    });
    
    // Sort by date (newest first)
    salesByDate.sort((a, b) => b.date - a.date);
    
    console.log(`📊 AUTO-FIX: Analyzed ${totalInvoices} total sales, ${salesByDate.length} with valid dates and numbers`);
    
    if (salesByDate.length > 0) {
      // Strategy 1: Look at the last 30 days of invoices
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentSales = salesByDate.filter(sale => sale.date >= thirtyDaysAgo);
      
      if (recentSales.length > 0) {
        // Find highest number from recent sales
        highestNumber = Math.max(...recentSales.map(sale => sale.numericPart));
        console.log(`📅 AUTO-FIX: Found ${recentSales.length} sales in last 30 days, highest number: ${highestNumber}`);
        console.log(`📝 AUTO-FIX: Recent sales range: ${recentSales[recentSales.length - 1].invoiceNumber} to ${recentSales[0].invoiceNumber}`);
      } else {
        // Strategy 2: Look at the last 10 invoices by date
        const lastTenSales = salesByDate.slice(0, 10);
        highestNumber = Math.max(...lastTenSales.map(sale => sale.numericPart));
        console.log(`📊 AUTO-FIX: No recent sales, using last 10 invoices, highest number: ${highestNumber}`);
        console.log(`📝 AUTO-FIX: Last 10 sales date range: ${lastTenSales[lastTenSales.length - 1].date.toLocaleDateString()} to ${lastTenSales[0].date.toLocaleDateString()}`);
      }
      
      // Strategy 3: Safety check against global highest
      const globalHighest = Math.max(...salesByDate.map(sale => sale.numericPart));
      if (globalHighest > highestNumber + 10) {
        console.warn(`⚠️ AUTO-FIX: Global highest (${globalHighest}) is much higher than recent highest (${highestNumber})`);
        console.warn(`⚠️ AUTO-FIX: This might indicate old invoices with high numbers. Using recent highest to avoid gaps.`);
        // Still use the recent highest to maintain continuity
      }
      
      // Additional safety: ensure we don't go backwards
      const veryRecentSales = salesByDate.slice(0, 3);
      const veryRecentHighest = veryRecentSales.length > 0 ? Math.max(...veryRecentSales.map(sale => sale.numericPart)) : 0;
      
      if (veryRecentHighest > highestNumber) {
        console.log(`🔄 AUTO-FIX: Adjusting from ${highestNumber} to ${veryRecentHighest} based on very recent sales`);
        highestNumber = veryRecentHighest;
      }
      
    } else {
      // Fallback: no valid date-number combinations found
      console.warn('⚠️ AUTO-FIX: No sales with valid dates and invoice numbers found, starting from 0');
      highestNumber = 0;
    }
    
    console.log(`🎯 AUTO-FIX: Final decision - starting counter from: ${highestNumber}`);
    
    // Create counter
    await setDoc(counterRef, {
      count: highestNumber,
      prefix: financialYear,
      separator: '/',
      format: '${prefix}${separator}${number}',
      createdAt: serverTimestamp(),
      note: `Auto-created with date-based analysis from ${totalInvoices} existing invoices. Starting from: ${highestNumber}`,
      analysisDetails: {
        totalInvoices,
        salesWithValidData: salesByDate.length,
        recentSalesAnalyzed: Math.min(30, salesByDate.length),
        startingNumber: highestNumber
      }
    });
    
    console.log(`✅ AUTO-FIX: Counter created starting from ${highestNumber} using date-based analysis`);
  } else {
    console.log(`✅ AUTO-FIX: Counter exists with count: ${counterDoc.data().count}`);
  }
};

/**
 * Detect and report duplicate invoice numbers
 */
const detectAndReportDuplicates = async () => {
  const salesRef = collection(db, 'sales');
  const salesSnapshot = await getDocs(salesRef);
  
  const invoiceNumbers = {};
  const duplicates = [];
  
  salesSnapshot.docs.forEach(doc => {
    const sale = doc.data();
    const invoiceNum = sale.invoiceNumber;
    
    if (invoiceNum) {
      if (invoiceNumbers[invoiceNum]) {
        // Duplicate found
        duplicates.push({
          invoiceNumber: invoiceNum,
          saleIds: [invoiceNumbers[invoiceNum], doc.id],
          count: invoiceNumbers[invoiceNum].count ? invoiceNumbers[invoiceNum].count + 1 : 2
        });
        invoiceNumbers[invoiceNum] = { ...invoiceNumbers[invoiceNum], count: (invoiceNumbers[invoiceNum].count || 2) + 1 };
      } else {
        invoiceNumbers[invoiceNum] = { saleId: doc.id, count: 1 };
      }
    }
  });
  
  if (duplicates.length > 0) {
    console.warn(`⚠️ AUTO-FIX: Found ${duplicates.length} duplicate invoice numbers:`, duplicates);
    
    // Store duplicate information for manual review
    await setDoc(doc(db, 'system_diagnostics', 'duplicate_invoices'), {
      duplicates: duplicates,
      detectedAt: serverTimestamp(),
      totalSales: salesSnapshot.docs.length,
      note: 'Auto-detected duplicate invoice numbers requiring manual review'
    });
    
    return duplicates;
  } else {
    console.log('✅ AUTO-FIX: No duplicate invoice numbers found');
    return [];
  }
};

/**
 * Get system health status for invoice numbering
 */
export const getInvoiceNumberingHealth = async () => {
  try {
    const issues = [];
    
    // Check settings
    const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
    if (!settingsDoc.exists()) {
      issues.push('Settings document missing');
    }
    
    // Check counter
    const settings = settingsDoc.exists() ? settingsDoc.data() : {};
    const financialYear = settings.financialYear || '2024-25';
    const counterDoc = await getDoc(doc(db, 'counters', `invoices_${financialYear}`));
    if (!counterDoc.exists()) {
      issues.push('Invoice counter missing');
    }
    
    // Check for duplicates
    const duplicates = await detectAndReportDuplicates();
    if (duplicates.length > 0) {
      issues.push(`${duplicates.length} duplicate invoice numbers found`);
    }
    
    return {
      healthy: issues.length === 0,
      issues: issues,
      recommendations: issues.length > 0 ? ['Run autoFixInvoiceNumbering()'] : [],
      lastChecked: new Date().toISOString()
    };
    
  } catch (error) {
    return {
      healthy: false,
      issues: [`Error checking health: ${error.message}`],
      recommendations: ['Check database connection and permissions'],
      lastChecked: new Date().toISOString()
    };
  }
}; 
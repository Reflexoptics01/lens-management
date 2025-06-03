import { db } from '../firebaseConfig';
import { collection, getDocs, getDoc, doc, setDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { getUserCollection, getUserSettings, getUserUid } from './multiTenancy';
import { formatDateTime, dateToISOString, safelyParseDate } from './dateUtils';

/**
 * Automatically detect and fix invoice numbering issues (USER-SPECIFIC)
 * This will run on app startup and when needed
 */
export const autoFixInvoiceNumbering = async () => {
  console.log('🔧 AUTO-FIX: Starting user-specific invoice numbering check...');
  
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated - cannot auto-fix invoice numbering');
    }
    
    console.log('👤 Auto-fixing for user:', userUid);
    
    // 1. Check if user settings exist
    await ensureUserSettingsExist();
    
    // 2. Check and fix user counters
    await ensureUserCountersExist();
    
    // 3. Detect and fix user duplicates
    await detectAndReportUserDuplicates();
    
    console.log('✅ AUTO-FIX: User invoice numbering check completed');
    return { success: true, userId: userUid, message: 'User invoice numbering is properly configured' };
    
  } catch (error) {
    console.error('❌ AUTO-FIX: Error during user invoice numbering check:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Ensure user settings exist
 */
const ensureUserSettingsExist = async () => {
  const userUid = getUserUid();
  const settingsDoc = await getDoc(getUserSettings());
  
  if (!settingsDoc.exists()) {
    console.log('⚠️ AUTO-FIX: User settings not found, creating default...');
    await setDoc(getUserSettings(), {
      financialYear: '2024-25',
      createdAt: serverTimestamp(),
      userId: userUid,
      note: 'Auto-created by invoice numbering fix'
    });
    console.log('✅ AUTO-FIX: Default user settings created');
  } else {
    console.log('✅ AUTO-FIX: User settings exist');
  }
};

/**
 * Ensure user counters exist for the current financial year
 */
const ensureUserCountersExist = async () => {
  const userUid = getUserUid();
  const settingsDoc = await getDoc(getUserSettings());
  const settings = settingsDoc.data();
  const financialYear = settings.financialYear || '2024-25';
  
  const counterRef = doc(db, `users/${userUid}/counters`, `invoices_${financialYear}`);
  const counterDoc = await getDoc(counterRef);
  
  if (!counterDoc.exists()) {
    console.log('⚠️ AUTO-FIX: User counter not found, analyzing existing invoices with date-based logic...');
    
    // Analyze existing user sales to find the highest invoice number from recent invoices
    const salesRef = getUserCollection('sales');
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
        saleDate = safelyParseDate(sale.createdAt) || safelyParseDate(sale.invoiceDate);
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
    
    console.log(`📊 AUTO-FIX: Analyzed ${totalInvoices} total user sales, ${salesByDate.length} with valid dates and numbers`);
    
    if (salesByDate.length > 0) {
      // Strategy 1: Look at the last 30 days of invoices
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentSales = salesByDate.filter(sale => sale.date >= thirtyDaysAgo);
      
      if (recentSales.length > 0) {
        // Find highest number from recent sales
        highestNumber = Math.max(...recentSales.map(sale => sale.numericPart));
        console.log(`📅 AUTO-FIX: Found ${recentSales.length} user sales in last 30 days, highest number: ${highestNumber}`);
        console.log(`📝 AUTO-FIX: Recent sales range: ${recentSales[recentSales.length - 1].invoiceNumber} to ${recentSales[0].invoiceNumber}`);
      } else {
        // Strategy 2: Look at the last 10 invoices by date
        const lastTenSales = salesByDate.slice(0, 10);
        highestNumber = Math.max(...lastTenSales.map(sale => sale.numericPart));
        console.log(`📊 AUTO-FIX: No recent user sales, using last 10 invoices, highest number: ${highestNumber}`);
        console.log(`📝 AUTO-FIX: Last 10 sales date range: ${formatDateTime(lastTenSales[lastTenSales.length - 1].date)} to ${formatDateTime(lastTenSales[0].date)}`);
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
      console.warn('⚠️ AUTO-FIX: No user sales with valid dates and invoice numbers found, starting from 0');
      highestNumber = 0;
    }
    
    console.log(`🎯 AUTO-FIX: Final decision - starting user counter from: ${highestNumber}`);
    
    // Create user counter
    await setDoc(counterRef, {
      count: highestNumber,
      prefix: financialYear,
      separator: '/',
      format: '${prefix}${separator}${number}',
      createdAt: serverTimestamp(),
      userId: userUid,
      note: `Auto-created with date-based analysis from ${totalInvoices} existing user invoices. Starting from: ${highestNumber}`,
      analysisDetails: {
        totalInvoices,
        salesWithValidData: salesByDate.length,
        recentSalesAnalyzed: Math.min(30, salesByDate.length),
        startingNumber: highestNumber
      }
    });
    
    console.log(`✅ AUTO-FIX: User counter created starting from ${highestNumber} using date-based analysis`);
  } else {
    console.log(`✅ AUTO-FIX: User counter exists with count: ${counterDoc.data().count}`);
  }
};

/**
 * Detect and report duplicate invoice numbers (USER-SPECIFIC)
 */
const detectAndReportUserDuplicates = async () => {
  const salesRef = getUserCollection('sales');
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
        invoiceNumbers[invoiceNum] = { 
          ...invoiceNumbers[invoiceNum], 
          count: (invoiceNumbers[invoiceNum].count || 1) + 1 
        };
      } else {
        invoiceNumbers[invoiceNum] = { 
          saleId: doc.id, 
          createdAt: formatDateTime(sale.createdAt),
          count: 1 
        };
      }
    }
  });
  
  if (duplicates.length > 0) {
    console.warn(`⚠️ AUTO-FIX: Found ${duplicates.length} duplicate invoice numbers in user data:`);
    duplicates.forEach(dup => {
      console.warn(`   ${dup.invoiceNumber}: ${dup.count} copies`);
    });
  } else {
    console.log('✅ AUTO-FIX: No duplicate invoice numbers found in user data');
  }
  
  return duplicates;
};

/**
 * Get invoice numbering health report (USER-SPECIFIC)
 */
export const getInvoiceNumberingHealth = async () => {
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }
    
    console.log('📊 Getting user invoice numbering health report...');
    
    // Check settings
    const settingsDoc = await getDoc(getUserSettings());
    const hasSettings = settingsDoc.exists();
    
    // Check counters
    const countersRef = getUserCollection('counters');
    const countersSnapshot = await getDocs(countersRef);
    const hasCounters = !countersSnapshot.empty;
    
    // Check for duplicates
    const duplicates = await detectAndReportUserDuplicates();
    
    // Get total sales count
    const salesRef = getUserCollection('sales');
    const salesSnapshot = await getDocs(salesRef);
    const totalSales = salesSnapshot.docs.length;
    
    const health = {
      userId: userUid,
      isHealthy: hasSettings && hasCounters && duplicates.length === 0,
      settings: {
        exists: hasSettings,
        data: hasSettings ? settingsDoc.data() : null
      },
      counters: {
        exists: hasCounters,
        count: countersSnapshot.docs.length,
        data: countersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      },
      duplicates: {
        count: duplicates.length,
        details: duplicates
      },
      sales: {
        total: totalSales
      },
      timestamp: dateToISOString(new Date())
    };
    
    console.log('📋 User invoice numbering health:', health.isHealthy ? '✅ HEALTHY' : '⚠️ NEEDS ATTENTION');
    return health;
    
  } catch (error) {
    console.error('❌ Error getting user invoice numbering health:', error);
    return {
      isHealthy: false,
      error: error.message,
      timestamp: dateToISOString(new Date())
    };
  }
}; 
import { db } from '../firebaseConfig';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { getUserCollection, getUserDoc, getUserSettings, getUserUid } from './multiTenancy';
import { getCurrentFinancialYear } from './dateUtils';

/**
 * Improved Invoice Numbering System
 * Separates financial year prefix from simple invoice numbers
 * Format: Display as "2024-2025/61" but store as { prefix: "2024-2025", number: 61 }
 */

/**
 * Get invoice numbering info without incrementing
 * Returns: { prefix: "2024-2025", number: 62, fullDisplay: "2024-2025/62" }
 */
export const previewNextInvoiceNumber = async () => {
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }

    // Get current financial year from user settings or calculate current one
    const settingsDoc = await getDoc(getUserSettings());
    let financialYear = getCurrentFinancialYear(); // Calculate current financial year
    
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      financialYear = settings.financialYear || getCurrentFinancialYear();
    }

    // Get counter document for this financial year (without incrementing)
    const counterRef = getUserDoc('counters', `invoices_${financialYear}`);
    const counterDoc = await getDoc(counterRef);

    let nextNumber = 1;
    if (counterDoc.exists()) {
      const counter = counterDoc.data();
      nextNumber = (counter.count || 0) + 1;
    }

    return {
      prefix: financialYear,
      number: nextNumber,
      fullDisplay: `${financialYear}/${nextNumber.toString().padStart(2, '0')}`,
      paddedNumber: nextNumber.toString().padStart(2, '0')
    };
  } catch (error) {
    console.error('Error previewing invoice number:', error);
    const currentYear = getCurrentFinancialYear();
    return {
      prefix: currentYear,
      number: 1,
      fullDisplay: `${currentYear}/01`,
      paddedNumber: '01'
    };
  }
};

/**
 * Generate and increment invoice number (only called when saving)
 * Returns: { prefix: "2024-2025", number: 61, fullDisplay: "2024-2025/61" }
 */
export const generateInvoiceNumber = async () => {
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }

    // Get current financial year from user settings or calculate current one
    const settingsDoc = await getDoc(getUserSettings());
    let financialYear = getCurrentFinancialYear(); // Calculate current financial year
    
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      financialYear = settings.financialYear || getCurrentFinancialYear();
    }

    // Get or create counter document for this financial year
    const counterRef = getUserDoc('counters', `invoices_${financialYear}`);
    const counterDoc = await getDoc(counterRef);

    let newNumber;
    if (!counterDoc.exists()) {
      // Create new counter starting from 1
      newNumber = 1;
      await setDoc(counterRef, {
        count: newNumber,
        prefix: financialYear,
        separator: '/',
        format: '${prefix}${separator}${paddedNumber}',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        userId: userUid
      });
    } else {
      // Increment existing counter
      const counter = counterDoc.data();
      newNumber = (counter.count || 0) + 1;
      
      await updateDoc(counterRef, {
        count: newNumber,
        updatedAt: serverTimestamp()
      });
    }

    return {
      prefix: financialYear,
      number: newNumber,
      fullDisplay: `${financialYear}/${newNumber.toString().padStart(2, '0')}`,
      paddedNumber: newNumber.toString().padStart(2, '0')
    };
  } catch (error) {
    console.error('Error generating invoice number:', error);
    throw error;
  }
};

/**
 * Parse existing invoice number from database
 * Handles various formats: "2024-2025/61", "INV-0061", "61"
 */
export const parseInvoiceNumber = (invoiceNumber) => {
  if (!invoiceNumber) {
    return { prefix: '', number: 0, fullDisplay: '', paddedNumber: '00' };
  }

  // Handle "2024-2025/61" format
  const financialYearMatch = invoiceNumber.match(/^(\d{4}-\d{4})\/(\d+)$/);
  if (financialYearMatch) {
    const prefix = financialYearMatch[1];
    const number = parseInt(financialYearMatch[2]);
    return {
      prefix,
      number,
      fullDisplay: invoiceNumber,
      paddedNumber: number.toString().padStart(2, '0')
    };
  }

  // Handle legacy formats like "INV-0061"
  const legacyMatch = invoiceNumber.match(/(\d+)$/);
  if (legacyMatch) {
    const number = parseInt(legacyMatch[1]);
    return {
      prefix: '',
      number,
      fullDisplay: invoiceNumber,
      paddedNumber: number.toString().padStart(2, '0')
    };
  }

  // Handle simple number format
  const simpleNumber = parseInt(invoiceNumber);
  if (!isNaN(simpleNumber)) {
    return {
      prefix: '',
      number: simpleNumber,
      fullDisplay: invoiceNumber,
      paddedNumber: simpleNumber.toString().padStart(2, '0')
    };
  }

  // Fallback
  return { prefix: '', number: 0, fullDisplay: invoiceNumber, paddedNumber: '00' };
};

/**
 * Initialize invoice numbering system for a user
 * Analyzes existing invoices and sets up proper counters
 */
export const initializeInvoiceNumbering = async (financialYear = getCurrentFinancialYear()) => {
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }

    // Initializing invoice numbering system

    // 1. Ensure user settings exist
    await setDoc(getUserSettings(), {
      financialYear: financialYear,
      updatedAt: serverTimestamp(),
      userId: userUid
    }, { merge: true });

    // 2. Analyze existing sales to find highest invoice number
    const salesRef = getUserCollection('sales');
    const salesQuery = query(salesRef, orderBy('createdAt', 'desc'));
    const salesSnapshot = await getDocs(salesQuery);

    let highestNumber = 0;
    const currentYearInvoices = [];
    const allInvoices = [];

    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      const invoiceNum = sale.invoiceNumber;
      
      if (invoiceNum) {
        const parsed = parseInvoiceNumber(invoiceNum);
        allInvoices.push(parsed);
        
        // Check if this invoice is from the current financial year
        if (parsed.prefix === financialYear) {
          currentYearInvoices.push(parsed);
        }
        
        // Track the highest number across all invoices for this year
        if (parsed.prefix === financialYear && parsed.number > highestNumber) {
          highestNumber = parsed.number;
        }
      }
    });

    // Analyzed existing sales data for counter initialization

    // 3. Set up counter for the current financial year
    const counterRef = getUserDoc('counters', `invoices_${financialYear}`);
    
    await setDoc(counterRef, {
      count: highestNumber,
      prefix: financialYear,
      separator: '/',
      format: '${prefix}${separator}${paddedNumber}',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      userId: userUid,
      note: `Initialized - Found ${currentYearInvoices.length} existing invoices, highest: ${highestNumber}`
    });

    // Counter initialized successfully

    return {
      success: true,
      financialYear,
      highestNumber,
      nextNumber: highestNumber + 1,
      currentYearInvoices: currentYearInvoices.length,
      totalSales: salesSnapshot.docs.length
    };

  } catch (error) {
    console.error('❌ Error initializing invoice numbering:', error);
    throw error;
  }
};

/**
 * Get current invoice numbering status
 */
export const getInvoiceNumberingStatus = async () => {
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }

    // Get settings
    const settingsDoc = await getDoc(getUserSettings());
    let financialYear = getCurrentFinancialYear();
    
    if (settingsDoc.exists()) {
      financialYear = settingsDoc.data().financialYear || getCurrentFinancialYear();
    }

    // Get counter
    const counterRef = getUserDoc('counters', `invoices_${financialYear}`);
    const counterDoc = await getDoc(counterRef);

    // Get preview of next number
    const preview = await previewNextInvoiceNumber();

    return {
      userId: userUid,
      financialYear,
      hasSettings: settingsDoc.exists(),
      hasCounter: counterDoc.exists(),
      currentCount: counterDoc.exists() ? (counterDoc.data().count || 0) : 0,
      nextInvoice: preview,
      isConfigured: settingsDoc.exists() && counterDoc.exists()
    };

  } catch (error) {
    console.error('Error getting invoice numbering status:', error);
    return {
      error: error.message,
      isConfigured: false
    };
  }
};

/**
 * Quick setup function that can be called from components
 */
export const ensureInvoiceNumberingSetup = async () => {
  try {
    const status = await getInvoiceNumberingStatus();
    
    if (!status.isConfigured) {
      // Invoice numbering not configured, setting up...
      await initializeInvoiceNumbering(status.financialYear);
      // Invoice numbering setup completed
    }
    
    return await getInvoiceNumberingStatus();
  } catch (error) {
    console.error('Error ensuring invoice numbering setup:', error);
    throw error;
  }
};

/**
 * Update user settings to use the correct current financial year
 * This function can be called to fix existing accounts with incorrect financial year
 */
export const updateToCurrentFinancialYear = async () => {
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }

    const currentFinancialYear = getCurrentFinancialYear();
    // Updating user to current financial year

    // Update settings to current financial year
    await setDoc(getUserSettings(), {
      financialYear: currentFinancialYear,
      updatedAt: serverTimestamp(),
      userId: userUid
    }, { merge: true });

    // Initialize the counter for the new financial year if it doesn't exist
    await initializeInvoiceNumbering(currentFinancialYear);

    // Successfully updated to current financial year
    
    return {
      success: true,
      oldFinancialYear: '2024-2025', // We can't easily detect the old one
      newFinancialYear: currentFinancialYear,
      message: `Updated to current financial year: ${currentFinancialYear}`
    };

  } catch (error) {
    console.error('❌ Error updating financial year:', error);
    throw error;
  }
}; 
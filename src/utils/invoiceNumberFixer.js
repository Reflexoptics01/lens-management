import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { getUserCollection, getUserSettings, getUserUid } from './multiTenancy';
import { formatDateTime, dateToISOString } from './dateUtils';

// Utility to diagnose and fix invoice numbering after data restore (USER-SPECIFIC)
export const diagnoseInvoiceNumbering = async () => {
  console.log('🔍 Diagnosing user-specific invoice numbering system...');
  
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated - cannot diagnose invoice numbering');
    }
    
    console.log('👤 Diagnosing for user:', userUid);
    
    // 1. Check if user settings exist
    console.log('1. Checking user settings...');
    const settingsDoc = await getDoc(getUserSettings());
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      console.log('✅ User settings found:', settings);
      console.log('📅 Financial Year:', settings.financialYear);
    } else {
      console.log('❌ User settings not found');
    }
    
    // 2. Check user counters collection
    console.log('\n2. Checking user counters...');
    const countersRef = getUserCollection('counters');
    const countersSnapshot = await getDocs(countersRef);
    
    if (countersSnapshot.empty) {
      console.log('❌ No user counters found');
    } else {
      console.log('✅ User counters found:');
      countersSnapshot.docs.forEach(doc => {
        console.log(`   ${doc.id}:`, doc.data());
      });
    }
    
    // 3. Check existing user sales
    console.log('\n3. Checking existing user sales...');
    const salesRef = getUserCollection('sales');
    const salesQuery = query(salesRef, orderBy('createdAt', 'desc'));
    const salesSnapshot = await getDocs(salesQuery);
    
    console.log(`📊 Total user sales found: ${salesSnapshot.docs.length}`);
    
    if (salesSnapshot.docs.length > 0) {
      const latestSale = salesSnapshot.docs[0].data();
      console.log('📄 Latest sale invoice number:', latestSale.invoiceNumber);
      console.log('📅 Latest sale date:', formatDateTime(latestSale.createdAt));
      
      // Show first few sales
      console.log('\n📋 Recent sales:');
      salesSnapshot.docs.slice(0, 5).forEach((doc, index) => {
        const sale = doc.data();
        console.log(`   ${index + 1}. ${sale.invoiceNumber} - ${sale.customerName} - ${formatDateTime(sale.createdAt)}`);
      });
    }
    
    return {
      userId: userUid,
      settingsExists: settingsDoc.exists(),
      settings: settingsDoc.exists() ? settingsDoc.data() : null,
      countersCount: countersSnapshot.docs.length,
      counters: countersSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })),
      salesCount: salesSnapshot.docs.length,
      latestSale: salesSnapshot.docs.length > 0 ? salesSnapshot.docs[0].data() : null
    };
    
  } catch (error) {
    console.error('❌ Error diagnosing invoice numbering:', error);
    throw error;
  }
};

// Fix the invoice numbering system (USER-SPECIFIC)
export const fixInvoiceNumbering = async (financialYear = '2024-25') => {
  console.log('🔧 Fixing user-specific invoice numbering system...');
  
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated - cannot fix invoice numbering');
    }
    
    console.log('👤 Fixing for user:', userUid);
    
    // 1. Ensure user settings exist
    console.log('1. Setting up user shop settings...');
    await setDoc(getUserSettings(), {
      financialYear: financialYear,
      updatedAt: serverTimestamp(),
      userId: userUid
    }, { merge: true });
    console.log(`✅ User financial year set to: ${financialYear}`);
    
    // 2. Get all user sales to determine the highest invoice number
    console.log('2. Analyzing existing user sales...');
    const salesRef = getUserCollection('sales');
    const salesSnapshot = await getDocs(salesRef);
    
    let highestNumber = 0;
    const invoiceNumbers = [];
    
    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      const invoiceNum = sale.invoiceNumber;
      invoiceNumbers.push(invoiceNum);
      
      // Try to extract number from different formats
      if (invoiceNum) {
        // For formats like "2024-25/01", "INV-0001", etc.
        const matches = invoiceNum.match(/(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1]);
          if (num > highestNumber) {
            highestNumber = num;
          }
        }
      }
    });
    
    console.log(`📊 Found ${salesSnapshot.docs.length} user sales`);
    console.log(`🔢 Highest invoice number found: ${highestNumber}`);
    console.log('📝 Sample invoice numbers:', invoiceNumbers.slice(0, 10));
    
    // 3. Set up the counter for the current financial year (USER-SPECIFIC)
    const counterRef = doc(db, `users/${userUid}/counters`, `invoices_${financialYear}`);
    const nextNumber = highestNumber + 1;
    
    await setDoc(counterRef, {
      count: highestNumber, // Current count (next invoice will be highestNumber + 1)
      prefix: financialYear,
      separator: '/',
      format: '${prefix}${separator}${number}',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      userId: userUid,
      note: `Fixed after data restore. Highest found: ${highestNumber}`
    });
    
    console.log(`✅ User counter set up: invoices_${financialYear}`);
    console.log(`🎯 Next invoice number will be: ${financialYear}/${nextNumber.toString().padStart(2, '0')}`);
    
    return {
      success: true,
      userId: userUid,
      financialYear,
      highestNumber,
      nextNumber,
      totalSales: salesSnapshot.docs.length
    };
    
  } catch (error) {
    console.error('❌ Error fixing invoice numbering:', error);
    throw error;
  }
};

// Quick fix function that can be called from browser console (USER-SPECIFIC)
export const quickFixInvoiceNumbering = async () => {
  try {
    console.log('🚀 Quick fixing user-specific invoice numbering...');
    
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }
    
    const diagnosis = await diagnoseInvoiceNumbering();
    console.log('\n📋 Diagnosis complete for user:', userUid);
    
    // Determine financial year
    let financialYear = '2024-25';
    if (diagnosis.settings?.financialYear) {
      financialYear = diagnosis.settings.financialYear;
    }
    
    const result = await fixInvoiceNumbering(financialYear);
    console.log('\n✅ User invoice numbering fixed!');
    console.log(`📄 Next invoice will be: ${result.financialYear}/${result.nextNumber.toString().padStart(2, '0')}`);
    
    return result;
  } catch (error) {
    console.error('❌ Quick fix failed:', error);
    return { success: false, error: error.message };
  }
}; 
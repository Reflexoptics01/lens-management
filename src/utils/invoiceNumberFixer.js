import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';

// Utility to diagnose and fix invoice numbering after data restore
export const diagnoseInvoiceNumbering = async () => {
  console.log('🔍 Diagnosing invoice numbering system...');
  
  try {
    // 1. Check if settings exist
    console.log('1. Checking settings...');
    const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      console.log('✅ Settings found:', settings);
      console.log('📅 Financial Year:', settings.financialYear);
    } else {
      console.log('❌ Settings not found');
    }
    
    // 2. Check counters collection
    console.log('\n2. Checking counters...');
    const countersRef = collection(db, 'counters');
    const countersSnapshot = await getDocs(countersRef);
    
    if (countersSnapshot.empty) {
      console.log('❌ No counters found');
    } else {
      console.log('✅ Counters found:');
      countersSnapshot.docs.forEach(doc => {
        console.log(`   ${doc.id}:`, doc.data());
      });
    }
    
    // 3. Check existing sales
    console.log('\n3. Checking existing sales...');
    const salesRef = collection(db, 'sales');
    const salesQuery = query(salesRef, orderBy('createdAt', 'desc'));
    const salesSnapshot = await getDocs(salesQuery);
    
    console.log(`📊 Total sales found: ${salesSnapshot.docs.length}`);
    
    if (salesSnapshot.docs.length > 0) {
      const latestSale = salesSnapshot.docs[0].data();
      console.log('📄 Latest sale invoice number:', latestSale.invoiceNumber);
      console.log('📅 Latest sale date:', latestSale.createdAt);
      
      // Show first few sales
      console.log('\n📋 Recent sales:');
      salesSnapshot.docs.slice(0, 5).forEach((doc, index) => {
        const sale = doc.data();
        console.log(`   ${index + 1}. ${sale.invoiceNumber} - ${sale.customerName} - ${sale.createdAt?.toDate?.() || sale.createdAt}`);
      });
    }
    
    return {
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

// Fix the invoice numbering system
export const fixInvoiceNumbering = async (financialYear = '2024-25') => {
  console.log('🔧 Fixing invoice numbering system...');
  
  try {
    // 1. Ensure settings exist
    console.log('1. Setting up shop settings...');
    await setDoc(doc(db, 'settings', 'shopSettings'), {
      financialYear: financialYear,
      updatedAt: serverTimestamp()
    }, { merge: true });
    console.log(`✅ Financial year set to: ${financialYear}`);
    
    // 2. Get all sales to determine the highest invoice number
    console.log('2. Analyzing existing sales...');
    const salesRef = collection(db, 'sales');
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
    
    console.log(`📊 Found ${salesSnapshot.docs.length} sales`);
    console.log(`🔢 Highest invoice number found: ${highestNumber}`);
    console.log('📝 Sample invoice numbers:', invoiceNumbers.slice(0, 10));
    
    // 3. Set up the counter for the current financial year
    const counterRef = doc(db, 'counters', `invoices_${financialYear}`);
    const nextNumber = highestNumber + 1;
    
    await setDoc(counterRef, {
      count: highestNumber, // Current count (next invoice will be highestNumber + 1)
      prefix: financialYear,
      separator: '/',
      format: '${prefix}${separator}${number}',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      note: `Fixed after data restore. Highest found: ${highestNumber}`
    });
    
    console.log(`✅ Counter set up: invoices_${financialYear}`);
    console.log(`🎯 Next invoice number will be: ${financialYear}/${nextNumber.toString().padStart(2, '0')}`);
    
    return {
      success: true,
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

// Quick fix function that can be called from browser console
export const quickFixInvoiceNumbering = async () => {
  try {
    console.log('🚀 Quick fixing invoice numbering...');
    
    const diagnosis = await diagnoseInvoiceNumbering();
    console.log('\n📋 Diagnosis complete');
    
    // Determine financial year
    let financialYear = '2024-25';
    if (diagnosis.settings?.financialYear) {
      financialYear = diagnosis.settings.financialYear;
    }
    
    const result = await fixInvoiceNumbering(financialYear);
    console.log('\n✅ Invoice numbering fixed!');
    console.log(`📄 Next invoice will be: ${result.financialYear}/${result.nextNumber.toString().padStart(2, '0')}`);
    
    return result;
  } catch (error) {
    console.error('❌ Quick fix failed:', error);
    return { success: false, error: error.message };
  }
}; 
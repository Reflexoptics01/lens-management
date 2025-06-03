// Direct debugging functions for browser console
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';
import { getUserCollection, getUserSettings, getUserUid } from './multiTenancy';
import { formatDateTime, dateToISOString } from './dateUtils';

// Function to run directly in browser console
window.debugInvoiceNumbering = async () => {
  console.log('🔍 Direct Invoice Numbering Debug...');
  
  try {
    const userUid = getUserUid();
    if (!userUid) {
      console.error('❌ No user authenticated - cannot debug invoice numbering');
      return { error: 'User not authenticated' };
    }
    
    console.log('👤 Debugging for user:', userUid);
    
    // 1. Check all sales and their invoice numbers (USER-SPECIFIC)
    console.log('\n1. Checking user sales...');
    const salesRef = getUserCollection('sales');
    const salesQuery = query(salesRef, orderBy('createdAt', 'desc'));
    const salesSnapshot = await getDocs(salesQuery);
    
    console.log(`📊 Total user sales found: ${salesSnapshot.docs.length}`);
    
    const invoiceNumbers = [];
    let highestNumber = 0;
    let duplicates = {};
    
    salesSnapshot.docs.forEach((doc, index) => {
      const sale = doc.data();
      const invoiceNum = sale.invoiceNumber;
      const createdAt = formatDateTime(sale.createdAt) || 'Unknown date';
      
      // Track duplicates
      if (invoiceNumbers.includes(invoiceNum)) {
        if (!duplicates[invoiceNum]) duplicates[invoiceNum] = [];
        duplicates[invoiceNum].push({ id: doc.id, createdAt });
      }
      invoiceNumbers.push(invoiceNum);
      
      // Extract highest number
      if (invoiceNum) {
        const matches = invoiceNum.match(/(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1]);
          if (num > highestNumber) {
            highestNumber = num;
          }
        }
      }
      
      // Show recent sales
      if (index < 10) {
        console.log(`   ${index + 1}. ${invoiceNum} - ${sale.customerName} - ${createdAt}`);
      }
    });
    
    console.log(`\n🔢 Highest invoice number found: ${highestNumber}`);
    
    // Show duplicates
    if (Object.keys(duplicates).length > 0) {
      console.log('\n⚠️ DUPLICATE INVOICES FOUND:');
      Object.entries(duplicates).forEach(([invoiceNum, docs]) => {
        console.log(`   ${invoiceNum}: ${docs.length + 1} duplicates`);
        docs.forEach(doc => {
          console.log(`     - ID: ${doc.id}, Date: ${doc.createdAt}`);
        });
      });
    }
    
    // 2. Check settings (USER-SPECIFIC)
    console.log('\n2. Checking user settings...');
    const settingsDoc = await getDoc(getUserSettings());
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      console.log('✅ User settings found:', settings);
    } else {
      console.log('❌ User settings not found');
    }
    
    // 3. Check counters (USER-SPECIFIC)
    console.log('\n3. Checking user counters...');
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

    return {
      userId: userUid,
      totalSales: salesSnapshot.docs.length,
      highestNumber,
      duplicates,
      hasDuplicates: Object.keys(duplicates).length > 0,
      settingsExists: settingsDoc.exists(),
      countersCount: countersSnapshot.docs.length
    };
    
  } catch (error) {
    console.error('❌ Error in debug:', error);
    throw error;
  }
};

// Function to forcefully fix the issue (USER-SPECIFIC)
window.forceFixInvoiceNumbering = async (financialYear = '2024-25') => {
  console.log('🔧 FORCE FIXING user invoice numbering...');
  
  try {
    const userUid = getUserUid();
    if (!userUid) {
      console.error('❌ No user authenticated - cannot fix invoice numbering');
      return { error: 'User not authenticated' };
    }
    
    console.log('👤 Force fixing for user:', userUid);
    
    // 1. Force set user settings
    console.log('1. Setting up user shop settings...');
    await setDoc(getUserSettings(), {
      financialYear: financialYear,
      updatedAt: serverTimestamp(),
      note: 'Force fixed via debug',
      userId: userUid
    }, { merge: true });
    console.log(`✅ User financial year set to: ${financialYear}`);
    
    // 2. Get all user sales and find highest
    console.log('2. Analyzing user sales...');
    const salesRef = getUserCollection('sales');
    const salesSnapshot = await getDocs(salesRef);
    
    let highestNumber = 0;
    const invoiceAnalysis = {};
    
    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      const invoiceNum = sale.invoiceNumber;
      
      if (invoiceNum) {
        // Track all invoice patterns
        if (!invoiceAnalysis[invoiceNum]) {
          invoiceAnalysis[invoiceNum] = [];
        }
        invoiceAnalysis[invoiceNum].push({
          id: doc.id,
          date: formatDateTime(sale.createdAt),
          customer: sale.customerName
        });
        
        // Extract number from end
        const matches = invoiceNum.match(/(\d+)$/);
        if (matches) {
          const num = parseInt(matches[1]);
          if (num > highestNumber) {
            highestNumber = num;
          }
        }
      }
    });
    
    console.log(`📊 Analyzed ${salesSnapshot.docs.length} user sales`);
    console.log(`🔢 Highest number found: ${highestNumber}`);
    
    // Show duplicates
    const duplicates = Object.entries(invoiceAnalysis).filter(([_, docs]) => docs.length > 1);
    if (duplicates.length > 0) {
      console.log('\n⚠️ Found duplicates:');
      duplicates.forEach(([invoiceNum, docs]) => {
        console.log(`   ${invoiceNum}: ${docs.length} copies`);
      });
    }
    
    // 3. Delete ALL existing user counters and create fresh one
    console.log('\n3. Clearing and recreating user counters...');
    const countersRef = getUserCollection('counters');
    const existingCounters = await getDocs(countersRef);
    
    // Delete existing user counters
    for (const counterDoc of existingCounters.docs) {
      await deleteDoc(doc(db, `users/${userUid}/counters`, counterDoc.id));
      console.log(`🗑️ Deleted user counter: ${counterDoc.id}`);
    }
    
    // Create new user counter
    const counterRef = doc(db, `users/${userUid}/counters`, `invoices_${financialYear}`);
    const nextNumber = highestNumber + 1;
    
    await setDoc(counterRef, {
      count: highestNumber,
      prefix: financialYear,
      separator: '/',
      format: '${prefix}${separator}${number}',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      userId: userUid,
      note: `Force fixed on ${dateToISOString(new Date())}. Highest found: ${highestNumber}`
    });
    
    console.log(`✅ Created fresh user counter: invoices_${financialYear}`);
    console.log(`🎯 Next invoice will be: ${financialYear}/${nextNumber.toString().padStart(2, '0')}`);
    
    return {
      success: true,
      userId: userUid,
      financialYear,
      highestNumber,
      nextNumber,
      totalSales: salesSnapshot.docs.length,
      duplicatesFound: duplicates.length
    };
    
  } catch (error) {
    console.error('❌ Error in force fix:', error);
    return { success: false, error: error.message };
  }
};

console.log('🚀 Debug functions loaded! Run these in console:');
console.log('   debugInvoiceNumbering() - to diagnose user-specific issues');
console.log('   forceFixInvoiceNumbering() - to force fix user-specific numbering'); 
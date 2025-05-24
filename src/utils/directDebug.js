// Direct debugging functions for browser console
import { db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where } from 'firebase/firestore';

// Function to run directly in browser console
window.debugInvoiceNumbering = async () => {
  console.log('🔍 Direct Invoice Numbering Debug...');
  
  try {
    // 1. Check all sales and their invoice numbers
    console.log('\n1. Checking all sales...');
    const salesRef = collection(db, 'sales');
    const salesQuery = query(salesRef, orderBy('createdAt', 'desc'));
    const salesSnapshot = await getDocs(salesQuery);
    
    console.log(`📊 Total sales found: ${salesSnapshot.docs.length}`);
    
    const invoiceNumbers = [];
    let highestNumber = 0;
    let duplicates = {};
    
    salesSnapshot.docs.forEach((doc, index) => {
      const sale = doc.data();
      const invoiceNum = sale.invoiceNumber;
      const createdAt = sale.createdAt?.toDate?.() || sale.createdAt || 'Unknown date';
      
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
    
    // 2. Check settings
    console.log('\n2. Checking settings...');
    const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
    if (settingsDoc.exists()) {
      const settings = settingsDoc.data();
      console.log('✅ Settings found:', settings);
    } else {
      console.log('❌ Settings not found');
    }
    
    // 3. Check counters
    console.log('\n3. Checking counters...');
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
    
    return {
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

// Function to forcefully fix the issue
window.forceFixInvoiceNumbering = async (financialYear = '2024-25') => {
  console.log('🔧 FORCE FIXING invoice numbering...');
  
  try {
    // 1. Force set settings
    console.log('1. Setting up shop settings...');
    await setDoc(doc(db, 'settings', 'shopSettings'), {
      financialYear: financialYear,
      updatedAt: serverTimestamp(),
      note: 'Force fixed via debug'
    }, { merge: true });
    console.log(`✅ Financial year set to: ${financialYear}`);
    
    // 2. Get all sales and find highest
    console.log('2. Analyzing ALL sales...');
    const salesRef = collection(db, 'sales');
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
          date: sale.createdAt?.toDate?.() || sale.createdAt,
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
    
    console.log(`📊 Analyzed ${salesSnapshot.docs.length} sales`);
    console.log(`🔢 Highest number found: ${highestNumber}`);
    
    // Show duplicates
    const duplicates = Object.entries(invoiceAnalysis).filter(([_, docs]) => docs.length > 1);
    if (duplicates.length > 0) {
      console.log('\n⚠️ Found duplicates:');
      duplicates.forEach(([invoiceNum, docs]) => {
        console.log(`   ${invoiceNum}: ${docs.length} copies`);
      });
    }
    
    // 3. Delete ALL existing counters and create fresh one
    console.log('\n3. Clearing and recreating counters...');
    const countersRef = collection(db, 'counters');
    const existingCounters = await getDocs(countersRef);
    
    // Delete existing counters
    for (const counterDoc of existingCounters.docs) {
      await deleteDoc(doc(db, 'counters', counterDoc.id));
      console.log(`🗑️ Deleted counter: ${counterDoc.id}`);
    }
    
    // Create new counter
    const counterRef = doc(db, 'counters', `invoices_${financialYear}`);
    const nextNumber = highestNumber + 1;
    
    await setDoc(counterRef, {
      count: highestNumber,
      prefix: financialYear,
      separator: '/',
      format: '${prefix}${separator}${number}',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      note: `Force fixed on ${new Date().toISOString()}. Highest found: ${highestNumber}`
    });
    
    console.log(`✅ Created fresh counter: invoices_${financialYear}`);
    console.log(`🎯 Next invoice will be: ${financialYear}/${nextNumber.toString().padStart(2, '0')}`);
    
    return {
      success: true,
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
console.log('   debugInvoiceNumbering() - to diagnose issues');
console.log('   forceFixInvoiceNumbering() - to force fix the numbering'); 
import { auth, db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc } from 'firebase/firestore';
import { getUserCollection } from './multiTenancy';

/**
 * Debug utility to check Firestore database structure and multi-tenancy
 */
const debugFirestore = async () => {
  try {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.log('No user logged in');
      return;
    }

    console.log('🔍 DEBUG: Firestore Data Analysis');
    console.log('===============================');
    console.log('Current User UID:', currentUser.uid);
    console.log('Current User Email:', currentUser.email);
    
    // Check user document
    const userDocRef = doc(db, 'users', currentUser.uid);
    const userDoc = await getDoc(userDocRef);
    
    if (userDoc.exists()) {
      console.log('✅ User Document exists:', userDoc.data());
    } else {
      console.log('❌ User Document does not exist');
    }

    console.log('\n📊 GLOBAL COLLECTIONS (Should be empty for non-admin users):');
    console.log('===========================================================');
    
    // Check global collections that should be empty for users
    const globalCollections = ['orders', 'sales', 'purchases', 'customers', 'lensInventory', 'transactions'];
    
    for (const collectionName of globalCollections) {
      try {
        const globalRef = collection(db, collectionName);
        const globalSnapshot = await getDocs(globalRef);
        console.log(`🌐 Global ${collectionName}:`, globalSnapshot.docs.length, 'documents');
        
        if (globalSnapshot.docs.length > 0) {
          console.log(`  ⚠️  WARNING: Global ${collectionName} contains data! This breaks multi-tenancy!`);
          // Show first few document IDs
          const firstFew = globalSnapshot.docs.slice(0, 3).map(doc => doc.id);
          console.log(`  📄 Sample document IDs:`, firstFew);
        }
      } catch (error) {
        console.log(`❌ Error checking global ${collectionName}:`, error.message);
      }
    }

    console.log('\n👤 USER-SPECIFIC COLLECTIONS:');
    console.log('===============================');
    
    // Check user-specific collections
    for (const collectionName of globalCollections) {
      try {
        const userRef = getUserCollection(collectionName);
        const userSnapshot = await getDocs(userRef);
        console.log(`👤 User ${collectionName}:`, userSnapshot.docs.length, 'documents');
        
        if (userSnapshot.docs.length > 0) {
          // Show first document structure (without sensitive data)
          const firstDoc = userSnapshot.docs[0];
          const data = firstDoc.data();
          const sampleKeys = Object.keys(data).slice(0, 5);
          console.log(`  📄 Sample fields:`, sampleKeys);
        }
      } catch (error) {
        console.log(`❌ Error checking user ${collectionName}:`, error.message);
      }
    }

    // Check users collection
    console.log('\n🏢 SYSTEM COLLECTIONS:');
    console.log('=======================');
    try {
      const usersRef = collection(db, 'users');
      const usersSnapshot = await getDocs(usersRef);
      console.log('👥 Total users in system:', usersSnapshot.docs.length);
    } catch (error) {
      console.log('❌ Error checking users collection:', error);
    }
    
    // Check for pending registrations
    try {
      const registrationsRef = collection(db, 'userRegistrations');
      const registrationsSnapshot = await getDocs(registrationsRef);
      console.log('📝 Pending registrations:', registrationsSnapshot.docs.length);
    } catch (error) {
      console.log('❌ Error checking registrations collection:', error);
    }

    console.log('\n🎯 CONCLUSION:');
    console.log('===============');
    console.log('✅ If global collections show 0 documents, multi-tenancy is working correctly');
    console.log('⚠️  If global collections show >0 documents, there is a multi-tenancy leak');
    console.log('📊 User should only see data in their user-specific collections');
    
  } catch (error) {
    console.error('Debug error:', error);
  }
};

// Make it available globally for easy debugging
window.debugFirestore = debugFirestore;

export { debugFirestore }; 
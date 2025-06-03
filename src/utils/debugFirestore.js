import { auth, db } from '../firebaseConfig';
import { collection, getDocs, doc, getDoc, updateDoc, query, where } from 'firebase/firestore';
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

// Debug function to check Firestore connection
export const testFirestoreConnection = async () => {
  try {
    console.log('🔥 Testing Firestore connection...');
    const testCollection = collection(db, 'test');
    const snapshot = await getDocs(testCollection);
    console.log('✅ Firestore connection successful');
    console.log('📊 Test collection size:', snapshot.size);
    return true;
  } catch (error) {
    console.error('❌ Firestore connection failed:', error);
    return false;
  }
};

// Debug function to fix user permissions
export const fixUserPermissions = async (userEmail) => {
  try {
    console.log('🔧 Fixing permissions for user:', userEmail);
    
    const defaultPermissions = {
      '/dashboard': true,
      '/orders': true,
      '/customers': true,
      '/sales': true,
      '/purchases': true,
      '/transactions': true,
      '/ledger': true,
      '/gst-returns': true,
      '/lens-inventory': true,
      '/settings': true
    };
    
    // Find user by email
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('email', '==', userEmail));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      console.error('❌ User not found:', userEmail);
      return false;
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    
    console.log('📋 Current user data:', {
      email: userData.email,
      role: userData.role,
      permissions: userData.permissions,
      isActive: userData.isActive,
      status: userData.status
    });
    
    // Update permissions
    await updateDoc(userDoc.ref, {
      permissions: defaultPermissions,
      isActive: true,
      status: 'approved'
    });
    
    console.log('✅ User permissions updated successfully');
    console.log('🔑 New permissions:', defaultPermissions);
    
    return true;
  } catch (error) {
    console.error('❌ Error fixing user permissions:', error);
    return false;
  }
};

// Debug function to list all users and their permissions
export const listAllUsers = async () => {
  try {
    console.log('📋 Listing all users...');
    
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    console.log('👥 Total users found:', snapshot.size);
    
    snapshot.docs.forEach((doc, index) => {
      const userData = doc.data();
      console.log(`\n👤 User ${index + 1}:`, {
        id: doc.id,
        email: userData.email,
        role: userData.role,
        permissions: userData.permissions,
        isActive: userData.isActive,
        status: userData.status
      });
    });
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('❌ Error listing users:', error);
    return [];
  }
};

// Debug function to check current user's auth status
export const debugCurrentUserAuth = async () => {
  try {
    console.log('🔍 DEBUG: Current User Authentication Status');
    console.log('============================================');
    
    // Check Firebase auth
    const currentUser = auth.currentUser;
    console.log('🔥 Firebase Auth User:', currentUser ? {
      uid: currentUser.uid,
      email: currentUser.email,
      emailVerified: currentUser.emailVerified
    } : 'No user');
    
    // Check localStorage
    console.log('💾 LocalStorage Auth Data:', {
      userUid: localStorage.getItem('userUid'),
      userEmail: localStorage.getItem('userEmail'),
      userRole: localStorage.getItem('userRole'),
      userPermissions: localStorage.getItem('userPermissions')
    });
    
    if (!currentUser) {
      console.log('❌ No user is logged in to Firebase Auth');
      return;
    }
    
    // Check users collection
    console.log('\n👤 Checking users collection...');
    const usersRef = collection(db, 'users');
    const userQuery = query(usersRef, where('uid', '==', currentUser.uid));
    const userSnapshot = await getDocs(userQuery);
    
    if (userSnapshot.empty) {
      console.log('❌ User not found in users collection');
      
      // Check userRegistrations collection
      console.log('\n📝 Checking userRegistrations collection...');
      const registrationsRef = collection(db, 'userRegistrations');
      const regQuery = query(registrationsRef, where('uid', '==', currentUser.uid));
      const regSnapshot = await getDocs(regQuery);
      
      if (regSnapshot.empty) {
        console.log('❌ User not found in userRegistrations collection either');
        console.log('🚨 ISSUE: User has Firebase auth but no database records!');
      } else {
        const regData = regSnapshot.docs[0].data();
        console.log('📋 Registration data found:', {
          email: regData.email,
          status: regData.status,
          createdAt: regData.createdAt,
          approvedAt: regData.approvedAt,
          approvedBy: regData.approvedBy
        });
        console.log('🚨 ISSUE: User has registration but no user document!');
      }
    } else {
      const userData = userSnapshot.docs[0].data();
      console.log('✅ User found in users collection:', {
        email: userData.email,
        role: userData.role,
        permissions: userData.permissions,
        isActive: userData.isActive,
        status: userData.status,
        approvedAt: userData.approvedAt,
        approvedBy: userData.approvedBy
      });
      
      // Diagnose potential issues
      if (userData.isActive === false) {
        console.log('🚨 ISSUE: User is marked as inactive!');
      }
      if (userData.status === 'pending') {
        console.log('🚨 ISSUE: User status is still pending!');
      }
      if (!userData.permissions || Object.keys(userData.permissions).length === 0) {
        console.log('🚨 ISSUE: User has empty permissions!');
      }
    }
    
    console.log('\n🎯 NEXT STEPS:');
    console.log('===============');
    console.log('1. If user is not in users collection, they need to be approved by admin');
    console.log('2. If user is inactive or pending, admin needs to approve them');
    console.log('3. If user has empty permissions, run fixUserPermissions(email)');
    console.log('4. Refresh browser after fixing any issues');
    
  } catch (error) {
    console.error('❌ Error debugging user auth:', error);
  }
};

// Make it available globally for easy debugging
window.debugFirestore = debugFirestore;

// Make functions available globally for debugging
if (typeof window !== 'undefined') {
  window.testFirestoreConnection = testFirestoreConnection;
  window.fixUserPermissions = fixUserPermissions;
  window.listAllUsers = listAllUsers;
  window.debugCurrentUserAuth = debugCurrentUserAuth;
  
  console.log('🛠️  Debug utilities available:');
  console.log('   - testFirestoreConnection()');
  console.log('   - fixUserPermissions(userEmail)');
  console.log('   - listAllUsers()');
  console.log('   - debugCurrentUserAuth()');
}

console.log('🔥 Firestore debug utilities loaded');

export { debugFirestore }; 
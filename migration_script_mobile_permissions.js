// Migration Script: Add Mobile App Permissions to Existing Users
// Run this script once to add mobile app permission fields to all existing users

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, writeBatch, doc } from 'firebase/firestore';

// Your Firebase config - replace with your actual config
const firebaseConfig = {
  apiKey: "AIzaSyBGUo_dbUbCQGrSwkTcNfm0vE6RWOrIZlg",
  authDomain: "lens-management-2719d.firebaseapp.com",
  projectId: "lens-management-2719d",
  storageBucket: "lens-management-2719d.firebasestorage.app",
  messagingSenderId: "546187944638",
  appId: "1:546187944638:android:b1340c713f62effc3874ef"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Migration function
const addMobileAppPermissionsToExistingUsers = async () => {
  try {
    console.log('Starting migration: Adding mobile app permissions to existing users...');
    
    // Get all users from the users collection
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    if (snapshot.empty) {
      console.log('No users found in the database.');
      return;
    }
    
    console.log(`Found ${snapshot.docs.length} users to update.`);
    
    // Firestore batch can handle up to 500 operations
    const batchSize = 500;
    let batch = writeBatch(db);
    let operationCount = 0;
    let totalUpdated = 0;
    
    for (const docSnapshot of snapshot.docs) {
      const userData = docSnapshot.data();
      const userRef = doc(db, 'users', docSnapshot.id);
      
      // Check if mobile app fields already exist
      if (userData.hasOwnProperty('mobileAppAccess')) {
        console.log(`User ${userData.email || docSnapshot.id} already has mobile app permissions. Skipping.`);
        continue;
      }
      
      // Add mobile app permission fields
      batch.update(userRef, {
        mobileAppAccess: false, // Default to no mobile access
        mobileAppApprovedAt: null,
        mobileAppApprovedBy: null,
        mobileAppRevokedAt: null,
        mobileAppRevokedBy: null
      });
      
      operationCount++;
      totalUpdated++;
      
      console.log(`Queued update for user: ${userData.email || docSnapshot.id}`);
      
      // Commit batch when it reaches the limit
      if (operationCount >= batchSize) {
        console.log(`Committing batch of ${operationCount} operations...`);
        await batch.commit();
        batch = writeBatch(db);
        operationCount = 0;
      }
    }
    
    // Commit any remaining operations
    if (operationCount > 0) {
      console.log(`Committing final batch of ${operationCount} operations...`);
      await batch.commit();
    }
    
    console.log(`\n✅ Migration completed successfully!`);
    console.log(`📊 Total users updated: ${totalUpdated}`);
    console.log(`📱 All users now have mobile app permission fields (default: no access)`);
    console.log(`👨‍💼 Admins can now grant mobile app access through the Admin Panel`);
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
};

// Function to check migration status
const checkMigrationStatus = async () => {
  try {
    console.log('Checking migration status...');
    
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    let totalUsers = 0;
    let usersWithMobilePermissions = 0;
    let usersWithMobileAccess = 0;
    
    snapshot.docs.forEach(doc => {
      totalUsers++;
      const userData = doc.data();
      
      if (userData.hasOwnProperty('mobileAppAccess')) {
        usersWithMobilePermissions++;
        if (userData.mobileAppAccess === true) {
          usersWithMobileAccess++;
        }
      }
    });
    
    console.log('\n📊 Migration Status Report:');
    console.log(`Total users: ${totalUsers}`);
    console.log(`Users with mobile permission fields: ${usersWithMobilePermissions}`);
    console.log(`Users with mobile app access granted: ${usersWithMobileAccess}`);
    console.log(`Migration complete: ${usersWithMobilePermissions === totalUsers ? '✅' : '❌'}`);
    
    return {
      totalUsers,
      usersWithMobilePermissions,
      usersWithMobileAccess,
      migrationComplete: usersWithMobilePermissions === totalUsers
    };
    
  } catch (error) {
    console.error('Error checking migration status:', error);
    throw error;
  }
};

// Function to grant mobile access to specific users (useful for testing)
const grantMobileAccessToUsers = async (emailList) => {
  try {
    console.log('Granting mobile access to specific users...');
    
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    const batch = writeBatch(db);
    let updatedCount = 0;
    
    snapshot.docs.forEach(doc => {
      const userData = doc.data();
      
      if (emailList.includes(userData.email)) {
        const userRef = doc.ref;
        batch.update(userRef, {
          mobileAppAccess: true,
          mobileAppApprovedAt: new Date(),
          mobileAppApprovedBy: 'Migration Script'
        });
        
        updatedCount++;
        console.log(`Granted mobile access to: ${userData.email}`);
      }
    });
    
    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Mobile access granted to ${updatedCount} users`);
    } else {
      console.log('No users found matching the provided email list');
    }
    
  } catch (error) {
    console.error('Error granting mobile access:', error);
    throw error;
  }
};

// Main execution function
const runMigration = async () => {
  try {
    // First, check current status
    const status = await checkMigrationStatus();
    
    if (status.migrationComplete) {
      console.log('Migration already complete. No action needed.');
      return;
    }
    
    // Run the migration
    await addMobileAppPermissionsToExistingUsers();
    
    // Check status again
    await checkMigrationStatus();
    
  } catch (error) {
    console.error('Migration process failed:', error);
  }
};

// Export functions for use
export {
  addMobileAppPermissionsToExistingUsers,
  checkMigrationStatus,
  grantMobileAccessToUsers,
  runMigration
};

// If running this script directly, execute the migration
if (typeof module !== 'undefined' && module.exports) {
  // Node.js environment
  runMigration();
} else {
  // Browser environment - you can call runMigration() from console
  console.log('Migration functions loaded. Call runMigration() to start.');
} 
// 📱 MOBILE APP PERMISSIONS MIGRATION SCRIPT
// Copy and paste this entire script into your browser console while on the Admin Panel

(async function() {
  console.log('🚀 Starting Mobile App Permissions Migration...');
  console.log('📋 This will add mobile app permission fields to all existing users');
  
  try {
    // Wait a moment for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get Firebase from the window object (should be available on admin panel)
    const { db } = window;
    
    if (!db) {
      console.error('❌ Firebase db not found. Make sure you are on the Admin Panel page.');
      return;
    }
    
    console.log('✅ Firebase connection found');
    
    // Import Firestore functions dynamically
    const { collection, getDocs, writeBatch, doc } = await import('firebase/firestore');
    
    // Get all users from the users collection
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    
    if (snapshot.empty) {
      console.log('📭 No users found in the database.');
      return;
    }
    
    console.log(`👥 Found ${snapshot.docs.length} users to check/update`);
    
    // Create batch for updates
    const batch = writeBatch(db);
    let updatedCount = 0;
    let skippedCount = 0;
    
    snapshot.docs.forEach((docSnapshot) => {
      const userData = docSnapshot.data();
      const userRef = doc(db, 'users', docSnapshot.id);
      
      // Check if mobile app fields already exist
      if (userData.hasOwnProperty('mobileAppAccess')) {
        console.log(`✅ User ${userData.email || docSnapshot.id} already has mobile app permissions. Skipping.`);
        skippedCount++;
        return;
      }
      
      // Add mobile app permission fields
      batch.update(userRef, {
        mobileAppAccess: false, // Default to no mobile access
        mobileAppApprovedAt: null,
        mobileAppApprovedBy: null,
        mobileAppRevokedAt: null,
        mobileAppRevokedBy: null
      });
      
      updatedCount++;
      console.log(`🔄 Queued update for: ${userData.email || docSnapshot.id}`);
    });
    
    // Commit updates if any
    if (updatedCount > 0) {
      console.log(`💾 Committing ${updatedCount} updates...`);
      await batch.commit();
      
      console.log('');
      console.log('🎉 MIGRATION COMPLETED SUCCESSFULLY!');
      console.log(`📊 Summary:`);
      console.log(`   - Total users found: ${snapshot.docs.length}`);
      console.log(`   - Users updated: ${updatedCount}`);
      console.log(`   - Users already had permissions: ${skippedCount}`);
      console.log('');
      console.log('📱 All users now have mobile app permission fields');
      console.log('🔒 Default setting: Mobile access = DENIED');
      console.log('👨‍💼 You can now approve mobile access through the Admin Panel');
      console.log('');
      console.log('🔄 Refreshing page in 3 seconds to show updates...');
      
      // Refresh the page to see the new Mobile App column
      setTimeout(() => {
        window.location.reload();
      }, 3000);
      
    } else {
      console.log('');
      console.log('ℹ️ MIGRATION ALREADY COMPLETE');
      console.log('✅ All users already have mobile app permission fields');
      console.log('👀 You should see the "Mobile App" column in the user table');
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
    console.log('');
    console.log('🛠️ Troubleshooting tips:');
    console.log('1. Make sure you are on the Admin Panel page');
    console.log('2. Check your internet connection');
    console.log('3. Verify you are logged in as super admin');
    console.log('4. Try refreshing the page and running again');
  }
})();

// Also create a test function for later use
window.testMobilePermissions = () => {
  console.log('🧪 Testing Mobile App Permissions UI...');
  
  // Check if Mobile App column exists
  const mobileAppHeader = Array.from(document.querySelectorAll('th')).find(th => 
    th.textContent.includes('Mobile App')
  );
  
  if (mobileAppHeader) {
    console.log('✅ Mobile App column found in table');
  } else {
    console.log('❌ Mobile App column NOT found - check if migration completed');
  }
  
  // Check for approve/revoke buttons
  const buttons = document.querySelectorAll('button');
  const approveButtons = Array.from(buttons).filter(btn => btn.textContent.includes('Approve'));
  const revokeButtons = Array.from(buttons).filter(btn => btn.textContent.includes('Revoke'));
  
  console.log(`✅ Found ${approveButtons.length} Approve buttons`);
  console.log(`✅ Found ${revokeButtons.length} Revoke buttons`);
  
  console.log('🎯 Mobile App Permissions Test Complete');
};

console.log('📋 MIGRATION SCRIPT LOADED');
console.log('🚀 Migration will start automatically in a moment...');
console.log('');
console.log('💡 After migration, you can test the UI with: testMobilePermissions()'); 
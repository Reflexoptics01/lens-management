const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Create a new user (admin only)
exports.createUser = functions.https.onCall(async (data, context) => {
  console.log('createUser function called with data:', JSON.stringify(data));
  console.log('Auth context:', context.auth ? 'Authenticated' : 'Not authenticated');
  
  // Check if request is made by an authenticated admin
  if (!context.auth) {
    console.error('Authentication required');
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  // Check if user is an admin by querying Firestore
  try {
    console.log(`Checking if ${context.auth.token.email} is an admin`);
    const userRef = admin.firestore().collection('users');
    const querySnapshot = await userRef.where('email', '==', context.auth.token.email).get();
    
    if (querySnapshot.empty) {
      console.error('User not found in database');
      throw new functions.https.HttpsError(
        'permission-denied',
        'User not found in database.'
      );
    }
    
    const userData = querySnapshot.docs[0].data();
    console.log('User role:', userData.role);
    
    if (userData.role !== 'admin') {
      console.error('User is not an admin');
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can create new users.'
      );
    }
  } catch (error) {
    console.error('Error verifying admin status:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Internal error while verifying admin status: ${error.message}`
    );
  }

  // Validate required fields
  if (!data.email || !data.password) {
    console.error('Missing required fields');
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Email and password are required.'
    );
  }

  if (data.password.length < 6) {
    console.error('Password too short');
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Password must be at least 6 characters long.'
    );
  }

  // Create new user
  try {
    console.log(`Creating new user with email: ${data.email}`);
    const userRecord = await admin.auth().createUser({
      email: data.email,
      password: data.password,
      emailVerified: false,
      disabled: false
    });
    
    console.log('User created successfully:', userRecord.uid);
    return { uid: userRecord.uid };
  } catch (error) {
    console.error('Error creating new user:', error);
    // Map Firebase Auth error codes to more user-friendly messages
    let errorCode = 'internal';
    let errorMessage = `Error creating user: ${error.message}`;
    
    if (error.code === 'auth/email-already-exists') {
      errorCode = 'already-exists';
      errorMessage = 'The email address is already in use by another account.';
    } else if (error.code === 'auth/invalid-email') {
      errorCode = 'invalid-argument';
      errorMessage = 'The email address is improperly formatted.';
    } else if (error.code === 'auth/invalid-password') {
      errorCode = 'invalid-argument';
      errorMessage = 'The password must be at least 6 characters long.';
    }
    
    throw new functions.https.HttpsError(errorCode, errorMessage);
  }
});

// Delete a user (admin only)
exports.deleteUser = functions.https.onCall(async (data, context) => {
  // Check if request is made by an authenticated admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  // Check if user is an admin by querying Firestore
  try {
    const userRef = admin.firestore().collection('users');
    const querySnapshot = await userRef.where('email', '==', context.auth.token.email).get();
    
    if (querySnapshot.empty) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User not found in database.'
      );
    }
    
    const userData = querySnapshot.docs[0].data();
    if (userData.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can delete users.'
      );
    }
  } catch (error) {
    console.error('Error verifying admin status:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Internal error while verifying admin status.'
    );
  }

  // Validate required fields
  if (!data.userId) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'User ID is required.'
    );
  }

  // Delete user
  try {
    await admin.auth().deleteUser(data.userId);
    return { success: true };
  } catch (error) {
    console.error('Error deleting user:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error deleting user: ${error.message}`
    );
  }
});

// Get all users (admin only)
exports.listUsers = functions.https.onCall(async (data, context) => {
  // Check if request is made by an authenticated admin
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  // Check if user is an admin by querying Firestore
  try {
    const userRef = admin.firestore().collection('users');
    const querySnapshot = await userRef.where('email', '==', context.auth.token.email).get();
    
    if (querySnapshot.empty) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'User not found in database.'
      );
    }
    
    const userData = querySnapshot.docs[0].data();
    if (userData.role !== 'admin') {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only admins can list all users.'
      );
    }
  } catch (error) {
    console.error('Error verifying admin status:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Internal error while verifying admin status.'
    );
  }

  // List users
  try {
    const listUsersResult = await admin.auth().listUsers();
    const users = listUsersResult.users.map((userRecord) => {
      return {
        uid: userRecord.uid,
        email: userRecord.email,
        emailVerified: userRecord.emailVerified,
        disabled: userRecord.disabled
      };
    });

    return { users };
  } catch (error) {
    console.error('Error listing users:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error listing users: ${error.message}`
    );
  }
});

// Find team member status for authentication (no admin check needed - this is for auth flow)
exports.findTeamMember = functions.https.onCall(async (data, context) => {
  console.log('findTeamMember function called for UID:', data.uid);
  
  // Check if request is made by an authenticated user
  if (!context.auth) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'The function must be called while authenticated.'
    );
  }

  // Security check - user can only look up their own team member status
  if (context.auth.uid !== data.uid) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'You can only look up your own team member status.'
    );
  }

  if (!data.uid || !data.email) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'UID and email are required.'
    );
  }

  try {
    console.log(`Searching for team member: ${data.email} (${data.uid})`);
    
    // Get all users (organization owners) with admin privileges
    const usersSnapshot = await admin.firestore().collection('users').get();
    console.log(`Found ${usersSnapshot.docs.length} organizations to check`);
    
    // Check each organization's teamMembers collection
    for (const userDoc of usersSnapshot.docs) {
      const orgOwnerId = userDoc.id;
      
      try {
        // Check if this user exists as a team member in this organization
        const teamMemberDoc = await admin.firestore()
          .collection('users')
          .doc(orgOwnerId)
          .collection('teamMembers')
          .doc(data.uid)
          .get();
        
        if (teamMemberDoc.exists) {
          const teamMemberData = teamMemberDoc.data();
          
          console.log(`Found team member in organization ${orgOwnerId}:`, {
            email: teamMemberData.email,
            role: teamMemberData.role,
            isActive: teamMemberData.isActive
          });
          
          // Security check - ensure email matches
          if (teamMemberData.email !== data.email) {
            console.warn(`Email mismatch for team member in org ${orgOwnerId}`);
            continue;
          }
          
          // Check if team member is active
          if (teamMemberData.isActive === false) {
            console.log(`Team member is inactive in org ${orgOwnerId}`);
            continue;
          }
          
          // Get organization owner data
          const orgOwnerData = userDoc.data();
          
          // Return team member data with organization context
          return {
            found: true,
            teamMemberData: {
              ...teamMemberData,
              organizationId: orgOwnerId,
              organizationOwner: {
                email: orgOwnerData.email,
                companyName: orgOwnerData.companyName
              }
            }
          };
        }
      } catch (orgError) {
        console.warn(`Error checking team member in org ${orgOwnerId}:`, orgError.message);
        // Continue checking other organizations
      }
    }
    
    console.log('User not found as team member in any organization');
    return { found: false };
    
  } catch (error) {
    console.error('Error finding team member:', error);
    throw new functions.https.HttpsError(
      'internal',
      `Error finding team member: ${error.message}`
    );
  }
}); 
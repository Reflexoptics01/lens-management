# Admin Guide: User Management & Firebase Auth Issues

## Issue: Email Already In Use After Deletion

### Problem
When you delete users from the admin panel, they are removed from our Firestore database but **NOT** from Firebase Auth. This causes the "email already in use" error when users try to re-register.

### Why This Happens
- Admin panel deletion removes data from Firestore collections (`userRegistrations` and `users`)
- Firebase Auth user accounts can only be deleted using Firebase Admin SDK (server-side)
- Client-side code cannot delete Firebase Auth users for security reasons

## Solutions

### Option 1: Enable Re-registration (Recommended)
1. In admin panel, find the user
2. Click "Enable Re-registration" button
3. User can now try to register again
4. If they still get "email already in use", they need Option 2

### Option 2: Manual Firebase Auth Deletion
**For Admin Use Only:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to "Authentication" → "Users"
4. Find the user by email
5. Click the user → "Delete account"
6. Confirm deletion

### Option 3: Cloud Function (Future Implementation)
We can implement a Cloud Function to automate Firebase Auth user deletion:

```javascript
// This would be deployed as a Cloud Function
const functions = require('firebase-functions');
const admin = require('firebase-admin');

exports.deleteUser = functions.https.onCall(async (data, context) => {
  // Verify admin permissions
  if (!context.auth || context.auth.token.email !== 'reflexopticsolutions@gmail.com') {
    throw new functions.https.HttpsError('permission-denied', 'Unauthorized');
  }
  
  try {
    await admin.auth().deleteUser(data.uid);
    return { success: true, message: 'User deleted from Firebase Auth' };
  } catch (error) {
    throw new functions.https.HttpsError('internal', error.message);
  }
});
```

## User Guidance

### For Users Getting "Email Already In Use" Error:
1. Contact support at Info@reflexoptics.in
2. Provide the exact email address
3. We'll manually delete the Firebase Auth account
4. You can then register normally

### Prevention
- Always use "Enable Re-registration" before users attempt to re-register
- Consider implementing Cloud Function for complete deletion

## Technical Details

### Current Admin Panel Actions:
- **Delete**: Removes from Firestore only
- **Enable Re-registration**: Removes from Firestore only
- **Approve/Reject**: Updates Firestore status

### Firebase Auth Status:
- ✅ Create new users
- ✅ Sign in/out users  
- ❌ Delete users (requires server-side code)
- ✅ Update user profiles

### Firestore Collections Affected:
- `userRegistrations` - Registration requests
- `users` - Approved user accounts
- `users/{uid}/settings` - User company settings
- `users/{uid}/*` - User business data 
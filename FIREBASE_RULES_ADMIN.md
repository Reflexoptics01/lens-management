# 🔥 Firebase Security Rules for Admin Features

## Current Issue
The admin analytics are trying to access global collections (`errorLogs`, `userActivity`, `performanceLogs`) but Firebase security rules are blocking access.

## Solution: Update Firebase Security Rules

### **Step 1: Go to Firebase Console**
1. Visit https://console.firebase.google.com
2. Select your project
3. Go to **Firestore Database** → **Rules**

### **Step 2: Add Admin Rules**
Add these rules to allow super admins to access global collections:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Existing user-scoped data rules
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // NEW: Global collections for admin analytics
    match /errorLogs/{document} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin';
    }
    
    match /userActivity/{document} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin';
    }
    
    match /performanceLogs/{document} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin';
    }
    
    match /criticalAlerts/{document} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin';
    }
    
    match /healthChecks/{document} {
      allow read, write: if request.auth != null && 
        exists(/databases/$(database)/documents/users/$(request.auth.uid)) &&
        get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'superadmin';
    }
    
    // Allow all authenticated users to write activity/errors (for logging)
    match /errorLogs/{document} {
      allow create: if request.auth != null;
    }
    
    match /userActivity/{document} {
      allow create: if request.auth != null;
    }
    
    match /performanceLogs/{document} {
      allow create: if request.auth != null;
    }
  }
}
```

### **Step 3: Ensure Your Role is Set**
1. Go to **Firestore Database** → **Data**
2. Navigate to: `users` → `{your-user-id}`
3. Make sure the `role` field is set to `"superadmin"`

### **Alternative: Simpler Temporary Rules (For Testing)**
If you want to test quickly, you can use these simpler rules temporarily:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // User data access
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // TEMPORARY: Allow all authenticated users to access admin collections
    match /{collection}/{document=**} {
      allow read, write: if request.auth != null && 
        collection in ['errorLogs', 'userActivity', 'performanceLogs', 'criticalAlerts', 'healthChecks'];
    }
  }
}
```

⚠️ **Warning:** The temporary rules are less secure. Use the detailed rules for production.

## 🎯 Expected Result

After updating the rules:
- ✅ System Analytics will load without permission errors
- ✅ Firebase health status will show as "healthy"
- ✅ Error tracking will work properly
- ✅ User activity monitoring will function
- ✅ Performance metrics will be collected

## 🔄 Deployment Notes

The fixed SystemAnalytics component will now:
1. Try to access global collections first (for super admins)
2. Fall back to user-scoped data if no access
3. Show mock data if nothing is available
4. Display proper health status icons
5. Handle all error cases gracefully 
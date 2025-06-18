import { collection, doc } from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';

/**
 * Get the current user's UID - optimized for production
 * @returns {string|null} The user's UID or null if not found
 */
export const getUserUid = () => {
  // Check for team member organization UID first
  const organizationId = localStorage.getItem('organizationId');
  if (organizationId) {
    return organizationId; // Team members use their organization's UID
  }
  
  // First try localStorage (existing approach for organization owners)
  let uid = localStorage.getItem('userUid');
  
  // If not found in localStorage, try the global auth user
  if (!uid && typeof window !== 'undefined' && window.__authUser) {
    uid = window.__authUser.uid;
  }
  
  // Try Firebase auth directly as last resort
  if (!uid) {
    try {
      if (auth.currentUser) {
        uid = auth.currentUser.uid;
        // Update localStorage if we found a user
        localStorage.setItem('userUid', uid);
        localStorage.setItem('userEmail', auth.currentUser.email);
      }
    } catch (error) {
      // Silent auth check in production
    }
  }
  
  // Only log errors in production
  if (!uid) {
    console.error('No user UID found in localStorage, AuthContext, or Firebase auth');
  }
  return uid;
};

/**
 * Get a user-specific collection reference
 * @param {string} collectionName - The name of the collection
 * @returns {CollectionReference} The user-specific collection reference
 */
export const getUserCollection = (collectionName) => {
  const userUid = getUserUid();
  
  if (!userUid) {
    console.error('getUserCollection: User not authenticated - no UID found');
    throw new Error('User not authenticated - no UID found in localStorage');
  }
  
  const path = `users/${userUid}/${collectionName}`;
  return collection(db, path);
};

/**
 * Get a user-specific document reference
 * @param {string} collectionName - The name of the collection
 * @param {string} docId - The document ID
 * @returns {DocumentReference} The user-specific document reference
 */
export const getUserDoc = (collectionName, docId) => {
  const userUid = getUserUid();
  
  if (!userUid) {
    console.error('getUserDoc: User not authenticated - no UID found');
    throw new Error('User not authenticated - no UID found in localStorage');
  }
  
  const path = `users/${userUid}/${collectionName}`;
  return doc(db, path, docId);
};

/**
 * Get the user's settings document reference
 * @returns {DocumentReference} The user's settings document reference
 */
export const getUserSettings = () => {
  const userUid = getUserUid();
  if (!userUid) {
    throw new Error('User not authenticated');
  }
  return doc(db, `users/${userUid}/settings`, 'shopSettings');
};

/**
 * Check if a user is the super admin
 * @param {string} email - The user's email
 * @returns {boolean} True if the user is the super admin
 */
export const isSuperAdmin = (email) => {
  return email === 'reflexopticsolutions@gmail.com';
};

/**
 * Diagnose authentication issues and provide solutions
 * @returns {Object} Diagnosis results and recommendations
 */
export const diagnoseAuthIssues = () => {
  const userUid = localStorage.getItem('userUid');
  const userEmail = localStorage.getItem('userEmail');
  
  const diagnosis = {
    hasUid: !!userUid,
    hasEmail: !!userEmail,
    localStorageKeys: Object.keys(localStorage),
    issues: [],
    recommendations: []
  };
  
  if (!userUid) {
    diagnosis.issues.push('No user UID found in localStorage');
    diagnosis.recommendations.push('Please logout and login again to restore authentication');
  }
  
  if (!userEmail) {
    diagnosis.issues.push('No user email found in localStorage');
    diagnosis.recommendations.push('Clear browser data and login again');
  }
  
      // Authentication diagnosis performed
  return diagnosis;
};

/**
 * Attempt to fix authentication issues
 * @returns {boolean} True if fix was successful
 */
export const attemptAuthFix = () => {
  try {
    // Check if Firebase auth has current user but localStorage doesn't
    if (auth.currentUser && !localStorage.getItem('userUid')) {
      // Found authenticated user but missing localStorage data
      localStorage.setItem('userUid', auth.currentUser.uid);
      localStorage.setItem('userEmail', auth.currentUser.email);
      // Restored localStorage authentication data
      return true;
    }
  } catch (error) {
    console.error('Error attempting auth fix:', error);
  }
  return false;
};

/**
 * Filter out placeholder documents from a Firestore query snapshot
 * @param {QuerySnapshot} snapshot - The Firestore query snapshot
 * @returns {Array} Filtered array of documents without placeholders
 */
export const filterPlaceholderDocs = (snapshot) => {
  return snapshot.docs.filter(doc => !doc.data()._placeholder);
};

/**
 * Get collection path for the user
 * @param {string} collectionName - The name of the collection
 * @returns {string} The full path to the user's collection
 */
export const getUserCollectionPath = (collectionName) => {
  const userUid = getUserUid();
  if (!userUid) {
    throw new Error('User not authenticated');
  }
  return `users/${userUid}/${collectionName}`;
};

/**
 * Validate document ownership - ensures the document belongs to the current user
 * @param {Object} docData - The document data to validate
 * @param {string} currentUserId - The current user's ID
 * @returns {boolean} True if the document belongs to the current user
 */
export const validateDocumentOwnership = (docData, currentUserId) => {
  if (!docData || !currentUserId) {
    return false;
  }
  
  // Check if the document has a userId field that matches the current user
  return docData.userId === currentUserId;
};

/**
 * Sanitize document data to ensure it doesn't contain other users' data
 * @param {Object} docData - The document data to sanitize
 * @param {string} currentUserId - The current user's ID
 * @returns {Object} Sanitized document data
 */
export const sanitizeDocumentData = (docData, currentUserId) => {
  if (!docData || typeof docData !== 'object') {
    return docData;
  }
  
  // Create a copy to avoid modifying the original
  const sanitized = { ...docData };
  
  // Remove any foreign user references
  if (sanitized.userId && sanitized.userId !== currentUserId) {
    delete sanitized.userId;
  }
  
  // Add current user ID if not present
  if (!sanitized.userId) {
    sanitized.userId = currentUserId;
  }
  
  return sanitized;
};

/**
 * Validate backup ownership before restoration
 * @param {Object} backupMetadata - The backup metadata
 * @param {Object} currentUser - The current Firebase user
 * @returns {Object} Validation result with success/error
 */
export const validateBackupOwnership = (backupMetadata, currentUser) => {
  const validation = {
    isValid: false,
    errors: [],
    warnings: []
  };
  
  if (!backupMetadata) {
    validation.errors.push('Backup metadata is missing');
    return validation;
  }
  
  if (!currentUser) {
    validation.errors.push('Current user not authenticated');
    return validation;
  }
  
  // Check user ID
  if (!backupMetadata.userId) {
    validation.errors.push('Backup does not contain user ID information');
  } else if (backupMetadata.userId !== currentUser.uid) {
    validation.errors.push(`Backup belongs to different user ID: ${backupMetadata.userId} (current: ${currentUser.uid})`);
  }
  
  // Check email
  if (!backupMetadata.userEmail) {
    validation.warnings.push('Backup does not contain user email information');
  } else if (backupMetadata.userEmail !== currentUser.email) {
    validation.errors.push(`Backup belongs to different email: ${backupMetadata.userEmail} (current: ${currentUser.email})`);
  }
  
  // Check validation hash if present
  if (backupMetadata.userValidationHash) {
    try {
      const decodedHash = atob(backupMetadata.userValidationHash);
      const [hashUserId, hashUserEmail] = decodedHash.split(':');
      
      if (hashUserId !== currentUser.uid) {
        validation.errors.push('Backup validation hash does not match current user ID');
      }
      if (hashUserEmail !== currentUser.email) {
        validation.errors.push('Backup validation hash does not match current user email');
      }
    } catch (error) {
      validation.warnings.push('Could not validate backup hash');
    }
  }
  
  validation.isValid = validation.errors.length === 0;
  return validation;
};

/**
 * Create a secure backup metadata object
 * @param {Object} currentUser - The current Firebase user
 * @returns {Object} Secure backup metadata
 */
export const createSecureBackupMetadata = (currentUser) => {
  if (!currentUser) {
    throw new Error('User not authenticated');
  }
  
  const timestamp = Date.now();
  
  return {
    // Basic user identification
    userId: currentUser.uid,
    userEmail: currentUser.email,
    userDisplayName: currentUser.displayName || currentUser.email,
    
    // Security information
    accountCreationTime: currentUser.metadata.creationTime,
    userValidationHash: btoa(`${currentUser.uid}:${currentUser.email}:${timestamp}`),
    
    // Backup information
    createdAt: new Date(timestamp).toISOString(),
    version: '2.2',
    securityLevel: 'user-specific',
    backupType: 'complete',
    
    // Security notes
    restorationNotes: `This backup belongs to ${currentUser.email} and can only be restored by the same user account. Attempting to restore this backup in a different account will be rejected for security reasons.`,
    
    // Validation timestamp
    validationTimestamp: timestamp
  };
}; 
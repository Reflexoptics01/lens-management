import { collection, doc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Get the current user's UID from localStorage
 * @returns {string|null} The user's UID or null if not found
 */
export const getUserUid = () => {
  const uid = localStorage.getItem('userUid');
  console.log('getUserUid: Retrieved UID from localStorage:', uid);
  if (!uid) {
    console.error('No user UID found in localStorage');
    console.log('localStorage contents:', Object.keys(localStorage));
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
  console.log('getUserCollection: Starting with collectionName:', collectionName, 'userUid:', userUid);
  
  if (!userUid) {
    console.error('getUserCollection: User not authenticated - no UID found');
    throw new Error('User not authenticated - no UID found in localStorage');
  }
  
  const path = `users/${userUid}/${collectionName}`;
  console.log(`getUserCollection: Creating collection reference for path: ${path}`);
  
  const collectionRef = collection(db, path);
  console.log('getUserCollection: Collection reference created successfully');
  
  return collectionRef;
};

/**
 * Get a user-specific document reference
 * @param {string} collectionName - The name of the collection
 * @param {string} docId - The document ID
 * @returns {DocumentReference} The user-specific document reference
 */
export const getUserDoc = (collectionName, docId) => {
  const userUid = getUserUid();
  console.log('getUserDoc: Starting with collectionName:', collectionName, 'docId:', docId, 'userUid:', userUid);
  
  if (!userUid) {
    console.error('getUserDoc: User not authenticated - no UID found');
    throw new Error('User not authenticated - no UID found in localStorage');
  }
  
  const path = `users/${userUid}/${collectionName}`;
  console.log(`getUserDoc: Creating document reference for path: ${path}/${docId}`);
  
  const docRef = doc(db, path, docId);
  console.log('getUserDoc: Document reference created successfully');
  
  return docRef;
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
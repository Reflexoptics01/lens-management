import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';

/**
 * Get all approved and active distributors/users from the global users collection
 * This is used for the chat system to find all available distributors
 */
export const getAllDistributors = async () => {
  try {
    // Query the global users collection for approved and active users
    const usersRef = collection(db, 'users');
    const activeUsersQuery = query(
      usersRef,
      where('status', '==', 'approved'),
      where('isActive', '!=', false) // Include users where isActive is true or undefined
    );
    
    const snapshot = await getDocs(activeUsersQuery);
    
    if (snapshot.empty) {
      return [];
    }
    
    const distributors = [];
    snapshot.forEach(doc => {
      const userData = doc.data();
      
      // Only include users that have the basic required information
      if (userData.email && (userData.companyName || userData.opticalName || userData.displayName)) {
        distributors.push({
          id: doc.id, // This is the user's UID
          opticalName: userData.companyName || userData.opticalName || userData.displayName || 'Unknown Company',
          city: userData.city || userData.location || 'Unknown City',
          // email: userData.email, // Removed to hide emails from UI
          phone: userData.phone || userData.mobile || '',
          role: userData.role || 'user',
          registrationDate: userData.registrationDate || userData.createdAt,
          // Additional info that might be useful
          state: userData.state || '',
          businessType: userData.businessType || '',
          gstNumber: userData.gstNumber || ''
        });
      }
    });
    
    return distributors;
    
  } catch (error) {
    console.error('Error fetching distributors:', error);
    throw new Error('Failed to load distributors: ' + error.message);
  }
};

/**
 * Get a specific user by ID
 */
export const getUserById = async (userId) => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return {
        id: userDoc.id,
        opticalName: userData.companyName || userData.opticalName || userData.displayName || 'Unknown Company',
        city: userData.city || userData.location || 'Unknown City',
        email: userData.email,
        phone: userData.phone || userData.mobile || '',
        role: userData.role || 'user',
        ...userData
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    throw error;
  }
}; 
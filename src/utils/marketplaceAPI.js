import { 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  serverTimestamp,
  onSnapshot,
  getDoc
} from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getUserCollection } from './multiTenancy';

// Marketplace Queries Collection
export const getMarketplaceQueriesCollection = () => {
  return collection(db, 'marketplaceQueries');
};

// Marketplace Profiles Collection
export const getMarketplaceProfilesCollection = () => {
  return collection(db, 'marketplaceProfiles');
};

// Query Responses Collection (subcollection)
export const getQueryResponsesCollection = (queryId) => {
  return collection(db, 'marketplaceQueries', queryId, 'responses');
};

// Marketplace Notifications Collection
export const getMarketplaceNotificationsCollection = (userId) => {
  return collection(db, 'users', userId, 'marketplaceNotifications');
};

/**
 * Search marketplace profiles for distributors
 */
export const searchMarketplaceProfiles = async (searchCriteria = {}) => {
  try {
    const profilesRef = getMarketplaceProfilesCollection();
    let queryRef = query(profilesRef);

    // Only get active profiles
    queryRef = query(queryRef, where('visibility.isActive', '==', true));

    const snapshot = await getDocs(queryRef);
    let profiles = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Apply client-side filtering
    if (searchCriteria.searchTerm) {
      const term = searchCriteria.searchTerm.toLowerCase();
      profiles = profiles.filter(profile => 
        (profile.shopName && profile.shopName.toLowerCase().includes(term)) ||
        (profile.displayName && profile.displayName.toLowerCase().includes(term)) ||
        (profile.description && profile.description.toLowerCase().includes(term)) ||
        (profile.businessInfo?.specializations && profile.businessInfo.specializations.some(spec => 
          spec.toLowerCase().includes(term)
        )) ||
        (profile.businessInfo?.businessType && profile.businessInfo.businessType.toLowerCase().includes(term)) ||
        (profile.address?.city && profile.address.city.toLowerCase().includes(term)) ||
        (profile.address?.state && profile.address.state.toLowerCase().includes(term))
      );
    }

    if (searchCriteria.city) {
      profiles = profiles.filter(profile => 
        profile.address?.city && profile.address.city.toLowerCase().includes(searchCriteria.city.toLowerCase())
      );
    }

    if (searchCriteria.businessType) {
      profiles = profiles.filter(profile => 
        profile.businessInfo?.businessType === searchCriteria.businessType
      );
    }

    if (searchCriteria.specializations && searchCriteria.specializations.length > 0) {
      profiles = profiles.filter(profile => 
        profile.businessInfo?.specializations && 
        searchCriteria.specializations.some(spec => 
          profile.businessInfo.specializations.includes(spec)
        )
      );
    }

    // Sort by shop name
    profiles.sort((a, b) => (a.shopName || '').localeCompare(b.shopName || ''));

    return profiles;
  } catch (error) {
    console.error('Error searching marketplace profiles:', error);
    throw error;
  }
};

/**
 * Get a specific marketplace profile by ID
 */
export const getMarketplaceProfile = async (profileId) => {
  try {
    const profileRef = doc(db, 'marketplaceProfiles', profileId);
    const profileSnap = await getDoc(profileRef);
    
    if (profileSnap.exists()) {
      return {
        id: profileSnap.id,
        ...profileSnap.data()
      };
    } else {
      return null;
    }
  } catch (error) {
    console.error('Error fetching marketplace profile:', error);
    throw error;
  }
};

/**
 * Get all active marketplace profiles for distributor listings
 */
export const getAllActiveMarketplaceProfiles = async () => {
  try {
    const profilesRef = getMarketplaceProfilesCollection();
    const activeProfilesQuery = query(
      profilesRef, 
      where('visibility.isActive', '==', true),
      orderBy('shopName')
    );
    
    const snapshot = await getDocs(activeProfilesQuery);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (error) {
    console.error('Error fetching active marketplace profiles:', error);
    throw error;
  }
};

/**
 * Create a new marketplace query
 */
export const createMarketplaceQuery = async (queryData, userInfo) => {
  try {
    const marketplaceQueriesRef = getMarketplaceQueriesCollection();
    
    const newQuery = {
      ...queryData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      status: 'active',
      responseCount: 0,
      posterInfo: {
        userId: userInfo.uid,
        opticalName: userInfo.opticalName || 'Unknown Optical',
        city: userInfo.city || 'Unknown City',
        contactPerson: userInfo.displayName || userInfo.email,
        email: userInfo.email,
        phone: userInfo.phone || ''
      },
      viewCount: 0,
      bookmarkedBy: []
    };

    const docRef = await addDoc(marketplaceQueriesRef, newQuery);
    
    // Create notifications for all other users
    await createQueryNotifications(docRef.id, newQuery, userInfo.uid);
    
    return docRef.id;
  } catch (error) {
    console.error('Error creating marketplace query:', error);
    throw error;
  }
};

/**
 * Get marketplace queries with filtering and pagination
 */
export const getMarketplaceQueries = async (filters = {}) => {
  try {
    const marketplaceQueriesRef = getMarketplaceQueriesCollection();
    let queryRef = query(marketplaceQueriesRef);

    // Apply filters
    if (filters.type) {
      queryRef = query(queryRef, where('type', '==', filters.type));
    }
    
    if (filters.status) {
      queryRef = query(queryRef, where('status', '==', filters.status));
    }
    
    if (filters.userId) {
      queryRef = query(queryRef, where('posterInfo.userId', '==', filters.userId));
    }

    // Apply ordering and limit
    queryRef = query(queryRef, orderBy('createdAt', 'desc'));
    
    if (filters.limit) {
      queryRef = query(queryRef, limit(filters.limit));
    }

    const snapshot = await getDocs(queryRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate(),
      updatedAt: doc.data().updatedAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching marketplace queries:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time marketplace queries
 */
export const subscribeToMarketplaceQueries = (callback, filters = {}) => {
  try {
    const marketplaceQueriesRef = getMarketplaceQueriesCollection();
    let queryRef = query(marketplaceQueriesRef);

    // Apply filters
    if (filters.type) {
      queryRef = query(queryRef, where('type', '==', filters.type));
    }
    
    if (filters.status) {
      queryRef = query(queryRef, where('status', '==', filters.status));
    }

    // Apply ordering and limit
    queryRef = query(queryRef, orderBy('createdAt', 'desc'));
    
    if (filters.limit) {
      queryRef = query(queryRef, limit(filters.limit));
    }

    return onSnapshot(queryRef, (snapshot) => {
      const queries = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        updatedAt: doc.data().updatedAt?.toDate()
      }));
      callback(queries);
    });
  } catch (error) {
    console.error('Error subscribing to marketplace queries:', error);
    throw error;
  }
};

/**
 * Create a response to a marketplace query
 */
export const createQueryResponse = async (queryId, responseData, userInfo) => {
  try {
    const responsesRef = getQueryResponsesCollection(queryId);
    
    const newResponse = {
      ...responseData,
      createdAt: serverTimestamp(),
      responderInfo: {
        userId: userInfo.uid,
        opticalName: userInfo.opticalName || 'Unknown Optical',
        city: userInfo.city || 'Unknown City',
        contactPerson: userInfo.displayName || userInfo.email,
        email: userInfo.email,
        phone: userInfo.phone || ''
      }
    };

    const responseDoc = await addDoc(responsesRef, newResponse);
    
    // Update query response count
    const queryRef = doc(db, 'marketplaceQueries', queryId);
    await updateDoc(queryRef, {
      responseCount: await getQueryResponseCount(queryId),
      updatedAt: serverTimestamp()
    });

    // Notify query poster about new response
    await createResponseNotification(queryId, newResponse, userInfo.uid);
    
    return responseDoc.id;
  } catch (error) {
    console.error('Error creating query response:', error);
    throw error;
  }
};

/**
 * Get responses for a specific query
 */
export const getQueryResponses = async (queryId) => {
  try {
    const responsesRef = getQueryResponsesCollection(queryId);
    const queryRef = query(responsesRef, orderBy('createdAt', 'desc'));
    
    const snapshot = await getDocs(queryRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching query responses:', error);
    throw error;
  }
};

/**
 * Get response count for a query
 */
export const getQueryResponseCount = async (queryId) => {
  try {
    const responsesRef = getQueryResponsesCollection(queryId);
    const snapshot = await getDocs(responsesRef);
    return snapshot.size;
  } catch (error) {
    console.error('Error getting response count:', error);
    return 0;
  }
};

/**
 * Update a marketplace query
 */
export const updateMarketplaceQuery = async (queryId, updates) => {
  try {
    const queryRef = doc(db, 'marketplaceQueries', queryId);
    await updateDoc(queryRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error updating marketplace query:', error);
    throw error;
  }
};

/**
 * Delete a marketplace query
 */
export const deleteMarketplaceQuery = async (queryId) => {
  try {
    const queryRef = doc(db, 'marketplaceQueries', queryId);
    await deleteDoc(queryRef);
  } catch (error) {
    console.error('Error deleting marketplace query:', error);
    throw error;
  }
};

/**
 * Create notifications for all users about a new query
 */
const createQueryNotifications = async (queryId, queryData, posterId) => {
  try {
    // Get all users (excluding the poster)
    const usersRef = collection(db, 'users');
    const usersSnapshot = await getDocs(usersRef);
    
    const notificationPromises = usersSnapshot.docs
      .filter(userDoc => userDoc.id !== posterId)
      .map(async (userDoc) => {
        const userNotificationsRef = getMarketplaceNotificationsCollection(userDoc.id);
        
        return addDoc(userNotificationsRef, {
          type: 'new_query',
          queryId: queryId,
          title: `New ${queryData.type.replace('_', ' ')} query`,
          message: `${queryData.posterInfo.opticalName} posted: ${queryData.title}`,
          queryTitle: queryData.title,
          queryType: queryData.type,
          posterInfo: queryData.posterInfo,
          read: false,
          createdAt: serverTimestamp()
        });
      });

    await Promise.all(notificationPromises);
  } catch (error) {
    console.error('Error creating query notifications:', error);
  }
};

/**
 * Create notification for query poster about new response
 */
const createResponseNotification = async (queryId, responseData, responderId) => {
  try {
    // Get the original query to find the poster
    const queryRef = doc(db, 'marketplaceQueries', queryId);
    const queryDoc = await getDocs(query(collection(db, 'marketplaceQueries'), where('__name__', '==', queryId)));
    
    if (!queryDoc.empty) {
      const queryData = queryDoc.docs[0].data();
      const posterId = queryData.posterInfo.userId;
      
      if (posterId !== responderId) {
        const posterNotificationsRef = getMarketplaceNotificationsCollection(posterId);
        
        await addDoc(posterNotificationsRef, {
          type: 'query_response',
          queryId: queryId,
          responseId: responseData.id,
          title: 'New response to your query',
          message: `${responseData.responderInfo.opticalName} responded to your query: ${queryData.title}`,
          queryTitle: queryData.title,
          responderInfo: responseData.responderInfo,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    }
  } catch (error) {
    console.error('Error creating response notification:', error);
  }
};

/**
 * Get marketplace notifications for a user
 */
export const getMarketplaceNotifications = async (userId, unreadOnly = false) => {
  try {
    const notificationsRef = getMarketplaceNotificationsCollection(userId);
    let queryRef = query(notificationsRef, orderBy('createdAt', 'desc'));
    
    if (unreadOnly) {
      queryRef = query(notificationsRef, where('read', '==', false), orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(queryRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate()
    }));
  } catch (error) {
    console.error('Error fetching marketplace notifications:', error);
    throw error;
  }
};

/**
 * Mark notification as read
 */
export const markNotificationAsRead = async (userId, notificationId) => {
  try {
    const notificationRef = doc(db, 'users', userId, 'marketplaceNotifications', notificationId);
    await updateDoc(notificationRef, {
      read: true,
      readAt: serverTimestamp()
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
};

/**
 * Subscribe to real-time marketplace notifications
 */
export const subscribeToMarketplaceNotifications = (userId, callback) => {
  try {
    const notificationsRef = getMarketplaceNotificationsCollection(userId);
    const queryRef = query(notificationsRef, orderBy('createdAt', 'desc'), limit(50));

    return onSnapshot(queryRef, (snapshot) => {
      const notifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      callback(notifications);
    });
  } catch (error) {
    console.error('Error subscribing to marketplace notifications:', error);
    throw error;
  }
};

/**
 * Get marketplace activity (recent queries and responses)
 */
export const getMarketplaceActivity = async (limit = 10) => {
  try {
    const queriesRef = getMarketplaceQueriesCollection();
    const recentQueriesRef = query(queriesRef, orderBy('createdAt', 'desc'), limit(limit));
    
    const snapshot = await getDocs(recentQueriesRef);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      type: 'new_query',
      message: `${doc.data().posterInfo.opticalName} posted a ${doc.data().type.replace('_', ' ')} query`,
      timestamp: doc.data().createdAt?.toDate(),
      icon: getActivityIcon(doc.data().type),
      data: doc.data()
    }));
  } catch (error) {
    console.error('Error fetching marketplace activity:', error);
    return [];
  }
};

/**
 * Get activity icon based on type
 */
const getActivityIcon = (type) => {
  const icons = {
    search: '🔍',
    price_request: '💰',
    bulk_sale: '📦',
    special_request: '⭐',
    new_query: '📝',
    query_response: '💬',
    new_distributor: '🎉'
  };
  return icons[type] || '📝';
};

/**
 * Get marketplace statistics
 */
export const getMarketplaceStats = async (userId = null) => {
  try {
    // Get all queries
    const queriesSnapshot = await getDocs(getMarketplaceQueriesCollection());
    const totalQueries = queriesSnapshot.size;
    
    // Get active queries (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const activeQueriesRef = query(
      getMarketplaceQueriesCollection(),
      where('createdAt', '>=', thirtyDaysAgo),
      where('status', '==', 'active')
    );
    const activeQueriesSnapshot = await getDocs(activeQueriesRef);
    const activeQueries = activeQueriesSnapshot.size;
    
    // Get unique distributors
    const uniqueDistributors = new Set();
    queriesSnapshot.docs.forEach(doc => {
      uniqueDistributors.add(doc.data().posterInfo.userId);
    });
    
    // Get user's queries if userId provided
    let myQueries = 0;
    if (userId) {
      const myQueriesRef = query(
        getMarketplaceQueriesCollection(),
        where('posterInfo.userId', '==', userId)
      );
      const myQueriesSnapshot = await getDocs(myQueriesRef);
      myQueries = myQueriesSnapshot.size;
    }
    
    return {
      totalQueries,
      activeQueries,
      activeDistributors: uniqueDistributors.size,
      myQueries
    };
  } catch (error) {
    console.error('Error fetching marketplace stats:', error);
    return {
      totalQueries: 0,
      activeQueries: 0,
      activeDistributors: 0,
      myQueries: 0
    };
  }
}; 
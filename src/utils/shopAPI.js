const SHOP_API_BASE_URL = 'https://us-central1-reflex-64925.cloudfunctions.net';
import { getUserUid } from './multiTenancy';
import { dateToISOString } from './dateUtils';

// Get current user info for shop operations (MULTI-TENANT SAFE)
const getCurrentUserInfo = () => {
  const userUid = getUserUid();
  if (!userUid) {
    throw new Error('User not authenticated - cannot perform shop operations');
  }
  
  // Get user info from localStorage but ensure it's tied to current user
  const userInfo = localStorage.getItem('userInfo');
  if (userInfo) {
    const parsedInfo = JSON.parse(userInfo);
    // Ensure the stored info belongs to current user
    if (parsedInfo.userId === userUid) {
      return parsedInfo;
    }
  }
  
  // Fallback - create basic user info with current UID
  const userEmail = localStorage.getItem('userEmail');
  return {
    opticalName: userEmail ? `${userEmail.split('@')[0]} Optical` : 'User Optical Store',
    city: 'Not specified',
    phone: 'Not specified',
    userId: userUid,
    email: userEmail
  };
};

// Upload user's lenses to the centralized shop (USER-SPECIFIC)
export const uploadLensesToShop = async (lenses, userInfo = null) => {
  try {
    const currentUserInfo = userInfo || getCurrentUserInfo();
    const userUid = getUserUid();
    
    if (!userUid) {
      throw new Error('User not authenticated');
    }
    
    // Ensure userInfo has correct userId
    const safeUserInfo = {
      ...currentUserInfo,
      userId: userUid
    };
    
    const lensesToUpload = lenses
      .filter(lens => lens.type === 'prescription' || lens.type === 'contact') // Only RX and Contact lenses
      .map(lens => ({
        ...lens,
        // Add user information (USER-SPECIFIC)
        userInfo: safeUserInfo,
        // Add upload timestamp
        uploadedAt: dateToISOString(new Date()),
        // Create unique shop ID combining user ID and lens ID (PREVENTS CONFLICTS)
        shopId: `${userUid}_${lens.id}`,
        // Ensure user ownership
        ownerId: userUid
      }));

    const uploadPromises = lensesToUpload.map(async (lens) => {
      const response = await fetch(`${SHOP_API_BASE_URL}/createShopItem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: lens,
          documentId: lens.shopId
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to upload lens ${lens.id}`);
      }

      return response.json();
    });

    const results = await Promise.all(uploadPromises);
    console.log('Successfully uploaded user lenses to shop:', results);
    return results;
  } catch (error) {
    console.error('Error uploading user lenses to shop:', error);
    throw error;
  }
};

// Remove user's lenses from the centralized shop (USER-SPECIFIC)
export const removeLensesFromShop = async (lenses, userInfo = null) => {
  try {
    const currentUserInfo = userInfo || getCurrentUserInfo();
    const userUid = getUserUid();
    
    if (!userUid) {
      throw new Error('User not authenticated');
    }

    const removePromises = lenses
      .filter(lens => lens.type === 'prescription' || lens.type === 'contact')
      .map(async (lens) => {
        // Use user-specific shop ID (PREVENTS CROSS-USER DELETION)
        const shopId = `${userUid}_${lens.id}`;
        
        const response = await fetch(`${SHOP_API_BASE_URL}/deleteShopItem`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            documentId: shopId
          })
        });

        if (!response.ok) {
          // Don't throw error if item doesn't exist
          if (response.status === 404) {
            console.log(`User lens ${lens.id} not found in shop, skipping...`);
            return { success: true, message: 'Not found, skipped' };
          }
          throw new Error(`Failed to remove lens ${lens.id}`);
        }

        return response.json();
      });

    const results = await Promise.all(removePromises);
    console.log('Successfully removed user lenses from shop:', results);
    return results;
  } catch (error) {
    console.error('Error removing user lenses from shop:', error);
    throw error;
  }
};

// Search for matching lenses in the centralized shop (FILTERED BY USER PREFERENCES)
export const searchMatchingLenses = async (prescriptionData) => {
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }
    
    // Get all lenses from shop
    const response = await fetch(`${SHOP_API_BASE_URL}/getShop?limit=1000`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch shop data');
    }

    const result = await response.json();
    
    if (!result.success || !result.data.documents) {
      return [];
    }

    const allShopLenses = result.data.documents;
    console.log(`Found ${allShopLenses.length} lenses in centralized shop`);

    // Filter out user's own lenses and only show others' lenses
    const otherUsersLenses = allShopLenses.filter(lens => {
      // Exclude user's own lenses
      return lens.ownerId !== userUid && lens.userInfo?.userId !== userUid;
    });

    console.log(`Filtering to ${otherUsersLenses.length} lenses from other users`);

    // Filter and match lenses using the same logic as local inventory
    const matchingLenses = findMatchingLenses(otherUsersLenses, prescriptionData);
    
    return matchingLenses;
  } catch (error) {
    console.error('Error searching matching lenses:', error);
    return [];
  }
};

// Helper function to find matching lenses (same logic as CreateOrder.jsx)
const findMatchingLenses = (lenses, prescriptionData) => {
  const SPH_TOLERANCE = 0.25;
  const CYL_TOLERANCE = 0.25;
  const ADD_TOLERANCE = 0.25;
  const AXIS_TOLERANCE = 10; // 10 degrees tolerance

  const isWithinTolerance = (val1, val2, tolerance) => {
    if (!val1 || !val2) return false;
    
    try {
      const num1 = parseFloat(val1);
      const num2 = parseFloat(val2);
      if (isNaN(num1) || isNaN(num2)) return false;
      
      return Math.abs(num1 - num2) <= tolerance;
    } catch (e) {
      return false;
    }
  };

  const isAxisWithinTolerance = (val1, val2, tolerance = AXIS_TOLERANCE) => {
    if (!val1 || !val2) return false;
    
    try {
      const num1 = parseInt(val1);
      const num2 = parseInt(val2);
      if (isNaN(num1) || isNaN(num2)) return false;
      
      const diff = Math.abs(num1 - num2);
      return diff <= tolerance || diff >= (180 - tolerance);
    } catch (e) {
      return false;
    }
  };

  const calculateMatchQuality = (lens, sph, cyl, axis, add) => {
    let score = 0;
    let factors = 0;
    
    if (lens.sph && sph) {
      const sphDiff = Math.abs(parseFloat(lens.sph) - parseFloat(sph));
      score += Math.max(0, 1 - (sphDiff / SPH_TOLERANCE));
      factors++;
    }
    
    if (lens.cyl && cyl) {
      const cylDiff = Math.abs(parseFloat(lens.cyl) - parseFloat(cyl));
      score += Math.max(0, 1 - (cylDiff / CYL_TOLERANCE));
      factors++;
    }
    
    if (lens.axis && axis) {
      const axisDiff = Math.abs(parseInt(lens.axis) - parseInt(axis));
      const normalizedAxisDiff = Math.min(axisDiff, 180 - axisDiff);
      score += Math.max(0, 1 - (normalizedAxisDiff / AXIS_TOLERANCE));
      factors++;
    }
    
    if (lens.add && add) {
      const addDiff = Math.abs(parseFloat(lens.add) - parseFloat(add));
      score += Math.max(0, 1 - (addDiff / ADD_TOLERANCE));
      factors++;
    }
    
    return factors > 0 ? score / factors : 0;
  };

  const matches = [];

  // Check both eyes
  ['right', 'left'].forEach(eye => {
    const eyeData = prescriptionData[eye];
    if (!eyeData) return;

    lenses.forEach(lens => {
      let isMatch = false;
      let matchQuality = 0;
      
      // For contact lenses, match against specific eye
      if (lens.type === 'contact' && lens.eye === eye) {
        if (lens.sph && eyeData.sph && isWithinTolerance(lens.sph, eyeData.sph, SPH_TOLERANCE)) {
          isMatch = true;
          if (lens.cyl && eyeData.cyl) {
            isMatch = isMatch && isWithinTolerance(lens.cyl, eyeData.cyl, CYL_TOLERANCE);
            if (lens.axis && eyeData.axis && isMatch) {
              isMatch = isAxisWithinTolerance(lens.axis, eyeData.axis);
            }
          }
        }
        
        if (isMatch) {
          matchQuality = calculateMatchQuality(lens, eyeData.sph, eyeData.cyl, eyeData.axis, eyeData.add);
        }
      }
      
      // For prescription lenses, they can be used for either eye
      else if (lens.type === 'prescription') {
        if (lens.sph && eyeData.sph && isWithinTolerance(lens.sph, eyeData.sph, SPH_TOLERANCE)) {
          isMatch = true;
          if (lens.cyl && eyeData.cyl) {
            isMatch = isMatch && isWithinTolerance(lens.cyl, eyeData.cyl, CYL_TOLERANCE);
            if (lens.axis && eyeData.axis && isMatch) {
              isMatch = isAxisWithinTolerance(lens.axis, eyeData.axis);
            }
          }
          if (lens.add && eyeData.add && isMatch) {
            isMatch = isWithinTolerance(lens.add, eyeData.add, ADD_TOLERANCE);
          }
        }
        
        if (isMatch) {
          matchQuality = calculateMatchQuality(lens, eyeData.sph, eyeData.cyl, eyeData.axis, eyeData.add);
        }
      }

      if (isMatch && matchQuality > 0.7) { // Only show high-quality matches
        matches.push({
          ...lens,
          matchedFor: eye,
          matchQuality: Math.round(matchQuality * 100),
          matchDetails: {
            sph: { lens: lens.sph, prescription: eyeData.sph },
            cyl: { lens: lens.cyl, prescription: eyeData.cyl },
            axis: { lens: lens.axis, prescription: eyeData.axis },
            add: { lens: lens.add, prescription: eyeData.add }
          }
        });
      }
    });
  });

  // Sort by match quality and remove duplicates
  return matches
    .sort((a, b) => b.matchQuality - a.matchQuality)
    .filter((lens, index, arr) => 
      arr.findIndex(l => l.id === lens.id && l.matchedFor === lens.matchedFor) === index
    );
};

// Get shop preferences (USER-SPECIFIC)
export const getShopPreferences = () => {
  const userUid = getUserUid();
  if (!userUid) {
    return { isSharing: false }; // Return default object instead of null
  }
  
  const preferences = localStorage.getItem(`shopPreferences_${userUid}`);
  return preferences ? JSON.parse(preferences) : { isSharing: false }; // Return default object instead of null
};

// Set shop preferences (USER-SPECIFIC)
export const setShopPreferences = (preferences) => {
  const userUid = getUserUid();
  if (!userUid) {
    throw new Error('User not authenticated');
  }
  
  localStorage.setItem(`shopPreferences_${userUid}`, JSON.stringify({
    ...preferences,
    userId: userUid,
    updatedAt: dateToISOString(new Date())
  }));
};

export { getCurrentUserInfo }; 
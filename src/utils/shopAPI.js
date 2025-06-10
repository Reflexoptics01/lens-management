const SHOP_API_BASE_URL = 'https://us-central1-reflex-64925.cloudfunctions.net';
import { getUserUid } from './multiTenancy';
import { dateToISOString } from './dateUtils';

// Get current user info for shop operations (MULTI-TENANT SAFE)
export const getCurrentUserInfo = () => {
  const userUid = getUserUid();
  if (!userUid) {
    throw new Error('User not authenticated - cannot perform shop operations');
  }
  
  // Get user info from localStorage but ensure it's tied to current user
  const userInfo = localStorage.getItem('userInfo');
  if (userInfo) {
    try {
      const parsedInfo = JSON.parse(userInfo);
      // Ensure the stored info belongs to current user
      if (parsedInfo.userId === userUid) {
        return parsedInfo;
      }
    } catch (e) {
      console.warn('Error parsing stored user info:', e);
    }
  }
  
  // Fallback - create basic user info with current UID
  const userEmail = localStorage.getItem('userEmail') || '';
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
      try {
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
          const errorText = await response.text();
          throw new Error(`Failed to upload lens ${lens.id}: ${errorText}`);
        }

        return await response.json();
      } catch (error) {
        console.error(`Error uploading lens ${lens.id}:`, error);
        throw error;
      }
    });

    const results = await Promise.all(uploadPromises);
    // Successfully uploaded user lenses to shop
    return results;
  } catch (error) {
    console.error('Error uploading user lenses to shop:', error);
    throw error;
  }
};

// Remove user's lenses from the centralized shop (USER-SPECIFIC)
export const removeLensesFromShop = async (lenses, userInfo = null) => {
  try {
    const userUid = getUserUid();
    
    if (!userUid) {
      throw new Error('User not authenticated');
    }

    const removePromises = lenses
      .filter(lens => lens.type === 'prescription' || lens.type === 'contact')
      .map(async (lens) => {
        try {
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
              // User lens not found in shop, skipping
              return { success: true, message: 'Not found, skipped' };
            }
            const errorText = await response.text();
            throw new Error(`Failed to remove lens ${lens.id}: ${errorText}`);
          }

          return await response.json();
        } catch (error) {
          console.error(`Error removing lens ${lens.id}:`, error);
          throw error;
        }
      });

    const results = await Promise.all(removePromises);
    // Successfully processed lens removals from shop
    return results;
  } catch (error) {
    console.error('Error removing user lenses from shop:', error);
    throw error;
  }
};

// Get all shop lenses (for marketplace)
export const getAllShopLenses = async (limit = 1000, includeOwnLenses = false) => {
  try {
    const userUid = getUserUid();
    if (!userUid) {
      throw new Error('User not authenticated');
    }
    
    const response = await fetch(`${SHOP_API_BASE_URL}/getShop?limit=${limit}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch shop data: ${errorText}`);
    }

    const result = await response.json();
    
    if (!result.success || !result.data?.documents) {
      return [];
    }

    const allShopLenses = result.data.documents;
    // Found lenses in centralized shop

    if (includeOwnLenses) {
      // Include all lenses (own and others) when explicitly requested
              // Including all lenses (including own inventory)
      return allShopLenses;
    } else {
      // Filter out user's own lenses and only show others' lenses
      const otherUsersLenses = allShopLenses.filter(lens => {
        return lens.ownerId !== userUid && lens.userInfo?.userId !== userUid;
      });

              // Filtering to lenses from other distributors
      return otherUsersLenses;
    }
  } catch (error) {
    console.error('Error fetching shop lenses:', error);
    throw error;
  }
};

// Search for matching lenses in the centralized shop (FILTERED BY USER PREFERENCES)
export const searchMatchingLenses = async (prescriptionData, includeOwnLenses = false) => {
  try {
    const allShopLenses = await getAllShopLenses(1000, includeOwnLenses);
    
    if (!allShopLenses || allShopLenses.length === 0) {
      return [];
    }

    // Filter and match lenses using the same logic as local inventory
    const matchingLenses = findMatchingLenses(allShopLenses, prescriptionData);
    
    return matchingLenses;
  } catch (error) {
    console.error('Error searching matching lenses:', error);
    return [];
  }
};

// Search lenses by specifications (for general marketplace search)
export const searchLensesBySpecs = async (searchCriteria) => {
  try {
    // Include user's own lenses in shop search results
    const allShopLenses = await getAllShopLenses(1000, true);
    
    if (!allShopLenses || allShopLenses.length === 0) {
      return [];
    }

    // Apply search filters
    let filteredLenses = allShopLenses;

    // Filter by lens type
    if (searchCriteria.type && searchCriteria.type !== 'all') {
      filteredLenses = filteredLenses.filter(lens => lens.type === searchCriteria.type);
    }

    // Filter by specifications
    if (searchCriteria.sph) {
      const sphValue = parseFloat(searchCriteria.sph);
      filteredLenses = filteredLenses.filter(lens => {
        if (!lens.sph) return false;
        const lensSph = parseFloat(lens.sph);
        return Math.abs(lensSph - sphValue) <= 0.25; // 0.25 tolerance
      });
    }

    if (searchCriteria.cyl) {
      const cylValue = parseFloat(searchCriteria.cyl);
      filteredLenses = filteredLenses.filter(lens => {
        if (!lens.cyl) return false;
        const lensCyl = parseFloat(lens.cyl);
        return Math.abs(lensCyl - cylValue) <= 0.25; // 0.25 tolerance
      });
    }

    if (searchCriteria.axis) {
      const axisValue = parseInt(searchCriteria.axis);
      filteredLenses = filteredLenses.filter(lens => {
        if (!lens.axis) return false;
        const lensAxis = parseInt(lens.axis);
        const diff = Math.abs(lensAxis - axisValue);
        return diff <= 10 || diff >= 170; // 10 degree tolerance, considering 180 wrap-around
      });
    }

    if (searchCriteria.add) {
      const addValue = parseFloat(searchCriteria.add);
      filteredLenses = filteredLenses.filter(lens => {
        if (!lens.add) return false;
        const lensAdd = parseFloat(lens.add);
        return Math.abs(lensAdd - addValue) <= 0.25; // 0.25 tolerance
      });
    }

    // Filter by brand
    if (searchCriteria.brand && searchCriteria.brand.trim()) {
      filteredLenses = filteredLenses.filter(lens => 
        lens.brand && lens.brand.toLowerCase().includes(searchCriteria.brand.toLowerCase())
      );
    }

    // Filter by material
    if (searchCriteria.material && searchCriteria.material.trim()) {
      filteredLenses = filteredLenses.filter(lens => 
        lens.material && lens.material.toLowerCase().includes(searchCriteria.material.toLowerCase())
      );
    }

    // Filter by coating
    if (searchCriteria.coating && searchCriteria.coating.trim()) {
      filteredLenses = filteredLenses.filter(lens => 
        lens.coating && lens.coating.toLowerCase().includes(searchCriteria.coating.toLowerCase())
      );
    }

    // Filter by contact lens specific fields
    if (searchCriteria.baseCurve) {
      const bcValue = parseFloat(searchCriteria.baseCurve);
      filteredLenses = filteredLenses.filter(lens => {
        if (!lens.baseCurve) return false;
        const lensBc = parseFloat(lens.baseCurve);
        return Math.abs(lensBc - bcValue) <= 0.1; // 0.1 tolerance for base curve
      });
    }

    if (searchCriteria.diameter) {
      const diaValue = parseFloat(searchCriteria.diameter);
      filteredLenses = filteredLenses.filter(lens => {
        if (!lens.diameter) return false;
        const lensDia = parseFloat(lens.diameter);
        return Math.abs(lensDia - diaValue) <= 0.2; // 0.2 tolerance for diameter
      });
    }

    // Filter by contact lens type (NO TORIC, TORIC)
    if (searchCriteria.contactType && searchCriteria.contactType.trim()) {
      filteredLenses = filteredLenses.filter(lens => 
        lens.contactType && lens.contactType.toLowerCase() === searchCriteria.contactType.toLowerCase()
      );
    }

    // Filter by contact lens duration (DAILY, WEEKLY, MONTHLY, YEARLY)
    if (searchCriteria.duration && searchCriteria.duration.trim()) {
      filteredLenses = filteredLenses.filter(lens => 
        lens.duration && lens.duration.toLowerCase() === searchCriteria.duration.toLowerCase()
      );
    }

    // Filter by contact lens tint (CLEAR, COLOR)
    if (searchCriteria.tint && searchCriteria.tint.trim()) {
      filteredLenses = filteredLenses.filter(lens => 
        lens.tint && lens.tint.toLowerCase() === searchCriteria.tint.toLowerCase()
      );
    }

    // Filter by contact lens color
    if (searchCriteria.color && searchCriteria.color.trim()) {
      filteredLenses = filteredLenses.filter(lens => 
        lens.color && lens.color.toLowerCase() === searchCriteria.color.toLowerCase()
      );
    }

    // Sort by relevance (could be enhanced with better scoring)
    return filteredLenses.sort((a, b) => {
      // Sort by lens type first (prescription, then contact)
      if (a.type !== b.type) {
        if (a.type === 'prescription') return -1;
        if (b.type === 'prescription') return 1;
      }
      // Then by upload date (newer first)
      const aDate = new Date(a.uploadedAt || 0);
      const bDate = new Date(b.uploadedAt || 0);
      return bDate - aDate;
    });
  } catch (error) {
    console.error('Error searching lenses by specs:', error);
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
    return { isSharing: false };
  }
  
  try {
    const preferences = localStorage.getItem(`shopPreferences_${userUid}`);
    return preferences ? JSON.parse(preferences) : { isSharing: false };
  } catch (error) {
    console.error('Error getting shop preferences:', error);
    return { isSharing: false };
  }
};

// Set shop preferences (USER-SPECIFIC)
export const setShopPreferences = (preferences) => {
  const userUid = getUserUid();
  if (!userUid) {
    throw new Error('User not authenticated');
  }
  
  try {
    localStorage.setItem(`shopPreferences_${userUid}`, JSON.stringify({
      ...preferences,
      userId: userUid,
      updatedAt: dateToISOString(new Date())
    }));
  } catch (error) {
    console.error('Error setting shop preferences:', error);
    throw error;
  }
}; 
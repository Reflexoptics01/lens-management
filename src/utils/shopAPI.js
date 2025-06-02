const SHOP_API_BASE_URL = 'https://us-central1-reflex-64925.cloudfunctions.net';

// Get current user info for shop operations
const getCurrentUserInfo = () => {
  // This should be replaced with actual user authentication logic
  const userInfo = localStorage.getItem('userInfo');
  if (userInfo) {
    return JSON.parse(userInfo);
  }
  
  // Fallback - you should implement proper user authentication
  return {
    opticalName: 'Demo Optical Store',
    city: 'Demo City',
    phone: '+91XXXXXXXXXX',
    userId: 'demo-user-id'
  };
};

// Upload user's lenses to the centralized shop
export const uploadLensesToShop = async (lenses, userInfo) => {
  try {
    const lensesToUpload = lenses
      .filter(lens => lens.type === 'prescription' || lens.type === 'contact') // Only RX and Contact lenses
      .map(lens => ({
        ...lens,
        // Add user information
        userInfo: {
          opticalName: userInfo.opticalName,
          city: userInfo.city,
          phone: userInfo.phone,
          userId: userInfo.userId
        },
        // Add upload timestamp
        uploadedAt: new Date().toISOString(),
        // Create unique shop ID combining user ID and lens ID
        shopId: `${userInfo.userId}_${lens.id}`
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
    console.log('Successfully uploaded lenses to shop:', results);
    return results;
  } catch (error) {
    console.error('Error uploading lenses to shop:', error);
    throw error;
  }
};

// Remove user's lenses from the centralized shop
export const removeLensesFromShop = async (lenses, userInfo) => {
  try {
    const removePromises = lenses
      .filter(lens => lens.type === 'prescription' || lens.type === 'contact')
      .map(async (lens) => {
        const shopId = `${userInfo.userId}_${lens.id}`;
        
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
            console.log(`Lens ${lens.id} not found in shop, skipping...`);
            return { success: true, message: 'Not found, skipped' };
          }
          throw new Error(`Failed to remove lens ${lens.id}`);
        }

        return response.json();
      });

    const results = await Promise.all(removePromises);
    console.log('Successfully removed lenses from shop:', results);
    return results;
  } catch (error) {
    console.error('Error removing lenses from shop:', error);
    throw error;
  }
};

// Search for matching lenses in the centralized shop
export const searchMatchingLenses = async (prescriptionData) => {
  try {
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

    // Filter and match lenses using the same logic as local inventory
    const matchingLenses = findMatchingLenses(allShopLenses, prescriptionData);
    
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
    
    return factors > 0 ? Math.round((score / factors) * 100) : 0;
  };

  const matches = [];

  // Check right eye matches
  if (prescriptionData.rightSph) {
    lenses.forEach(lens => {
      if (lens.eye !== 'left' && lens.type === 'prescription') {
        // Check SPH match
        if (!lens.sph || !isWithinTolerance(lens.sph, prescriptionData.rightSph, SPH_TOLERANCE)) {
          return;
        }
        
        // Check CYL match
        if ((prescriptionData.rightCyl || lens.cyl) && 
            (!prescriptionData.rightCyl || !lens.cyl || !isWithinTolerance(lens.cyl, prescriptionData.rightCyl, CYL_TOLERANCE))) {
          return;
        }
        
        // Check AXIS match
        if (prescriptionData.rightCyl && lens.cyl) {
          if ((prescriptionData.rightAxis || lens.axis) && 
              (!prescriptionData.rightAxis || !lens.axis || !isAxisWithinTolerance(lens.axis, prescriptionData.rightAxis))) {
            return;
          }
        }
        
        // Check ADD match
        if ((prescriptionData.rightAdd || lens.add) && 
            (!prescriptionData.rightAdd || !lens.add || !isWithinTolerance(lens.add, prescriptionData.rightAdd, ADD_TOLERANCE))) {
          return;
        }
        
        matches.push({
          ...lens,
          matchedEye: 'right',
          matchQuality: calculateMatchQuality(
            lens, 
            prescriptionData.rightSph, 
            prescriptionData.rightCyl, 
            prescriptionData.rightAxis, 
            prescriptionData.rightAdd
          )
        });
      }
    });
  }

  // Check left eye matches
  if (prescriptionData.leftSph) {
    lenses.forEach(lens => {
      if (lens.eye !== 'right' && lens.type === 'prescription') {
        // Check SPH match
        if (!lens.sph || !isWithinTolerance(lens.sph, prescriptionData.leftSph, SPH_TOLERANCE)) {
          return;
        }
        
        // Check CYL match
        if ((prescriptionData.leftCyl || lens.cyl) && 
            (!prescriptionData.leftCyl || !lens.cyl || !isWithinTolerance(lens.cyl, prescriptionData.leftCyl, CYL_TOLERANCE))) {
          return;
        }
        
        // Check AXIS match
        if (prescriptionData.leftCyl && lens.cyl) {
          if ((prescriptionData.leftAxis || lens.axis) && 
              (!prescriptionData.leftAxis || !lens.axis || !isAxisWithinTolerance(lens.axis, prescriptionData.leftAxis))) {
            return;
          }
        }
        
        // Check ADD match
        if ((prescriptionData.leftAdd || lens.add) && 
            (!prescriptionData.leftAdd || !lens.add || !isWithinTolerance(lens.add, prescriptionData.leftAdd, ADD_TOLERANCE))) {
          return;
        }
        
        matches.push({
          ...lens,
          matchedEye: 'left',
          matchQuality: calculateMatchQuality(
            lens, 
            prescriptionData.leftSph, 
            prescriptionData.leftCyl, 
            prescriptionData.leftAxis, 
            prescriptionData.leftAdd
          )
        });
      }
    });
  }

  return matches.sort((a, b) => b.matchQuality - a.matchQuality);
};

// Get user's shop sharing preferences
export const getShopPreferences = () => {
  const prefs = localStorage.getItem('shopPreferences');
  return prefs ? JSON.parse(prefs) : { isSharing: false };
};

// Set user's shop sharing preferences
export const setShopPreferences = (preferences) => {
  localStorage.setItem('shopPreferences', JSON.stringify(preferences));
};

export { getCurrentUserInfo }; 
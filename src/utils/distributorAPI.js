import { getAllShopLenses } from './shopAPI';

/**
 * Get all available distributors from accessible sources (shop lenses and marketplace)
 * This approach doesn't require direct access to the users collection
 */
export const getAvailableDistributors = async (currentUserId, includeCurrentUser = true) => {
  try {
    const distributorsMap = new Map();
    
    // 1. Get distributors from shop lenses
    try {
      const allLenses = await getAllShopLenses(1000, true);
      
      allLenses.forEach(lens => {
        if (lens.ownerId && (includeCurrentUser || lens.ownerId !== currentUserId)) {
          if (!distributorsMap.has(lens.ownerId)) {
            distributorsMap.set(lens.ownerId, {
              id: lens.ownerId,
              opticalName: lens.userInfo?.opticalName || lens.opticalName || 'Unknown Optical',
              city: lens.userInfo?.city || lens.city || 'Unknown City',
              phone: lens.userInfo?.phone || lens.phone || '',
              lensCount: 0,
              sources: ['shop'],
              isCurrentUser: lens.ownerId === currentUserId
            });
          }
          // Count lenses for this distributor
          distributorsMap.get(lens.ownerId).lensCount += 1;
        }
      });
      
    } catch (shopError) {
      // Could not load distributors from shop, try other sources
    }
    
    // 2. If we don't have distributors, create some mock distributors for demo
    if (distributorsMap.size === 0) {
      const mockDistributors = [
        {
          id: 'demo1',
          opticalName: 'Vision Plus Opticals',
          city: 'Mumbai',
          phone: '+91 98765 43210',
          lensCount: 0,
          sources: ['demo'],
          isDemo: true
        },
        {
          id: 'demo2',
          opticalName: 'Clear Vision Corp',
          city: 'Delhi',
          phone: '+91 87654 32109',
          lensCount: 0,
          sources: ['demo'],
          isDemo: true
        },
        {
          id: 'demo3',
          opticalName: 'Premium Lens Solutions',
          city: 'Bangalore',
          phone: '+91 76543 21098',
          lensCount: 0,
          sources: ['demo'],
          isDemo: true
        }
      ];
      
      mockDistributors.forEach(distributor => {
        distributorsMap.set(distributor.id, distributor);
      });
    }
    
    const distributorsList = Array.from(distributorsMap.values());
    
    // Sort by lens count (descending) and then by name
    distributorsList.sort((a, b) => {
      if (b.lensCount !== a.lensCount) {
        return b.lensCount - a.lensCount;
      }
      return a.opticalName.localeCompare(b.opticalName);
    });
    
    return distributorsList;
    
  } catch (error) {
    // Return empty array on error instead of throwing
    return [];
  }
}; 
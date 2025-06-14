/**
 * Utility functions for handling dates and timestamps
 * Used for consistent date handling across the application, especially for backup/restore
 */

// Convert a Firestore timestamp or JavaScript Date to an ISO string
export const dateToISOString = (date) => {
  if (!date) return null;
  
  // Handle Firestore Timestamp
  if (date && typeof date.toDate === 'function') {
    return date.toDate().toISOString();
  }
  
  // Handle JavaScript Date
  if (date instanceof Date) {
    return date.toISOString();
  }
  
  // Try to convert string to date if it's not already a date
  if (typeof date === 'string') {
    try {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        return parsedDate.toISOString();
      }
    } catch (error) {
      console.warn('Failed to parse date string:', date);
    }
  }
  
  // Return original value if we can't convert it
  return date;
};

// Format a date for display (e.g., "15 Jan 2023")
export const formatDate = (date) => {
  if (!date) return '';
  
  try {
    // Convert Firestore timestamp to JS Date if needed
    const jsDate = typeof date.toDate === 'function' ? date.toDate() : date;
    
    // If it's a string, try to parse it
    const finalDate = typeof jsDate === 'string' ? new Date(jsDate) : jsDate;
    
    // Format the date
    return finalDate instanceof Date && !isNaN(finalDate.getTime())
      ? finalDate.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric' 
        })
      : '';
  } catch (error) {
    console.warn('Error formatting date:', error);
    return '';
  }
};

// Format a date and time for display (e.g., "15 Jan 2023, 14:30")
export const formatDateTime = (date) => {
  if (!date) return '';
  
  try {
    // Convert Firestore timestamp to JS Date if needed
    const jsDate = typeof date.toDate === 'function' ? date.toDate() : date;
    
    // If it's a string, try to parse it
    const finalDate = typeof jsDate === 'string' ? new Date(jsDate) : jsDate;
    
    // Format the date and time
    return finalDate instanceof Date && !isNaN(finalDate.getTime())
      ? finalDate.toLocaleDateString('en-GB', { 
          day: 'numeric', 
          month: 'short', 
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : '';
  } catch (error) {
    console.warn('Error formatting datetime:', error);
    return '';
  }
};

// Process restored data to handle dates consistently
export const processRestoredData = (data) => {
  // If data is null or not an object, return as is
  if (!data || typeof data !== 'object') return data;
  
  // If data is an array, process each element
  if (Array.isArray(data)) {
    return data.map(item => processRestoredData(item));
  }
  
  // Process each property in the object
  const processed = {};
  for (const [key, value] of Object.entries(data)) {
    // Handle special timestamp format
    if (value && typeof value === 'object' && value.__type === 'timestamp') {
      try {
        // Convert to JavaScript Date
        processed[key] = new Date(value.value);
      } catch (error) {
        processed[key] = value.value; // Store as string if conversion fails
      }
    }
    // Handle Firebase Timestamp-like objects (from restored backup)
    else if (value && typeof value === 'object' && 
             value.seconds !== undefined && value.nanoseconds !== undefined) {
      try {
        // Convert Firestore Timestamp-like object to Date
        processed[key] = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
      } catch (error) {
        processed[key] = null;
      }
    } 
    // Special handling for powerInventory data structure
    else if (key === 'powerInventory' && value && typeof value === 'object') {
      processed[key] = {};
      // PowerInventory has keys like "-5.5_-1.75" with values like {sph: -5.5, cyl: -1.75, quantity: 1}
      for (const [powerKey, powerData] of Object.entries(value)) {
        if (powerData && typeof powerData === 'object') {
          processed[key][powerKey] = {
            sph: typeof powerData.sph === 'number' ? powerData.sph : parseFloat(powerData.sph) || 0,
            cyl: typeof powerData.cyl === 'number' ? powerData.cyl : parseFloat(powerData.cyl) || 0,
            quantity: typeof powerData.quantity === 'number' ? powerData.quantity : parseInt(powerData.quantity) || 0
          };
        } else {
          processed[key][powerKey] = powerData;
        }
      }
    }
    // Special handling for powerLimits data structure  
    else if (key === 'powerLimits' && value && typeof value === 'object') {
      processed[key] = {
        minSph: typeof value.minSph === 'number' ? value.minSph : parseFloat(value.minSph) || 0,
        maxSph: typeof value.maxSph === 'number' ? value.maxSph : parseFloat(value.maxSph) || 0,
        minCyl: typeof value.minCyl === 'number' ? value.minCyl : parseFloat(value.minCyl) || 0,
        maxCyl: typeof value.maxCyl === 'number' ? value.maxCyl : parseFloat(value.maxCyl) || 0,
        addition: typeof value.addition === 'number' ? value.addition : parseFloat(value.addition) || 0,
        axis: typeof value.axis === 'number' ? value.axis : parseInt(value.axis) || 0
      };
    }
    // Ensure numeric fields are properly converted for lens data
    else if ((key === 'maxSph' || key === 'maxCyl' || key === 'sph' || key === 'cyl' || 
              key === 'add' || key === 'purchasePrice' || key === 'salePrice') && 
             value !== null && value !== undefined && value !== '') {
      const numValue = typeof value === 'number' ? value : parseFloat(value);
      processed[key] = isNaN(numValue) ? value : numValue;
    }
    // Ensure integer fields are properly converted
    else if ((key === 'qty' || key === 'axis' || key === 'totalQuantity') && 
             value !== null && value !== undefined && value !== '') {
      const intValue = typeof value === 'number' ? value : parseInt(value);
      processed[key] = isNaN(intValue) ? value : intValue;
    }
    // Handle date-related fields that might be timestamp objects
    else if ((key === 'createdAt' || key === 'updatedAt' || key.includes('Date') || key.includes('At')) &&
             value && typeof value === 'object' && 
             value.seconds !== undefined && value.nanoseconds !== undefined) {
      try {
        // Convert Firestore Timestamp-like object to Date for date fields
        processed[key] = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
      } catch (error) {
        processed[key] = null;
      }
    }
    // Handle nested objects (but check for timestamp patterns first)
    else if (value && typeof value === 'object') {
      // Additional check for any object that might be a timestamp
      if (value.seconds !== undefined && value.nanoseconds !== undefined) {
        try {
          processed[key] = new Date(value.seconds * 1000 + value.nanoseconds / 1000000);
        } catch (error) {
          processed[key] = processRestoredData(value);
        }
      } else {
        processed[key] = processRestoredData(value);
      }
    } 
    // Handle ISO date strings (for older backups that don't use the __type format)
    else if (
      typeof value === 'string' && 
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/.test(value)
    ) {
      try {
        const possibleDate = new Date(value);
        // Only convert if it's a valid date and not just a string that happens to match the pattern
        if (!isNaN(possibleDate.getTime())) {
          processed[key] = possibleDate;
        } else {
          processed[key] = value;
        }
      } catch (error) {
        processed[key] = value; // Keep as string if conversion fails
      }
    } else {
      processed[key] = value;
    }
  }
  
  return processed;
};

// Safely handle and convert any date format
export const safelyParseDate = (date) => {
  if (!date) return null;
  
  try {
    // If it's a Firestore timestamp
    if (date && typeof date.toDate === 'function') {
      return date.toDate();
    }
    
    // If it's already a JavaScript Date
    if (date instanceof Date) {
      return date;
    }
    
    // If it's a string, try to parse it
    if (typeof date === 'string') {
      // Handle special format from backup
      if (date.includes('__type') && date.includes('timestamp')) {
        try {
          const parsed = JSON.parse(date);
          return new Date(parsed.value);
        } catch {
          // If parsing fails, try as regular date string
          return new Date(date);
        }
      }
      
      // Regular date string
      return new Date(date);
    }
    
    // If it's a number (timestamp in milliseconds)
    if (typeof date === 'number') {
      return new Date(date);
    }
    
    // Handle cases where date is an object (potentially serialized Timestamp)
    if (typeof date === 'object') {
      // Check if it has properties consistent with a serialized timestamp
      if (date.__type === 'timestamp' && date.value) {
        return new Date(date.value);
      }
      
      // Check if it has seconds and nanoseconds (Firestore Timestamp structure)
      if (date.seconds !== undefined && date.nanoseconds !== undefined) {
        // Convert Firestore Timestamp-like object to Date
        return new Date(date.seconds * 1000 + date.nanoseconds / 1000000);
      }
      
      // If it has a date or time property, try using those
      if (date.date) return new Date(date.date);
      if (date.time) return new Date(date.time);
    }
    
    // For other cases, return null
    return null;
  } catch (error) {
    return null;
  }
};

// Get current financial year in format "YYYY-YYYY"
export const getCurrentFinancialYear = () => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed, 0 = January
  
  // In India, financial year is from April 1 to March 31
  // If we're before April, financial year is previous year to current year
  // If we're April or after, financial year is current year to next year
  if (currentMonth < 3) { // Before April (Jan, Feb, Mar are 0, 1, 2)
    return `${currentYear-1}-${currentYear}`;
  } else {
    return `${currentYear}-${currentYear+1}`;
  }
};

// Alias for formatDate (backward compatibility)
export const displayDate = formatDate;

// Alias for formatDate (backward compatibility) 
export const formatFieldForDisplay = formatDate;

// Process form data to ensure dates are handled properly
export const processFormData = (data) => {
  if (!data || typeof data !== 'object') return data;
  
  const processed = { ...data };
  
  // Convert any date fields to proper format
  Object.keys(processed).forEach(key => {
    const value = processed[key];
    
    // If the field name suggests it's a date, try to process it
    if ((key.toLowerCase().includes('date') || 
         key.toLowerCase().includes('time') || 
         key === 'createdAt' || 
         key === 'updatedAt') && value) {
      const parsedDate = safelyParseDate(value);
      if (parsedDate) {
        processed[key] = parsedDate;
      }
    }
  });
  
  return processed;
}; 
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
        console.warn(`Failed to convert timestamp for key ${key}:`, error);
        processed[key] = value.value; // Store as string if conversion fails
      }
    } 
    // Handle nested objects
    else if (value && typeof value === 'object') {
      processed[key] = processRestoredData(value);
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
    console.warn('Unable to parse date format:', date);
    return null;
  } catch (error) {
    console.warn('Error parsing date:', error, 'Original value:', date);
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
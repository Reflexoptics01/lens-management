import React, { useEffect } from 'react';

// Import comprehensive timestamp handling functions
const isFirestoreTimestamp = (value) => {
  return value && typeof value === 'object' && typeof value.toDate === 'function';
};

const isISODateString = (value) => {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value);
};

const convertToDate = (value) => {
  if (!value) return null;
  
  try {
    // Handle Firestore Timestamp objects
    if (isFirestoreTimestamp(value)) {
      return value.toDate();
    } 
    
    // Handle ISO date strings (from backup/restore)
    if (isISODateString(value)) {
      return new Date(value);
    } 
    
    // Handle Date objects
    if (value instanceof Date) {
      return value;
    }
    
    // Handle timestamp objects with seconds/nanoseconds (backup/restore format)
    if (typeof value === 'object' && value.seconds) {
      return new Date(value.seconds * 1000 + (value.nanoseconds || 0) / 1000000);
    }
    
    // Handle timestamp objects with _seconds/_nanoseconds (backup/restore format)
    if (typeof value === 'object' && value._seconds) {
      return new Date(value._seconds * 1000 + (value._nanoseconds || 0) / 1000000);
    }
    
    // Handle numeric timestamps (milliseconds)
    if (typeof value === 'number') {
      return new Date(value);
    }
    
    // Handle string timestamps that might be numbers
    if (typeof value === 'string' && !isNaN(parseInt(value))) {
      const num = parseInt(value);
      // Check if it's seconds (less than year 2100) or milliseconds
      if (num < 4102444800) { // Year 2100 in seconds
        return new Date(num * 1000);
      } else {
        return new Date(num);
      }
    }
    
    // Handle regular date strings
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error converting timestamp:', error, value);
    return null;
  }
};

const StickerPrint = ({ order, eye = 'right' }) => {
  // Helper function to safely extract string values and handle timestamp objects
  const safeExtractValue = (value, defaultValue = '') => {
    // If it's a timestamp object, convert to appropriate default
    if (value && typeof value === 'object' && value.seconds !== undefined && value.nanoseconds !== undefined) {
      console.warn('Found timestamp object in StickerPrint, converting to default:', value);
      return defaultValue;
    }
    
    // Return the value as string, or default if null/undefined
    return value !== null && value !== undefined ? String(value) : defaultValue;
  };

  // Determine which eye's data to use with safe extraction
  const sph = safeExtractValue(eye === 'right' ? order.rightSph : order.leftSph, '0.00');
  const cyl = safeExtractValue(eye === 'right' ? order.rightCyl : order.leftCyl, '0.00');
  const axis = safeExtractValue(eye === 'right' ? order.rightAxis : order.leftAxis, '0');
  const add = safeExtractValue(eye === 'right' ? order.rightAdd : order.leftAdd, '0.00');
  
  // Debug log the date value when component mounts
  useEffect(() => {
    console.log('Order in StickerPrint:', order);
    console.log('CreatedAt type:', order.createdAt ? typeof order.createdAt : 'undefined');
    console.log('CreatedAt value:', order.createdAt);
  }, [order]);
  
  // Format date for display
  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    
    try {
      // Convert to proper Date object first
      const dateObject = convertToDate(dateValue);
      
      if (!dateObject) return 'N/A';
      
      // Format the date
      return dateObject.toLocaleDateString('en-IN', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric' 
      });
    } catch (error) {
      console.error('Error formatting date:', error, dateValue);
      return 'N/A';
    }
  };
  
  // Get lens details as a string
  const getLensDetails = () => {
    const details = [];
    const material = safeExtractValue(order.material);
    const lensType = safeExtractValue(order.lensType);
    const coatingType = safeExtractValue(order.coatingType);
    const coatingColour = safeExtractValue(order.coatingColour);
    const index = safeExtractValue(order.index);
    const baseTint = safeExtractValue(order.baseTint);
    
    if (material) details.push(material);
    if (lensType) details.push(lensType);
    if (coatingType) {
      details.push(coatingType + (coatingColour ? ` ${coatingColour}` : ''));
    }
    if (index) details.push(`IDX: ${index}`);
    if (baseTint && baseTint !== 'WHITE') details.push(`TINT: ${baseTint}`);
    
    return details.join(' | ');
  };
  
  return (
    <div className="sticker-container" style={{
      width: '3in',
      height: '2in',
      border: '1px dashed #ccc',
      padding: '0.125in',
      position: 'relative',
      pageBreakInside: 'avoid',
      pageBreakAfter: 'always',
      boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif',
      fontSize: '8pt',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header row with order ID and date */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '0.1in',
        fontSize: '7pt'
      }}>
        <div style={{ fontWeight: 'bold' }}>
          #{safeExtractValue(order.displayId, 'N/A')}
        </div>
        <div>
          {formatDate(order.createdAt)}
        </div>
      </div>
      
      {/* Brand name */}
      <div style={{ 
        textAlign: 'center', 
        fontWeight: 'bold',
        marginBottom: '0.05in',
        fontSize: '9pt'
      }}>
        {safeExtractValue(order.brandName, 'N/A')}
      </div>
      
      {/* Lens details */}
      <div style={{ 
        textAlign: 'center', 
        marginBottom: '0.1in',
        fontSize: '7pt',
        lineHeight: 1.2
      }}>
        {getLensDetails()}
      </div>
      
      {/* Eye identifier */}
      <div style={{ 
        fontWeight: 'bold', 
        marginBottom: '0.05in',
        fontSize: '9pt'
      }}>
        {eye === 'right' ? 'R.E' : 'L.E'}
      </div>
      
      {/* Prescription table */}
      <table style={{ 
        width: '100%', 
        borderCollapse: 'collapse',
        border: '1px solid black',
        fontSize: '8pt'
      }}>
        <thead>
          <tr>
            <th style={{ border: '1px solid black', padding: '0.05in', width: '25%' }}>SPH</th>
            <th style={{ border: '1px solid black', padding: '0.05in', width: '25%' }}>CYL</th>
            <th style={{ border: '1px solid black', padding: '0.05in', width: '25%' }}>AXIS</th>
            <th style={{ border: '1px solid black', padding: '0.05in', width: '25%' }}>ADD</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={{ border: '1px solid black', padding: '0.05in', textAlign: 'center' }}>{sph}</td>
            <td style={{ border: '1px solid black', padding: '0.05in', textAlign: 'center' }}>{cyl}</td>
            <td style={{ border: '1px solid black', padding: '0.05in', textAlign: 'center' }}>{axis}</td>
            <td style={{ border: '1px solid black', padding: '0.05in', textAlign: 'center' }}>{add}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default StickerPrint; 
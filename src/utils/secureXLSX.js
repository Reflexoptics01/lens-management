// Secure XLSX wrapper to mitigate prototype pollution and ReDoS vulnerabilities
import * as XLSX from 'xlsx';

/**
 * Secure object creation to prevent prototype pollution
 */
const createSecureObject = (data = {}) => {
  const obj = Object.create(null);
  if (data && typeof data === 'object') {
    for (const [key, value] of Object.entries(data)) {
      // Sanitize key names to prevent prototype pollution
      if (typeof key === 'string' && 
          !key.includes('__proto__') && 
          !key.includes('constructor') && 
          !key.includes('prototype') &&
          key.length < 100) { // Prevent ReDoS with long keys
        obj[key] = value;
      }
    }
  }
  return obj;
};

/**
 * Sanitize filename to prevent path traversal
 */
const sanitizeFilename = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return 'export.xlsx';
  }
  
  // Remove path separators and dangerous characters
  return filename
    .replace(/[/\\:*?"<>|]/g, '_')
    .replace(/\.\./g, '_')
    .substring(0, 100); // Limit length
};

/**
 * Sanitize worksheet data to prevent injection
 */
const sanitizeWorksheetData = (data) => {
  if (!Array.isArray(data)) {
    return [];
  }
  
  return data.map(row => {
    if (!row || typeof row !== 'object') {
      return {};
    }
    
    const sanitizedRow = createSecureObject();
    
    for (const [key, value] of Object.entries(row)) {
      // Sanitize cell values to prevent formula injection
      let sanitizedValue = value;
      
      if (typeof value === 'string') {
        // Prevent formula injection by escaping formulas
        if (value.startsWith('=') || value.startsWith('+') || value.startsWith('-') || value.startsWith('@')) {
          sanitizedValue = `'${value}`;
        }
        
        // Limit string length to prevent ReDoS
        if (value.length > 1000) {
          sanitizedValue = value.substring(0, 1000) + '...';
        }
      }
      
      sanitizedRow[key] = sanitizedValue;
    }
    
    return sanitizedRow;
  });
};

/**
 * Secure XLSX read function
 */
export const secureReadFile = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    try {
      // Validate file type
      if (!file || !file.name) {
        reject(new Error('Invalid file'));
        return;
      }
      
      const allowedExtensions = ['.xlsx', '.xls', '.csv'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!allowedExtensions.includes(fileExtension)) {
        reject(new Error('File type not allowed. Only Excel and CSV files are permitted.'));
        return;
      }
      
      // Limit file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        reject(new Error('File too large. Maximum size is 10MB.'));
        return;
      }
      
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { 
            type: 'array',
            ...options,
            // Security options
            cellFormula: false, // Disable formula parsing
            cellHTML: false,    // Disable HTML parsing
            cellNF: false,      // Disable number format parsing
            cellText: false,    // Disable text parsing extensions
            bookSheets: true,   // Only read sheet names
            bookProps: false,   // Don't read workbook properties
            sheetRows: 1000     // Limit rows to prevent memory exhaustion
          });
          
          // Sanitize the workbook data
          const sanitizedWorkbook = {
            SheetNames: workbook.SheetNames.slice(0, 10), // Limit sheets
            Sheets: createSecureObject()
          };
          
          // Process each sheet safely
          workbook.SheetNames.slice(0, 10).forEach(sheetName => {
            if (workbook.Sheets[sheetName]) {
              const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
                ...options,
                raw: false, // Get formatted values, not raw
                defval: '',  // Default value for empty cells
                header: 1    // Use first row as header
              });
              
              sanitizedWorkbook.Sheets[sheetName] = sanitizeWorksheetData(jsonData);
            }
          });
          
          resolve(sanitizedWorkbook);
        } catch (error) {
          reject(new Error(`Failed to parse Excel file: ${error.message}`));
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsArrayBuffer(file);
    } catch (error) {
      reject(new Error(`File processing error: ${error.message}`));
    }
  });
};

/**
 * Secure XLSX write function
 */
export const secureWriteFile = (data, filename, options = {}) => {
  try {
    const sanitizedFilename = sanitizeFilename(filename);
    const sanitizedData = sanitizeWorksheetData(data);
    
    // Create workbook with security constraints
    const workbook = XLSX.utils.book_new();
    
    // Limit the number of rows and columns
    const maxRows = 50000;
    const maxCols = 100;
    
    const limitedData = sanitizedData.slice(0, maxRows);
    
    // Create worksheet
    const worksheet = XLSX.utils.json_to_sheet(limitedData, {
      ...options,
      // Security options
      cellFormula: false,
      skipHeader: false
    });
    
    // Limit worksheet range
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:A1');
    if (range.e.c > maxCols) {
      range.e.c = maxCols;
      worksheet['!ref'] = XLSX.utils.encode_range(range);
    }
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    
    // Write file with security options
    XLSX.writeFile(workbook, sanitizedFilename, {
      ...options,
      cellFormula: false,
      cellHTML: false,
      cellNF: false
    });
    
    return true;
  } catch (error) {
    console.error('Secure XLSX write error:', error);
    throw new Error(`Failed to create Excel file: ${error.message}`);
  }
};

/**
 * Create secure template file
 */
export const createSecureTemplate = (headers, filename) => {
  try {
    const sanitizedHeaders = headers.filter(h => 
      typeof h === 'string' && 
      h.length > 0 && 
      h.length < 100 &&
      !h.includes('__proto__') &&
      !h.includes('constructor')
    ).slice(0, 50); // Limit number of headers
    
    const templateData = [sanitizedHeaders];
    return secureWriteFile(templateData, filename);
  } catch (error) {
    console.error('Template creation error:', error);
    throw new Error(`Failed to create template: ${error.message}`);
  }
};

export default {
  secureReadFile,
  secureWriteFile,
  createSecureTemplate
}; 
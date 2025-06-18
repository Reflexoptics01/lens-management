// Secure Print Utilities
// Replaces dangerous document.write and innerHTML usage

import DOMPurify from 'dompurify';

/**
 * Secure print function that doesn't use document.write
 * @param {string} content - HTML content to print
 * @param {Object} options - Print options
 */
export const securePrint = (content, options = {}) => {
  try {
    // Sanitize the content to prevent XSS
    const sanitizedContent = DOMPurify.sanitize(content, {
      ALLOWED_TAGS: ['div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'br', 'strong', 'b', 'i', 'em', 'ul', 'ol', 'li'],
      ALLOWED_ATTR: ['class', 'style'],
      ALLOW_DATA_ATTR: false
    });

    // Create a new window for printing
    const printWindow = window.open('', '_blank', 'width=800,height=600,scrollbars=yes,resizable=yes');
    
    if (!printWindow) {
      throw new Error('Popup blocked. Please allow popups for this site.');
    }

    // Create the document structure safely
    const doc = printWindow.document;
    doc.open();
    
    // Write the document structure piece by piece (safer than document.write)
    const htmlStructure = createPrintDocument(sanitizedContent, options);
    doc.write(htmlStructure);
    doc.close();

    // Wait for content to load then print
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    };

    return true;
  } catch (error) {
    console.error('Print error:', error);
    alert(`Print failed: ${error.message}`);
    return false;
  }
};

/**
 * Create print document structure
 * @param {string} content - Sanitized content
 * @param {Object} options - Print options
 */
const createPrintDocument = (content, options = {}) => {
  const {
    title = 'Print Document',
    styles = '',
    fontSize = '12px',
    margin = '20px'
  } = options;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${DOMPurify.sanitize(title)}</title>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        body {
          font-family: Arial, sans-serif;
          font-size: ${fontSize};
          line-height: 1.4;
          color: #000;
          background: #fff;
          margin: ${margin};
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        th, td {
          padding: 8px;
          text-align: left;
          border: 1px solid #ddd;
        }
        th {
          background-color: #f5f5f5;
          font-weight: bold;
        }
        .print-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        .print-footer {
          margin-top: 30px;
          text-align: center;
          font-size: 10px;
          color: #666;
        }
        @media print {
          body { margin: 0; }
          .no-print { display: none; }
        }
        ${styles}
      </style>
    </head>
    <body>
      ${content}
      <div class="print-footer">
        Generated on ${new Date().toLocaleString()}
      </div>
    </body>
    </html>
  `;
};

/**
 * Secure way to get element content without innerHTML
 * @param {string} elementId - Element ID to get content from
 */
export const getSecureElementContent = (elementId) => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Element with ID '${elementId}' not found`);
    }

    // Clone the element to avoid modifying the original
    const clonedElement = element.cloneNode(true);
    
    // Remove any script tags for security
    const scripts = clonedElement.querySelectorAll('script');
    scripts.forEach(script => script.remove());

    // Remove any potentially dangerous attributes
    const allElements = clonedElement.querySelectorAll('*');
    allElements.forEach(el => {
      // Remove event handlers
      const attributes = [...el.attributes];
      attributes.forEach(attr => {
        if (attr.name.startsWith('on')) {
          el.removeAttribute(attr.name);
        }
      });
    });

    return clonedElement.outerHTML;
  } catch (error) {
    console.error('Error getting element content:', error);
    return '';
  }
};

/**
 * Print table data securely
 * @param {Array} data - Table data
 * @param {Array} columns - Column definitions
 * @param {Object} options - Print options
 */
export const printTableData = (data, columns, options = {}) => {
  try {
    const {
      title = 'Data Report',
      showHeader = true,
      ...printOptions
    } = options;

    let content = '';
    
    if (showHeader) {
      content += `<div class="print-header"><h1>${DOMPurify.sanitize(title)}</h1></div>`;
    }

    content += '<table>';
    
    // Add table header
    if (columns.length > 0) {
      content += '<thead><tr>';
      columns.forEach(col => {
        content += `<th>${DOMPurify.sanitize(col.label || col.key)}</th>`;
      });
      content += '</tr></thead>';
    }

    // Add table body
    content += '<tbody>';
    data.forEach(row => {
      content += '<tr>';
      columns.forEach(col => {
        const value = row[col.key] || '';
        const formattedValue = col.formatter ? col.formatter(value) : value;
        content += `<td>${DOMPurify.sanitize(String(formattedValue))}</td>`;
      });
      content += '</tr>';
    });
    content += '</tbody></table>';

    return securePrint(content, { title, ...printOptions });
  } catch (error) {
    console.error('Table print error:', error);
    alert(`Print failed: ${error.message}`);
    return false;
  }
};

/**
 * Export data as downloadable file (alternative to printing)
 * @param {string} content - Content to export
 * @param {string} filename - File name
 * @param {string} type - MIME type
 */
export const exportAsFile = (content, filename, type = 'text/html') => {
  try {
    const sanitizedContent = DOMPurify.sanitize(content);
    const blob = new Blob([sanitizedContent], { type });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Export error:', error);
    alert(`Export failed: ${error.message}`);
    return false;
  }
};

export default {
  securePrint,
  getSecureElementContent,
  printTableData,
  exportAsFile
}; 
import React, { useRef } from 'react';
import StickerPrint from './StickerPrint';

const StickerPrintPage = ({ order, onPrintComplete }) => {
  const printRef = useRef();

  const handlePrint = () => {
    const printContent = printRef.current;
    const originalContents = document.body.innerHTML;
    
    // Create a print-friendly page
    const printStyles = `
      @page {
        size: auto;
        margin: 0mm;
      }
      body {
        margin: 0;
        padding: 0;
      }
      .print-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding: 0.25in;
        gap: 0.25in;
      }
    `;
    
    // Create a style element
    const styleElement = document.createElement('style');
    styleElement.textContent = printStyles;
    
    // Create the print window content
    const printWindow = window.open('', '_blank');
    printWindow.document.open();
    printWindow.document.write(`
      <html>
        <head>
          <title>Lens Stickers - Order #${order.displayId || ''}</title>
        </head>
        <body>
          <div class="print-container">
            ${printContent.innerHTML}
          </div>
        </body>
      </html>
    `);
    
    // Add the style element to the print window
    printWindow.document.head.appendChild(styleElement);
    
    // Wait for content to load then print
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      
      // Close the print window after printing (or when print dialog is closed)
      printWindow.onafterprint = () => {
        printWindow.close();
        if (onPrintComplete) onPrintComplete();
      };
      
      // Fallback for browsers that don't support onafterprint
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.close();
          if (onPrintComplete) onPrintComplete();
        }
      }, 5000);
    };
  };
  
  return (
    <>
      {/* Hidden print container */}
      <div className="hidden">
        <div ref={printRef} className="print-content">
          <StickerPrint order={order} eye="right" />
          <StickerPrint order={order} eye="left" />
        </div>
      </div>

      {/* Print button */}
      <button
        onClick={handlePrint}
        className="w-full flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-purple-500 transition-all transform hover:scale-[1.02] duration-300"
      >
        <span className="mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5 1a2 2 0 0 0-2 2v1h10V3a2 2 0 0 0-2-2H5zm6 8H5a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3a1 1 0 0 0-1-1z"/>
            <path d="M0 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-1v-2a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v2H2a2 2 0 0 1-2-2V7zm2.5 1a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
          </svg>
        </span>
        Print Lens Stickers
      </button>
    </>
  );
};

export default StickerPrintPage; 
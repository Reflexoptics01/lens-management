import React from 'react';
import { createPortal } from 'react-dom';
import FallbackInvoicePrint from './FallbackInvoicePrint';

const PrintInvoiceModal = ({ isOpen, onClose, saleId, title }) => {
  // Don't render anything if the modal is not open
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 overflow-y-auto z-50">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75 dark:opacity-85"></div>
        </div>
        
        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white dark:bg-gray-800 p-6">
            {/* Directly render the FallbackInvoicePrint component */}
            <FallbackInvoicePrint saleId={saleId} onClose={onClose} />
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default PrintInvoiceModal; 
import React from 'react';
import { createPortal } from 'react-dom';
import FallbackInvoicePrint from './FallbackInvoicePrint';

const PrintInvoiceModal = ({ isOpen, onClose, saleId, title }) => {
  // Don't render anything if the modal is not open
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 overflow-y-auto z-50 print-modal-container">
      <style>
        {`
          /* Force light theme for print modal regardless of dark mode */
          .print-modal-container,
          .print-modal-container * {
            color-scheme: light !important;
          }
          
          .print-modal-container .dark\\:bg-gray-900,
          .print-modal-container .dark\\:bg-gray-800,
          .print-modal-container .dark\\:bg-gray-700 {
            background-color: white !important;
          }
          
          .print-modal-container .dark\\:text-white,
          .print-modal-container .dark\\:text-gray-300,
          .print-modal-container .dark\\:text-gray-400 {
            color: #374151 !important;
          }
          
          .print-modal-container .dark\\:border-gray-600,
          .print-modal-container .dark\\:border-gray-700 {
            border-color: #d1d5db !important;
          }
        `}
      </style>
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity" 
          aria-hidden="true"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>
        
        {/* Modal panel - force white background */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white p-6">
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
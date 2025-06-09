import React from 'react';
import { useNavigate } from 'react-router-dom';

const ShopButton = () => {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate('/shop')}
      className="fixed bottom-20 sm:bottom-6 right-4 w-14 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:scale-110 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:focus:ring-blue-800 transition-all duration-300 z-40 group"
      title="Browse Reflex Shop - Find lenses from other distributors"
    >
      <div className="flex items-center justify-center">
        <svg 
          className="w-6 h-6" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="2" 
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" 
          />
        </svg>
      </div>
      
      {/* Tooltip */}
      <div className="absolute bottom-16 right-0 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 whitespace-nowrap shadow-lg">
        <div className="relative">
          Reflex Shop
          <div className="absolute top-full right-4 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800 dark:border-t-gray-700"></div>
        </div>
      </div>
      
      {/* Pulse animation ring */}
      <div className="absolute inset-0 rounded-full bg-blue-600 opacity-20 animate-ping"></div>
    </button>
  );
};

export default ShopButton; 
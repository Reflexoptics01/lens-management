import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const FloatingShopIcon = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Only show on specific pages
  const allowedPaths = ['/orders', '/sales', '/purchases'];
  const shouldShow = allowedPaths.includes(location.pathname);
  
  if (!shouldShow) {
    return null;
  }
  
  const handleMarketplaceClick = () => {
    navigate('/marketplace');
  };
  
  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={handleMarketplaceClick}
        className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 group"
        title="Open Reflex Marketplace - Connect with distributors and find lenses"
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
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" 
            />
          </svg>
        </div>
        
        {/* Tooltip */}
        <div className="absolute bottom-full right-0 mb-2 px-3 py-1 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap">
          Reflex Marketplace
          <div className="absolute top-full right-4 w-0 h-0 border-l-2 border-r-2 border-t-4 border-transparent border-t-gray-900"></div>
        </div>
        
        {/* Pulse animation */}
        <div className="absolute inset-0 rounded-full bg-blue-400 animate-ping opacity-20"></div>
      </button>
    </div>
  );
};

export default FloatingShopIcon; 
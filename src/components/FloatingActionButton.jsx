import React from 'react';

const FloatingActionButton = ({ onClick, icon, label }) => {
  return (
    <button 
      onClick={onClick}
      className="mobile-fab"
      aria-label={label || "Action"}
    >
      {icon || (
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
            d="M12 4v16m8-8H4" 
          />
        </svg>
      )}
    </button>
  );
};

export default FloatingActionButton; 
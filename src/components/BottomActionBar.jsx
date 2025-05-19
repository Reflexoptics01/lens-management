import React from 'react';

/**
 * BottomActionBar component
 * Renders a fixed or sticky action bar at the bottom of the screen
 * that won't be hidden by the bottom navigation bar
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - Content to render in the action bar
 * @param {boolean} props.fixed - Whether the bar should be fixed position (true) or sticky (false)
 * @param {string} props.className - Additional CSS classes to apply
 * @param {string} props.bgColor - Background color class (defaults to 'bg-white')
 */
const BottomActionBar = ({ 
  children, 
  fixed = false, 
  className = '', 
  bgColor = 'bg-white' 
}) => {
  const baseClasses = `${bgColor} px-4 py-3 border-t border-gray-200 shadow-lg z-40`;
  
  // Adjust positioning to account for navigation bar
  const positionClass = fixed 
    ? 'fixed bottom-0 left-0 right-0 mb-[65px]' // Use 65px to match new nav height
    : 'sticky bottom-0 -mx-4 mb-[65px]'; // Use 65px to match new nav height
  
  return (
    <div className={`${baseClasses} ${positionClass} ${className} safe-area-bottom`}>
      {children}
    </div>
  );
};

export default BottomActionBar; 
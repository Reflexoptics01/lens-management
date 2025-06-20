import React from 'react';

const ThemeToggle = ({ className = '' }) => {
  // Simple static theme toggle - always shows light theme
  return (
    <button
      className={`theme-toggle p-2 rounded-lg transition-all duration-300 ${className}`}
      style={{
        color: 'var(--text-primary)',
        backgroundColor: 'transparent',
        border: '1px solid var(--border-primary)',
        cursor: 'default'
      }}
      onMouseEnter={(e) => {
        e.target.style.backgroundColor = 'var(--bg-tertiary)';
        e.target.style.color = 'var(--primary-blue)';
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = 'transparent';
        e.target.style.color = 'var(--text-primary)';
      }}
      title="Light theme active"
      aria-label="Light theme active"
      disabled
    >
      {/* Always show sun icon for light mode */}
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    </button>
  );
};

export default ThemeToggle; 
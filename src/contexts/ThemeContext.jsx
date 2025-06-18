import React, { createContext, useContext, useState, useEffect } from 'react';
import { getUserUid } from '../utils/multiTenancy';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Get user-specific theme preference (MULTI-TENANT SAFE)
const getUserTheme = () => {
  try {
    const userUid = getUserUid();
    
    if (userUid) {
      // Use user-specific localStorage key
      const savedTheme = localStorage.getItem(`theme_${userUid}`);
      if (savedTheme) return savedTheme;
    }
    
    // Fallback for non-authenticated users or first time
    const globalTheme = localStorage.getItem('theme');
    if (globalTheme) return globalTheme;
    
    // Check system preference as final fallback
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
  } catch (error) {
    // Fallback if any error occurs
  }
  return 'light';
};

// Save user-specific theme preference (MULTI-TENANT SAFE)
const saveUserTheme = (theme) => {
  try {
    const userUid = getUserUid();
    
    if (userUid) {
      // Save with user-specific key
      localStorage.setItem(`theme_${userUid}`, theme);
      
      // Also update global key for backward compatibility and non-authenticated state
      localStorage.setItem('theme', theme);
    } else {
      // If no user authenticated, save globally
      localStorage.setItem('theme', theme);
    }
  } catch (error) {
    // Silently handle storage errors
  }
};

// Clean up old global theme when user logs in
const migrateThemeToUser = () => {
  try {
    const userUid = getUserUid();
    
    if (userUid) {
      const globalTheme = localStorage.getItem('theme');
      const userTheme = localStorage.getItem(`theme_${userUid}`);
      
      // If user doesn't have a theme preference but global exists, migrate it
      if (!userTheme && globalTheme) {
        localStorage.setItem(`theme_${userUid}`, globalTheme);
      }
    }
  } catch (error) {
    // Silently handle migration errors
  }
};

export const ThemeProvider = ({ children }) => {
  // Use a ref to track if component is mounted to prevent state updates after unmount
  const isMountedRef = React.useRef(true);
  
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Initialize theme state safely with more defensive programming
  const [theme, setTheme] = useState(() => {
    try {
      // Use a more defensive approach for initial theme loading
      if (typeof window === 'undefined') return 'light';
      
      // Delay user-specific logic to avoid dispatcher null errors
      const globalTheme = localStorage.getItem('theme');
      if (globalTheme) return globalTheme;
      
      // Check system preference as fallback
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
      
      return 'light';
    } catch (error) {
      return 'light'; // Safe fallback
    }
  });

  // Safe setState wrapper
  const safeSetTheme = React.useCallback((newTheme) => {
    if (isMountedRef.current) {
      setTheme(newTheme);
    }
  }, []);

  // Delayed effect for user-specific theme migration
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    const handleUserThemeMigration = () => {
      try {
        // Migrate theme preferences if needed
        migrateThemeToUser();
        
        // Get user-specific theme preference
        const userTheme = getUserTheme();
        if (userTheme !== theme && isMountedRef.current) {
          safeSetTheme(userTheme);
        }
      } catch (error) {
        // Silently handle user theme errors
      }
    };

    // Delay execution to avoid early hook calls
    const timeoutId = setTimeout(handleUserThemeMigration, 100);
    return () => clearTimeout(timeoutId);
  }, []); // Only run once

  // Watch for user authentication changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    const handleStorageChange = (e) => {
      try {
        // If userUid changes (login/logout), update theme
        if (e.key === 'userUid' && isMountedRef.current) {
          const newTheme = getUserTheme();
          safeSetTheme(newTheme);
        }
      } catch (error) {
        // Silently handle storage change errors
      }
    };

    try {
      window.addEventListener('storage', handleStorageChange);
      return () => window.removeEventListener('storage', handleStorageChange);
    } catch (error) {
      return () => {}; // Noop cleanup function
    }
  }, [safeSetTheme]);

  useEffect(() => {
    if (!isMountedRef.current) return;
    
    try {
      // Save user-specific theme preference
      saveUserTheme(theme);
      
      // Apply theme to document
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    } catch (error) {
      // Silently handle theme application errors
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (!isMountedRef.current) return;
    
    try {
      if (typeof window === 'undefined') return;
      
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        try {
          if (!isMountedRef.current) return;
          
          const userUid = getUserUid();
          const userThemeKey = userUid ? `theme_${userUid}` : 'theme';
          
          // Only change if no theme is explicitly set for this user
          if (!localStorage.getItem(userThemeKey)) {
            const newTheme = e.matches ? 'dark' : 'light';
            safeSetTheme(newTheme);
          }
        } catch (error) {
          // Silently handle change errors
        }
      };

      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    } catch (error) {
      // Silently handle media query errors
      return () => {}; // Noop cleanup function
    }
  }, [safeSetTheme]);

  const toggleTheme = React.useCallback(() => {
    try {
      if (!isMountedRef.current) return;
      
      const newTheme = theme === 'light' ? 'dark' : 'light';
      safeSetTheme(newTheme);
    } catch (error) {
      // Silently handle toggle errors
    }
  }, [theme, safeSetTheme]);

  // Get current user's theme preferences summary
  const getThemeInfo = React.useCallback(() => {
    try {
      const userUid = getUserUid();
      return {
        currentTheme: theme,
        userUid: userUid,
        isUserSpecific: !!userUid,
        storageKey: userUid ? `theme_${userUid}` : 'theme'
      };
    } catch (error) {
      return {
        currentTheme: theme,
        userUid: null,
        isUserSpecific: false,
        storageKey: 'theme'
      };
    }
  }, [theme]);

  const value = React.useMemo(() => ({
    theme,
    toggleTheme,
    isDark: theme === 'dark',
    getThemeInfo
  }), [theme, toggleTheme, getThemeInfo]);

  try {
    return (
      <ThemeContext.Provider value={value}>
        {children}
      </ThemeContext.Provider>
    );
  } catch (error) {
    // Fallback rendering in case of provider errors
    return children;
  }
}; 
import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { doc, getDoc, getDocs } from 'firebase/firestore';
import React from 'react';
import ThemeToggle from './ThemeToggle';
import { 
  getShopPreferences, 
  setShopPreferences, 
  uploadLensesToShop, 
  removeLensesFromShop, 
  getCurrentUserInfo,
  searchMatchingLenses 
} from '../utils/shopAPI';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { useAuth } from '../contexts/AuthContext';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const bottomNavRef = useRef(null);
  const [shopName, setShopName] = useState('');
  const [logoDataURL, setLogoDataURL] = useState('');
  
  // Use centralized auth
  const { 
    user, 
    userRole, 
    userPermissions, 
    isAuthenticated, 
    hasPermission, 
    logout,
    USER_ROLES 
  } = useAuth();
  
  // Shop states
  const [showShopModal, setShowShopModal] = useState(false);
  const [shopLoading, setShopLoading] = useState(false);
  const [shopPreferences, setShopPreferencesState] = useState({ isSharing: false });
  const [shopLenses, setShopLenses] = useState([]);
  const [shopError, setShopError] = useState('');

  useEffect(() => {
    if (!isAuthenticated() && location.pathname !== '/login') {
        navigate('/login', { replace: true });
    } else if (isAuthenticated()) {
        // Fetch shop settings when user is authenticated
        fetchShopSettings();
        // Load shop preferences
        loadShopPreferences();
      }
  }, [isAuthenticated, location.pathname, navigate]);

  // Load shop preferences on component mount
  useEffect(() => {
    loadShopPreferences();
  }, []);

  // Fetch shop settings to get logo and shop name
  const fetchShopSettings = async () => {
    try {
      const settingsDoc = await getDoc(getUserDoc('settings', 'shopSettings'));
      
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data();
        setShopName(settings.shopName || 'Lens Management');
        setLogoDataURL(settings.logoDataURL || '');
      }
    } catch (error) {
      console.error('Error fetching shop settings:', error);
      setShopName('Lens Management'); // fallback
    }
  };

  // Load shop preferences from localStorage
  const loadShopPreferences = () => {
    const prefs = getShopPreferences();
    setShopPreferencesState(prefs);
  };

  // Handle shop permission toggle
  const handleShopPermissionToggle = async () => {
    setShopLoading(true);
    setShopError('');
    
    try {
      const newPrefs = { isSharing: !shopPreferences.isSharing };
      
      if (newPrefs.isSharing) {
        // User wants to share - upload lenses to shop
        const userInfo = getCurrentUserInfo();
        const lensInventoryRef = getUserCollection('lensInventory');
        const snapshot = await getDocs(lensInventoryRef);
        
        const lenses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        await uploadLensesToShop(lenses, userInfo);
        console.log('Successfully uploaded lenses to shop');
      } else {
        // User wants to stop sharing - remove lenses from shop
        const userInfo = getCurrentUserInfo();
        const lensInventoryRef = getUserCollection('lensInventory');
        const snapshot = await getDocs(lensInventoryRef);
        
        const lenses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        await removeLensesFromShop(lenses, userInfo);
        console.log('Successfully removed lenses from shop');
      }
      
      setShopPreferences(newPrefs);
      setShopPreferencesState(newPrefs);
      
    } catch (error) {
      console.error('Error toggling shop permission:', error);
      setShopError(`Failed to ${shopPreferences.isSharing ? 'disable' : 'enable'} lens sharing: ${error.message}`);
    } finally {
      setShopLoading(false);
    }
  };

  // Search and fetch matching lenses from the centralized shop
  const searchShopLenses = async (prescriptionData) => {
    setShopLoading(true);
    setShopError('');
    
    try {
      const matches = await searchMatchingLenses(prescriptionData);
      setShopLenses(matches);
      console.log(`Found ${matches.length} matching lenses in shop`);
    } catch (error) {
      console.error('Error searching shop lenses:', error);
      setShopError(`Failed to search lenses: ${error.message}`);
    } finally {
      setShopLoading(false);
    }
  };

  // Save scroll position on unmount and restore it when component loads
  useEffect(() => {
    // Restore scroll position on component mount
    if (bottomNavRef.current) {
      const savedScrollLeft = localStorage.getItem('bottomNavScrollPosition');
      if (savedScrollLeft) {
        // Use a timeout to make sure the DOM is fully rendered
        setTimeout(() => {
          try {
            bottomNavRef.current.scrollLeft = parseInt(savedScrollLeft, 10);
          } catch (e) {
            console.error("Error setting scroll position:", e);
          }
        }, 100);
      }
    }
  }, []); // Only run on mount

  // Handle scroll events to save position immediately
  const handleNavScroll = () => {
    if (bottomNavRef.current) {
      localStorage.setItem('bottomNavScrollPosition', bottomNavRef.current.scrollLeft.toString());
    }
  };

  // Handle logout using AuthContext
  const handleLogout = async () => {
    try {
      setIsMenuOpen(false);
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Navigation handler with debugging
  const handleNavigation = (path) => {
    console.log('Navigating to:', path);
    navigate(path);
  };

  // Get the first letter of shop name for fallback display
  const getShopInitial = () => {
    return shopName ? shopName.charAt(0).toUpperCase() : 'S';
  };

  // Render the logo or shop initial
  const renderLogoOrInitial = () => {
    if (logoDataURL) {
      return (
        <img 
          src={logoDataURL} 
          alt={shopName || 'Shop Logo'} 
          className="h-14 w-auto object-contain"
        />
      );
    } else {
      return (
        <div className="flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600 text-white h-14 w-14 rounded-full font-bold text-2xl shadow-lg transform hover:scale-105 transition-all duration-300">
          {getShopInitial()}
        </div>
      );
    }
  };

  // Define menu items for reuse
  const menuItems = [
    { 
      path: '/dashboard', 
      title: 'Dashboard', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
      color: 'from-blue-500 to-cyan-400'
    },
    { 
      path: '/orders', 
      title: 'Orders', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      ),
      color: 'from-green-500 to-teal-400'
    },
    { 
      path: '/customers', 
      title: 'Vendors & Customers', 
      shortTitle: 'Contacts',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'from-purple-500 to-indigo-400'
    },
    { 
      path: '/sales', 
      title: 'Sales', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'from-pink-500 to-red-400'
    },
    { 
      path: '/purchases', 
      title: 'Purchases', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      ),
      color: 'from-orange-500 to-yellow-400'
    },
    { 
      path: '/transactions', 
      title: 'Transactions', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'from-emerald-500 to-green-400'
    },
    { 
      path: '/ledger', 
      title: 'Ledger', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6M15 17v-6M9 11h6" />
        </svg>
      ),
      color: 'from-cyan-500 to-blue-400'
    },
    { 
      path: '/gst-returns', 
      title: 'GST Returns',
      shortTitle: 'GST', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
        </svg>
      ),
      color: 'from-violet-500 to-purple-400'
    },
    { 
      path: '/lens-inventory', 
      title: 'Lens Inventory',
      shortTitle: 'Inventory', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      ),
      color: 'from-amber-500 to-yellow-400'
    },
    { 
      path: '/settings', 
      title: 'Settings', 
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
      color: 'from-teal-500 to-emerald-400'
    },
  ];

  // Filter menu items based on permissions using AuthContext
  const getAccessibleMenuItems = () => {
    return menuItems.filter(item => {
      // Super admin and admin have access to everything
      if (userRole === USER_ROLES.SUPER_ADMIN || userRole === USER_ROLES.ADMIN) {
        return true;
      }
      
      // Use centralized permission checking
      return hasPermission(item.path);
    });
  };

  // Don't render navbar if user is not authenticated
  if (!isAuthenticated()) {
    console.log('🔐 Navbar: Not rendering - user not authenticated');
    console.log('🔐 Auth state:', { 
      isAuthenticated: isAuthenticated(), 
      user: user?.email, 
      userRole, 
      authState: isAuthenticated() ? 'authenticated' : 'not authenticated' 
    });
    return null;
  }

  console.log('🔐 Navbar: Rendering for authenticated user:', user?.email);

  return (
    <>
      {/* Mobile Navbar */}
      <nav className="mobile-header mobile-only z-50" 
           style={{ 
             backgroundColor: 'var(--bg-secondary)', 
             boxShadow: '0 1px 3px var(--shadow-secondary)' 
           }}>
        <div className="flex items-center justify-between px-4 py-2">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 rounded-lg transition-colors duration-300"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.target.style.color = 'var(--primary-blue)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-primary)'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <div className="flex items-center space-x-2">
            {renderLogoOrInitial()}
            <span 
              className="font-bold text-lg"
              style={{ color: 'var(--text-primary)' }}
            >
              {shopName}
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <ThemeToggle />
            
            {/* Shop Modal Toggle Button */}
          <button
              onClick={() => setShowShopModal(true)}
              className="p-2 rounded-lg transition-colors duration-300"
              style={{ 
                color: shopPreferences.isSharing ? 'white' : 'var(--text-primary)',
                backgroundColor: shopPreferences.isSharing ? 'var(--primary-blue)' : 'transparent'
              }}
              onMouseEnter={(e) => {
                if (!shopPreferences.isSharing) {
                  e.target.style.color = 'var(--primary-blue)';
                  e.target.style.backgroundColor = 'var(--bg-tertiary)';
                }
              }}
              onMouseLeave={(e) => {
                if (!shopPreferences.isSharing) {
                  e.target.style.color = 'var(--text-primary)';
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
              title={shopPreferences.isSharing ? 'Shop sharing enabled' : 'Shop sharing disabled'}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>
            
                <button
              onClick={handleLogout}
              className="p-2 rounded-lg transition-colors duration-300"
              style={{ color: 'var(--text-primary)' }}
                  onMouseEnter={(e) => {
                e.target.style.color = 'white';
                e.target.style.backgroundColor = 'var(--danger, #dc2626)';
                  }}
                  onMouseLeave={(e) => {
                e.target.style.color = 'var(--text-primary)';
                    e.target.style.backgroundColor = 'transparent';
                  }}
                >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMenuOpen && (
          <div 
            className="absolute top-full left-0 right-0 shadow-lg border-t z-40"
            style={{ 
              backgroundColor: 'var(--bg-secondary)', 
              borderColor: 'var(--border-color)' 
            }}
          >
            <div className="py-2">
                  {getAccessibleMenuItems().map((item) => (
                    <button
                      key={item.path}
                      onClick={() => {
                        handleNavigation(item.path);
                        setIsMenuOpen(false);
                      }}
                  className={`w-full text-left px-6 py-3 transition-colors duration-200 flex items-center space-x-3 ${
                    location.pathname === item.path ? 'font-medium' : ''
                      }`}
                      style={{
                    backgroundColor: location.pathname === item.path ? 'var(--primary-blue)' : 'transparent',
                    color: location.pathname === item.path ? 'white' : 'var(--text-primary)'
                      }}
                      onMouseEnter={(e) => {
                    if (location.pathname !== item.path) {
                          e.target.style.backgroundColor = 'var(--bg-tertiary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                    if (location.pathname !== item.path) {
                          e.target.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                  <div 
                    className="text-lg"
                    style={{
                      color: location.pathname === item.path ? 'white' : 'var(--primary-blue)'
                    }}
                  >
                      {item.icon}
                    </div>
                  <span>{item.title}</span>
                  </button>
                ))}
            
              {/* Logout option in mobile menu */}
              <div 
                className="border-t my-2"
                style={{ borderColor: 'var(--border-color)' }}
              ></div>
              <button
                onClick={() => {
                  handleLogout();
                  setIsMenuOpen(false);
                }}
                className="w-full text-left px-6 py-3 transition-colors duration-200 flex items-center space-x-3"
                style={{ 
                  backgroundColor: 'transparent',
                  color: '#dc2626'
                }}
                onMouseEnter={(e) => {
                  e.target.style.backgroundColor = '#fef2f2';
                  e.target.style.color = '#991b1b';
                }}
                onMouseLeave={(e) => {
                  e.target.style.backgroundColor = 'transparent';
                  e.target.style.color = '#dc2626';
                }}
              >
                <div className="text-lg" style={{ color: 'inherit' }}>
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                </div>
                <span>Logout</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Desktop Bottom Navigation */}
      <nav 
        className="desktop-only bottom-nav z-40"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <div 
          ref={bottomNavRef}
          className="flex overflow-x-auto py-1 px-4 space-x-2 scrollbar-hide"
          onScroll={handleNavScroll}
          style={{ 
            scrollbarWidth: 'none',
            msOverflowStyle: 'none'
          }}
        >
          {/* Desktop Logo */}
          <button 
            onClick={() => handleNavigation('/orders')}
            className="flex-shrink-0 flex flex-col items-center p-2 rounded-xl min-w-[80px] hover:scale-105 transition-all duration-200"
            style={{
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = 'var(--bg-tertiary)';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
            title="Go to Orders"
          >
            <div className="mb-1">
              {renderLogoOrInitial()}
            </div>
          </button>
          
          {getAccessibleMenuItems().map((item) => (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path)}
              className={`flex-shrink-0 flex flex-col items-center p-2 rounded-xl transition-all duration-200 min-w-[80px] ${
                location.pathname === item.path 
                  ? 'transform scale-105 shadow-lg' 
                  : 'hover:scale-105'
              }`}
              style={{
                backgroundColor: location.pathname === item.path ? 'var(--primary-blue)' : 'transparent',
                boxShadow: location.pathname === item.path ? '0 4px 12px var(--shadow-primary)' : 'none'
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== item.path) {
                  e.target.style.backgroundColor = 'var(--bg-tertiary)';
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== item.path) {
                  e.target.style.backgroundColor = 'transparent';
                }
              }}
            >
              <div 
                className="mb-1 transition-colors duration-200"
                  style={{
                  color: location.pathname === item.path ? 'white' : 'var(--primary-blue)'
                }}
              >
                {item.icon}
                  </div>
              <span 
                className="text-xs font-medium transition-colors duration-200"
                style={{
                  color: location.pathname === item.path ? 'white' : 'var(--text-secondary)'
                }}
              >
                  {item.shortTitle || item.title}
                </span>
              </button>
            ))}
          
          {/* Theme Toggle for Desktop */}
          <div className="flex-shrink-0 flex flex-col items-center p-2 rounded-xl min-w-[80px]">
            <div className="mb-1">
              <ThemeToggle className="mx-auto" />
        </div>
            <span 
              className="text-xs font-medium transition-colors duration-200"
              style={{ color: 'var(--text-secondary)' }}
            >
              Theme
            </span>
      </div>

          {/* Logout Button for Desktop */}
      <button
            onClick={handleLogout}
            className="flex-shrink-0 flex flex-col items-center p-2 rounded-xl transition-all duration-200 min-w-[80px] hover:scale-105"
        style={{
              backgroundColor: 'transparent'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#fef2f2';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = 'transparent';
            }}
            title="Logout"
      >
            <div 
              className="mb-1 transition-colors duration-200"
              style={{ color: '#dc2626' }}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
            <span 
              className="text-xs font-medium transition-colors duration-200"
              style={{ color: '#dc2626' }}
            >
              Logout
            </span>
      </button>
        </div>
      </nav>

      {/* Shop Modal */}
      {showShopModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-primary)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                Lens Shop Settings
              </h3>
              <button 
                onClick={() => setShowShopModal(false)} 
                className="p-1 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => e.target.style.color = 'var(--danger)'}
                onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    Share your lenses in the centralized shop
                  </label>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Allow other optical shops to see and contact you about your available lenses
                  </p>
                </div>
                    <button
                      onClick={handleShopPermissionToggle}
                      disabled={shopLoading}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    shopPreferences.isSharing 
                      ? 'bg-blue-600 focus:ring-blue-500' 
                      : 'bg-gray-200 focus:ring-gray-500'
                  } ${shopLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          shopPreferences.isSharing ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
              
              {shopError && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--danger-light)', color: 'var(--danger)' }}>
                  <p className="text-sm">{shopError}</p>
                </div>
              )}
              
              {shopPreferences.isSharing && (
                <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
                  <p className="text-sm">
                    ✅ Your lenses are visible in the centralized shop. Other optical shops can see your inventory and contact you for purchases.
                  </p>
                </div>
              )}
              </div>

            <div className="mt-6 flex justify-end">
                <button
                onClick={() => setShowShopModal(false)}
                className="px-4 py-2 rounded-lg transition-colors"
                style={{ 
                  backgroundColor: 'var(--primary)', 
                  color: 'white' 
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--primary-dark)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--primary)'}
              >
                Close
                </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Navbar; 
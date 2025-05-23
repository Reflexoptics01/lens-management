import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import React from 'react';
import ThemeToggle from './ThemeToggle';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const bottomNavRef = useRef(null);
  const [shopName, setShopName] = useState('');
  const [logoDataURL, setLogoDataURL] = useState('');
  const [userRole, setUserRole] = useState('user');
  const [userPermissions, setUserPermissions] = useState({});

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      
      if (!currentUser && location.pathname !== '/login') {
        navigate('/login', { replace: true });
      } else if (currentUser) {
        // Fetch shop settings when user is authenticated
        fetchShopSettings();
        
        // Fetch user role and permissions
        await fetchUserPermissions(currentUser.email);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch shop settings to get logo and shop name
  const fetchShopSettings = async () => {
    try {
      const settingsDoc = await getDoc(doc(db, 'settings', 'shopSettings'));
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setShopName(data.shopName || '');
        setLogoDataURL(data.logoDataURL || '');
      }
    } catch (error) {
      console.error('Error fetching shop settings:', error);
    }
  };

  // Fetch user role and permissions
  const fetchUserPermissions = async (email) => {
    try {
      // First check localStorage for permissions
      const storedRole = localStorage.getItem('userRole');
      const storedPermissions = localStorage.getItem('userPermissions');
      
      if (storedRole && storedPermissions) {
        setUserRole(storedRole);
        setUserPermissions(JSON.parse(storedPermissions));
      } else {
        // Fetch from Firestore if not in localStorage
        const usersRef = collection(db, 'users');
        const userQuery = query(usersRef, where('email', '==', email));
        const userSnapshot = await getDocs(userQuery);
        
        if (!userSnapshot.empty) {
          const userData = userSnapshot.docs[0].data();
          setUserRole(userData.role || 'user');
          setUserPermissions(userData.permissions || {});
          
          // Save to localStorage for future use
          localStorage.setItem('userRole', userData.role || 'user');
          localStorage.setItem('userPermissions', JSON.stringify(userData.permissions || {}));
        }
      }
    } catch (error) {
      console.error('Error fetching user permissions:', error);
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
      localStorage.setItem('bottomNavScrollPosition', bottomNavRef.current.scrollLeft);
    }
  };

  // Additional effect to handle saving scroll position on route changes and unmount
  useEffect(() => {
    // Save the current position whenever route changes
    if (bottomNavRef.current) {
      localStorage.setItem('bottomNavScrollPosition', bottomNavRef.current.scrollLeft);
    }

    // Also save on unmount
    return () => {
      if (bottomNavRef.current) {
        localStorage.setItem('bottomNavScrollPosition', bottomNavRef.current.scrollLeft);
      }
    };
  }, [location.pathname]);

  const handleLogout = async () => {
    try {
      setIsMenuOpen(false);
      await auth.signOut();
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

  // Check if user has permission to view menu item
  const hasPermission = (path) => {
    // Admins have access to everything
    if (userRole === 'admin') return true;
    
    // If no permissions set and user is not admin, deny access
    if (!userPermissions || Object.keys(userPermissions).length === 0) return false;
    
    // Check specific permission
    return userPermissions[path] === true;
  };

  // Filter menu items based on permissions
  const getAccessibleMenuItems = () => {
    return menuItems.filter(item => hasPermission(item.path));
  };

  if (loading) {
    return (
      <nav className="mobile-header">
        <div className="flex items-center justify-center h-14 w-14">
          <div className="bg-gray-200 rounded-full animate-pulse h-14 w-14"></div>
        </div>
      </nav>
    );
  }

  if (!user) return null;

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
            className="p-2 transition-colors duration-300"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.target.style.color = 'var(--primary-blue)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          
          <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
            {shopName || 'Lens Management'}
          </h2>
          
          <button
            onClick={handleLogout}
            className="p-2 text-red-600 hover:text-red-700 transition-colors duration-300 flex items-center"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 mobile-only">
          <div 
            className="fixed inset-0 backdrop-blur-sm transition-opacity duration-300 ease-in-out"
            style={{ backgroundColor: 'var(--overlay)' }}
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-72 shadow-xl transform transition-all duration-300 ease-in-out rounded-r-2xl"
               style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex flex-col h-full">
              <div className="p-4 flex items-center justify-between"
                   style={{ borderBottomColor: 'var(--border-primary)', borderBottomWidth: '1px' }}>
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-purple-600">
                  Menu
                </h2>
                <button
                  onClick={() => setIsMenuOpen(false)}
                  className="p-1.5 transition-colors duration-300 rounded-full"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    e.target.style.color = 'var(--primary-blue)';
                    e.target.style.backgroundColor = 'var(--bg-tertiary)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = 'var(--text-muted)';
                    e.target.style.backgroundColor = 'transparent';
                  }}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto py-2">
                <div className="space-y-1 px-3">
                  {getAccessibleMenuItems().map((item) => (
                    <button
                      key={item.path}
                      onClick={() => {
                        handleNavigation(item.path);
                        setIsMenuOpen(false);
                      }}
                      className={`w-full px-3 py-2.5 text-left rounded-xl flex items-center space-x-3 transform transition-all duration-300 hover:scale-105 ${
                        location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                          ? `bg-gradient-to-r ${item.color} text-white shadow-md` 
                          : ''
                      }`}
                      style={{
                        color: location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                          ? 'white'
                          : 'var(--text-secondary)',
                        backgroundColor: location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                          ? undefined
                          : 'transparent'
                      }}
                      onMouseEnter={(e) => {
                        if (!(location.pathname === item.path || location.pathname.startsWith(item.path + '/'))) {
                          e.target.style.backgroundColor = 'var(--bg-tertiary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!(location.pathname === item.path || location.pathname.startsWith(item.path + '/'))) {
                          e.target.style.backgroundColor = 'transparent';
                        }
                      }}
                    >
                      <div className={`${
                        location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                          ? 'text-white'
                          : `text-transparent bg-clip-text bg-gradient-to-r ${item.color}`
                      }`}>
                        {React.cloneElement(item.icon, { className: 'w-5 h-5' })}
                      </div>
                      <span className="text-sm">{item.title}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="p-4" style={{ borderTopColor: 'var(--border-primary)', borderTopWidth: '1px' }}>
                <div className="mb-3">
                  <ThemeToggle className="w-full justify-center" />
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full px-3 py-2.5 text-left rounded-xl flex items-center space-x-3 text-red-600 transform transition-all duration-300 hover:scale-105"
                  onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="text-sm font-medium">Sign out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Navbar */}
      <nav className="desktop-only" style={{ backgroundColor: 'var(--bg-secondary)', boxShadow: '0 1px 3px var(--shadow-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <div className="transform transition-transform hover:scale-105 duration-300">
                  {renderLogoOrInitial()}
                </div>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-4">
                {getAccessibleMenuItems().map((item) => (
                  <button
                    key={item.path}
                    onClick={() => handleNavigation(item.path)}
                    className={`group flex flex-col items-center justify-center px-3 py-1 transition-all duration-300 hover:scale-105 ${
                      location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                        ? 'text-transparent bg-clip-text bg-gradient-to-r ' + item.color
                        : 'hover:text-gray-900'
                    }`}
                    style={{
                      color: location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                        ? 'transparent' 
                        : 'var(--text-muted)'
                    }}
                  >
                    <div className={`p-2 rounded-lg ${
                      location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                        ? 'bg-gradient-to-r ' + item.color + ' text-white shadow-md' 
                        : 'group-hover:bg-gradient-to-r group-hover:' + item.color + ' group-hover:text-white'
                    } transition-all duration-300`}
                    style={{
                      color: location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                        ? 'white' 
                        : 'var(--text-muted)'
                    }}>
                      {item.icon}
                    </div>
                    <span className={`mt-1 text-xs font-medium ${
                      location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                        ? 'text-transparent bg-clip-text bg-gradient-to-r ' + item.color
                        : ''
                    }`}
                    style={{
                      color: location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                        ? 'transparent' 
                        : 'var(--text-muted)'
                    }}>
                      {item.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            
            {/* Sign Out Button */}
            <div className="hidden sm:flex sm:items-center space-x-3">
              <ThemeToggle />
              <button
                onClick={handleLogout}
                className="flex items-center justify-center p-2 text-red-600 rounded-lg border border-red-200 transition-all duration-300 hover:scale-105 hover:shadow-md"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)', 
                  borderColor: 'var(--border-primary)',
                  color: '#dc2626'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.target.style.backgroundColor = 'var(--bg-secondary)'}
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav mobile-only fixed bottom-0 left-0 right-0 border-t z-50" 
           style={{ 
             backgroundColor: 'var(--bg-secondary)', 
             borderTopColor: 'var(--border-primary)',
             boxShadow: '0 -4px 10px var(--shadow-secondary)'
           }}>
        <div className="overflow-x-auto scrollbar-hide" ref={bottomNavRef} onScroll={handleNavScroll}>
          <div className="flex p-1 min-w-max">
            {getAccessibleMenuItems().map((item) => (
              <button
                key={item.path}
                onClick={() => {
                  console.log('Bottom nav clicked:', item.path);
                  handleNavigation(item.path);
                }}
                data-path={item.path}
                className="flex flex-col items-center justify-center py-1.5 px-3 min-w-[60px] relative transition-transform duration-300 hover:scale-110"
              >
                <div className={`p-1.5 rounded-lg mb-1 ${
                  location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                    ? 'bg-gradient-to-r ' + item.color + ' shadow-md animate-pulse' 
                    : ''
                } transition-all duration-300`}
                style={{
                  backgroundColor: location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                    ? undefined 
                    : 'var(--bg-tertiary)'
                }}>
                  <div className={`${
                    location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                      ? 'text-white' 
                      : ''
                  }`}
                  style={{
                    color: location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                      ? 'white' 
                      : 'var(--text-muted)'
                  }}>
                    {React.cloneElement(item.icon, { className: 'w-5 h-5' })}
                  </div>
                </div>
                <span className={`text-[10px] font-medium ${
                  location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                    ? 'text-transparent bg-clip-text bg-gradient-to-r ' + item.color
                    : ''
                }`}
                style={{
                  color: location.pathname === item.path || location.pathname.startsWith(item.path + '/') 
                    ? 'transparent' 
                    : 'var(--text-muted)'
                }}>
                  {item.shortTitle || item.title}
                </span>
                {(location.pathname === item.path || location.pathname.startsWith(item.path + '/')) && (
                  <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-6 h-1 rounded-full bg-gradient-to-r animate-pulse shadow-md" style={{backgroundImage: `linear-gradient(to right, var(--tw-gradient-stops))`}} />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Add some custom CSS to hide scrollbar but allow scrolling */}
      <style jsx="true">{`
        .scrollbar-hide {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.8;
          }
        }
        
        /* Add smooth page transitions */
        body {
          transition: background-color 0.5s ease;
        }
        
        @media (max-width: 768px) {
          .mobile-only {
            display: block;
          }
          .desktop-only {
            display: none;
          }
          .mobile-bottom-nav {
            height: 70px;
          }
          /* Add padding to bottom of the page content to prevent content from being hidden behind the navbar */
          main {
            padding-bottom: 70px;
          }
        }
        
        @media (min-width: 769px) {
          .mobile-only {
            display: none;
          }
          .desktop-only {
            display: block;
          }
        }
      `}</style>
    </>
  );
};

export default Navbar; 
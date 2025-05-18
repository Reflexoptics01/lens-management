import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth } from '../firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      
      if (!currentUser && location.pathname !== '/login') {
        navigate('/login', { replace: true });
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      setIsMenuOpen(false);
      await auth.signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <nav className="mobile-header">
        <h1 className="text-xl font-bold text-sky-600">PRISM OPTICAL</h1>
      </nav>
    );
  }

  if (!user) return null;

  return (
    <>
      {/* Mobile Navbar */}
      <nav className="mobile-header mobile-only">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-2 -ml-2 text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-sky-600">PRISM OPTICAL</h1>
        </div>
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-sky-600 text-white flex items-center justify-center">
            <span className="text-sm font-medium">
              {user?.email?.[0].toUpperCase() || 'U'}
            </span>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="fixed inset-0 z-50 mobile-only">
          <div 
            className="fixed inset-0 bg-black bg-opacity-50"
            onClick={() => setIsMenuOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl transform transition-transform duration-300 ease-in-out">
            <div className="flex flex-col h-full">
              <div className="p-4 border-b">
                <h2 className="text-xl font-bold text-sky-600">Menu</h2>
              </div>
              <div className="flex-1 overflow-y-auto">
                <div className="py-2">
                  <button
                    onClick={() => {
                      navigate('/orders');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname.startsWith('/orders')
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Orders
                  </button>
                  <button
                    onClick={() => {
                      navigate('/customers');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname === '/customers'
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Customers
                  </button>
                </div>
              </div>
              <div className="p-4 border-t">
                <button
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 rounded-lg"
                >
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Sign out
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Desktop Navbar */}
      <nav className="bg-white shadow-md desktop-only">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <h1 className="text-2xl font-bold text-sky-600">
                  PRISM OPTICAL
                </h1>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <button
                  onClick={() => navigate('/orders')}
                  className={`${
                    location.pathname.startsWith('/orders')
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Orders
                </button>
                <button
                  onClick={() => navigate('/customers')}
                  className={`${
                    location.pathname === '/customers'
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Customers
                </button>
              </div>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:items-center">
              <div className="ml-3 relative">
                <div>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="bg-white flex text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                  >
                    <div className="h-8 w-8 rounded-full bg-sky-600 text-white flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {user?.email?.[0].toUpperCase() || 'U'}
                      </span>
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav mobile-only">
        <div className="grid grid-cols-2 gap-1 p-2">
          <button
            onClick={() => navigate('/orders')}
            className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg ${
              location.pathname.startsWith('/orders')
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <span className="text-xs mt-1">Orders</span>
          </button>
          <button
            onClick={() => navigate('/customers')}
            className={`flex flex-col items-center justify-center py-2 px-4 rounded-lg ${
              location.pathname === '/customers'
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs mt-1">Customers</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Navbar; 
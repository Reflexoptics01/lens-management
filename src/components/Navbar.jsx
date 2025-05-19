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
                      navigate('/dashboard');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname === '/dashboard'
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Dashboard
                  </button>
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
                    Vendors & Customers
                  </button>
                  <button
                    onClick={() => {
                      navigate('/sales');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname.startsWith('/sales')
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Sales
                  </button>
                  <button
                    onClick={() => {
                      navigate('/purchases');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname.startsWith('/purchases')
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Purchases
                  </button>
                  <button
                    onClick={() => {
                      navigate('/transactions');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname === '/transactions'
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Transactions
                  </button>
                  <button
                    onClick={() => {
                      navigate('/ledger');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname === '/ledger'
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Ledger
                  </button>
                  <button
                    onClick={() => {
                      navigate('/gst-returns');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname === '/gst-returns'
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    GST Returns
                  </button>
                  <button
                    onClick={() => {
                      navigate('/settings');
                      setIsMenuOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left ${
                      location.pathname === '/settings'
                        ? 'bg-sky-100 text-sky-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Settings
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
                  onClick={() => navigate('/dashboard')}
                  className={`${
                    location.pathname === '/dashboard'
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Dashboard
                </button>
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
                  Vendors & Customers
                </button>
                <button
                  onClick={() => navigate('/sales')}
                  className={`${
                    location.pathname.startsWith('/sales')
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Sales
                </button>
                <button
                  onClick={() => navigate('/purchases')}
                  className={`${
                    location.pathname.startsWith('/purchases')
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Purchases
                </button>
                <button
                  onClick={() => navigate('/transactions')}
                  className={`${
                    location.pathname === '/transactions'
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Transactions
                </button>
                <button
                  onClick={() => navigate('/ledger')}
                  className={`${
                    location.pathname === '/ledger'
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Ledger
                </button>
                <button
                  onClick={() => navigate('/gst-returns')}
                  className={`${
                    location.pathname === '/gst-returns'
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  GST Returns
                </button>
                <button
                  onClick={() => navigate('/settings')}
                  className={`${
                    location.pathname === '/settings'
                      ? 'border-sky-600 text-gray-900'
                      : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  } inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium`}
                >
                  Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav mobile-only">
        <div className="grid grid-cols-5 gap-1 p-2">
          <button
            onClick={() => navigate('/dashboard')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
              location.pathname === '/dashboard'
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <span className="text-xs mt-1">Dashboard</span>
          </button>
          <button
            onClick={() => navigate('/orders')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
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
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
              location.pathname === '/customers'
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs mt-1">Contacts</span>
          </button>
          <button
            onClick={() => navigate('/sales')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
              location.pathname.startsWith('/sales')
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs mt-1">Sales</span>
          </button>
          <button
            onClick={() => navigate('/purchases')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
              location.pathname.startsWith('/purchases')
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <span className="text-xs mt-1">Purchases</span>
          </button>
          <button
            onClick={() => navigate('/transactions')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
              location.pathname === '/transactions'
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span className="text-xs mt-1">Transactions</span>
          </button>
          <button
            onClick={() => navigate('/ledger')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
              location.pathname === '/ledger'
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2 1 3 3 3h10c2 0 3-1 3-3V7c0-2-1-3-3-3H7c-2 0-3 1-3 3z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17v-6M15 17v-6M9 11h6" />
            </svg>
            <span className="text-xs mt-1">Ledger</span>
          </button>
          <button
            onClick={() => navigate('/gst-returns')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
              location.pathname === '/gst-returns'
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
            </svg>
            <span className="text-xs mt-1">GST</span>
          </button>
          <button
            onClick={() => navigate('/settings')}
            className={`flex flex-col items-center justify-center py-2 px-3 rounded-lg ${
              location.pathname === '/settings'
                ? 'text-sky-700 bg-sky-100'
                : 'text-gray-600'
            }`}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-xs mt-1">Settings</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Navbar; 
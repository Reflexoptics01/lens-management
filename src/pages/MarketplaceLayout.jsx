import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import MarketplaceDashboard from './MarketplaceDashboard';
import Shop from './Shop';
import PostQuery from './PostQuery';
import MyListings from './MyListings';
import CreateFlashSale from './CreateFlashSale';
import AddOpticalProduct from './AddOpticalProduct';
import MarketplaceSettings from './MarketplaceSettings';
import { MarketplaceNotificationBell } from '../components/MarketplaceNotifications';
import MarketplaceChat from '../components/MarketplaceChat';
import { useKeyboardShortcut, useShortcutContext } from '../utils/keyboardShortcuts';

const MarketplaceLayout = ({ activeTab: propActiveTab }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState(propActiveTab || 'dashboard');
  const [showSettings, setShowSettings] = useState(false);

  // Set marketplace context to override global shortcuts
  useShortcutContext('marketplace');

  // Enhanced ESC key handler for marketplace pages
  useEffect(() => {
    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        // Block navigation on marketplace pages
        event.preventDefault();
        event.stopPropagation();
        // Optionally show a message or handle marketplace-specific behavior
        return false;
      }
    };

    document.addEventListener('keydown', handleEscapeKey, { capture: true });

    return () => {
      document.removeEventListener('keydown', handleEscapeKey, { capture: true });
    };
  }, []);

  const tabs = [
    {
      id: 'dashboard',
      name: 'Dashboard',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
      component: (props) => <MarketplaceDashboard {...props} hideNavbar={true} />
    },
    {
      id: 'browse',
      name: 'Browse Lenses',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      component: (props) => <Shop {...props} hideNavbar={true} hideHeader={true} />
    },
    {
      id: 'query',
      name: 'Post Query',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      component: (props) => <PostQuery {...props} hideNavbar={true} />
    },
    {
      id: 'seller',
      name: 'My Listings',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      component: (props) => <MyListings {...props} hideNavbar={true} />
    }
  ];

  // Special pages that don't appear in tabs but use the marketplace layout
  const specialPages = {
    'create-flash-sale': (props) => <CreateFlashSale {...props} hideNavbar={true} />,
    'add-optical-product': (props) => <AddOpticalProduct {...props} hideNavbar={true} />
  };

  const ActiveComponent = specialPages[activeTab] || tabs.find(tab => tab.id === activeTab)?.component || MarketplaceDashboard;

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Marketplace Header */}
      <div 
        className="sticky top-0 z-50 shadow-lg"
        style={{ 
          background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #4338CA 100%)'
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-white">Reflex Marketplace</h1>
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center space-x-4">
              {/* Notifications */}
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                <MarketplaceNotificationBell iconColor="text-white" />
              </div>

              {/* Marketplace Settings Button */}
              <button
                onClick={() => setShowSettings(true)}
                className="bg-white/20 backdrop-blur-sm text-white p-2 rounded-full hover:bg-white/30 transition-all duration-200 border border-white/30"
                title="Marketplace Settings"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>

              {/* Exit Button */}
              <button
                onClick={() => navigate('/dashboard')}
                className="bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg font-medium hover:bg-white/30 transition-all duration-200 border border-white/30 flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>Exit Marketplace</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation - only show for main tabs, not special pages */}
          {!specialPages[activeTab] && (
            <div className="border-t border-white/20">
              <nav className="flex space-x-8 overflow-x-auto">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                      activeTab === tab.id
                        ? 'border-white text-white'
                        : 'border-transparent text-blue-200 hover:text-white hover:border-blue-200'
                    }`}
                  >
                    {tab.icon}
                    <span>{tab.name}</span>
                  </button>
                ))}
              </nav>
            </div>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        <ActiveComponent />
      </div>

      {/* Marketplace Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Marketplace Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto max-h-[calc(90vh-80px)]">
              <MarketplaceSettings />
            </div>
          </div>
        </div>
      )}
      
      {/* Marketplace Chat System */}
      <MarketplaceChat />
    </div>
  );
};

export default MarketplaceLayout; 
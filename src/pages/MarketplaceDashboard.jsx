import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Navbar from '../components/Navbar';
import { getAllShopLenses } from '../utils/shopAPI';
import { 
  createMarketplaceQuery, 
  getMarketplaceQueries, 
  getMarketplaceActivity, 
  getMarketplaceStats,
  subscribeToMarketplaceQueries,
  searchMarketplaceProfiles,
  getMarketplaceProfile
} from '../utils/marketplaceAPI';
import { MarketplaceNotificationBell } from '../components/MarketplaceNotifications';
import { getUserCollection } from '../utils/multiTenancy';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';

const MarketplaceDashboard = ({ hideNavbar = false }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Dashboard states
  const [marketplaceStats, setMarketplaceStats] = useState({
    myListings: 0
  });
  
  const [recentQueries, setRecentQueries] = useState([]);
  const [flashSales, setFlashSales] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Search states
  const [searchTerm, setSearchTerm] = useState('');
  const [searchCity, setSearchCity] = useState('');
  const [searchBusinessType, setSearchBusinessType] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  
  // Shop details popup states
  const [selectedShop, setSelectedShop] = useState(null);
  const [showShopDetails, setShowShopDetails] = useState(false);
  const [loadingShopDetails, setLoadingShopDetails] = useState(false);
  
  // Query posting states
  const [showPostQueryModal, setShowPostQueryModal] = useState(false);
  const [queryData, setQueryData] = useState({
    type: 'search',
    title: '',
    description: '',
    prescriptionData: {
      rightSph: '',
      rightCyl: '',
      rightAxis: '',
      leftSph: '',
      leftCyl: '',
      leftAxis: ''
    },
    urgency: 'normal'
  });
  const [postingQuery, setPostingQuery] = useState(false);

  useEffect(() => {
    loadMarketplaceDashboard();
  }, []);

  const loadMarketplaceDashboard = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchMarketplaceStats(),
        fetchRecentQueries(),
        fetchFlashSales()
      ]);
    } catch (error) {
      console.error('Error loading marketplace dashboard:', error);
      
      // Handle index building errors gracefully
      if (error.message && error.message.includes('requires an index')) {
        toast.success('Dashboard loaded! Some features are still being set up in the background.');
      } else {
        toast.error('Failed to load marketplace data');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchMarketplaceStats = async () => {
    try {
      // Get all marketplace lenses for user's listings
      const allLenses = await getAllShopLenses(1000, true);
      const myLenses = allLenses.filter(lens => lens.ownerId === user?.uid);
      
      setMarketplaceStats({
        myListings: myLenses.length
      });
    } catch (error) {
      console.error('Error fetching marketplace stats:', error);
    }
  };

  const fetchRecentQueries = async () => {
    try {
      // Get recent queries from API
      const queries = await getMarketplaceQueries({ 
        status: 'active', 
        limit: 10 
      });
      setRecentQueries(queries);
    } catch (error) {
      console.error('Error fetching recent queries:', error);
      
      // Handle index building error gracefully
      if (error.message && error.message.includes('requires an index')) {
        setRecentQueries([]);
      } else {
        // Fallback to empty array if API fails for other reasons
        setRecentQueries([]);
      }
    }
  };

  const fetchFlashSales = () => {
    // Mock flash sales data for now
    const mockFlashSales = [
      {
        id: '1',
        distributorName: 'Vision Plus Opticals',
        city: 'Mumbai',
        discount: '25%',
        description: 'Progressive lenses - Limited time offer',
        validUntil: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        lensType: 'Progressive',
        originalPrice: 2500,
        salePrice: 1875
      },
      {
        id: '2',
        distributorName: 'Clear Vision Corp',
        city: 'Delhi',
        discount: '30%',
        description: 'Anti-reflective coating special',
        validUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        lensType: 'AR Coating',
        originalPrice: 800,
        salePrice: 560
      }
    ];
    
    setFlashSales(mockFlashSales);
  };

  // Search distributors function
  const handleSearchDistributors = async () => {
    if (!searchTerm.trim() && !searchCity && !searchBusinessType) {
      toast.error('Please enter search criteria');
      return;
    }
    
    setSearching(true);
    setHasSearched(true);
    
    try {
      const searchCriteria = {
        searchTerm: searchTerm.trim(),
        city: searchCity,
        businessType: searchBusinessType
      };
      
      const profiles = await searchMarketplaceProfiles(searchCriteria);
      setSearchResults(profiles);
      toast.success(`Found ${profiles.length} distributor${profiles.length === 1 ? '' : 's'}`);
      
    } catch (error) {
      console.error('Error searching marketplace profiles:', error);
      toast.error('Failed to search distributors');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // Clear search function
  const clearSearch = () => {
    setSearchTerm('');
    setSearchCity('');
    setSearchBusinessType('');
    setSearchResults([]);
    setHasSearched(false);
  };

  // Handle shop click to show details
  const handleShopClick = async (shopId) => {
    setLoadingShopDetails(true);
    setShowShopDetails(true);
    
    try {
      const shopDetails = await getMarketplaceProfile(shopId);
      if (shopDetails) {
        setSelectedShop(shopDetails);
      } else {
        toast.error('Shop details not found');
        setShowShopDetails(false);
      }
    } catch (error) {
      console.error('Error fetching shop details:', error);
      toast.error('Failed to load shop details');
      setShowShopDetails(false);
    } finally {
      setLoadingShopDetails(false);
    }
  };

  // Handle WhatsApp click
  const handleWhatsAppClick = (phoneNumber) => {
    if (phoneNumber) {
      const cleanNumber = phoneNumber.replace(/[^\d+]/g, '');
      const whatsappUrl = `https://wa.me/${cleanNumber}`;
      window.open(whatsappUrl, '_blank');
    }
  };

  // Handle phone call click
  const handlePhoneClick = (phoneNumber) => {
    if (phoneNumber) {
      window.location.href = `tel:${phoneNumber}`;
    }
  };

  // Handle chat click
  const handleChatClick = (profile) => {
    if (window.startMarketplaceChat) {
      window.startMarketplaceChat(profile, `Hi! I'm interested in connecting with ${profile.shopName || profile.displayName}.`);
    } else {
      toast.error('Chat system is loading, please try again in a moment');
    }
  };

  // Add distributor to contacts (customer or vendor)
  const handleAddDistributor = async (shopData, type) => {
    try {
      // Create customer/vendor data from marketplace profile
      const contactData = {
        opticalName: shopData.shopName || shopData.displayName || '',
        contactPerson: shopData.contactPerson || 'N/A',
        phone: shopData.contact?.whatsappNumber || shopData.contact?.customerSupport1 || '',
        city: shopData.address?.city || '',
        state: shopData.address?.state || '',
        address: shopData.address?.street || '',
        email: shopData.contact?.alternateEmail || '',
        gstNumber: shopData.businessInfo?.gstNumber || '',
        type: type, // 'customer' or 'vendor'
        isMarketplaceImport: true,
        marketplaceProfileId: shopData.id,
        importedAt: serverTimestamp(),
        createdAt: serverTimestamp()
      };

      // Add to Firestore
      await addDoc(getUserCollection('customers'), contactData);
      
      toast.success(`${shopData.shopName || shopData.displayName} added as ${type} successfully!`);
      setShowShopDetails(false); // Close the details modal
      
    } catch (error) {
      console.error(`Error adding distributor as ${type}:`, error);
      toast.error(`Failed to add as ${type}. Please try again.`);
    }
  };

  const handlePostQuery = async (e) => {
    e.preventDefault();
    setPostingQuery(true);

    try {
      // Create query using the API
      const userInfo = {
        uid: user.uid,
        opticalName: user.opticalName || 'Unknown Optical',
        city: user.city || 'Unknown City',
        displayName: user.displayName,
        email: user.email,
        phone: user.phone
      };

      await createMarketplaceQuery(queryData, userInfo);
      toast.success('Query posted successfully! Other distributors will be notified.');
      setShowPostQueryModal(false);
      setQueryData({
        type: 'search',
        title: '',
        description: '',
        prescriptionData: {
          rightSph: '',
          rightCyl: '',
          rightAxis: '',
          leftSph: '',
          leftCyl: '',
          leftAxis: ''
        },
        urgency: 'normal'
      });
      
      // Refresh recent queries
      fetchRecentQueries();
    } catch (error) {
      console.error('Error posting query:', error);
      toast.error('Failed to post query. Please try again.');
    } finally {
      setPostingQuery(false);
    }
  };

  const formatTimeAgo = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    
    if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      return `${Math.floor(diffInMinutes / 60)}h ago`;
    } else {
      return `${Math.floor(diffInMinutes / 1440)}d ago`;
    }
  };

  const formatDaysLeft = (date) => {
    if (!date) return '';
    
    const now = new Date();
    const diffInDays = Math.ceil((date - now) / (1000 * 60 * 60 * 24));
    
    if (diffInDays <= 0) return 'Expired';
    if (diffInDays === 1) return '1 day left';
    return `${diffInDays} days left`;
  };

  const getQueryTypeIcon = (type) => {
    const icons = {
      search: '🔍',
      price_request: '💰',
      bulk_sale: '📦',
      special_request: '⭐'
    };
    return icons[type] || '📝';
  };

  const getQueryTypeColor = (type) => {
    const colors = {
      search: 'bg-blue-100 text-blue-800',
      price_request: 'bg-green-100 text-green-800',
      bulk_sale: 'bg-purple-100 text-purple-800',
      special_request: 'bg-yellow-100 text-yellow-800'
    };
    return colors[type] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      {!hideNavbar && <Navbar />}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Recent Queries */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Marketplace Queries</h3>
                  <button
                    onClick={() => setShowPostQueryModal(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    View All
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {recentQueries.length === 0 ? (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-gray-500">No queries yet</p>
                    <p className="text-sm text-gray-400">Be the first to post a query!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {recentQueries.map((query) => (
                      <div key={query.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-lg">{getQueryTypeIcon(query.type)}</span>
                            <h4 className="font-medium text-gray-900 dark:text-white">{query.title}</h4>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getQueryTypeColor(query.type)}`}>
                              {query.type.replace('_', ' ').toUpperCase()}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500">{formatTimeAgo(query.createdAt)}</span>
                        </div>
                        
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{query.description}</p>
                        
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>{query.posterInfo?.opticalName}, {query.posterInfo?.city}</span>
                          <span>{query.responseCount || 0} responses</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* Search Distributors Section */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mt-6">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search Distributors</h3>
                </div>
              </div>
              
              <div className="p-6">
                {/* Search Interface */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearchDistributors()}
                      placeholder="Search distributors by name, city, business type..."
                      className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>
                </div>

                {/* Search Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <select 
                    value={searchCity}
                    onChange={(e) => setSearchCity(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Cities</option>
                    <option value="mumbai">Mumbai</option>
                    <option value="delhi">Delhi</option>
                    <option value="bangalore">Bangalore</option>
                    <option value="chennai">Chennai</option>
                    <option value="kolkata">Kolkata</option>
                    <option value="pune">Pune</option>
                    <option value="hyderabad">Hyderabad</option>
                    <option value="ahmedabad">Ahmedabad</option>
                  </select>
                  
                  <select 
                    value={searchBusinessType}
                    onChange={(e) => setSearchBusinessType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">All Business Types</option>
                    <option value="Optical Store">Optical Store</option>
                    <option value="Lens Distributor">Lens Distributor</option>
                    <option value="Frame Manufacturer">Frame Manufacturer</option>
                    <option value="Lens Manufacturer">Lens Manufacturer</option>
                    <option value="Optical Wholesaler">Optical Wholesaler</option>
                    <option value="Contact Lens Distributor">Contact Lens Distributor</option>
                    <option value="Equipment Supplier">Equipment Supplier</option>
                  </select>
                  
                  <div className="flex space-x-2">
                    <button 
                      onClick={handleSearchDistributors}
                      disabled={searching}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {searching ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Searching...
                        </div>
                      ) : (
                        'Search'
                      )}
                    </button>
                    {hasSearched && (
                      <button 
                        onClick={clearSearch}
                        className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>

                {/* Search Results */}
                {hasSearched && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Search Results ({searchResults.length})
                      </h4>
                    </div>
                    
                    {searchResults.length === 0 ? (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="text-lg mb-2">No distributors found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {searchResults.map((profile) => (
                          <div key={profile.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className="text-lg">⭐</span>
                                <h5 className="font-medium text-gray-900 dark:text-white">
                                  {profile.shopName || profile.displayName}
                                </h5>
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  Marketplace
                                </span>
                              </div>
                            </div>
                            
                            <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-3">
                              {profile.address?.city && (
                                <p>📍 {profile.address.city}{profile.address.state && `, ${profile.address.state}`}</p>
                              )}
                              {profile.businessInfo?.businessType && (
                                <p>🏢 {profile.businessInfo.businessType}</p>
                              )}
                              {profile.businessInfo?.specializations && profile.businessInfo.specializations.length > 0 && (
                                <p>🎯 {profile.businessInfo.specializations.slice(0, 2).join(', ')}{profile.businessInfo.specializations.length > 2 ? '...' : ''}</p>
                              )}
                              {profile.description && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
                                  {profile.description.length > 100 ? `${profile.description.substring(0, 100)}...` : profile.description}
                                </p>
                              )}
                            </div>
                            
                            <div className="flex space-x-2">
                              <button 
                                onClick={() => handleShopClick(profile.id)}
                                className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 transition-colors"
                              >
                                View Details
                              </button>
                              {profile.visibility?.showContact && profile.contact?.whatsappNumber && (
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleWhatsAppClick(profile.contact.whatsappNumber);
                                  }}
                                  className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 transition-colors"
                                >
                                  WhatsApp
                                </button>
                              )}
                              {profile.visibility?.showContact && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleChatClick(profile);
                                  }}
                                  className="text-xs bg-gray-600 text-white px-3 py-1 rounded hover:bg-gray-700 transition-colors"
                                >
                                  Chat
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Search Instructions - only show when no search has been performed */}
                {!hasSearched && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-2">How to Search:</h4>
                    <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                      <li>• Enter keywords to search across all distributor profiles</li>
                      <li>• Use filters to narrow down results by location and business type</li>
                      <li>• Search results will show distributors with marketplace profiles</li>
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Flash Sales & Quick Actions */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 mb-6">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Flash Sales</h3>
                  <button
                    onClick={() => {
                      if (hideNavbar) {
                        // If we're in marketplace layout, use window.location to ensure proper routing
                        window.location.href = '/create-flash-sale';
                      } else {
                        navigate('/create-flash-sale');
                      }
                    }}
                    className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                  >
                    Create Sale
                  </button>
                </div>
              </div>
              
              <div className="p-6">
                {flashSales.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <p className="text-lg mb-2">No flash sales active</p>
                    <p className="text-sm">Create a flash sale to boost your sales</p>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {flashSales.map((sale) => (
                      <div key={sale.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-medium text-gray-900 dark:text-white">{sale.description}</h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{sale.distributorName} • {sale.city}</p>
                          </div>
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded-full text-sm font-medium">
                            {sale.discount} OFF
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <span className="text-gray-500">₹{sale.originalPrice}</span>
                            <span className="text-green-600 font-medium ml-2">₹{sale.salePrice}</span>
                          </div>
                          <span className="text-gray-500">
                            Valid until {sale.validUntil.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Post Query Modal */}
      {showPostQueryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Post New Query</h2>
                <button
                  onClick={() => setShowPostQueryModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handlePostQuery} className="space-y-6">
                {/* Query Type */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Query Type
                  </label>
                  <select
                    value={queryData.type}
                    onChange={(e) => setQueryData({ ...queryData, type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="search">Search Request</option>
                    <option value="price_request">Price Request</option>
                    <option value="bulk_sale">Bulk Sale</option>
                    <option value="special_request">Special Request</option>
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={queryData.title}
                    onChange={(e) => setQueryData({ ...queryData, title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Brief title for your query"
                    required
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={queryData.description}
                    onChange={(e) => setQueryData({ ...queryData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Detailed description of what you're looking for"
                    required
                  />
                </div>

                {/* Prescription Data (for search and price requests) */}
                {(queryData.type === 'search' || queryData.type === 'price_request') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Prescription Details (Optional)
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Right Eye</label>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="SPH"
                            value={queryData.prescriptionData.rightSph}
                            onChange={(e) => setQueryData({
                              ...queryData,
                              prescriptionData: { ...queryData.prescriptionData, rightSph: e.target.value }
                            })}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="CYL"
                            value={queryData.prescriptionData.rightCyl}
                            onChange={(e) => setQueryData({
                              ...queryData,
                              prescriptionData: { ...queryData.prescriptionData, rightCyl: e.target.value }
                            })}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="AXIS"
                            value={queryData.prescriptionData.rightAxis}
                            onChange={(e) => setQueryData({
                              ...queryData,
                              prescriptionData: { ...queryData.prescriptionData, rightAxis: e.target.value }
                            })}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Left Eye</label>
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            placeholder="SPH"
                            value={queryData.prescriptionData.leftSph}
                            onChange={(e) => setQueryData({
                              ...queryData,
                              prescriptionData: { ...queryData.prescriptionData, leftSph: e.target.value }
                            })}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="CYL"
                            value={queryData.prescriptionData.leftCyl}
                            onChange={(e) => setQueryData({
                              ...queryData,
                              prescriptionData: { ...queryData.prescriptionData, leftCyl: e.target.value }
                            })}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                          <input
                            type="text"
                            placeholder="AXIS"
                            value={queryData.prescriptionData.leftAxis}
                            onChange={(e) => setQueryData({
                              ...queryData,
                              prescriptionData: { ...queryData.prescriptionData, leftAxis: e.target.value }
                            })}
                            className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Urgency
                  </label>
                  <select
                    value={queryData.urgency}
                    onChange={(e) => setQueryData({ ...queryData, urgency: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                    <option value="asap">ASAP</option>
                  </select>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => setShowPostQueryModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={postingQuery}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {postingQuery && (
                      <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                    )}
                    <span>{postingQuery ? 'Posting...' : 'Post Query'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Shop Details Modal */}
      {showShopDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-600">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Shop Details</h2>
              <button
                onClick={() => {
                  setShowShopDetails(false);
                  setSelectedShop(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-6">
              {loadingShopDetails ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600 dark:text-gray-300">Loading shop details...</span>
                </div>
              ) : selectedShop ? (
                <div className="space-y-6">
                  {/* Shop Header */}
                  <div className="text-center border-b border-gray-200 dark:border-gray-600 pb-6">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {selectedShop.shopName || selectedShop.displayName}
                    </h3>
                    {selectedShop.description && (
                      <p className="text-gray-600 dark:text-gray-400">{selectedShop.description}</p>
                    )}
                    {selectedShop.businessInfo?.businessType && (
                      <span className="inline-block mt-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {selectedShop.businessInfo.businessType}
                      </span>
                    )}
                  </div>

                  {/* Address */}
                  {selectedShop.visibility?.showAddress && selectedShop.address && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Address
                      </h4>
                      <div className="text-gray-600 dark:text-gray-400">
                        {selectedShop.address.street && <p>{selectedShop.address.street}</p>}
                        <p>
                          {selectedShop.address.city}
                          {selectedShop.address.state && `, ${selectedShop.address.state}`}
                          {selectedShop.address.pincode && ` - ${selectedShop.address.pincode}`}
                        </p>
                        {selectedShop.address.country && <p>{selectedShop.address.country}</p>}
                      </div>
                    </div>
                  )}

                  {/* Contact Information */}
                  {selectedShop.visibility?.showContact && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        Contact Information
                      </h4>
                      <div className="space-y-3">
                        {selectedShop.contact?.whatsappNumber && (
                          <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.785"/>
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">WhatsApp</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedShop.contact.whatsappNumber}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handleWhatsAppClick(selectedShop.contact.whatsappNumber)}
                              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Open WhatsApp
                            </button>
                          </div>
                        )}

                        {selectedShop.contact?.customerSupport1 && (
                          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Customer Support 1</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedShop.contact.customerSupport1}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePhoneClick(selectedShop.contact.customerSupport1)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Call
                            </button>
                          </div>
                        )}

                        {selectedShop.contact?.customerSupport2 && (
                          <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Customer Support 2</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedShop.contact.customerSupport2}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => handlePhoneClick(selectedShop.contact.customerSupport2)}
                              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                              Call
                            </button>
                          </div>
                        )}

                        {selectedShop.contact?.alternateEmail && (
                          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-500 rounded-full flex items-center justify-center">
                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">Email</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{selectedShop.contact.alternateEmail}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => window.location.href = `mailto:${selectedShop.contact.alternateEmail}`}
                              className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
                            >
                              Email
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Chat Button Section */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 p-4 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white">Start a conversation</h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Connect directly with {selectedShop.shopName || selectedShop.displayName}</p>
                      </div>
                      <button
                        onClick={() => {
                          handleChatClick(selectedShop);
                          setShowShopDetails(false);
                        }}
                        className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-6 py-3 rounded-xl transition-all duration-200 transform hover:scale-105 flex items-center space-x-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                        </svg>
                        <span>Start Chat</span>
                      </button>
                    </div>
                  </div>

                  {/* Add Distributor Section */}
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="font-medium text-gray-900 dark:text-white flex items-center">
                          <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Add to Your Contacts
                        </h5>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Save this distributor to your customer or vendor list</p>
                      </div>
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleAddDistributor(selectedShop, 'customer')}
                        className="flex-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Add as Customer</span>
                      </button>
                      <button
                        onClick={() => handleAddDistributor(selectedShop, 'vendor')}
                        className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span>Add as Vendor</span>
                      </button>
                    </div>
                  </div>

                  {/* Business Information */}
                  {selectedShop.visibility?.showBusinessInfo && selectedShop.businessInfo && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        Business Information
                      </h4>
                      <div className="space-y-2 text-gray-600 dark:text-gray-400">
                        {selectedShop.businessInfo.gstNumber && (
                          <p><span className="font-medium">GST Number:</span> {selectedShop.businessInfo.gstNumber}</p>
                        )}
                        {selectedShop.businessInfo.yearEstablished && (
                          <p><span className="font-medium">Established:</span> {selectedShop.businessInfo.yearEstablished}</p>
                        )}
                        {selectedShop.businessInfo.specializations && selectedShop.businessInfo.specializations.length > 0 && (
                          <div>
                            <p className="font-medium mb-1">Specializations:</p>
                            <div className="flex flex-wrap gap-2">
                              {selectedShop.businessInfo.specializations.map((spec, index) => (
                                <span key={index} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <p>Shop details not available</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MarketplaceDashboard; 
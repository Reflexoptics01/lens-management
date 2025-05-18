import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, orderBy, limit, Timestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';

// Charting libraries
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
         PieChart, Pie, Cell, LineChart, Line } from 'recharts';

const Dashboard = () => {
  // Date state
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  // Analytics timeframe (yearly, quarterly, monthly)
  const [timeframe, setTimeframe] = useState('yearly');
  
  // Loading and error states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [debugMode, setDebugMode] = useState(false);
  
  // Dashboard data states
  const [salesData, setSalesData] = useState({
    todaySales: 0,
    lastMonthSameDay: 0,
    lastYearSameDay: 0,
    monthlyProjection: 0
  });
  
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [showGSTReminder, setShowGSTReminder] = useState(false);
  
  // Product analytics
  const [topProducts, setTopProducts] = useState([]);
  const [topLensPowers, setTopLensPowers] = useState([]);
  const [monthlySales, setMonthlySales] = useState([]);
  
  // Debug data
  const [debugData, setDebugData] = useState(null);
  
  useEffect(() => {
    // Check if we should show GST reminder (after 4th and before 10th of month)
    const today = new Date();
    const dayOfMonth = today.getDate();
    setShowGSTReminder(dayOfMonth >= 4 && dayOfMonth <= 10);
    
    // Logging to verify GST reminder logic
    console.log('Day of month:', dayOfMonth);
    console.log('Should show GST reminder:', dayOfMonth >= 4 && dayOfMonth <= 10);
    
    // Load dashboard data for initial view
    loadDashboardData(selectedDate);
  }, []);
  
  // Handle date change
  const handleDateChange = (date) => {
    setSelectedDate(date);
    loadDashboardData(date);
    
    // Check if we should show GST reminder (after 4th and before 10th of month)
    const selectedDay = new Date(date).getDate();
    setShowGSTReminder(selectedDay >= 4 && selectedDay <= 10);
  };
  
  // Handle timeframe change
  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe);
    fetchProductAnalytics(selectedDate, newTimeframe);
  };
  
  // Main function to load all dashboard data
  const loadDashboardData = async (dateString) => {
    try {
      setLoading(true);
      setError('');
      setDebugData(null);
      
      // Parse the selected date
      const selectedDate = new Date(dateString);
      
      // Fetch today's sales
      await fetchSalesData(selectedDate);
      
      // Fetch pending orders that haven't been updated in 3+ days
      await fetchPendingOrders();
      
      // Fetch product analytics with current timeframe
      await fetchProductAnalytics(selectedDate, timeframe);
      
      // Fetch monthly sales for trends
      await fetchMonthlySales();
      
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setError('Failed to load dashboard data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Debug function to inspect sales data
  const fetchDebugData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get recent sales for debugging
      const salesRef = collection(db, 'sales');
      const recentSalesQuery = query(
        salesRef,
        orderBy('invoiceDate', 'desc'),
        limit(5)
      );
      
      const salesSnapshot = await getDocs(recentSalesQuery);
      
      // Extract the actual data structure
      const debugSalesData = salesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          invoiceDate: data.invoiceDate ? data.invoiceDate.toDate().toISOString() : null,
          totalAmount: data.totalAmount,
          items: data.items ? data.items.map(item => ({
            productName: item.productName,
            price: item.price,
            quantity: item.quantity,
            lensPower: item.lensPower
          })) : []
        };
      });
      
      setDebugData(debugSalesData);
      
    } catch (error) {
      console.error('Error fetching debug data:', error);
      setError('Failed to load debug data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // Helper function to get a Firestore timestamp for a specific day
  const getDayTimestamps = (date) => {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    return {
      start: Timestamp.fromDate(startOfDay),
      end: Timestamp.fromDate(endOfDay)
    };
  };
  
  // Fetch sales for today, same day last month, and same day last year
  const fetchSalesData = async (selectedDate) => {
    // Calculate comparison dates
    const lastMonth = new Date(selectedDate);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const lastYear = new Date(selectedDate);
    lastYear.setFullYear(lastYear.getFullYear() - 1);
    
    // Today's timestamp range
    const todayTimestamps = getDayTimestamps(selectedDate);
    
    // Last month same day timestamp range
    const lastMonthTimestamps = getDayTimestamps(lastMonth);
    
    // Last year same day timestamp range
    const lastYearTimestamps = getDayTimestamps(lastYear);
    
    // Fetch today's sales
    const salesRef = collection(db, 'sales');
    
    const todaySalesQuery = query(
      salesRef,
      where('invoiceDate', '>=', todayTimestamps.start),
      where('invoiceDate', '<=', todayTimestamps.end)
    );
    
    const lastMonthSalesQuery = query(
      salesRef,
      where('invoiceDate', '>=', lastMonthTimestamps.start),
      where('invoiceDate', '<=', lastMonthTimestamps.end)
    );
    
    const lastYearSalesQuery = query(
      salesRef,
      where('invoiceDate', '>=', lastYearTimestamps.start),
      where('invoiceDate', '<=', lastYearTimestamps.end)
    );
    
    // Get today's sales
    const todaySalesSnapshot = await getDocs(todaySalesQuery);
    const todaySalesAmount = todaySalesSnapshot.docs.reduce(
      (total, doc) => total + (doc.data().totalAmount || 0), 0
    );
    
    // Get last month same day sales
    const lastMonthSalesSnapshot = await getDocs(lastMonthSalesQuery);
    const lastMonthSalesAmount = lastMonthSalesSnapshot.docs.reduce(
      (total, doc) => total + (doc.data().totalAmount || 0), 0
    );
    
    // Get last year same day sales
    const lastYearSalesSnapshot = await getDocs(lastYearSalesQuery);
    const lastYearSalesAmount = lastYearSalesSnapshot.docs.reduce(
      (total, doc) => total + (doc.data().totalAmount || 0), 0
    );
    
    // Calculate monthly projection based on current month's sales
    const currentMonthStart = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1);
    const currentMonthEnd = new Date(selectedDate);
    
    const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate();
    const daysPassed = selectedDate.getDate();
    
    // Monthly sales to date
    const monthSalesQuery = query(
      salesRef,
      where('invoiceDate', '>=', Timestamp.fromDate(currentMonthStart)),
      where('invoiceDate', '<=', Timestamp.fromDate(currentMonthEnd))
    );
    
    const monthSalesSnapshot = await getDocs(monthSalesQuery);
    const monthToDateSales = monthSalesSnapshot.docs.reduce(
      (total, doc) => total + (doc.data().totalAmount || 0), 0
    );
    
    // Project monthly sales (simple linear projection)
    const monthlyProjection = daysPassed > 0 
      ? (monthToDateSales / daysPassed) * daysInMonth 
      : 0;
    
    setSalesData({
      todaySales: todaySalesAmount,
      lastMonthSameDay: lastMonthSalesAmount,
      lastYearSameDay: lastYearSalesAmount,
      monthlyProjection
    });
  };
  
  // Fetch pending orders that haven't been updated in 3+ days
  const fetchPendingOrders = async () => {
    try {
      // Calculate date threshold (3 days ago)
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - 3);
      const thresholdTimestamp = Timestamp.fromDate(thresholdDate);

      // First get all orders that haven't been updated recently
      const ordersRef = collection(db, 'orders');
      const pendingOrdersQuery = query(
        ordersRef,
        where('updatedAt', '<=', thresholdTimestamp),
        orderBy('updatedAt', 'asc')
      );

      const pendingOrdersSnapshot = await getDocs(pendingOrdersQuery);
      
      // Then filter out completed/delivered orders in JavaScript
      const pendingOrdersList = pendingOrdersSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          updatedAt: doc.data().updatedAt
        }))
        .filter(order => 
          order.status !== 'Delivered' && 
          order.status !== 'Completed'
        );

      setPendingOrders(pendingOrdersList);
      setPendingOrdersCount(pendingOrdersList.length);
    } catch (error) {
      console.error('Error fetching pending orders:', error);
      setError('Failed to load pending orders: ' + error.message);
    }
  };
  
  // Calculate date range based on timeframe and selected date
  const getTimeframeDateRange = (date, timeframeType) => {
    const selectedDate = new Date(date);
    let startDate = new Date(selectedDate);
    const endDate = new Date(selectedDate);
    
    // Set end date to end of day
    endDate.setHours(23, 59, 59, 999);
    
    switch (timeframeType) {
      case 'monthly':
        // Start from beginning of month
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
        
      case 'quarterly':
        // Start from 3 months ago
        startDate.setMonth(startDate.getMonth() - 2);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);
        break;
        
      case 'yearly':
      default:
        // Start from 1 year ago
        startDate.setFullYear(startDate.getFullYear() - 1);
        startDate.setHours(0, 0, 0, 0);
        break;
    }
    
    return { 
      startDate,
      endDate
    };
  };
  
  // Fetch product analytics (top selling products and lens powers)
  const fetchProductAnalytics = async (selectedDate, currentTimeframe) => {
    try {
      // Get date range based on timeframe
      const { startDate, endDate } = getTimeframeDateRange(selectedDate, currentTimeframe);
      
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      
      console.log(`Fetching products from ${startDate.toDateString()} to ${endDate.toDateString()} (${currentTimeframe})`);
      
      // Fetch all sales invoices for the selected timeframe with a simple range query
      const salesRef = collection(db, 'sales');
      const salesQuery = query(
        salesRef,
        where('invoiceDate', '>=', startTimestamp),
        orderBy('invoiceDate', 'asc')
      );
      
      const salesSnapshot = await getDocs(salesQuery);
      console.log('Found sales documents:', salesSnapshot.docs.length);
      
      // Debug: Check sales structure
      if (salesSnapshot.docs.length > 0) {
        const sampleSale = salesSnapshot.docs[0].data();
        console.log('Sample sale structure:', JSON.stringify({
          invoiceDate: sampleSale.invoiceDate ? 'Timestamp object' : 'missing',
          items: Array.isArray(sampleSale.items) ? `Array with ${sampleSale.items.length} items` : 'missing or not an array',
          sampleItem: sampleSale.items && sampleSale.items.length > 0 ? sampleSale.items[0] : 'No items'
        }, null, 2));
      }
      
      // Product frequency map
      const productCounts = {};
      const productRevenue = {};
      const powerCounts = {};
      
      // Process all sales data but filter by end date in JavaScript
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        const saleDate = sale.invoiceDate?.toDate();
        
        // Skip sales after the end date
        if (!saleDate || saleDate > endDate) {
          return;
        }
        
        console.log(`Processing sale ${doc.id}, date: ${saleDate}, items: ${sale.items?.length || 0}`);
        
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            // Debug: Log individual item
            console.log(`Item: ${item.productName || 'Unknown'}, Price: ${item.price}, Qty: ${item.quantity}, Power: ${item.lensPower || 'N/A'}`);
            
            // Count product frequencies
            const productName = item.productName || 'Unknown Product';
            if (!productCounts[productName]) {
              productCounts[productName] = 0;
              productRevenue[productName] = 0;
            }
            productCounts[productName] += item.quantity || 1;
            productRevenue[productName] += (item.price * item.quantity) || 0;
            
            // Count lens power frequencies
            if (item.lensPower) {
              const power = item.lensPower.toString();
              if (!powerCounts[power]) {
                powerCounts[power] = 0;
              }
              powerCounts[power] += item.quantity || 1;
            }
          });
        }
      });
      
      console.log('Product counts:', productCounts);
      console.log('Product revenue:', productRevenue);
      console.log('Power counts:', powerCounts);
      
      // Convert to array and sort by frequency for top products
      const topProductsArray = Object.keys(productCounts).map(name => ({
        name,
        count: productCounts[name],
        revenue: productRevenue[name]
      })).sort((a, b) => b.revenue - a.revenue);
      
      // Convert lens powers to array and sort by frequency
      const topLensPowersArray = Object.keys(powerCounts).map(power => ({
        power,
        count: powerCounts[power]
      })).sort((a, b) => b.count - a.count);
      
      // Set state with top 10 products and lens powers
      setTopProducts(topProductsArray.slice(0, 10));
      setTopLensPowers(topLensPowersArray.slice(0, 10));
      
      console.log('Top products:', topProductsArray.slice(0, 10));
      console.log('Top lens powers:', topLensPowersArray.slice(0, 10));
      
    } catch (error) {
      console.error('Error fetching product analytics:', error);
      setError('Failed to load product analytics: ' + error.message);
    }
  };
  
  // Fetch monthly sales trends
  const fetchMonthlySales = async () => {
    try {
      // Get data for previous 6 months
      const endDate = new Date(selectedDate);
      const startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - 5); // Get 6 months of data
      
      // Set to start of first month
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
      
      const startTimestamp = Timestamp.fromDate(startDate);
      const endTimestamp = Timestamp.fromDate(endDate);
      
      // Fetch all sales in the 6-month period with a simpler query
      const salesRef = collection(db, 'sales');
      const salesQuery = query(
        salesRef,
        where('invoiceDate', '>=', startTimestamp),
        orderBy('invoiceDate', 'asc')
      );
      
      const salesSnapshot = await getDocs(salesQuery);
      
      // Group sales by month
      const monthlyData = {};
      
      // Initialize all 6 months with zero values
      for (let i = 0; i < 6; i++) {
        const monthDate = new Date(startDate);
        monthDate.setMonth(monthDate.getMonth() + i);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
        
        monthlyData[monthKey] = {
          month: monthName,
          sales: 0,
          invoiceCount: 0
        };
      }
      
      // Process all sales data and filter by end date in JavaScript
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        if (sale.invoiceDate) {
          const date = sale.invoiceDate.toDate();
          
          // Skip sales after the end date
          if (date > endDate) {
            return;
          }
          
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          
          if (monthlyData[monthKey]) {
            monthlyData[monthKey].sales += sale.totalAmount || 0;
            monthlyData[monthKey].invoiceCount += 1;
          }
        }
      });
      
      // Convert to array for chart
      const monthlySalesArray = Object.values(monthlyData);
      setMonthlySales(monthlySalesArray);
      
      console.log('Monthly sales data:', monthlySalesArray);
      
    } catch (error) {
      console.error('Error fetching monthly sales:', error);
      setError('Failed to load monthly sales trends: ' + error.message);
    }
  };

  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
        <div className="mb-4">
          <h1 className="text-xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Business metrics and insights</p>
        </div>
        
        {/* Date Selector */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => handleDateChange(e.target.value)}
                className="rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2"
              />
            </div>
            <div className="flex items-center">
              <span className="text-sm text-gray-500 mr-2">
                {loading ? 'Loading data...' : 'Data updated'}
              </span>
              <button
                onClick={() => {
                  setDebugMode(!debugMode);
                  if (!debugMode) fetchDebugData();
                }}
                className="ml-2 text-xs bg-gray-100 hover:bg-gray-200 text-gray-800 py-1 px-2 rounded"
              >
                {debugMode ? 'Hide Debug' : 'Debug Data'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Debug data display */}
        {debugMode && debugData && (
          <div className="mb-4 p-4 bg-gray-50 rounded-lg shadow overflow-hidden">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Debug Data (Recent Sales)</h3>
            <div className="bg-white p-3 rounded overflow-x-auto text-xs">
              <pre>{JSON.stringify(debugData, null, 2)}</pre>
            </div>
            <div className="mt-3 text-xs text-gray-500">
              <p>Quick tips:</p>
              <ul className="list-disc pl-5 mt-1 space-y-1">
                <li>Check if the "items" array exists and contains products</li>
                <li>Verify that products have "productName", "price", and "quantity" fields</li>
                <li>For lens powers, check if the "lensPower" field exists on items</li>
              </ul>
            </div>
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        {/* GST Filing Reminder */}
        {showGSTReminder && (
          <div className="mb-4 p-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-md">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">GST Filing Reminder</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>It's time to generate GST returns and send them to your CA. The last date for filing without penalty is the 10th of this month.</p>
                </div>
                <div className="mt-3">
                  <a
                    href="/gst-returns"
                    className="text-sm font-medium text-yellow-800 hover:text-yellow-900"
                  >
                    Generate GST Returns →
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Sales Comparison Cards */}
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">Sales Comparison</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Today's Sales Card */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
                <h3 className="text-sm font-medium text-blue-800">
                  Sales on {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </h3>
              </div>
              <div className="p-4">
                <p className="text-2xl font-bold text-gray-900">
                  ₹{salesData.todaySales.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                
                <div className="mt-4 space-y-3">
                  {/* Comparison with Last Month */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Last Month (Same Day)</span>
                    <div className="flex items-center">
                      <span className="text-sm font-medium">
                        ₹{salesData.lastMonthSameDay.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      
                      {salesData.lastMonthSameDay > 0 && (
                        <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                          salesData.todaySales >= salesData.lastMonthSameDay
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {salesData.lastMonthSameDay > 0
                            ? `${Math.round((salesData.todaySales / salesData.lastMonthSameDay - 1) * 100)}%`
                            : 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Comparison with Last Year */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">Last Year (Same Day)</span>
                    <div className="flex items-center">
                      <span className="text-sm font-medium">
                        ₹{salesData.lastYearSameDay.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                      
                      {salesData.lastYearSameDay > 0 && (
                        <span className={`ml-2 text-xs font-medium px-2 py-0.5 rounded-full ${
                          salesData.todaySales >= salesData.lastYearSameDay
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {salesData.lastYearSameDay > 0
                            ? `${Math.round((salesData.todaySales / salesData.lastYearSameDay - 1) * 100)}%`
                            : 'N/A'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Monthly Projection Card */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-purple-50 border-b border-purple-100">
                <h3 className="text-sm font-medium text-purple-800">
                  Monthly Sales Projection
                </h3>
              </div>
              <div className="p-4">
                <p className="text-2xl font-bold text-gray-900">
                  ₹{salesData.monthlyProjection.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                
                <div className="mt-2">
                  <p className="text-sm text-gray-500">
                    Based on sales from {new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} and earlier this month
                  </p>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-gray-800">
                      Progress: {new Date(selectedDate).getDate()} of {new Date(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth() + 1, 0).getDate()} days
                    </span>
                    <span className="text-gray-600">
                      {Math.round((new Date(selectedDate).getDate() / new Date(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth() + 1, 0).getDate()) * 100)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5 mt-2">
                    <div 
                      className="bg-purple-600 h-2.5 rounded-full" 
                      style={{ 
                        width: `${Math.round((new Date(selectedDate).getDate() / new Date(new Date(selectedDate).getFullYear(), new Date(selectedDate).getMonth() + 1, 0).getDate()) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Pending Orders Reminder */}
        <div className="mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-3">Order Status Reminders</h2>
          
          {pendingOrders.length > 0 ? (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-orange-50 border-b border-orange-100">
                <h3 className="text-sm font-medium text-orange-800">
                  Orders without status update for 3+ days ({pendingOrders.length})
                </h3>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Updated</th>
                      <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th scope="col" className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {pendingOrders.slice(0, 5).map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{order.id.substring(0, 8)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{order.customerName}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-500">
                          {order.updatedAt 
                            ? new Date(order.updatedAt.toDate()).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric'
                              }) 
                            : 'N/A'}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm">
                          <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">
                            {order.status}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-right">
                          <a 
                            href={`/orders/${order.id}`} 
                            className="text-blue-600 hover:text-blue-900"
                          >
                            View
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {pendingOrders.length > 5 && (
                <div className="px-4 py-2 text-sm text-center border-t border-gray-200">
                  <a href="/orders" className="text-blue-600 hover:text-blue-900">
                    View all {pendingOrders.length} pending orders
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow p-4 text-center">
              <p className="text-sm text-gray-500">No orders need attention at this time</p>
            </div>
          )}
        </div>
        
        {/* Analytics Section */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h2 className="text-lg font-medium text-gray-900">Analytics</h2>
            <div className="flex space-x-1 text-xs">
              <button 
                onClick={() => handleTimeframeChange('monthly')}
                className={`px-3 py-1 rounded-md ${
                  timeframe === 'monthly' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Month
              </button>
              <button 
                onClick={() => handleTimeframeChange('quarterly')}
                className={`px-3 py-1 rounded-md ${
                  timeframe === 'quarterly' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Quarter
              </button>
              <button 
                onClick={() => handleTimeframeChange('yearly')}
                className={`px-3 py-1 rounded-md ${
                  timeframe === 'yearly' 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Year
              </button>
            </div>
          </div>
          
          {/* Monthly Sales Trend Chart */}
          <div className="bg-white rounded-lg shadow overflow-hidden mb-4">
            <div className="px-4 py-3 bg-blue-50 border-b border-blue-100">
              <h3 className="text-sm font-medium text-blue-800">Monthly Sales Trend</h3>
            </div>
            <div className="p-4">
              {monthlySales.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={monthlySales}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="month" />
                    <YAxis 
                      tickFormatter={(value) => `₹${value/1000}K`}
                    />
                    <Tooltip 
                      formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Sales']}
                      labelFormatter={(label) => `Month: ${label}`}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sales" 
                      stroke="#4F46E5" 
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">No sales data available</p>
                </div>
              )}
            </div>
          </div>
          
          {/* Product Analysis Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            {/* Top Products Chart */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-green-50 border-b border-green-100">
                <h3 className="text-sm font-medium text-green-800">
                  Top Products by Revenue ({timeframe === 'yearly' ? 'Year' : timeframe === 'quarterly' ? 'Quarter' : 'Month'})
                </h3>
              </div>
              <div className="p-4">
                {topProducts && topProducts.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={topProducts.slice(0, 10)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tickFormatter={(value) => `₹${value/1000}K`} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip 
                        formatter={(value) => [`₹${value.toLocaleString('en-IN')}`, 'Revenue']}
                      />
                      <Bar dataKey="revenue" fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No product data available for this period</p>
                    <p className="text-sm text-gray-400 mt-2">Make sure you have sales with products in the selected date range</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Top Lens Powers Chart */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100">
                <h3 className="text-sm font-medium text-indigo-800">
                  Popular Lens Powers ({timeframe === 'yearly' ? 'Year' : timeframe === 'quarterly' ? 'Quarter' : 'Month'})
                </h3>
              </div>
              <div className="p-4">
                {topLensPowers && topLensPowers.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={topLensPowers.slice(0, 10)}
                        dataKey="count"
                        nameKey="power"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={30}
                        fill="#8884d8"
                        label={({name, percent}) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      >
                        {topLensPowers.slice(0, 10).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#ffc658', '#ff8042', '#d0ed57', '#59a14f', '#4e79a7'][index % 10]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} units`, 'Quantity']} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-500">No lens power data available for this period</p>
                    <p className="text-sm text-gray-400 mt-2">Make sure you have sales with lens powers in the selected date range</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {/* Top Products Table */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100">
              <h3 className="text-sm font-medium text-emerald-800">
                Top Selling Products ({timeframe === 'yearly' ? 'Year' : timeframe === 'quarterly' ? 'Quarter' : 'Month'})
              </h3>
            </div>
            <div className="overflow-x-auto">
              {topProducts && topProducts.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rank</th>
                      <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product Name</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Units Sold</th>
                      <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {topProducts.slice(0, 10).map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-900">{index + 1}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{product.name}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{product.count}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                          ₹{product.revenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="p-4 text-center">
                  <p className="text-gray-500">No product data available for this period</p>
                  <p className="text-sm text-gray-400 mt-2">Try selecting a different date range</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
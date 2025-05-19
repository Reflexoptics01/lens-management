import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  AreaChart, 
  Area, 
  ReferenceLine,
  Label 
} from 'recharts';

const LensDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lens, setLens] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [salesData, setSalesData] = useState({
    monthly: [],
    quarterly: [],
    yearly: []
  });
  const [financialMetrics, setFinancialMetrics] = useState({
    totalValue: 0,
    breakEvenQty: 0,
    potentialProfit: 0,
    totalUnitsSold: 0,
    totalRevenue: 0,
    averageSellingPrice: 0
  });

  useEffect(() => {
    fetchLensDetails();
  }, [id]);

  const fetchLensDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch the lens details
      const lensDoc = await getDoc(doc(db, 'lens_inventory', id));
      
      if (!lensDoc.exists()) {
        throw new Error('Lens not found');
      }
      
      const lensData = { id: lensDoc.id, ...lensDoc.data() };
      setLens(lensData);
      
      // After getting the lens data, fetch sales metrics
      await fetchSalesMetrics(lensData);
      calculateFinancialMetrics(lensData);
      
    } catch (error) {
      console.error('Error fetching lens details:', error);
      setError('Could not load lens details. ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesMetrics = async (lensData) => {
    try {
      // This requires sales data to be stored in a 'sales' collection
      // with each sale item having a lensId field to match with
      
      const salesRef = collection(db, 'sales');
      
      // Use lens brand name, type, and other identifiers to match sales
      // This will depend on your exact sales data structure
      let lensIdentifier = lensData.brandName;
      
      if (lensData.type === 'stock' && lensData.powerSeries) {
        lensIdentifier += ' ' + lensData.powerSeries;
      } else if (lensData.type === 'prescription') {
        if (lensData.sph) lensIdentifier += ' ' + lensData.sph;
        if (lensData.cyl) lensIdentifier += ' ' + lensData.cyl;
      }
      
      // Get current date and calculate date ranges
      const now = new Date();
      
      // Last month
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      
      // Last quarter (3 months)
      const lastQuarterStart = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      
      // Last year
      const lastYearStart = new Date(now.getFullYear() - 1, now.getMonth(), 1);
      
      // Query for monthly sales
      const monthlyQuery = query(
        salesRef,
        where('createdAt', '>=', lastMonthStart),
        orderBy('createdAt', 'asc')
      );
      
      // Query for quarterly sales
      const quarterlyQuery = query(
        salesRef,
        where('createdAt', '>=', lastQuarterStart),
        orderBy('createdAt', 'asc')
      );
      
      // Query for yearly sales
      const yearlyQuery = query(
        salesRef,
        where('createdAt', '>=', lastYearStart),
        orderBy('createdAt', 'asc')
      );
      
      // Execute queries
      const [monthlySnapshot, quarterlySnapshot, yearlySnapshot] = await Promise.all([
        getDocs(monthlyQuery),
        getDocs(quarterlyQuery),
        getDocs(yearlyQuery)
      ]);
      
      // Process sales data
      // This is a simplified version - you'll need to adapt to your actual data structure
      const processItems = (snapshot) => {
        const sales = [];
        let totalUnits = 0;
        let totalRevenue = 0;
        
        snapshot.docs.forEach(doc => {
          const sale = doc.data();
          // Check if this sale contains our lens
          if (sale.items && Array.isArray(sale.items)) {
            sale.items.forEach(item => {
              // Match the item name with our lens identifier
              if (item.itemName && item.itemName.includes(lensIdentifier)) {
                const saleDate = sale.createdAt.toDate();
                const dateStr = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;
                
                // Find if we already have an entry for this month
                const existingEntry = sales.find(s => s.date === dateStr);
                
                if (existingEntry) {
                  existingEntry.units += item.qty || 1;
                  existingEntry.revenue += item.total || 0;
                } else {
                  sales.push({
                    date: dateStr,
                    units: item.qty || 1,
                    revenue: item.total || 0
                  });
                }
                
                totalUnits += item.qty || 1;
                totalRevenue += item.total || 0;
              }
            });
          }
        });
        
        return {
          salesByPeriod: sales,
          totalUnits,
          totalRevenue
        };
      };
      
      const monthlyData = processItems(monthlySnapshot);
      const quarterlyData = processItems(quarterlySnapshot);
      const yearlyData = processItems(yearlySnapshot);
      
      setSalesData({
        monthly: monthlyData.salesByPeriod,
        quarterly: quarterlyData.salesByPeriod,
        yearly: yearlyData.salesByPeriod
      });
      
      // Update financial metrics with sales data
      setFinancialMetrics(prev => ({
        ...prev,
        totalUnitsSold: yearlyData.totalUnits,
        totalRevenue: yearlyData.totalRevenue,
        averageSellingPrice: yearlyData.totalUnits > 0 ? yearlyData.totalRevenue / yearlyData.totalUnits : 0
      }));
      
    } catch (error) {
      console.error('Error fetching sales metrics:', error);
    }
  };

  const calculateFinancialMetrics = (lensData) => {
    // Calculate total value of inventory
    const qty = parseInt(lensData.qty || 1);
    const purchasePrice = parseFloat(lensData.purchasePrice || 0);
    const salePrice = parseFloat(lensData.salePrice || 0);
    
    // Total investment
    const totalValue = qty * purchasePrice;
    
    // Potential revenue if all units are sold
    const potentialRevenue = qty * salePrice;
    
    // Potential profit if all units are sold
    const potentialProfit = potentialRevenue - totalValue;
    
    // Calculate break-even quantity - Units needed to recover total investment
    let breakEvenQty = 0;
    
    if (salePrice > 0) {
      // Break-even formula: Total inventory cost / Sale price per unit
      breakEvenQty = Math.ceil(totalValue / salePrice);
      
      // If break-even quantity exceeds available quantity, it means we can't break even
      if (breakEvenQty > qty) {
        breakEvenQty = Infinity; // Indicates can't break even with current stock
      }
    } else {
      // If sale price is zero, can't break even
      breakEvenQty = Infinity;
    }
    
    setFinancialMetrics(prev => ({
      ...prev,
      totalValue,
      breakEvenQty,
      potentialProfit
    }));
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4 rounded-r">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={() => navigate('/lens-inventory')}
            className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none shadow-sm transition-colors"
          >
            Back to Inventory
          </button>
        </main>
      </div>
    );
  }

  if (!lens) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold text-gray-800">Lens not found</h2>
            <p className="mt-2 text-gray-600">The requested lens could not be found.</p>
            <button 
              onClick={() => navigate('/lens-inventory')}
              className="mt-4 px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none shadow-sm transition-colors"
            >
              Back to Inventory
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{lens.brandName}</h1>
            <p className="text-sm text-gray-500">
              {lens.type === 'stock' ? (
                <>Stock Lens - {lens.powerSeries}</>
              ) : (
                <>Prescription Lens - SPH: {lens.sph || 'N/A'} CYL: {lens.cyl || 'N/A'} AXIS: {lens.axis || 'N/A'}</>
              )}
            </p>
          </div>
          <button
            onClick={() => navigate('/lens-inventory')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to Inventory
          </button>
        </div>

        {/* Lens Details Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Lens Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Basic Information</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-500">Brand Name:</span>
                  <span className="ml-2 font-medium">{lens.brandName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Type:</span>
                  <span className="ml-2 font-medium capitalize">{lens.type || 'N/A'}</span>
                </div>
                {lens.type === 'stock' && (
                  <div>
                    <span className="text-sm text-gray-500">Power Series:</span>
                    <span className="ml-2 font-medium">{lens.powerSeries || 'N/A'}</span>
                  </div>
                )}
                {lens.type === 'prescription' && (
                  <>
                    <div>
                      <span className="text-sm text-gray-500">SPH:</span>
                      <span className="ml-2 font-medium">{lens.sph || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">CYL:</span>
                      <span className="ml-2 font-medium">{lens.cyl || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">AXIS:</span>
                      <span className="ml-2 font-medium">{lens.axis || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">ADD:</span>
                      <span className="ml-2 font-medium">{lens.add || 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Specifications</h3>
              <div className="space-y-2">
                {lens.type === 'prescription' && (
                  <>
                    <div>
                      <span className="text-sm text-gray-500">Material:</span>
                      <span className="ml-2 font-medium">{lens.material || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Index:</span>
                      <span className="ml-2 font-medium">{lens.index || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Coating:</span>
                      <span className="ml-2 font-medium">{lens.coatingType || 'N/A'} {lens.coatingColor ? `(${lens.coatingColor})` : ''}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Base Tint:</span>
                      <span className="ml-2 font-medium">{lens.baseTint || 'N/A'}</span>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Diameter:</span>
                      <span className="ml-2 font-medium">{lens.diameter ? `${lens.diameter}mm` : 'N/A'}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">Inventory & Pricing</h3>
              <div className="space-y-2">
                <div>
                  <span className="text-sm text-gray-500">Quantity in Stock:</span>
                  <span className="ml-2 font-medium">{lens.qty || '0'}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Purchase Price:</span>
                  <span className="ml-2 font-medium">{formatCurrency(lens.purchasePrice || 0)}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-500">Sale Price:</span>
                  <span className="ml-2 font-medium">{formatCurrency(lens.salePrice || 0)}</span>
                </div>
                {lens.type === 'prescription' && (
                  <div>
                    <span className="text-sm text-gray-500">Storage Location:</span>
                    <span className="ml-2 font-medium">{lens.location || 'N/A'}</span>
                  </div>
                )}
                {lens.notes && (
                  <div>
                    <span className="text-sm text-gray-500">Notes:</span>
                    <span className="ml-2 font-medium">{lens.notes}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Financial Analysis Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Financial Analysis</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-blue-700 uppercase mb-2">Inventory Value</h3>
              <div className="text-2xl font-bold text-blue-700">{formatCurrency(financialMetrics.totalValue)}</div>
              <p className="text-sm text-blue-600 mt-1">Total value of {lens.qty || 0} units in stock</p>
            </div>
            
            <div className={`${financialMetrics.breakEvenQty === Infinity ? 'bg-red-50' : 'bg-green-50'} p-4 rounded-lg`}>
              <h3 className={`text-sm font-semibold ${financialMetrics.breakEvenQty === Infinity ? 'text-red-700' : 'text-green-700'} uppercase mb-2`}>Break-Even Point</h3>
              <div className={`text-2xl font-bold ${financialMetrics.breakEvenQty === Infinity ? 'text-red-700' : 'text-green-700'}`}>
                {financialMetrics.breakEvenQty === Infinity ? 
                  "Not achievable" : 
                  `${financialMetrics.breakEvenQty} units`}
              </div>
              <p className={`text-sm ${financialMetrics.breakEvenQty === Infinity ? 'text-red-600' : 'text-green-600'} mt-1`}>
                {financialMetrics.breakEvenQty === Infinity ?
                  "Cannot recover investment with current stock" :
                  "Units needed to recover your total investment"}
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-purple-700 uppercase mb-2">Potential Profit</h3>
              <div className="text-2xl font-bold text-purple-700">{formatCurrency(financialMetrics.potentialProfit)}</div>
              <p className="text-sm text-purple-600 mt-1">If all units are sold at set price</p>
            </div>
            
            <div className="bg-amber-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-amber-700 uppercase mb-2">Total Units Sold (Year)</h3>
              <div className="text-2xl font-bold text-amber-700">{financialMetrics.totalUnitsSold}</div>
              <p className="text-sm text-amber-600 mt-1">Units sold in the last 12 months</p>
            </div>
            
            <div className="bg-sky-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-sky-700 uppercase mb-2">Total Revenue (Year)</h3>
              <div className="text-2xl font-bold text-sky-700">{formatCurrency(financialMetrics.totalRevenue)}</div>
              <p className="text-sm text-sky-600 mt-1">Revenue generated in the last 12 months</p>
            </div>
            
            <div className="bg-rose-50 p-4 rounded-lg">
              <h3 className="text-sm font-semibold text-rose-700 uppercase mb-2">Average Selling Price</h3>
              <div className="text-2xl font-bold text-rose-700">{formatCurrency(financialMetrics.averageSellingPrice)}</div>
              <p className="text-sm text-rose-600 mt-1">Average price per unit sold</p>
            </div>
          </div>
        </div>
        
        {/* Sales Trends Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Sales Trends</h2>
          
          {/* Monthly Sales Chart */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-700 mb-4">Monthly Sales (Last 30 Days)</h3>
            {salesData.monthly.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesData.monthly}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="units" name="Units Sold" fill="#8884d8" />
                    <Bar yAxisId="right" dataKey="revenue" name="Revenue (₹)" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No sales data available for this period
              </div>
            )}
          </div>
          
          {/* Quarterly Sales Chart */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-700 mb-4">Quarterly Sales (Last 3 Months)</h3>
            {salesData.quarterly.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={salesData.quarterly}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="units" name="Units Sold" stroke="#8884d8" activeDot={{ r: 8 }} />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No sales data available for this period
              </div>
            )}
          </div>
          
          {/* Yearly Sales Chart */}
          <div>
            <h3 className="text-md font-semibold text-gray-700 mb-4">Yearly Sales (Last 12 Months)</h3>
            {salesData.yearly.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={salesData.yearly}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                    <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                    <Tooltip />
                    <Legend />
                    <Line yAxisId="left" type="monotone" dataKey="units" name="Units Sold" stroke="#8884d8" activeDot={{ r: 8 }} />
                    <Line yAxisId="right" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#82ca9d" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No sales data available for this period
              </div>
            )}
          </div>
        </div>

        {/* Trend Analysis Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Trend Analysis</h2>
          
          {/* Sales Velocity Chart */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-700 mb-4">Sales Velocity (Units per Month)</h3>
            {salesData.yearly.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={salesData.yearly.map(entry => ({
                      date: entry.date,
                      velocity: (entry.units / 30).toFixed(2) // Calculate avg units per day
                    }))}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="velocity" name="Sales Velocity" stroke="#ff7300" activeDot={{ r: 8 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No trend data available
              </div>
            )}
          </div>
          
          {/* Profit Margin Trend */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-700 mb-4">Profit Margin Trend</h3>
            {salesData.yearly.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={salesData.yearly.map(entry => {
                      const revenue = entry.revenue;
                      const purchaseCost = (lens.purchasePrice || 0) * entry.units;
                      const profit = revenue - purchaseCost;
                      const margin = purchaseCost > 0 ? ((profit / revenue) * 100).toFixed(1) : 0;
                      
                      return {
                        date: entry.date,
                        margin: Number(margin)
                      };
                    })}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis label={{ value: 'Profit Margin (%)', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => [`${value}%`, 'Margin']} />
                    <Legend />
                    <Bar dataKey="margin" name="Profit Margin %" fill="#8BC34A" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No trend data available
              </div>
            )}
          </div>
          
          {/* Inventory Turnover Analysis */}
          <div>
            <h3 className="text-md font-semibold text-gray-700 mb-4">Inventory Turnover Analysis</h3>
            {salesData.quarterly.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={salesData.quarterly.map((entry, index) => {
                      // Calculate turnover rate (units sold relative to inventory)
                      const turnoverRate = entry.units / (lens.qty || 1);
                      
                      return {
                        date: entry.date,
                        turnover: Number(turnoverRate.toFixed(2))
                      };
                    })}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis label={{ value: 'Turnover Rate', angle: -90, position: 'insideLeft' }} />
                    <Tooltip formatter={(value) => [`${value}`, 'Turnover Rate']} />
                    <Legend />
                    <Area type="monotone" dataKey="turnover" name="Inventory Turnover" stroke="#9C27B0" fill="#9C27B0" fillOpacity={0.3} />
                    <ReferenceLine y={0.3} stroke="red" strokeDasharray="3 3">
                      <Label value="Optimal Turnover" position="right" />
                    </ReferenceLine>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No inventory turnover data available
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default LensDetail; 
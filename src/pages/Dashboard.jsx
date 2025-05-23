import { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import Navbar from '../components/Navbar';

const Dashboard = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [loading, setLoading] = useState(false);
  const [salesData, setSalesData] = useState({
    today: 0,
    thisMonth: 0,
    thisYear: 0,
    lastYearSameDay: 0,
    lastYearSameMonth: 0,
    lastYear: 0,
    monthlyProjection: 0,
    yearlyProjection: 0
  });
  
  const [topProducts, setTopProducts] = useState([]);
  const [topPowers, setTopPowers] = useState([]);
  const [topProfitProducts, setTopProfitProducts] = useState([]);
  
  useEffect(() => {
    loadDashboardData();
  }, [selectedDate]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSalesData(),
        fetchTopProducts(),
        fetchTopPowers(),
        fetchTopProfitProducts()
      ]);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSalesData = async () => {
    try {
      const salesRef = collection(db, 'sales');
      const salesSnapshot = await getDocs(query(salesRef, orderBy('invoiceDate', 'desc')));
      
      const selectedDateObj = new Date(selectedDate);
      const today = new Date();
      
      // Date ranges
      const startOfToday = new Date(selectedDateObj);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(selectedDateObj);
      endOfToday.setHours(23, 59, 59, 999);
      
      const startOfMonth = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1);
      const endOfMonth = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 0);
      
      const startOfYear = new Date(selectedDateObj.getFullYear(), 0, 1);
      const endOfYear = new Date(selectedDateObj.getFullYear(), 11, 31);
      
      // Last year dates
      const lastYearSameDay = new Date(selectedDateObj);
      lastYearSameDay.setFullYear(lastYearSameDay.getFullYear() - 1);
      
      const startOfLastYearSameMonth = new Date(selectedDateObj.getFullYear() - 1, selectedDateObj.getMonth(), 1);
      const endOfLastYearSameMonth = new Date(selectedDateObj.getFullYear() - 1, selectedDateObj.getMonth() + 1, 0);
      
      const startOfLastYear = new Date(selectedDateObj.getFullYear() - 1, 0, 1);
      const endOfLastYear = new Date(selectedDateObj.getFullYear() - 1, 11, 31);
      
      let todaySales = 0;
      let monthSales = 0;
      let yearSales = 0;
      let lastYearSameDaySales = 0;
      let lastYearSameMonthSales = 0;
      let lastYearTotalSales = 0;
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        if (!sale.invoiceDate || !sale.totalAmount) return;
        
        const saleDate = sale.invoiceDate.toDate();
        const amount = parseFloat(sale.totalAmount) || 0;
        
        // Today's sales
        if (saleDate >= startOfToday && saleDate <= endOfToday) {
          todaySales += amount;
        }
        
        // This month's sales
        if (saleDate >= startOfMonth && saleDate <= endOfMonth) {
          monthSales += amount;
        }
        
        // This year's sales
        if (saleDate >= startOfYear && saleDate <= endOfYear) {
          yearSales += amount;
        }
        
        // Last year same day
        const lastYearSameDayStart = new Date(lastYearSameDay);
        lastYearSameDayStart.setHours(0, 0, 0, 0);
        const lastYearSameDayEnd = new Date(lastYearSameDay);
        lastYearSameDayEnd.setHours(23, 59, 59, 999);
        
        if (saleDate >= lastYearSameDayStart && saleDate <= lastYearSameDayEnd) {
          lastYearSameDaySales += amount;
        }
        
        // Last year same month
        if (saleDate >= startOfLastYearSameMonth && saleDate <= endOfLastYearSameMonth) {
          lastYearSameMonthSales += amount;
        }
        
        // Last year total
        if (saleDate >= startOfLastYear && saleDate <= endOfLastYear) {
          lastYearTotalSales += amount;
        }
      });
      
      // Calculate projections
      const daysInMonth = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 0).getDate();
      const daysPassed = selectedDateObj.getDate();
      const monthlyProjection = daysPassed > 0 ? (monthSales / daysPassed) * daysInMonth : 0;
      
      const daysInYear = new Date(selectedDateObj.getFullYear(), 11, 31).getDate() === 31 ? 366 : 365;
      const dayOfYear = Math.floor((selectedDateObj - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
      const yearlyProjection = dayOfYear > 0 ? (yearSales / dayOfYear) * daysInYear : 0;
      
      setSalesData({
        today: todaySales,
        thisMonth: monthSales,
        thisYear: yearSales,
        lastYearSameDay: lastYearSameDaySales,
        lastYearSameMonth: lastYearSameMonthSales,
        lastYear: lastYearTotalSales,
        monthlyProjection,
        yearlyProjection
      });
      
    } catch (error) {
      console.error('Error fetching sales data:', error);
    }
  };

  const fetchTopProducts = async () => {
    try {
      const salesRef = collection(db, 'sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productCounts = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            const productName = item.itemName || item.productName || 'Unknown Product';
            const qty = parseInt(item.qty) || 1;
            
            if (!productCounts[productName]) {
              productCounts[productName] = 0;
            }
            productCounts[productName] += qty;
          });
        }
      });
      
      const sortedProducts = Object.entries(productCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      setTopProducts(sortedProducts);
    } catch (error) {
      console.error('Error fetching top products:', error);
    }
  };

  const fetchTopPowers = async () => {
    try {
      const salesRef = collection(db, 'sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const powerCounts = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            if (item.sph) {
              const power = item.sph.toString();
              const qty = parseInt(item.qty) || 1;
              
              if (!powerCounts[power]) {
                powerCounts[power] = 0;
              }
              powerCounts[power] += qty;
            }
          });
        }
      });
      
      const sortedPowers = Object.entries(powerCounts)
        .map(([power, count]) => ({ power, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      setTopPowers(sortedPowers);
    } catch (error) {
      console.error('Error fetching top powers:', error);
    }
  };

  const fetchTopProfitProducts = async () => {
    try {
      const salesRef = collection(db, 'sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productProfits = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            const productName = item.itemName || item.productName || 'Unknown Product';
            const qty = parseInt(item.qty) || 1;
            const price = parseFloat(item.price) || 0;
            const cost = parseFloat(item.cost) || parseFloat(item.costPrice) || 0;
            const profit = (price - cost) * qty;
            
            if (!productProfits[productName]) {
              productProfits[productName] = { profit: 0, revenue: 0 };
            }
            productProfits[productName].profit += profit;
            productProfits[productName].revenue += price * qty;
          });
        }
      });
      
      const sortedProfitProducts = Object.entries(productProfits)
        .map(([name, data]) => ({ 
          name, 
          profit: data.profit, 
          revenue: data.revenue,
          profitMargin: data.revenue > 0 ? (data.profit / data.revenue * 100) : 0
        }))
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 20);
      
      setTopProfitProducts(sortedProfitProducts);
    } catch (error) {
      console.error('Error fetching top profit products:', error);
    }
  };

  const formatCurrency = (amount) => {
    return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getChangePercentage = (current, previous) => {
    if (previous === 0) return 'N/A';
    return `${Math.round(((current - previous) / previous) * 100)}%`;
  };

  const getChangeColor = (current, previous) => {
    if (previous === 0) return 'text-gray-500';
    return current >= previous ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Business overview and key metrics</p>
        </div>
        
        {/* Date Selector */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Date for Analysis
          </label>
              <input
                type="date"
                value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-blue-500"
              />
          {loading && (
            <span className="ml-4 text-sm text-gray-500">Loading data...</span>
          )}
            </div>

        {/* Sales Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Today's Sales */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Today's Sales</h3>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(salesData.today)}</p>
            <div className="mt-2 flex items-center">
              <span className="text-sm text-gray-500 mr-2">vs Last Year Same Day:</span>
              <span className={`text-sm font-medium ${getChangeColor(salesData.today, salesData.lastYearSameDay)}`}>
                {getChangePercentage(salesData.today, salesData.lastYearSameDay)}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Last Year: {formatCurrency(salesData.lastYearSameDay)}
            </p>
        </div>
        
          {/* This Month */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">This Month</h3>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(salesData.thisMonth)}</p>
            <div className="mt-2 flex items-center">
              <span className="text-sm text-gray-500 mr-2">vs Last Year Same Month:</span>
              <span className={`text-sm font-medium ${getChangeColor(salesData.thisMonth, salesData.lastYearSameMonth)}`}>
                {getChangePercentage(salesData.thisMonth, salesData.lastYearSameMonth)}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Last Year: {formatCurrency(salesData.lastYearSameMonth)}
            </p>
          </div>

          {/* This Year */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">This Year</h3>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(salesData.thisYear)}</p>
            <div className="mt-2 flex items-center">
              <span className="text-sm text-gray-500 mr-2">vs Last Year:</span>
              <span className={`text-sm font-medium ${getChangeColor(salesData.thisYear, salesData.lastYear)}`}>
                {getChangePercentage(salesData.thisYear, salesData.lastYear)}
                        </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              Last Year Total: {formatCurrency(salesData.lastYear)}
                  </p>
                </div>
                
          {/* Projections */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Projections</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-gray-600">Monthly Projection:</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(salesData.monthlyProjection)}</p>
                  </div>
              <div>
                <p className="text-sm text-gray-600">Yearly Projection:</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(salesData.yearlyProjection)}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Top Products Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products by Quantity */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-blue-50 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Top 20 Products by Sales</h3>
              </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topProducts.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{product.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
          
          {/* Top Powers */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-green-50 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Top 20 SPH Powers</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Power</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {topPowers.map((power, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{power.power}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">{power.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Top Profit Products */}
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 bg-yellow-50 border-b">
              <h3 className="text-lg font-semibold text-gray-900">Top 20 Profit Products</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Margin</th>
                    </tr>
                  </thead>
                <tbody className="divide-y divide-gray-200">
                  {topProfitProducts.map((product, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                      <td className="px-4 py-2 text-sm text-gray-900">{index + 1}</td>
                      <td className="px-4 py-2 text-sm text-gray-900">{product.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                        {formatCurrency(product.profit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-900 text-right">
                        {product.profitMargin.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard; 
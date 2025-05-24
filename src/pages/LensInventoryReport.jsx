import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, getDocs } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

const LensInventoryReport = () => {
  const [lenses, setLenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { isDark } = useTheme();
  
  // Get current date for report generation
  const currentDate = new Date().toLocaleDateString('en-IN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  useEffect(() => {
    fetchLensInventory();
  }, []);
  
  const fetchLensInventory = async () => {
    try {
      setLoading(true);
      setError('');
      
      const lensRef = collection(db, 'lens_inventory');
      const snapshot = await getDocs(lensRef);
      
      const lensesList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setLenses(lensesList);
    } catch (error) {
      console.error('Error fetching lens inventory:', error);
      setError('Failed to fetch lens inventory data');
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '₹0.00';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };
  
  const calculateInventoryMetrics = () => {
    // Calculate total inventory statistics
    const totalQty = lenses.reduce((sum, lens) => sum + (parseInt(lens.qty) || 0), 0);
    const totalValue = lenses.reduce((sum, lens) => {
      const qty = parseInt(lens.qty) || 0;
      const price = parseFloat(lens.purchasePrice) || 0;
      return sum + (qty * price);
    }, 0);
    const potentialSaleValue = lenses.reduce((sum, lens) => {
      const qty = parseInt(lens.qty) || 0;
      const price = parseFloat(lens.salePrice) || 0;
      return sum + (qty * price);
    }, 0);
    const potentialProfit = potentialSaleValue - totalValue;
    const profitMargin = totalValue > 0 ? (potentialProfit / totalValue) * 100 : 0;
    
    // Categorize by lens type
    const stockLenses = lenses.filter(lens => lens.type === 'stock');
    const prescriptionLenses = lenses.filter(lens => lens.type === 'prescription');
    
    const stockQty = stockLenses.reduce((sum, lens) => sum + (parseInt(lens.qty) || 0), 0);
    const prescriptionQty = prescriptionLenses.reduce((sum, lens) => sum + (parseInt(lens.qty) || 0), 0);
    
    const stockValue = stockLenses.reduce((sum, lens) => {
      const qty = parseInt(lens.qty) || 0;
      const price = parseFloat(lens.purchasePrice) || 0;
      return sum + (qty * price);
    }, 0);
    
    const prescriptionValue = prescriptionLenses.reduce((sum, lens) => {
      const qty = parseInt(lens.qty) || 0;
      const price = parseFloat(lens.purchasePrice) || 0;
      return sum + (qty * price);
    }, 0);
    
    // Group by brand name
    const brandGroups = {};
    lenses.forEach(lens => {
      const brand = lens.brandName || 'Unspecified';
      if (!brandGroups[brand]) {
        brandGroups[brand] = {
          qty: 0,
          value: 0
        };
      }
      
      brandGroups[brand].qty += parseInt(lens.qty) || 0;
      brandGroups[brand].value += (parseInt(lens.qty) || 0) * (parseFloat(lens.purchasePrice) || 0);
    });
    
    // Sort brands by value
    const sortedBrands = Object.entries(brandGroups)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, data]) => ({
        name,
        qty: data.qty,
        value: data.value
      }));

    // Material distribution
    const materialGroups = {};
    lenses.forEach(lens => {
      if (!lens.material) return;
      
      const material = lens.material;
      if (!materialGroups[material]) {
        materialGroups[material] = {
          qty: 0,
          value: 0
        };
      }
      
      materialGroups[material].qty += parseInt(lens.qty) || 0;
      materialGroups[material].value += (parseInt(lens.qty) || 0) * (parseFloat(lens.purchasePrice) || 0);
    });
    
    const materialDistribution = Object.entries(materialGroups)
      .map(([name, data]) => ({
        name,
        value: data.qty
      }));
    
    return {
      totalQty,
      totalValue,
      potentialSaleValue,
      potentialProfit,
      profitMargin,
      stockQty,
      prescriptionQty,
      stockValue,
      prescriptionValue,
      topBrands: sortedBrands.slice(0, 5),
      materialDistribution,
      inventoryTypePieData: [
        { name: 'Stock Lenses', value: stockQty },
        { name: 'Prescription Lenses', value: prescriptionQty }
      ],
      inventoryValuePieData: [
        { name: 'Stock Lenses', value: stockValue },
        { name: 'Prescription Lenses', value: prescriptionValue }
      ]
    };
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <main className="flex-grow px-4 py-8 max-w-7xl mx-auto">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <main className="flex-grow px-4 py-8 max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 rounded-r mb-4">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
          <button 
            onClick={() => navigate('/lens-inventory')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Back to Inventory
          </button>
        </main>
      </div>
    );
  }

  const metrics = calculateInventoryMetrics();
  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#83a6ed'];

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="flex-grow px-4 py-8 max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lens Inventory Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Generated on {currentDate}</p>
          </div>
          <button
            onClick={() => navigate('/lens-inventory')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            Back to Inventory
          </button>
        </div>
        
        {/* Print Button */}
        <div className="mb-6 text-right">
          <button 
            onClick={() => window.print()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none print:hidden"
          >
            Print Report
          </button>
        </div>
        
        {/* Summary Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-400 uppercase mb-1">Total Inventory</h3>
            <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{metrics.totalQty} units</div>
            <p className="text-sm text-blue-600 dark:text-blue-300">{formatCurrency(metrics.totalValue)}</p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-green-700 dark:text-green-400 uppercase mb-1">Potential Revenue</h3>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(metrics.potentialSaleValue)}</div>
            <p className="text-sm text-green-600 dark:text-green-300">If all inventory is sold</p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-400 uppercase mb-1">Potential Profit</h3>
            <div className="text-2xl font-bold text-purple-700 dark:text-purple-400">{formatCurrency(metrics.potentialProfit)}</div>
            <p className="text-sm text-purple-600 dark:text-purple-300">Margin: {metrics.profitMargin.toFixed(1)}%</p>
          </div>
        </div>
        
        {/* Inventory Distribution Charts */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Inventory Distribution</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Quantity Distribution */}
            <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">Quantity by Type</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.inventoryTypePieData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {metrics.inventoryTypePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [`${value} units`, 'Quantity']}
                      contentStyle={{ 
                        backgroundColor: isDark ? '#1E293B' : '#fff', 
                        borderColor: isDark ? '#334155' : '#E5E7EB',
                        color: isDark ? '#F1F5F9' : '#111827'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            {/* Value Distribution */}
            <div>
              <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">Value by Type</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.inventoryValuePieData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                      label={({name, percent}) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {metrics.inventoryValuePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value) => [formatCurrency(value), 'Value']}
                      contentStyle={{ 
                        backgroundColor: isDark ? '#1E293B' : '#fff', 
                        borderColor: isDark ? '#334155' : '#E5E7EB',
                        color: isDark ? '#F1F5F9' : '#111827'
                      }}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
        
        {/* Inventory Breakdown */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inventory by Type</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">% of Total</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Stock Lenses</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{metrics.stockQty} units</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{((metrics.stockQty / metrics.totalQty) * 100).toFixed(1)}% of total</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(metrics.stockValue)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{((metrics.stockValue / metrics.totalValue) * 100).toFixed(1)}%</div>
                  </td>
                </tr>
                <tr className="bg-gray-50 dark:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">Prescription Lenses</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{metrics.prescriptionQty} units</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">{((metrics.prescriptionQty / metrics.totalQty) * 100).toFixed(1)}% of total</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(metrics.prescriptionValue)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900 dark:text-white">{((metrics.prescriptionValue / metrics.totalValue) * 100).toFixed(1)}%</div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        {/* Top Brands Analysis */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Brands by Value</h2>
          
          {metrics.topBrands.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Brand</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quantity</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Value</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">% of Total</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {metrics.topBrands.map((brand, index) => (
                      <tr key={brand.name} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">{brand.name}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{brand.qty} units</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{formatCurrency(brand.value)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900 dark:text-white">{((brand.value / metrics.totalValue) * 100).toFixed(1)}%</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              <div>
                <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4 text-center">Brand Distribution</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={metrics.topBrands.map(brand => ({
                        name: brand.name,
                        value: brand.value
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#E5E7EB"} />
                      <XAxis dataKey="name" tick={{ fill: isDark ? "#CBD5E1" : "#374151" }} />
                      <YAxis tick={{ fill: isDark ? "#CBD5E1" : "#374151" }} />
                      <Tooltip 
                        formatter={(value) => [formatCurrency(value), 'Value']}
                        contentStyle={{ 
                          backgroundColor: isDark ? '#1E293B' : '#fff', 
                          borderColor: isDark ? '#334155' : '#E5E7EB',
                          color: isDark ? '#F1F5F9' : '#111827'
                        }}
                      />
                      <Legend />
                      <Bar dataKey="value" name="Inventory Value" fill="#8884d8" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400 p-4 rounded-r">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">No brand data available</p>
            </div>
          )}
        </div>
        
        {/* Material Distribution */}
        {metrics.materialDistribution.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-8">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Material Distribution</h2>
            
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={metrics.materialDistribution}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  layout="vertical"
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "#334155" : "#E5E7EB"} />
                  <XAxis type="number" tick={{ fill: isDark ? "#CBD5E1" : "#374151" }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fill: isDark ? "#CBD5E1" : "#374151" }} />
                  <Tooltip 
                    formatter={(value) => [`${value} units`, 'Quantity']}
                    contentStyle={{ 
                      backgroundColor: isDark ? '#1E293B' : '#fff', 
                      borderColor: isDark ? '#334155' : '#E5E7EB',
                      color: isDark ? '#F1F5F9' : '#111827'
                    }}
                  />
                  <Legend />
                  <Bar dataKey="value" name="Quantity" fill="#82ca9d" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Recommendations */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inventory Insights</h2>
          
          <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4">
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700 dark:text-gray-300">
              {metrics.profitMargin < 20 && (
                <li>Consider increasing sale prices to improve profit margins, which are currently at {metrics.profitMargin.toFixed(1)}%</li>
              )}
              
              {metrics.stockQty > metrics.totalQty * 0.7 && (
                <li>Stock lenses make up {((metrics.stockQty / metrics.totalQty) * 100).toFixed(1)}% of your inventory. Consider diversifying with more prescription lenses.</li>
              )}
              
              {metrics.prescriptionQty > metrics.totalQty * 0.7 && (
                <li>Prescription lenses make up {((metrics.prescriptionQty / metrics.totalQty) * 100).toFixed(1)}% of your inventory. Consider adding more stock lenses for walk-in customers.</li>
              )}
              
              {metrics.topBrands.length > 0 && metrics.topBrands[0].value > metrics.totalValue * 0.4 && (
                <li>Your inventory is heavily concentrated in {metrics.topBrands[0].name} ({((metrics.topBrands[0].value / metrics.totalValue) * 100).toFixed(1)}% of total value). Consider diversifying your brand portfolio.</li>
              )}
              
              <li>Total potential profit from current inventory: {formatCurrency(metrics.potentialProfit)}</li>
            </ul>
          </div>
        </div>
        
        {/* Add custom styles for printing to ensure it uses light mode for printed version */}
        <style>
          {`
            @media print {
              /* Force light theme for printing */
              body * {
                background-color: white !important;
                color: black !important;
                border-color: #E5E7EB !important;
              }
              
              /* Hide print button when printing */
              .print\\:hidden {
                display: none !important;
              }
            }
          `}
        </style>
      </main>
    </div>
  );
};

export default LensInventoryReport; 
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, updateDoc, collection, getDocs, query, where, orderBy, addDoc, Timestamp } from 'firebase/firestore';
import { getUserDoc, getUserCollection } from '../utils/multiTenancy';
import { formatDate, formatDateTime } from '../utils/dateUtils';
import Navbar from '../components/Navbar';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const ItemDetail = () => {
  const { itemId } = useParams();
  const navigate = useNavigate();
  
  const [item, setItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sales metrics
  const [salesMetrics, setSalesMetrics] = useState({
    totalSold: 0,
    totalRevenue: 0,
    averageSellingPrice: 0,
    lastSaleDate: null,
    topCustomers: []
  });
  
  // Inventory adjustment
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  const [adjustmentType, setAdjustmentType] = useState('add'); // 'add' or 'deduct'
  const [adjustmentQuantity, setAdjustmentQuantity] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  
  // Stock alerts
  const [stockAlerts, setStockAlerts] = useState({
    lowStock: false,
    outOfStock: false,
    overstocked: false
  });

  useEffect(() => {
    if (itemId) {
      fetchItemDetails();
    }
  }, [itemId]);

  useEffect(() => {
    if (item) {
      fetchSalesMetrics(item);
      checkStockAlerts(item);
    }
  }, [item]);

  const exportToExcel = (item) => {
    try {
      const dataToExport = [{
        'Item Name': item.itemName,
        'Category': item.category || '',
        'Brand': item.brand || '',
        'Unit': item.unit || 'Pieces',
        'Current Stock': item.qty || 0,
        'Min Stock Level': item.minStockLevel || 0,
        'Max Stock Level': item.maxStockLevel || 0,
        'Purchase Price': item.purchasePrice || 0,
        'Sale Price': item.salePrice || 0,
        'Location': item.location || '',
        'Supplier': item.supplier || '',
        'Description': item.description || '',
        'Total Revenue': salesMetrics.totalRevenue,
        'Total Sold': salesMetrics.totalSold,
        'Last Sale Date': salesMetrics.lastSaleDate ? formatDate(salesMetrics.lastSaleDate) : 'Never'
      }];
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      
      // Auto-size columns
      const maxWidth = 20;
      const cols = Object.keys(dataToExport[0]).map(() => ({ width: maxWidth }));
      worksheet['!cols'] = cols;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Item Details');
      XLSX.writeFile(workbook, `${item.itemName}_details.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setError(`Failed to export: ${error.message}`);
    }
  };

  const exportToPDF = (item) => {
    try {
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(20);
      doc.text('Item Details Report', 20, 20);
      
      // Item basic info
      doc.setFontSize(12);
      let yPos = 40;
      
      const basicInfo = [
        ['Item Name:', item.itemName],
        ['Category:', item.category || '-'],
        ['Brand:', item.brand || '-'],
        ['Unit:', item.unit || 'Pieces'],
        ['Current Stock:', `${item.qty || 0}`],
        ['Min Stock Level:', `${item.minStockLevel || 0}`],
        ['Max Stock Level:', `${item.maxStockLevel || 0}`],
        ['Purchase Price:', `₹${item.purchasePrice || 0}`],
        ['Sale Price:', `₹${item.salePrice || 0}`],
        ['Location:', item.location || '-'],
        ['Supplier:', item.supplier || '-']
      ];
      
      basicInfo.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 80, yPos);
        yPos += 8;
      });
      
      // Sales metrics
      yPos += 10;
      doc.setFontSize(14);
      doc.text('Sales Metrics', 20, yPos);
      yPos += 10;
      
      doc.setFontSize(12);
      const metricsInfo = [
        ['Total Sold:', `${salesMetrics.totalSold}`],
        ['Total Revenue:', `₹${salesMetrics.totalRevenue.toLocaleString('en-IN')}`],
        ['Average Selling Price:', `₹${salesMetrics.averageSellingPrice.toLocaleString('en-IN')}`],
        ['Last Sale Date:', salesMetrics.lastSaleDate ? formatDate(salesMetrics.lastSaleDate) : 'Never']
      ];
      
      metricsInfo.forEach(([label, value]) => {
        doc.text(label, 20, yPos);
        doc.text(value, 80, yPos);
        yPos += 8;
      });
      
      // Description
      if (item.description) {
        yPos += 10;
        doc.setFontSize(14);
        doc.text('Description', 20, yPos);
        yPos += 10;
        
        doc.setFontSize(12);
        const splitDescription = doc.splitTextToSize(item.description, 170);
        doc.text(splitDescription, 20, yPos);
      }
      
      doc.save(`${item.itemName}_details.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      setError(`Failed to export PDF: ${error.message}`);
    }
  };

  const fetchItemDetails = async () => {
    try {
      setLoading(true);
      const itemRef = getUserDoc('lensInventory', itemId);
      const itemSnap = await getDoc(itemRef);
      
      if (itemSnap.exists()) {
        const itemData = { id: itemSnap.id, ...itemSnap.data() };
        setItem(itemData);
      } else {
        setError('Item not found');
      }
    } catch (error) {
      console.error('Error fetching item details:', error);
      setError('Failed to fetch item details');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesMetrics = async (itemData) => {
    try {
      // Fetch from sales collection
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      let totalSold = 0;
      let totalRevenue = 0;
      let lastSaleDate = null;
      const customerSales = {};
      
      const processItems = (snapshot) => {
        snapshot.docs.forEach(doc => {
          const saleData = doc.data();
          if (saleData.items && Array.isArray(saleData.items)) {
            saleData.items.forEach(saleItem => {
              // Match by item name (more flexible matching)
              const saleItemName = (saleItem.itemName || saleItem.name || '').toLowerCase().trim();
              const targetItemName = (itemData.itemName || itemData.name || '').toLowerCase().trim();
              
              if (saleItemName === targetItemName) {
                const qty = parseInt(saleItem.qty) || 0;
                const total = parseFloat(saleItem.total) || 0;
                
                totalSold += qty;
                totalRevenue += total;
                
                // Track last sale date
                const saleDate = saleData.createdAt?.toDate?.() || saleData.createdAt;
                if (saleDate && (!lastSaleDate || saleDate > lastSaleDate)) {
                  lastSaleDate = saleDate;
                }
                
                // Track customer sales
                const customerName = saleData.customerName || 'Unknown';
                if (!customerSales[customerName]) {
                  customerSales[customerName] = { qty: 0, revenue: 0 };
                }
                customerSales[customerName].qty += qty;
                customerSales[customerName].revenue += total;
              }
            });
          }
        });
      };
      
      processItems(salesSnapshot);
      
      // Calculate average selling price
      const averageSellingPrice = totalSold > 0 ? totalRevenue / totalSold : 0;
      
      // Get top customers
      const topCustomers = Object.entries(customerSales)
        .map(([customer, data]) => ({ customer, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      
      setSalesMetrics({
        totalSold,
        totalRevenue,
        averageSellingPrice,
        lastSaleDate,
        topCustomers
      });
      
    } catch (error) {
      console.error('Error fetching sales metrics:', error);
    }
  };

  const checkStockAlerts = (itemData) => {
    const currentStock = itemData.qty || 0;
    const minStock = itemData.minStockLevel || 0;
    const maxStock = itemData.maxStockLevel || 100;
    
    setStockAlerts({
      outOfStock: currentStock === 0,
      lowStock: currentStock > 0 && currentStock <= minStock,
      overstocked: currentStock > maxStock
    });
  };

  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '₹0';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const handleInventoryAdjustment = async () => {
    if (!adjustmentQuantity || adjustmentQuantity <= 0) {
      setError('Please enter a valid quantity');
      return;
    }
    
    if (!adjustmentReason.trim()) {
      setError('Please provide a reason for the adjustment');
      return;
    }
    
    try {
      const currentQty = item.qty || 0;
      const adjustQty = parseInt(adjustmentQuantity);
      let newQty;
      
      if (adjustmentType === 'add') {
        newQty = currentQty + adjustQty;
      } else {
        newQty = Math.max(0, currentQty - adjustQty); // Don't allow negative stock
      }
      
      // Update item quantity
      await updateDoc(getUserDoc('lensInventory', itemId), {
        qty: newQty,
        updatedAt: Timestamp.now()
      });
      
      // Log the adjustment (you might want to create a separate collection for this)
      const adjustmentLog = {
        itemId: itemId,
        itemName: item.itemName,
        type: adjustmentType,
        quantity: adjustQty,
        previousQty: currentQty,
        newQty: newQty,
        reason: adjustmentReason.trim(),
        createdAt: Timestamp.now(),
        userId: localStorage.getItem('userUid')
      };
      
      await addDoc(getUserCollection('inventoryAdjustments'), adjustmentLog);
      
      // Update local state
      setItem(prev => ({ ...prev, qty: newQty }));
      
      // Reset modal
      setShowInventoryModal(false);
      setAdjustmentQuantity('');
      setAdjustmentReason('');
      setError('');
      
      // Show success message
      alert(`Successfully ${adjustmentType === 'add' ? 'added' : 'deducted'} ${adjustQty} ${item.unit || 'pieces'}. New stock: ${newQty}`);
      
    } catch (error) {
      console.error('Error adjusting inventory:', error);
      setError(`Failed to adjust inventory: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
        </div>
      </div>
    );
  }

  if (error && !item) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="text-center">
            <div className="text-red-500 dark:text-red-400 mb-4">{error}</div>
            <button
              onClick={() => navigate('/lens-inventory')}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
            >
              Back to Inventory
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
          <div className="mb-4 sm:mb-0">
            <button
              onClick={() => navigate('/lens-inventory')}
              className="text-sky-600 dark:text-sky-400 hover:text-sky-800 dark:hover:text-sky-300 mb-2 flex items-center"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
              Back to Inventory
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {item?.itemName}
            </h1>
            <p className="text-gray-500 dark:text-gray-400">Item Details</p>
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowInventoryModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Adjust Stock
            </button>
            <button
              onClick={() => exportToExcel(item)}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Export Excel
            </button>
            <button
              onClick={() => exportToPDF(item)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Export PDF
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 border-l-4 border-red-400 bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        {/* Stock Alerts */}
        {(stockAlerts.outOfStock || stockAlerts.lowStock || stockAlerts.overstocked) && (
          <div className="mb-6 p-4 rounded-lg border-l-4 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/50">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Stock Alert
                </h3>
                <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                  {stockAlerts.outOfStock && <p>• This item is out of stock!</p>}
                  {stockAlerts.lowStock && <p>• Stock is running low (below minimum level)</p>}
                  {stockAlerts.overstocked && <p>• Stock is above maximum level</p>}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Item Information */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Item Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{item?.category || '-'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Brand</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{item?.brand || '-'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Unit</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{item?.unit || 'Pieces'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Location</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{item?.location || '-'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Supplier</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{item?.supplier || '-'}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Purchase Price</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{formatCurrency(item?.purchasePrice)}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Sale Price</label>
                  <p className="mt-1 text-sm font-medium text-green-600 dark:text-green-400">{formatCurrency(item?.salePrice)}</p>
                </div>
              </div>
              
              {item?.description && (
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
                  <p className="mt-1 text-sm text-gray-900 dark:text-white">{item.description}</p>
                </div>
              )}
            </div>
            
            {/* Sales Metrics */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Sales Performance</h2>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{salesMetrics.totalSold}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Total Sold</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(salesMetrics.totalRevenue)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Revenue</div>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(salesMetrics.averageSellingPrice)}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Avg Price</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {salesMetrics.lastSaleDate ? formatDate(salesMetrics.lastSaleDate) : 'Never'}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">Last Sale</div>
                </div>
              </div>
              
              {salesMetrics.topCustomers.length > 0 && (
                <div>
                  <h3 className="text-md font-semibold mb-3 text-gray-900 dark:text-white">Top Customers</h3>
                  <div className="space-y-2">
                    {salesMetrics.topCustomers.map((customer, index) => (
                      <div key={index} className="flex justify-between items-center py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded">
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{customer.customer}</span>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-green-600 dark:text-green-400">
                            {formatCurrency(customer.revenue)}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {customer.qty} units
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {/* Stock Information */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
              <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Stock Information</h2>
              
              <div className="space-y-4">
                <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{item?.qty || 0}</div>
                  <div className="text-sm text-blue-600 dark:text-blue-400">Current Stock</div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/50 rounded-lg">
                    <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{item?.minStockLevel || 0}</div>
                    <div className="text-xs text-orange-600 dark:text-orange-400">Min Level</div>
                  </div>
                  
                  <div className="text-center p-3 bg-green-50 dark:bg-green-900/50 rounded-lg">
                    <div className="text-lg font-bold text-green-600 dark:text-green-400">{item?.maxStockLevel || 0}</div>
                    <div className="text-xs text-green-600 dark:text-green-400">Max Level</div>
                  </div>
                </div>
                
                {/* Stock Status */}
                <div className="p-3 rounded-lg border">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</div>
                  {stockAlerts.outOfStock && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      Out of Stock
                    </span>
                  )}
                  {stockAlerts.lowStock && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                      Low Stock
                    </span>
                  )}
                  {stockAlerts.overstocked && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">
                      Overstocked
                    </span>
                  )}
                  {!stockAlerts.outOfStock && !stockAlerts.lowStock && !stockAlerts.overstocked && (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                      Normal Stock
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Inventory Adjustment Modal */}
      {showInventoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Adjust Inventory</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Adjustment Type
                </label>
                <select
                  value={adjustmentType}
                  onChange={(e) => setAdjustmentType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="add">Add Stock</option>
                  <option value="deduct">Deduct Stock</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity ({item?.unit || 'Pieces'})
                </label>
                <input
                  type="number"
                  value={adjustmentQuantity}
                  onChange={(e) => setAdjustmentQuantity(e.target.value)}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter quantity"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Reason
                </label>
                <textarea
                  value={adjustmentReason}
                  onChange={(e) => setAdjustmentReason(e.target.value)}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-1 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Enter reason for adjustment"
                />
              </div>
              
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={() => {
                    setShowInventoryModal(false);
                    setAdjustmentQuantity('');
                    setAdjustmentReason('');
                    setError('');
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
                <button
                  onClick={handleInventoryAdjustment}
                  className="px-4 py-2 bg-sky-600 text-white rounded-md text-sm font-medium hover:bg-sky-700"
                >
                  {adjustmentType === 'add' ? 'Add Stock' : 'Deduct Stock'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemDetail;
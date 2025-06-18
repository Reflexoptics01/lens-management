import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, where } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { safelyParseDate, formatDate } from '../utils/dateUtils';
import { MarketplaceNotificationBell } from '../components/MarketplaceNotifications';
import * as XLSX from 'xlsx';

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
  const [topProductPowers, setTopProductPowers] = useState([]);
  const [topProfitProducts, setTopProfitProducts] = useState([]);
  
  // GST Notification states
  const [gstNotifications, setGstNotifications] = useState([]);
  const [backupNotifications, setBackupNotifications] = useState([]);
  const [reorderNotifications, setReorderNotifications] = useState([]);
  
  // New states for additional dashboard metrics
  const [timePeriod, setTimePeriod] = useState('monthly'); // daily, monthly, quarterly, yearly
  const [additionalMetrics, setAdditionalMetrics] = useState({
    totalFreightCharges: 0,
    totalCashReceived: 0,
    totalUPIReceived: 0,
    totalBankTransferReceived: 0,
    topCustomers: []
  });

  // New state for monthly sales chart
  const [monthlySalesData, setMonthlySalesData] = useState([]);
  
  // New states for services section
  const [servicesTimePeriod, setServicesTimePeriod] = useState('monthly'); // daily, monthly, quarterly, yearly
  const [topServices, setTopServices] = useState([]);

  useEffect(() => {
    loadDashboardData();
    checkGSTNotifications();
    checkBackupNotifications();
    checkReorderNotifications();
  }, [selectedDate]);

  // Force data reload on component mount (helps after backup restoration)
  useEffect(() => {
    cleanupOldDismissals(); // Clean up old dismissal records
    loadDashboardData();
  }, []);

  // Reload additional metrics when time period changes
  useEffect(() => {
    if (selectedDate) { // Only fetch if selectedDate is set
      fetchAdditionalMetrics();
    }
  }, [timePeriod]);

  // Refresh services data when services time period changes
  useEffect(() => {
    if (servicesTimePeriod && selectedDate) {
      fetchTopServices();
    }
  }, [servicesTimePeriod, selectedDate]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchSalesData(),
        fetchTopProducts(),
        fetchTopServices(),
        fetchTopProductPowers(),
        fetchTopProfitProducts(),
        fetchAdditionalMetrics(),
        fetchMonthlySalesData()
      ]);
    } catch (error) {
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSalesData = async () => {
    try {
      const salesRef = getUserCollection('sales');
      
      let salesSnapshot;
      try {
        // Try with orderBy first
        salesSnapshot = await getDocs(query(salesRef, orderBy('invoiceDate', 'desc')));
      } catch (error) {
        // Fallback: get all sales without ordering
        salesSnapshot = await getDocs(salesRef);
      }
      
      const selectedDateObj = new Date(selectedDate);
      
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
        
        // Skip if no invoiceDate or totalAmount
        if (!sale.invoiceDate || !sale.totalAmount) {
          return;
        }
        
        // Convert timestamp safely
        const saleDate = safelyParseDate(sale.invoiceDate);
        if (!saleDate) {
          return;
        }
        
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
      
      // Fix yearly projection calculation - properly calculate days in year
      const startOfNextYear = new Date(selectedDateObj.getFullYear() + 1, 0, 1);
      const daysInYear = Math.floor((startOfNextYear - startOfYear) / (24 * 60 * 60 * 1000));
      const dayOfYear = Math.floor((selectedDateObj - startOfYear) / (24 * 60 * 60 * 1000)) + 1;
      const yearlyProjection = dayOfYear > 0 ? (yearSales / dayOfYear) * daysInYear : 0;
      
      const newSalesData = {
        today: todaySales,
        thisMonth: monthSales,
        thisYear: yearSales,
        lastYearSameDay: lastYearSameDaySales,
        lastYearSameMonth: lastYearSameMonthSales,
        lastYear: lastYearTotalSales,
        monthlyProjection,
        yearlyProjection
      };
      
      setSalesData(newSalesData);
      
    } catch (error) {
      // Set default values if there's an error
      setSalesData({
        today: 0,
        thisMonth: 0,
        thisYear: 0,
        lastYearSameDay: 0,
        lastYearSameMonth: 0,
        lastYear: 0,
        monthlyProjection: 0,
        yearlyProjection: 0
      });
    }
  };

  const fetchTopProducts = async () => {
    try {
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productCounts = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        // Skip invalid sales
        if (!sale.items || !Array.isArray(sale.items) || sale.items.length === 0) return;
        
        // Validate sale date if needed for time filtering
        const saleDate = safelyParseDate(sale.invoiceDate);
        if (sale.invoiceDate && (!saleDate || isNaN(saleDate.getTime()))) return;
        
        sale.items.forEach(item => {
          try {
            // Skip invalid items
            if (!item || typeof item !== 'object') return;
            
            // Skip services - check multiple ways services can be identified
            const isServiceItem = item.isService || 
                                item.type === 'service' || 
                                item.unit === 'Service' || 
                                item.unit === 'service' ||
                                (item.itemName && item.itemName.toLowerCase().includes('service')) ||
                                (item.serviceData && Object.keys(item.serviceData).length > 0);
            
            if (isServiceItem) {
              return; // Skip this item
            }
            
            const productName = (item.itemName || item.productName || '').trim();
            if (!productName || productName === 'Unknown Product') return;
            
            const qty = parseInt(item.qty) || 1;
            if (qty <= 0) return;
            
            if (!productCounts[productName]) {
              productCounts[productName] = 0;
            }
            productCounts[productName] += qty;
          } catch (error) {
            console.warn('Error processing item for top products:', error, item);
          }
        });
      });
      
      const sortedProducts = Object.entries(productCounts)
        .map(([name, count]) => ({ name, count }))
        .filter(item => item.count > 0) // Only include items with positive counts
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      setTopProducts(sortedProducts);
    } catch (error) {
      console.error('Error fetching top products:', error);
      setTopProducts([]);
    }
  };

  const fetchTopServices = async () => {
    try {
      const selectedDateObj = new Date(selectedDate);
      let startDate, endDate;
      
      // Calculate date range based on services time period
      switch (servicesTimePeriod) {
        case 'daily':
          startDate = new Date(selectedDateObj);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(selectedDateObj);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'monthly':
          startDate = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1);
          endDate = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'quarterly':
          const quarter = Math.floor(selectedDateObj.getMonth() / 3);
          startDate = new Date(selectedDateObj.getFullYear(), quarter * 3, 1);
          endDate = new Date(selectedDateObj.getFullYear(), quarter * 3 + 3, 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'yearly':
          startDate = new Date(selectedDateObj.getFullYear(), 0, 1);
          endDate = new Date(selectedDateObj.getFullYear(), 11, 31);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1);
          endDate = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
      }
      
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const serviceCounts = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        // Skip if no invoiceDate
        if (!sale.invoiceDate) return;
        
        const saleDate = safelyParseDate(sale.invoiceDate);
        if (!saleDate || saleDate < startDate || saleDate > endDate) return;
        
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            try {
              // Only include services - check multiple ways services can be identified
              const isServiceItem = item.isService || 
                                  item.type === 'service' || 
                                  item.unit === 'Service' || 
                                  item.unit === 'service' ||
                                  (item.itemName && item.itemName.toLowerCase().includes('service')) ||
                                  (item.serviceData && Object.keys(item.serviceData).length > 0);
              
              if (!isServiceItem) {
                return; // Skip non-service items
              }
              
              const serviceName = item.itemName || item.productName || 'Unknown Service';
              const qty = parseInt(item.qty) || 1;
              const price = parseFloat(item.price) || 0;
              const totalEarned = price * qty;
              
              if (!serviceCounts[serviceName]) {
                serviceCounts[serviceName] = {
                  name: serviceName,
                  count: 0,
                  totalEarned: 0
                };
              }
              serviceCounts[serviceName].count += qty;
              serviceCounts[serviceName].totalEarned += totalEarned;
            } catch (error) {
              // Skip invalid service items silently in production
            }
          });
        }
      });
      
      const sortedServices = Object.values(serviceCounts)
        .sort((a, b) => b.totalEarned - a.totalEarned) // Sort by total earnings
        .slice(0, 10);
      
      setTopServices(sortedServices);
    } catch (error) {
      // Handle errors gracefully by setting empty array
      setTopServices([]);
    }
  };

  const fetchTopProductPowers = async () => {
    try {
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productPowerCounts = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        // Skip invalid sales
        if (!sale.items || !Array.isArray(sale.items) || sale.items.length === 0) return;
        
        // Validate sale date if needed for time filtering
        const saleDate = safelyParseDate(sale.invoiceDate);
        if (sale.invoiceDate && (!saleDate || isNaN(saleDate.getTime()))) return;
        
        sale.items.forEach(item => {
          try {
            // Skip invalid items
            if (!item || typeof item !== 'object') return;
            
            const productName = (item.itemName || item.productName || '').trim();
            if (!productName || productName === 'Unknown Product') return;
            
            const qty = parseInt(item.qty) || 1;
            if (qty <= 0) return;
            
            // Build power specification string with improved validation
            let powerSpec = '';
            const sph = item.sph ? parseFloat(item.sph) : null;
            const cyl = item.cyl ? parseFloat(item.cyl) : null;
            const axis = item.axis ? parseInt(item.axis) : null;
            const add = item.add ? parseFloat(item.add) : null;
            
            // Only process items that have meaningful power data
            if (sph !== null && !isNaN(sph) && Math.abs(sph) >= 0.25) {
              powerSpec = `${sph >= 0 ? '+' : ''}${sph.toFixed(2)} SPH`;
              
              if (cyl !== null && !isNaN(cyl) && Math.abs(cyl) >= 0.25) {
                powerSpec += ` ${cyl >= 0 ? '+' : ''}${cyl.toFixed(2)} CYL`;
                
                if (axis !== null && !isNaN(axis) && axis > 0 && axis <= 180) {
                  powerSpec += ` ${axis}°`;
                }
              }
              
              if (add !== null && !isNaN(add) && Math.abs(add) >= 0.25) {
                powerSpec += ` ${add >= 0 ? '+' : ''}${add.toFixed(2)} ADD`;
              }
              
              // Create unique key combining product name and power
              const productPowerKey = `${productName} | ${powerSpec}`;
              
              if (!productPowerCounts[productPowerKey]) {
                productPowerCounts[productPowerKey] = {
                  productName,
                  powerSpec,
                  count: 0
                };
              }
              productPowerCounts[productPowerKey].count += qty;
            }
          } catch (error) {
            console.warn('Error processing item for product powers:', error, item);
          }
        });
      });
      
      const sortedProductPowers = Object.entries(productPowerCounts)
        .map(([key, data]) => ({
          productName: data.productName,
          powerSpec: data.powerSpec,
          count: data.count,
          displayName: `${data.productName} | ${data.powerSpec}`
        }))
        .filter(item => item.count > 0) // Only include items with positive counts
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      setTopProductPowers(sortedProductPowers);
    } catch (error) {
      console.error('Error fetching top product powers:', error);
      setTopProductPowers([]);
    }
  };

  const fetchTopProfitProducts = async () => {
    try {
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productProfits = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        // Skip invalid sales
        if (!sale.items || !Array.isArray(sale.items) || sale.items.length === 0) return;
        
        // Validate sale date if needed for time filtering
        const saleDate = safelyParseDate(sale.invoiceDate);
        if (sale.invoiceDate && (!saleDate || isNaN(saleDate.getTime()))) return;
        
        sale.items.forEach(item => {
          try {
            // Skip invalid items
            if (!item || typeof item !== 'object') return;
            
            const productName = (item.itemName || item.productName || '').trim();
            if (!productName || productName === 'Unknown Product') return;
            
            const qty = parseInt(item.qty) || 1;
            if (qty <= 0) return;
            
            const price = parseFloat(item.price) || 0;
            if (price <= 0) return; // Skip items with no valid price
            
            // Get cost price with improved validation
            let cost = 0;
            let isEstimatedCost = false;
            
            // Try to get actual cost from multiple possible fields
            if (item.cost && parseFloat(item.cost) > 0) {
              cost = parseFloat(item.cost);
            } else if (item.costPrice && parseFloat(item.costPrice) > 0) {
              cost = parseFloat(item.costPrice);
            } else if (item.purchasePrice && parseFloat(item.purchasePrice) > 0) {
              cost = parseFloat(item.purchasePrice);
            } else {
              // Use estimated cost only if no actual cost is available
              cost = price * 0.70; // Assume 30% margin if no cost price (more conservative)
              isEstimatedCost = true;
            }
            
            // Validate cost makes sense
            if (isNaN(cost) || cost < 0) {
              cost = price * 0.70;
              isEstimatedCost = true;
            }
            
            // Ensure cost doesn't exceed price (except for loss-making items)
            if (cost > price * 1.5) { // Allow some margin for data entry errors
              cost = price * 0.70;
              isEstimatedCost = true;
            }
            
            const profit = (price - cost) * qty;
            const revenue = price * qty;
            
            if (!productProfits[productName]) {
              productProfits[productName] = { 
                profit: 0, 
                revenue: 0, 
                hasEstimatedCost: false,
                actualCostItems: 0,
                estimatedCostItems: 0,
                totalItems: 0
              };
            }
            
            productProfits[productName].profit += profit;
            productProfits[productName].revenue += revenue;
            productProfits[productName].totalItems += qty;
            
            // Track cost estimation status
            if (isEstimatedCost) {
              productProfits[productName].hasEstimatedCost = true;
              productProfits[productName].estimatedCostItems += qty;
            } else {
              productProfits[productName].actualCostItems += qty;
            }
          } catch (error) {
            console.warn('Error processing item for profit products:', error, item);
          }
        });
      });
      
      const sortedProfitProducts = Object.entries(productProfits)
        .map(([name, data]) => ({ 
          name, 
          profit: data.profit, 
          revenue: data.revenue,
          profitMargin: data.revenue > 0 ? (data.profit / data.revenue * 100) : 0,
          hasEstimatedCost: data.hasEstimatedCost,
          actualCostItems: data.actualCostItems,
          estimatedCostItems: data.estimatedCostItems,
          totalItems: data.totalItems
        }))
        .filter(item => item.revenue > 0 && item.totalItems > 0) // Only include items with valid data
        .sort((a, b) => b.profit - a.profit)
        .slice(0, 20);
      
      setTopProfitProducts(sortedProfitProducts);
    } catch (error) {
      console.error('Error fetching top profit products:', error);
      setTopProfitProducts([]);
    }
  };

  const fetchAdditionalMetrics = async () => {
    try {
      const selectedDateObj = new Date(selectedDate);
      let startDate, endDate;
      
      // Calculate date range based on time period
      switch (timePeriod) {
        case 'daily':
          startDate = new Date(selectedDateObj);
          startDate.setHours(0, 0, 0, 0);
          endDate = new Date(selectedDateObj);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'monthly':
          startDate = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1);
          endDate = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'quarterly':
          const quarter = Math.floor(selectedDateObj.getMonth() / 3);
          startDate = new Date(selectedDateObj.getFullYear(), quarter * 3, 1);
          endDate = new Date(selectedDateObj.getFullYear(), quarter * 3 + 3, 0);
          endDate.setHours(23, 59, 59, 999);
          break;
        case 'yearly':
          startDate = new Date(selectedDateObj.getFullYear(), 0, 1);
          endDate = new Date(selectedDateObj.getFullYear(), 11, 31);
          endDate.setHours(23, 59, 59, 999);
          break;
        default:
          startDate = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth(), 1);
          endDate = new Date(selectedDateObj.getFullYear(), selectedDateObj.getMonth() + 1, 0);
          endDate.setHours(23, 59, 59, 999);
      }
      
      // Fetch freight charges from sales
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      let totalFreightCharges = 0;
      let totalCashReceived = 0;
      let totalUPIReceived = 0;
      let totalBankTransferReceived = 0;
      const customerSales = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        // Skip if no invoiceDate
        if (!sale.invoiceDate) return;
        
        const saleDate = safelyParseDate(sale.invoiceDate);
        if (!saleDate || saleDate < startDate || saleDate > endDate) return;
        
        // Calculate freight charges - fix field name (it's frieghtCharge with typo in the data)
        const freightCharge = parseFloat(sale.frieghtCharge) || 0;
        totalFreightCharges += freightCharge;
        
        // Calculate customer sales
        if (sale.customerId && sale.customerName) {
          const totalAmount = parseFloat(sale.totalAmount) || 0;
          if (!customerSales[sale.customerId]) {
            customerSales[sale.customerId] = {
              name: sale.customerName,
              total: 0
            };
          }
          customerSales[sale.customerId].total += totalAmount;
        }
        
        // Add cash amounts from sales - since paymentMethod field doesn't exist in sales documents,
        // we identify cash sales by checking if customer name contains "CASH CUSTOMER" and payment status is PAID
        const totalAmount = parseFloat(sale.totalAmount) || 0;
        const amountPaid = parseFloat(sale.amountPaid) || 0;
        
        // For cash sales, add the amount paid if customer is a cash customer
        if (sale.customerName && 
            sale.customerName.toUpperCase().includes('CASH CUSTOMER') && 
            amountPaid > 0) {
          totalCashReceived += amountPaid;
        }
        // Note: UPI and bank transfer amounts will come from transactions only since
        // sales documents don't have paymentMethod field
      });
      
      // Get top 5 customers
      const topCustomers = Object.entries(customerSales)
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);
      
      // Fetch cash/UPI/bank received from transactions
      const transactionsRef = getUserCollection('transactions');
      const transactionsQuery = query(
        transactionsRef,
        where('type', '==', 'received')
      );
      const transactionsSnapshot = await getDocs(transactionsQuery);
      
      transactionsSnapshot.docs.forEach(doc => {
        const transaction = doc.data();
        
        // Check date range
        if (!transaction.date) return;
        const transactionDate = new Date(transaction.date);
        if (transactionDate < startDate || transactionDate > endDate) return;
        
        const amount = parseFloat(transaction.amount) || 0;
        
        // Separate by payment method
        if (transaction.paymentMethod === 'cash') {
          totalCashReceived += amount;
        } else if (transaction.paymentMethod === 'upi') {
          totalUPIReceived += amount;
        } else if (transaction.paymentMethod === 'bank_transfer') {
          totalBankTransferReceived += amount;
        }
      });
      

      
      setAdditionalMetrics({
        totalFreightCharges,
        totalCashReceived,
        totalUPIReceived,
        totalBankTransferReceived,
        topCustomers
      });
      
    } catch (error) {
      // Handle errors gracefully by setting default values
      setAdditionalMetrics({
        totalFreightCharges: 0,
        totalCashReceived: 0,
        totalUPIReceived: 0,
        totalBankTransferReceived: 0,
        topCustomers: []
      });
    }
  };

  const fetchMonthlySalesData = async () => {
    try {
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      // Get data from April of current year to current month
      const now = new Date();
      const currentYear = now.getFullYear();
      const currentMonth = now.getMonth(); // 0-based (0 = January)
      const monthlyData = {};
      
      // Initialize from April (month 3) to current month
      for (let month = 3; month <= currentMonth; month++) {
        const date = new Date(currentYear, month, 1);
        const monthKey = `${currentYear}-${(month + 1).toString().padStart(2, '0')}`;
        const monthName = date.toLocaleDateString('en-US', { month: 'short' });
        monthlyData[monthKey] = {
          month: monthName,
          sales: 0,
          count: 0
        };
      }
      
      // Process sales data with improved validation
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        // Skip invalid sales records
        if (!sale.invoiceDate || !sale.totalAmount || sale.totalAmount <= 0) return;
        
        const saleDate = safelyParseDate(sale.invoiceDate);
        if (!saleDate || isNaN(saleDate.getTime())) return;
        
        // Only include data from April of current year onwards
        if (saleDate.getFullYear() === currentYear && saleDate.getMonth() >= 3) {
          const monthKey = `${saleDate.getFullYear()}-${(saleDate.getMonth() + 1).toString().padStart(2, '0')}`;
          
          if (monthlyData[monthKey]) {
            const amount = parseFloat(sale.totalAmount);
            if (!isNaN(amount) && amount > 0) {
              monthlyData[monthKey].sales += amount;
              monthlyData[monthKey].count += 1;
            }
          }
        }
      });
      
      // Convert to array and sort by month order
      const chartData = Object.keys(monthlyData)
        .sort()
        .map(key => monthlyData[key]);
      
      setMonthlySalesData(chartData);
      
    } catch (error) {
      console.error('Error fetching monthly sales data:', error);
      setMonthlySalesData([]);
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

  const checkBackupNotifications = () => {
    const today = new Date();
    const currentDate = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();
    
    // Calculate which week of the month we're in
    const firstDayOfMonth = new Date(currentYear, currentMonth - 1, 1);
    const weekNumber = Math.ceil((currentDate + firstDayOfMonth.getDay()) / 7);
    
    const weekKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-week${weekNumber}`;
    
    // Get dismissed backup notifications from localStorage
    const dismissedBackups = JSON.parse(localStorage.getItem('dismissedBackupNotifications') || '{}');
    
    const notifications = [];
    
    // Show backup reminder on Sundays (day 0) or Mondays (day 1) of each week
    const dayOfWeek = today.getDay();
    
    if ((dayOfWeek === 0 || dayOfWeek === 1) && !dismissedBackups[weekKey]) {
      notifications.push({
        id: weekKey,
        type: 'BACKUP',
        title: 'Weekly Backup Reminder',
        message: 'Time to create a backup of your business data, sales records, and important files.',
        dueDate: 'This week',
        priority: 'medium',
        color: 'purple',
        weekNumber: weekNumber
      });
    }
    
    setBackupNotifications(notifications);
  };

  const dismissBackupNotification = (notificationId) => {
    // Get current dismissed backup notifications
    const dismissedBackups = JSON.parse(localStorage.getItem('dismissedBackupNotifications') || '{}');
    
    // Add this notification to dismissed list
    dismissedBackups[notificationId] = {
      dismissedAt: new Date().toISOString(),
      dismissed: true
    };
    
    // Save back to localStorage
    localStorage.setItem('dismissedBackupNotifications', JSON.stringify(dismissedBackups));
    
    // Remove from current notifications
    setBackupNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  };

  // Test function for backup notifications
  const testBackupNotification = () => {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const weekKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}-week-test`;
    
    const testNotification = {
      id: weekKey,
      type: 'BACKUP',
      title: 'Weekly Backup Reminder (TEST)',
      message: 'This is a test notification for weekly backup reminder.',
      dueDate: 'This week',
      priority: 'medium',
      color: 'purple',
      weekNumber: 1
    };
    
    setBackupNotifications([testNotification]);
  };

  const checkGSTNotifications = () => {
    const today = new Date();
    const currentDate = today.getDate();
    const currentMonth = today.getMonth() + 1; // 1-12
    const currentYear = today.getFullYear();
    
    const monthKey = `${currentYear}-${currentMonth.toString().padStart(2, '0')}`;
    
    // Get dismissed notifications from localStorage
    const dismissedNotifications = JSON.parse(localStorage.getItem('dismissedGSTNotifications') || '{}');
    
    const notifications = [];
    
    // Check for 1st to 11th of month - GSTR-1 due
    if (currentDate >= 1 && currentDate <= 11) {
      const gstr1Key = `${monthKey}-gstr1`;
      if (!dismissedNotifications[gstr1Key]) {
        notifications.push({
          id: gstr1Key,
          type: 'GSTR-1',
          title: 'GSTR-1 Filing Due',
          message: 'Time to generate and file your GSTR-1 return for the previous month.',
          dueDate: '11th of this month',
          priority: 'high',
          color: 'blue',
          daysLeft: 11 - currentDate + 1
        });
      }
    }
    
    // Check for 5th to 20th of month - GSTR-3B due  
    if (currentDate >= 5 && currentDate <= 20) {
      const gstr3bKey = `${monthKey}-gstr3b`;
      if (!dismissedNotifications[gstr3bKey]) {
        notifications.push({
          id: gstr3bKey,
          type: 'GSTR-3B',
          title: 'GSTR-3B Filing Due',
          message: 'Time to generate and file your GSTR-3B return for the previous month.',
          dueDate: '20th of this month',
          priority: 'high', 
          color: 'green',
          daysLeft: 20 - currentDate + 1
        });
      }
    }
    
    setGstNotifications(notifications);
  };

  const dismissGSTNotification = (notificationId) => {
    // Get current dismissed notifications
    const dismissedNotifications = JSON.parse(localStorage.getItem('dismissedGSTNotifications') || '{}');
    
    // Add this notification to dismissed list
    dismissedNotifications[notificationId] = {
      dismissedAt: new Date().toISOString(),
      dismissed: true
    };
    
    // Save back to localStorage
    localStorage.setItem('dismissedGSTNotifications', JSON.stringify(dismissedNotifications));
    
    // Remove from current notifications
    setGstNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  };

  const navigateToGSTReturns = (returnType) => {
    // Navigate to GST Returns page with the specific tab
    const targetTab = returnType === 'GSTR-1' ? 'gstr1' : 'gstr3b';
    window.location.href = `#/gst-returns?tab=${targetTab}`;
  };

  // Check for reorder notifications
  const checkReorderNotifications = async () => {
    try {
      const lensInventoryRef = getUserCollection('lensInventory');
      const snapshot = await getDocs(lensInventoryRef);
      
      const notifications = [];
      let outOfStockCount = 0;
      let needsReorderCount = 0;
      let totalValueAtRisk = 0;

      snapshot.docs.forEach(doc => {
        const lens = { id: doc.id, ...doc.data() };
        
        // Check for general reorder needs (single/prescription lenses)
        if (lens.type !== 'stock' || lens.inventoryType !== 'individual') {
          const currentQty = parseInt(lens.qty || 0);
          const threshold = parseInt(lens.reorderThreshold || 0);
          
          if (threshold > 0 && currentQty <= threshold) {
            const shortage = Math.max(0, threshold - currentQty + 5);
            const estimatedCost = shortage * (parseFloat(lens.purchasePrice) || 0);
            totalValueAtRisk += estimatedCost;
            
            if (currentQty === 0) {
              outOfStockCount++;
            } else {
              needsReorderCount++;
            }
          }
        }

        // Check for individual power reorder needs (stock lenses)
        if (lens.type === 'stock' && lens.inventoryType === 'individual' && lens.powerInventory && lens.powerReorderThresholds) {
          Object.entries(lens.powerInventory).forEach(([powerKey, powerData]) => {
            const currentQty = parseInt(powerData?.quantity || 0);
            const threshold = parseInt(lens.powerReorderThresholds[powerKey] || 0);
            
            if (threshold > 0 && currentQty <= threshold) {
              const shortage = currentQty === 0 ? Math.max(threshold + 3, 5) : threshold - currentQty + 3;
              const estimatedCost = shortage * (parseFloat(lens.purchasePrice) || 0);
              totalValueAtRisk += estimatedCost;
              
              if (currentQty === 0) {
                outOfStockCount++;
              } else {
                needsReorderCount++;
              }
            }
          });
        }
      });

      // Create notification if there are items needing reorder
      if (outOfStockCount > 0 || needsReorderCount > 0) {
        const reorderNotification = {
          id: 'reorder-notification',
          title: 'Inventory Reorder Required',
          message: outOfStockCount > 0 
            ? `${outOfStockCount} item(s) out of stock, ${needsReorderCount} item(s) need reorder`
            : `${needsReorderCount} item(s) below reorder threshold`,
          outOfStockCount,
          needsReorderCount,
          totalValueAtRisk,
          urgentCount: outOfStockCount, // Keep for backward compatibility
          lowStockCount: needsReorderCount, // Keep for backward compatibility  
          type: 'reorder',
          priority: outOfStockCount > 0 ? 'urgent' : 'medium'
        };

        // Only add notification if it wasn't dismissed today
        if (!wasNotificationDismissedToday(reorderNotification.id)) {
          notifications.push(reorderNotification);
        }
      }

      setReorderNotifications(notifications);
    } catch (error) {
      setReorderNotifications([]);
    }
  };

  const dismissReorderNotification = (notificationId) => {
    // Store dismissal date in localStorage
    const today = new Date().toDateString(); // e.g., "Mon Dec 25 2023"
    localStorage.setItem(`reorderNotification_dismissed_${notificationId}`, today);
    
    // Remove from current state
    setReorderNotifications(prev => prev.filter(notification => notification.id !== notificationId));
  };

  // Check if notification was dismissed today
  const wasNotificationDismissedToday = (notificationId) => {
    const dismissedDate = localStorage.getItem(`reorderNotification_dismissed_${notificationId}`);
    if (!dismissedDate) return false;
    
    const today = new Date().toDateString();
    return dismissedDate === today;
  };

  // Clean up old dismissal records (run on component mount)
  const cleanupOldDismissals = () => {
    const today = new Date().toDateString();
    const keysToRemove = [];
    
    // Check all localStorage keys for old dismissal records
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('reorderNotification_dismissed_')) {
        const dismissedDate = localStorage.getItem(key);
        if (dismissedDate && dismissedDate !== today) {
          keysToRemove.push(key);
        }
      }
    }
    
    // Remove old dismissal records
    keysToRemove.forEach(key => localStorage.removeItem(key));
  };

  // Export functions for Excel
  const exportTopProductsToExcel = async () => {
    try {
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productCounts = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            try {
              // Skip services
              const isServiceItem = item.isService || 
                                  item.type === 'service' || 
                                  item.unit === 'Service' || 
                                  item.unit === 'service' ||
                                  (item.itemName && item.itemName.toLowerCase().includes('service')) ||
                                  (item.serviceData && Object.keys(item.serviceData).length > 0);
              
              if (isServiceItem) {
                return;
              }
              
              const productName = item.itemName || item.productName || 'Unknown Product';
              const qty = parseInt(item.qty) || 1;
              
              if (!productCounts[productName]) {
                productCounts[productName] = 0;
              }
              productCounts[productName] += qty;
            } catch (error) {
              // Skip invalid items
            }
          });
        }
      });
      
      const sortedProducts = Object.entries(productCounts)
        .map(([name, count]) => ({ 
          'Rank': 0,
          'Product Name': name, 
          'Quantity Sold': count 
        }))
        .sort((a, b) => b['Quantity Sold'] - a['Quantity Sold'])
        .slice(0, 100)
        .map((item, index) => ({ ...item, 'Rank': index + 1 }));
      
      const ws = XLSX.utils.json_to_sheet(sortedProducts);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Top 100 Products by Sales");
      
      const fileName = `Top_100_Products_by_Sales_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Error exporting data to Excel. Please try again.');
    }
  };

  const exportTopProductPowersToExcel = async () => {
    try {
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productPowerCounts = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            try {
              const productName = item.itemName || item.productName || 'Unknown Product';
              const qty = parseInt(item.qty) || 1;
              
              // Build power specification string
              let powerSpec = '';
              const sph = item.sph ? parseFloat(item.sph).toFixed(2) : null;
              const cyl = item.cyl ? parseFloat(item.cyl).toFixed(2) : null;
              const axis = item.axis ? parseInt(item.axis) : null;
              const add = item.add ? parseFloat(item.add).toFixed(2) : null;
              
              // Only process items that have at least SPH power
              if (sph !== null && sph !== '0.00') {
                powerSpec = `${sph} SPH`;
                
                if (cyl !== null && cyl !== '0.00') {
                  powerSpec += ` ${cyl} CYL`;
                  
                  if (axis !== null && axis !== 0) {
                    powerSpec += ` ${axis}°`;
                  }
                }
                
                if (add !== null && add !== '0.00') {
                  powerSpec += ` ${add} ADD`;
                }
                
                const productPowerKey = `${productName} | ${powerSpec}`;
                
                if (!productPowerCounts[productPowerKey]) {
                  productPowerCounts[productPowerKey] = {
                    productName,
                    powerSpec,
                    count: 0
                  };
                }
                productPowerCounts[productPowerKey].count += qty;
              }
            } catch (error) {
              // Skip invalid items
            }
          });
        }
      });
      
      const sortedProductPowers = Object.entries(productPowerCounts)
        .map(([key, data]) => ({
          'Rank': 0,
          'Product Name': data.productName,
          'Power Specification': data.powerSpec,
          'Quantity Sold': data.count
        }))
        .sort((a, b) => b['Quantity Sold'] - a['Quantity Sold'])
        .slice(0, 100)
        .map((item, index) => ({ ...item, 'Rank': index + 1 }));
      
      const ws = XLSX.utils.json_to_sheet(sortedProductPowers);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Top 100 Product-Power Combos");
      
      const fileName = `Top_100_Product_Power_Combinations_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Error exporting data to Excel. Please try again.');
    }
  };

  const exportTopProfitProductsToExcel = async () => {
    try {
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productProfits = {};
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            try {
              const productName = item.itemName || item.productName || 'Unknown Product';
              const qty = parseInt(item.qty) || 1;
              const price = parseFloat(item.price) || 0;
              
              let cost = parseFloat(item.cost) || parseFloat(item.costPrice) || 0;
              let isEstimatedCost = false;
              
              if (cost === 0 && price > 0) {
                cost = price * 0.75;
                isEstimatedCost = true;
              }
              
              const profit = (price - cost) * qty;
              
              if (!productProfits[productName]) {
                productProfits[productName] = { 
                  profit: 0, 
                  revenue: 0, 
                  hasEstimatedCost: false,
                  actualCostItems: 0,
                  estimatedCostItems: 0
                };
              }
              productProfits[productName].profit += profit;
              productProfits[productName].revenue += price * qty;
              
              if (isEstimatedCost) {
                productProfits[productName].hasEstimatedCost = true;
                productProfits[productName].estimatedCostItems += qty;
              } else {
                productProfits[productName].actualCostItems += qty;
              }
            } catch (error) {
              // Skip invalid items
            }
          });
        }
      });
      
      const sortedProfitProducts = Object.entries(productProfits)
        .map(([name, data]) => ({ 
          'Rank': 0,
          'Product Name': name, 
          'Total Profit': parseFloat(data.profit.toFixed(2)),
          'Total Revenue': parseFloat(data.revenue.toFixed(2)),
          'Profit Margin (%)': data.revenue > 0 ? parseFloat((data.profit / data.revenue * 100).toFixed(2)) : 0,
          'Cost Type': data.hasEstimatedCost ? 'Estimated' : 'Actual',
          'Estimated Cost Items': data.estimatedCostItems,
          'Actual Cost Items': data.actualCostItems
        }))
        .sort((a, b) => b['Total Profit'] - a['Total Profit'])
        .slice(0, 100)
        .map((item, index) => ({ ...item, 'Rank': index + 1 }));
      
      const ws = XLSX.utils.json_to_sheet(sortedProfitProducts);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Top 100 Profit Products");
      
      const fileName = `Top_100_Profit_Products_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Error exporting data to Excel. Please try again.');
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* All Notifications Section - Combined GST, Backup, and Reorder */}
        {(gstNotifications.length > 0 || backupNotifications.length > 0 || reorderNotifications.length > 0) && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center" style={{ color: 'var(--text-primary)' }}>
                <svg className="h-5 w-5 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5h5v5zM9 3v3H4l5 5 5-5H9V3z" />
                </svg>
                Reminders ({gstNotifications.length + backupNotifications.length + reorderNotifications.length})
              </h2>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    checkGSTNotifications();
                    checkBackupNotifications();
                    checkReorderNotifications();
                  }}
                  className="px-3 py-1 text-xs rounded-md border transition-colors"
                  style={{ 
                    color: 'var(--text-secondary)', 
                    borderColor: 'var(--border-primary)',
                    backgroundColor: 'var(--bg-tertiary)'
                  }}
                  title="Refresh all notifications"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Notifications Grid - Cards side by side */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* GST Notifications */}
              {gstNotifications.map((notification) => (
              <div 
                key={notification.id}
                className="rounded-lg shadow-lg border-l-4 p-4"
                style={{ 
                  backgroundColor: 'var(--bg-secondary)',
                  borderLeftColor: notification.color === 'blue' ? '#3B82F6' : '#10B981'
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      notification.color === 'blue' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      <svg 
                        className={`h-5 w-5 ${notification.color === 'blue' ? 'text-blue-600' : 'text-green-600'}`} 
                        fill="none" 
                        viewBox="0 0 24 24" 
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {notification.title}
                        </h3>
                        {notification.daysLeft > 0 && (
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            notification.daysLeft <= 2 
                              ? 'bg-red-100 text-red-800' 
                              : notification.daysLeft <= 5 
                              ? 'bg-yellow-100 text-yellow-800' 
                              : 'bg-green-100 text-green-800'
                          }`}>
                            {notification.daysLeft} days left
                          </span>
                        )}
                      </div>
                      <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                        {notification.message}
                      </p>
                      <p className="text-xs mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                        📅 Due by: {notification.dueDate}
                      </p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => dismissGSTNotification(notification.id)}
                    className="ml-4 p-1 rounded-full hover:bg-gray-200 transition-colors"
                    title="Dismiss notification"
                  >
                    <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                <div className="mt-4 flex space-x-3">
                  <button
                    onClick={() => navigateToGSTReturns(notification.type)}
                    className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                      notification.color === 'blue' 
                        ? 'bg-blue-600 hover:bg-blue-700' 
                        : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    Generate {notification.type}
                  </button>
                  
                  <button
                    onClick={() => dismissGSTNotification(notification.id)}
                    className="px-4 py-2 rounded-md text-sm font-medium border transition-colors"
                    style={{ 
                      color: 'var(--text-secondary)', 
                      borderColor: 'var(--border-primary)',
                      backgroundColor: 'var(--bg-tertiary)'
                    }}
                  >
                    Mark as Done
                  </button>
                </div>
              </div>
              ))}

              {/* Backup Notifications */}
              {backupNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className="rounded-lg shadow-lg border-l-4 p-4"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)',
                    borderLeftColor: '#8B5CF6'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                        <svg 
                          className="h-5 w-5 text-purple-600" 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {notification.title}
                          </h3>
                          {notification.weekNumber && (
                            <span className="px-2 py-1 text-xs rounded-full bg-purple-100 text-purple-800">
                              Week {notification.weekNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                          {notification.message}
                        </p>
                        <p className="text-xs mt-2 font-medium" style={{ color: 'var(--text-secondary)' }}>
                          📅 Due by: {notification.dueDate}
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={() => dismissBackupNotification(notification.id)}
                      className="ml-4 p-1 rounded-full hover:bg-gray-200 transition-colors"
                      title="Dismiss notification"
                    >
                      <svg className="h-5 w-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="mt-4 flex space-x-3">
                    <button
                      onClick={() => dismissBackupNotification(notification.id)}
                      className="px-4 py-2 rounded-md text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 transition-colors"
                    >
                      Create Backup
                    </button>
                    
                    <button
                      onClick={() => dismissBackupNotification(notification.id)}
                      className="px-4 py-2 rounded-md text-sm font-medium border transition-colors"
                      style={{ 
                        color: 'var(--text-secondary)', 
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-tertiary)'
                      }}
                    >
                      Mark as Done
                    </button>
                  </div>
                </div>
              ))}
              
              {/* Reorder Notifications */}
              {reorderNotifications.map((notification) => (
                <div 
                  key={notification.id}
                  className="rounded-lg shadow-lg border-l-4 p-4"
                  style={{ 
                    backgroundColor: 'var(--bg-secondary)',
                    borderLeftColor: notification.priority === 'urgent' ? '#EF4444' : '#F59E0B'
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        notification.priority === 'urgent' ? 'bg-red-100' : 'bg-yellow-100'
                      }`}>
                        <svg 
                          className={`h-5 w-5 ${notification.priority === 'urgent' ? 'text-red-600' : 'text-yellow-600'}`} 
                          fill="none" 
                          viewBox="0 0 24 24" 
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {notification.title}
                          </h3>
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            notification.priority === 'urgent' 
                              ? 'bg-red-100 text-red-800' 
                              : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            {notification.priority === 'urgent' ? 'URGENT' : 'Medium Priority'}
                          </span>
                        </div>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                          {notification.message}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {notification.outOfStockCount > 0 && (
                            <span className="flex items-center text-red-600">
                              <span className="w-2 h-2 bg-red-500 rounded-full mr-1"></span>
                              Out of Stock: {notification.outOfStockCount}
                            </span>
                          )}
                          {notification.needsReorderCount > 0 && (
                            <span className="flex items-center text-yellow-600">
                              <span className="w-2 h-2 bg-yellow-500 rounded-full mr-1"></span>
                              Needs Reorder: {notification.needsReorderCount}
                            </span>
                          )}

                        </div>
                      </div>
                      
                      <button
                        onClick={() => dismissReorderNotification(notification.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Dismiss notification"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex space-x-3">
                    <button
                      onClick={() => navigate('/reorder-dashboard')}
                      className={`px-4 py-2 rounded-md text-sm font-medium text-white transition-colors ${
                        notification.priority === 'urgent'
                          ? 'bg-red-600 hover:bg-red-700'
                          : 'bg-yellow-600 hover:bg-yellow-700'
                      }`}
                    >
                      View Reorder Dashboard
                    </button>
                    
                    <button
                      onClick={() => dismissReorderNotification(notification.id)}
                      className="px-4 py-2 rounded-md text-sm font-medium border transition-colors"
                      style={{ 
                        color: 'var(--text-secondary)', 
                        borderColor: 'var(--border-primary)',
                        backgroundColor: 'var(--bg-tertiary)'
                      }}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date Selector and Time Period */}
        <div className="mb-6 rounded-lg shadow p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Select Date for Analysis
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Time Period
                </label>
                <select
                  value={timePeriod}
                  onChange={(e) => setTimePeriod(e.target.value)}
                  className="form-input"
                >
                  <option value="daily">Daily</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>
            
            <button
              onClick={loadDashboardData}
              disabled={loading}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              title="Refresh dashboard data"
            >
              <svg 
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            {loading && (
              <div className="flex items-center text-sm ml-3" style={{ color: 'var(--text-muted)' }}>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Loading data...
              </div>
            )}
          </div>
        </div>

        {/* Marketplace Section */}
        <div className="mb-8">
          <div 
            className="rounded-lg shadow-lg p-6 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-700"
            style={{ 
              background: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 50%, #4338CA 100%)'
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-4">
                  <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-2">Reflex Marketplace</h2>
                    <p className="text-blue-100 text-sm">Connect with distributors • Buy & Sell Lenses • Post Queries</p>
                    <div className="flex items-center space-x-6 mt-3 text-blue-100 text-sm">
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        500+ Lenses Available
                      </span>
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/>
                        </svg>
                        50+ Distributors
                      </span>
                      <span className="flex items-center">
                        <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd"/>
                        </svg>
                        24/7 Access
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                {/* Marketplace Notifications */}
                <div className="bg-white/20 backdrop-blur-sm rounded-full p-2">
                  <MarketplaceNotificationBell iconColor="text-white" />
                </div>
                
                <div className="flex space-x-3">
                  <button
                    onClick={() => navigate('/marketplace')}
                    className="bg-white text-blue-600 px-6 py-3 rounded-lg font-semibold hover:bg-blue-50 transition-all duration-200 transform hover:scale-105 shadow-lg"
                  >
                    Open Marketplace
                  </button>
                  <button
                    onClick={() => navigate('/shop')}
                    className="bg-white/20 backdrop-blur-sm text-white px-6 py-3 rounded-lg font-semibold hover:bg-white/30 transition-all duration-200 border border-white/30"
                  >
                    Browse Lenses
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sales Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Today's Sales */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Today's Sales</h3>
            <p className="text-3xl font-bold text-blue-600">{formatCurrency(salesData.today)}</p>
            <div className="mt-2 flex items-center">
              <span className="text-sm mr-2" style={{ color: 'var(--text-muted)' }}>vs Last Year Same Day:</span>
              <span className={`text-sm font-medium ${getChangeColor(salesData.today, salesData.lastYearSameDay)}`}>
                {getChangePercentage(salesData.today, salesData.lastYearSameDay)}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Last Year: {formatCurrency(salesData.lastYearSameDay)}
            </p>
        </div>
        
          {/* This Month */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>This Month</h3>
            <p className="text-3xl font-bold text-green-600">{formatCurrency(salesData.thisMonth)}</p>
            <div className="mt-2 flex items-center">
              <span className="text-sm mr-2" style={{ color: 'var(--text-muted)' }}>vs Last Year Same Month:</span>
              <span className={`text-sm font-medium ${getChangeColor(salesData.thisMonth, salesData.lastYearSameMonth)}`}>
                {getChangePercentage(salesData.thisMonth, salesData.lastYearSameMonth)}
              </span>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Last Year: {formatCurrency(salesData.lastYearSameMonth)}
            </p>
          </div>

          {/* This Year */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>This Year</h3>
            <p className="text-3xl font-bold text-purple-600">{formatCurrency(salesData.thisYear)}</p>
            <div className="mt-2 flex items-center">
              <span className="text-sm mr-2" style={{ color: 'var(--text-muted)' }}>vs Last Year:</span>
              <span className={`text-sm font-medium ${getChangeColor(salesData.thisYear, salesData.lastYear)}`}>
                {getChangePercentage(salesData.thisYear, salesData.lastYear)}
                        </span>
            </div>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              Last Year Total: {formatCurrency(salesData.lastYear)}
                  </p>
                </div>
                
          {/* Projections */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Projections</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Monthly Projection:</p>
                <p className="text-xl font-bold text-orange-600">{formatCurrency(salesData.monthlyProjection)}</p>
                  </div>
              <div>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Yearly Projection:</p>
                <p className="text-xl font-bold text-red-600">{formatCurrency(salesData.yearlyProjection)}</p>
              </div>
            </div>
          </div>
        </div>
        
        {/* Additional Metrics Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {timePeriod.charAt(0).toUpperCase() + timePeriod.slice(1)} Overview
            </h2>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {timePeriod === 'daily' && formatDate(selectedDate)}
              {timePeriod === 'monthly' && `${new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`}
              {timePeriod === 'quarterly' && `Q${Math.floor(new Date(selectedDate).getMonth() / 3) + 1} ${new Date(selectedDate).getFullYear()}`}
              {timePeriod === 'yearly' && `${new Date(selectedDate).getFullYear()}`}
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            {/* Total Freight Charges */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Total Freight Charges</h3>
              <p className="text-3xl font-bold text-orange-600">{formatCurrency(additionalMetrics.totalFreightCharges)}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                From all sales in selected period
              </p>
            </div>
            
            {/* Total Cash Received */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Cash Received</h3>
              <p className="text-3xl font-bold text-green-600">{formatCurrency(additionalMetrics.totalCashReceived)}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Cash payments only
              </p>
            </div>
            
            {/* Total UPI Received */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>UPI Received</h3>
              <p className="text-3xl font-bold text-blue-600">{formatCurrency(additionalMetrics.totalUPIReceived)}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                UPI payments only
              </p>
            </div>
            
            {/* Total Bank Transfer Received */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Bank Transfer Received</h3>
              <p className="text-3xl font-bold text-purple-600">{formatCurrency(additionalMetrics.totalBankTransferReceived)}</p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                Bank transfers only
              </p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Top 5 Customers */}
            <div className="card overflow-hidden p-0">
              <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Top 5 Customers</h3>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {additionalMetrics.topCustomers.length > 0 ? (
                  <table className="min-w-full">
                    <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                      {additionalMetrics.topCustomers.map((customer, index) => (
                        <tr key={customer.id} className="hover:bg-opacity-50">
                          <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                            <div className="flex items-center">
                              <span className="w-6 h-6 bg-blue-100 text-blue-800 rounded-full flex items-center justify-center text-xs font-medium mr-3">
                                {index + 1}
                              </span>
                              <div>
                                <div className="font-medium">{customer.name}</div>
                                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  {formatCurrency(customer.total)}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5l-5 5-5-5h5v-12a1 1 0 00-1-1H5a1 1 0 00-1-1v12h5l-5 5-5-5h5V8a1 1 0 011-1h12a1 1 0 011 1v12z" />
                    </svg>
                    <p className="text-sm">No customer data found</p>
                  </div>
                )}
              </div>
            </div>

            {/* Monthly Sales Trend Chart */}
            <div className="card overflow-hidden p-0">
              <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Monthly Sales Trend (Apr - Current)</h3>
              </div>
              <div className="p-4">
                {monthlySalesData.length > 0 ? (
                  <div className="space-y-3">
                    {/* Chart Container */}
                    <div className="relative">
                      {/* Chart Area */}
                      <div className="flex items-end justify-between h-40 mb-2 border-b border-gray-200" style={{ borderColor: 'var(--border-primary)' }}>
                        {monthlySalesData.map((month, index) => {
                          const maxSales = Math.max(...monthlySalesData.map(m => m.sales));
                          const height = maxSales > 0 ? (month.sales / maxSales) * 100 : 0;
                          const barHeight = Math.max(height, month.sales > 0 ? 5 : 0); // Minimum 5% height for non-zero values
                          
                          return (
                            <div key={index} className="flex-1 flex flex-col items-center">
                              {/* Bar */}
                              <div 
                                className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm transition-all hover:from-blue-600 hover:to-blue-500 cursor-pointer relative group"
                                style={{ 
                                  height: `${barHeight}%`,
                                  minHeight: month.sales > 0 ? '8px' : '2px',
                                  backgroundColor: month.sales === 0 ? '#e5e7eb' : undefined,
                                  marginBottom: '0px'
                                }}
                                title={`${month.month}: ${formatCurrency(month.sales)} (${month.count} sales)`}
                              >
                                {/* Tooltip on hover */}
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                  {formatCurrency(month.sales)}
                                  <br />
                                  {month.count} sales
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Month Labels */}
                      <div className="flex justify-between">
                        {monthlySalesData.map((month, index) => (
                          <div key={index} className="flex-1 text-center">
                            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                              {month.month}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Summary Stats */}
                    <div className="border-t pt-3" style={{ borderColor: 'var(--border-primary)' }}>
                      <div className="grid grid-cols-2 gap-4 text-center">
                        <div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Avg Monthly</div>
                          <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {formatCurrency(monthlySalesData.reduce((sum, m) => sum + m.sales, 0) / monthlySalesData.length)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs" style={{ color: 'var(--text-muted)' }}>This Month</div>
                          <div className="text-sm font-semibold text-blue-600">
                            {monthlySalesData.length > 0 ? formatCurrency(monthlySalesData[monthlySalesData.length - 1].sales) : '₹0'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                    <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm">No sales data available</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {/* Top Services Section */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Top 10 Services by Revenue</h3>
                <div className="flex items-center space-x-2">
                  <label className="text-sm" style={{ color: 'var(--text-muted)' }}>Period:</label>
                  <select
                    value={servicesTimePeriod}
                    onChange={(e) => setServicesTimePeriod(e.target.value)}
                    className="px-3 py-1 text-sm border rounded-md"
                    style={{
                      backgroundColor: 'var(--bg-primary)',
                      borderColor: 'var(--border-primary)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="daily">Daily</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {topServices.length > 0 ? (
                <table className="min-w-full">
                  <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>#</th>
                      <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Service</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Count</th>
                      <th className="px-4 py-2 text-right text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                    {topServices.map((service, index) => (
                      <tr key={index} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                        <td className="px-4 py-2 text-sm text-left" style={{ color: 'var(--text-primary)' }}>{index + 1}</td>
                        <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2 text-teal-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                            </svg>
                            {service.name}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-sm text-right" style={{ color: 'var(--text-primary)' }}>{service.count}</td>
                        <td className="px-4 py-2 text-sm text-right font-semibold text-green-600">
                          {formatCurrency(service.totalEarned)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="border-t-2 bg-gray-50 dark:bg-gray-700" style={{ borderColor: 'var(--border-primary)' }}>
                      <td className="px-4 py-3"></td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        Total ({topServices.length} services)
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold" style={{ color: 'var(--text-primary)' }}>
                        {topServices.reduce((sum, service) => sum + service.count, 0)}
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-bold text-green-700 dark:text-green-400">
                        {formatCurrency(topServices.reduce((sum, service) => sum + service.totalEarned, 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <div className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>
                  <svg className="w-12 h-12 mx-auto mb-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 003.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                  <p className="text-sm">No service data found for selected period</p>
                </div>
              )}
            </div>
          </div>
        </div>



        {/* Top Products Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products by Quantity */}
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Top 20 Products by Sales</h3>
                <button
                  onClick={exportTopProductsToExcel}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                  title="Export Top 100 to Excel"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    <path d="M11.5,15.5L10,14L8.5,15.5L7,14V17H17V14L15.5,15.5L14,14L12.5,15.5L11.5,15.5Z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700" style={{ borderColor: 'var(--border-primary)' }}>
                  {topProducts.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-4 py-3 text-sm text-left font-medium" style={{ color: 'var(--text-primary)' }}>{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-left" style={{ color: 'var(--text-primary)' }}>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300">
                          {product.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Top Product Powers */}
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Top 20 Product-Power Combinations</h3>
                <button
                  onClick={exportTopProductPowersToExcel}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                  title="Export Top 100 to Excel"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    <path d="M11.5,15.5L10,14L8.5,15.5L7,14V17H17V14L15.5,15.5L14,14L12.5,15.5L11.5,15.5Z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Product</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Power</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700" style={{ borderColor: 'var(--border-primary)' }}>
                  {topProductPowers.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-4 py-3 text-sm text-left font-medium" style={{ color: 'var(--text-primary)' }}>{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-left" style={{ color: 'var(--text-primary)' }}>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                          <span className="font-medium">{item.productName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-left">
                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-600 px-2 py-1 rounded" style={{ color: 'var(--text-primary)' }}>
                          {item.powerSpec}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                          {item.count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Top Profit Products */}
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Top 20 Profit Products</h3>
                <button
                  onClick={exportTopProfitProductsToExcel}
                  className="p-2 text-green-600 hover:bg-green-50 rounded-md transition-colors"
                  title="Export Top 100 to Excel"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                    <path d="M11.5,15.5L10,14L8.5,15.5L7,14V17H17V14L15.5,15.5L14,14L12.5,15.5L11.5,15.5Z" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Product</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Profit</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Margin</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700" style={{ borderColor: 'var(--border-primary)' }}>
                  {topProfitProducts.map((product, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-150">
                      <td className="px-4 py-3 text-sm text-left font-medium" style={{ color: 'var(--text-primary)' }}>{index + 1}</td>
                      <td className="px-4 py-3 text-sm text-left" style={{ color: 'var(--text-primary)' }}>
                        <div className="flex items-center">
                          <svg className="w-4 h-4 mr-2 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">{product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">
                        <span className="text-green-600 dark:text-green-400">
                          {formatCurrency(product.profit)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-right font-semibold" style={{ color: 'var(--text-primary)' }}>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          product.profitMargin >= 50 ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300' :
                          product.profitMargin >= 25 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' :
                          'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
                        }`}>
                          {product.profitMargin.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-center" style={{ color: 'var(--text-primary)' }}>
                        {product.hasEstimatedCost ? (
                          <div className="flex flex-col items-center">
                            <span className="text-xs bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">
                              Est
                            </span>
                            {product.actualCostItems > 0 && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                {product.estimatedCostItems}E/{product.actualCostItems}A
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium">
                            Actual
                          </span>
                        )}
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
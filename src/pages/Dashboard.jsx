import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, orderBy, where, Timestamp } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { safelyParseDate, formatDate, formatDateTime } from '../utils/dateUtils';

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
  
  // GST Notification states
  const [gstNotifications, setGstNotifications] = useState([]);
  const [backupNotifications, setBackupNotifications] = useState([]);
  
  useEffect(() => {
    loadDashboardData();
    checkGSTNotifications();
    checkBackupNotifications();
  }, [selectedDate]);

  // Force data reload on component mount (helps after backup restoration)
  useEffect(() => {
    console.log('Dashboard component mounted, forcing data reload...');
    loadDashboardData();
  }, []);

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
      console.log('Fetching sales data for dashboard...');
      console.log('Current userUid from localStorage:', localStorage.getItem('userUid'));
      console.log('Current user role from localStorage:', localStorage.getItem('userRole'));
      
      const salesRef = getUserCollection('sales');
      console.log('Sales collection path will be:', `users/${localStorage.getItem('userUid')}/sales`);
      
      let salesSnapshot;
      try {
        // Try with orderBy first
        salesSnapshot = await getDocs(query(salesRef, orderBy('invoiceDate', 'desc')));
      } catch (error) {
        console.log('orderBy failed, trying without ordering:', error);
        // Fallback: get all sales without ordering
        salesSnapshot = await getDocs(salesRef);
      }
      
      console.log('Found', salesSnapshot.docs.length, 'sales documents for this user');
      
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
      
      let processedCount = 0;
      let skippedCount = 0;
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        
        // Skip if no invoiceDate or totalAmount
        if (!sale.invoiceDate || !sale.totalAmount) {
          skippedCount++;
          return;
        }
        
        // Convert timestamp safely
        const saleDate = safelyParseDate(sale.invoiceDate);
        if (!saleDate) {
          console.warn('Could not convert sale date:', sale.invoiceDate);
          skippedCount++;
          return;
        }
        
        const amount = parseFloat(sale.totalAmount) || 0;
        processedCount++;
        
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
      
      console.log(`Dashboard: Processed ${processedCount} sales, skipped ${skippedCount}`);
      
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
      
      console.log('Dashboard sales data:', newSalesData);
      setSalesData(newSalesData);
      
    } catch (error) {
      console.error('Error fetching sales data:', error);
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
      console.log('Fetching top products for dashboard...');
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productCounts = {};
      let processedSales = 0;
      let processedItems = 0;
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        processedSales++;
        
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            try {
              const productName = item.itemName || item.productName || 'Unknown Product';
              const qty = parseInt(item.qty) || 1;
              processedItems++;
              
              if (!productCounts[productName]) {
                productCounts[productName] = 0;
              }
              productCounts[productName] += qty;
            } catch (error) {
              console.warn('Error processing item:', item, error);
            }
          });
        }
      });
      
      const sortedProducts = Object.entries(productCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      console.log(`Dashboard: Processed ${processedSales} sales with ${processedItems} items for top products`);
      console.log('Top products:', sortedProducts.slice(0, 5));
      setTopProducts(sortedProducts);
    } catch (error) {
      console.error('Error fetching top products:', error);
      setTopProducts([]);
    }
  };

  const fetchTopPowers = async () => {
    try {
      console.log('Fetching top powers for dashboard...');
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const powerCounts = {};
      let processedSales = 0;
      let processedItems = 0;
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        processedSales++;
        
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            try {
              if (item.sph) {
                const power = item.sph.toString();
                const qty = parseInt(item.qty) || 1;
                processedItems++;
                
                if (!powerCounts[power]) {
                  powerCounts[power] = 0;
                }
                powerCounts[power] += qty;
              }
            } catch (error) {
              console.warn('Error processing power item:', item, error);
            }
          });
        }
      });
      
      const sortedPowers = Object.entries(powerCounts)
        .map(([power, count]) => ({ power, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
      
      console.log(`Dashboard: Processed ${processedSales} sales with ${processedItems} power items`);
      console.log('Top powers:', sortedPowers.slice(0, 5));
      setTopPowers(sortedPowers);
    } catch (error) {
      console.error('Error fetching top powers:', error);
      setTopPowers([]);
    }
  };

  const fetchTopProfitProducts = async () => {
    try {
      console.log('Fetching top profit products for dashboard...');
      const salesRef = getUserCollection('sales');
      const salesSnapshot = await getDocs(salesRef);
      
      const productProfits = {};
      let processedSales = 0;
      let processedItems = 0;
      
      salesSnapshot.docs.forEach(doc => {
        const sale = doc.data();
        processedSales++;
        
        if (sale.items && Array.isArray(sale.items)) {
          sale.items.forEach(item => {
            try {
              const productName = item.itemName || item.productName || 'Unknown Product';
              const qty = parseInt(item.qty) || 1;
              const price = parseFloat(item.price) || 0;
              const cost = parseFloat(item.cost) || parseFloat(item.costPrice) || 0;
              const profit = (price - cost) * qty;
              processedItems++;
              
              if (!productProfits[productName]) {
                productProfits[productName] = { profit: 0, revenue: 0 };
              }
              productProfits[productName].profit += profit;
              productProfits[productName].revenue += price * qty;
            } catch (error) {
              console.warn('Error processing profit item:', item, error);
            }
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
      
      console.log(`Dashboard: Processed ${processedSales} sales with ${processedItems} profit items`);
      console.log('Top profit products:', sortedProfitProducts.slice(0, 5));
      setTopProfitProducts(sortedProfitProducts);
    } catch (error) {
      console.error('Error fetching top profit products:', error);
      setTopProfitProducts([]);
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

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* All Notifications Section - Combined GST and Backup */}
        {(gstNotifications.length > 0 || backupNotifications.length > 0) && (
          <div className="mb-8 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold flex items-center" style={{ color: 'var(--text-primary)' }}>
                <svg className="h-5 w-5 mr-2 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5v-5h5v5zM9 3v3H4l5 5 5-5H9V3z" />
                </svg>
                Reminders ({gstNotifications.length + backupNotifications.length})
              </h2>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => {
                    checkGSTNotifications();
                    checkBackupNotifications();
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
          </div>
        )}

        {/* Date Selector */}
        <div className="mb-6 rounded-lg shadow p-4" style={{ backgroundColor: 'var(--bg-secondary)' }}>
          <div className="flex items-center justify-between">
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
        
        {/* Top Products Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Top Products by Quantity */}
            <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Top 20 Products by Sales</h3>
              </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                  {topProducts.map((product, index) => (
                    <tr key={index} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>{index + 1}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>{product.name}</td>
                      <td className="px-4 py-2 text-sm text-right" style={{ color: 'var(--text-primary)' }}>{product.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
            </div>
          </div>
          
          {/* Top Powers */}
            <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Top 20 SPH Powers</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Power</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Count</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                  {topPowers.map((power, index) => (
                    <tr key={index} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>{index + 1}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>{power.power}</td>
                      <td className="px-4 py-2 text-sm text-right" style={{ color: 'var(--text-primary)' }}>{power.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Top Profit Products */}
          <div className="card overflow-hidden p-0">
            <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--bg-tertiary)', borderColor: 'var(--border-primary)' }}>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Top 20 Profit Products</h3>
            </div>
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>#</th>
                    <th className="px-4 py-2 text-left text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Product</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Profit</th>
                    <th className="px-4 py-2 text-right text-xs font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Margin</th>
                    </tr>
                  </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                  {topProfitProducts.map((product, index) => (
                      <tr key={index} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>{index + 1}</td>
                      <td className="px-4 py-2 text-sm" style={{ color: 'var(--text-primary)' }}>{product.name}</td>
                      <td className="px-4 py-2 text-sm text-right" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(product.profit)}
                      </td>
                      <td className="px-4 py-2 text-sm text-right" style={{ color: 'var(--text-primary)' }}>
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
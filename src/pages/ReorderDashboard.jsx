import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where, orderBy } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import * as XLSX from 'xlsx';

const ReorderDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('needs-reorder'); // 'needs-reorder' or 'out-of-stock'
  
  // Out of stock filters and search
  const [outOfStockSearch, setOutOfStockSearch] = useState('');
  const [outOfStockFilters, setOutOfStockFilters] = useState({
    lensType: '',
    lensCategory: '',
    powerRange: ''
  });
  const [expandedBrands, setExpandedBrands] = useState(new Set());

  // Needs reorder filters and search
  const [needsReorderSearch, setNeedsReorderSearch] = useState('');
  const [needsReorderFilters, setNeedsReorderFilters] = useState({
    lensType: '',
    priority: '',
    powerRange: ''
  });
  const [expandedReorderBrands, setExpandedReorderBrands] = useState(new Set());
  
  const [reorderData, setReorderData] = useState({
    needsReorder: [],
    outOfStock: [],
    stats: {
      totalLensesNeedingReorder: 0,
      totalPowersOutOfStock: 0,
      totalValueAtRisk: 0,
      urgentReorders: 0
    }
  });

  useEffect(() => {
    fetchReorderData();
  }, []);

  const fetchReorderData = async () => {
    try {
      setLoading(true);
      setError('');

      const lensInventoryRef = getUserCollection('lensInventory');
      const snapshot = await getDocs(lensInventoryRef);
      
      const needsReorder = [];
      const outOfStock = [];
      let totalValueAtRisk = 0;
      let urgentReorders = 0;

      snapshot.docs.forEach(doc => {
        const lens = { id: doc.id, ...doc.data() };
        
        // Check for general reorder needs (single/prescription lenses)
        if (lens.type !== 'stock' || lens.inventoryType !== 'individual') {
          const currentQty = parseInt(lens.qty || 0);
          const threshold = parseInt(lens.reorderThreshold || 0);
          
          if (currentQty <= threshold && threshold > 0) {
            const shortage = Math.max(0, threshold - currentQty + 5); // Suggest 5 extra units
            const estimatedCost = shortage * (parseFloat(lens.purchasePrice) || 0);
            
            needsReorder.push({
              id: lens.id,
              type: 'general',
              lensName: lens.brandName,
              lensType: lens.type,
              currentQty,
              threshold,
              shortage,
              suggestedOrder: shortage,
              estimatedCost,
              priority: currentQty === 0 ? 'urgent' : currentQty <= threshold / 2 ? 'high' : 'medium',
              lens
            });

            totalValueAtRisk += estimatedCost;
            if (currentQty === 0) urgentReorders++;
          }
        }

        // Check for individual power reorder needs (stock lenses)
        if (lens.type === 'stock' && lens.inventoryType === 'individual' && lens.powerInventory && lens.powerReorderThresholds) {
          Object.entries(lens.powerInventory).forEach(([powerKey, powerData]) => {
            const currentQty = parseInt(powerData?.quantity || 0);
            const threshold = parseInt(lens.powerReorderThresholds[powerKey] || 0);
            
            if (threshold > 0) {
              if (currentQty === 0) {
                // Add to out of stock
                outOfStock.push({
                  id: `${lens.id}_${powerKey}`,
                  lensId: lens.id,
                  lensName: lens.brandName,
                  lensType: lens.type,
                  powerKey,
                  powerDisplay: formatPowerDisplay(powerKey),
                  currentQty: 0,
                  threshold,
                  suggestedOrder: Math.max(threshold + 3, 5), // At least 5 pieces
                  estimatedCost: Math.max(threshold + 3, 5) * (parseFloat(lens.purchasePrice) || 0),
                  lens
                });
              } else if (currentQty <= threshold) {
                // Add to needs reorder
                const shortage = threshold - currentQty + 3; // Suggest 3 extra pieces
                const estimatedCost = shortage * (parseFloat(lens.purchasePrice) || 0);
                
                needsReorder.push({
                  id: `${lens.id}_${powerKey}`,
                  lensId: lens.id,
                  type: 'power_specific',
                  lensName: lens.brandName,
                  lensType: lens.type,
                  powerKey,
                  powerDisplay: formatPowerDisplay(powerKey),
                  currentQty,
                  threshold,
                  shortage,
                  suggestedOrder: shortage,
                  estimatedCost,
                  priority: currentQty <= threshold / 2 ? 'high' : 'medium',
                  lens
                });

                totalValueAtRisk += estimatedCost;
              }
            }
          });
        }
      });

      // Sort by priority and current quantity
      needsReorder.sort((a, b) => {
        const priorityOrder = { urgent: 3, high: 2, medium: 1 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        }
        return a.currentQty - b.currentQty;
      });

      outOfStock.sort((a, b) => a.lensName.localeCompare(b.lensName));

      setReorderData({
        needsReorder,
        outOfStock,
        stats: {
          totalLensesNeedingReorder: needsReorder.length,
          totalPowersOutOfStock: outOfStock.length,
          totalValueAtRisk,
          urgentReorders
        }
      });

    } catch (error) {
      setError('Failed to load reorder data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatPowerDisplay = (powerKey) => {
    const parts = powerKey.split('_');
    if (parts.length >= 3) {
      const [sph, cyl, addition] = parts.map(p => parseFloat(p));
      return `SPH: ${sph >= 0 ? '+' : ''}${sph}, CYL: ${cyl >= 0 ? '+' : ''}${cyl}, ADD: +${addition}`;
    } else {
      const [sph, cyl] = parts.map(p => parseFloat(p));
      return `SPH: ${sph >= 0 ? '+' : ''}${sph}, CYL: ${cyl >= 0 ? '+' : ''}${cyl}`;
    }
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 border-red-300 dark:border-red-700';
      case 'high':
        return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-200 border-orange-300 dark:border-orange-700';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 border-yellow-300 dark:border-yellow-700';
      default:
        return 'bg-gray-100 dark:bg-gray-900/30 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-700';
    }
  };

  const handleViewLens = (lensId) => {
    navigate(`/lens-inventory/${lensId}`);
  };

  // Group out of stock items by lens brand
  const groupOutOfStockByBrand = (items) => {
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.lensName]) {
        grouped[item.lensName] = {
          brandName: item.lensName,
          lensType: item.lensType,
          items: [],
          totalSuggestedOrder: 0,
          totalEstimatedCost: 0
        };
      }
      grouped[item.lensName].items.push(item);
      grouped[item.lensName].totalSuggestedOrder += item.suggestedOrder;
      grouped[item.lensName].totalEstimatedCost += item.estimatedCost;
    });
    return Object.values(grouped);
  };

  // Filter out of stock items
  const getFilteredOutOfStockItems = () => {
    let filtered = reorderData.outOfStock;

    // Apply search filter
    if (outOfStockSearch.trim()) {
      const searchTerm = outOfStockSearch.toLowerCase();
      filtered = filtered.filter(item => 
        item.lensName.toLowerCase().includes(searchTerm) ||
        item.powerDisplay.toLowerCase().includes(searchTerm)
      );
    }

    // Apply lens type filter
    if (outOfStockFilters.lensType) {
      filtered = filtered.filter(item => 
        item.lensType.toLowerCase().includes(outOfStockFilters.lensType.toLowerCase())
      );
    }

    // Apply power range filter (basic SPH range)
    if (outOfStockFilters.powerRange) {
      filtered = filtered.filter(item => {
        const sphMatch = item.powerDisplay.match(/SPH:\s*([+-]?\d+(?:\.\d+)?)/);
        if (sphMatch) {
          const sph = parseFloat(sphMatch[1]);
          switch (outOfStockFilters.powerRange) {
            case 'positive': return sph > 0;
            case 'negative': return sph < 0;
            case 'high_minus': return sph <= -6;
            case 'high_plus': return sph >= 6;
            default: return true;
          }
        }
        return true;
      });
    }

    return filtered;
  };

  // Get grouped and filtered data
  const getGroupedOutOfStockData = () => {
    const filteredItems = getFilteredOutOfStockItems();
    return groupOutOfStockByBrand(filteredItems);
  };

  // Toggle brand expansion
  const toggleBrandExpansion = (brandName) => {
    const newExpanded = new Set(expandedBrands);
    if (newExpanded.has(brandName)) {
      newExpanded.delete(brandName);
    } else {
      newExpanded.add(brandName);
    }
    setExpandedBrands(newExpanded);
  };

  // Clear all filters
  const clearFilters = () => {
    setOutOfStockSearch('');
    setOutOfStockFilters({
      lensType: '',
      lensCategory: '',
      powerRange: ''
    });
  };

  // Get unique filter options
  const getFilterOptions = () => {
    const lensTypes = [...new Set(reorderData.outOfStock.map(item => item.lensType))];
    return { lensTypes };
  };

  // ===== NEEDS REORDER FUNCTIONS =====

  // Group needs reorder items by lens brand
  const groupNeedsReorderByBrand = (items) => {
    const grouped = {};
    items.forEach(item => {
      if (!grouped[item.lensName]) {
        grouped[item.lensName] = {
          brandName: item.lensName,
          lensType: item.lensType || item.lens?.type || 'Unknown',
          items: [],
          totalSuggestedOrder: 0,
          totalEstimatedCost: 0,
          highestPriority: 'medium'
        };
      }
      grouped[item.lensName].items.push(item);
      grouped[item.lensName].totalSuggestedOrder += item.suggestedOrder;
      grouped[item.lensName].totalEstimatedCost += item.estimatedCost;
      
      // Determine highest priority for the group
      const priorityOrder = { urgent: 3, high: 2, medium: 1 };
      if (priorityOrder[item.priority] > priorityOrder[grouped[item.lensName].highestPriority]) {
        grouped[item.lensName].highestPriority = item.priority;
      }
    });
    return Object.values(grouped);
  };

  // Filter needs reorder items
  const getFilteredNeedsReorderItems = () => {
    let filtered = reorderData.needsReorder;

    // Apply search filter
    if (needsReorderSearch.trim()) {
      const searchTerm = needsReorderSearch.toLowerCase();
      filtered = filtered.filter(item => 
        item.lensName.toLowerCase().includes(searchTerm) ||
        (item.powerDisplay && item.powerDisplay.toLowerCase().includes(searchTerm)) ||
        (item.lensType && item.lensType.toLowerCase().includes(searchTerm))
      );
    }

    // Apply lens type filter
    if (needsReorderFilters.lensType) {
      filtered = filtered.filter(item => 
        item.lensType?.toLowerCase().includes(needsReorderFilters.lensType.toLowerCase()) ||
        item.lens?.type?.toLowerCase().includes(needsReorderFilters.lensType.toLowerCase())
      );
    }

    // Apply priority filter
    if (needsReorderFilters.priority) {
      filtered = filtered.filter(item => item.priority === needsReorderFilters.priority);
    }

    // Apply power range filter (for power-specific items)
    if (needsReorderFilters.powerRange && needsReorderFilters.powerRange !== 'general_only') {
      filtered = filtered.filter(item => {
        if (needsReorderFilters.powerRange === 'power_specific_only') {
          return item.type === 'power_specific';
        }
        
        if (item.powerDisplay) {
          const sphMatch = item.powerDisplay.match(/SPH:\s*([+-]?\d+(?:\.\d+)?)/);
          if (sphMatch) {
            const sph = parseFloat(sphMatch[1]);
            switch (needsReorderFilters.powerRange) {
              case 'positive': return sph > 0;
              case 'negative': return sph < 0;
              case 'high_minus': return sph <= -6;
              case 'high_plus': return sph >= 6;
              default: return true;
            }
          }
        }
        return needsReorderFilters.powerRange === 'general_only' ? item.type !== 'power_specific' : true;
      });
    }

    return filtered;
  };

  // Get grouped and filtered needs reorder data
  const getGroupedNeedsReorderData = () => {
    const filteredItems = getFilteredNeedsReorderItems();
    return groupNeedsReorderByBrand(filteredItems);
  };

  // Toggle needs reorder brand expansion
  const toggleReorderBrandExpansion = (brandName) => {
    const newExpanded = new Set(expandedReorderBrands);
    if (newExpanded.has(brandName)) {
      newExpanded.delete(brandName);
    } else {
      newExpanded.add(brandName);
    }
    setExpandedReorderBrands(newExpanded);
  };

  // Clear needs reorder filters
  const clearNeedsReorderFilters = () => {
    setNeedsReorderSearch('');
    setNeedsReorderFilters({
      lensType: '',
      priority: '',
      powerRange: ''
    });
  };

  // Get unique filter options for needs reorder
  const getNeedsReorderFilterOptions = () => {
    const lensTypes = [...new Set(reorderData.needsReorder.map(item => 
      item.lensType || item.lens?.type || 'Unknown'
    ))].filter(type => type !== 'Unknown');
    
    const priorities = [...new Set(reorderData.needsReorder.map(item => item.priority))];
    
    return { lensTypes, priorities };
  };

  // Export functions
  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();
      
      // Prepare needs reorder data
      const needsReorderData = reorderData.needsReorder.map((item, index) => ({
        'S.No': index + 1,
        'Priority': item.priority.charAt(0).toUpperCase() + item.priority.slice(1),
        'Lens Brand': item.lensName,
        'Type': item.type === 'power_specific' ? 'Power Specific' : 'General',
        'Details': item.type === 'power_specific' ? item.powerDisplay : `${item.lensType} lens`,
        'Current Stock': `${item.currentQty} ${item.type === 'power_specific' ? 'pieces' : 'units'}`,
        'Threshold': `${item.threshold} ${item.type === 'power_specific' ? 'pieces' : 'units'}`,
        'Suggested Order': `${item.suggestedOrder} ${item.type === 'power_specific' ? 'pieces' : 'units'}`,
        'Estimated Cost': `₹${item.estimatedCost.toFixed(2)}`
      }));

      // Prepare out of stock data
      const outOfStockData = reorderData.outOfStock.map((item, index) => ({
        'S.No': index + 1,
        'Lens Brand': item.lensName,
        'Power Combination': item.powerDisplay,
        'Threshold': `${item.threshold} pieces`,
        'Suggested Order': `${item.suggestedOrder} pieces`,
        'Estimated Cost': `₹${item.estimatedCost.toFixed(2)}`
      }));

      // Create worksheets
      const needsReorderWS = XLSX.utils.json_to_sheet(needsReorderData);
      const outOfStockWS = XLSX.utils.json_to_sheet(outOfStockData);

      // Set column widths
      const needsReorderColWidths = [
        { wch: 6 }, { wch: 10 }, { wch: 20 }, { wch: 15 }, { wch: 30 }, 
        { wch: 15 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
      ];
      const outOfStockColWidths = [
        { wch: 6 }, { wch: 20 }, { wch: 30 }, { wch: 12 }, { wch: 15 }, { wch: 15 }
      ];

      needsReorderWS['!cols'] = needsReorderColWidths;
      outOfStockWS['!cols'] = outOfStockColWidths;

      // Add worksheets to workbook
      XLSX.utils.book_append_sheet(wb, needsReorderWS, 'Needs Reorder');
      XLSX.utils.book_append_sheet(wb, outOfStockWS, 'Out of Stock');

      // Generate filename
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `Reorder_Dashboard_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      alert(`Excel file exported successfully!\nFile: ${filename}\nNeeds Reorder: ${needsReorderData.length}\nOut of Stock: ${outOfStockData.length}`);
    } catch (error) {
      alert('Failed to export Excel file. Please try again.');
    }
  };

  const exportToPDF = () => {
    try {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert("Please allow popups to print the report. Check your browser's popup blocker settings.");
        return;
      }

      const now = new Date();
      const dateStr = now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString();

      // Generate HTML content for the report
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Reorder Dashboard Report</title>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background-color: white;
                color: black;
                font-size: 12px;
              }
              h1 {
                text-align: center;
                font-size: 24px;
                margin-bottom: 10px;
                color: #1f2937;
              }
              .report-meta {
                text-align: center;
                font-size: 14px;
                margin-bottom: 20px;
                color: #6b7280;
              }
              .summary {
                background-color: #f3f4f6;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                display: flex;
                justify-content: space-around;
                flex-wrap: wrap;
              }
              .summary-item {
                text-align: center;
                margin: 5px;
              }
              .summary-value {
                font-size: 18px;
                font-weight: bold;
                color: #1f2937;
              }
              .summary-label {
                font-size: 12px;
                color: #6b7280;
              }
              table {
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 20px;
              }
              th, td {
                border: 1px solid #d1d5db;
                padding: 8px;
                text-align: left;
                font-size: 11px;
              }
              th {
                background-color: #f9fafb;
                font-weight: bold;
                color: #374151;
              }
              .section-title {
                font-size: 18px;
                font-weight: bold;
                margin: 20px 0 10px 0;
                color: #1f2937;
                border-bottom: 2px solid #e5e7eb;
                padding-bottom: 5px;
              }
              .priority-urgent {
                background-color: #fee2e2;
                color: #dc2626;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 4px;
              }
              .priority-high {
                background-color: #fed7aa;
                color: #ea580c;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 4px;
              }
              .priority-medium {
                background-color: #fef3c7;
                color: #d97706;
                font-weight: bold;
                padding: 2px 6px;
                border-radius: 4px;
              }
              .out-of-stock-row {
                background-color: #fef2f2;
              }
              @media print {
                @page {
                  margin: 15mm;
                  size: A4 landscape;
                }
                body {
                  margin: 0;
                  padding: 0;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            </style>
          </head>
          <body>
            <h1>Reorder Dashboard Report</h1>
            <div class="report-meta">Generated on: ${dateStr} at ${timeStr}</div>
            
            <div class="summary">
              <div class="summary-item">
                <div class="summary-value">${reorderData.stats.totalLensesNeedingReorder}</div>
                <div class="summary-label">Needs Reorder</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${reorderData.stats.totalPowersOutOfStock}</div>
                <div class="summary-label">Out of Stock</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">₹${reorderData.stats.totalValueAtRisk.toFixed(2)}</div>
                <div class="summary-label">Value at Risk</div>
              </div>
              <div class="summary-item">
                <div class="summary-value">${reorderData.stats.urgentReorders}</div>
                <div class="summary-label">Urgent Reorders</div>
              </div>
            </div>

                        ${(() => {
              const filteredNeedsReorder = getFilteredNeedsReorderItems();
              if (filteredNeedsReorder.length > 0) {
                return `
                  <div class="section-title">Items Needing Reorder (${filteredNeedsReorder.length})</div>
                  <table>
                    <thead>
                      <tr>
                        <th>Priority</th>
                        <th>Lens Brand</th>
                        <th>Type</th>
                        <th>Details</th>
                        <th>Current Stock</th>
                        <th>Threshold</th>
                        <th>Suggested Order</th>
                        <th>Estimated Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${filteredNeedsReorder.map(item => `
                        <tr>
                          <td>
                            <span class="priority-${item.priority}">
                              ${item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                            </span>
                          </td>
                          <td>${item.lensName}</td>
                          <td>${item.type === 'power_specific' ? 'Power Specific' : 'General'}</td>
                          <td>${item.type === 'power_specific' ? item.powerDisplay : `${item.lensType} lens`}</td>
                          <td>${item.currentQty} ${item.type === 'power_specific' ? 'pieces' : 'units'}</td>
                          <td>${item.threshold} ${item.type === 'power_specific' ? 'pieces' : 'units'}</td>
                          <td>${item.suggestedOrder} ${item.type === 'power_specific' ? 'pieces' : 'units'}</td>
                          <td>₹${item.estimatedCost.toFixed(2)}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `;
              }
              return '';
            })()}

                                      ${(() => {
               const filteredOutOfStock = getFilteredOutOfStockItems();
               if (filteredOutOfStock.length > 0) {
                 return `
                   <div class="section-title">Powers Out of Stock (${filteredOutOfStock.length})</div>
                   <table>
                     <thead>
                       <tr>
                         <th>Lens Brand</th>
                         <th>Power Combination</th>
                         <th>Threshold</th>
                         <th>Suggested Order</th>
                         <th>Estimated Cost</th>
                       </tr>
                     </thead>
                     <tbody>
                       ${filteredOutOfStock.map(item => `
                         <tr class="out-of-stock-row">
                           <td>${item.lensName}</td>
                           <td>${item.powerDisplay}</td>
                           <td>${item.threshold} pieces</td>
                           <td>${item.suggestedOrder} pieces</td>
                           <td>₹${item.estimatedCost.toFixed(2)}</td>
                         </tr>
                       `).join('')}
                     </tbody>
                   </table>
                 `;
               }
               return '';
             })()}

             <script>
               window.onload = function() {
                 setTimeout(function() {
                   window.print();
                 }, 500);
               };
             </script>
           </body>
         </html>
       `;

      // Write to the new window
      printWindow.document.write(htmlContent);
      printWindow.document.close();

      // Fallback if window.onload doesn't trigger
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.focus();
          try {
            printWindow.print();
          } catch (e) {
            // Ignore printing errors
          }
        }
      }, 1000);

      const filename = `Reorder_Dashboard_${now.toISOString().split('T')[0]}.pdf`;
      alert(`Report sent to printer!\nYou can save as PDF from the print dialog.`);
    } catch (error) {
      alert('Failed to generate PDF report. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-500 dark:border-sky-400"></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Reorder Dashboard</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Monitor inventory levels and manage reorder requirements
              </p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:outline-none shadow-sm transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Excel
              </button>
              <button
                onClick={exportToPDF}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none shadow-sm transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Export PDF
              </button>
              <button
                onClick={fetchReorderData}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none shadow-sm transition-colors"
              >
                Refresh Data
              </button>
            </div>
          </div>

          {/* Statistics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Needs Reorder</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{reorderData.stats.totalLensesNeedingReorder}</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Out of Stock</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{reorderData.stats.totalPowersOutOfStock}</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Value at Risk</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{formatCurrency(reorderData.stats.totalValueAtRisk)}</div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
                <div className="ml-4">
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Urgent Reorders</div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">{reorderData.stats.urgentReorders}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-500 p-4 mb-6 rounded-r">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400 dark:text-red-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex">
              <button
                onClick={() => setActiveTab('needs-reorder')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'needs-reorder'
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Needs Reorder ({reorderData.stats.totalLensesNeedingReorder})
              </button>
              <button
                onClick={() => setActiveTab('out-of-stock')}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === 'out-of-stock'
                    ? 'border-red-500 text-red-600 dark:text-red-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                }`}
              >
                Out of Stock ({reorderData.stats.totalPowersOutOfStock})
              </button>
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'needs-reorder' ? (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Lenses Needing Reorder</h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {getFilteredNeedsReorderItems().length} items need reordering
                    {getFilteredNeedsReorderItems().length !== reorderData.needsReorder.length && 
                      ` (filtered from ${reorderData.needsReorder.length})`
                    }
                  </div>
                </div>

                {/* Search and Filter Controls */}
                <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    {/* Search Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Search
                      </label>
                      <input
                        type="text"
                        value={needsReorderSearch}
                        onChange={(e) => setNeedsReorderSearch(e.target.value)}
                        placeholder="Search lens brand or power..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Lens Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Lens Type
                      </label>
                      <select
                        value={needsReorderFilters.lensType}
                        onChange={(e) => setNeedsReorderFilters(prev => ({ ...prev, lensType: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">All Types</option>
                        {getNeedsReorderFilterOptions().lensTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* Priority Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Priority
                      </label>
                      <select
                        value={needsReorderFilters.priority}
                        onChange={(e) => setNeedsReorderFilters(prev => ({ ...prev, priority: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">All Priorities</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                      </select>
                    </div>

                    {/* Item Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Item Type
                      </label>
                      <select
                        value={needsReorderFilters.powerRange}
                        onChange={(e) => setNeedsReorderFilters(prev => ({ ...prev, powerRange: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">All Items</option>
                        <option value="general_only">General Stock Only</option>
                        <option value="power_specific_only">Power Specific Only</option>
                        <option value="positive">Positive Powers</option>
                        <option value="negative">Negative Powers</option>
                        <option value="high_plus">High Plus (≥+6.00)</option>
                        <option value="high_minus">High Minus (≤-6.00)</option>
                      </select>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-2">
                      <button
                        onClick={clearNeedsReorderFilters}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:outline-none text-sm"
                      >
                        Clear Filters
                      </button>
                      <button
                        onClick={() => setExpandedReorderBrands(new Set(getGroupedNeedsReorderData().map(group => group.brandName)))}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      >
                        Expand All
                      </button>
                      <button
                        onClick={() => setExpandedReorderBrands(new Set())}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:outline-none text-sm"
                      >
                        Collapse All
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Total estimated cost: {formatCurrency(getFilteredNeedsReorderItems().reduce((sum, item) => sum + item.estimatedCost, 0))}
                    </div>
                  </div>
                </div>

                {getGroupedNeedsReorderData().length > 0 ? (
                  <div className="space-y-4">
                    {getGroupedNeedsReorderData().map((group) => (
                      <div key={group.brandName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                        {/* Brand Header Row */}
                        <div 
                          className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
                            group.highestPriority === 'urgent' 
                              ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30'
                              : group.highestPriority === 'high'
                              ? 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 dark:hover:bg-orange-900/30'
                              : 'bg-yellow-50 dark:bg-yellow-900/20 hover:bg-yellow-100 dark:hover:bg-yellow-900/30'
                          }`}
                          onClick={() => toggleReorderBrandExpansion(group.brandName)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <button className="flex items-center">
                                {expandedReorderBrands.has(group.brandName) ? (
                                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </button>
                              <div className="flex items-center space-x-3">
                                <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(group.highestPriority)}`}>
                                  {group.highestPriority.charAt(0).toUpperCase() + group.highestPriority.slice(1)}
                                </span>
                                <div>
                                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{group.brandName}</h3>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">{group.lensType} lens</p>
                                </div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className={`text-sm font-medium ${
                                group.highestPriority === 'urgent' ? 'text-red-600 dark:text-red-400' :
                                group.highestPriority === 'high' ? 'text-orange-600 dark:text-orange-400' :
                                'text-yellow-600 dark:text-yellow-400'
                              }`}>
                                {group.items.length} item(s) need reorder
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Total Order: {group.totalSuggestedOrder} units • {formatCurrency(group.totalEstimatedCost)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedReorderBrands.has(group.brandName) && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Priority
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Details
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Current Stock
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Threshold
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Suggested Order
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Estimated Cost
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {group.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getPriorityColor(item.priority)}`}>
                                        {item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4">
                                      <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {item.type === 'power_specific' ? (
                                          <span className="font-mono">{item.powerDisplay}</span>
                                        ) : (
                                          `${item.lensType || 'General'} lens`
                                        )}
                                      </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                      <span className={`text-sm font-medium ${
                                        item.currentQty === 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
                                      }`}>
                                        {item.currentQty} {item.type === 'power_specific' ? 'pieces' : 'units'}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      {item.threshold} {item.type === 'power_specific' ? 'pieces' : 'units'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600 dark:text-blue-400">
                                      {item.suggestedOrder} {item.type === 'power_specific' ? 'pieces' : 'units'}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      {formatCurrency(item.estimatedCost)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <button
                                        onClick={() => handleViewLens(item.lensId || item.id)}
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                                      >
                                        View Details
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      {reorderData.needsReorder.length === 0 ? 'All good!' : 'No items match your filters'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {reorderData.needsReorder.length === 0 ? 'No lenses need reordering at this time.' : 'Try adjusting your search or filter criteria.'}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div>
                <div className="mb-4 flex justify-between items-center">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Powers Out of Stock</h2>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {getFilteredOutOfStockItems().length} powers completely out of stock
                    {getFilteredOutOfStockItems().length !== reorderData.outOfStock.length && 
                      ` (filtered from ${reorderData.outOfStock.length})`
                    }
                  </div>
                </div>

                {/* Search and Filter Controls */}
                <div className="mb-6 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                    {/* Search Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Search
                      </label>
                      <input
                        type="text"
                        value={outOfStockSearch}
                        onChange={(e) => setOutOfStockSearch(e.target.value)}
                        placeholder="Search lens brand or power..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      />
                    </div>

                    {/* Lens Type Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Lens Type
                      </label>
                      <select
                        value={outOfStockFilters.lensType}
                        onChange={(e) => setOutOfStockFilters(prev => ({ ...prev, lensType: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">All Types</option>
                        {getFilterOptions().lensTypes.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </div>

                    {/* Power Range Filter */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Power Range
                      </label>
                      <select
                        value={outOfStockFilters.powerRange}
                        onChange={(e) => setOutOfStockFilters(prev => ({ ...prev, powerRange: e.target.value }))}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="">All Powers</option>
                        <option value="positive">Positive SPH</option>
                        <option value="negative">Negative SPH</option>
                        <option value="high_plus">High Plus (≥+6.00)</option>
                        <option value="high_minus">High Minus (≤-6.00)</option>
                      </select>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-end space-x-2">
                      <button
                        onClick={clearFilters}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:outline-none text-sm"
                      >
                        Clear
                      </button>
                      <button
                        onClick={() => setExpandedBrands(new Set(getGroupedOutOfStockData().map(group => group.brandName)))}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
                      >
                        Expand All
                      </button>
                      <button
                        onClick={() => setExpandedBrands(new Set())}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:ring-2 focus:ring-gray-500 focus:outline-none text-sm"
                      >
                        Collapse All
                      </button>
                    </div>
                  </div>
                </div>

                {getGroupedOutOfStockData().length > 0 ? (
                  <div className="space-y-4">
                    {getGroupedOutOfStockData().map((group) => (
                      <div key={group.brandName} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden bg-white dark:bg-gray-800">
                        {/* Brand Header Row */}
                        <div 
                          className="px-6 py-4 bg-red-50 dark:bg-red-900/20 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          onClick={() => toggleBrandExpansion(group.brandName)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <button className="flex items-center">
                                {expandedBrands.has(group.brandName) ? (
                                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                                  </svg>
                                ) : (
                                  <svg className="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                                  </svg>
                                )}
                              </button>
                              <div>
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{group.brandName}</h3>
                                <p className="text-sm text-gray-600 dark:text-gray-400">{group.lensType} lens</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-red-600 dark:text-red-400">
                                {group.items.length} powers out of stock
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400">
                                Total Order: {group.totalSuggestedOrder} pieces • {formatCurrency(group.totalEstimatedCost)}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {expandedBrands.has(group.brandName) && (
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                              <thead className="bg-gray-50 dark:bg-gray-700">
                                <tr>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Power Combination
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Threshold
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Suggested Order
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Estimated Cost
                                  </th>
                                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                    Actions
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                {group.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                    <td className="px-6 py-4">
                                      <span className="text-sm font-mono text-gray-900 dark:text-white">{item.powerDisplay}</span>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      {item.threshold} pieces
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                                      {item.suggestedOrder} pieces
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                      {formatCurrency(item.estimatedCost)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                      <button
                                        onClick={() => handleViewLens(item.lensId)}
                                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                                      >
                                        View Details
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                      {reorderData.outOfStock.length === 0 ? 'No out of stock items!' : 'No items match your filters'}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      {reorderData.outOfStock.length === 0 ? 'All powers have stock available.' : 'Try adjusting your search or filter criteria.'}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default ReorderDashboard; 
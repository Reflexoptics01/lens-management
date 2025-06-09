import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { doc, getDoc, collection, query, where, getDocs, orderBy, updateDoc, addDoc, Timestamp } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import Navbar from '../components/Navbar';
import PowerSelectionModal from '../components/PowerSelectionModal';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
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

  // Add states for inventory deduction
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [deductionData, setDeductionData] = useState({
    quantity: 1,
    reason: '',
    notes: '',
    customReason: ''
  });
  const [deductionLoading, setDeductionLoading] = useState(false);

  // Add states for reorder threshold management
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholdData, setThresholdData] = useState({
    generalThreshold: 5,
    powerThresholds: {}
  });
  const [thresholdLoading, setThresholdLoading] = useState(false);

  // Add states for power selection in deduction
  const [showPowerSelectionForDeduction, setShowPowerSelectionForDeduction] = useState(false);
  const [selectedPowersForDeduction, setSelectedPowersForDeduction] = useState([]);
  const [deductionType, setDeductionType] = useState('general'); // 'general' or 'specific'

  // Add states for power search and display
  const [powerSearch, setPowerSearch] = useState('');
  const [searchType, setSearchType] = useState('all'); // 'all', 'in-stock', 'out-of-stock'
  const [sortBy, setSortBy] = useState('power'); // 'power', 'quantity'
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'table'
  const [showOutOfStock, setShowOutOfStock] = useState(true);

  // Export functions
  const exportToExcel = (filteredPowers, lens) => {
    try {
      // Prepare data for Excel export
      const excelData = filteredPowers.map((power, index) => ({
        'S.No': index + 1,
        'Brand': lens.brandName || 'N/A',
        'Lens Type': lens.lensType === 'bifocal' ? 'Bifocal/Progressive' : 'Single Vision',
        'SPH': power.sph >= 0 ? `+${power.sph}` : power.sph,
        'CYL': power.cyl >= 0 ? `+${power.cyl}` : power.cyl,
        'ADD': power.type === 'bifocal' ? `+${power.addition}` : '-',
        'AXIS': `${power.axis}°`,
        'Quantity': power.quantity,
        'Status': power.inStock ? 'In Stock' : 'Out of Stock',
        'Stock Level': power.inStock ? 
          (power.quantity >= 10 ? 'High' : power.quantity >= 5 ? 'Medium' : 'Low') : 
          'Empty',
        'Purchase Price': lens.purchasePrice ? `₹${lens.purchasePrice}` : 'N/A',
        'Sale Price': lens.salePrice ? `₹${lens.salePrice}` : 'N/A',
        'Total Value': lens.purchasePrice ? `₹${(power.quantity * lens.purchasePrice).toFixed(2)}` : 'N/A'
      }));

      // Create workbook and worksheet
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Set column widths
      const colWidths = [
        { wch: 6 },   // S.No
        { wch: 20 },  // Brand
        { wch: 18 },  // Lens Type
        { wch: 8 },   // SPH
        { wch: 8 },   // CYL
        { wch: 8 },   // ADD
        { wch: 8 },   // AXIS
        { wch: 10 },  // Quantity
        { wch: 12 },  // Status
        { wch: 12 },  // Stock Level
        { wch: 15 },  // Purchase Price
        { wch: 15 },  // Sale Price
        { wch: 15 }   // Total Value
      ];
      ws['!cols'] = colWidths;

      // Add worksheet to workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Stock Inventory');

      // Generate filename with current date and filter info
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filterInfo = searchType === 'all' ? 'All' : 
                        searchType === 'in-stock' ? 'InStock' : 'OutOfStock';
      const searchInfo = powerSearch ? `_Search-${powerSearch.replace(/[^a-zA-Z0-9]/g, '')}` : '';
      const filename = `${lens.brandName || 'LensInventory'}_${filterInfo}${searchInfo}_${dateStr}.xlsx`;

      // Save file
      XLSX.writeFile(wb, filename);

      // Show success message
      alert(`Excel file exported successfully!\nFile: ${filename}\nRecords: ${filteredPowers.length}`);
    } catch (error) {

      alert('Failed to export Excel file. Please try again.');
    }
  };

  const exportToPDF = (filteredPowers, lens) => {
    try {
      // Create new PDF document in landscape orientation for better table fit
      const doc = new jsPDF('landscape', 'pt', 'a4');
      
      // Add title
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${lens.brandName || 'Lens'} - Stock Inventory Report`, 40, 40);
      
      // Add metadata
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      const now = new Date();
      const dateStr = now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString();
      doc.text(`Generated on: ${dateStr} at ${timeStr}`, 40, 60);
      
      // Add filter information
      let filterText = `Filter: ${searchType === 'all' ? 'All Powers' : 
                                 searchType === 'in-stock' ? 'In Stock Only' : 'Out of Stock Only'}`;
      if (powerSearch) {
        filterText += ` | Search: "${powerSearch}"`;
      }
      filterText += ` | Sort: ${sortBy === 'power' ? 'By Power' : 'By Quantity'}`;
      filterText += ` | Records: ${filteredPowers.length}`;
      doc.text(filterText, 40, 75);

      // Add summary statistics
      const inStockCount = filteredPowers.filter(p => p.inStock).length;
      const outOfStockCount = filteredPowers.filter(p => !p.inStock).length;
      const totalQuantity = filteredPowers.reduce((sum, p) => sum + p.quantity, 0);
      const summaryText = `Summary: ${inStockCount} In Stock, ${outOfStockCount} Out of Stock, Total Pieces: ${totalQuantity}`;
      doc.text(summaryText, 40, 90);

      // Prepare table data - simplified to fit in page width
      const tableData = filteredPowers.map((power, index) => [
        index + 1,
        power.sph >= 0 ? `+${power.sph}` : power.sph,
        power.cyl >= 0 ? `+${power.cyl}` : power.cyl,
        power.type === 'bifocal' ? `+${power.addition}` : '-',
        `${power.axis}°`,
        power.quantity,
        power.inStock ? 'In Stock' : 'Out of Stock',
        power.inStock ? 
          (power.quantity >= 10 ? 'High' : power.quantity >= 5 ? 'Medium' : 'Low') : 
          'Empty'
      ]);

      // Simplified table headers that fit better on page
      const headers = [
        'S.No', 'SPH', 'CYL', 'ADD', 'AXIS', 'Qty', 'Status', 'Stock Level'
      ];

      // Create table with autoTable - using proper syntax
      autoTable(doc, {
        head: [headers],
        body: tableData,
        startY: 110,
        margin: { left: 20, right: 20 },
        styles: {
          fontSize: 9,
          cellPadding: 4,
          overflow: 'linebreak',
          halign: 'center'
        },
        headStyles: {
          fillColor: [66, 139, 202],
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        columnStyles: {
          0: { cellWidth: 'auto', halign: 'center' },   // S.No
          1: { cellWidth: 'auto', halign: 'center' },   // SPH
          2: { cellWidth: 'auto', halign: 'center' },   // CYL
          3: { cellWidth: 'auto', halign: 'center' },   // ADD
          4: { cellWidth: 'auto', halign: 'center' },   // AXIS
          5: { cellWidth: 'auto', halign: 'center' },   // Qty
          6: { cellWidth: 'auto', halign: 'center' },   // Status
          7: { cellWidth: 'auto', halign: 'center' }    // Stock Level
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245]
        },
        didParseCell: function(data) {
          // Color code the status column
          if (data.column.index === 6) { // Status column
            if (data.cell.text[0] === 'Out of Stock') {
              data.cell.styles.textColor = [220, 53, 69]; // Red for out of stock
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [40, 167, 69]; // Green for in stock
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Color code the stock level column
          if (data.column.index === 7) { // Stock Level column
            const level = data.cell.text[0];
            if (level === 'High') {
              data.cell.styles.textColor = [40, 167, 69]; // Green
            } else if (level === 'Medium') {
              data.cell.styles.textColor = [255, 193, 7]; // Yellow
            } else if (level === 'Low') {
              data.cell.styles.textColor = [255, 87, 34]; // Orange
            } else if (level === 'Empty') {
              data.cell.styles.textColor = [220, 53, 69]; // Red
            }
          }
        }
      });

      // Get final Y position - use the correct property
      let finalY = 400; // fallback position
      try {
        if (doc.autoTable && doc.autoTable.previous) {
          finalY = doc.autoTable.previous.finalY + 20;
        }
      } catch (err) {
        // Could not get table final Y position, using fallback
      }
      
      // Add footer with totals  
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      const totalValue = filteredPowers.reduce((sum, power) => {
        return sum + (power.quantity * (lens.purchasePrice || 0));
      }, 0);
      
      // Footer information
      doc.text(`Total Pieces: ${totalQuantity}`, 40, finalY);
      doc.text(`Lens Type: ${lens.lensType === 'bifocal' ? 'Bifocal/Progressive' : 'Single Vision'}`, 250, finalY);
      if (lens.purchasePrice) {
        doc.text(`Total Inventory Value: ₹${totalValue.toFixed(2)}`, 500, finalY);
      }

      // Generate filename
      const filterInfo = searchType === 'all' ? 'All' : 
                        searchType === 'in-stock' ? 'InStock' : 'OutOfStock';
      const searchInfo = powerSearch ? `_Search-${powerSearch.replace(/[^a-zA-Z0-9]/g, '')}` : '';
      const filename = `${lens.brandName || 'LensInventory'}_${filterInfo}${searchInfo}_${now.toISOString().split('T')[0]}.pdf`;

      // Save PDF
      doc.save(filename);

      // Show success message
      alert(`PDF file exported successfully!\nFile: ${filename}\nRecords: ${filteredPowers.length}`);
    } catch (error) {

      alert('Failed to export PDF file. Please try again.');
    }
  };

  useEffect(() => {
    fetchLensDetails();
  }, [id]);

  // Add keyboard shortcuts for better UX
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle shortcuts when not in an input field
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      // Ctrl/Cmd + F to focus search
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search powers"]');
        if (searchInput) {
          searchInput.focus();
        }
      }

      // Escape to clear search
      if (e.key === 'Escape') {
        setPowerSearch('');
        setSearchType('all');
      }

      // Number keys for quick filters
      if (e.key === '1') {
        setSearchType('all');
      } else if (e.key === '2') {
        setSearchType('in-stock');
      } else if (e.key === '3') {
        setSearchType('out-of-stock');
      }

      // G for grid, T for table
      if (e.key.toLowerCase() === 'g') {
        setViewMode('grid');
      } else if (e.key.toLowerCase() === 't') {
        setViewMode('table');
      }

      // S to toggle sort
      if (e.key.toLowerCase() === 's') {
        setSortBy(sortBy === 'quantity' ? 'power' : 'quantity');
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [sortBy]);

  const fetchLensDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch the lens details
      const lensDoc = await getDoc(getUserDoc('lensInventory', id));
      
      if (!lensDoc.exists()) {
        throw new Error('Lens not found');
      }
      
      const lensData = { id: lensDoc.id, ...lensDoc.data() };
      setLens(lensData);
      
      // After getting the lens data, fetch sales metrics
      await fetchSalesMetrics(lensData);
      calculateFinancialMetrics(lensData);
      
    } catch (error) {
      setError('Could not load lens details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesMetrics = async (lensData) => {
    try {
      // This requires sales data to be stored in a 'sales' collection
      // with each sale item having a lensId field to match with
      
      const salesRef = getUserCollection('sales');
      
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
      // Error fetching sales metrics - continue without metrics
    }
  };

  const calculateFinancialMetrics = (lensData) => {
    // Calculate correct total quantity based on inventory type
    let totalQty = 0;
    
    if (lensData.type === 'stock' && lensData.inventoryType === 'individual' && lensData.powerInventory) {
      // For individual power inventory, sum all individual quantities
      totalQty = Object.values(lensData.powerInventory).reduce((sum, powerData) => {
        return sum + (parseInt(powerData?.quantity) || 0);
      }, 0);
    } else {
      // For regular inventory, use the qty field
      totalQty = parseInt(lensData.qty || 0);
    }
    
    const purchasePrice = parseFloat(lensData.purchasePrice || 0);
    const salePrice = parseFloat(lensData.salePrice || 0);
    
    // Total investment (cost of all units)
    const totalValue = totalQty * purchasePrice;
    
    // Potential revenue if all units are sold
    const potentialRevenue = totalQty * salePrice;
    
    // Potential profit if all units are sold
    const potentialProfit = potentialRevenue - totalValue;
    
    // Profit margin percentage
    const profitMarginPercent = potentialRevenue > 0 ? ((potentialProfit / potentialRevenue) * 100) : 0;
    
    // Calculate break-even quantity - Units needed to recover total investment
    let breakEvenQty = 0;
    
    if (salePrice > 0) {
      // Break-even formula: Total inventory cost / Sale price per unit
      breakEvenQty = Math.ceil(totalValue / salePrice);
      
      // If break-even quantity exceeds available quantity, it means we can't break even
      if (breakEvenQty > totalQty) {
        breakEvenQty = Infinity; // Indicates can't break even with current stock
      }
    } else {
      // If sale price is zero, can't break even
      breakEvenQty = Infinity;
    }
    
    // Calculate inventory turnover potential
    const inventoryTurnoverPotential = totalQty > 0 ? (potentialRevenue / totalValue) : 0;
    
    // Calculate cost per unit and profit per unit
    const costPerUnit = purchasePrice;
    const profitPerUnit = salePrice - purchasePrice;
    
    // Calculate ROI (Return on Investment) percentage
    const roiPercent = totalValue > 0 ? ((potentialProfit / totalValue) * 100) : 0;
    
    setFinancialMetrics(prev => ({
      ...prev,
      totalValue,
      breakEvenQty,
      potentialProfit,
      totalQuantity: totalQty,
      potentialRevenue,
      profitMarginPercent,
      inventoryTurnoverPotential,
      costPerUnit,
      profitPerUnit,
      roiPercent
    }));
  };

  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const handleInventoryDeduction = async () => {
    try {
      setDeductionLoading(true);
      setError('');

      if (!deductionData.reason && !deductionData.customReason) {
        setError('Please select or enter a reason for the deduction');
        return;
      }

      const finalReason = deductionData.reason === 'other' ? deductionData.customReason : deductionData.reason;

      if (deductionType === 'specific' && lens.type === 'stock' && lens.inventoryType === 'individual') {
        // Handle power-specific deduction
        if (selectedPowersForDeduction.length === 0) {
          setError('Please select powers to deduct from');
          return;
        }

        // Validate that all selected powers have sufficient quantity
        for (const powerSelection of selectedPowersForDeduction) {
          const currentPowerQuantity = parseInt(lens.powerInventory[powerSelection.powerKey]?.quantity || 0);
          if (powerSelection.pieceQuantity > currentPowerQuantity) {
            setError(`Cannot deduct ${powerSelection.pieceQuantity} pieces from power ${powerSelection.powerDisplay}. Only ${currentPowerQuantity} pieces available.`);
            return;
          }
        }

        // Calculate total pieces being deducted
        const totalPiecesDeducted = selectedPowersForDeduction.reduce((sum, power) => sum + power.pieceQuantity, 0);

        // Update power inventory
        const updatedPowerInventory = { ...lens.powerInventory };
        const deductionDetails = [];

        for (const powerSelection of selectedPowersForDeduction) {
          const currentQuantity = parseInt(updatedPowerInventory[powerSelection.powerKey]?.quantity || 0);
          const newQuantity = currentQuantity - powerSelection.pieceQuantity;
          
          updatedPowerInventory[powerSelection.powerKey] = {
            ...updatedPowerInventory[powerSelection.powerKey],
            quantity: newQuantity
          };

          deductionDetails.push({
            powerKey: powerSelection.powerKey,
            powerDisplay: powerSelection.powerDisplay,
            deductedQuantity: powerSelection.pieceQuantity,
            previousQuantity: currentQuantity,
            newQuantity: newQuantity,
            eyeSelection: powerSelection.eyeSelection
          });
        }

        // Calculate new total quantity
        const newTotalQuantity = Object.values(updatedPowerInventory).reduce((sum, powerData) => {
          return sum + (parseInt(powerData?.quantity) || 0);
        }, 0);

        // Update the lens in Firestore
        const lensRef = getUserDoc('lensInventory', id);
        await updateDoc(lensRef, {
          powerInventory: updatedPowerInventory,
          totalQuantity: newTotalQuantity,
          updatedAt: Timestamp.now()
        });

        // Log the power-specific deduction
        await addDoc(getUserCollection('inventoryDeductions'), {
          lensId: id,
          lensName: lens.brandName,
          lensType: lens.type,
          deductionType: 'power_specific',
          deductedQuantity: totalPiecesDeducted,
          powerDeductions: deductionDetails,
          reason: finalReason,
          notes: deductionData.notes,
          deductedAt: Timestamp.now(),
          deductedBy: 'current_user'
        });

        // Update local state
        setLens(prev => ({
          ...prev,
          powerInventory: updatedPowerInventory,
          totalQuantity: newTotalQuantity
        }));

        // Show success message
        const successMessage = `Successfully deducted ${totalPiecesDeducted} pieces from ${selectedPowersForDeduction.length} power(s). New total: ${newTotalQuantity}`;
        alert(successMessage);

      } else {
        // Handle general deduction (existing logic)
      const deductQty = parseInt(deductionData.quantity);
      const currentQty = parseInt(lens.qty || 0);

      if (deductQty <= 0) {
        setError('Deduction quantity must be greater than 0');
        return;
      }

      if (deductQty > currentQty) {
        setError(`Cannot deduct ${deductQty} units. Only ${currentQty} units available in inventory.`);
        return;
      }

      const newQty = currentQty - deductQty;

      // Update the lens quantity in Firestore
      const lensRef = getUserDoc('lensInventory', id);
      await updateDoc(lensRef, {
        qty: newQty,
        updatedAt: Timestamp.now()
      });

        // Log the general deduction
      await addDoc(getUserCollection('inventoryDeductions'), {
        lensId: id,
        lensName: lens.brandName,
        lensType: lens.type,
          deductionType: 'general',
        deductedQuantity: deductQty,
        previousQuantity: currentQty,
        newQuantity: newQty,
        reason: finalReason,
        notes: deductionData.notes,
        deductedAt: Timestamp.now(),
          deductedBy: 'current_user'
      });

      // Update local state
      setLens(prev => ({
        ...prev,
        qty: newQty
      }));

        // Show success message
      const successMessage = `Successfully deducted ${deductQty} units. New quantity: ${newQty}`;
        alert(successMessage);
      }
      
      // Reset modal and clear states
      resetDeductionModal();

    } catch (error) {
      // Error deducting inventory
      setError(`Failed to deduct inventory: ${error.message}`);
    } finally {
      setDeductionLoading(false);
    }
  };

  const resetDeductionModal = () => {
    setShowDeductionModal(false);
    setDeductionData({
      quantity: 1,
      reason: '',
      notes: '',
      customReason: ''
    });
    setSelectedPowersForDeduction([]);
    setDeductionType('general');
    setShowPowerSelectionForDeduction(false);
  };

  // Handle power selection for deduction
  const handlePowerSelectionForDeduction = (rowIndex, powerSelections) => {
    setSelectedPowersForDeduction(powerSelections);
    setShowPowerSelectionForDeduction(false);
  };

  // Open power selection modal for deduction
  const openPowerSelectionForDeduction = () => {
    setDeductionType('specific');
    setShowPowerSelectionForDeduction(true);
  };

  // Initialize threshold data when lens loads
  useEffect(() => {
    if (lens) {
      setThresholdData({
        generalThreshold: lens.reorderThreshold || 5,
        powerThresholds: lens.powerReorderThresholds || {}
      });
    }
  }, [lens]);

  // Handle threshold updates
  const handleUpdateThresholds = async () => {
    try {
      setThresholdLoading(true);
      setError('');

      const updateData = {
        reorderThreshold: parseInt(thresholdData.generalThreshold),
        powerReorderThresholds: thresholdData.powerThresholds,
        updatedAt: Timestamp.now()
      };

      const lensRef = getUserDoc('lensInventory', id);
      await updateDoc(lensRef, updateData);

      // Update local state
      setLens(prev => ({
        ...prev,
        reorderThreshold: updateData.reorderThreshold,
        powerReorderThresholds: updateData.powerReorderThresholds
      }));

      setShowThresholdModal(false);
      alert('Reorder thresholds updated successfully!');

    } catch (error) {
      setError(`Failed to update thresholds: ${error.message}`);
    } finally {
      setThresholdLoading(false);
    }
  };

  // Handle individual power threshold change
  const handlePowerThresholdChange = (powerKey, threshold) => {
    setThresholdData(prev => ({
      ...prev,
      powerThresholds: {
        ...prev.powerThresholds,
        [powerKey]: parseInt(threshold) || 0
      }
    }));
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

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
          <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-500 p-4 mb-4 rounded-r">
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
      <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
        <Navbar />
        <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
          <div className="text-center py-10">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200">Lens not found</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">The requested lens could not be found.</p>
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
    <div className="flex flex-col min-h-screen bg-slate-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="flex-grow p-4 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{lens.brandName}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {lens.type === 'stock' ? (
                <>Stock Lens - {lens.powerSeries}</>
              ) : (
                <>Prescription Lens - SPH: {lens.sph || 'N/A'} CYL: {lens.cyl || 'N/A'} AXIS: {lens.axis || 'N/A'}</>
              )}
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={() => setShowThresholdModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none shadow-sm transition-colors"
            >
              Set Reorder Threshold
            </button>
            <button
              onClick={() => setShowDeductionModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none shadow-sm transition-colors"
            >
              Deduce Inventory
            </button>
            <button
              onClick={() => navigate('/lens-inventory')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Back to Inventory
            </button>
            <div className="relative group">
              <button className="px-3 py-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-10">
                <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-2">Keyboard Shortcuts</h4>
                <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>Focus search:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Ctrl+F</kbd>
          </div>
                  <div className="flex justify-between">
                    <span>Clear filters:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">Esc</kbd>
        </div>
                  <div className="flex justify-between">
                    <span>Show all:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">1</kbd>
                </div>
                  <div className="flex justify-between">
                    <span>Show in stock:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">2</kbd>
                </div>
                  <div className="flex justify-between">
                    <span>Show out of stock:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">3</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Grid view:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">G</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Table view:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">T</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span>Toggle sort:</span>
                    <kbd className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">S</kbd>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Lens Details Card */}
        <div className="bg-gradient-to-r from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700 overflow-hidden relative">
          {/* Background Pattern */}
          <div className="absolute top-0 right-0 w-32 h-32 opacity-5 dark:opacity-10">
            <svg viewBox="0 0 100 100" className="w-full h-full">
              <circle cx="50" cy="20" r="20" fill="currentColor" />
              <circle cx="80" cy="50" r="15" fill="currentColor" />
              <circle cx="20" cy="80" r="10" fill="currentColor" />
            </svg>
            </div>
            
          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center mr-3">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                    </div>
                Lens Details
              </h2>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                lens.type === 'stock' 
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200' 
                  : 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
              }`}>
                {lens.type === 'stock' ? '📦 Stock Lens' : '🔧 Prescription Lens'}
                    </div>
                    </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Basic Information */}
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mr-2">
                    <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                    </svg>
                    </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Basic Information</h3>
                    </div>
                
                <div className="space-y-3">
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Brand Name</span>
                      <span className="text-base font-bold text-gray-900 dark:text-white">{lens.brandName || 'N/A'}</span>
              </div>
            </div>
            
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Type</span>
                      <span className={`px-2 py-1 rounded-md text-sm font-medium capitalize ${
                        lens.type === 'stock' 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                          : 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                      }`}>
                        {lens.type || 'N/A'}
                  </span>
                </div>
                </div>

                  {lens.type === 'stock' && (
                    <>
                      <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                        <div className="mb-2">
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Power Series</span>
                </div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-700 px-3 py-2 rounded-md">
                          {lens.powerSeries || 'N/A'}
                  </div>
                  </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max SPH</div>
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                            {lens.maxSph || 'N/A'}
              </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Max CYL</div>
                          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                            {lens.maxCyl || 'N/A'}
            </div>
          </div>
        </div>
        
                      {lens.inventoryType && (
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Inventory Type</span>
                            <span className={`px-2 py-1 rounded-md text-sm font-medium capitalize ${
                              lens.inventoryType === 'individual' 
                                ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300' 
                                : 'bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                              {lens.inventoryType}
                </span>
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {lens.type === 'prescription' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">SPH</div>
                          <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{lens.sph || 'N/A'}</div>
                    </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">CYL</div>
                          <div className="text-lg font-bold text-green-600 dark:text-green-400">{lens.cyl || 'N/A'}</div>
                  </div>
                    </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">AXIS</div>
                          <div className="text-lg font-bold text-purple-600 dark:text-purple-400">{lens.axis || 'N/A'}</div>
                  </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-100 dark:border-gray-700">
                          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">ADD</div>
                          <div className="text-lg font-bold text-orange-600 dark:text-orange-400">{lens.add || 'N/A'}</div>
                    </div>
                  </div>
                    </div>
                  )}
                  </div>
                </div>

              {/* Specifications */}
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <div className="w-6 h-6 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mr-2">
                    <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Specifications</h3>
                </div>
                
                {lens.type === 'prescription' ? (
                  <div className="space-y-3">
                    {[
                      { label: 'Material', value: lens.material, icon: '🔬' },
                      { label: 'Index', value: lens.index, icon: '📊' },
                      { label: 'Coating', value: `${lens.coatingType || 'N/A'} ${lens.coatingColor ? `(${lens.coatingColor})` : ''}`, icon: '✨' },
                      { label: 'Base Tint', value: lens.baseTint, icon: '🎨' },
                      { label: 'Diameter', value: lens.diameter ? `${lens.diameter}mm` : 'N/A', icon: '📏' }
                    ].map((spec, index) => (
                      <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <span className="mr-2">{spec.icon}</span>
                            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{spec.label}</span>
                  </div>
                          <span className="text-sm font-semibold text-gray-900 dark:text-white">{spec.value || 'N/A'}</span>
                </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700 text-center">
                    <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Stock lens specifications are managed through power inventory
                    </p>
              </div>
            )}
              </div>

              {/* Inventory & Pricing */}
              <div className="space-y-4">
                <div className="flex items-center mb-4">
                  <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mr-2">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <h3 className="text-base font-semibold text-gray-900 dark:text-white">Inventory & Pricing</h3>
                </div>

                <div className="space-y-3">
                  {/* Quantity Display */}
                  <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/10 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                    <div className="flex items-center justify-between">
                <div>
                        <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">Quantity in Stock</div>
                        <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          {lens.type === 'stock' && lens.inventoryType === 'individual' && lens.totalQuantity 
                            ? lens.totalQuantity 
                            : (lens.qty || '0')}
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400">
                          {lens.type === 'stock' && lens.inventoryType === 'individual' 
                            ? 'pieces (Individual tracking)' 
                            : `${lens.type === 'stock' ? 'pairs' : 'units'}`}
                        </div>
                      </div>
                      <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  
                  {/* Pricing Information */}
                  <div className="grid grid-cols-1 gap-3">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="text-red-500 mr-2">💰</span>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Purchase Price</span>
                              </div>
                        <span className="text-lg font-bold text-red-600 dark:text-red-400">{formatCurrency(lens.purchasePrice || 0)}</span>
                            </div>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="text-green-500 mr-2">💵</span>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Sale Price</span>
                              </div>
                        <span className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(lens.salePrice || 0)}</span>
                            </div>
                    </div>

                    {/* Profit Margin */}
                    {lens.purchasePrice && lens.salePrice && (
                      <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/10 rounded-lg p-4 border border-green-200 dark:border-green-700">
                            <div className="flex justify-between items-center">
                          <div className="flex items-center">
                            <span className="text-emerald-500 mr-2">📈</span>
                            <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Profit Margin</span>
                              </div>
                              <div className="text-right">
                            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency((lens.salePrice || 0) - (lens.purchasePrice || 0))}
                              </div>
                            <div className="text-xs text-emerald-600 dark:text-emerald-400">
                              {lens.salePrice > 0 ? `${(((lens.salePrice - lens.purchasePrice) / lens.salePrice) * 100).toFixed(1)}%` : '0%'}
                            </div>
                          </div>
                  </div>
                    </div>
                  )}
                    </div>

                  {/* Additional Information */}
                  {lens.type === 'prescription' && lens.location && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center">
                          <span className="text-blue-500 mr-2">📍</span>
                          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Storage Location</span>
                                </div>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{lens.location}</span>
                              </div>
                                </div>
                  )}

                  {lens.notes && (
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-100 dark:border-gray-700">
                      <div className="flex items-start">
                        <span className="text-yellow-500 mr-2 mt-0.5">📝</span>
                                <div>
                          <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Notes</div>
                          <div className="text-sm text-gray-900 dark:text-white">{lens.notes}</div>
                                </div>
                                </div>
                              </div>
                  )}
                            </div>
                    </div>
                  </div>
          </div>
        </div>
        
        {/* Financial Analysis Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Financial Analysis</h2>
          
          {/* Primary Financial Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
              <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase mb-2">Total Investment</h3>
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{formatCurrency(financialMetrics.totalValue)}</div>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Cost of {financialMetrics.totalQuantity || 0} units @ {formatCurrency(financialMetrics.costPerUnit || 0)} each
              </p>
            </div>
            
            <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg border border-green-200 dark:border-green-700">
              <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 uppercase mb-2">Potential Revenue</h3>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(financialMetrics.potentialRevenue || 0)}</div>
              <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                If all {financialMetrics.totalQuantity || 0} units sold @ {formatCurrency(lens.salePrice || 0)} each
              </p>
            </div>
            
            <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
              <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase mb-2">Potential Profit</h3>
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{formatCurrency(financialMetrics.potentialProfit)}</div>
              <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">
                {formatCurrency(financialMetrics.profitPerUnit || 0)} profit per unit
              </p>
            </div>
          </div>
          
          {/* Secondary Financial Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className={`${financialMetrics.breakEvenQty === Infinity ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-700' : 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700'} p-4 rounded-lg border`}>
              <h3 className={`text-sm font-semibold ${financialMetrics.breakEvenQty === Infinity ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'} uppercase mb-2`}>Break-Even Point</h3>
              <div className={`text-xl font-bold ${financialMetrics.breakEvenQty === Infinity ? 'text-red-700 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                {financialMetrics.breakEvenQty === Infinity ? 
                  "Not achievable" : 
                  `${financialMetrics.breakEvenQty} units`}
              </div>
              <p className={`text-xs ${financialMetrics.breakEvenQty === Infinity ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'} mt-1`}>
                {financialMetrics.breakEvenQty === Infinity ?
                  "Cannot recover investment" :
                  "To recover your investment"}
              </p>
            </div>
            
            <div className="bg-sky-50 dark:bg-sky-900/30 p-4 rounded-lg border border-sky-200 dark:border-sky-700">
              <h3 className="text-sm font-semibold text-sky-700 dark:text-sky-300 uppercase mb-2">Profit Margin</h3>
              <div className="text-xl font-bold text-sky-700 dark:text-sky-300">
                {(financialMetrics.profitMarginPercent || 0).toFixed(1)}%
              </div>
              <p className="text-xs text-sky-600 dark:text-sky-400 mt-1">Profit as % of revenue</p>
            </div>
            
            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
              <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 uppercase mb-2">ROI Potential</h3>
              <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                {(financialMetrics.roiPercent || 0).toFixed(1)}%
              </div>
              <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">Return on investment</p>
            </div>
            
            <div className="bg-rose-50 dark:bg-rose-900/30 p-4 rounded-lg border border-rose-200 dark:border-rose-700">
              <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300 uppercase mb-2">Turnover Ratio</h3>
              <div className="text-xl font-bold text-rose-700 dark:text-rose-300">
                {(financialMetrics.inventoryTurnoverPotential || 0).toFixed(2)}x
              </div>
              <p className="text-xs text-rose-600 dark:text-rose-400 mt-1">Revenue/Investment ratio</p>
            </div>
          </div>
          
          {/* Performance Insights */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-3">Performance Insights</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Investment Efficiency:</span>{' '}
                  {financialMetrics.totalValue > 0 ? 
                    (financialMetrics.roiPercent >= 50 ? 
                      <span className="text-green-600 dark:text-green-400">Excellent (50%+ ROI)</span> :
                      financialMetrics.roiPercent >= 25 ? 
                      <span className="text-blue-600 dark:text-blue-400">Good (25%+ ROI)</span> :
                      financialMetrics.roiPercent >= 10 ? 
                      <span className="text-yellow-600 dark:text-yellow-400">Fair (10%+ ROI)</span> :
                      <span className="text-red-600 dark:text-red-400">Poor (&lt;10% ROI)</span>
                    ) : 'No investment data'
                  }
                </p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  <span className="font-medium">Break-even Status:</span>{' '}
                  {financialMetrics.breakEvenQty === Infinity ? 
                    <span className="text-red-600 dark:text-red-400">Cannot break even with current pricing</span> :
                    financialMetrics.breakEvenQty <= (financialMetrics.totalQuantity || 0) / 2 ?
                    <span className="text-green-600 dark:text-green-400">Low risk - Early break-even</span> :
                    <span className="text-yellow-600 dark:text-yellow-400">Moderate risk - Need to sell {((financialMetrics.breakEvenQty / (financialMetrics.totalQuantity || 1)) * 100).toFixed(0)}% to break even</span>
                  }
                </p>
              </div>
              <div>
                <p className="text-gray-600 dark:text-gray-400">
                  <span className="font-medium">Inventory Value:</span>{' '}
                  {financialMetrics.totalValue >= 50000 ? 
                    <span className="text-purple-600 dark:text-purple-400">High-value inventory (₹50K+)</span> :
                    financialMetrics.totalValue >= 20000 ? 
                    <span className="text-blue-600 dark:text-blue-400">Medium-value inventory (₹20K+)</span> :
                    financialMetrics.totalValue >= 5000 ? 
                    <span className="text-green-600 dark:text-green-400">Standard inventory (₹5K+)</span> :
                    <span className="text-gray-600 dark:text-gray-400">Low-value inventory (&lt;₹5K)</span>
                  }
                </p>
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  <span className="font-medium">Stock Level:</span>{' '}
                  {lens.type === 'stock' && lens.inventoryType === 'individual' ?
                    <span className="text-blue-600 dark:text-blue-400">Individual tracking - {financialMetrics.totalQuantity} pieces across {Object.keys(lens.powerInventory || {}).length} powers</span> :
                    <span className="text-gray-600 dark:text-gray-400">Standard tracking - {financialMetrics.totalQuantity} units</span>
                  }
                </p>
              </div>
            </div>
          </div>
          
          {/* Sales Performance Section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            <div className="bg-teal-50 dark:bg-teal-900/30 p-4 rounded-lg border border-teal-200 dark:border-teal-700">
              <h3 className="text-sm font-semibold text-teal-700 dark:text-teal-300 uppercase mb-2">Units Sold (Year)</h3>
              <div className="text-2xl font-bold text-teal-700 dark:text-teal-300">{financialMetrics.totalUnitsSold}</div>
              <p className="text-sm text-teal-600 dark:text-teal-400 mt-1">Last 12 months sales</p>
            </div>
            
            <div className="bg-cyan-50 dark:bg-cyan-900/30 p-4 rounded-lg border border-cyan-200 dark:border-cyan-700">
              <h3 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 uppercase mb-2">Revenue Generated</h3>
              <div className="text-2xl font-bold text-cyan-700 dark:text-cyan-300">{formatCurrency(financialMetrics.totalRevenue)}</div>
              <p className="text-sm text-cyan-600 dark:text-cyan-400 mt-1">Last 12 months revenue</p>
            </div>
            
            <div className="bg-orange-50 dark:bg-orange-900/30 p-4 rounded-lg border border-orange-200 dark:border-orange-700">
              <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase mb-2">Avg. Selling Price</h3>
              <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">{formatCurrency(financialMetrics.averageSellingPrice)}</div>
              <p className="text-sm text-orange-600 dark:text-orange-400 mt-1">Actual average per unit</p>
            </div>
          </div>
        </div>
        
        {/* Power Inventory Card - For stock lenses and contact lenses with individual inventory */}
        {(lens.type === 'stock' || lens.type === 'contact') && lens.inventoryType === 'individual' && lens.powerInventory && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
                          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Individual Power Inventory
                {lens.type === 'stock' && lens.lensType === 'bifocal' && (
                  <span className="ml-2 text-sm font-normal text-blue-600 dark:text-blue-400">
                    (Bifocal/Progressive - Axis: {lens.axis || 0}°)
                  </span>
                )}
                {lens.type === 'contact' && (
                  <span className="ml-2 text-sm font-normal text-purple-600 dark:text-purple-400">
                    ({lens.category || 'Contact Lens'} - {lens.contactType || 'Type'}{lens.color ? ` - ${lens.color}` : ''})
                  </span>
                )}
              </h2>
            
            {/* Enhanced Power Summary */}
            {(() => {
              // Calculate comprehensive statistics from power inventory
              const powers = Object.entries(lens.powerInventory || {});
              const inStockPowers = powers.filter(([_, data]) => parseInt(data?.quantity) > 0);
              const outOfStockPowers = powers.filter(([_, data]) => parseInt(data?.quantity) === 0);
              
              // Use powerLimits if available
              const finalSphMin = lens.powerLimits?.minSph ?? null;
              const finalSphMax = lens.powerLimits?.maxSph ?? null;
              const finalCylMin = lens.powerLimits?.minCyl ?? null;
              const finalCylMax = lens.powerLimits?.maxCyl ?? null;
              
              // Calculate total quantity and statistics
              const totalQuantity = powers.reduce((sum, [_, powerData]) => {
                return sum + (parseInt(powerData?.quantity) || 0);
              }, 0);
              
              const averageQuantity = powers.length > 0 ? (totalQuantity / powers.length).toFixed(1) : 0;
              const maxQuantity = Math.max(...powers.map(([_, data]) => parseInt(data?.quantity) || 0));
              
              // Calculate stock health percentage
              const stockHealthPercentage = powers.length > 0 ? ((inStockPowers.length / powers.length) * 100).toFixed(1) : 0;
              
              return (
                <div className="space-y-4 mb-6">
                  {/* Primary Statistics */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 p-4 rounded-xl border border-blue-200 dark:border-blue-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-blue-700 dark:text-blue-300 uppercase mb-1">Total Powers</h3>
                          <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                            {powers.length}
                          </div>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Different combinations</p>
                        </div>
                        <div className="w-12 h-12 bg-blue-200 dark:bg-blue-800 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/20 p-4 rounded-xl border border-green-200 dark:border-green-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-green-700 dark:text-green-300 uppercase mb-1">Total Inventory</h3>
                          <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                            {totalQuantity}
                          </div>
                          <p className="text-xs text-green-600 dark:text-green-400 mt-1">Individual pieces</p>
                        </div>
                        <div className="w-12 h-12 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/20 p-4 rounded-xl border border-purple-200 dark:border-purple-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase mb-1">In Stock</h3>
                          <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">
                            {inStockPowers.length}
                          </div>
                          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Available powers</p>
                        </div>
                        <div className="w-12 h-12 bg-purple-200 dark:bg-purple-800 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-600 dark:text-purple-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/20 p-4 rounded-xl border border-orange-200 dark:border-orange-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-semibold text-orange-700 dark:text-orange-300 uppercase mb-1">Stock Health</h3>
                          <div className="text-2xl font-bold text-orange-700 dark:text-orange-300">
                            {stockHealthPercentage}%
                          </div>
                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">Powers available</p>
                        </div>
                        <div className="w-12 h-12 bg-orange-200 dark:bg-orange-800 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-orange-600 dark:text-orange-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Power Range Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">SPH Range</h4>
                      <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        {finalSphMin !== null && finalSphMax !== null 
                          ? `${finalSphMin >= 0 ? '+' : ''}${finalSphMin} to ${finalSphMax >= 0 ? '+' : ''}${finalSphMax}`
                          : 'N/A'}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Spherical power range</p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">CYL Range</h4>
                      <div className="text-lg font-semibold text-gray-700 dark:text-gray-300">
                        {finalCylMin !== null && finalCylMax !== null 
                          ? `${finalCylMin >= 0 ? '+' : ''}${finalCylMin} to ${finalCylMax >= 0 ? '+' : ''}${finalCylMax}`
                          : 'N/A'}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Cylindrical power range</p>
                    </div>
                    
                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Inventory Stats</h4>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Avg per power:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{averageQuantity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Max quantity:</span>
                          <span className="font-medium text-gray-900 dark:text-white">{maxQuantity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600 dark:text-gray-400">Out of stock:</span>
                          <span className="font-medium text-red-600 dark:text-red-400">{outOfStockPowers.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Stock Health Indicator */}
                  <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 dark:text-white">Stock Health Overview</h4>
                      <span className={`text-sm font-medium ${
                        stockHealthPercentage >= 90 ? 'text-green-600 dark:text-green-400' :
                        stockHealthPercentage >= 70 ? 'text-yellow-600 dark:text-yellow-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {stockHealthPercentage >= 90 ? 'Excellent' :
                         stockHealthPercentage >= 70 ? 'Good' :
                         stockHealthPercentage >= 50 ? 'Fair' : 'Needs Attention'}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-500 ${
                          stockHealthPercentage >= 90 ? 'bg-green-500' :
                          stockHealthPercentage >= 70 ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`}
                        style={{ width: `${stockHealthPercentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                      <span>{inStockPowers.length} powers available</span>
                      <span>{outOfStockPowers.length} powers out of stock</span>
                    </div>
                  </div>
                </div>
              );
            })()}
            
                            {/* Additional summary for bifocal lenses and contact lens details */}
            {lens.type === 'stock' && lens.lensType === 'bifocal' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="bg-cyan-50 dark:bg-cyan-900/30 p-4 rounded-lg border border-cyan-200 dark:border-cyan-700">
                  <h3 className="text-sm font-semibold text-cyan-700 dark:text-cyan-300 uppercase mb-2">Addition Range</h3>
                  <div className="text-xl font-bold text-cyan-700 dark:text-cyan-300">
                    {(() => {
                      // Calculate addition range from power inventory keys
                      const additionPowers = Object.keys(lens.powerInventory)
                        .map(key => {
                          const parts = key.split('_');
                          return parts.length >= 3 ? parseFloat(parts[2]) : null;
                        })
                        .filter(add => add !== null);
                      
                      if (additionPowers.length > 0) {
                        const minAdd = Math.min(...additionPowers);
                        const maxAdd = Math.max(...additionPowers);
                        return `+${minAdd} to +${maxAdd}`;
                      }
                      return 'N/A';
                    })()}
                  </div>
                  <p className="text-sm text-cyan-600 dark:text-cyan-400 mt-1">Addition power range</p>
                </div>
                
                <div className="bg-indigo-50 dark:bg-indigo-900/30 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700">
                  <h3 className="text-sm font-semibold text-indigo-700 dark:text-indigo-300 uppercase mb-2">Axis</h3>
                  <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300">
                    {lens.axis || 0}°
                  </div>
                  <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">Standard axis orientation</p>
                </div>
              </div>
            )}
            
            {/* Additional summary for contact lenses */}
            {lens.type === 'contact' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                  <h3 className="text-sm font-semibold text-purple-700 dark:text-purple-300 uppercase mb-2">Category</h3>
                  <div className="text-xl font-bold text-purple-700 dark:text-purple-300">
                    {lens.category || 'N/A'}
                  </div>
                  <p className="text-sm text-purple-600 dark:text-purple-400 mt-1">Contact lens category</p>
                </div>
                
                <div className="bg-pink-50 dark:bg-pink-900/30 p-4 rounded-lg border border-pink-200 dark:border-pink-700">
                  <h3 className="text-sm font-semibold text-pink-700 dark:text-pink-300 uppercase mb-2">Type</h3>
                  <div className="text-xl font-bold text-pink-700 dark:text-pink-300">
                    {lens.contactType || 'N/A'}
                  </div>
                  <p className="text-sm text-pink-600 dark:text-pink-400 mt-1">Contact lens type</p>
                </div>
                
                <div className="bg-rose-50 dark:bg-rose-900/30 p-4 rounded-lg border border-rose-200 dark:border-rose-700">
                  <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-300 uppercase mb-2">{lens.contactType === 'Color' ? 'Color' : 'Disposal'}</h3>
                  <div className="text-xl font-bold text-rose-700 dark:text-rose-300">
                    {lens.contactType === 'Color' ? (lens.color || 'N/A') : (lens.disposalFrequency || 'N/A')}
                  </div>
                  <p className="text-sm text-rose-600 dark:text-rose-400 mt-1">
                    {lens.contactType === 'Color' ? 'Color option' : 'Disposal frequency'}
                  </p>
                </div>
              </div>
            )}
            
            {/* Enhanced Power Search and Filter Controls */}
            {(() => {
              // Process and filter powers based on search and filters
              const allPowers = Object.entries(lens.powerInventory || {});
              
              const processedPowers = allPowers.map(([powerKey, powerData]) => {
                const parts = powerKey.split('_');
                const quantity = parseInt(powerData?.quantity) || 0;
                
                let powerInfo;
                if (parts.length >= 3) {
                  // Bifocal format: "sph_cyl_addition"
                  const [sph, cyl, addition] = parts.map(p => parseFloat(p));
                  const axisValue = powerData?.axis || lens.axis || 0;
                  powerInfo = {
                    sph,
                    cyl,
                    addition,
                    axis: axisValue,
                    type: 'bifocal',
                    displayText: `SPH: ${sph >= 0 ? '+' : ''}${sph}, CYL: ${cyl >= 0 ? '+' : ''}${cyl}, ADD: +${addition}`,
                    searchText: `sph ${sph} cyl ${cyl} add ${addition} axis ${axisValue}`,
                    sortKey: sph * 1000 + cyl * 100 + addition * 10
                  };
                } else {
                  // Single vision format: "sph_cyl"
                  const [sph, cyl] = parts.map(p => parseFloat(p));
                  const axisValue = powerData?.axis || lens.axis || 0;
                  powerInfo = {
                    sph,
                    cyl,
                    axis: axisValue,
                    type: 'single',
                    displayText: `SPH: ${sph >= 0 ? '+' : ''}${sph}, CYL: ${cyl >= 0 ? '+' : ''}${cyl}`,
                    searchText: `sph ${sph} cyl ${cyl} axis ${axisValue}`,
                    sortKey: sph * 1000 + cyl * 100
                  };
                }
                
                return {
                  key: powerKey,
                  quantity,
                  inStock: quantity > 0,
                  ...powerInfo
                };
              });

              // Apply filters
              let filteredPowers = processedPowers;
              
              // Filter by stock status
              if (searchType === 'in-stock') {
                filteredPowers = filteredPowers.filter(p => p.inStock);
              } else if (searchType === 'out-of-stock') {
                filteredPowers = filteredPowers.filter(p => !p.inStock);
              }
              
              // Apply search filter
              if (powerSearch) {
                const searchLower = powerSearch.toLowerCase();
                filteredPowers = filteredPowers.filter(power => 
                  power.displayText.toLowerCase().includes(searchLower) ||
                  power.searchText.toLowerCase().includes(searchLower) ||
                  power.sph.toString().includes(searchLower) ||
                  power.cyl.toString().includes(searchLower) ||
                  (power.addition && power.addition.toString().includes(searchLower))
                );
              }
              
              // Apply sorting
              filteredPowers.sort((a, b) => {
                if (sortBy === 'quantity') {
                  if (a.quantity !== b.quantity) return b.quantity - a.quantity;
                }
                return a.sortKey - b.sortKey;
              });

              const inStockCount = processedPowers.filter(p => p.inStock).length;
              const outOfStockCount = processedPowers.filter(p => !p.inStock).length;
              const totalQuantity = processedPowers.reduce((sum, p) => sum + p.quantity, 0);
              
              return (
                <div>
                  {/* Enhanced Search and Filter Controls */}
                  <div className="mb-6 space-y-4">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                          Power Inventory Management
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Filter and export your lens inventory data for orders and reports
                        </p>
                      </div>
                      
                      {/* Stats Summary and Export Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                        {/* Stats Summary */}
                        <div className="flex flex-wrap gap-2 text-sm">
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full">
                            {inStockCount} In Stock
                          </span>
                          <span className="px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full">
                            {outOfStockCount} Out of Stock
                          </span>
                          <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full">
                            {totalQuantity} Total Pieces
                          </span>
                        </div>
                        

                      </div>
                    </div>
                    
                    {/* Search and Filter Controls */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Search Input */}
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Search powers, SPH, CYL, ADD..."
                          value={powerSearch}
                          onChange={(e) => setPowerSearch(e.target.value)}
                          className="w-full px-3 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                        />
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg className="h-4 w-4 text-gray-400 dark:text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                        </div>
                        {powerSearch && (
                          <button
                            onClick={() => setPowerSearch('')}
                            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                      
                      {/* Filter by Stock Status */}
                      <select
                        value={searchType}
                        onChange={(e) => setSearchType(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="all">All Powers</option>
                        <option value="in-stock">In Stock Only</option>
                        <option value="out-of-stock">Out of Stock Only</option>
                      </select>
                      
                      {/* Sort Options */}
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500 dark:focus:ring-sky-400 dark:focus:border-sky-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                      >
                        <option value="power">Sort by Power</option>
                        <option value="quantity">Sort by Quantity</option>
                      </select>
                      
                      {/* View Mode */}
                      <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
                        <button
                          onClick={() => setViewMode('grid')}
                          className={`px-3 py-2 text-sm font-medium transition-colors ${
                            viewMode === 'grid' 
                              ? 'bg-sky-500 text-white' 
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          Grid
                        </button>
                        <button
                          onClick={() => setViewMode('table')}
                          className={`px-3 py-2 text-sm font-medium transition-colors border-l border-gray-300 dark:border-gray-600 ${
                            viewMode === 'table' 
                              ? 'bg-sky-500 text-white' 
                              : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                          }`}
                        >
                          Table
                        </button>
                      </div>
                    </div>
                    
                    {/* Quick Filter Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          setPowerSearch('');
                          setSearchType('all');
                          setSortBy('power');
                        }}
                        className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                      >
                        Clear All Filters
                      </button>
                      <button
                        onClick={() => setSearchType('in-stock')}
                        className="px-3 py-1 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors"
                      >
                        Show In Stock
                      </button>
                      <button
                        onClick={() => setSearchType('out-of-stock')}
                        className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                      >
                        Show Out of Stock
                      </button>
                    </div>
                  </div>
                  
                  {/* Quick Actions Toolbar */}
                  {filteredPowers.length > 0 && (
                    <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Actions:</span>
                        <button
                          onClick={() => {
                            setPowerSearch('');
                            setSearchType('in-stock');
                          }}
                          className="px-3 py-1 text-xs bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
                        >
                          Show Available Stock
                        </button>
                        <button
                          onClick={() => {
                            setPowerSearch('');
                            setSearchType('out-of-stock');
                          }}
                          className="px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                        >
                          Show Empty Stock
                        </button>
                        <button
                          onClick={() => setSortBy(sortBy === 'quantity' ? 'power' : 'quantity')}
                          className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                          Sort by {sortBy === 'quantity' ? 'Power' : 'Quantity'}
                        </button>
                        <button
                          onClick={() => setViewMode(viewMode === 'grid' ? 'table' : 'grid')}
                          className="px-3 py-1 text-xs bg-purple-500 text-white rounded-md hover:bg-purple-600 transition-colors"
                        >
                          Switch to {viewMode === 'grid' ? 'Table' : 'Grid'}
                        </button>
                        
                        {/* Export Actions */}
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-gray-300 dark:border-gray-600">
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Export:</span>
                          <button
                            onClick={() => exportToExcel(filteredPowers, lens)}
                            className="flex items-center px-3 py-1 text-xs bg-emerald-500 text-white rounded-md hover:bg-emerald-600 transition-colors"
                            title="Export filtered data to Excel"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            Excel
                          </button>
                          <button
                            onClick={() => exportToPDF(filteredPowers, lens)}
                            className="flex items-center px-3 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
                            title="Export filtered data to PDF"
                          >
                            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            PDF
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Results Summary */}
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Showing {filteredPowers.length} of {processedPowers.length} powers
                      {powerSearch && (
                        <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full text-xs">
                          Filtered by: "{powerSearch}"
                        </span>
                      )}
                    </p>
                  </div>
                  
                  {/* Power Display */}
                  {filteredPowers.length > 0 ? (
                    viewMode === 'grid' ? (
                      /* Grid View */
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredPowers.map((power) => (
                          <div 
                            key={power.key} 
                            className={`relative p-4 rounded-lg border transition-all duration-200 hover:shadow-md ${
                              power.inStock 
                                ? 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600' 
                                : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700/50'
                            }`}
                          >
                            {/* Stock Status Indicator */}
                            <div className={`absolute top-2 right-2 w-3 h-3 rounded-full ${
                              power.inStock ? 'bg-green-500' : 'bg-red-500'
                            }`}></div>
                            
                            <div className="space-y-2">
                              {/* Power Values */}
                              <div className="space-y-1">
                                <div className="font-medium text-gray-900 dark:text-white text-sm">
                                  {power.displayText}
                                </div>
                                <div className="text-xs text-gray-600 dark:text-gray-400">
                                  AXIS: {power.axis}°
                                  {power.type === 'bifocal' && (
                                    <span className="ml-2 px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full">
                                      Bifocal
                                    </span>
                                  )}
                                </div>
                              </div>
                              
                              {/* Quantity */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-gray-500 dark:text-gray-400">Quantity:</span>
                                <span className={`font-bold text-sm ${
                                  power.inStock 
                                    ? power.quantity >= 10 
                                      ? 'text-green-600 dark:text-green-400' 
                                      : power.quantity >= 5 
                                        ? 'text-yellow-600 dark:text-yellow-400' 
                                        : 'text-orange-600 dark:text-orange-400'
                                    : 'text-red-600 dark:text-red-400'
                                }`}>
                                  {power.quantity} {power.quantity === 1 ? 'piece' : 'pieces'}
                                </span>
                              </div>
                              
                              {/* Stock Level Indicator */}
                              {power.inStock && (
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                                  <div 
                                    className={`h-1.5 rounded-full transition-all duration-300 ${
                                      power.quantity >= 10 
                                        ? 'bg-green-500' 
                                        : power.quantity >= 5 
                                          ? 'bg-yellow-500' 
                                          : 'bg-orange-500'
                                    }`}
                                    style={{ width: `${Math.min(power.quantity * 10, 100)}%` }}
                                  ></div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      /* Table View */
                      <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                          <thead className="bg-gray-50 dark:bg-gray-700">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Status
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                SPH
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                CYL
                              </th>
                              {filteredPowers.some(p => p.type === 'bifocal') && (
                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                  ADD
                                </th>
                              )}
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                AXIS
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Type
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Quantity
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Stock Level
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredPowers.map((power) => (
                              <tr 
                                key={power.key} 
                                className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                                  !power.inStock ? 'bg-red-50 dark:bg-red-900/10' : ''
                                }`}
                              >
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <div className={`w-2 h-2 rounded-full mr-2 ${
                                      power.inStock ? 'bg-green-500' : 'bg-red-500'
                                    }`}></div>
                                    <span className={`text-xs font-medium ${
                                      power.inStock ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                                    }`}>
                                      {power.inStock ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                  {power.sph >= 0 ? `+${power.sph}` : power.sph}
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                  {power.cyl >= 0 ? `+${power.cyl}` : power.cyl}
                                </td>
                                {filteredPowers.some(p => p.type === 'bifocal') && (
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                    {power.type === 'bifocal' ? `+${power.addition}` : '-'}
                                  </td>
                                )}
                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                  {power.axis}°
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                                    power.type === 'bifocal' 
                                      ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                                      : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                  }`}>
                                    {power.type === 'bifocal' ? 'Bifocal' : 'Single'}
                                  </span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <div className="flex items-center">
                                    <span className={`text-sm font-bold mr-2 ${
                                      power.inStock 
                                        ? power.quantity >= 10 
                                          ? 'text-green-600 dark:text-green-400' 
                                          : power.quantity >= 5 
                                            ? 'text-yellow-600 dark:text-yellow-400' 
                                            : 'text-orange-600 dark:text-orange-400'
                                        : 'text-red-600 dark:text-red-400'
                                    }`}>
                                      {power.quantity}
                                    </span>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {power.quantity === 1 ? 'piece' : 'pieces'}
                                    </span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap">
                                  {power.inStock ? (
                                    <div className="flex items-center">
                                      <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2 mr-2">
                                        <div 
                                          className={`h-2 rounded-full transition-all duration-300 ${
                                            power.quantity >= 10 
                                              ? 'bg-green-500' 
                                              : power.quantity >= 5 
                                                ? 'bg-yellow-500' 
                                                : 'bg-orange-500'
                                          }`}
                                          style={{ width: `${Math.min(power.quantity * 10, 100)}%` }}
                                        ></div>
                                      </div>
                                      <span className={`text-xs ${
                                        power.quantity >= 10 
                                          ? 'text-green-600 dark:text-green-400' 
                                          : power.quantity >= 5 
                                            ? 'text-yellow-600 dark:text-yellow-400' 
                                            : 'text-orange-600 dark:text-orange-400'
                                      }`}>
                                        {power.quantity >= 10 ? 'High' : power.quantity >= 5 ? 'Medium' : 'Low'}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-red-600 dark:text-red-400">Empty</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : (
                    /* No Results */
                    <div className="text-center py-12">
                      <div className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500 mb-4">
                        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6 4h6m6-8a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                        No powers found
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                        {powerSearch 
                          ? `No powers match your search "${powerSearch}"` 
                          : searchType === 'in-stock' 
                            ? 'No powers are currently in stock'
                            : searchType === 'out-of-stock'
                              ? 'No powers are out of stock'
                              : 'No power inventory data available'
                        }
                      </p>
                      {powerSearch && (
                        <button
                          onClick={() => setPowerSearch('')}
                          className="text-sm text-sky-600 dark:text-sky-400 hover:text-sky-500 dark:hover:text-sky-300"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
            

          </div>
                )}
        
        {/* Sales Trends Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Sales Trends</h2>
          
          {/* Monthly Sales Chart */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4">Monthly Sales (Last 30 Days)</h3>
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
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No sales data available for this period
              </div>
            )}
          </div>
          
          {/* Quarterly Sales Chart */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4">Quarterly Sales (Last 3 Months)</h3>
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
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No sales data available for this period
              </div>
            )}
          </div>
          
          {/* Yearly Sales Chart */}
          <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4">Yearly Sales (Last 12 Months)</h3>
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
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No sales data available for this period
              </div>
            )}
          </div>
        </div>

        {/* Trend Analysis Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Trend Analysis</h2>
          
          {/* Sales Velocity Chart */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4">Sales Velocity (Units per Month)</h3>
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
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No trend data available
              </div>
            )}
          </div>
          
          {/* Profit Margin Trend */}
          <div className="mb-8">
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4">Profit Margin Trend</h3>
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
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No trend data available
              </div>
            )}
          </div>
          
          {/* Inventory Turnover Analysis */}
          <div>
            <h3 className="text-md font-semibold text-gray-700 dark:text-gray-300 mb-4">Inventory Turnover Analysis</h3>
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
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No inventory turnover data available
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Reorder Threshold Modal */}
      {showThresholdModal && (
        <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-full max-w-4xl shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Set Reorder Thresholds</h3>
                <button
                  onClick={() => setShowThresholdModal(false)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-medium">Set minimum quantity thresholds:</span> When inventory falls below these levels, 
                    the lens will appear in the reorder dashboard for restocking.
                  </p>
                </div>

                {/* General Threshold for Single/Prescription Lenses */}
                {(lens.type !== 'stock' || lens.inventoryType !== 'individual') && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      General Reorder Threshold
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="number"
                        min="0"
                        value={thresholdData.generalThreshold}
                        onChange={(e) => setThresholdData(prev => ({
                          ...prev,
                          generalThreshold: e.target.value
                        }))}
                        className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        units (Notify when inventory drops to or below this level)
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Current quantity: {lens.qty || 0} units
                    </p>
                  </div>
                )}

                {/* Individual Power Thresholds for Stock Lenses */}
                {lens.type === 'stock' && lens.inventoryType === 'individual' && lens.powerInventory && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Individual Power Thresholds
                      </label>
                      <button
                        onClick={() => {
                          const allPowers = Object.keys(lens.powerInventory);
                          const defaultThreshold = 3;
                          const newThresholds = {};
                          allPowers.forEach(powerKey => {
                            newThresholds[powerKey] = thresholdData.powerThresholds[powerKey] || defaultThreshold;
                          });
                          setThresholdData(prev => ({
                            ...prev,
                            powerThresholds: newThresholds
                          }));
                        }}
                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
                      >
                        Set All to 3
                      </button>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                        <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Power Combination
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Current Qty
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Reorder Threshold
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                          {Object.entries(lens.powerInventory).map(([powerKey, powerData]) => {
                            const currentQty = parseInt(powerData?.quantity) || 0;
                            const threshold = thresholdData.powerThresholds[powerKey] || 0;
                            const needsReorder = currentQty <= threshold;

                            // Parse power key
                            const parts = powerKey.split('_');
                            let displayText;
                            if (parts.length >= 3) {
                              const [sph, cyl, addition] = parts.map(p => parseFloat(p));
                              displayText = `SPH: ${sph >= 0 ? '+' : ''}${sph}, CYL: ${cyl >= 0 ? '+' : ''}${cyl}, ADD: +${addition}`;
                            } else {
                              const [sph, cyl] = parts.map(p => parseFloat(p));
                              displayText = `SPH: ${sph >= 0 ? '+' : ''}${sph}, CYL: ${cyl >= 0 ? '+' : ''}${cyl}`;
                            }

                            return (
                              <tr key={powerKey} className={needsReorder ? 'bg-red-50 dark:bg-red-900/20' : ''}>
                                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                                  {displayText}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                  <span className={`font-medium ${
                                    currentQty === 0 ? 'text-red-600 dark:text-red-400' :
                                    needsReorder ? 'text-yellow-600 dark:text-yellow-400' :
                                    'text-green-600 dark:text-green-400'
                                  }`}>
                                    {currentQty}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  <input
                                    type="number"
                                    min="0"
                                    value={thresholdData.powerThresholds[powerKey] || ''}
                                    onChange={(e) => handlePowerThresholdChange(powerKey, e.target.value)}
                                    className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="px-4 py-3 text-sm">
                                  {currentQty === 0 ? (
                                    <span className="px-2 py-1 text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full">
                                      Out of Stock
                                    </span>
                                  ) : needsReorder ? (
                                    <span className="px-2 py-1 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full">
                                      Needs Reorder
                                    </span>
                                  ) : (
                                    <span className="px-2 py-1 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200 rounded-full">
                                      Good Stock
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleUpdateThresholds}
                  disabled={thresholdLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {thresholdLoading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Updating...
                    </div>
                  ) : (
                    'Save Thresholds'
                  )}
                </button>
                <button
                  onClick={() => setShowThresholdModal(false)}
                  disabled={thresholdLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Inventory Deduction Modal */}
      {showDeductionModal && (
        <div className="fixed inset-0 bg-gray-600 dark:bg-gray-900 bg-opacity-50 dark:bg-opacity-70 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-gray-700 w-96 shadow-lg rounded-md bg-white dark:bg-gray-800">
            <div className="mt-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Deduce Inventory</h3>
                <button
                  onClick={resetDeductionModal}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Current Quantity Display */}
                <div className="bg-blue-50 dark:bg-blue-900/30 p-3 rounded-md border border-blue-200 dark:border-blue-700">
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    <span className="font-medium">Current Quantity in Stock:</span>{' '}
                    {lens.type === 'stock' && lens.inventoryType === 'individual' && lens.powerInventory 
                      ? `${Object.values(lens.powerInventory).reduce((sum, powerData) => sum + (parseInt(powerData?.quantity) || 0), 0)} pieces (${Object.keys(lens.powerInventory).length} powers)`
                      : `${lens.qty || 0} units`
                    }
                  </p>
                </div>

                {/* Deduction Type Selection for Stock Lenses with Individual Inventory */}
                {lens.type === 'stock' && lens.inventoryType === 'individual' && lens.powerInventory && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Deduction Type <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setDeductionType('general')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          deductionType === 'general'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                          <span className="font-medium">General Deduction</span>
                        </div>
                        <p className="text-xs opacity-75">Deduct from overall inventory quantity</p>
                      </button>
                      
                      <button
                        type="button"
                        onClick={() => setDeductionType('specific')}
                        className={`p-3 rounded-lg border text-left transition-all ${
                          deductionType === 'specific'
                            ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
                        }`}
                      >
                        <div className="flex items-center mb-1">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-medium">Select Powers</span>
                        </div>
                        <p className="text-xs opacity-75">Choose specific powers to deduct</p>
                      </button>
                    </div>
                  </div>
                )}

                {/* Power Selection for Specific Deduction */}
                {deductionType === 'specific' && lens.type === 'stock' && lens.inventoryType === 'individual' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Selected Powers ({selectedPowersForDeduction.length})
                    </label>
                    
                    {selectedPowersForDeduction.length === 0 ? (
                      <button
                        type="button"
                        onClick={openPowerSelectionForDeduction}
                        className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center text-gray-500 dark:text-gray-400 hover:border-purple-400 dark:hover:border-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
                      >
                        <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                        <span className="text-sm font-medium">Select Powers to Deduct</span>
                        <p className="text-xs mt-1">Choose specific lens powers for deduction</p>
                      </button>
                    ) : (
                      <div className="space-y-2">
                        <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-700">
                          <div className="p-3 border-b border-purple-200 dark:border-purple-700 flex justify-between items-center">
                            <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                              {selectedPowersForDeduction.length} Power{selectedPowersForDeduction.length !== 1 ? 's' : ''} Selected
                            </span>
                            <button
                              type="button"
                              onClick={openPowerSelectionForDeduction}
                              className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 font-medium"
                            >
                              Change Selection
                            </button>
                          </div>
                          <div className="p-3 max-h-32 overflow-y-auto">
                            {selectedPowersForDeduction.map((power, index) => (
                              <div key={power.powerKey} className="flex justify-between items-center text-sm py-1">
                                <span className="font-mono text-gray-700 dark:text-gray-300">{power.powerDisplay}</span>
                                <span className="text-purple-600 dark:text-purple-400 font-medium">
                                  {power.pieceQuantity} pcs
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="p-3 border-t border-purple-200 dark:border-purple-700 bg-purple-100 dark:bg-purple-900/50">
                            <div className="flex justify-between items-center text-sm font-medium text-purple-700 dark:text-purple-300">
                              <span>Total to Deduct:</span>
                              <span>{selectedPowersForDeduction.reduce((sum, p) => sum + p.pieceQuantity, 0)} pieces</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity to Deduct - Only for General Deduction */}
                {deductionType === 'general' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Quantity to Deduct <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={lens.qty || 0}
                    value={deductionData.quantity}
                    onChange={(e) => setDeductionData(prev => ({
                      ...prev,
                      quantity: e.target.value
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter quantity to deduct"
                  />
                </div>
                )}

                {/* Reason for Deduction */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Reason for Deduction <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={deductionData.reason}
                    onChange={(e) => setDeductionData(prev => ({
                      ...prev,
                      reason: e.target.value,
                      customReason: e.target.value !== 'other' ? '' : prev.customReason
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select a reason</option>
                    <option value="damaged">Damaged/Broken</option>
                    <option value="wrong_power">Wrong Power/Prescription</option>
                    <option value="quality_issue">Quality Issue/Defect</option>
                    <option value="expired">Expired/Outdated</option>
                    <option value="customer_return">Customer Return</option>
                    <option value="lost">Lost/Misplaced</option>
                    <option value="other">Other (specify below)</option>
                  </select>
                </div>

                {/* Custom Reason Input */}
                {deductionData.reason === 'other' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Specify Reason <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={deductionData.customReason}
                      onChange={(e) => setDeductionData(prev => ({
                        ...prev,
                        customReason: e.target.value
                      }))}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      placeholder="Enter custom reason"
                    />
                  </div>
                )}

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Additional Notes (Optional)
                  </label>
                  <textarea
                    value={deductionData.notes}
                    onChange={(e) => setDeductionData(prev => ({
                      ...prev,
                      notes: e.target.value
                    }))}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:focus:ring-red-400 dark:focus:border-red-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="Enter any additional details about the deduction"
                  />
                </div>

                {/* Calculation Display */}
                {(
                  (deductionType === 'general' && deductionData.quantity && parseInt(deductionData.quantity) > 0) ||
                  (deductionType === 'specific' && selectedPowersForDeduction.length > 0)
                ) && (
                  <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded-md border border-gray-200 dark:border-gray-600">
                    {deductionType === 'general' ? (
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <span className="font-medium">After deduction:</span> {(lens.qty || 0) - parseInt(deductionData.quantity)} units will remain
                    </p>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">After power-specific deduction:</p>
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex justify-between">
                            <span>Total pieces to deduct:</span>
                            <span className="font-medium">{selectedPowersForDeduction.reduce((sum, p) => sum + p.pieceQuantity, 0)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Current total inventory:</span>
                            <span className="font-medium">
                              {Object.values(lens.powerInventory || {}).reduce((sum, powerData) => sum + (parseInt(powerData?.quantity) || 0), 0)}
                            </span>
                          </div>
                          <div className="flex justify-between border-t border-gray-300 dark:border-gray-600 pt-1 mt-1">
                            <span>Remaining total pieces:</span>
                            <span className="font-medium text-green-600 dark:text-green-400">
                              {Object.values(lens.powerInventory || {}).reduce((sum, powerData) => sum + (parseInt(powerData?.quantity) || 0), 0) - selectedPowersForDeduction.reduce((sum, p) => sum + p.pieceQuantity, 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 mt-6">
                <button
                  onClick={handleInventoryDeduction}
                  disabled={deductionLoading}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {deductionLoading ? (
                    <div className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </div>
                  ) : (
                    'Confirm Deduction'
                  )}
                </button>
                <button
                  onClick={resetDeductionModal}
                  disabled={deductionLoading}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Power Selection Modal for Deduction */}
      <PowerSelectionModal 
        isOpen={showPowerSelectionForDeduction}
        onClose={() => setShowPowerSelectionForDeduction(false)}
        onSelectPower={handlePowerSelectionForDeduction}
        selectedLens={lens}
        rowIndex={0} // Not used in deduction context, but required by component
      />
    </div>
  );
};

export default LensDetail; 
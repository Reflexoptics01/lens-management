import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, doc, deleteDoc, Timestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AddLensForm from '../components/AddLensForm';
import AddStockLensForm from '../components/AddStockLensForm';
import AddContactLensForm from '../components/AddContactLensForm';
import AddServiceForm from '../components/AddServiceForm';
import RxLensTable from '../components/RxLensTable';
import StockLensTable from '../components/StockLensTable';
import ContactLensTable from '../components/ContactLensTable';
import ServiceTable from '../components/ServiceTable';
import * as XLSX from 'xlsx';

// Constants for dropdowns from OrderForm
const MATERIALS = ['CR', 'POLY', 'GLASS', 'POLARISED', 'TRIVEX', 'MR8'];

const INDEX_BY_MATERIAL = {
  'CR': ['1.50', '1.56', '1.60', '1.67', '1.74'],
  'POLARISED': ['1.50', '1.56', '1.60', '1.67', '1.74'],
  'GLASS': ['1.52', '1.70', '1.80', '1.90'],
  'TRIVEX': ['1.53'],
  'MR8': ['1.60'],
  'POLY': ['1.59']
};

const BASE_TINTS = ['WHITE', 'BLUECUT', 'PHOTOGREY (PG)', 'PHOTOGREY BLUECUT', 'OTHER'];

const COATING_TYPES = ['UC', 'HC', 'HMC', 'SHMC', 'HCT'];

const COATING_COLORS = {
  'HMC': ['GREEN', 'BLUE', 'DUAL (BLUE & GREEN)', 'MAGENTA', 'VIOLET'],
  'SHMC': ['GREEN', 'BLUE', 'DUAL (BLUE & GREEN)', 'MAGENTA', 'VIOLET']
};

const EMPTY_PRESCRIPTION_ROW = {
  brandName: '',
  eye: 'R',
  sph: '',
  cyl: '',
  axis: '',
  add: '',
  qty: 1
};

const LensInventory = () => {
  const [lenses, setLenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showStockLensForm, setShowStockLensForm] = useState(false);
  const [showContactLensForm, setShowContactLensForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [activeSection, setActiveSection] = useState('inventory'); // 'inventory', 'addLens', 'addStockLens', 'addContactLens', or 'addService'
  const [showCoatingColors, setShowCoatingColors] = useState(false);
  
  // Add states for edit functionality
  const [editMode, setEditMode] = useState(false);
  const [lensToEdit, setLensToEdit] = useState(null);
  
  // Add search state
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLenses, setFilteredLenses] = useState([]);
  
  // Add tab state - including services
  const [activeTab, setActiveTab] = useState('rx'); // 'rx', 'stock', 'contact', or 'services'
  
  // Add view mode state (table or card)
  const [viewMode, setViewMode] = useState(window.innerWidth < 768 ? 'card' : 'table');
  
  // Add services state
  const [services, setServices] = useState([]);
  const [filteredServices, setFilteredServices] = useState([]);
  
  // Add import/export states
  const [importing, setImporting] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  // Lens specifications (common for all prescriptions)
  const [lensSpecifications, setLensSpecifications] = useState({
    material: '',
    index: '',
    baseTint: '',
    coatingType: '',
    coatingColor: '',
    diameter: '',
    notes: '',
    location: 'Main Cabinet'
  });
  
  // Array of prescription rows
  const [prescriptionRows, setPrescriptionRows] = useState(
    Array(6).fill().map(() => ({...EMPTY_PRESCRIPTION_ROW}))
  );
  
  // Array of stock lens rows for batch adding
  const [stockLensRows, setStockLensRows] = useState(
    Array(10).fill().map((_, index) => ({
      id: index + 1,
      brandName: '',
      maxSph: '',
      maxCyl: '',
      purchasePrice: '',
      salePrice: '',
      qty: 1
    }))
  );
  
  // PowerInventoryModal states
  const [showPowerInventoryModal, setShowPowerInventoryModal] = useState(false);
  const [pendingStockLens, setPendingStockLens] = useState(null);
  const [currentStockLensRow, setCurrentStockLensRow] = useState(null);
  
  // Styling constants
  const inputClassName = "block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm py-1.5 px-2 text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const selectClassName = "block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm py-1.5 px-2";
  const labelClassName = "block uppercase tracking-wide text-xs font-bold text-sky-700 mb-1";
  const sectionClassName = "bg-white rounded-lg shadow-md p-6 mb-6";
  const tabClassName = "px-4 py-2 text-sm font-medium";
  const activeTabClassName = "bg-indigo-600 text-white rounded-lg shadow-sm";
  const inactiveTabClassName = "text-gray-700 hover:bg-gray-100 rounded-lg";
  
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchLensInventory();
  }, []);
  
  // Add window resize listener to switch view modes based on screen size
  useEffect(() => {
    const handleResize = () => {
      // Switch to card view on small screens
      if (window.innerWidth < 768 && viewMode === 'table') {
        setViewMode('card');
      }
    };
    
    window.addEventListener('resize', handleResize);
    
    // Cleanup function
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [viewMode]);
  
  useEffect(() => {
    // Filter lenses based on search term and active tab
    let filtered = lenses;
    
    // Apply tab filter
    if (activeTab === 'rx') {
      filtered = filtered.filter(lens => lens.type === 'prescription');
    } else if (activeTab === 'stock') {
      filtered = filtered.filter(lens => lens.type === 'stock');
    } else if (activeTab === 'contact') {
      filtered = filtered.filter(lens => lens.type === 'contact');
    } else if (activeTab === 'services') {
      filtered = filtered.filter(lens => lens.type === 'service');
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const lowercaseSearch = searchTerm.toLowerCase();
      filtered = filtered.filter(lens => 
        (lens.brandName && lens.brandName.toLowerCase().includes(lowercaseSearch)) ||
        (lens.maxSph && lens.maxSph.toString().includes(lowercaseSearch)) ||
        (lens.maxCyl && lens.maxCyl.toString().includes(lowercaseSearch)) ||
        (lens.powerSeries && lens.powerSeries.toLowerCase().includes(lowercaseSearch)) ||
        (lens.sph && lens.sph.toString().includes(lowercaseSearch)) ||
        (lens.cyl && lens.cyl.toString().includes(lowercaseSearch)) ||
        (lens.material && lens.material.toLowerCase().includes(lowercaseSearch)) ||
        (lens.index && lens.index.toString().includes(lowercaseSearch)) ||
        (lens.type && lens.type.toLowerCase().includes(lowercaseSearch)) ||
        (lens.category && lens.category.toLowerCase().includes(lowercaseSearch)) ||
        (lens.contactType && lens.contactType.toLowerCase().includes(lowercaseSearch)) ||
        (lens.color && lens.color.toLowerCase().includes(lowercaseSearch))
      );
    }
    
    setFilteredLenses(filtered);
  }, [searchTerm, lenses, activeTab]);
  
  useEffect(() => {
    // Show coating colors dropdown only for certain coating types
    if (lensSpecifications.coatingType === 'HMC' || lensSpecifications.coatingType === 'SHMC') {
      setShowCoatingColors(true);
    } else {
      setShowCoatingColors(false);
      setLensSpecifications(prev => ({
        ...prev,
        coatingColor: ''
      }));
    }
  }, [lensSpecifications.coatingType]);
  
  const handleStockLensChange = (index, field, value) => {
    const updatedRows = [...stockLensRows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };
    setStockLensRows(updatedRows);
  };
  
  const addStockLensRow = () => {
    setStockLensRows([
      ...stockLensRows, 
      {
        id: stockLensRows.length + 1,
        brandName: '',
        maxSph: '',
        maxCyl: '',
        purchasePrice: '',
        salePrice: '',
        qty: 1
      }
    ]);
  };
  
  const removeStockLensRow = (index) => {
    if (stockLensRows.length <= 1) return;
    const updatedRows = stockLensRows.filter((_, i) => i !== index);
    // Reassign IDs to maintain sequence
    const reindexedRows = updatedRows.map((row, i) => ({
      ...row,
      id: i + 1
    }));
    setStockLensRows(reindexedRows);
  };
  
  const handleStockLensSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      // Filter out empty rows (no brand name)
      const validRows = stockLensRows.filter(row => row.brandName && row.brandName.trim() !== '');
      
      if (validRows.length === 0) {
        setError('Please add at least one stock lens detail.');
        setLoading(false);
        return;
      }
      
      if (editMode && lensToEdit) {
        // Edit existing stock lens - only the first row is used
        const row = validRows[0];
        
        // Check if it's a power range stock lens (has maxSph and maxCyl values)
        const isPowerRangeLens = row.maxSph && row.maxCyl;
        
        if (isPowerRangeLens) {
          // Show PowerInventoryModal for power range lens
          const maxSphNum = parseFloat(row.maxSph);
          const maxCylNum = parseFloat(row.maxCyl);
          
          // Calculate power ranges
          const sphMin = maxSphNum < 0 ? maxSphNum : 0;
          const sphMax = maxSphNum < 0 ? 0 : maxSphNum;
          const cylMin = maxCylNum < 0 ? maxCylNum : 0;
          const cylMax = maxCylNum < 0 ? 0 : maxCylNum;
          
          const powerRange = `SPH: ${sphMin} to ${sphMax}, CYL: ${cylMin} to ${cylMax}`;
          
          const lensData = {
            name: row.brandName,
            powerRange: powerRange,
            maxSph: row.maxSph,
            maxCyl: row.maxCyl,
            sphMin,
            sphMax,
            cylMin,
            cylMax,
            purchasePrice: row.purchasePrice,
            salePrice: row.salePrice,
            type: 'single',
            material: '', // Could be added to stock lens form later
            editMode: true,
            editId: lensToEdit.id
          };
          
          setPendingStockLens(lensData);
          setCurrentStockLensRow(row);
          setShowPowerInventoryModal(true);
          setLoading(false);
          return;
        }
        
        // Regular stock lens update
        const lensData = {
          brandName: row.brandName,
          maxSph: row.maxSph,
          maxCyl: row.maxCyl,
          purchasePrice: row.purchasePrice,
          salePrice: row.salePrice,
          qty: parseFloat(row.qty) || 1,
          type: 'stock',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(getUserDoc('lensInventory', lensToEdit.id), lensData);
        console.log("Updated stock lens:", lensData);
        
        // Reset edit mode
        resetForms();
      } else {
        // Add new stock lenses
        // Process each valid stock lens row
        for (const row of validRows) {
          // Check if it's a power range stock lens (has maxSph and maxCyl values)
          const isPowerRangeLens = row.maxSph && row.maxCyl;
          
          if (isPowerRangeLens) {
            // Show PowerInventoryModal for power range lens
            const maxSphNum = parseFloat(row.maxSph);
            const maxCylNum = parseFloat(row.maxCyl);
            
            // Calculate power ranges
            const sphMin = maxSphNum < 0 ? maxSphNum : 0;
            const sphMax = maxSphNum < 0 ? 0 : maxSphNum;
            const cylMin = maxCylNum < 0 ? maxCylNum : 0;
            const cylMax = maxCylNum < 0 ? 0 : maxCylNum;
            
            const powerRange = `SPH: ${sphMin} to ${sphMax}, CYL: ${cylMin} to ${cylMax}`;
            
            const lensData = {
              name: row.brandName,
              powerRange: powerRange,
              maxSph: row.maxSph,
              maxCyl: row.maxCyl,
              sphMin,
              sphMax,
              cylMin,
              cylMax,
              purchasePrice: row.purchasePrice,
              salePrice: row.salePrice,
              type: 'single',
              material: '', // Could be added to stock lens form later
              editMode: false
            };
            
            setPendingStockLens(lensData);
            setCurrentStockLensRow(row);
            setShowPowerInventoryModal(true);
            setLoading(false);
            return; // Show modal for the first power range lens
          } else {
            // Regular stock lens - add directly
            const lensData = {
              brandName: row.brandName,
              maxSph: row.maxSph,
              maxCyl: row.maxCyl,
              purchasePrice: row.purchasePrice,
              salePrice: row.salePrice,
              qty: parseFloat(row.qty) || 1,
              type: 'stock',
              createdAt: Timestamp.now()
            };
            
            await addDoc(getUserCollection('lensInventory'), lensData);
          }
        }
        
        // Reset form if no power range lenses were found
        setStockLensRows(Array(10).fill().map((_, index) => ({
          id: index + 1,
          brandName: '',
          maxSph: '',
          maxCyl: '',
          purchasePrice: '',
          salePrice: '',
          qty: 1
        })));
        
        // Hide the form
        setShowStockLensForm(false);
      }
      
      // Fetch updated inventory after successful submission
      await fetchLensInventory();
      
    } catch (error) {
      console.error('Error adding/updating stock lenses to inventory:', error);
      setError(`Failed to process stock lenses: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchLensInventory = async () => {
    try {
      setLoading(true);
      setError('');
      
      const lensRef = getUserCollection('lensInventory');
      const snapshot = await getDocs(lensRef);
      
      const lensesList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      
      console.log("Fetched lenses:", lensesList); // Debug log
      setLenses(lensesList);
      setFilteredLenses(lensesList); // Initialize filtered lenses with all lenses    
    } catch (error) {
      console.error('Error fetching lens inventory:', error);
      setError('Failed to fetch lens inventory');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSpecificationChange = (e) => {
    const { name, value } = e.target;
    setLensSpecifications(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleMaterialChange = (e) => {
    const material = e.target.value;
    
    // Update the material field and reset index
    setLensSpecifications(prev => ({
      ...prev,
      material,
      index: ''
    }));
  };
  
  const handlePrescriptionChange = (index, field, value) => {
    const updatedRows = [...prescriptionRows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };
    setPrescriptionRows(updatedRows);
  };
  
  const addPrescriptionRow = () => {
    setPrescriptionRows([...prescriptionRows, {...EMPTY_PRESCRIPTION_ROW}]);
  };
  
  const removePrescriptionRow = (index) => {
    if (prescriptionRows.length <= 1) return;
    const updatedRows = prescriptionRows.filter((_, i) => i !== index);
    setPrescriptionRows(updatedRows);
  };
  
  const formatNumericValue = (value, type) => {
    if (value === '' || value === '-') return value;
    
    const numValue = type === 'axis' ? parseInt(value) : parseFloat(value);
    if (isNaN(numValue)) return value;
    
    return type === 'axis' ? numValue.toString() : numValue.toFixed(2);
  };
  
  const handlePrescriptionBlur = (index, field, value) => {
    if (field === 'sph' || field === 'cyl' || field === 'add') {
      const formattedValue = formatNumericValue(value, field);
      handlePrescriptionChange(index, field, formattedValue);
    } else if (field === 'axis') {
      const formattedValue = formatNumericValue(value, 'axis');
      handlePrescriptionChange(index, field, formattedValue);
    }
  };
  
  const handleFormSubmit = (addedLenses) => {
    // Reset form and states
    resetForms();
    
    // Fetch updated inventory
    fetchLensInventory();
  };
  
  const removeLens = async (id) => {
    if (window.confirm('Are you sure you want to remove this lens from inventory?')) {
      try {
        setLoading(true);
        await deleteDoc(getUserDoc('lensInventory', id));
        fetchLensInventory();
      } catch (error) {
        console.error('Error removing lens:', error);
        setError('Failed to remove lens');
      } finally {
        setLoading(false);
      }
    }
  };
  
  const handleEditLens = (lens) => {
    setLensToEdit(lens);
    
    // Set form visibility based on lens type
    if (lens.type === 'stock') {
      setEditMode(true);
      setShowStockLensForm(true);
      setShowAddForm(false);
      setShowContactLensForm(false);
      setShowServiceForm(false);
      setActiveSection('addStockLens');
    } else if (lens.type === 'contact') {
      setEditMode(true);
      setShowContactLensForm(true);
      setShowAddForm(false);
      setShowStockLensForm(false);
      setShowServiceForm(false);
      setActiveSection('addContactLens');
    } else if (lens.type === 'service') {
      setEditMode(true);
      setShowServiceForm(true);
      setShowAddForm(false);
      setShowStockLensForm(false);
      setShowContactLensForm(false);
      setActiveSection('addService');
    } else {
      // For prescription lenses
      setEditMode(true);
      setShowAddForm(true);
      setShowStockLensForm(false);
      setShowContactLensForm(false);
      setShowServiceForm(false);
      setActiveSection('addLens');
    }
  };
  
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      if (!lensToEdit || !lensToEdit.id) {
        setError('No lens selected for editing');
        return;
      }
      
      if (lensToEdit.type === 'stock') {
        // Update stock lens
        const validRows = stockLensRows.filter(row => row.brandName && row.brandName.trim() !== '');
        
        if (validRows.length === 0) {
          setError('Please add stock lens details');
          setLoading(false);
          return;
        }
        
        // Use the first row since we're editing just one lens
        const row = validRows[0];
        const lensData = {
          brandName: row.brandName,
          maxSph: row.maxSph,
          maxCyl: row.maxCyl,
          purchasePrice: row.purchasePrice,
          salePrice: row.salePrice,
          qty: parseFloat(row.qty) || 1,
          type: 'stock',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(getUserDoc('lensInventory', lensToEdit.id), lensData);
      } else if (lensToEdit.type === 'service') {
        // Update service
        const lensData = {
          ...lensSpecifications,
          type: 'service',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(getUserDoc('lensInventory', lensToEdit.id), lensData);
      } else {
        // Update prescription lens
        const validRows = prescriptionRows.filter(row => row.sph && row.sph.trim() !== '');
        
        if (validRows.length === 0) {
          setError('Please add at least one prescription detail.');
          setLoading(false);
          return;
        }
        
        // Use the first row since we're editing just one lens
        const row = validRows[0];
        const lensData = {
          ...lensSpecifications,
          eye: row.eye === 'RL' ? 'both' : row.eye.toLowerCase(),
          sph: row.sph,
          cyl: row.cyl || '',
          axis: row.axis || '',
          add: row.add || '',
          qty: row.qty || 1,
          brandName: row.brandName || '',
          type: 'prescription',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(getUserDoc('lensInventory', lensToEdit.id), lensData);
      }
      
      // Reset form and states
      resetForms();
      
      // Fetch updated inventory
      await fetchLensInventory();
      
    } catch (error) {
      console.error('Error updating lens:', error);
      setError(`Failed to update lens: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const resetForms = () => {
    // Reset all forms and edit states
    setEditMode(false);
    setLensToEdit(null);
    setShowAddForm(false);
    setShowStockLensForm(false);
    setShowContactLensForm(false);
    setShowServiceForm(false);
    setActiveSection('inventory');
    
    // Reset prescription form
    setLensSpecifications({
      material: '',
      index: '',
      baseTint: '',
      coatingType: '',
      coatingColor: '',
      diameter: '',
      notes: '',
      location: 'Main Cabinet'
    });
    
    setPrescriptionRows(Array(6).fill().map(() => ({...EMPTY_PRESCRIPTION_ROW})));
    
    // Reset stock lens form
    setStockLensRows(Array(10).fill().map((_, index) => ({
      id: index + 1,
      brandName: '',
      maxSph: '',
      maxCyl: '',
      purchasePrice: '',
      salePrice: '',
      qty: 1
    })));
  };
  
  const cancelEdit = () => {
    resetForms();
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
    const totalQty = lenses.reduce((sum, lens) => sum + (parseFloat(lens.qty) || 0), 0);
    const totalValue = lenses.reduce((sum, lens) => {
      const qty = parseFloat(lens.qty) || 0;
      const price = parseFloat(lens.purchasePrice) || 0;
      return sum + (qty * price);
    }, 0);
    const potentialSaleValue = lenses.reduce((sum, lens) => {
      const qty = parseFloat(lens.qty) || 0;
      const price = parseFloat(lens.salePrice) || 0;
      return sum + (qty * price);
    }, 0);
    const potentialProfit = potentialSaleValue - totalValue;
    const profitMargin = totalValue > 0 ? (potentialProfit / totalValue) * 100 : 0;
    
    // Categorize by lens type
    const stockLenses = lenses.filter(lens => lens.type === 'stock');
    const prescriptionLenses = lenses.filter(lens => lens.type === 'prescription');
    const serviceLenses = lenses.filter(lens => lens.type === 'service');
    
    const stockQty = stockLenses.reduce((sum, lens) => sum + (parseFloat(lens.qty) || 0), 0);
    const prescriptionQty = prescriptionLenses.reduce((sum, lens) => sum + (parseFloat(lens.qty) || 0), 0);
    const serviceQty = serviceLenses.reduce((sum, lens) => sum + (parseFloat(lens.qty) || 0), 0);
    
    const stockValue = stockLenses.reduce((sum, lens) => {
      const qty = parseFloat(lens.qty) || 0;
      const price = parseFloat(lens.purchasePrice) || 0;
      return sum + (qty * price);
    }, 0);
    
    const prescriptionValue = prescriptionLenses.reduce((sum, lens) => {
      const qty = parseFloat(lens.qty) || 0;
      const price = parseFloat(lens.purchasePrice) || 0;
      return sum + (qty * price);
    }, 0);
    
    const serviceValue = serviceLenses.reduce((sum, lens) => {
      const qty = parseFloat(lens.qty) || 0;
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
      
      brandGroups[brand].qty += parseFloat(lens.qty) || 0;
      brandGroups[brand].value += (parseFloat(lens.qty) || 0) * (parseFloat(lens.purchasePrice) || 0);
    });
    
    // Sort brands by value
    const sortedBrands = Object.entries(brandGroups)
      .sort((a, b) => b[1].value - a[1].value)
      .map(([name, data]) => ({
        name,
        qty: data.qty,
        value: data.value
      }));
    
    return {
      totalQty,
      totalValue,
      potentialSaleValue,
      potentialProfit,
      profitMargin,
      stockQty,
      prescriptionQty,
      serviceQty,
      stockValue,
      prescriptionValue,
      serviceValue,
      topBrands: sortedBrands.slice(0, 5)
    };
  };
  
  // Add a function to render mobile card view for lenses
  const renderMobileCardView = () => {
    if (loading) {
      return (
        <div className="flex justify-center items-center py-6">
          <svg className="animate-spin h-6 w-6 text-sky-600 dark:border-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading inventory...</span>
        </div>
      );
    }

    if (filteredLenses.length === 0) {
      return (
        <div className="border-l-4 border-yellow-400 p-3 sm:p-4 mb-4 rounded-r text-sm bg-yellow-50 dark:bg-yellow-900/50">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-200">
                {searchTerm ? 'No lenses match your search criteria.' : 'No lenses in inventory yet. Add your first lens to get started!'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-1 gap-3">
        {filteredLenses.map((lens, index) => (
          <div key={lens.id} className={`p-3 rounded-lg border shadow-sm ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'} border-gray-200 dark:border-gray-600`}>
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium text-sky-600 text-left">
                {lens.brandName || 'N/A'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400 text-right">
                Qty: {parseFloat(lens.qty) || 1} pairs
              </div>
            </div>

            {/* RX lens details */}
            {activeTab === 'rx' && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Eye:</span>{' '}
                  <span className="text-gray-900 dark:text-white">
                    {lens.eye === 'right' ? 'Right' : lens.eye === 'left' ? 'Left' : lens.eye === 'both' ? 'Both' : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">SPH:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.sph || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">CYL:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.cyl || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">AXIS:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.axis || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">ADD:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.add || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Material:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.material || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Index:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.index || 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Stock lens details */}
            {activeTab === 'stock' && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Max SPH:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.maxSph || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Max CYL:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.maxCyl || 'N/A'}</span>
                </div>
                {lens.powerSeries && (
                  <div className="col-span-2">
                    <span className="font-medium text-gray-500 dark:text-gray-400">Power Range:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{lens.powerSeries}</span>
                  </div>
                )}
              </div>
            )}

            {/* Contact lens details */}
            {activeTab === 'contact' && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Power Series:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.powerSeries || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Category:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.category || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Type:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.contactType || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Color:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.color || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Disposal:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.disposalFrequency || 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Service details */}
            {activeTab === 'services' && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Service Type:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.serviceType || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Service Description:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{lens.serviceDescription || 'N/A'}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center text-xs">
              <div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Purchase:</span>{' '}
                  <span className="text-gray-900 dark:text-white text-left">
                    {lens.purchasePrice ? `₹${parseFloat(lens.purchasePrice).toFixed(2)}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-gray-500 dark:text-gray-400">Sale:</span>{' '}
                  <span className="text-gray-900 dark:text-white text-left">
                    {lens.salePrice ? `₹${parseFloat(lens.salePrice).toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditLens(lens)}
                  className="text-sky-600 hover:text-sky-900 bg-sky-50 dark:bg-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900/70 px-2 py-1 rounded text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeLens(lens.id)}
                  className="text-red-600 hover:text-red-900 bg-red-50 dark:bg-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/70 px-2 py-1 rounded text-xs"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // PowerInventoryModal handlers
  const handlePowerInventoryModalSave = async (inventoryData) => {
    try {
      setLoading(true);
      setError('');
      
      if (inventoryData.type === 'range') {
        // Save as power range (existing functionality)
        const lensData = {
          brandName: pendingStockLens.name,
          maxSph: pendingStockLens.maxSph,
          maxCyl: pendingStockLens.maxCyl,
          powerSeries: pendingStockLens.powerRange,
          purchasePrice: pendingStockLens.purchasePrice,
          salePrice: pendingStockLens.salePrice,
          qty: parseFloat(currentStockLensRow.qty) || 1,
          type: 'stock',
          createdAt: Timestamp.now()
        };
        
        if (pendingStockLens.editMode) {
          lensData.updatedAt = Timestamp.now();
          delete lensData.createdAt;
          await updateDoc(getUserDoc('lensInventory', pendingStockLens.editId), lensData);
        } else {
          await addDoc(getUserCollection('lensInventory'), lensData);
        }
      } else {
        // Save individual power inventory
        const baseData = {
          brandName: pendingStockLens.name,
          maxSph: pendingStockLens.maxSph,
          maxCyl: pendingStockLens.maxCyl,
          powerRange: pendingStockLens.powerRange,
          purchasePrice: pendingStockLens.purchasePrice,
          salePrice: pendingStockLens.salePrice,
          type: 'stock',
          inventoryType: 'individual',
          powerLimits: inventoryData.data.powerLimits,
          totalQuantity: inventoryData.data.totalQuantity
        };
        
        if (pendingStockLens.editMode) {
          baseData.updatedAt = Timestamp.now();
          await updateDoc(getUserDoc('lensInventory', pendingStockLens.editId), {
            ...baseData,
            powerInventory: inventoryData.data.powerInventory
          });
        } else {
          // Save the main stock lens entry with power inventory
          baseData.createdAt = Timestamp.now();
          baseData.powerInventory = inventoryData.data.powerInventory;
          await addDoc(getUserCollection('lensInventory'), baseData);
        }
      }
      
      // Close modal and reset states
      setShowPowerInventoryModal(false);
      setPendingStockLens(null);
      setCurrentStockLensRow(null);
      
      // Reset forms
      if (!pendingStockLens.editMode) {
        setStockLensRows(Array(10).fill().map((_, index) => ({
          id: index + 1,
          brandName: '',
          maxSph: '',
          maxCyl: '',
          purchasePrice: '',
          salePrice: '',
          qty: 1
        })));
        setShowStockLensForm(false);
      } else {
        resetForms();
      }
      
      // Refresh inventory
      await fetchLensInventory();
      
    } catch (error) {
      console.error('Error saving power inventory:', error);
      setError(`Failed to save power inventory: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePowerInventoryModalClose = () => {
    setShowPowerInventoryModal(false);
    setPendingStockLens(null);
    setCurrentStockLensRow(null);
    setLoading(false);
  };

  // Export functionality
  const exportToExcel = (type) => {
    try {
      setExportLoading(true);
      
      let dataToExport = [];
      let filename = '';
      
      // Filter data based on type
      const filteredData = lenses.filter(lens => {
        if (type === 'all') return true;
        return lens.type === type;
      });
      
      if (filteredData.length === 0) {
        setError(`No ${type} lenses found to export.`);
        setExportLoading(false);
        return;
      }
      
      // Format data based on lens type
      switch (type) {
        case 'prescription':
        case 'rx':
          dataToExport = filteredData.map(lens => ({
            'Brand Name': lens.brandName || '',
            'Eye': lens.eye === 'right' ? 'Right' : lens.eye === 'left' ? 'Left' : lens.eye === 'both' ? 'Both' : '',
            'SPH': lens.sph || '',
            'CYL': lens.cyl || '',
            'AXIS': lens.axis || '',
            'ADD': lens.add || '',
            'Material': lens.material || '',
            'Index': lens.index || '',
            'Base Tint': lens.baseTint || '',
            'Coating Type': lens.coatingType || '',
            'Coating Color': lens.coatingColor || '',
            'Diameter': lens.diameter || '',
            'Location': lens.location || '',
            'Purchase Price': lens.purchasePrice || '',
            'Sale Price': lens.salePrice || '',
            'Quantity': lens.qty || 1,
            'Notes': lens.notes || '',
            'Created Date': lens.createdAt ? new Date(lens.createdAt.seconds * 1000).toLocaleDateString() : '',
            'Updated Date': lens.updatedAt ? new Date(lens.updatedAt.seconds * 1000).toLocaleDateString() : ''
          }));
          filename = 'rx_lenses_inventory.xlsx';
          break;
          
        case 'stock':
          dataToExport = filteredData.map(lens => ({
            'Brand Name': lens.brandName || '',
            'Power Series': lens.powerSeries || '',
            'Power Range': lens.powerRange || '',
            'Inventory Type': lens.inventoryType || 'range',
            'Purchase Price': lens.purchasePrice || '',
            'Sale Price': lens.salePrice || '',
            'Quantity': lens.inventoryType === 'individual' ? lens.totalQuantity : lens.qty || 1,
            'Unit': lens.inventoryType === 'individual' ? 'pieces' : 'pairs',
            'Created Date': lens.createdAt ? new Date(lens.createdAt.seconds * 1000).toLocaleDateString() : '',
            'Updated Date': lens.updatedAt ? new Date(lens.updatedAt.seconds * 1000).toLocaleDateString() : ''
          }));
          filename = 'stock_lenses_inventory.xlsx';
          break;
          
        case 'contact':
          dataToExport = filteredData.map(lens => ({
            'Brand Name': lens.brandName || '',
            'Power Series': lens.powerSeries || '',
            'Category': lens.category || '',
            'Contact Type': lens.contactType || '',
            'Color': lens.color || '',
            'Disposal Frequency': lens.disposalFrequency || '',
            'Purchase Price': lens.purchasePrice || '',
            'Sale Price': lens.salePrice || '',
            'Quantity': lens.qty || 1,
            'Created Date': lens.createdAt ? new Date(lens.createdAt.seconds * 1000).toLocaleDateString() : '',
            'Updated Date': lens.updatedAt ? new Date(lens.updatedAt.seconds * 1000).toLocaleDateString() : ''
          }));
          filename = 'contact_lenses_inventory.xlsx';
          break;
          
        case 'service':
          dataToExport = filteredData.map(lens => ({
            'Brand Name': lens.brandName || '',
            'Service Type': lens.serviceType || '',
            'Service Description': lens.serviceDescription || '',
            'Category': lens.category || '',
            'Purchase Price': lens.purchasePrice || '',
            'Sale Price': lens.salePrice || '',
            'Quantity': lens.qty || 1,
            'Notes': lens.notes || '',
            'Created Date': lens.createdAt ? new Date(lens.createdAt.seconds * 1000).toLocaleDateString() : '',
            'Updated Date': lens.updatedAt ? new Date(lens.updatedAt.seconds * 1000).toLocaleDateString() : ''
          }));
          filename = 'services_inventory.xlsx';
          break;
          
        case 'all':
          dataToExport = filteredData.map(lens => ({
            'Type': lens.type || '',
            'Brand Name': lens.brandName || '',
            'Eye': lens.eye === 'right' ? 'Right' : lens.eye === 'left' ? 'Left' : lens.eye === 'both' ? 'Both' : '',
            'SPH': lens.sph || '',
            'CYL': lens.cyl || '',
            'AXIS': lens.axis || '',
            'ADD': lens.add || '',
            'Power Series': lens.powerSeries || '',
            'Material': lens.material || '',
            'Index': lens.index || '',
            'Category': lens.category || '',
            'Contact Type': lens.contactType || '',
            'Color': lens.color || '',
            'Service Type': lens.serviceType || '',
            'Service Description': lens.serviceDescription || '',
            'Purchase Price': lens.purchasePrice || '',
            'Sale Price': lens.salePrice || '',
            'Quantity': lens.qty || 1,
            'Created Date': lens.createdAt ? new Date(lens.createdAt.seconds * 1000).toLocaleDateString() : '',
            'Updated Date': lens.updatedAt ? new Date(lens.updatedAt.seconds * 1000).toLocaleDateString() : ''
          }));
          filename = 'all_lenses_inventory.xlsx';
          break;
          
        default:
          setError('Invalid export type selected.');
          setExportLoading(false);
          return;
      }
      
      // Create workbook and worksheet
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      
      // Auto-size columns
      const colWidths = [];
      if (dataToExport.length > 0) {
        Object.keys(dataToExport[0]).forEach((key, index) => {
          const maxLength = Math.max(
            key.length,
            ...dataToExport.map(row => String(row[key] || '').length)
          );
          colWidths[index] = { width: Math.min(maxLength + 2, 30) };
        });
      }
      worksheet['!cols'] = colWidths;
      
      // Add worksheet to workbook
      const sheetName = type === 'all' ? 'All Inventory' : 
                      type === 'prescription' || type === 'rx' ? 'RX Lenses' :
                      type === 'stock' ? 'Stock Lenses' :
                      type === 'contact' ? 'Contact Lenses' :
                      type === 'service' ? 'Services' : 'Inventory';
      
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
      
      // Download file
      XLSX.writeFile(workbook, filename);
      
      console.log(`Exported ${dataToExport.length} records to ${filename}`);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setError(`Failed to export: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };
  
  // Import functionality
  const importFromExcel = async (file, type) => {
    try {
      setImporting(true);
      setError('');
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        setError('The Excel file is empty or has no valid data.');
        setImporting(false);
        return;
      }
      
      let importedCount = 0;
      let errors = [];
      
      // Process each row based on lens type
      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        try {
          let lensData = {};
          
          switch (type) {
            case 'prescription':
            case 'rx':
              lensData = {
                type: 'prescription',
                brandName: row['Brand Name'] || '',
                eye: row['Eye'] === 'Right' ? 'right' : row['Eye'] === 'Left' ? 'left' : row['Eye'] === 'Both' ? 'both' : 'right',
                sph: row['SPH'] || '',
                cyl: row['CYL'] || '',
                axis: row['AXIS'] || '',
                add: row['ADD'] || '',
                material: row['Material'] || '',
                index: row['Index'] || '',
                baseTint: row['Base Tint'] || '',
                coatingType: row['Coating Type'] || '',
                coatingColor: row['Coating Color'] || '',
                diameter: row['Diameter'] || '',
                location: row['Location'] || 'Main Cabinet',
                purchasePrice: parseFloat(row['Purchase Price']) || 0,
                salePrice: parseFloat(row['Sale Price']) || 0,
                qty: parseInt(row['Quantity']) || 1,
                notes: row['Notes'] || '',
                createdAt: Timestamp.now()
              };
              break;
              
            case 'stock':
              lensData = {
                type: 'stock',
                brandName: row['Brand Name'] || '',
                powerSeries: row['Power Series'] || '',
                powerRange: row['Power Range'] || '',
                inventoryType: row['Inventory Type'] || 'range',
                purchasePrice: parseFloat(row['Purchase Price']) || 0,
                salePrice: parseFloat(row['Sale Price']) || 0,
                qty: parseInt(row['Quantity']) || 1,
                createdAt: Timestamp.now()
              };
              
              if (lensData.inventoryType === 'individual') {
                lensData.totalQuantity = parseInt(row['Quantity']) || 1;
              }
              break;
              
            case 'contact':
              lensData = {
                type: 'contact',
                brandName: row['Brand Name'] || '',
                powerSeries: row['Power Series'] || '',
                category: row['Category'] || '',
                contactType: row['Contact Type'] || '',
                color: row['Color'] || '',
                disposalFrequency: row['Disposal Frequency'] || '',
                purchasePrice: parseFloat(row['Purchase Price']) || 0,
                salePrice: parseFloat(row['Sale Price']) || 0,
                qty: parseInt(row['Quantity']) || 1,
                createdAt: Timestamp.now()
              };
              break;
              
            case 'service':
              lensData = {
                type: 'service',
                brandName: row['Brand Name'] || '',
                serviceType: row['Service Type'] || '',
                serviceDescription: row['Service Description'] || '',
                category: row['Category'] || '',
                purchasePrice: parseFloat(row['Purchase Price']) || 0,
                salePrice: parseFloat(row['Sale Price']) || 0,
                qty: parseInt(row['Quantity']) || 1,
                notes: row['Notes'] || '',
                createdAt: Timestamp.now()
              };
              break;
              
            default:
              throw new Error('Invalid import type');
          }
          
          // Validate required fields
          if (!lensData.brandName || lensData.brandName.trim() === '') {
            errors.push(`Row ${i + 2}: Brand Name is required`);
            continue;
          }
          
          // Add to database
          await addDoc(getUserCollection('lensInventory'), lensData);
          importedCount++;
          
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error.message}`);
        }
      }
      
      // Show results
      if (importedCount > 0) {
        console.log(`Successfully imported ${importedCount} records`);
        await fetchLensInventory(); // Refresh the inventory
      }
      
      if (errors.length > 0) {
        setError(`Import completed with errors:\n${errors.slice(0, 5).join('\n')}${errors.length > 5 ? `\n... and ${errors.length - 5} more errors` : ''}`);
      } else if (importedCount === 0) {
        setError('No valid records found to import.');
      }
      
    } catch (error) {
      console.error('Error importing from Excel:', error);
      setError(`Failed to import: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };
  
  // Handle file upload for import
  const handleFileUpload = (event, type) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && 
          file.type !== 'application/vnd.ms-excel') {
        setError('Please select a valid Excel file (.xlsx or .xls)');
        return;
      }
      
      importFromExcel(file, type);
    }
    // Reset the input
    event.target.value = '';
  };
  
  // Generate Excel template for each lens type
  const downloadTemplate = (type) => {
    let templateData = [];
    let filename = '';
    
    switch (type) {
      case 'prescription':
      case 'rx':
        templateData = [{
          'Brand Name': 'Example Brand',
          'Eye': 'Right',
          'SPH': '-2.00',
          'CYL': '-0.50',
          'AXIS': '180',
          'ADD': '+2.00',
          'Material': 'CR',
          'Index': '1.56',
          'Base Tint': 'WHITE',
          'Coating Type': 'HMC',
          'Coating Color': 'GREEN',
          'Diameter': '70',
          'Location': 'Main Cabinet',
          'Purchase Price': '500',
          'Sale Price': '800',
          'Quantity': '1',
          'Notes': 'Example notes'
        }];
        filename = 'rx_lenses_template.xlsx';
        break;
        
      case 'stock':
        templateData = [{
          'Brand Name': 'Example Stock Brand',
          'Power Series': '-6.00 to +6.00',
          'Power Range': '-6S/+6S',
          'Inventory Type': 'range',
          'Purchase Price': '300',
          'Sale Price': '500',
          'Quantity': '10',
          'Unit': 'pairs'
        }];
        filename = 'stock_lenses_template.xlsx';
        break;
        
      case 'contact':
        templateData = [{
          'Brand Name': 'Example Contact Brand',
          'Power Series': '-6.00 to +6.00',
          'Category': 'Soft',
          'Contact Type': 'Daily',
          'Color': 'Clear',
          'Disposal Frequency': 'Daily',
          'Purchase Price': '50',
          'Sale Price': '100',
          'Quantity': '30'
        }];
        filename = 'contact_lenses_template.xlsx';
        break;
        
      case 'service':
        templateData = [{
          'Brand Name': 'Example Service',
          'Service Type': 'Lens Fitting',
          'Service Description': 'Professional lens fitting service',
          'Category': 'Professional Service',
          'Purchase Price': '100',
          'Sale Price': '200',
          'Quantity': '1',
          'Notes': 'Service notes'
        }];
        filename = 'services_template.xlsx';
        break;
        
      default:
        return;
    }
    
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(templateData);
    
    // Auto-size columns
    const colWidths = Object.keys(templateData[0]).map(key => ({
      width: Math.max(key.length, String(templateData[0][key]).length) + 2
    }));
    worksheet['!cols'] = colWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
    XLSX.writeFile(workbook, filename);
  };

  // Add a function to handle PowerInventory updates for stock lenses
  const handleUpdateStockInventory = async (lensId, inventoryData) => {
    try {
      setLoading(true);
      
      if (inventoryData.type === 'individual') {
        // Update with individual power inventory data
        const updateData = {
          inventoryType: 'individual',
          powerInventory: inventoryData.data.powerInventory,
          powerLimits: inventoryData.data.powerLimits,
          totalQuantity: inventoryData.data.totalQuantity,
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(getUserDoc('lensInventory', lensId), updateData);
      }
      
      // Refresh inventory
      await fetchLensInventory();
      
    } catch (error) {
      console.error('Error updating stock inventory:', error);
      setError(`Failed to update inventory: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="flex-grow px-2 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto w-full">
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2">
            <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-0 text-gray-900 dark:text-white">Lens Inventory</h1>
            <div className="flex flex-wrap gap-2">
              {(showAddForm || showStockLensForm || showContactLensForm || showServiceForm) ? (
                <button
                  onClick={resetForms}
                  className="px-3 py-1.5 sm:px-4 sm:py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none shadow-sm transition-colors text-sm w-full sm:w-auto"
                >
                  Cancel
                </button>
              ) : (
                <>
                  <button
                    onClick={() => {
                      setShowAddForm(true);
                      setShowStockLensForm(false);
                      setShowContactLensForm(false);
                      setShowServiceForm(false);
                      setActiveSection('addLens');
                    }}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 focus:outline-none shadow-sm transition-colors text-sm flex-1 sm:flex-none"
                  >
                    Add RX Lens
                  </button>
                  <button
                    onClick={() => {
                      setShowStockLensForm(true);
                      setShowAddForm(false);
                      setShowContactLensForm(false);
                      setShowServiceForm(false);
                      setActiveSection('addStockLens');
                    }}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 focus:outline-none shadow-sm transition-colors text-sm flex-1 sm:flex-none"
                  >
                    Add Stock Lens
                  </button>
                  <button
                    onClick={() => {
                      setShowContactLensForm(true);
                      setShowAddForm(false);
                      setShowStockLensForm(false);
                      setShowServiceForm(false);
                      setActiveSection('addContactLens');
                    }}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none shadow-sm transition-colors text-sm flex-1 sm:flex-none"
                  >
                    Add Contact Lens
                  </button>
                  <button
                    onClick={() => {
                      setShowServiceForm(true);
                      setShowAddForm(false);
                      setShowStockLensForm(false);
                      setShowContactLensForm(false);
                      setActiveSection('addService');
                    }}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 focus:outline-none shadow-sm transition-colors text-sm flex-1 sm:flex-none"
                  >
                    Add Service
                  </button>
                  <button
                    onClick={() => exportToExcel('all')}
                    disabled={exportLoading || lenses.length === 0}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 focus:outline-none shadow-sm transition-colors text-sm flex-1 sm:flex-none disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {exportLoading ? (
                      <div className="flex items-center justify-center">
                        <svg className="animate-spin w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Exporting...
                      </div>
                    ) : (
                      'Export All'
                    )}
                  </button>
                  <button
                    onClick={() => navigate('/lens-inventory-report')}
                    className="px-3 py-1.5 sm:px-4 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none shadow-sm transition-colors text-sm flex-1 sm:flex-none"
                  >
                    Inventory Report
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
        
        {error && (
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 border-l-4 border-red-400 text-red-700 dark:text-red-200 rounded-r-md shadow-sm text-sm bg-red-50 dark:bg-red-900/50">
            <p>{error}</p>
          </div>
        )}
        
        {/* Add Lens Form Section */}
        {showAddForm && (
          <AddLensForm 
            editMode={editMode} 
            lensToEdit={lensToEdit} 
            onSubmit={handleFormSubmit} 
            onCancel={resetForms} 
          />
        )}
        
        {/* Add Stock Lens Form Section */}
        {showStockLensForm && (
          <AddStockLensForm 
            editMode={editMode} 
            lensToEdit={lensToEdit} 
            onSubmit={handleFormSubmit} 
            onCancel={resetForms} 
          />
        )}
        
        {/* Add Contact Lens Form Section */}
        {showContactLensForm && (
          <AddContactLensForm 
            editMode={editMode} 
            lensToEdit={lensToEdit} 
            onSubmit={handleFormSubmit} 
            onCancel={resetForms} 
          />
        )}
        
        {/* Add Service Form Section */}
        {showServiceForm && (
          <AddServiceForm 
            editMode={editMode} 
            lensToEdit={lensToEdit} 
            onSubmit={handleFormSubmit} 
            onCancel={resetForms} 
          />
        )}
        
        {/* Inventory Table Section */}
        {(!showAddForm && !showStockLensForm && !showContactLensForm && !showServiceForm) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
              <div className="flex flex-wrap gap-1 sm:gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveTab('rx')}
                  className={`${tabClassName} ${activeTab === 'rx' ? 'bg-indigo-600 text-white rounded-lg shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg'} text-xs sm:text-sm`}
                >
                  RX Lenses
                </button>
                <button
                  onClick={() => setActiveTab('stock')}
                  className={`${tabClassName} ${activeTab === 'stock' ? 'bg-indigo-600 text-white rounded-lg shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg'} text-xs sm:text-sm`}
                >
                  Stock Lenses
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`${tabClassName} ${activeTab === 'contact' ? 'bg-indigo-600 text-white rounded-lg shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg'} text-xs sm:text-sm`}
                >
                  Contact Lenses
                </button>
                <button
                  onClick={() => setActiveTab('services')}
                  className={`${tabClassName} ${activeTab === 'services' ? 'bg-indigo-600 text-white rounded-lg shadow-sm' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg'} text-xs sm:text-sm`}
                >
                  Services
                </button>
              </div>
              
              <div className="flex flex-col sm:flex-row sm:space-x-3 gap-2 sm:gap-0">
                <div className="relative w-full sm:w-auto">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search lens inventory..."
                    className="pl-10 pr-4 py-2 w-full text-sm rounded-md border border-gray-300 dark:border-gray-600 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="flex space-x-2">
                  {/* Import/Export buttons for current tab */}
                  <div className="flex space-x-1">
                    {/* Export Button */}
                    <button
                      onClick={() => exportToExcel(activeTab === 'rx' ? 'prescription' : activeTab)}
                      disabled={exportLoading || filteredLenses.length === 0}
                      className="flex items-center justify-center text-sm text-green-600 hover:text-green-700 bg-green-50 dark:bg-green-900/50 hover:bg-green-100 dark:hover:bg-green-900/70 px-3 py-1 rounded-md disabled:opacity-50"
                    >
                      {exportLoading ? (
                        <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      )}
                      Export
                    </button>
                    
                    {/* Import Button */}
                    <label className="flex items-center justify-center text-sm text-blue-600 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-900/70 px-3 py-1 rounded-md cursor-pointer">
                      {importing ? (
                        <svg className="animate-spin w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                      )}
                      Import
                      <input
                        type="file"
                        accept=".xlsx,.xls"
                        onChange={(e) => handleFileUpload(e, activeTab === 'rx' ? 'prescription' : activeTab)}
                        className="hidden"
                        disabled={importing}
                      />
                    </label>
                    
                    {/* Template Download Button */}
                    <button
                      onClick={() => downloadTemplate(activeTab === 'rx' ? 'prescription' : activeTab)}
                      className="flex items-center justify-center text-sm text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-900/70 px-3 py-1 rounded-md"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Template
                    </button>
                  </div>
                  
                  <button
                    onClick={fetchLensInventory}
                    className="flex items-center justify-center text-sm text-sky-600 hover:text-sky-700 bg-sky-50 dark:bg-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900/70 px-3 py-1 rounded-md sm:ml-2 hidden"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                  <button
                    onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
                    className="flex items-center justify-center text-sm text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-900/70 px-3 py-1 rounded-md hidden"
                  >
                    {viewMode === 'table' ? (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                        </svg>
                        Card View
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h18M3 14h18M3 6h18M3 18h18" />
                        </svg>
                        Table View
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Render appropriate table component based on active tab */}
            {activeTab === 'rx' && (
              <RxLensTable 
                lenses={filteredLenses}
                loading={loading}
                onEdit={handleEditLens}
                onDelete={removeLens}
              />
            )}
            
            {activeTab === 'stock' && (
              <StockLensTable 
                lenses={filteredLenses}
                loading={loading}
                onEdit={handleEditLens}
                onDelete={removeLens}
                onUpdateInventory={handleUpdateStockInventory}
              />
            )}
            
            {activeTab === 'contact' && (
              <ContactLensTable 
                lenses={filteredLenses}
                loading={loading}
                onEdit={handleEditLens}
                onDelete={removeLens}
              />
            )}
            
            {activeTab === 'services' && (
              <ServiceTable 
                services={filteredLenses}
                loading={loading}
                onEdit={handleEditLens}
                onDelete={removeLens}
              />
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default LensInventory;
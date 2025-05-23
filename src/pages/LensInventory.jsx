import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, doc, deleteDoc, Timestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import AddLensForm from '../components/AddLensForm';
import AddStockLensForm from '../components/AddStockLensForm';
import AddContactLensForm from '../components/AddContactLensForm';
import AddServiceForm from '../components/AddServiceForm';

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
      powerSeries: '',
      purchasePrice: '',
      salePrice: '',
      qty: 1
    }))
  );
  
  // Styling constants
  const inputClassName = "block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm py-1.5 px-2 text-center";
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
        powerSeries: '',
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
        const lensData = {
          brandName: row.brandName,
          powerSeries: row.powerSeries,
          purchasePrice: row.purchasePrice,
          salePrice: row.salePrice,
          qty: parseInt(row.qty) || 1,
          type: 'stock',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(doc(db, 'lens_inventory', lensToEdit.id), lensData);
        console.log("Updated stock lens:", lensData);
        
        // Reset edit mode
        resetForms();
      } else {
        // Add new stock lenses
        // For each valid stock lens row, create a lens in inventory
        for (const row of validRows) {
          const lensData = {
            brandName: row.brandName,
            powerSeries: row.powerSeries,
            purchasePrice: row.purchasePrice,
            salePrice: row.salePrice,
            qty: parseInt(row.qty) || 1,
            type: 'stock',
            createdAt: Timestamp.now()
          };
          
          await addDoc(collection(db, 'lens_inventory'), lensData);
        }
        
        // Reset form
        setStockLensRows(Array(10).fill().map((_, index) => ({
          id: index + 1,
          brandName: '',
          powerSeries: '',
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
      
      const lensRef = collection(db, 'lens_inventory');
      const snapshot = await getDocs(lensRef);
      
      const lensesList = snapshot.docs.map(doc => ({
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
        await deleteDoc(doc(db, 'lens_inventory', id));
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
          powerSeries: row.powerSeries,
          purchasePrice: row.purchasePrice,
          salePrice: row.salePrice,
          qty: parseInt(row.qty) || 1,
          type: 'stock',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(doc(db, 'lens_inventory', lensToEdit.id), lensData);
      } else if (lensToEdit.type === 'service') {
        // Update service
        const lensData = {
          ...lensSpecifications,
          type: 'service',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(doc(db, 'lens_inventory', lensToEdit.id), lensData);
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
        
        await updateDoc(doc(db, 'lens_inventory', lensToEdit.id), lensData);
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
      powerSeries: '',
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
    const serviceLenses = lenses.filter(lens => lens.type === 'service');
    
    const stockQty = stockLenses.reduce((sum, lens) => sum + (parseInt(lens.qty) || 0), 0);
    const prescriptionQty = prescriptionLenses.reduce((sum, lens) => sum + (parseInt(lens.qty) || 0), 0);
    const serviceQty = serviceLenses.reduce((sum, lens) => sum + (parseInt(lens.qty) || 0), 0);
    
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
    
    const serviceValue = serviceLenses.reduce((sum, lens) => {
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
          <svg className="animate-spin h-6 w-6 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-2 text-sm" style={{ color: 'var(--text-muted)' }}>Loading inventory...</span>
        </div>
      );
    }

    if (filteredLenses.length === 0) {
      return (
        <div className="border-l-4 border-yellow-400 p-3 sm:p-4 mb-4 rounded-r text-sm" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-xs sm:text-sm text-yellow-700">
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
          <div key={lens.id} className={`p-3 rounded-lg border shadow-sm ${index % 2 === 0 ? '' : ''}`} 
               style={{ 
                 backgroundColor: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                 borderColor: 'var(--border-primary)'
               }}>
            <div className="flex justify-between items-center mb-2">
              <div className="font-medium text-sky-600">
                {lens.brandName || 'N/A'}
              </div>
              <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Qty: {lens.qty || '1'}
              </div>
            </div>

            {/* RX lens details */}
            {activeTab === 'rx' && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Eye:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>
                    {lens.eye === 'right' ? 'Right' : lens.eye === 'left' ? 'Left' : lens.eye === 'both' ? 'Both' : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>SPH:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.sph || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>CYL:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.cyl || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>AXIS:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.axis || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>ADD:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.add || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Material:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.material || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Index:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.index || 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Stock lens details */}
            {activeTab === 'stock' && (
              <div className="grid grid-cols-1 gap-2 text-xs mb-3">
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Power Series:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.powerSeries || 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Contact lens details */}
            {activeTab === 'contact' && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Power Series:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.powerSeries || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Category:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.category || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Type:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.contactType || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Color:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.color || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Disposal:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.disposalFrequency || 'N/A'}</span>
                </div>
              </div>
            )}

            {/* Service details */}
            {activeTab === 'services' && (
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Service Type:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.serviceType || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Service Description:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>{lens.serviceDescription || 'N/A'}</span>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center text-xs">
              <div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Purchase:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>
                    {lens.purchasePrice ? `₹${parseFloat(lens.purchasePrice).toFixed(2)}` : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="font-medium" style={{ color: 'var(--text-muted)' }}>Sale:</span>{' '}
                  <span style={{ color: 'var(--text-primary)' }}>
                    {lens.salePrice ? `₹${parseFloat(lens.salePrice).toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleEditLens(lens)}
                  className="text-sky-600 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-2 py-1 rounded text-xs"
                >
                  Edit
                </button>
                <button
                  onClick={() => removeLens(lens.id)}
                  className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-2 py-1 rounded text-xs"
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

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar />
      
      <main className="flex-grow px-2 sm:px-4 py-4 sm:py-6 max-w-7xl mx-auto w-full">
        <div className="mb-4 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-2">
            <h1 className="text-xl sm:text-2xl font-bold mb-3 sm:mb-0" style={{ color: 'var(--text-primary)' }}>Lens Inventory</h1>
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
          <div className="mb-4 sm:mb-6 p-3 sm:p-4 border-l-4 border-red-400 text-red-700 rounded-r-md shadow-sm text-sm" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
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
          <div className="card p-3 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
              <div className="flex flex-wrap gap-1 sm:gap-2 overflow-x-auto pb-1">
                <button
                  onClick={() => setActiveTab('rx')}
                  className={`${tabClassName} ${activeTab === 'rx' ? activeTabClassName : inactiveTabClassName} text-xs sm:text-sm`}
                >
                  RX Lenses
                </button>
                <button
                  onClick={() => setActiveTab('stock')}
                  className={`${tabClassName} ${activeTab === 'stock' ? activeTabClassName : inactiveTabClassName} text-xs sm:text-sm`}
                >
                  Stock Lenses
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`${tabClassName} ${activeTab === 'contact' ? activeTabClassName : inactiveTabClassName} text-xs sm:text-sm`}
                >
                  Contact Lenses
                </button>
                <button
                  onClick={() => setActiveTab('services')}
                  className={`${tabClassName} ${activeTab === 'services' ? activeTabClassName : inactiveTabClassName} text-xs sm:text-sm`}
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
                    className="pl-10 pr-4 py-2 form-input w-full text-sm"
                  />
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={fetchLensInventory}
                    className="flex items-center justify-center text-sm text-sky-600 hover:text-sky-700 bg-sky-50 hover:bg-sky-100 px-3 py-1 rounded-md sm:ml-2"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                  <button
                    onClick={() => setViewMode(viewMode === 'table' ? 'card' : 'table')}
                    className="flex items-center justify-center text-sm text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-3 py-1 rounded-md"
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
            
            {/* Render card view on mobile or when card view is selected */}
            {(viewMode === 'card') ? (
              renderMobileCardView()
            ) : (
              <>
                {filteredLenses.length === 0 && !loading ? (
                  <div className="border-l-4 border-yellow-400 p-3 sm:p-4 mb-4 rounded-r text-sm" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-xs sm:text-sm text-yellow-700">
                          {searchTerm ? 'No lenses match your search criteria.' : 'No lenses in inventory yet. Add your first lens to get started!'}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto -mx-3 sm:mx-0 shadow border-b rounded-lg" style={{ borderColor: 'var(--border-primary)' }}>
                    <table className="min-w-full divide-y text-xs sm:text-sm" style={{ borderColor: 'var(--border-primary)' }}>
                      <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <tr>
                          <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Brand</th>
                          
                          {/* Columns for RX lenses */}
                          {activeTab === 'rx' && (
                            <>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Eye</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>SPH</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>CYL</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>AXIS</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>ADD</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Material</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Index</th>
                            </>
                          )}
                          
                          {/* Columns for Stock lenses */}
                          {activeTab === 'stock' && (
                            <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Power Series</th>
                          )}
                          
                          {/* Columns for Contact lenses */}
                          {activeTab === 'contact' && (
                            <>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Power Series</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Category</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Type</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Color</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Disposal</th>
                            </>
                          )}
                          
                          {/* Columns for Services */}
                          {activeTab === 'services' && (
                            <>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Service Type</th>
                              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Service Description</th>
                            </>
                          )}
                          
                          {/* Common columns for all lens types */}
                          <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Purchase</th>
                          <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Sale</th>
                          <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Qty</th>
                          <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        {loading ? (
                          <tr>
                            <td colSpan={activeTab === 'rx' ? 11 : activeTab === 'stock' ? 5 : activeTab === 'contact' ? 9 : activeTab === 'services' ? 7 : 4} className="px-2 sm:px-3 py-3 text-center">
                              <div className="flex justify-center items-center">
                                <svg className="animate-spin h-5 w-5 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                <span className="ml-2 text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>Loading inventory...</span>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          filteredLenses.map((lens, index) => (
                            <tr key={lens.id} className={index % 2 === 0 ? 'hover:bg-opacity-50' : 'hover:bg-opacity-50'} 
                                style={{ 
                                  backgroundColor: index % 2 === 0 ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                                  ':hover': { backgroundColor: 'var(--bg-tertiary)' }
                                }}>
                              <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm" style={{ color: 'var(--text-primary)' }}>
                                <a href={`/lens-inventory/${lens.id}`} className="text-sky-600 hover:text-sky-800 hover:underline">
                                  {lens.brandName || 'N/A'}
                                </a>
                              </td>
                              
                              {/* Conditional rendering for RX lens columns */}
                              {activeTab === 'rx' && (
                                <>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 font-medium">
                                    {lens.eye === 'right' ? 'Right' : lens.eye === 'left' ? 'Left' : lens.eye === 'both' ? 'Both' : 'N/A'}
                                  </td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.sph || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.cyl || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.axis || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.add || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.material || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.index || 'N/A'}</td>
                                </>
                              )}
                              
                              {/* Power Series column for stock lenses */}
                              {activeTab === 'stock' && (
                                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                                  {lens.powerSeries || 'N/A'}
                                </td>
                              )}
                              
                              {/* Contact lens specific columns */}
                              {activeTab === 'contact' && (
                                <>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.powerSeries || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.category || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.contactType || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.color || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.disposalFrequency || 'N/A'}</td>
                                </>
                              )}
                              
                              {/* Service specific columns */}
                              {activeTab === 'services' && (
                                <>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.serviceType || 'N/A'}</td>
                                  <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.serviceDescription || 'N/A'}</td>
                                </>
                              )}
                              
                              {/* Common columns for all lens types */}
                              <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                                {lens.purchasePrice ? `₹${parseFloat(lens.purchasePrice).toFixed(2)}` : 'N/A'}
                              </td>
                              <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">
                                {lens.salePrice ? `₹${parseFloat(lens.salePrice).toFixed(2)}` : 'N/A'}
                              </td>
                              <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900">{lens.qty || '1'}</td>
                              <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium">
                                <div className="flex gap-1 sm:gap-2">
                                  <button
                                    onClick={() => handleEditLens(lens)}
                                    className="text-sky-600 hover:text-sky-900 bg-sky-50 hover:bg-sky-100 px-1.5 sm:px-2 py-1 rounded text-xs sm:text-sm"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => removeLens(lens.id)}
                                    className="text-red-600 hover:text-red-900 bg-red-50 hover:bg-red-100 px-1.5 sm:px-2 py-1 rounded text-xs sm:text-sm"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default LensInventory; 
import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc, deleteDoc, Timestamp, updateDoc } from 'firebase/firestore';
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

const LensInventory = () => {
  const [lenses, setLenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showStockLensForm, setShowStockLensForm] = useState(false);
  const [showContactLensForm, setShowContactLensForm] = useState(false);
  const [showServiceForm, setShowServiceForm] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [lensToEdit, setLensToEdit] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredLenses, setFilteredLenses] = useState([]);
  const [activeTab, setActiveTab] = useState('rx');
  const [importing, setImporting] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  
  const navigate = useNavigate();
  
  useEffect(() => {
    fetchLensInventory();
  }, []);

  // Listen for inventory updates from other components
  useEffect(() => {
    const handleInventoryUpdate = () => {
      fetchLensInventory();
    };

    // Listen for custom inventory update events
    window.addEventListener('lensInventoryUpdated', handleInventoryUpdate);
    
    return () => {
      window.removeEventListener('lensInventoryUpdated', handleInventoryUpdate);
    };
  }, []);
  
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
        (lens.color && lens.color.toLowerCase().includes(lowercaseSearch)) ||
        // Add service-specific search fields
        (lens.serviceName && lens.serviceName.toLowerCase().includes(lowercaseSearch)) ||
        (lens.serviceType && lens.serviceType.toLowerCase().includes(lowercaseSearch)) ||
        (lens.serviceDescription && lens.serviceDescription.toLowerCase().includes(lowercaseSearch))
      );
    }
    
    setFilteredLenses(filtered);
  }, [searchTerm, lenses, activeTab]);
  
  const fetchLensInventory = async () => {
    try {
      setLoading(true);
      setError('');
      
      const lensRef = getUserCollection('lensInventory');
      const snapshot = await getDocs(lensRef);
      
      const lensesList = snapshot.docs
        .filter(doc => !doc.data()._placeholder)
        .filter(doc => !doc.data().hiddenFromInventory) // Hide RX lenses created via CreateSale - they're remembered for suggestions but not shown in inventory
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      
      setLenses(lensesList);
      setFilteredLenses(lensesList);    
    } catch (error) {
      console.error('Error fetching lens inventory:', error);
      setError('Failed to fetch lens inventory');
    } finally {
      setLoading(false);
    }
  };
  
  const handleFormSubmit = () => {
    resetForms();
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
    setEditMode(true);
    
    // Set form visibility based on lens type
    if (lens.type === 'stock') {
      setShowStockLensForm(true);
      setShowAddForm(false);
      setShowContactLensForm(false);
      setShowServiceForm(false);
    } else if (lens.type === 'contact') {
      setShowContactLensForm(true);
      setShowAddForm(false);
      setShowStockLensForm(false);
      setShowServiceForm(false);
    } else if (lens.type === 'service') {
      setShowServiceForm(true);
      setShowAddForm(false);
      setShowStockLensForm(false);
      setShowContactLensForm(false);
    } else {
      setShowAddForm(true);
      setShowStockLensForm(false);
      setShowContactLensForm(false);
      setShowServiceForm(false);
    }
  };
  
  const resetForms = () => {
    setEditMode(false);
    setLensToEdit(null);
    setShowAddForm(false);
    setShowStockLensForm(false);
    setShowContactLensForm(false);
    setShowServiceForm(false);
  };

  const handleUpdateStockInventory = async (lensId, inventoryData) => {
    try {
      setLoading(true);
      
      if (inventoryData.type === 'individual') {
        const updateData = {
          inventoryType: 'individual',
          powerInventory: inventoryData.data.powerInventory,
          powerLimits: inventoryData.data.powerLimits,
          totalQuantity: inventoryData.data.totalQuantity,
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(getUserDoc('lensInventory', lensId), updateData);
      }
      
      await fetchLensInventory();
      
    } catch (error) {
      console.error('Error updating stock inventory:', error);
      setError(`Failed to update inventory: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  // Simple export function
  const exportToExcel = (type) => {
    try {
      setExportLoading(true);
      
      const filteredData = lenses.filter(lens => {
        if (type === 'all') return true;
        return lens.type === type;
      });
      
      if (filteredData.length === 0) {
        setError(`No ${type} lenses found to export.`);
        setExportLoading(false);
        return;
      }
      
      const dataToExport = filteredData.map(lens => ({
        'Brand Name': lens.brandName || '',
        'Type': lens.type || '',
        'Purchase Price': lens.purchasePrice || '',
        'Sale Price': lens.salePrice || '',
        'Quantity': lens.qty || lens.totalQuantity || 1,
        'Created Date': lens.createdAt ? new Date(lens.createdAt.seconds * 1000).toLocaleDateString() : ''
      }));
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
      XLSX.writeFile(workbook, `${type}_inventory.xlsx`);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      setError(`Failed to export: ${error.message}`);
    } finally {
      setExportLoading(false);
    }
  };

  // Download template functions for different lens types
  const downloadTemplate = (type) => {
    try {
      let templateData = [];
      
      switch (type) {
        case 'rx':
        case 'prescription':
          templateData = [
            {
              'Brand Name': 'Essilor Varilux',
              'Material': 'CR-39',
              'Index': '1.50',
              'Category': 'Progressive',
              'Max SPH': '6.00',
              'Min SPH': '-6.00',
              'Max CYL': '2.00',
              'Min CYL': '-2.00',
              'Purchase Price': '500',
              'Sale Price': '800',
              'Quantity': '10'
            },
            {
              'Brand Name': 'Zeiss Single Vision',
              'Material': 'Polycarbonate',
              'Index': '1.59',
              'Category': 'Single Vision',
              'Max SPH': '8.00',
              'Min SPH': '-8.00',
              'Max CYL': '4.00',
              'Min CYL': '-4.00',
              'Purchase Price': '300',
              'Sale Price': '500',
              'Quantity': '25'
            }
          ];
          break;
          
        case 'stock':
          templateData = [
            {
              'Brand Name': 'Crizal Readers',
              'Power Series': 'Reading',
              'Inventory Type': 'bulk',
              'Bulk Quantity': '100',
              'Axis': '0',
              'Purchase Price': '150',
              'Sale Price': '250'
            },
            {
              'Brand Name': 'Anti-Glare Stock',
              'Power Series': 'Distance',
              'Inventory Type': 'individual',
              'SPH Range': '-2.00 to +2.00',
              'CYL Range': '-1.00 to +1.00',
              'Axis': '0',
              'Purchase Price': '200',
              'Sale Price': '350'
            }
          ];
          break;
          
        case 'contact':
          templateData = [
            {
              'Brand Name': 'Acuvue Oasys',
              'Contact Type': 'Soft',
              'Power Series': 'Daily',
              'Color': 'Clear',
              'Diameter': '14.0',
              'Base Curve': '8.5',
              'Water Content': '38%',
              'Purchase Price': '1200',
              'Sale Price': '1500',
              'Quantity': '30'
            },
            {
              'Brand Name': 'Biofinity Toric',
              'Contact Type': 'Soft',
              'Power Series': 'Monthly',
              'Color': 'Clear',
              'Diameter': '14.5',
              'Base Curve': '8.6',
              'Water Content': '48%',
              'Purchase Price': '2000',
              'Sale Price': '2500',
              'Quantity': '20'
            }
          ];
          break;
          
        case 'service':
        case 'services':
          templateData = [
            {
              'Service Name': 'Anti-Reflective Coating',
              'Service Category': 'Coating',
              'Service Price': '500',
              'Description': 'Premium AR coating for better clarity'
            },
            {
              'Service Name': 'Lens Fitting',
              'Service Category': 'Fitting',
              'Service Price': '200',
              'Description': 'Professional lens fitting service'
            },
            {
              'Service Name': 'Frame Repair',
              'Service Category': 'Repair',
              'Service Price': '300',
              'Description': 'Frame repair and adjustment service'
            }
          ];
          break;
          
        default:
          setError('Invalid template type');
          return;
      }
      
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(templateData);
      
      // Auto-size columns
      const maxWidth = 20;
      const cols = Object.keys(templateData[0]).map(() => ({ width: maxWidth }));
      worksheet['!cols'] = cols;
      
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      XLSX.writeFile(workbook, `${type}_lens_template.xlsx`);
      
    } catch (error) {
      console.error('Error downloading template:', error);
      setError(`Failed to download template: ${error.message}`);
    }
  };

  // Enhanced import function with template support
  const importFromExcel = async (file, type) => {
    try {
      setImporting(true);
      setError('');
      
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);
      
      if (jsonData.length === 0) {
        setError('The Excel file is empty or has no valid data.');
        setImporting(false);
        return;
      }
      
      let importedCount = 0;
      
      for (const row of jsonData) {
        let lensData = {
          createdAt: Timestamp.now()
        };
        
        // Handle different lens types based on template format
        switch (type) {
          case 'rx':
          case 'prescription':
            if (!row['Brand Name'] || row['Brand Name'].trim() === '') continue;
            lensData = {
              ...lensData,
              brandName: row['Brand Name'],
              type: 'prescription',
              material: row['Material'] || '',
              index: parseFloat(row['Index']) || 1.50,
              category: row['Category'] || '',
              maxSph: parseFloat(row['Max SPH']) || 0,
              minSph: parseFloat(row['Min SPH']) || 0,
              maxCyl: parseFloat(row['Max CYL']) || 0,
              minCyl: parseFloat(row['Min CYL']) || 0,
              purchasePrice: parseFloat(row['Purchase Price']) || 0,
              salePrice: parseFloat(row['Sale Price']) || 0,
              qty: parseInt(row['Quantity']) || 1
            };
            break;
            
          case 'stock':
            if (!row['Brand Name'] || row['Brand Name'].trim() === '') continue;
            lensData = {
              ...lensData,
              brandName: row['Brand Name'],
              type: 'stock',
              powerSeries: row['Power Series'] || '',
              inventoryType: row['Inventory Type'] || 'bulk',
              axis: parseInt(row['Axis']) || 0,
              purchasePrice: parseFloat(row['Purchase Price']) || 0,
              salePrice: parseFloat(row['Sale Price']) || 0
            };
            
            // Handle bulk vs individual inventory
            if (row['Inventory Type'] === 'bulk') {
              lensData.bulkQuantity = parseInt(row['Bulk Quantity']) || 0;
              lensData.totalQuantity = parseInt(row['Bulk Quantity']) || 0;
            } else {
              lensData.totalQuantity = 0; // Will be calculated from power inventory
              lensData.powerInventory = {}; // Initialize empty power inventory
            }
            break;
            
          case 'contact':
            if (!row['Brand Name'] || row['Brand Name'].trim() === '') continue;
            lensData = {
              ...lensData,
              brandName: row['Brand Name'],
              type: 'contact',
              contactType: row['Contact Type'] || 'Soft',
              powerSeries: row['Power Series'] || '',
              color: row['Color'] || '',
              diameter: parseFloat(row['Diameter']) || 14.0,
              baseCurve: parseFloat(row['Base Curve']) || 8.5,
              waterContent: row['Water Content'] || '',
              purchasePrice: parseFloat(row['Purchase Price']) || 0,
              salePrice: parseFloat(row['Sale Price']) || 0,
              qty: parseInt(row['Quantity']) || 1
            };
            break;
            
          case 'service':
          case 'services':
            if (!row['Service Name'] || row['Service Name'].trim() === '') continue;
            lensData = {
              ...lensData,
              serviceName: row['Service Name'],
              type: 'service',
              serviceCategory: row['Service Category'] || '',
              servicePrice: parseFloat(row['Service Price']) || 0,
              salePrice: parseFloat(row['Service Price']) || 0,
              description: row['Description'] || ''
            };
            break;
            
          default:
            // Fallback to basic format
            if (!row['Brand Name'] || row['Brand Name'].trim() === '') continue;
            lensData = {
              ...lensData,
              brandName: row['Brand Name'],
              type: type === 'rx' ? 'prescription' : type,
              purchasePrice: parseFloat(row['Purchase Price']) || 0,
              salePrice: parseFloat(row['Sale Price']) || 0,
              qty: parseInt(row['Quantity']) || 1
            };
        }
        
        await addDoc(getUserCollection('lensInventory'), lensData);
        importedCount++;
      }
      
      if (importedCount > 0) {
        await fetchLensInventory();
        setError(''); // Clear any existing errors
        
        // Show temporary success alert
        alert(`Successfully imported ${importedCount} ${type} lenses.`);
      }
      
    } catch (error) {
      console.error('Error importing from Excel:', error);
      setError(`Failed to import: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };
  
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
    event.target.value = '';
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900">
      <Navbar />
      
      <main className="flex-grow px-4 py-6 max-w-7xl mx-auto w-full">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4">
            <h1 className="text-2xl font-bold mb-3 sm:mb-0 text-gray-900 dark:text-white">Lens Inventory</h1>
            <div className="flex flex-wrap gap-2">
              {(showAddForm || showStockLensForm || showContactLensForm || showServiceForm) ? (
                <button
                  onClick={resetForms}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
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
                    }}
                    className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 transition-colors"
                  >
                    Add RX Lens
                  </button>
                  <button
                    onClick={() => {
                      setShowStockLensForm(true);
                      setShowAddForm(false);
                      setShowContactLensForm(false);
                      setShowServiceForm(false);
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                  >
                    Add Stock Lens
                  </button>
                  <button
                    onClick={() => {
                      setShowContactLensForm(true);
                      setShowAddForm(false);
                      setShowStockLensForm(false);
                      setShowServiceForm(false);
                    }}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    Add Contact Lens
                  </button>
                  <button
                    onClick={() => {
                      setShowServiceForm(true);
                      setShowAddForm(false);
                      setShowStockLensForm(false);
                      setShowContactLensForm(false);
                    }}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    Add Service
                  </button>
                  <button
                    onClick={() => exportToExcel('all')}
                    disabled={exportLoading || lenses.length === 0}
                    className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >
                    {exportLoading ? 'Exporting...' : 'Export All'}
                  </button>
                  <button
                    onClick={() => navigate('/lens-inventory-report')}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    Reports
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
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'rx' ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  RX Lenses
                </button>
                <button
                  onClick={() => setActiveTab('stock')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'stock' ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  Stock Lenses
                </button>
                <button
                  onClick={() => setActiveTab('contact')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'contact' ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                >
                  Contact Lenses
                </button>
                <button
                  onClick={() => setActiveTab('services')}
                  className={`px-4 py-2 text-sm font-medium rounded-lg ${activeTab === 'services' ? 'bg-indigo-600 text-white' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
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
                    {/* Template Download Button */}
                    <button
                      onClick={() => downloadTemplate(activeTab === 'rx' ? 'prescription' : activeTab)}
                      className="flex items-center justify-center text-sm text-purple-600 hover:text-purple-700 bg-purple-50 dark:bg-purple-900/50 hover:bg-purple-100 dark:hover:bg-purple-900/70 px-3 py-1 rounded-md"
                      title="Download Excel template for bulk import"
                    >
                      <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Template
                    </button>
                    
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
                    
                  </div>
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
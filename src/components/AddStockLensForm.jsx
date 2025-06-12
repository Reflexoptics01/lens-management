import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, Timestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import PowerInventoryModal from './PowerInventoryModal';

const AddStockLensForm = ({ editMode = false, lensToEdit = null, onSubmit, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Array of stock lens rows for batch adding
  const [stockLensRows, setStockLensRows] = useState(
    Array(10).fill().map((_, index) => ({
      id: index + 1,
      brandName: '',
      maxSph: '',
      maxCyl: '',
      axis: '0', // Default axis value
      maxAdd: '', // Maximum addition power for bifocal/progressive lenses
      purchasePrice: '',
      salePrice: '',
      qty: 1,
      powerInventorySetup: false,
      powerInventoryData: null
    }))
  );
  
  // PowerInventoryModal states
  const [showPowerInventoryModal, setShowPowerInventoryModal] = useState(false);
  const [pendingStockLens, setPendingStockLens] = useState(null);
  const [currentRowIndex, setCurrentRowIndex] = useState(null);
  
  // Styling constants
  const inputClassName = "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm py-1.5 px-2 text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-moz-appearance]:textfield";
  const selectClassName = "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm py-1.5 px-2";
  const labelClassName = "block uppercase tracking-wide text-xs font-bold text-sky-700 dark:text-sky-300 mb-1";
  const sectionClassName = "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6";
  
  useEffect(() => {
    // If editing a lens, populate the form with a single row
    if (editMode && lensToEdit) {
      const stockLensData = {
        id: 1,
        brandName: lensToEdit.brandName || '',
        maxSph: lensToEdit.maxSph || '',
        maxCyl: lensToEdit.maxCyl || '',
        axis: lensToEdit.axis || '0',
        maxAdd: lensToEdit.maxAdd || '',
        purchasePrice: lensToEdit.purchasePrice || '',
        salePrice: lensToEdit.salePrice || '',
        qty: parseFloat(lensToEdit.qty) || lensToEdit.totalQuantity || 1,
        powerInventorySetup: lensToEdit.inventoryType === 'individual',
        powerInventoryData: lensToEdit.inventoryType === 'individual' ? {
          type: 'individual',
          powerInventory: lensToEdit.powerInventory || {},
          powerLimits: lensToEdit.powerLimits || {},
          totalQuantity: lensToEdit.totalQuantity || 0
        } : null
      };
      
      setStockLensRows([stockLensData]);
    }
  }, [editMode, lensToEdit]);
  
  // Listen for ESC key to close form
  useEffect(() => {
    const handleCloseForm = () => {
      if (onCancel) {
        onCancel();
      }
    };

    window.addEventListener('closeForm', handleCloseForm);
    return () => {
      window.removeEventListener('closeForm', handleCloseForm);
    };
  }, [onCancel]);
  
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
        axis: '0',
        maxAdd: '',
        purchasePrice: '',
        salePrice: '',
        qty: 1,
        powerInventorySetup: false,
        powerInventoryData: null
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
  
  // PowerInventoryModal handlers
  const handlePowerInventoryModalSave = async (inventoryData) => {
    try {
      setLoading(true);
      setError('');
      
      // REMOVED FOR PRODUCTION: console.log('PowerInventoryModal data received:', inventoryData);
      
      // Update the current row to mark power inventory as set up
      const updatedRows = [...stockLensRows];
      updatedRows[currentRowIndex] = {
        ...updatedRows[currentRowIndex],
        powerInventorySetup: inventoryData.type === 'individual',
        powerInventoryData: inventoryData.type === 'individual' ? inventoryData.data : null
      };
      
      // REMOVED FOR PRODUCTION: console.log('Updated row data:', updatedRows[currentRowIndex]);
      
      setStockLensRows(updatedRows);
      
      setShowPowerInventoryModal(false);
      setPendingStockLens(null);
      setCurrentRowIndex(null);
      
      setError('');
      
    } catch (error) {
      console.error('Error setting up power inventory:', error);
      setError(`Failed to setup power inventory: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePowerInventoryModalClose = () => {
    setShowPowerInventoryModal(false);
    setPendingStockLens(null);
    setCurrentRowIndex(null);
  };
  
  // Function to handle power inventory setup for a row
  const handleSetupPowerInventory = (index) => {
    const row = stockLensRows[index];
    
    if (!row.brandName || !row.maxSph || !row.maxCyl) {
      setError('Please fill in Brand Name, Max SPH, and Max CYL before setting up individual power inventory.');
      return;
    }
    
    // Convert to numbers
    const maxSphNum = parseFloat(row.maxSph);
    const maxCylNum = parseFloat(row.maxCyl);
    const axisNum = parseFloat(row.axis) || 0;
    const maxAddNum = row.maxAdd ? parseFloat(row.maxAdd) : null;
    
    if (isNaN(maxSphNum) || isNaN(maxCylNum)) {
      setError('Max SPH and Max CYL must be valid numbers.');
      return;
    }
    
    // Calculate power ranges based on the logic:
    // If negative: range is from entered value to 0 (e.g., -6 to 0)
    // If positive: range is from 0 to entered value (e.g., 0 to +3)
    const sphMin = maxSphNum < 0 ? maxSphNum : 0;
    const sphMax = maxSphNum < 0 ? 0 : maxSphNum;
    const cylMin = maxCylNum < 0 ? maxCylNum : 0;
    const cylMax = maxCylNum < 0 ? 0 : maxCylNum;
    
    // Create power range string for display
    let powerRange = `SPH: ${sphMin} to ${sphMax}, CYL: ${cylMin} to ${cylMax}`;
    if (axisNum) {
      powerRange += `, AXIS: ${axisNum}°`;
    }
    if (maxAddNum) {
      powerRange += `, ADD: +1.00 to +${maxAddNum}`;
    }
    
    // Debug logging
    // REMOVED FOR PRODUCTION: console.log('Setting up power inventory for:', {
    //   brandName: row.brandName,
    //   enteredMaxSph: row.maxSph,
    //   enteredMaxCyl: row.maxCyl,
    //   enteredAxis: row.axis,
    //   enteredMaxAdd: row.maxAdd,
    //   calculatedRanges: {
    //     sphMin,
    //     sphMax,
    //     cylMin,
    //     cylMax,
    //     axis: axisNum,
    //     maxAdd: maxAddNum
    //   },
    //   powerRange
    // });
    
    // Clear any existing error
    setError('');
    
    setPendingStockLens({
      name: row.brandName,
      powerRange: powerRange,
      maxSph: row.maxSph,
      maxCyl: row.maxCyl,
      axis: axisNum,
      maxAdd: maxAddNum,
      sphMin,
      sphMax,
      cylMin,
      cylMax,
      purchasePrice: row.purchasePrice,
      salePrice: row.salePrice
    });
    setCurrentRowIndex(index);
    setShowPowerInventoryModal(true);
  };
  
  const handleSubmit = async (e) => {
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
        
        // Generate power series from maxSph and maxCyl
        const maxSphNum = parseFloat(row.maxSph);
        const maxCylNum = parseFloat(row.maxCyl);
        const axisNum = parseFloat(row.axis) || 0;
        const maxAddNum = row.maxAdd ? parseFloat(row.maxAdd) : null;
        
        const sphRange = maxSphNum < 0 ? `${maxSphNum} to 0` : `0 to +${maxSphNum}`;
        const cylRange = maxCylNum < 0 ? `${maxCylNum} to 0` : `0 to +${maxCylNum}`;
        let powerSeries = `SPH: ${sphRange}, CYL: ${cylRange}`;
        
        // Add axis and addition to power series if provided
        if (axisNum) {
          powerSeries += `, AXIS: ${axisNum}°`;
        }
        if (maxAddNum) {
          powerSeries += `, ADD: +1.00 to +${maxAddNum}`;
        }
        
        let lensData = {
          brandName: row.brandName,
          powerSeries: powerSeries,
          maxSph: row.maxSph,
          maxCyl: row.maxCyl,
          axis: axisNum,
          maxAdd: maxAddNum,
          purchasePrice: row.purchasePrice,
          salePrice: row.salePrice,
          type: 'stock',
          updatedAt: Timestamp.now()
        };
        
        // If power inventory was set up for this row, include that data
        if (row.powerInventorySetup && row.powerInventoryData) {
          lensData = {
            ...lensData,
            inventoryType: 'individual',
            powerInventory: row.powerInventoryData.powerInventory,
            powerLimits: row.powerInventoryData.powerLimits,
            totalQuantity: row.powerInventoryData.totalQuantity,
            // Add new fields for bifocal/progressive lenses
            lensType: row.powerInventoryData.lensType || 'single',
            ...(row.powerInventoryData.lensType === 'bifocal' && {
              axis: row.powerInventoryData.axis || 0
            })
          };
          // Remove qty if using individual power inventory
          delete lensData.qty;
        } else {
          // Default to simple quantity and remove individual power data
          lensData.qty = parseFloat(row.qty) || 1;
          lensData.inventoryType = 'range';
          // Remove individual power inventory fields
          delete lensData.powerInventory;
          delete lensData.powerLimits;
          delete lensData.totalQuantity;
        }
        
        await updateDoc(getUserDoc('lensInventory', lensToEdit.id), lensData);
        // REMOVED FOR PRODUCTION: console.log("Updated stock lens:", lensData);
        
        // Call the onSubmit callback
        if (onSubmit) onSubmit();
      } else {
        // Add new stock lenses
        const addedLenses = [];
        
        // For each valid stock lens row, create a lens in inventory
        for (const row of validRows) {
          // Generate power series from maxSph and maxCyl
          const maxSphNum = parseFloat(row.maxSph);
          const maxCylNum = parseFloat(row.maxCyl);
          const axisNum = parseFloat(row.axis) || 0;
          const maxAddNum = row.maxAdd ? parseFloat(row.maxAdd) : null;
          
          const sphRange = maxSphNum < 0 ? `${maxSphNum} to 0` : `0 to +${maxSphNum}`;
          const cylRange = maxCylNum < 0 ? `${maxCylNum} to 0` : `0 to +${maxCylNum}`;
          let powerSeries = `SPH: ${sphRange}, CYL: ${cylRange}`;
          
          // Add axis and addition to power series if provided
          if (axisNum) {
            powerSeries += `, AXIS: ${axisNum}°`;
          }
          if (maxAddNum) {
            powerSeries += `, ADD: +1.00 to +${maxAddNum}`;
          }
          
          let lensData = {
            brandName: row.brandName,
            powerSeries: powerSeries,
            maxSph: row.maxSph,
            maxCyl: row.maxCyl,
            axis: axisNum,
            maxAdd: maxAddNum,
            purchasePrice: row.purchasePrice,
            salePrice: row.salePrice,
            type: 'stock',
            createdAt: Timestamp.now()
          };
          
          // If power inventory was set up for this row, include that data
          if (row.powerInventorySetup && row.powerInventoryData) {
            lensData = {
              ...lensData,
              inventoryType: 'individual',
              powerInventory: row.powerInventoryData.powerInventory,
              powerLimits: row.powerInventoryData.powerLimits,
              totalQuantity: row.powerInventoryData.totalQuantity,
              // Add new fields for bifocal/progressive lenses
              lensType: row.powerInventoryData.lensType || 'single',
              ...(row.powerInventoryData.lensType === 'bifocal' && {
                axis: row.powerInventoryData.axis || 0
              })
            };
          } else {
            // Default to simple quantity
            lensData.qty = parseFloat(row.qty) || 1;
          }
          
          // Add document to Firestore
          const docRef = await addDoc(getUserCollection('lensInventory'), lensData);
          addedLenses.push({ id: docRef.id, ...lensData });
        }
        
        // Call the onSubmit callback with the added lenses
        if (onSubmit) onSubmit(addedLenses);
      }
      
    } catch (error) {
      console.error('Error adding/updating stock lenses to inventory:', error);
      setError(`Failed to process stock lenses: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={sectionClassName}>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        {editMode ? 'Edit Stock Lens' : 'Add Stock Lenses in Batch'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-sky-800 dark:text-sky-300">Stock Lens Details</h3>
            {!editMode && (
              <button
                type="button"
                onClick={addStockLensRow}
                className="flex items-center text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/50 dark:hover:bg-sky-900/70 px-3 py-1 rounded-md"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Row
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto shadow border-b border-gray-200 dark:border-gray-600 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SL No</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Lens Brand Name</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">Max SPH</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">Max CYL</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">AXIS</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">Max ADD</th>
                  <th scope="col" className="px-2 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">Setup</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-20">QTY (Pairs)</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Purchase Price</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sale Price</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {stockLensRows.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-2 py-2 whitespace-nowrap text-left text-sm text-gray-900 dark:text-gray-100">
                      {row.id}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.brandName}
                        onChange={(e) => handleStockLensChange(index, 'brandName', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="Brand Name"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap w-20">
                      <input
                        type="number"
                        value={row.maxSph}
                        onChange={(e) => handleStockLensChange(index, 'maxSph', e.target.value)}
                        className={inputClassName + " text-xs w-full"}
                        placeholder="-6.00"
                        step="0.25"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap w-20">
                      <input
                        type="number"
                        value={row.maxCyl}
                        onChange={(e) => handleStockLensChange(index, 'maxCyl', e.target.value)}
                        className={inputClassName + " text-xs w-full"}
                        placeholder="-2.00"
                        step="0.25"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap w-20">
                      <input
                        type="number"
                        value={row.axis}
                        onChange={(e) => handleStockLensChange(index, 'axis', e.target.value)}
                        className={inputClassName + " text-xs w-full"}
                        placeholder="0"
                        step="1"
                        min="0"
                        max="180"
                        title="AXIS in degrees (0° to 180°, default is 0°)"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap w-20">
                      <input
                        type="number"
                        value={row.maxAdd}
                        onChange={(e) => handleStockLensChange(index, 'maxAdd', e.target.value)}
                        className={inputClassName + " text-xs w-full"}
                        placeholder="Leave blank for single vision"
                        step="0.25"
                        min="0"
                        max="5"
                        title="Maximum addition power for bifocal/progressive lenses (leave blank for single vision)"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap w-24 text-center">
                      <button
                        type="button"
                        onClick={() => handleSetupPowerInventory(index)}
                        disabled={!row.brandName || !row.maxSph || !row.maxCyl}
                        className={`text-xs px-2 py-1 rounded text-center ${
                          row.powerInventorySetup 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-700' 
                            : 'bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/50 dark:hover:bg-sky-900/70 text-sky-600 dark:text-sky-400 border-sky-200 dark:border-sky-700'
                        } border disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {row.powerInventorySetup ? '✅' : '📊'}
                      </button>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap w-20">
                      {row.powerInventorySetup && row.powerInventoryData ? (
                        <input
                          type="number"
                          value={row.powerInventoryData.totalQuantity || 0}
                          readOnly
                          className={inputClassName + " text-xs w-full bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 cursor-not-allowed"}
                          title="Quantity calculated from individual power inventory"
                        />
                      ) : (
                        <input
                          type="number"
                          value={row.qty}
                          onChange={(e) => handleStockLensChange(index, 'qty', e.target.value)}
                          className={inputClassName + " text-xs w-full"}
                          placeholder="1"
                          min="1"
                          step="1"
                        />
                      )}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        value={row.purchasePrice}
                        onChange={(e) => handleStockLensChange(index, 'purchasePrice', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        value={row.salePrice}
                        onChange={(e) => handleStockLensChange(index, 'salePrice', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => removeStockLensRow(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        disabled={stockLensRows.length <= 1}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
                {stockLensRows.length === 0 && (
                  <tr>
                    <td colSpan="11" className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                      No stock lenses added yet. Click the "Add Row" button to add stock lens details.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 dark:border-red-500 p-3 rounded-r text-sm">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-2">
                <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2 bg-gray-500 hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-700 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-gray-500 dark:focus:ring-gray-400 disabled:opacity-50 transition-colors shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 dark:bg-emerald-500 dark:hover:bg-emerald-600 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-emerald-500 dark:focus:ring-emerald-400 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? (
              <span className="flex items-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {editMode ? 'Updating...' : 'Adding...'}
              </span>
            ) : (
              editMode ? 'Update Stock Lens' : 'Add to Inventory'
            )}
          </button>
        </div>
      </form>
      
      {/* PowerInventoryModal */}
      {showPowerInventoryModal && (
        <PowerInventoryModal
          isOpen={showPowerInventoryModal}
          onClose={handlePowerInventoryModalClose}
          onSave={handlePowerInventoryModalSave}
          lensData={pendingStockLens}
          isEdit={false}
          existingInventory={null}
        />
      )}
    </div>
  );
};

export default AddStockLensForm; 
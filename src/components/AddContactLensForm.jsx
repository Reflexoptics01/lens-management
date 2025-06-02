import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, Timestamp } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';

const CONTACT_CATEGORIES = ['Toric', 'Non-Toric'];
const CONTACT_TYPES = ['Clear', 'Color'];
const COLOR_OPTIONS = ['Blue', 'Green', 'Brown', 'Gray', 'Hazel', 'Violet', 'Other'];
const DISPOSAL_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Yearly'];

const AddContactLensForm = ({ editMode = false, lensToEdit = null, onSubmit, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showColorOptions, setShowColorOptions] = useState(false);
  
  // Array of contact lens rows for batch adding
  const [contactLensRows, setContactLensRows] = useState(
    Array(10).fill().map((_, index) => ({
      id: index + 1,
      brandName: '',
      powerSeries: '',
      category: '',
      contactType: '',
      color: '',
      disposalFrequency: '',
      purchasePrice: '',
      salePrice: '',
      qty: 1
    }))
  );
  
  // Styling constants
  const inputClassName = "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm py-1.5 px-2 text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const selectClassName = "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm py-1.5 px-2";
  const labelClassName = "block uppercase tracking-wide text-xs font-bold text-sky-700 dark:text-sky-300 mb-1";
  const sectionClassName = "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6";
  
  useEffect(() => {
    // If editing a lens, populate the form with a single row
    if (editMode && lensToEdit) {
      const contactLensData = {
        id: 1,
        brandName: lensToEdit.brandName || '',
        powerSeries: lensToEdit.powerSeries || '',
        category: lensToEdit.category || '',
        contactType: lensToEdit.contactType || '',
        color: lensToEdit.color || '',
        disposalFrequency: lensToEdit.disposalFrequency || '',
        purchasePrice: lensToEdit.purchasePrice || '',
        salePrice: lensToEdit.salePrice || '',
        qty: parseFloat(lensToEdit.qty) || 1
      };
      
      setContactLensRows([contactLensData]);
      setShowColorOptions(lensToEdit.contactType === 'Color');
    }
  }, [editMode, lensToEdit]);
  
  useEffect(() => {
    // Show color options only when contact type is Color
    contactLensRows.forEach(row => {
      if (row.contactType === 'Color') {
        setShowColorOptions(true);
      }
    });
  }, [contactLensRows]);
  
  const handleContactLensChange = (index, field, value) => {
    const updatedRows = [...contactLensRows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };
    
    // If contact type changes to/from Color, handle color field
    if (field === 'contactType') {
      if (value === 'Color') {
        setShowColorOptions(true);
      } else {
        updatedRows[index].color = '';
        // Only set showColorOptions false if no other rows have Color type
        const hasColorType = updatedRows.some(row => row.contactType === 'Color');
        if (!hasColorType) {
          setShowColorOptions(false);
        }
      }
    }
    
    setContactLensRows(updatedRows);
  };
  
  const addContactLensRow = () => {
    setContactLensRows([
      ...contactLensRows, 
      {
        id: contactLensRows.length + 1,
        brandName: '',
        powerSeries: '',
        category: '',
        contactType: '',
        color: '',
        disposalFrequency: '',
        purchasePrice: '',
        salePrice: '',
        qty: 1
      }
    ]);
  };
  
  const removeContactLensRow = (index) => {
    if (contactLensRows.length <= 1) return;
    const updatedRows = contactLensRows.filter((_, i) => i !== index);
    // Reassign IDs to maintain sequence
    const reindexedRows = updatedRows.map((row, i) => ({
      ...row,
      id: i + 1
    }));
    setContactLensRows(reindexedRows);
    
    // Update showColorOptions state based on remaining rows
    const hasColorType = reindexedRows.some(row => row.contactType === 'Color');
    setShowColorOptions(hasColorType);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      // Filter out empty rows (no brand name)
      const validRows = contactLensRows.filter(row => row.brandName && row.brandName.trim() !== '');
      
      if (validRows.length === 0) {
        setError('Please add at least one contact lens detail.');
        setLoading(false);
        return;
      }
      
      if (editMode && lensToEdit) {
        // Edit existing contact lens - only the first row is used
        const row = validRows[0];
        const lensData = {
          brandName: row.brandName,
          powerSeries: row.powerSeries,
          category: row.category,
          contactType: row.contactType,
          color: row.color,
          disposalFrequency: row.disposalFrequency,
          purchasePrice: row.purchasePrice,
          salePrice: row.salePrice,
          qty: parseFloat(row.qty) || 1,
          type: 'contact',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(getUserDoc('lensInventory', lensToEdit.id), lensData);
        console.log("Updated contact lens:", lensData);
        
        // Call the onSubmit callback
        if (onSubmit) onSubmit();
      } else {
        // Add new contact lenses
        const addedLenses = [];
        
        // For each valid contact lens row, create a lens in inventory
        for (const row of validRows) {
          const lensData = {
            brandName: row.brandName,
            powerSeries: row.powerSeries,
            category: row.category,
            contactType: row.contactType,
            color: row.color,
            disposalFrequency: row.disposalFrequency,
            purchasePrice: row.purchasePrice,
            salePrice: row.salePrice,
            qty: parseFloat(row.qty) || 1,
            type: 'contact',
            createdAt: Timestamp.now()
          };
          
          // Add document to Firestore
          const docRef = await addDoc(getUserCollection('lensInventory'), lensData);
          addedLenses.push({ id: docRef.id, ...lensData });
        }
        
        // Call the onSubmit callback with the added lenses
        if (onSubmit) onSubmit(addedLenses);
      }
      
    } catch (error) {
      console.error('Error adding/updating contact lenses to inventory:', error);
      setError(`Failed to process contact lenses: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={sectionClassName}>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        {editMode ? 'Edit Contact Lens' : 'Add Contact Lenses in Batch'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-sky-800 dark:text-sky-300">Contact Lens Details</h3>
            {!editMode && (
              <button
                type="button"
                onClick={addContactLensRow}
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
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SL No</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Brand Name</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Power Series</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Category</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                  {showColorOptions && (
                    <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Color</th>
                  )}
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Disposal Frequency</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Purchase ₹</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sale ₹</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">QTY (Pairs)</th>
                  <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {contactLensRows.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-2 py-2 whitespace-nowrap text-left text-sm text-gray-900 dark:text-gray-100">
                      {row.id}
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.brandName}
                        onChange={(e) => handleContactLensChange(index, 'brandName', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="Brand Name"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.powerSeries}
                        onChange={(e) => handleContactLensChange(index, 'powerSeries', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="e.g. -1.00 to -6.00"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <select
                        value={row.category}
                        onChange={(e) => handleContactLensChange(index, 'category', e.target.value)}
                        className={selectClassName + " text-xs"}
                      >
                        <option value="">Select Category</option>
                        {CONTACT_CATEGORIES.map(category => (
                          <option key={category} value={category}>{category}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <select
                        value={row.contactType}
                        onChange={(e) => handleContactLensChange(index, 'contactType', e.target.value)}
                        className={selectClassName + " text-xs"}
                      >
                        <option value="">Select Type</option>
                        {CONTACT_TYPES.map(type => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                    </td>
                    {showColorOptions && (
                      <td className="px-2 py-2 whitespace-nowrap">
                        <select
                          value={row.color}
                          onChange={(e) => handleContactLensChange(index, 'color', e.target.value)}
                          disabled={row.contactType !== 'Color'}
                          className={selectClassName + " text-xs"}
                        >
                          <option value="">Select Color</option>
                          {COLOR_OPTIONS.map(color => (
                            <option key={color} value={color}>{color}</option>
                          ))}
                        </select>
                      </td>
                    )}
                    <td className="px-2 py-2 whitespace-nowrap">
                      <select
                        value={row.disposalFrequency}
                        onChange={(e) => handleContactLensChange(index, 'disposalFrequency', e.target.value)}
                        className={selectClassName + " text-xs"}
                      >
                        <option value="">Select Frequency</option>
                        {DISPOSAL_FREQUENCIES.map(frequency => (
                          <option key={frequency} value={frequency}>{frequency}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        value={row.purchasePrice}
                        onChange={(e) => handleContactLensChange(index, 'purchasePrice', e.target.value)}
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
                        onChange={(e) => handleContactLensChange(index, 'salePrice', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) => handleContactLensChange(index, 'qty', parseFloat(e.target.value))}
                        min="0.5"
                        step="0.5"
                        className={inputClassName + " text-xs"}
                        placeholder="1"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => removeContactLensRow(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        disabled={contactLensRows.length <= 1}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                ))}
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
            className="px-5 py-2 bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-purple-500 dark:focus:ring-purple-400 disabled:opacity-50 transition-colors shadow-sm"
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
              editMode ? 'Update Contact Lens' : 'Add to Inventory'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddContactLensForm; 
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, doc, updateDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';

// Constants from OrderForm.jsx
const MATERIALS = ['CR', 'POLY', 'GLASS', 'POLARISED', 'TRIVEX', 'MR8'];

const INDEX_BY_MATERIAL = {
  'CR': ['1.50', '1.56', '1.60', '1.67', '1.74'],
  'POLARISED': ['1.50', '1.56', '1.60', '1.67', '1.74'],
  'GLASS': ['1.52', '1.70', '1.80', '1.90'],
  'TRIVEX': ['1.53'],
  'MR8': ['1.60'],
  'POLY': ['1.59']
};

const LENS_TYPES = [
  'SINGLE VISION',
  'ROUND TOP (KT)',
  'PROGRESSIVE',
  'DIGITAL PROGRESSIVE',
  'FREEFORM PROGRESSIVE',
  'FLAT TOP (D)',
  'EXECUTIVE BIFOCAL',
  'DIGITAL BIFOCAL'
];

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
  qty: 1,
  purchasePrice: '',
  salePrice: ''
};

const AddLensForm = ({ editMode = false, lensToEdit = null, onSubmit, onCancel }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCoatingColors, setShowCoatingColors] = useState(false);
  
  // Lens specifications (common for all prescriptions)
  const [lensSpecifications, setLensSpecifications] = useState({
    material: '',
    index: '',
    baseTint: '',
    coatingType: '',
    coatingColor: '',
    diameter: '',
    notes: '',
    location: 'Main Cabinet',
    lensType: '',
  });
  
  // Array of prescription rows
  const [prescriptionRows, setPrescriptionRows] = useState(
    Array(6).fill().map(() => ({...EMPTY_PRESCRIPTION_ROW}))
  );
  
  // Styling constants
  const inputClassName = "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm py-1.5 px-2 text-left [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";
  const selectClassName = "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm py-1.5 px-2";
  const labelClassName = "block uppercase tracking-wide text-xs font-bold text-sky-700 dark:text-sky-300 mb-1";
  const sectionClassName = "bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6";
  
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
  
  useEffect(() => {
    // If editing a lens, populate the form
    if (editMode && lensToEdit) {
      setLensSpecifications({
        material: lensToEdit.material || '',
        index: lensToEdit.index || '',
        baseTint: lensToEdit.baseTint || '',
        coatingType: lensToEdit.coatingType || '',
        coatingColor: lensToEdit.coatingColor || '',
        diameter: lensToEdit.diameter || '',
        notes: lensToEdit.notes || '',
        location: lensToEdit.location || 'Main Cabinet',
        lensType: lensToEdit.lensType || '',
      });
      
      // Create a single prescription row with the lens data
      const prescriptionRow = {
        brandName: lensToEdit.brandName || '',
        eye: lensToEdit.eye === 'both' ? 'RL' : (lensToEdit.eye === 'right' ? 'R' : 'L'),
        sph: lensToEdit.sph || '',
        cyl: lensToEdit.cyl || '',
        axis: lensToEdit.axis || '',
        add: lensToEdit.add || '',
        qty: parseFloat(lensToEdit.qty) || 1,
        purchasePrice: lensToEdit.purchasePrice || '',
        salePrice: lensToEdit.salePrice || ''
      };
      
      setPrescriptionRows([prescriptionRow]);
    }
  }, [editMode, lensToEdit]);
  
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
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setLoading(true);
      setError('');
      
      // Filter out empty rows (no SPH value)
      const validRows = prescriptionRows.filter(row => row.sph && row.sph.trim() !== '');
      
      if (validRows.length === 0) {
        setError('Please add at least one prescription detail.');
        setLoading(false);
        return;
      }
      
      if (editMode && lensToEdit) {
        // Edit existing lens - only the first row is used
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
          purchasePrice: row.purchasePrice || 0,
          salePrice: row.salePrice || 0,
          type: 'prescription',
          updatedAt: Timestamp.now()
        };
        
        await updateDoc(getUserDoc('lensInventory', lensToEdit.id), lensData);
        
        // Call the onSubmit callback
        if (onSubmit) onSubmit();
      } else {
        // Add new lenses
        // For each valid prescription row, create a lens in inventory
        const addedLenses = [];
        
        for (const row of validRows) {
          const lensData = {
            ...lensSpecifications,
            eye: row.eye === 'RL' ? 'both' : row.eye.toLowerCase(),
            sph: row.sph,
            cyl: row.cyl || '',
            axis: row.axis || '',
            add: row.add || '',
            qty: row.qty || 1,
            brandName: row.brandName || '',
            purchasePrice: row.purchasePrice || 0,
            salePrice: row.salePrice || 0,
            type: 'prescription',
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
      console.error('Error adding/updating lenses to inventory:', error);
      setError(`Failed to process lenses: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className={sectionClassName}>
      <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">
        {editMode ? 'Edit Prescription Lens' : 'Add New RX Lenses to Inventory'}
      </h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Lens Specifications Section */}
        <div className="border-b border-gray-200 dark:border-gray-600 pb-4">
          <h3 className="text-md font-semibold text-sky-800 dark:text-sky-300 mb-4">Lens Specifications</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClassName}>Material</label>
              <select
                name="material"
                value={lensSpecifications.material}
                onChange={handleMaterialChange}
                className={selectClassName}
                required
              >
                <option value="">Select Material</option>
                {MATERIALS.map(material => (
                  <option key={material} value={material}>{material}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className={labelClassName}>Index</label>
              <select
                name="index"
                value={lensSpecifications.index}
                onChange={handleSpecificationChange}
                className={selectClassName}
                disabled={!lensSpecifications.material}
              >
                <option value="">Select Index</option>
                {lensSpecifications.material && INDEX_BY_MATERIAL[lensSpecifications.material]?.map(index => (
                  <option key={index} value={index}>{index}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className={labelClassName}>Lens Type</label>
              <select
                name="lensType"
                value={lensSpecifications.lensType}
                onChange={handleSpecificationChange}
                className={selectClassName}
              >
                <option value="">Select Lens Type</option>
                {LENS_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className={labelClassName}>Diameter</label>
              <div className="relative">
                <input
                  type="text"
                  name="diameter"
                  value={lensSpecifications.diameter}
                  onChange={handleSpecificationChange}
                  className={inputClassName}
                  placeholder="70"
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 text-xs">mm</span>
              </div>
            </div>
          
            <div>
              <label className={labelClassName}>Base Tint</label>
              <select
                name="baseTint"
                value={lensSpecifications.baseTint}
                onChange={handleSpecificationChange}
                className={selectClassName}
              >
                <option value="">Select Base Tint</option>
                {BASE_TINTS.map(tint => (
                  <option key={tint} value={tint}>{tint}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className={labelClassName}>Coating Type</label>
              <select
                name="coatingType"
                value={lensSpecifications.coatingType}
                onChange={handleSpecificationChange}
                className={selectClassName}
              >
                <option value="">Select Coating Type</option>
                {COATING_TYPES.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {showCoatingColors && (
              <div>
                <label className={labelClassName}>Coating Color</label>
                <select
                  name="coatingColor"
                  value={lensSpecifications.coatingColor}
                  onChange={handleSpecificationChange}
                  className={selectClassName}
                >
                  <option value="">Select Coating Color</option>
                  {COATING_COLORS[lensSpecifications.coatingType]?.map(color => (
                    <option key={color} value={color}>{color}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div>
              <label className={labelClassName}>Storage Location</label>
              <input
                type="text"
                name="location"
                value={lensSpecifications.location}
                onChange={handleSpecificationChange}
                className={inputClassName}
                placeholder="Drawer 2, Box B"
              />
            </div>
            
            <div>
              <label className={labelClassName}>Notes</label>
              <input
                type="text"
                name="notes"
                value={lensSpecifications.notes}
                onChange={handleSpecificationChange}
                className={inputClassName}
                placeholder="Any additional details"
              />
            </div>
          </div>
        </div>
        
        {/* Prescription Details Table */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-md font-semibold text-sky-800 dark:text-sky-300">Prescription Details</h3>
            <button
              type="button"
              onClick={addPrescriptionRow}
              className="flex items-center text-sm text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 bg-sky-50 hover:bg-sky-100 dark:bg-sky-900/50 dark:hover:bg-sky-900/70 px-3 py-1 rounded-md"
            >
              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Row
            </button>
          </div>
          
          <div className="overflow-x-auto shadow border-b border-gray-200 dark:border-gray-600 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Brand</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Eye</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">SPH</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">CYL</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">AXIS</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ADD</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">QTY (Pairs)</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Purchase ₹</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Sale ₹</th>
                  <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
                {prescriptionRows.map((row, index) => (
                  <tr key={index} className={index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.brandName}
                        onChange={(e) => handlePrescriptionChange(index, 'brandName', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="Brand"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <select
                        value={row.eye}
                        onChange={(e) => handlePrescriptionChange(index, 'eye', e.target.value)}
                        className={selectClassName + " text-xs"}
                      >
                        <option value="R">Right</option>
                        <option value="L">Left</option>
                        <option value="RL">Both</option>
                      </select>
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.sph}
                        onChange={(e) => handlePrescriptionChange(index, 'sph', e.target.value)}
                        onBlur={(e) => handlePrescriptionBlur(index, 'sph', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="+/-0.00"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.cyl}
                        onChange={(e) => handlePrescriptionChange(index, 'cyl', e.target.value)}
                        onBlur={(e) => handlePrescriptionBlur(index, 'cyl', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="+/-0.00"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        value={row.axis}
                        onChange={(e) => handlePrescriptionChange(index, 'axis', e.target.value)}
                        onBlur={(e) => handlePrescriptionBlur(index, 'axis', e.target.value)}
                        min="0"
                        max="180"
                        className={inputClassName + " text-xs"}
                        placeholder="0-180"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="text"
                        value={row.add}
                        onChange={(e) => handlePrescriptionChange(index, 'add', e.target.value)}
                        onBlur={(e) => handlePrescriptionBlur(index, 'add', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="+0.00"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        value={row.qty}
                        onChange={(e) => handlePrescriptionChange(index, 'qty', parseFloat(e.target.value))}
                        min="0.5"
                        step="0.5"
                        className={inputClassName + " text-xs"}
                        placeholder="1"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <input
                        type="number"
                        value={row.purchasePrice}
                        onChange={(e) => handlePrescriptionChange(index, 'purchasePrice', e.target.value)}
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
                        onChange={(e) => handlePrescriptionChange(index, 'salePrice', e.target.value)}
                        className={inputClassName + " text-xs"}
                        placeholder="0.00"
                        min="0"
                        step="0.01"
                      />
                    </td>
                    <td className="px-2 py-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => removePrescriptionRow(index)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                        disabled={prescriptionRows.length <= 1}
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
            className="px-5 py-2 bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 text-white font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 dark:focus:ring-sky-400 disabled:opacity-50 transition-colors shadow-sm"
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
              editMode ? 'Update Lens' : 'Add to Inventory'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddLensForm; 
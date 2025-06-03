import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LensPrescription = ({ formData, onChange, matchingLenses = [], shopMatchingLenses = [], shopLoading = false }) => {
  const navigate = useNavigate();
  const [selectedEye, setSelectedEye] = useState('BE'); // RE, LE, or BE
  const inputClassName = "block w-full rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm py-1.5 px-2 text-center";
  const labelClassName = "block uppercase tracking-wide text-xs font-bold text-sky-700 dark:text-sky-300 mb-1";

  // For handling raw input values before formatting
  const [rawInputs, setRawInputs] = useState({
    rightSph: '',
    rightCyl: '',
    rightAxis: '',
    rightAdd: '',
    leftSph: '',
    leftCyl: '',
    leftAxis: '',
    leftAdd: ''
  });

  // Initialize raw inputs from formData on first render
  React.useEffect(() => {
    setRawInputs({
      rightSph: formData.rightSph || '',
      rightCyl: formData.rightCyl || '',
      rightAxis: formData.rightAxis || '',
      rightAdd: formData.rightAdd || '',
      leftSph: formData.leftSph || '',
      leftCyl: formData.leftCyl || '',
      leftAxis: formData.leftAxis || '',
      leftAdd: formData.leftAdd || ''
    });
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    
    // Store the raw input value first
    setRawInputs(prev => ({
      ...prev,
      [name]: value
    }));

    // Only format when user finishes typing (on blur)
    // Let the raw value pass through onChange
    onChange({ target: { name, value } });
  };

  const handleInputBlur = (e) => {
    const { name, value } = e.target;
    
    if (value === '' || value === '-') {
      // Don't format empty values or just a minus sign
      return;
    }

    let formattedValue = value;

    // Format based on input type
    if (name.includes('Sph') || name.includes('Cyl') || name.includes('Add')) {
      // Format to 2 decimal places for SPH, CYL, and ADD
      const numValue = parseFloat(value);
      if (!isNaN(numValue)) {
        formattedValue = numValue.toFixed(2);
        // Update the raw input with formatted value for display consistency
        setRawInputs(prev => ({
          ...prev,
          [name]: formattedValue
        }));
        onChange({ target: { name, value: formattedValue } });
      }
    } else if (name.includes('Axis')) {
      // Format as whole number for Axis
      const numValue = parseInt(value);
      if (!isNaN(numValue)) {
        formattedValue = numValue.toString();
        // Update the raw input with formatted value for display consistency
        setRawInputs(prev => ({
          ...prev,
          [name]: formattedValue
        }));
        onChange({ target: { name, value: formattedValue } });
      }
    }
  };

  const getDisplayValue = (name) => {
    // Return the raw input value while typing, but show placeholder if empty
    const rawValue = rawInputs[name];
    if (rawValue === '' || rawValue === undefined) {
      // Return empty string so placeholder will show
      return '';
    }
    return rawValue;
  };

  // Lens transposition function
  const transposeLens = (eye) => {
    // Get the current values
    const prefix = eye === 'right' ? 'right' : 'left';
    const sphValue = parseFloat(formData[`${prefix}Sph`] || '0.00');
    const cylValue = parseFloat(formData[`${prefix}Cyl`] || '0.00');
    const axisValue = parseInt(formData[`${prefix}Axis`] || '0');

    if (isNaN(sphValue) || isNaN(cylValue) || isNaN(axisValue)) {
      return; // Don't transpose if values are not valid numbers
    }

    // Calculate new transposed values
    // 1. Add CYL to SPH
    const newSph = (sphValue + cylValue).toFixed(2);
    
    // 2. Flip the sign of CYL
    const newCyl = (-cylValue).toFixed(2);
    
    // 3. Add 90 to AXIS (or subtract 90 if it would exceed 180)
    let newAxis = axisValue + 90;
    if (newAxis > 180) {
      newAxis = newAxis - 180;
    }

    // Update the form values
    onChange({ target: { name: `${prefix}Sph`, value: newSph } });
    onChange({ target: { name: `${prefix}Cyl`, value: newCyl } });
    onChange({ target: { name: `${prefix}Axis`, value: newAxis.toString() } });

    // Update raw inputs for display
    setRawInputs(prev => ({
      ...prev,
      [`${prefix}Sph`]: newSph,
      [`${prefix}Cyl`]: newCyl,
      [`${prefix}Axis`]: newAxis.toString()
    }));
  };

  const navigateToLensDetail = (lensId) => {
    navigate(`/lens-inventory/${lensId}`);
  };

  const handleSearchInShop = () => {
    // Prepare prescription data for shop search
    const prescriptionData = {
      rightSph: formData.rightSph,
      rightCyl: formData.rightCyl,
      rightAxis: formData.rightAxis,
      rightAdd: formData.rightAdd,
      leftSph: formData.leftSph,
      leftCyl: formData.leftCyl,
      leftAxis: formData.leftAxis,
      leftAdd: formData.leftAdd
    };
    
    // Navigate to shop with prescription data
    navigate('/shop', { 
      state: { 
        autoSearch: true, 
        prescriptionData: prescriptionData 
      } 
    });
  };

  // Helper function to get class name for lens value comparison
  const getLensValueClassName = (lensValue, prescriptionValue, isAxis = false) => {
    if (!lensValue || !prescriptionValue) return '';
    
    try {
      if (isAxis) {
        const axisDiff = Math.abs(parseInt(lensValue) - parseInt(prescriptionValue));
        const normalizedDiff = Math.min(axisDiff, 180 - axisDiff);
        
        if (normalizedDiff === 0) return 'font-semibold text-green-600';
        if (normalizedDiff <= 5) return 'font-medium text-emerald-600';
        if (normalizedDiff <= 10) return 'text-yellow-600';
        return 'text-orange-500';
      } else {
        const diff = Math.abs(parseFloat(lensValue) - parseFloat(prescriptionValue));
        
        if (diff === 0) return 'font-semibold text-green-600';
        if (diff <= 0.125) return 'font-medium text-emerald-600';
        if (diff <= 0.25) return 'text-yellow-600';
        return 'text-orange-500';
      }
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <div className="inline-flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => setSelectedEye('RE')}
            className={`px-3 py-1 text-xs font-medium rounded-l-md transition-colors ${
              selectedEye === 'RE' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 border'
            }`}
          >
            Right Eye
          </button>
          <button
            type="button"
            onClick={() => setSelectedEye('LE')}
            className={`px-3 py-1 text-xs font-medium transition-colors ${
              selectedEye === 'LE' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 border-t border-b'
            }`}
          >
            Left Eye
          </button>
          <button
            type="button"
            onClick={() => setSelectedEye('BE')}
            className={`px-3 py-1 text-xs font-medium rounded-r-md transition-colors ${
              selectedEye === 'BE' ? 'bg-sky-600 text-white' : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 border-gray-300 dark:border-gray-600 border'
            }`}
          >
            Both Eyes
          </button>
        </div>
      </div>

      {/* Right Eye */}
      {(selectedEye === 'RE' || selectedEye === 'BE') && (
        <div className="space-y-2">
          {selectedEye === 'BE' && (
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-sky-800 dark:text-sky-200">Right Eye</h4>
              <button
                type="button"
                onClick={() => transposeLens('right')}
                className="px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Transpose
              </button>
            </div>
          )}
          {selectedEye === 'RE' && (
            <div className="flex justify-between items-center">
              <div className="flex-1"></div>
              <button
                type="button"
                onClick={() => transposeLens('right')}
                className="px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Transpose
              </button>
            </div>
          )}
          <div className="grid grid-cols-5 gap-2">
            <div>
              <label className={labelClassName}>SPH</label>
              <input
                type="text"
                name="rightSph"
                value={getDisplayValue('rightSph')}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="+/-0.00"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>CYL</label>
              <input
                type="text"
                name="rightCyl"
                value={getDisplayValue('rightCyl')}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="+/-0.00"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>AXIS</label>
              <input
                type="number"
                name="rightAxis"
                value={getDisplayValue('rightAxis')}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                min="0"
                max="180"
                placeholder="0-180"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>ADD</label>
              <input
                type="text"
                name="rightAdd"
                value={getDisplayValue('rightAdd')}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="+0.00"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>QTY</label>
              <div className="relative">
                <input
                  type="number"
                  name="rightQty"
                  value={formData.rightQty || '1'}
                  onChange={handleInputChange}
                  min="1"
                  className={inputClassName}
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">pcs</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left Eye */}
      {(selectedEye === 'LE' || selectedEye === 'BE') && (
        <div className="space-y-2">
          {selectedEye === 'BE' && (
            <div className="flex justify-between items-center">
              <h4 className="text-sm font-semibold text-sky-800 dark:text-sky-200">Left Eye</h4>
              <button
                type="button"
                onClick={() => transposeLens('left')}
                className="px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Transpose
              </button>
            </div>
          )}
          {selectedEye === 'LE' && (
            <div className="flex justify-between items-center">
              <div className="flex-1"></div>
              <button
                type="button"
                onClick={() => transposeLens('left')}
                className="px-3 py-1 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300 rounded-md border border-purple-300 dark:border-purple-700 hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
                Transpose
              </button>
            </div>
          )}
          <div className="grid grid-cols-5 gap-2">
            <div>
              <label className={labelClassName}>SPH</label>
              <input
                type="text"
                name="leftSph"
                value={getDisplayValue('leftSph')}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="+/-0.00"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>CYL</label>
              <input
                type="text"
                name="leftCyl"
                value={getDisplayValue('leftCyl')}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="+/-0.00"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>AXIS</label>
              <input
                type="number"
                name="leftAxis"
                value={getDisplayValue('leftAxis')}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                min="0"
                max="180"
                placeholder="0-180"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>ADD</label>
              <input
                type="text"
                name="leftAdd"
                value={getDisplayValue('leftAdd')}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                placeholder="+0.00"
                className={inputClassName}
              />
            </div>
            <div>
              <label className={labelClassName}>QTY</label>
              <div className="relative">
                <input
                  type="number"
                  name="leftQty"
                  value={formData.leftQty || '1'}
                  onChange={handleInputChange}
                  min="1"
                  className={inputClassName}
                />
                <span className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 text-xs">pcs</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Matching Lenses Section */}
      {((matchingLenses && matchingLenses.length > 0) || (shopMatchingLenses && shopMatchingLenses.length > 0)) && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3">
            <h4 className="text-sm font-semibold text-sky-800 dark:text-sky-200 flex items-center mb-2 sm:mb-0">
              <svg className="h-5 w-5 text-sky-500 dark:text-sky-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Available Matching Lenses ({(matchingLenses || []).length + (shopMatchingLenses || []).length})
            </h4>
            
            {/* Search in Reflex Shop Button */}
            {(formData.rightSph || formData.leftSph) && (
              <button
                type="button"
                onClick={handleSearchInShop}
                className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white text-sm font-medium rounded-lg shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all transform hover:scale-105 duration-200"
              >
                <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search in Reflex Shop
                <svg className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            )}
          </div>
          
          <div className="bg-sky-50 dark:bg-sky-900/30 border-l-4 border-sky-300 dark:border-sky-600 p-3 mb-4 text-xs text-sky-700 dark:text-sky-300">
            Lenses are matched with tolerances of ±0.25 for SPH/CYL/ADD and ±10° for AXIS. Click any lens to view details.
          </div>
          
          {/* Local Inventory Matches */}
          {matchingLenses && matchingLenses.length > 0 && (
            <div className="mb-6">
              <h5 className="text-sm font-medium text-green-700 dark:text-green-300 mb-3 flex items-center">
                <svg className="h-4 w-4 text-green-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5a2 2 0 012-2h2a2 2 0 012 2v2H8V5z" />
                </svg>
                Your Inventory ({matchingLenses.length})
              </h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {matchingLenses.map((lens, index) => (
                  <div
                    key={`local-${lens.id}-${index}`}
                    className="relative group bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3 hover:border-sky-300 dark:hover:border-sky-500 hover:shadow-md transition-all duration-200 cursor-pointer"
                    onClick={() => navigateToLensDetail(lens.id)}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h6 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {lens.brandName || 'Unknown Brand'}
                      </h6>
                      <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs rounded-full font-medium">
                        {lens.matchQuality}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-xs mb-2">
                      <div className="text-center bg-gray-50 dark:bg-gray-700 p-1 rounded">
                        <div className="text-gray-500 dark:text-gray-400 font-medium">SPH</div>
                        <div className={getLensValueClassName(lens.sph, lens.matchedEye === 'right' ? formData.rightSph : formData.leftSph)}>
                          {lens.sph || 'N/A'}
                        </div>
                      </div>
                      <div className="text-center bg-gray-50 dark:bg-gray-700 p-1 rounded">
                        <div className="text-gray-500 dark:text-gray-400 font-medium">CYL</div>
                        <div className={getLensValueClassName(lens.cyl, lens.matchedEye === 'right' ? formData.rightCyl : formData.leftCyl)}>
                          {lens.cyl || 'N/A'}
                        </div>
                      </div>
                      <div className="text-center bg-gray-50 dark:bg-gray-700 p-1 rounded">
                        <div className="text-gray-500 dark:text-gray-400 font-medium">AXIS</div>
                        <div className={getLensValueClassName(lens.axis, lens.matchedEye === 'right' ? formData.rightAxis : formData.leftAxis, true)}>
                          {lens.axis || 'N/A'}
                        </div>
                      </div>
                      <div className="text-center bg-gray-50 dark:bg-gray-700 p-1 rounded">
                        <div className="text-gray-500 dark:text-gray-400 font-medium">ADD</div>
                        <div className={getLensValueClassName(lens.add, lens.matchedEye === 'right' ? formData.rightAdd : formData.leftAdd)}>
                          {lens.add || 'N/A'}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                      <span>Eye: {lens.matchedEye === 'right' ? 'Right' : 'Left'}</span>
                      <span>Qty: {lens.qty || 1}</span>
                    </div>

                    <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="h-4 w-4 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Shop Matches */}
          {shopMatchingLenses && shopMatchingLenses.length > 0 && (
            <div className="mb-6">
              <h5 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-3 flex items-center">
                <svg className="h-4 w-4 text-blue-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                Available from Other Shops ({shopMatchingLenses.length})
              </h5>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {shopMatchingLenses.map((lens, index) => (
                  <div
                    key={`shop-${lens.shopId || lens.id}-${index}`}
                    className="relative group bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-600 rounded-lg p-3 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md transition-all duration-200"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h6 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {lens.brandName || 'Unknown Brand'}
                      </h6>
                      <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full font-medium">
                        {lens.matchQuality}%
                      </span>
                    </div>

                    <div className="grid grid-cols-4 gap-1 text-xs mb-2">
                      <div className="text-center bg-gray-50 dark:bg-gray-700 p-1 rounded">
                        <div className="text-gray-500 dark:text-gray-400 font-medium">SPH</div>
                        <div className={getLensValueClassName(lens.sph, lens.matchedEye === 'right' ? formData.rightSph : formData.leftSph)}>
                          {lens.sph || 'N/A'}
                        </div>
                      </div>
                      <div className="text-center bg-gray-50 dark:bg-gray-700 p-1 rounded">
                        <div className="text-gray-500 dark:text-gray-400 font-medium">CYL</div>
                        <div className={getLensValueClassName(lens.cyl, lens.matchedEye === 'right' ? formData.rightCyl : formData.leftCyl)}>
                          {lens.cyl || 'N/A'}
                        </div>
                      </div>
                      <div className="text-center bg-gray-50 dark:bg-gray-700 p-1 rounded">
                        <div className="text-gray-500 dark:text-gray-400 font-medium">AXIS</div>
                        <div className={getLensValueClassName(lens.axis, lens.matchedEye === 'right' ? formData.rightAxis : formData.leftAxis, true)}>
                          {lens.axis || 'N/A'}
                        </div>
                      </div>
                      <div className="text-center bg-gray-50 dark:bg-gray-700 p-1 rounded">
                        <div className="text-gray-500 dark:text-gray-400 font-medium">ADD</div>
                        <div className={getLensValueClassName(lens.add, lens.matchedEye === 'right' ? formData.rightAdd : formData.leftAdd)}>
                          {lens.add || 'N/A'}
                        </div>
                      </div>
                    </div>

                    {/* Shop Contact Information */}
                    {lens.userInfo && (
                      <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                          <div className="flex items-center font-medium">
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                            {lens.userInfo.opticalName || 'Optical Shop'}
                          </div>
                          <div className="flex items-center">
                            <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            {lens.userInfo.city || 'N/A'}
                          </div>
                          {lens.userInfo.phone && (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <svg className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                {lens.userInfo.phone}
                              </div>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const message = `Hi! I found your lens in the marketplace. Do you have this lens available?\n\nLens Details:\nBrand: ${lens.brandName}\nSPH: ${lens.sph} CYL: ${lens.cyl} AXIS: ${lens.axis}\nEye: ${lens.matchedEye}\nQty: ${lens.qty}`;
                                  const whatsappUrl = `https://wa.me/${lens.userInfo.phone.replace(/[^0-9+]/g, '')}?text=${encodeURIComponent(message)}`;
                                  window.open(whatsappUrl, '_blank');
                                }}
                                className="px-2 py-1 bg-green-500 hover:bg-green-600 text-white text-xs rounded flex items-center transition-colors"
                              >
                                <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.787"/>
                                </svg>
                                WhatsApp
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400 mt-2">
                      <span>Eye: {lens.matchedEye === 'right' ? 'Right' : 'Left'}</span>
                      <span>Qty: {lens.qty || 1}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Loading state for shop lenses */}
          {shopLoading && (
            <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-600">
              <div className="flex items-center text-blue-700 dark:text-blue-300">
                <svg className="animate-spin h-4 w-4 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm">Searching for matching lenses from other optical shops...</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search in Reflex Shop Section - Show when prescription is entered but no matches found */}
      {(formData.rightSph || formData.leftSph) && 
       !(matchingLenses && matchingLenses.length > 0) && 
       !(shopMatchingLenses && shopMatchingLenses.length > 0) && 
       !shopLoading && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="flex flex-col items-center justify-center p-6 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="flex items-center mb-4">
              <svg className="h-8 w-8 text-blue-500 dark:text-blue-400 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
                No matching lenses found locally
              </h4>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
              Search our marketplace to find lenses from other verified distributors across the network
            </p>
            
            <button
              type="button"
              onClick={handleSearchInShop}
              className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-medium rounded-lg shadow-lg hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all transform hover:scale-105 duration-200"
            >
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search in Reflex Shop
              <svg className="h-5 w-5 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LensPrescription; 
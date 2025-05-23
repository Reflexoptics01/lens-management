import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LensPrescription = ({ formData, onChange, matchingLenses = [] }) => {
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

  const navigateToLensDetail = (lensId) => {
    navigate(`/lens-inventory/${lensId}`);
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
            <h4 className="text-sm font-semibold text-sky-800 dark:text-sky-200">Right Eye</h4>
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
            <h4 className="text-sm font-semibold text-sky-800 dark:text-sky-200">Left Eye</h4>
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
      {matchingLenses && matchingLenses.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
          <h4 className="text-sm font-semibold text-sky-800 dark:text-sky-200 flex items-center mb-3">
            <svg className="h-5 w-5 text-sky-500 dark:text-sky-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Available Matching Lenses ({matchingLenses.length})
          </h4>
          
          <div className="bg-sky-50 dark:bg-sky-900/30 border-l-4 border-sky-300 dark:border-sky-600 p-3 mb-4 text-xs text-sky-700 dark:text-sky-300">
            Lenses are matched with tolerances of ±0.25 for SPH/CYL/ADD and ±10° for AXIS. Click any lens to view details.
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matchingLenses.map(lens => (
              <div 
                key={lens.id} 
                className="border border-gray-200 dark:border-gray-600 rounded-md p-3 bg-white dark:bg-gray-800 shadow-sm hover:shadow-md hover:border-sky-300 dark:hover:border-sky-500 cursor-pointer transition-all"
                onClick={() => navigateToLensDetail(lens.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-sky-700 dark:text-sky-300">
                      {lens.brandName || 'Unknown Brand'}
                    </span>
                    {lens.matchQuality && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Match quality: 
                        <span className={`ml-1 font-medium ${
                          lens.matchQuality >= 90 ? 'text-green-600 dark:text-green-400' : 
                          lens.matchQuality >= 75 ? 'text-emerald-500 dark:text-emerald-400' : 
                          lens.matchQuality >= 60 ? 'text-yellow-600 dark:text-yellow-400' : 'text-orange-500 dark:text-orange-400'
                        }`}>
                          {lens.matchQuality}%
                        </span>
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    {lens.matchedEye && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        lens.matchedEye === 'right' ? 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-200' : 'bg-pink-100 dark:bg-pink-900/50 text-pink-800 dark:text-pink-200'
                      }`}>
                        {lens.matchedEye === 'right' ? 'Right Eye' : 'Left Eye'}
                      </span>
                    )}
                    <span className="bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 px-2 py-0.5 rounded-full text-xs">
                      {lens.eye === 'right' ? 'Right' : lens.eye === 'left' ? 'Left' : 'Both'}
                    </span>
                  </div>
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

                <div className="flex justify-between items-center text-xs">
                  <div className="flex gap-2 text-gray-500 dark:text-gray-400">
                    <span>{lens.material || 'N/A'}</span>
                    {lens.index && <span>• {lens.index}</span>}
                    {lens.qty && <span>• Qty: {lens.qty}</span>}
                  </div>
                  <div className="flex items-center text-sky-600 dark:text-sky-400 font-medium">
                    View Details 
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default LensPrescription; 
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const LensPrescription = ({ formData, onChange, matchingLenses = [] }) => {
  const navigate = useNavigate();
  const [selectedEye, setSelectedEye] = useState('BE'); // RE, LE, or BE
  const inputClassName = "block w-full rounded-md border-gray-300 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm py-1.5 px-2 text-center";
  const labelClassName = "block uppercase tracking-wide text-xs font-bold text-sky-700 mb-1";

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

  return (
    <div className="space-y-4">
      <div className="flex justify-start">
        <div className="inline-flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={() => setSelectedEye('RE')}
            className={`px-3 py-1 text-xs font-medium rounded-l-md ${
              selectedEye === 'RE' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 border'
            }`}
          >
            Right Eye
          </button>
          <button
            type="button"
            onClick={() => setSelectedEye('LE')}
            className={`px-3 py-1 text-xs font-medium ${
              selectedEye === 'LE' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 border-t border-b'
            }`}
          >
            Left Eye
          </button>
          <button
            type="button"
            onClick={() => setSelectedEye('BE')}
            className={`px-3 py-1 text-xs font-medium rounded-r-md ${
              selectedEye === 'BE' ? 'bg-sky-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50 border-gray-300 border'
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
            <h4 className="text-sm font-semibold text-sky-800">Right Eye</h4>
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
            <h4 className="text-sm font-semibold text-sky-800">Left Eye</h4>
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
        <div className="mt-6 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-semibold text-sky-800 flex items-center mb-3">
            <svg className="h-5 w-5 text-sky-500 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Available Matching Lenses ({matchingLenses.length})
          </h4>
          
          <div className="bg-sky-50 border-l-4 border-sky-300 p-3 mb-4 text-xs text-sky-700">
            Matching lenses found in inventory! Click any lens to view complete details.
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {matchingLenses.map(lens => (
              <div 
                key={lens.id} 
                className="border border-gray-200 rounded-md p-3 bg-white shadow-sm hover:shadow-md hover:border-sky-300 cursor-pointer transition-all"
                onClick={() => navigateToLensDetail(lens.id)}
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-sm font-medium text-sky-700">
                    {lens.brandName || 'Unknown Brand'}
                  </span>
                  <div className="flex gap-1">
                    {lens.matchedEye && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        lens.matchedEye === 'right' ? 'bg-blue-100 text-blue-800' : 'bg-pink-100 text-pink-800'
                      }`}>
                        {lens.matchedEye === 'right' ? 'Right Eye' : 'Left Eye'}
                      </span>
                    )}
                    <span className="bg-gray-100 text-gray-800 px-2 py-0.5 rounded-full text-xs">
                      {lens.eye === 'right' ? 'Right' : lens.eye === 'left' ? 'Left' : 'Both'}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-4 gap-1 text-xs mb-2">
                  <div className="text-center bg-gray-50 p-1 rounded">
                    <div className="text-gray-500 font-medium">SPH</div>
                    <div>{lens.sph || 'N/A'}</div>
                  </div>
                  <div className="text-center bg-gray-50 p-1 rounded">
                    <div className="text-gray-500 font-medium">CYL</div>
                    <div>{lens.cyl || 'N/A'}</div>
                  </div>
                  <div className="text-center bg-gray-50 p-1 rounded">
                    <div className="text-gray-500 font-medium">AXIS</div>
                    <div>{lens.axis || 'N/A'}</div>
                  </div>
                  <div className="text-center bg-gray-50 p-1 rounded">
                    <div className="text-gray-500 font-medium">QTY</div>
                    <div>{lens.qty || '1'}</div>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <div className="text-gray-500">
                    {lens.material || 'N/A'} - {lens.index || 'N/A'}
                  </div>
                  <div className="flex items-center text-sky-600 font-medium">
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
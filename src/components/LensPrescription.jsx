import React, { useState } from 'react';

const LensPrescription = ({ formData, onChange }) => {
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
    </div>
  );
};

export default LensPrescription; 
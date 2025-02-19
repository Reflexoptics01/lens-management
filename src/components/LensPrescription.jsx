import React, { useState } from 'react';

const LensPrescription = ({ formData, onChange }) => {
  const [selectedEye, setSelectedEye] = useState('BE'); // RE, LE, or BE
  const inputClassName = "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1] text-base py-2 px-3";

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    let formattedValue = value;

    // Format based on input type
    if (name.includes('Sph') || name.includes('Cyl')) {
      // Format to 2 decimal places for SPH and CYL
      formattedValue = value === '' ? '' : Number(value).toFixed(2);
    } else if (name.includes('Axis')) {
      // Format as whole number for Axis
      formattedValue = value === '' ? '' : Math.round(Number(value)).toString();
    } else if (name.includes('Add')) {
      // Format to 2 decimal places for Addition
      formattedValue = value === '' ? '' : Number(value).toFixed(2);
    }

    onChange({ target: { name, value: formattedValue } });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex border rounded-full overflow-hidden">
          <button
            type="button"
            onClick={() => setSelectedEye('RE')}
            className={`px-4 py-1.5 text-sm font-medium ${
              selectedEye === 'RE' ? 'bg-[#4169E1] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            RE
          </button>
          <button
            type="button"
            onClick={() => setSelectedEye('LE')}
            className={`px-4 py-1.5 text-sm font-medium border-l border-r ${
              selectedEye === 'LE' ? 'bg-[#4169E1] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            LE
          </button>
          <button
            type="button"
            onClick={() => setSelectedEye('BE')}
            className={`px-4 py-1.5 text-sm font-medium ${
              selectedEye === 'BE' ? 'bg-[#4169E1] text-white' : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            BE
          </button>
        </div>
      </div>

      {/* Right Eye */}
      {(selectedEye === 'RE' || selectedEye === 'BE') && (
        <div className="space-y-4">
          <h4 className="text-base font-medium text-gray-900">Right</h4>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SPH</label>
              <input
                type="number"
                name="rightSph"
                value={formData.rightSph || '0.00'}
                onChange={handleInputChange}
                step="0.25"
                className={`${inputClassName} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CYL</label>
              <input
                type="number"
                name="rightCyl"
                value={formData.rightCyl || '0.00'}
                onChange={handleInputChange}
                step="0.25"
                className={`${inputClassName} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Axis</label>
              <input
                type="number"
                name="rightAxis"
                value={formData.rightAxis || '0'}
                onChange={handleInputChange}
                step="1"
                min="0"
                max="180"
                className={`${inputClassName} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Addition</label>
              <input
                type="number"
                name="rightAdd"
                value={formData.rightAdd || '0.00'}
                onChange={handleInputChange}
                step="0.25"
                className={`${inputClassName} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
              <div className="relative">
                <input
                  type="number"
                  name="rightQty"
                  value={formData.rightQty || '1'}
                  onChange={handleInputChange}
                  min="1"
                  className={`${inputClassName} text-center pr-16`}
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">pieces</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Left Eye */}
      {(selectedEye === 'LE' || selectedEye === 'BE') && (
        <div className="space-y-4">
          <h4 className="text-base font-medium text-gray-900">Left</h4>
          <div className="grid grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SPH</label>
              <input
                type="number"
                name="leftSph"
                value={formData.leftSph || '0.00'}
                onChange={handleInputChange}
                step="0.25"
                className={`${inputClassName} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">CYL</label>
              <input
                type="number"
                name="leftCyl"
                value={formData.leftCyl || '0.00'}
                onChange={handleInputChange}
                step="0.25"
                className={`${inputClassName} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Axis</label>
              <input
                type="number"
                name="leftAxis"
                value={formData.leftAxis || '0'}
                onChange={handleInputChange}
                step="1"
                min="0"
                max="180"
                className={`${inputClassName} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Addition</label>
              <input
                type="number"
                name="leftAdd"
                value={formData.leftAdd || '0.00'}
                onChange={handleInputChange}
                step="0.25"
                className={`${inputClassName} text-center`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qty</label>
              <div className="relative">
                <input
                  type="number"
                  name="leftQty"
                  value={formData.leftQty || '1'}
                  onChange={handleInputChange}
                  min="1"
                  className={`${inputClassName} text-center pr-16`}
                />
                <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm">pieces</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LensPrescription; 
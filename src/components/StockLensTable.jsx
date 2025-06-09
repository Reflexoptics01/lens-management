import React, { useState } from 'react';
import PowerInventoryModal from './PowerInventoryModal';

const StockLensTable = ({ 
  lenses, 
  loading, 
  onEdit, 
  onDelete,
  onUpdateInventory
}) => {
  const [showPowerInventoryModal, setShowPowerInventoryModal] = useState(false);
  const [selectedLens, setSelectedLens] = useState(null);

  const handleViewPowerInventory = (lens) => {
    if (lens.inventoryType === 'individual' && lens.powerInventory) {
      // Calculate power ranges from maxSph and maxCyl
      const maxSphNum = parseFloat(lens.maxSph);
      const maxCylNum = parseFloat(lens.maxCyl);
      const sphMin = maxSphNum < 0 ? maxSphNum : 0;
      const sphMax = maxSphNum < 0 ? 0 : maxSphNum;
      const cylMin = maxCylNum < 0 ? maxCylNum : 0;
      const cylMax = maxCylNum < 0 ? 0 : maxCylNum;
      const powerRange = `SPH: ${sphMin} to ${sphMax}, CYL: ${cylMin} to ${cylMax}`;

      setSelectedLens({
        ...lens,
        powerRange,
        sphMin,
        sphMax,
        cylMin,
        cylMax
      });
      setShowPowerInventoryModal(true);
    }
  };

  const handlePowerInventoryModalClose = () => {
    setShowPowerInventoryModal(false);
    setSelectedLens(null);
  };

  const handlePowerInventoryModalSave = async (inventoryData) => {
    if (onUpdateInventory && selectedLens) {
      await onUpdateInventory(selectedLens.id, inventoryData);
    }
    setShowPowerInventoryModal(false);
    setSelectedLens(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-6">
        <svg className="animate-spin h-6 w-6 text-sky-600 dark:border-sky-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="ml-2 text-sm text-gray-500 dark:text-gray-400">Loading stock lenses...</span>
      </div>
    );
  }

  if (lenses.length === 0) {
    return (
      <div className="border-l-4 border-yellow-400 p-3 sm:p-4 mb-4 rounded-r text-sm bg-yellow-50 dark:bg-yellow-900/50">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-xs sm:text-sm text-yellow-700 dark:text-yellow-200">
              No stock lenses in inventory yet. Add your first stock lens to get started!
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto -mx-3 sm:mx-0 shadow border-b rounded-lg border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y text-xs sm:text-sm divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Brand</th>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Max SPH</th>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Max CYL</th>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Power Range</th>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Inventory</th>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Purchase</th>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Sale</th>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Qty</th>
              <th scope="col" className="px-2 sm:px-3 py-2 sm:py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white dark:bg-gray-800 divide-gray-200 dark:divide-gray-700">
            {lenses.map((lens, index) => (
              <tr key={lens.id} className={`${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'} hover:bg-gray-100 dark:hover:bg-gray-600`}>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white">
                  <a href={`/lens-inventory/${lens.id}`} className="text-sky-600 hover:text-sky-800 hover:underline">
                    {lens.brandName || 'N/A'}
                  </a>
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white text-left">
                  {lens.maxSph || 'N/A'}
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white text-left">
                  {lens.maxCyl || 'N/A'}
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white text-left">
                  {lens.powerSeries || 'N/A'}
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white text-left">
                  {lens.inventoryType === 'individual' ? (
                    <button
                      onClick={() => handleViewPowerInventory(lens)}
                      className="flex items-center text-green-600 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
                      title="View Individual Power Inventory"
                    >
                      <span className="mr-1">📊</span>
                      <span className="text-xs">
                        {lens.lensType === 'bifocal' ? 'Bifocal' : 'Individual'}
                      </span>
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500 dark:text-gray-400">Range Only</span>
                  )}
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white text-left">
                  {lens.purchasePrice ? `₹${parseFloat(lens.purchasePrice).toFixed(2)}` : 'N/A'}
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white text-left">
                  {lens.salePrice ? `₹${parseFloat(lens.salePrice).toFixed(2)}` : 'N/A'}
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm text-gray-900 dark:text-white text-left">
                  {lens.inventoryType === 'individual' && lens.totalQuantity 
                    ? `${lens.totalQuantity} pieces${lens.lensType === 'bifocal' ? ` (Axis: ${lens.axis || 0}°)` : ''}` 
                    : `${parseFloat(lens.qty) || 1} pairs`}
                </td>
                <td className="px-2 sm:px-3 py-2 sm:py-3 whitespace-nowrap text-xs sm:text-sm font-medium text-left">
                  <div className="flex gap-1 sm:gap-2">
                    <button
                      onClick={() => onEdit(lens)}
                      className="text-sky-600 hover:text-sky-900 bg-sky-50 dark:bg-sky-900/50 hover:bg-sky-100 dark:hover:bg-sky-900/70 px-1.5 sm:px-2 py-1 rounded text-xs sm:text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDelete(lens.id)}
                      className="text-red-600 hover:text-red-900 bg-red-50 dark:bg-red-900/50 hover:bg-red-100 dark:hover:bg-red-900/70 px-1.5 sm:px-2 py-1 rounded text-xs sm:text-sm"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* PowerInventoryModal */}
      {showPowerInventoryModal && selectedLens && (
        <PowerInventoryModal
          isOpen={showPowerInventoryModal}
          onClose={handlePowerInventoryModalClose}
          onSave={handlePowerInventoryModalSave}
          lensData={{
            name: selectedLens.brandName,
            powerRange: selectedLens.powerRange,
            sphMin: selectedLens.sphMin,
            sphMax: selectedLens.sphMax,
            cylMin: selectedLens.cylMin,
            cylMax: selectedLens.cylMax,
            purchasePrice: selectedLens.purchasePrice,
            salePrice: selectedLens.salePrice,
            type: selectedLens.lensType || 'single',
            axis: selectedLens.axis || 0
          }}
          isEdit={true}
          existingInventory={selectedLens.powerInventory || null}
        />
      )}
    </>
  );
};

export default StockLensTable; 
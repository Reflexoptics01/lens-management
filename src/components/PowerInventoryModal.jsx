import React, { useState, useEffect } from 'react';

const PowerInventoryModal = ({ 
  isOpen, 
  onClose, 
  onSave, 
  lensData, 
  isEdit = false,
  existingInventory = null 
}) => {
  const [inventoryType, setInventoryType] = useState('range');
  const [powerLimits, setPowerLimits] = useState({
    minSph: -10,
    maxSph: 10,
    minCyl: -6,
    maxCyl: 0,
    axis: 90,
    addition: 3
  });
  const [loading, setLoading] = useState(false);
  
  // Simple spreadsheet data structure
  const [cellData, setCellData] = useState({});
  const [selectedCells, setSelectedCells] = useState(new Set());
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [isSelecting, setIsSelecting] = useState(false);
  const [selectionStart, setSelectionStart] = useState(null);
  const [bulkValue, setBulkValue] = useState('');
  const [blurTimeout, setBlurTimeout] = useState(null);

  // Initialize power limits from lensData if available
  useEffect(() => {
    if (lensData && lensData.sphMin !== undefined && lensData.sphMax !== undefined && 
        lensData.cylMin !== undefined && lensData.cylMax !== undefined) {
      setPowerLimits({
        minSph: lensData.sphMin,
        maxSph: lensData.sphMax,
        minCyl: lensData.cylMin,
        maxCyl: lensData.cylMax,
        axis: 90,
        addition: 3
      });
    }
  }, [lensData]);

  // Generate power arrays
  const generatePowerArray = (min, max, step = 0.25) => {
    const powers = [];
    for (let i = min; i <= max; i += step) {
      powers.push(parseFloat(i.toFixed(2)));
    }
    return powers;
  };

  const sphPowers = generatePowerArray(powerLimits.minSph, powerLimits.maxSph);
  const cylPowers = generatePowerArray(powerLimits.minCyl, powerLimits.maxCyl);

  // Initialize cell data when power limits change
  useEffect(() => {
    if (inventoryType === 'individual') {
      const newCellData = {};
      sphPowers.forEach(sph => {
        cylPowers.forEach(cyl => {
          const key = `${sph}_${cyl}`;
          newCellData[key] = cellData[key] || 0;
        });
      });
      setCellData(newCellData);
    }
  }, [inventoryType, powerLimits]);

  // Simple cell value management
  const getCellValue = (sph, cyl) => {
    const key = `${sph}_${cyl}`;
    return cellData[key] || 0;
  };

  const setCellValue = (sph, cyl, value) => {
    const key = `${sph}_${cyl}`;
    const numValue = parseInt(value) || 0;
    setCellData(prev => ({
      ...prev,
      [key]: numValue
    }));
  };

  // Range selection functionality
  const getCellKey = (sph, cyl) => `${sph}_${cyl}`;

  const selectRange = (startSph, startCyl, endSph, endCyl) => {
    const startSphIdx = sphPowers.indexOf(startSph);
    const endSphIdx = sphPowers.indexOf(endSph);
    const startCylIdx = cylPowers.indexOf(startCyl);
    const endCylIdx = cylPowers.indexOf(endCyl);

    const minSphIdx = Math.min(startSphIdx, endSphIdx);
    const maxSphIdx = Math.max(startSphIdx, endSphIdx);
    const minCylIdx = Math.min(startCylIdx, endCylIdx);
    const maxCylIdx = Math.max(startCylIdx, endCylIdx);

    const newSelected = new Set();
    for (let i = minSphIdx; i <= maxSphIdx; i++) {
      for (let j = minCylIdx; j <= maxCylIdx; j++) {
        newSelected.add(getCellKey(sphPowers[i], cylPowers[j]));
      }
    }
    setSelectedCells(newSelected);
  };

  const handleCellMouseDown = (sph, cyl, e) => {
    // Don't interfere with editing
    if (editingCell) return;
    
    // Don't interfere with double-click
    if (e.detail === 2) return;

    const cellKey = getCellKey(sph, cyl);
    
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+click to toggle selection
      e.preventDefault();
      const newSelected = new Set(selectedCells);
      if (newSelected.has(cellKey)) {
        newSelected.delete(cellKey);
      } else {
        newSelected.add(cellKey);
      }
      setSelectedCells(newSelected);
    } else {
      // Start new selection only if not editing
      e.preventDefault();
      setSelectedCells(new Set([cellKey]));
      setSelectionStart({ sph, cyl });
      setIsSelecting(true);
    }
  };

  const handleCellMouseEnter = (sph, cyl) => {
    if (isSelecting && selectionStart && !editingCell) {
      selectRange(selectionStart.sph, selectionStart.cyl, sph, cyl);
    }
  };

  const handleCellMouseUp = () => {
    setIsSelecting(false);
  };

  // Handle cell editing with better focus management
  const startEdit = (sph, cyl) => {
    // Clear any pending blur timeout
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      setBlurTimeout(null);
    }
    
    const key = getCellKey(sph, cyl);
    setEditingCell(key);
    setSelectedCells(new Set([key]));
    setEditValue(getCellValue(sph, cyl).toString());
    // Clear any ongoing selection
    setIsSelecting(false);
    setSelectionStart(null);
  };

  const finishEdit = () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      setBlurTimeout(null);
    }
    
    if (editingCell) {
      const [sph, cyl] = editingCell.split('_').map(Number);
      setCellValue(sph, cyl, editValue);
    }
    setEditingCell(null);
    setEditValue('');
  };

  const cancelEdit = () => {
    if (blurTimeout) {
      clearTimeout(blurTimeout);
      setBlurTimeout(null);
    }
    
    setEditingCell(null);
    setEditValue('');
  };

  // Enhanced keyboard navigation
  const moveSelection = (direction) => {
    if (editingCell || selectedCells.size !== 1) return;
    
    const currentCell = Array.from(selectedCells)[0];
    const [currentSph, currentCyl] = currentCell.split('_').map(Number);
    const sphIdx = sphPowers.indexOf(currentSph);
    const cylIdx = cylPowers.indexOf(currentCyl);
    
    let newSphIdx = sphIdx;
    let newCylIdx = cylIdx;
    
    switch (direction) {
      case 'up':
        newSphIdx = Math.max(0, sphIdx - 1);
        break;
      case 'down':
        newSphIdx = Math.min(sphPowers.length - 1, sphIdx + 1);
        break;
      case 'left':
        newCylIdx = Math.max(0, cylIdx - 1);
        break;
      case 'right':
        newCylIdx = Math.min(cylPowers.length - 1, cylIdx + 1);
        break;
    }
    
    if (newSphIdx !== sphIdx || newCylIdx !== cylIdx) {
      const newCell = getCellKey(sphPowers[newSphIdx], cylPowers[newCylIdx]);
      setSelectedCells(new Set([newCell]));
    }
  };

  // Bulk operations
  const fillSelectedCells = (value) => {
    const numValue = parseInt(value) || 0;
    selectedCells.forEach(cellKey => {
      const [sph, cyl] = cellKey.split('_').map(Number);
      setCellValue(sph, cyl, numValue);
    });
  };

  const deleteSelectedCells = () => {
    selectedCells.forEach(cellKey => {
      const [sph, cyl] = cellKey.split('_').map(Number);
      setCellValue(sph, cyl, 0);
    });
  };

  const selectAllCells = () => {
    const allCells = new Set();
    sphPowers.forEach(sph => {
      cylPowers.forEach(cyl => {
        allCells.add(getCellKey(sph, cyl));
      });
    });
    setSelectedCells(allCells);
  };

  // Enhanced keyboard navigation
  const handleKeyDown = (e) => {
    if (!selectedCells.size && !editingCell) return;

    // Handle editing mode keys
    if (editingCell) {
      if (e.key === 'Enter') {
        e.preventDefault();
        finishEdit();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        cancelEdit();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        finishEdit();
        // Move to next cell
        if (selectedCells.size === 1) {
          moveSelection(e.shiftKey ? 'left' : 'right');
        }
        return;
      }
      // Let other keys pass through to the input
      return;
    }

    // Handle selection mode keys
    if (e.key === 'Escape') {
      e.preventDefault();
      setSelectedCells(new Set());
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      deleteSelectedCells();
      return;
    }

    if (e.key === 'Enter' || e.key === 'F2') {
      e.preventDefault();
      if (selectedCells.size === 1) {
        const cellKey = Array.from(selectedCells)[0];
        const [sph, cyl] = cellKey.split('_').map(Number);
        startEdit(sph, cyl);
      }
      return;
    }

    // Arrow key navigation
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      const direction = e.key.replace('Arrow', '').toLowerCase();
      moveSelection(direction);
      return;
    }

    // Tab navigation
    if (e.key === 'Tab') {
      e.preventDefault();
      moveSelection(e.shiftKey ? 'left' : 'right');
      return;
    }

    // Ctrl+A to select all
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault();
      selectAllCells();
      return;
    }

    // Direct number input to start editing
    if (/^[0-9]$/.test(e.key) && selectedCells.size === 1) {
      e.preventDefault();
      const cellKey = Array.from(selectedCells)[0];
      const [sph, cyl] = cellKey.split('_').map(Number);
      setEditingCell(cellKey);
      setEditValue(e.key); // Start with the pressed number
      return;
    }
  };

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mouseup', handleCellMouseUp);
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.removeEventListener('mouseup', handleCellMouseUp);
      };
    }
  }, [isOpen, selectedCells, editingCell, editValue, sphPowers, cylPowers]);

  const getTotalQuantity = () => {
    return Object.values(cellData).reduce((sum, value) => sum + (value || 0), 0);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      if (inventoryType === 'range') {
        onSave({
          type: 'range',
          data: lensData
        });
      } else {
        const nonZeroData = Object.entries(cellData)
          .filter(([key, value]) => value > 0)
          .reduce((acc, [key, value]) => {
            const [sph, cyl] = key.split('_').map(Number);
            acc[key] = {
              sph,
              cyl,
              quantity: value,
              ...(lensData?.type === 'bifocal' && {
                axis: powerLimits.axis,
                addition: powerLimits.addition
              })
            };
            return acc;
          }, {});

        if (Object.keys(nonZeroData).length === 0) {
          alert('Please enter at least one quantity greater than 0');
          setLoading(false);
          return;
        }

        onSave({
          type: 'individual',
          data: {
            ...lensData,
            powerInventory: nonZeroData,
            powerLimits: powerLimits,
            totalQuantity: getTotalQuantity()
          }
        });
      }
    } catch (error) {
      console.error('Error saving power inventory:', error);
      alert('Error saving inventory. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-6xl sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white mb-4">
                  📊 Stock Lens Inventory Setup
                </h3>
                
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-700">
                  <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                    {lensData?.name} - {lensData?.type === 'bifocal' ? 'Bifocal' : 'Single Vision'}
                  </h4>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Power Range: {lensData?.powerRange} | Material: {lensData?.material || 'Not specified'}
                  </p>
                </div>

                {/* Inventory Type Selection */}
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    How would you like to maintain inventory for this stock lens?
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="relative flex cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-4 shadow-sm focus:outline-none">
                      <input
                        type="radio"
                        name="inventoryType"
                        value="range"
                        checked={inventoryType === 'range'}
                        onChange={(e) => setInventoryType(e.target.value)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:focus:ring-blue-400"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          📋 Power Range Only
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          Maintain inventory as a single power range (simpler)
                        </span>
                      </div>
                    </label>

                    <label className="relative flex cursor-pointer rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-4 shadow-sm focus:outline-none">
                      <input
                        type="radio"
                        name="inventoryType"
                        value="individual"
                        checked={inventoryType === 'individual'}
                        onChange={(e) => setInventoryType(e.target.value)}
                        className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500 dark:border-gray-600 dark:focus:ring-blue-400"
                      />
                      <div className="ml-3">
                        <span className="block text-sm font-medium text-gray-900 dark:text-white">
                          🎯 Individual Powers
                        </span>
                        <span className="block text-sm text-gray-500 dark:text-gray-400">
                          Track each power combination separately (detailed)
                        </span>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Individual Power Configuration */}
                {inventoryType === 'individual' && (
                  <div className="space-y-6">
                    {/* Bulk Operations Toolbar */}
                    <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                      <h4 className="text-md font-medium text-gray-900 dark:text-white mb-3">
                        🔧 Bulk Operations
                      </h4>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input
                          type="number"
                          value={bulkValue}
                          onChange={(e) => setBulkValue(e.target.value)}
                          placeholder="Enter value"
                          className="w-24 text-sm border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <button
                          onClick={() => fillSelectedCells(bulkValue)}
                          disabled={selectedCells.size === 0 || !bulkValue}
                          className="px-3 py-1 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Fill Selected ({selectedCells.size})
                        </button>
                        <button
                          onClick={deleteSelectedCells}
                          disabled={selectedCells.size === 0}
                          className="px-3 py-1 text-sm bg-red-500 hover:bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Clear Selected
                        </button>
                        <button
                          onClick={selectAllCells}
                          className="px-3 py-1 text-sm bg-purple-500 hover:bg-purple-600 text-white rounded"
                        >
                          Select All
                        </button>
                        <button
                          onClick={() => setSelectedCells(new Set())}
                          disabled={selectedCells.size === 0}
                          className="px-3 py-1 text-sm bg-gray-500 hover:bg-gray-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Clear Selection
                        </button>
                      </div>
                    </div>

                    {/* Enhanced Spreadsheet Table */}
                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          📊 Power Inventory Spreadsheet (Quantity in Pieces)
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Total: <span className="font-medium text-green-600">{getTotalQuantity()} pieces</span> | 
                          Selected: <span className="font-medium text-blue-600">{selectedCells.size} cells</span>
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          💡 Click & drag to select • Ctrl+click for multi-select • Enter to edit • Delete to clear • Use bulk operations above
                        </p>
                      </div>
                      
                      <div className="overflow-auto max-h-96" style={{ userSelect: 'none' }}>
                        <table className="min-w-full border-collapse table-fixed">
                          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                            <tr>
                              <th className="w-20 px-2 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-300 dark:border-gray-600">
                                SPH \ CYL
                              </th>
                              {cylPowers.map(cyl => (
                                <th key={cyl} className="w-16 px-1 py-2 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase border border-gray-300 dark:border-gray-600">
                                  {cyl >= 0 ? `+${cyl}` : cyl}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="bg-white dark:bg-gray-800">
                            {sphPowers.map(sph => (
                              <tr key={sph}>
                                <td className="w-20 px-2 py-1 text-center text-xs font-medium text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700">
                                  {sph >= 0 ? `+${sph}` : sph}
                                </td>
                                {cylPowers.map(cyl => {
                                  const cellKey = getCellKey(sph, cyl);
                                  const isEditing = editingCell === cellKey;
                                  const isSelected = selectedCells.has(cellKey);
                                  const value = isEditing ? editValue : getCellValue(sph, cyl);
                                  
                                  return (
                                    <td 
                                      key={cyl} 
                                      className={`w-16 border border-gray-300 dark:border-gray-600 p-0 relative ${
                                        isSelected && !isEditing ? 'ring-2 ring-blue-500 dark:ring-blue-400 bg-blue-50 dark:bg-blue-900/20' : ''
                                      } ${isEditing ? 'ring-2 ring-yellow-500 dark:ring-yellow-400 bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                                      onMouseDown={(e) => !isEditing && handleCellMouseDown(sph, cyl, e)}
                                      onMouseEnter={() => !isEditing && handleCellMouseEnter(sph, cyl)}
                                    >
                                      {isEditing ? (
                                        <input
                                          type="text"
                                          value={editValue}
                                          onChange={(e) => {
                                            const newValue = e.target.value.replace(/[^0-9]/g, '');
                                            setEditValue(newValue);
                                          }}
                                          onBlur={(e) => {
                                            // Only finish edit if not clicking on another cell
                                            const timeout = setTimeout(() => finishEdit(), 100);
                                            setBlurTimeout(timeout);
                                          }}
                                          onKeyDown={(e) => {
                                            e.stopPropagation(); // Prevent global key handlers
                                            if (e.key === 'Enter') {
                                              finishEdit();
                                              // Move down to next row
                                              setTimeout(() => moveSelection('down'), 50);
                                            } else if (e.key === 'Escape') {
                                              cancelEdit();
                                            } else if (e.key === 'Tab') {
                                              e.preventDefault();
                                              finishEdit();
                                              setTimeout(() => moveSelection(e.shiftKey ? 'left' : 'right'), 50);
                                            }
                                          }}
                                          onFocus={(e) => e.target.select()}
                                          autoFocus
                                          className="w-full h-8 text-xs text-center border-0 bg-transparent focus:outline-none focus:ring-0 text-gray-900 dark:text-white"
                                        />
                                      ) : (
                                        <div
                                          className="w-full h-8 flex items-center justify-center text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition-colors"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            // Single click selects, double click edits
                                            if (e.detail === 1) {
                                              // Just update selection on single click
                                              setSelectedCells(new Set([getCellKey(sph, cyl)]));
                                            }
                                          }}
                                          onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            startEdit(sph, cyl);
                                          }}
                                        >
                                          {value || ''}
                                        </div>
                                      )}
                                    </td>
                                  );
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || (inventoryType === 'individual' && getTotalQuantity() === 0)}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : '💾 Save Inventory'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-800 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerInventoryModal; 
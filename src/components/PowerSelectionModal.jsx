import React, { useState, useEffect, useRef } from 'react';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { doc, getDoc } from 'firebase/firestore';

const PowerSelectionModal = ({ 
  isOpen, 
  onClose, 
  onSelectPower,
  selectedLens, // Now receiving the lens object directly
  rowIndex 
}) => {
  const [availablePowers, setAvailablePowers] = useState([]);
  const [filteredPowers, setFilteredPowers] = useState([]);
  const [selectedPowers, setSelectedPowers] = useState([]); // Array of selected power objects
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Filter input states
  const [filterSph, setFilterSph] = useState('');
  const [filterCyl, setFilterCyl] = useState('');
  const [filterAdd, setFilterAdd] = useState('');
  
  // Quantity and eye selection for each selected power
  const [powerQuantities, setPowerQuantities] = useState({}); // powerKey -> quantity
  const [powerEyeSelections, setPowerEyeSelections] = useState({}); // powerKey -> eyeSelection
  
  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [showKeyboardHints, setShowKeyboardHints] = useState(false);
  
  // Refs
  const sphInputRef = useRef(null);
  const cylInputRef = useRef(null);
  const addInputRef = useRef(null);
  const powersContainerRef = useRef(null);

  // Format power values to always show 2 decimal places with proper signs
  const formatPowerValue = (value) => {
    if (value === null || value === undefined || value === '') return '';
    const num = parseFloat(value);
    if (isNaN(num)) return value;
    
    const formatted = Math.abs(num).toFixed(2);
    if (num >= 0) {
      return `+${formatted}`;
    } else {
      return `-${formatted}`;
    }
  };

  useEffect(() => {
    if (isOpen && selectedLens) {
      fetchLensPowerInventory();
      // Auto-focus SPH input when modal opens
      setTimeout(() => {
        if (sphInputRef.current) {
          sphInputRef.current.focus();
        }
      }, 100);
    }
  }, [isOpen, selectedLens]);

  useEffect(() => {
    // Enhanced filtering with exact match prioritization
    if (!availablePowers.length) {
      setFilteredPowers([]);
      setFocusedIndex(-1);
      return;
    }

    let filtered = [...availablePowers];

    // Parse filter values
    const sphFilter = filterSph.trim() ? parseFloat(filterSph) : null;
    const cylFilter = filterCyl.trim() ? parseFloat(filterCyl) : null;
    const addFilter = filterAdd.trim() ? parseFloat(filterAdd) : null;

    if (sphFilter !== null || cylFilter !== null || addFilter !== null) {
      filtered = filtered.filter(power => {
        let matches = true;
        
        // SPH filtering with tolerance
        if (sphFilter !== null) {
          matches = matches && Math.abs(power.sph - sphFilter) <= 0.125; // Tighter tolerance
        }
        
        // CYL filtering with tolerance  
        if (cylFilter !== null) {
          matches = matches && Math.abs(power.cyl - cylFilter) <= 0.125; // Tighter tolerance
        }
        
        // ADD filtering with tolerance
        if (addFilter !== null) {
          if (power.addition) {
            matches = matches && Math.abs(power.addition - addFilter) <= 0.125; // Tighter tolerance
          } else {
            matches = false; // If ADD filter is specified but power has no ADD, exclude it
          }
        }
        
        return matches;
      });

      // Sort filtered results to prioritize exact matches
      filtered.sort((a, b) => {
        // Calculate exact match score (lower = better)
        let scoreA = 0;
        let scoreB = 0;
        
        if (sphFilter !== null) {
          scoreA += Math.abs(a.sph - sphFilter);
          scoreB += Math.abs(b.sph - sphFilter);
        }
        
        if (cylFilter !== null) {
          scoreA += Math.abs(a.cyl - cylFilter);
          scoreB += Math.abs(b.cyl - cylFilter);
        }
        
        if (addFilter !== null && a.addition && b.addition) {
          scoreA += Math.abs(a.addition - addFilter);
          scoreB += Math.abs(b.addition - addFilter);
        }
        
        // Prioritize exact matches (score 0) at the top
        if (scoreA !== scoreB) {
          return scoreA - scoreB;
        }
        
        // Secondary sort by SPH, then CYL, then ADD
        if (a.sph !== b.sph) return a.sph - b.sph;
        if (a.cyl !== b.cyl) return a.cyl - b.cyl;
        if (a.addition && b.addition) return a.addition - b.addition;
        return 0;
      });
    } else {
      // No filters applied - sort normally
      filtered.sort((a, b) => {
        if (a.sph !== b.sph) return a.sph - b.sph;
        if (a.cyl !== b.cyl) return a.cyl - b.cyl;
        if (a.addition && b.addition) return a.addition - b.addition;
        return 0;
      });
    }

    setFilteredPowers(filtered);
    setFocusedIndex(filtered.length > 0 ? 0 : -1); // Auto-focus first result
  }, [availablePowers, filterSph, filterCyl, filterAdd]);

  const fetchLensPowerInventory = async () => {
    try {
      setLoading(true);
      setError('');
      
      if (!selectedLens?.id) {
        setError('No lens selected');
        return;
      }

      // Get the lens document to ensure we have latest data
      const lensDocRef = getUserDoc('lensInventory', selectedLens.id);
      const lensDoc = await getDoc(lensDocRef);
      
      if (!lensDoc.exists()) {
        setError('Lens not found in inventory');
        return;
      }

      const lensData = lensDoc.data();
      
      if (!lensData.powerInventory || Object.keys(lensData.powerInventory).length === 0) {
        setError('No power inventory found for this lens');
        return;
      }

      const powers = Object.entries(lensData.powerInventory)
        .filter(([powerKey, powerData]) => parseInt(powerData?.quantity) > 0)
        .map(([powerKey, powerData]) => {
          const parts = powerKey.split('_');
          let displayData;
          
          if (parts.length >= 3) {
            // Bifocal format: "sph_cyl_addition"
            const [sph, cyl, addition] = parts.map(p => parseFloat(p));
            displayData = {
              powerKey,
              sph,
              cyl,
              addition,
              axis: lensData.axis || 90,
              quantity: parseInt(powerData?.quantity) || 0,
              displayText: `SPH: ${formatPowerValue(sph)}, CYL: ${formatPowerValue(cyl)}, ADD: ${formatPowerValue(addition)}`,
              type: 'bifocal'
            };
          } else {
            // Single vision format: "sph_cyl"
            const [sph, cyl] = parts.map(p => parseFloat(p));
            displayData = {
              powerKey,
              sph,
              cyl,
              axis: lensData.axis || 90,
              quantity: parseInt(powerData?.quantity) || 0,
              displayText: `SPH: ${formatPowerValue(sph)}, CYL: ${formatPowerValue(cyl)}`,
              type: 'single'
            };
          }
          
          return displayData;
        });
      
      setAvailablePowers(powers);
      
      // Initialize quantities and eye selections for each power
      const initialQuantities = {};
      const initialEyeSelections = {};
      powers.forEach(power => {
        initialQuantities[power.powerKey] = 1;
        initialEyeSelections[power.powerKey] = 'both';
      });
      setPowerQuantities(initialQuantities);
      setPowerEyeSelections(initialEyeSelections);
      
    } catch (error) {
      console.error('Error fetching lens power inventory:', error);
      setError('Failed to load power inventory');
    } finally {
      setLoading(false);
    }
  };

  // Keyboard navigation handlers
  const handleKeyDown = (e) => {
    if (!filteredPowers.length) return;
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, filteredPowers.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredPowers.length) {
          handlePowerToggle(filteredPowers[focusedIndex]);
        }
        break;
      case 'Space':
        e.preventDefault();
        if (focusedIndex >= 0 && focusedIndex < filteredPowers.length) {
          handlePowerToggle(filteredPowers[focusedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        handleClose();
        break;
      case 'Tab':
        if (e.shiftKey) {
          // Shift+Tab
          if (document.activeElement === sphInputRef.current) {
            e.preventDefault();
            // Focus last element or close button
          } else if (document.activeElement === cylInputRef.current) {
            e.preventDefault();
            sphInputRef.current?.focus();
          } else if (document.activeElement === addInputRef.current) {
            e.preventDefault();
            cylInputRef.current?.focus();
          }
        } else {
          // Tab
          if (document.activeElement === sphInputRef.current) {
            e.preventDefault();
            cylInputRef.current?.focus();
          } else if (document.activeElement === cylInputRef.current) {
            e.preventDefault();
            addInputRef.current?.focus();
          }
        }
        break;
      case 'F1':
        e.preventDefault();
        setShowKeyboardHints(!showKeyboardHints);
        break;
    }
  };

  // Filter input handlers with enhanced parsing
  const handleFilterChange = (field, value) => {
    // Allow negative values and decimals
    const cleanValue = value.replace(/[^-+0-9.]/g, '');
    
    switch (field) {
      case 'sph':
        setFilterSph(cleanValue);
        break;
      case 'cyl':
        setFilterCyl(cleanValue);
        break;
      case 'add':
        setFilterAdd(cleanValue);
        break;
    }
  };

  const handlePowerToggle = (power) => {
    setSelectedPowers(prev => {
      const isSelected = prev.some(p => p.powerKey === power.powerKey);
      if (isSelected) {
        return prev.filter(p => p.powerKey !== power.powerKey);
      } else {
        return [...prev, power];
      }
    });
  };

  const handleQuantityChange = (powerKey, quantity) => {
    setPowerQuantities(prev => ({
      ...prev,
      [powerKey]: Math.max(1, parseInt(quantity) || 1)
    }));
  };

  const handleEyeSelectionChange = (powerKey, eyeSelection) => {
    setPowerEyeSelections(prev => ({
      ...prev,
      [powerKey]: eyeSelection
    }));
  };

  const handleAddToSale = () => {
    if (selectedPowers.length === 0) {
      setError('Please select at least one power');
      return;
    }

    // Validate quantities
    for (const power of selectedPowers) {
      const quantity = powerQuantities[power.powerKey];
      if (quantity <= 0 || quantity > power.quantity) {
        setError(`Invalid quantity for power ${power.displayText}. Available: ${power.quantity}`);
        return;
      }
    }

    // Create power selections array
    const powerSelections = selectedPowers.map(power => {
      const quantity = powerQuantities[power.powerKey];
      const eyeSelection = powerEyeSelections[power.powerKey];
      
      // Calculate final quantity based on eye selection
      let finalQuantity = quantity;
      if (eyeSelection === 'left' || eyeSelection === 'right') {
        finalQuantity = quantity * 0.5; // Half pair
      }

      return {
        lensId: selectedLens.id,
        lensName: selectedLens.brandName,
        powerKey: power.powerKey,
        powerDisplay: power.displayText,
        sph: power.sph,
        cyl: power.cyl,
        addition: power.addition,
        axis: power.axis,
        quantity: finalQuantity,
        pieceQuantity: quantity, // Actual pieces to deduct
        eyeSelection: eyeSelection,
        availableStock: power.quantity,
        lensType: power.type,
        price: selectedLens.salePrice || 0
      };
    });

    // Send all selections to parent
    onSelectPower(rowIndex, powerSelections);
    handleClose();
  };

  const handleClose = () => {
    setSelectedPowers([]);
    setFilterSph('');
    setFilterCyl('');
    setFilterAdd('');
    setFocusedIndex(-1);
    setShowKeyboardHints(false);
    setError('');
    onClose();
  };

  const clearFilters = () => {
    setFilterSph('');
    setFilterCyl('');
    setFilterAdd('');
    setFocusedIndex(-1);
    // Focus back to SPH input
    setTimeout(() => {
      sphInputRef.current?.focus();
    }, 100);
  };

  // Auto-scroll focused item into view
  useEffect(() => {
    if (focusedIndex >= 0 && powersContainerRef.current) {
      const focusedElement = powersContainerRef.current.children[focusedIndex];
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedIndex]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" onKeyDown={handleKeyDown}>
      <div className="flex items-center justify-center min-h-screen pt-2 px-2 pb-4 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 dark:bg-gray-900 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-4 sm:align-middle sm:max-w-5xl sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-3 pt-3 pb-2 sm:p-4">
            <div className="sm:flex sm:items-start">
              <div className="mt-2 text-center sm:mt-0 sm:text-left w-full">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white">
                    🎯 Select Powers from {selectedLens?.brandName}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowKeyboardHints(!showKeyboardHints)}
                    className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-900/70"
                    title="F1 - Toggle keyboard shortcuts"
                  >
                    ⌨️
                  </button>
                </div>

                {/* Compact keyboard hints */}
                {showKeyboardHints && (
                  <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                    <div className="text-xs text-blue-700 dark:text-blue-300 grid grid-cols-2 gap-1">
                      <div>• <kbd className="px-1 bg-white dark:bg-gray-700 rounded text-xs">↑↓</kbd> Navigate</div>
                      <div>• <kbd className="px-1 bg-white dark:bg-gray-700 rounded text-xs">Enter</kbd> Select</div>
                      <div>• <kbd className="px-1 bg-white dark:bg-gray-700 rounded text-xs">Tab</kbd> Next input</div>
                      <div>• <kbd className="px-1 bg-white dark:bg-gray-700 rounded text-xs">Esc</kbd> Close</div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-700 rounded">
                    <p className="text-xs text-red-700 dark:text-red-200">{error}</p>
                  </div>
                )}

                {selectedLens && (
                  <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/30 rounded border border-blue-200 dark:border-blue-700">
                    <p className="text-xs font-medium text-blue-900 dark:text-blue-100">
                      {selectedLens.brandName} • {availablePowers.reduce((sum, p) => sum + p.quantity, 0)} pieces • {availablePowers.length} powers
                    </p>
                  </div>
                )}

                {/* Compact filter section */}
                <div className="mb-3">
                  <div className="grid grid-cols-4 gap-2 mb-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">SPH</label>
                      <input
                        ref={sphInputRef}
                        type="text"
                        value={filterSph}
                        onChange={(e) => handleFilterChange('sph', e.target.value)}
                        placeholder="-2.25"
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-mono"
                        autoComplete="off"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">CYL</label>
                      <input
                        ref={cylInputRef}
                        type="text"
                        value={filterCyl}
                        onChange={(e) => handleFilterChange('cyl', e.target.value)}
                        placeholder="-1.00"
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-mono"
                        autoComplete="off"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">ADD</label>
                      <input
                        ref={addInputRef}
                        type="text"
                        value={filterAdd}
                        onChange={(e) => handleFilterChange('add', e.target.value)}
                        placeholder="+2.00"
                        className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center font-mono"
                        autoComplete="off"
                      />
                    </div>
                    
                    <div className="flex items-end">
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="w-full px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded hover:bg-gray-200 dark:hover:bg-gray-500"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      {filteredPowers.length}/{availablePowers.length} powers
                      {focusedIndex >= 0 && <span className="ml-1 text-blue-600">#{focusedIndex + 1}</span>}
                    </span>
                    <span className="text-blue-600 dark:text-blue-400">Exact matches first</span>
                  </div>
                </div>

                {/* Compact power selection */}
                <div className="mb-3">
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                    Powers ({selectedPowers.length} selected)
                  </h4>

                  {loading ? (
                    <div className="p-4 text-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto"></div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Loading...</p>
                    </div>
                  ) : filteredPowers.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-xs">
                      {availablePowers.length === 0 ? 'No powers available' : 'No matches found'}
                    </div>
                  ) : (
                    <div 
                      ref={powersContainerRef}
                      className="max-h-48 overflow-y-auto border border-gray-200 dark:border-gray-600 rounded"
                    >
                      {filteredPowers.map((power, index) => {
                        const isSelected = selectedPowers.some(p => p.powerKey === power.powerKey);
                        const isFocused = index === focusedIndex;
                        const quantity = powerQuantities[power.powerKey] || 1;
                        const eyeSelection = powerEyeSelections[power.powerKey] || 'both';
                        
                        return (
                          <div
                            key={power.powerKey}
                            className={`p-2 border-b border-gray-200 dark:border-gray-600 last:border-b-0 transition-colors ${
                              isFocused 
                                ? 'bg-blue-100 dark:bg-blue-900/50' 
                                : isSelected 
                                  ? 'bg-green-50 dark:bg-green-900/30' 
                                  : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              {/* Checkbox */}
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handlePowerToggle(power)}
                                className="h-3 w-3 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                              />
                              
                              {/* Power Details */}
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-gray-900 dark:text-white font-mono truncate">
                                  {power.displayText}
                                  {power.type === 'bifocal' && <span className="ml-1 text-blue-600">∠{power.axis}°</span>}
                                </div>
                                <div className="text-xs text-green-600 dark:text-green-400">
                                  {power.quantity} pcs
                                  {isFocused && <span className="ml-1 text-blue-600">• Press Enter</span>}
                                </div>
                              </div>
                              
                              {/* Compact quantity and eye selection */}
                              {isSelected && (
                                <div className="flex space-x-1">
                                  <input
                                    type="number"
                                    min="1"
                                    max={power.quantity}
                                    value={quantity}
                                    onChange={(e) => handleQuantityChange(power.powerKey, e.target.value)}
                                    className="w-12 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-center"
                                  />
                                  <select
                                    value={eyeSelection}
                                    onChange={(e) => handleEyeSelectionChange(power.powerKey, e.target.value)}
                                    className="w-14 px-1 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                                  >
                                    <option value="both">Both</option>
                                    <option value="left">Left</option>
                                    <option value="right">Right</option>
                                  </select>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Compact summary */}
                {selectedPowers.length > 0 && (
                  <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-700 rounded">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-white mb-1">
                      Summary ({selectedPowers.length} power{selectedPowers.length !== 1 ? 's' : ''})
                    </h5>
                    <div className="max-h-16 overflow-y-auto">
                      {selectedPowers.map(power => {
                        const quantity = powerQuantities[power.powerKey];
                        const eyeSelection = powerEyeSelections[power.powerKey];
                        const saleQty = eyeSelection === 'both' ? quantity : quantity * 0.5;
                        
                        return (
                          <div key={power.powerKey} className="flex justify-between text-xs text-gray-700 dark:text-gray-300 font-mono">
                            <span className="truncate">{power.displayText}</span>
                            <span className="ml-2 whitespace-nowrap">
                              {saleQty} {eyeSelection === 'both' ? 'pairs' : 'pc'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 px-3 py-2 sm:px-4 sm:py-3 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={handleAddToSale}
              disabled={selectedPowers.length === 0}
              className="w-full inline-flex justify-center rounded border border-transparent shadow-sm px-3 py-1.5 bg-blue-600 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-2 sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add {selectedPowers.length} Power{selectedPowers.length !== 1 ? 's' : ''}
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="mt-2 w-full inline-flex justify-center rounded border border-gray-300 dark:border-gray-600 shadow-sm px-3 py-1.5 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-2 sm:w-auto"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PowerSelectionModal;

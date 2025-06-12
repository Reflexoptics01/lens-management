import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

const ItemSuggestions = ({ 
  items, 
  value, 
  onChange, 
  onSelect, 
  index, 
  rowQty,
  saveItemToDatabase,
  onRefreshItems,
  placeholder = "Brand/Item Name",
  className = "",
  currentPrice = 0, // Add currentPrice prop to get the price from parent
  dataSection = "", // Add dataSection prop for navigation
  onShowAddProduct // Add callback to show add product modal
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  const hadFocusRef = useRef(false);
  const lastSelectedItemRef = useRef(null);
  const isSelectingRef = useRef(false);

  // Initialize search term from value prop when component loads
  useEffect(() => {
    if (value !== undefined && value !== searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);

  // Initialize and sync searchTerm with value
  useEffect(() => {
    if (value !== undefined && value !== searchTerm && !isSelectingRef.current) {
      setSearchTerm(value || '');
    }
    // Reset the selecting flag after sync
    if (isSelectingRef.current) {
      setTimeout(() => {
        isSelectingRef.current = false;
      }, 100);
    }
  }, [value, searchTerm]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items and prepare suggestions when search term changes
  useEffect(() => {
    if (searchTerm && searchTerm.trim() && items && items.length > 0) {
      // Filter items that match the search term using flexible word matching
      const filtered = items.filter(item => {
        // Get the primary name for the item based on its type
        let itemName = '';
        if (item.type === 'service') {
          itemName = item.serviceName || item.name || item.itemName || '';
        } else {
          itemName = item.name || item.itemName || item.brandName || '';
        }
        
        const itemNameLower = itemName.toLowerCase();
        const searchTermLower = searchTerm.toLowerCase().trim();
        
        // Split search term into words and remove empty strings
        const searchWords = searchTermLower.split(/\s+/).filter(word => word.length > 0);
        
        // Check if all search words are present in the item name
        return searchWords.every(word => itemNameLower.includes(word));
      });

      // Enhanced base name extraction function
      const extractBaseName = (fullName, powerSeries) => {
        // First, normalize the full name by trimming and removing extra spaces
        let baseName = fullName.trim().replace(/\s+/g, ' ');
        
        // If powerSeries exists and is contained in the name, remove it
        if (powerSeries && baseName.includes(powerSeries)) {
          baseName = baseName.replace(powerSeries, '').trim();
        }
        
        // Remove various power patterns more comprehensively
        const powerPatterns = [
          // Patterns like (+1.00 to +6.00), [-1.00 to -6.00], etc.
          /[\(\[][\+\-]?\d+\.?\d*\s*to\s*[\+\-]?\d+\.?\d*[\)\]]/gi,
          // Patterns like (+1.00), [-2.50], etc.
          /[\(\[][\+\-]?\d+\.?\d*[\)\]]/gi,
          // Patterns at the end like " +1.00 to +6.00", " -1.00 to -6.00"
          /\s+[\+\-]?\d+\.?\d*\s*to\s*[\+\-]?\d+\.?\d*$/gi,
          // Single power values at the end like " +1.00", " -2.50"
          /\s+[\+\-]?\d+\.?\d*$/gi,
          // Patterns with "D" like "+1.00D to +6.00D"
          /[\(\[][\+\-]?\d+\.?\d*D?\s*to\s*[\+\-]?\d+\.?\d*D?[\)\]]/gi,
          /\s+[\+\-]?\d+\.?\d*D?\s*to\s*[\+\-]?\d+\.?\d*D?$/gi,
          /\s+[\+\-]?\d+\.?\d*D?$/gi,
          // Power ranges with different formats like "1.00-6.00", "1.00~6.00"
          /[\(\[][\+\-]?\d+\.?\d*[\-~][\+\-]?\d+\.?\d*[\)\]]/gi,
          /\s+[\+\-]?\d+\.?\d*[\-~][\+\-]?\d+\.?\d*$/gi,
          // Remove power series info that might be in different formats
          /\s*\(.*power.*\)/gi,
          /\s*\[.*power.*\]/gi,
          /\s*power\s*:?\s*[\+\-]?\d+\.?\d*\s*to\s*[\+\-]?\d+\.?\d*/gi
        ];
        
        // Apply all patterns
        powerPatterns.forEach(pattern => {
          baseName = baseName.replace(pattern, '').trim();
        });
        
        // Remove trailing separators, dashes, parentheses, brackets and normalize spaces again
        baseName = baseName.replace(/[\s\-\(\)\[\],\.]+$/, '').trim().replace(/\s+/g, ' ');
        
        // If baseName becomes empty or too short, use normalized original name
        if (!baseName || baseName.length < 2) {
          baseName = fullName.trim().replace(/\s+/g, ' ');
        }
        
        return baseName;
      };

      // Group items by base name and sort by price within each group
      const groupedByBaseName = {};
      
      filtered.forEach(item => {
        const fullName = item.name || item.itemName || '';
        const powerSeries = item.powerSeries || '';
        
        // Extract base name using enhanced function
        const baseName = extractBaseName(fullName, powerSeries);
        
        // Initialize group if it doesn't exist
        if (!groupedByBaseName[baseName]) {
          groupedByBaseName[baseName] = [];
        }
        
        groupedByBaseName[baseName].push(item);
      });

      // Sort items within each group by price (lowest first), then flatten
      const sortedFiltered = [];
      Object.keys(groupedByBaseName).forEach(baseName => {
        const group = groupedByBaseName[baseName];
        
        // Sort group by price (lowest first), handle cases where price might be undefined
        group.sort((a, b) => {
          const priceA = parseFloat(a.price) || 0;
          const priceB = parseFloat(b.price) || 0;
          
          // Primary sort: by price (lowest first)
          if (priceA !== priceB) {
            return priceA - priceB;
          }
          
          // Secondary sort: by power series if available
          const powerA = a.powerSeries || a.name || '';
          const powerB = b.powerSeries || b.name || '';
          if (powerA !== powerB) {
            return powerA.localeCompare(powerB);
          }
          
          // Tertiary sort: by full name
          const nameA = a.name || a.itemName || '';
          const nameB = b.name || b.itemName || '';
          return nameA.localeCompare(nameB);
        });
        
        // Add all items from this group to the final array
        sortedFiltered.push(...group);
      });

      setFilteredItems(sortedFiltered);
      
      // Only show suggestions if we're actively typing (input is focused)
      // and the current search term doesn't match what was just selected
      const doShowSuggestions = 
        sortedFiltered.length > 0 && 
        hadFocusRef.current && 
        (!lastSelectedItemRef.current || lastSelectedItemRef.current !== searchTerm);
        
      setShowSuggestions(doShowSuggestions);
      setSelectedIndex(-1); // Reset selection when items change
    } else {
      setFilteredItems([]);
      setShowSuggestions(false);
    }
  }, [searchTerm, items]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    
    // Call the onChange callback with the proper parameters
    if (onChange) {
      if (typeof index === 'number') {
        // For DailyDispatchLog format: onChange(index, field, value)
        onChange(index, 'itemName', newValue);
      } else {
        // For simple format: onChange(value)
        onChange(newValue);
      }
    }
    
    if (newValue === '') {
      setShowSuggestions(false);
      setFilteredItems([]);
    } else {
      setShowSuggestions(true);
    }
  };

  const handleKeyDown = (e) => {
    // Handle Tab key - always move to next input, don't select suggestions
    if (e.key === 'Tab') {
      setShowSuggestions(false);
      return; // Let the default Tab behavior work (move to next input)
    }
    
    // Only handle other keys if suggestions are showing
    if (!showSuggestions || filteredItems.length === 0) {
      // If Enter is pressed and no suggestions are showing, check if we should create new product
      if (e.key === 'Enter' && searchTerm.trim()) {
        const trimmedSearchTerm = searchTerm.trim();
        const itemExists = items.some(item => {
          const itemName = item.name || item.itemName || '';
          return itemName.toLowerCase() === trimmedSearchTerm.toLowerCase();
        });

        // Check if there are any partial matches (suggestions)
        const hasSuggestions = items.some(item => {
          const itemName = item.name || item.itemName || '';
          return itemName.toLowerCase().includes(trimmedSearchTerm.toLowerCase());
        });

        // Show create modal if item doesn't exist exactly and no suggestions are available
        if (!itemExists && !hasSuggestions && onShowAddProduct) {
          e.preventDefault();
          onShowAddProduct(trimmedSearchTerm, index);
          return;
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          e.preventDefault();
          handleSelectItem(filteredItems[selectedIndex]);
          moveToNextInput();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  // Move focus to the next input
  const moveToNextInput = () => {
    setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden]):not([disabled])'));
      const currentIndex = inputs.indexOf(inputRef.current);
      if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
        const nextInput = inputs[currentIndex + 1];
        if (nextInput) {
          nextInput.focus();
          // Ensure suggestions are hidden when moving to next input
          setShowSuggestions(false);
        }
      }
    }, 50);
  };

  const handleSelectItem = (item) => {
    isSelectingRef.current = true;
    lastSelectedItemRef.current = item.name;
    
    // Show warning if quantity is low or negative (but not for services)
    if (!item.isService && item.type !== 'service' && item.qty !== undefined) {
      if (parseInt(item.qty) <= 0) {
        toast.error(`⚠️ Warning: ${item.name} has ${item.qty} quantity (will go negative)`);
      } else if (parseInt(item.qty) <= 3) {
        toast.error(`⚠️ Low stock: ${item.name} has only ${item.qty} remaining`);
      }
    }
    
    // Simply use the full item name - no complicated auto-completion logic
    setSearchTerm(item.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    hadFocusRef.current = false; // Reset focus flag to prevent suggestions from showing again
    
    // Immediately update the parent with the full item name
    if (onChange) {
      if (typeof index === 'number') {
        // For DailyDispatchLog and CreatePurchase format: onChange(index, field, value)
        onChange(index, 'itemName', item.name);
      } else {
        // For simple format: onChange(value)
        onChange(item.name);
      }
    }
    
    if (onSelect) {
      if (typeof index === 'number') {
        // For DailyDispatchLog and CreatePurchase format - include all necessary fields
        const dataToSend = {
          name: item.name,
          itemName: item.name,
          price: item.price,
          total: item.price * (parseInt(rowQty) || 1),
          isStockLens: item.isStockLens,
          stockData: item.stockData,
          isService: item.isService,
          serviceData: item.serviceData,
          // Include the missing fields that CreatePurchase needs
          type: item.type,
          maxSph: item.maxSph,
          maxCyl: item.maxCyl,
          description: item.serviceDescription || item.description || '',
          // Include additional fields that might be useful
          brandName: item.brandName,
          serviceName: item.serviceName, // Add serviceName field for services
          powerSeries: item.powerSeries,
          isContactLens: item.isContactLens,
          // Include all item type flags
          isItem: item.isItem,
          isPrescription: item.isPrescription,
          itemData: item.itemData
        };
        
        try {
          onSelect(index, dataToSend);
        } catch (error) {
          console.error("Error calling onSelect:", error);
        }
      } else {
        // For simple format
        onSelect(item);
      }
    }
  };

  // Separate function for mouse clicks on items
  const handleItemClick = (e, item) => {
    // Prevent the default behavior and stop event propagation
    e.preventDefault();
    e.stopPropagation();
    
    // Set the selected item reference immediately to prevent create modal
    isSelectingRef.current = true;
    lastSelectedItemRef.current = item.name;
    
    // Update the input field first
    handleSelectItem(item);
    
    // Hide suggestions immediately
    setShowSuggestions(false);
    
    // Move to the next input field after selection
    setTimeout(() => {
      moveToNextInput();
    }, 50);
  };

  const handleBlur = (e) => {
    // Don't process blur if suggestions are still showing and user is clicking on them
    // This prevents the create modal from showing when clicking on existing suggestions
    if (showSuggestions && suggestionsRef.current && 
        e.relatedTarget && suggestionsRef.current.contains(e.relatedTarget)) {
      return; // Don't process blur if clicking on a suggestion
    }
    
    // Check if the item exists in inventory
    const trimmedSearchTerm = searchTerm.trim();
    const itemExists = items.some(item => {
      const itemName = item.name || item.itemName || '';
      return itemName.toLowerCase() === trimmedSearchTerm.toLowerCase();
    });

    // Check if there are any suggestions available for the current search term
    const hasSuggestions = trimmedSearchTerm && items.some(item => {
      const itemName = item.name || item.itemName || '';
      return itemName.toLowerCase().includes(trimmedSearchTerm.toLowerCase());
    });

    // Check if this is just normal navigation to an existing filled field
    const isTabNavigation = e.relatedTarget && 
      (e.relatedTarget.tagName === 'INPUT' || e.relatedTarget.tagName === 'SELECT' || e.relatedTarget.tagName === 'BUTTON');
    
    // If it's a new product name (doesn't exist and no suggestions), show create modal even during tab navigation
    const isNewProductName = trimmedSearchTerm && !itemExists && !hasSuggestions && !lastSelectedItemRef.current;
    
    // Show create modal if:
    // 1. User typed something new that doesn't exist
    // 2. Not clicking on suggestions
    // 3. Either not tab navigation OR it's a new product name (allow create modal during tab for new products)
    if (isNewProductName && (!e.relatedTarget || !suggestionsRef.current?.contains(e.relatedTarget)) && onShowAddProduct) {
      setTimeout(() => {
        onShowAddProduct(trimmedSearchTerm, index);
      }, 100);
      return;
    }

    // Original blur logic for saving existing items
    if (trimmedSearchTerm && onChange && saveItemToDatabase) {
      const currentRow = items.find(item => {
        const itemName = item.name || item.itemName || '';
        return itemName === trimmedSearchTerm;
      });
      if (currentRow && currentRow.price > 0) {
        saveItemToDatabase(trimmedSearchTerm, currentRow.price);
      }
    }
    
    // Hide suggestions immediately and reset focus state
    setShowSuggestions(false);
    hadFocusRef.current = false;
    
    // Reset lastSelectedItemRef after a shorter delay to prevent interference with tab navigation
    setTimeout(() => {
      lastSelectedItemRef.current = null;
    }, 100);
  };

  const handleFocus = () => {
    hadFocusRef.current = true;
    
    // Only show suggestions if:
    // 1. There's a search term
    // 2. There are filtered items available
    // 3. The search term doesn't match what was just selected
    // 4. The user actually typed something (not just focused on an empty/pre-filled field)
    if (searchTerm.trim() && filteredItems.length > 0 && 
        (!lastSelectedItemRef.current || lastSelectedItemRef.current !== searchTerm) &&
        searchTerm.length > 1) { // Reduced from 3 to 2 characters to be less restrictive
      setShowSuggestions(true);
    }
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        ref={inputRef}
        type="text"
        value={searchTerm}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`form-input ${className}`}
        autoComplete="off"
        data-section={dataSection}
      />
      {showSuggestions && filteredItems.length > 0 && (
        <div className="absolute z-50 left-0 w-[150%] mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-md rounded-md py-1 max-h-64 overflow-y-auto overflow-x-hidden">
          <div 
            ref={suggestionsRef}
            className="w-full"
          >
            {filteredItems.map((item, idx) => {
              // Highlight the typed portion in the suggestion
              const highlightText = (text, searchTerm) => {
                if (!searchTerm || !text) return text;
                
                const lowerText = text.toLowerCase();
                const lowerSearch = searchTerm.toLowerCase();
                const index = lowerText.indexOf(lowerSearch);
                
                if (index === -1) return text;
                
                return (
                  <span>
                    {text.substring(0, index)}
                    <span className="bg-yellow-200 dark:bg-yellow-800 font-semibold">
                      {text.substring(index, index + searchTerm.length)}
                    </span>
                    {text.substring(index + searchTerm.length)}
                  </span>
                );
              };
              
              return (
                <div
                  key={item.id || idx}
                  tabIndex="0"
                  className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0 flex justify-between items-center ${selectedIndex === idx ? 'bg-sky-50 dark:bg-sky-900/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700'}`}
                  onClick={(e) => handleItemClick(e, item)}
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="flex flex-col flex-1 truncate">
                    <span className="font-medium text-sm truncate text-gray-900 dark:text-gray-100">
                      {highlightText(item.name, searchTerm)}
                    </span>
                    
                    {/* Show lens type and details */}
                    {(item.isStockLens || item.type === 'stock') && (
                      <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                        Stock Lens{item.powerSeries && ` - ${item.powerSeries}`}
                        {item.brandName && item.brandName !== item.name && ` • ${item.brandName}`}
                      </span>
                    )}
                    
                    {(item.isContactLens || item.type === 'contact') && (
                      <span className="text-xs text-purple-600 dark:text-purple-400 truncate">
                        Contact Lens{item.powerSeries && ` - ${item.powerSeries}`}
                        {item.category && ` (${item.category})`}
                        {item.contactType && ` • ${item.contactType}`}
                      </span>
                    )}
                    
                    {(item.isPrescription || item.type === 'prescription') && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 truncate">
                        RX Lens
                        {item.sph && ` - SPH: ${item.sph}`}
                        {item.cyl && `, CYL: ${item.cyl}`}
                        {item.material && ` • ${item.material}`}
                        {item.index && ` ${item.index}`}
                      </span>
                    )}
                    
                    {(item.isService || item.type === 'service') && (
                      <span className="text-xs text-teal-600 dark:text-teal-400 truncate">
                        Service - {item.serviceType || item.serviceData?.serviceType || 'General Service'}
                        {item.serviceDescription && ` • ${item.serviceDescription}`}
                      </span>
                    )}
                    
                    {(item.isItem || item.type === 'item') && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 truncate">
                        Item - {item.category || 'General'}
                        {item.brand && ` • ${item.brand}`}
                        {item.unit && ` • Unit: ${item.unit}`}
                      </span>
                    )}
                    
                    {/* Show power series prominently if it's not already shown above */}
                    {item.powerSeries && !(item.isStockLens || item.type === 'stock') && !(item.isContactLens || item.type === 'contact') && (
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate font-medium">
                        Power: {item.powerSeries}
                      </span>
                    )}
                    
                    {/* Show additional details */}
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      {/* Show quantity with warnings for low/negative stock */}
                      {item.qty !== undefined && (
                        <span className={`font-medium ${
                          parseInt(item.qty) <= 0 
                            ? 'text-red-600 dark:text-red-400' 
                            : parseInt(item.qty) <= 3 
                            ? 'text-orange-600 dark:text-orange-400' 
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          Qty: {item.qty}
                          {parseInt(item.qty) <= 0 && ' ⚠️'}
                          {parseInt(item.qty) > 0 && parseInt(item.qty) <= 3 && ' ⚠️'}
                        </span>
                      )}
                      
                      {/* Show material for stock lenses */}
                      {(item.isStockLens || item.type === 'stock') && item.material && (
                        <span>• {item.material}</span>
                      )}
                      
                      {/* Show index for stock lenses */}
                      {(item.isStockLens || item.type === 'stock') && item.index && (
                        <span>• Index {item.index}</span>
                      )}
                    </div>
                  </div>
                  {item.price && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 ml-2 whitespace-nowrap">₹{item.price}</span>
                  )}
                </div>
              );
            })}
            
            {/* Add "Create New Product" option at the bottom if there are suggestions */}
            {filteredItems.length > 0 && searchTerm.trim() && onShowAddProduct && (
              <div
                className="px-3 py-2 cursor-pointer border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onShowAddProduct(searchTerm.trim(), index);
                  setShowSuggestions(false);
                }}
                onMouseDown={(e) => e.preventDefault()}
              >
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                </svg>
                <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Add New Product "{searchTerm.trim()}"</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemSuggestions; 
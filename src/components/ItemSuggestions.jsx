import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';

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
  currentPrice = 0 // Add currentPrice prop to get the price from parent
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

  // Add states for create new product modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState(0);
  const [selectedProductType, setSelectedProductType] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Add states for stock lens power range fields
  const [powerRangeFields, setPowerRangeFields] = useState({
    maxSph: '',
    maxCyl: '',
    maxAxis: '',
    maxAdd: ''
  });

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
        const itemName = item.name || item.itemName || '';
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

        if (!itemExists) {
          e.preventDefault();
          setNewProductName(trimmedSearchTerm);
          setNewProductPrice(currentPrice || 0);
          setShowCreateModal(true);
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
      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden])'));
      const currentIndex = inputs.indexOf(inputRef.current);
      if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      }
    }, 50);
  };

  const handleSelectItem = (item) => {
    isSelectingRef.current = true;
    lastSelectedItemRef.current = item.name;
    
    // Simply use the full item name - no complicated auto-completion logic
    setSearchTerm(item.name);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
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
          powerSeries: item.powerSeries,
          isContactLens: item.isContactLens
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

    // Only show create modal if:
    // 1. User typed something
    // 2. Item doesn't exist exactly
    // 3. No item was just selected
    // 4. Not clicking on suggestions
    // 5. No suggestions are available for the search term
    if (trimmedSearchTerm && !itemExists && !lastSelectedItemRef.current && 
        (!e.relatedTarget || !suggestionsRef.current?.contains(e.relatedTarget)) &&
        !hasSuggestions) {
      setTimeout(() => {
        setNewProductName(trimmedSearchTerm);
        setNewProductPrice(currentPrice || 0);
        setShowCreateModal(true);
      }, 100); // Small delay to allow selection to complete
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
    
    // Hide suggestions after a delay to allow click events to register
    setTimeout(() => {
      setShowSuggestions(false);
      hadFocusRef.current = false; // Reset focus state on blur
      // Reset lastSelectedItemRef after some time
      setTimeout(() => {
        lastSelectedItemRef.current = null;
      }, 500);
    }, 200);
  };

  const handleFocus = () => {
    hadFocusRef.current = true;
    
    // Only show suggestions if the search term doesn't match what was just selected
    if (searchTerm.trim() && filteredItems.length > 0 && 
        (!lastSelectedItemRef.current || lastSelectedItemRef.current !== searchTerm)) {
      setShowSuggestions(true);
    }
  };

  // Function to create new product in lens inventory
  const createNewProduct = async () => {
    if (!newProductName.trim() || !selectedProductType) return;

    try {
      setCreatingProduct(true);

      let productData = {
        brandName: newProductName,
        name: newProductName, // For compatibility with suggestions
        createdAt: Timestamp.now(),
        createdBy: 'user', // You might want to add user tracking
        qty: 1,
        type: selectedProductType
      };

      // Add type-specific data and pricing
      if (selectedProductType === 'stock') {
        // Create power series description from max range fields
        let powerSeries = '';
        if (powerRangeFields.maxSph) {
          powerSeries += `SPH: up to ${powerRangeFields.maxSph}`;
        }
        if (powerRangeFields.maxCyl) {
          if (powerSeries) powerSeries += ', ';
          powerSeries += `CYL: up to ${powerRangeFields.maxCyl}`;
        }
        if (powerRangeFields.maxAxis) {
          if (powerSeries) powerSeries += ', ';
          powerSeries += `AXIS: up to ${powerRangeFields.maxAxis}`;
        }
        if (powerRangeFields.maxAdd) {
          if (powerSeries) powerSeries += ', ';
          powerSeries += `ADD: up to ${powerRangeFields.maxAdd}`;
        }

        productData = {
          ...productData,
          powerSeries: powerSeries,
          // Store max power range values
          maxSph: powerRangeFields.maxSph || '',
          maxCyl: powerRangeFields.maxCyl || '',
          maxAxis: powerRangeFields.maxAxis || '',
          maxAdd: powerRangeFields.maxAdd || '',
          purchasePrice: newProductPrice,
          salePrice: newProductPrice,
          price: newProductPrice
        };
      } else if (selectedProductType === 'prescription') {
        productData = {
          ...productData,
          eye: 'both',
          sph: '',
          cyl: '',
          axis: '',
          add: '',
          material: '',
          index: '',
          purchasePrice: newProductPrice,
          salePrice: newProductPrice,
          price: newProductPrice
        };
      } else if (selectedProductType === 'contact') {
        productData = {
          ...productData,
          powerSeries: '',
          category: '',
          contactType: '',
          color: '',
          disposalFrequency: '',
          purchasePrice: newProductPrice,
          salePrice: newProductPrice,
          price: newProductPrice
        };
      } else if (selectedProductType === 'service') {
        productData = {
          ...productData,
          serviceName: newProductName,
          serviceType: 'General Service',
          serviceDescription: '',
          servicePrice: newProductPrice,
          salePrice: newProductPrice,
          price: newProductPrice,
          isActive: true
        };
      }

      // Save to lens_inventory collection
      await addDoc(getUserCollection('lensInventory'), productData);

      // Close modal and trigger selection
      setShowCreateModal(false);
      
      // Trigger onSelect with the new product data
      if (onSelect) {
        if (typeof index === 'number') {
          const dataToSend = {
            name: newProductName,
            itemName: newProductName,
            price: newProductPrice,
            total: newProductPrice * (parseInt(rowQty) || 1),
            isService: selectedProductType === 'service',
            isStockLens: selectedProductType === 'stock',
            serviceData: selectedProductType === 'service' ? productData : null,
            stockData: selectedProductType === 'stock' ? productData : null
          };
          
          onSelect(index, dataToSend);
        } else {
          onSelect({ ...productData, name: newProductName, price: newProductPrice });
        }
      }

      // Reset states
      setNewProductName('');
      setNewProductPrice(0);
      setSelectedProductType('');
      setPowerRangeFields({
        maxSph: '',
        maxCyl: '',
        maxAxis: '',
        maxAdd: ''
      });
      
      // Refresh items list from parent
      if (onRefreshItems) {
        await onRefreshItems();
      }
      
      // Show success message
      alert(`Successfully created new ${selectedProductType} product: "${newProductName}"`);

    } catch (error) {
      console.error('Error creating new product:', error);
      alert(`Failed to create new product: ${error.message}`);
    } finally {
      setCreatingProduct(false);
    }
  };

  // Function to close modal without creating
  const closeCreateModal = () => {
    setShowCreateModal(false);
    setNewProductName('');
    setNewProductPrice(0);
    setSelectedProductType('');
    setPowerRangeFields({
      maxSph: '',
      maxCyl: '',
      maxAxis: '',
      maxAdd: ''
    });
    setShowSuggestions(false);
    hadFocusRef.current = false;
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
                      {/* Show available quantity if it exists and is not 1 */}
                      {item.qty && parseInt(item.qty) > 1 && (
                        <span>Qty: {item.qty}</span>
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
            {filteredItems.length > 0 && searchTerm.trim() && (
              <div
                className="px-3 py-2 cursor-pointer border-t border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-center"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setNewProductName(searchTerm.trim());
                  setNewProductPrice(currentPrice || 0);
                  setShowCreateModal(true);
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

      {/* Create New Product Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Create New Product</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Product "{newProductName}" doesn't exist in inventory. Would you like to create it?
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Product Name
              </label>
              <input
                type="text"
                value={newProductName}
                onChange={(e) => setNewProductName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="Product name"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Price (₹)
              </label>
              <input
                type="number"
                value={newProductPrice}
                onChange={(e) => setNewProductPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                placeholder="0.00"
                min="0"
                step="0.01"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Select Product Type
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setSelectedProductType('prescription')}
                  disabled={creatingProduct}
                  className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors disabled:opacity-50 ${
                    selectedProductType === 'prescription'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-400'
                      : 'border-blue-200 dark:border-blue-700 bg-white dark:bg-gray-700 hover:border-blue-400 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                  }`}
                >
                  <svg className="w-8 h-8 text-blue-600 dark:text-blue-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-900 dark:text-blue-100">RX Lens</span>
                </button>

                <div className="flex flex-col">
                  <button
                    onClick={() => setSelectedProductType('stock')}
                    disabled={creatingProduct}
                    className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors disabled:opacity-50 ${
                      selectedProductType === 'stock'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-400'
                        : 'border-emerald-200 dark:border-emerald-700 bg-white dark:bg-gray-700 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
                    }`}
                  >
                    <svg className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <span className="text-sm font-medium text-emerald-900 dark:text-emerald-100">Stock Lens</span>
                  </button>

                  {/* Power Range Fields - Right below Stock Lens button */}
                  {selectedProductType === 'stock' && (
                    <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700 rounded-lg">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                            Max SPH
                          </label>
                          <input
                            type="text"
                            value={powerRangeFields.maxSph}
                            onChange={(e) => setPowerRangeFields(prev => ({ ...prev, maxSph: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                            placeholder="+6.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                            Max CYL
                          </label>
                          <input
                            type="text"
                            value={powerRangeFields.maxCyl}
                            onChange={(e) => setPowerRangeFields(prev => ({ ...prev, maxCyl: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                            placeholder="-6.00"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                            Max AXIS
                          </label>
                          <input
                            type="text"
                            value={powerRangeFields.maxAxis}
                            onChange={(e) => setPowerRangeFields(prev => ({ ...prev, maxAxis: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                            placeholder="180"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-emerald-800 dark:text-emerald-200 mb-1">
                            Max ADD
                          </label>
                          <input
                            type="text"
                            value={powerRangeFields.maxAdd}
                            onChange={(e) => setPowerRangeFields(prev => ({ ...prev, maxAdd: e.target.value }))}
                            className="w-full px-2 py-1 text-sm border border-emerald-300 dark:border-emerald-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:focus:ring-emerald-400"
                            placeholder="+3.50"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  onClick={() => setSelectedProductType('contact')}
                  disabled={creatingProduct}
                  className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors disabled:opacity-50 ${
                    selectedProductType === 'contact'
                      ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20 dark:border-purple-400'
                      : 'border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-700 hover:border-purple-400 dark:hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20'
                  }`}
                >
                  <svg className="w-8 h-8 text-purple-600 dark:text-purple-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="text-sm font-medium text-purple-900 dark:text-purple-100">Contact Lens</span>
                </button>

                <button
                  onClick={() => setSelectedProductType('service')}
                  disabled={creatingProduct}
                  className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors disabled:opacity-50 ${
                    selectedProductType === 'service'
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 dark:border-teal-400'
                      : 'border-teal-200 dark:border-teal-700 bg-white dark:bg-gray-700 hover:border-teal-400 dark:hover:border-teal-500 hover:bg-teal-50 dark:hover:bg-teal-900/20'
                  }`}
                >
                  <svg className="w-8 h-8 text-teal-600 dark:text-teal-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="text-sm font-medium text-teal-900 dark:text-teal-100">Service</span>
                </button>
              </div>
            </div>



            {/* Action Buttons */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={closeCreateModal}
                disabled={creatingProduct}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 dark:focus:ring-gray-400 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              
              {selectedProductType && (
                <button
                  onClick={createNewProduct}
                  disabled={creatingProduct || !newProductName.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 transition-colors"
                >
                  {creatingProduct ? (
                    <span className="flex items-center">
                      <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </span>
                  ) : (
                    `Create ${selectedProductType === 'prescription' ? 'RX Lens' : 
                           selectedProductType === 'stock' ? 'Stock Lens' : 
                           selectedProductType === 'contact' ? 'Contact Lens' : 'Service'}`
                  )}
                </button>
              )}
            </div>

            {creatingProduct && (
              <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 dark:bg-opacity-75 flex items-center justify-center rounded-lg">
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 text-blue-600 dark:text-blue-400 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-sm text-gray-600 dark:text-gray-300">Creating product...</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemSuggestions; 
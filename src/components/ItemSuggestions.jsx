import React, { useState, useEffect, useRef } from 'react';

const ItemSuggestions = ({ 
  items, 
  value, 
  onChange, 
  onSelect, 
  index, 
  rowQty,
  saveItemToDatabase 
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

  // Initialize searchTerm from value if provided
  useEffect(() => {
    if (value && !searchTerm) {
      setSearchTerm(value);
    } else if (value !== searchTerm && !hadFocusRef.current) {
      // Update searchTerm if value changes and input hasn't had focus yet
      setSearchTerm(value);
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
    if (searchTerm.trim()) {
      // First deduplicate items by name
      const uniqueNames = {};
      items.forEach(item => {
        const lowercaseName = item.name.toLowerCase();
        if (!uniqueNames[lowercaseName] || 
            (item.updatedAt && uniqueNames[lowercaseName].updatedAt && 
             item.updatedAt > uniqueNames[lowercaseName].updatedAt)) {
          uniqueNames[lowercaseName] = item;
        }
      });

      // Convert to array and filter based on search term
      const uniqueItems = Object.values(uniqueNames);
      const filtered = uniqueItems.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      setFilteredItems(filtered);
      
      // Only show suggestions if we're actively typing (input is focused)
      // and the current search term doesn't match what was just selected
      const doShowSuggestions = 
        filtered.length > 0 && 
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
    const value = e.target.value;
    setSearchTerm(value);
    onChange(index, 'itemName', value);
    
    if (value === '') {
      setShowSuggestions(false);
      setFilteredItems([]);
    }
  };

  const handleKeyDown = (e) => {
    // Only handle keys if suggestions are showing
    if (!showSuggestions || filteredItems.length === 0) return;

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
      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          e.preventDefault();
          handleSelectItem(filteredItems[selectedIndex]);
          moveToNextInput();
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
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
    lastSelectedItemRef.current = item.name;
    setSearchTerm(item.name);
    setShowSuggestions(false);
    
    if (item.isStockLens) {
      // For stock lens items, pass the full data
      onSelect(index, {
        itemName: item.name,
        price: item.price,
        total: item.price * (parseInt(rowQty) || 1),
        isStockLens: true,
        stockData: item.stockData
      });
    } else {
      // For regular items
      onSelect(index, {
        itemName: item.name,
        price: item.price,
        total: item.price * (parseInt(rowQty) || 1)
      });
    }
  };

  // Separate function for mouse clicks on items
  const handleItemClick = (e, item) => {
    // Prevent the default behavior and stop event propagation
    e.preventDefault();
    e.stopPropagation();
    
    // Update the input field first
    handleSelectItem(item);
    
    // Move to the next input field after selection
    moveToNextInput();
    
    // Ensure we don't show the suggestions anymore
    setShowSuggestions(false);
  };

  const handleBlur = (e) => {
    // If we have a non-empty searchTerm, we should save this item to database
    // This usually means user typed a custom item name
    if (searchTerm.trim() && onChange) {
      // We might want to save this to database if it has a price
      const currentRow = items.find(item => item.name === searchTerm.trim());
      if (currentRow && currentRow.price > 0 && saveItemToDatabase) {
        saveItemToDatabase(searchTerm.trim(), currentRow.price);
      }
    }
    
    // We need a small delay to allow click events to register first
    // Don't hide suggestions if we're clicking on a suggestion item
    if (!e.relatedTarget || !suggestionsRef.current?.contains(e.relatedTarget)) {
      setTimeout(() => {
        setShowSuggestions(false);
        hadFocusRef.current = false; // Reset focus state on blur
      }, 200);
    }
  };

  const handleFocus = () => {
    hadFocusRef.current = true;
    
    // Only show suggestions if the search term doesn't match what was just selected
    if (searchTerm.trim() && filteredItems.length > 0 && 
        (!lastSelectedItemRef.current || lastSelectedItemRef.current !== searchTerm)) {
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
        placeholder="Brand/Item Name"
        className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
      />
      {showSuggestions && filteredItems.length > 0 && (
        <div className="absolute z-10 left-0 w-[150%] mt-1 bg-white border border-gray-200 shadow-md rounded-md py-1 max-h-48 overflow-y-auto overflow-x-hidden">
          <div 
            ref={suggestionsRef}
            className="w-full"
          >
            {filteredItems.map((item, idx) => (
              <div
                key={item.id}
                tabIndex="0"
                className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 flex justify-between items-center ${selectedIndex === idx ? 'bg-sky-50' : 'hover:bg-gray-50'}`}
                onClick={(e) => handleItemClick(e, item)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <div className="flex flex-col flex-1 truncate">
                  <span className="font-medium text-sm truncate">{item.name}</span>
                  {item.isStockLens && item.stockData && (
                    <span className="text-xs text-emerald-600">Stock Lens {item.stockData.powerSeries}</span>
                  )}
                </div>
                <span className="text-xs text-gray-500 ml-2 whitespace-nowrap">₹{item.price}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ItemSuggestions; 
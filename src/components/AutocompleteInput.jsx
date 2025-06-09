import React, { useState, useEffect, useRef } from 'react';

const AutocompleteInput = ({ 
  items = [],
  value = '',
  onChange,
  onSelect,
  placeholder = "Type to search...",
  className = "",
  displayField = "name", // Field to display in dropdown
  valueField = "name", // Field to use as value
  renderItem = null, // Custom render function for dropdown items
  maxHeight = "max-h-48",
  disabled = false
}) => {
  const [searchTerm, setSearchTerm] = useState(value || '');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredItems, setFilteredItems] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  const isSelectingRef = useRef(false);

  // Sync searchTerm with external value changes
  useEffect(() => {
    if (value !== searchTerm && !isSelectingRef.current) {
      setSearchTerm(value || '');
    }
    isSelectingRef.current = false;
  }, [value]);

  // Handle click outside to close suggestions
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter items based on search term
  useEffect(() => {
    if (searchTerm.trim() && items.length > 0) {
      const filtered = items.filter(item => {
        const displayValue = getDisplayValue(item);
        return displayValue.toLowerCase().includes(searchTerm.toLowerCase());
      });
      setFilteredItems(filtered);
      setSelectedIndex(-1);
    } else {
      setFilteredItems([]);
    }
  }, [searchTerm, items, displayField]);

  // Scroll selected item into view
  useEffect(() => {
    if (selectedIndex >= 0 && suggestionsRef.current) {
      const selectedElement = suggestionsRef.current.children[selectedIndex];
      if (selectedElement) {
        selectedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const getDisplayValue = (item) => {
    if (typeof item === 'string') return item;
    return item[displayField] || '';
  };

  const getItemValue = (item) => {
    if (typeof item === 'string') return item;
    return item[valueField] || '';
  };

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    setShowSuggestions(true);
    if (onChange) {
      onChange(newValue);
    }
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || filteredItems.length === 0) {
      if (e.key === 'ArrowDown' && filteredItems.length === 0 && searchTerm.trim()) {
        setShowSuggestions(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : filteredItems.length - 1));
        break;
      case 'Enter':
      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < filteredItems.length) {
          e.preventDefault();
          handleSelectItem(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
      default:
        break;
    }
  };

  const handleSelectItem = (item) => {
    isSelectingRef.current = true;
    const displayValue = getDisplayValue(item);
    const itemValue = getItemValue(item);
    
    setSearchTerm(displayValue);
    setShowSuggestions(false);
    setSelectedIndex(-1);
    
    if (onChange) {
      onChange(itemValue);
    }
    if (onSelect) {
      onSelect(item);
    }
  };

  const handleItemClick = (e, item) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelectItem(item);
  };

  const handleFocus = () => {
    if (filteredItems.length > 0) {
      setShowSuggestions(true);
    }
  };

  const handleBlur = (e) => {
    // Don't hide suggestions if clicking on a suggestion item
    if (!e.relatedTarget || !suggestionsRef.current?.contains(e.relatedTarget)) {
      setTimeout(() => {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }, 150);
    }
  };

  const defaultRenderItem = (item, index) => (
    <div
      key={index}
      className={`px-3 py-2 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${
        selectedIndex === index ? 'bg-sky-50 dark:bg-sky-900/50' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
      }`}
      onClick={(e) => handleItemClick(e, item)}
      onMouseEnter={() => setSelectedIndex(index)}
    >
      <span className="text-sm text-gray-900 dark:text-gray-100">{getDisplayValue(item)}</span>
    </div>
  );

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
        disabled={disabled}
        className={`form-input ${className}`}
        autoComplete="off"
      />
      {showSuggestions && filteredItems.length > 0 && (
        <div className={`absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 shadow-lg rounded-md py-1 ${maxHeight} overflow-y-auto`}>
          <div ref={suggestionsRef}>
            {filteredItems.map((item, index) => 
              renderItem ? renderItem(item, index, selectedIndex === index) : defaultRenderItem(item, index)
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AutocompleteInput; 
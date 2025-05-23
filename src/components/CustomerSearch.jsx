import React, { useState, useEffect, useRef } from 'react';

const CustomerSearch = ({ customers, value, onChange, onSelect, onAddNew, isOrderFlow = false, className = '' }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef(null);
  const suggestionsRef = useRef(null);
  const inputRef = useRef(null);
  const hadFocusRef = useRef(false);
  const lastSelectedCustomerRef = useRef(null);
  const isUserEditingRef = useRef(false);

  // Initialize searchTerm from value if provided
  useEffect(() => {
    if (value && !searchTerm) {
      setSearchTerm(value);
    } else if (value !== searchTerm && !hadFocusRef.current && !isUserEditingRef.current) {
      // Update searchTerm if value changes and input hasn't had focus yet
      // and user is not actively editing the field
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

  useEffect(() => {
    // Listen for messages from the popup window
    const handleMessage = (event) => {
      if (event.data.type === 'CUSTOMER_CREATED') {
        const newCustomer = event.data.customer;
        onSelect({
          id: newCustomer.id,
          opticalName: newCustomer.name, // Update to match the property in the message
          phone: newCustomer.phone,
          city: newCustomer.city
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onSelect]);

  useEffect(() => {
    if (searchTerm.trim()) {
      const filtered = customers.filter(customer =>
        customer.opticalName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
      
      // Only show suggestions if actively typing and not right after selection
      const doShowSuggestions = 
        filtered.length > 0 && 
        hadFocusRef.current &&
        (!lastSelectedCustomerRef.current || lastSelectedCustomerRef.current !== searchTerm);
        
      setShowSuggestions(doShowSuggestions);
      setSelectedIndex(-1); // Reset selection when customers change
    } else {
      setFilteredCustomers([]);
      setShowSuggestions(false);
    }
  }, [searchTerm, customers]);

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
    isUserEditingRef.current = true;
    setSearchTerm(value);
    
    // Always update the parent with the current input value
    onChange({ target: { name: 'customerName', value } });
    
    // Only clear the selection if field is completely empty
    if (value === '') {
      lastSelectedCustomerRef.current = null;
      setShowSuggestions(false);
      setFilteredCustomers([]);
      onSelect(null);
    }
    
    // Reset the editing flag after a short delay
    setTimeout(() => {
      isUserEditingRef.current = false;
    }, 100);
  };

  const handleKeyDown = (e) => {
    // Only handle keys if suggestions are showing
    if (!showSuggestions || filteredCustomers.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < filteredCustomers.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : 0));
        break;
      case 'Enter':
        if (selectedIndex >= 0 && selectedIndex < filteredCustomers.length) {
          e.preventDefault();
          handleSelectCustomer(filteredCustomers[selectedIndex]);
        }
        break;
      case 'Tab':
        if (selectedIndex >= 0 && selectedIndex < filteredCustomers.length) {
          e.preventDefault();
          handleSelectCustomer(filteredCustomers[selectedIndex]);
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

  const handleSelectCustomer = (customer) => {
    lastSelectedCustomerRef.current = customer.opticalName;
    setSearchTerm(customer.opticalName);
    setShowSuggestions(false);
    onSelect(customer);
  };

  // Separate handler for mouse clicks
  const handleCustomerClick = (e, customer) => {
    e.preventDefault();
    e.stopPropagation();
    
    handleSelectCustomer(customer);
    
    // Move focus to next input after selection
    setTimeout(() => {
      const inputs = Array.from(document.querySelectorAll('input:not([type=hidden])'));
      const currentIndex = inputs.indexOf(inputRef.current);
      if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      }
    }, 50);
  };

  const handleAddNew = () => {
    // Always use the parent's onAddNew handler
    if (onAddNew) {
      onAddNew();
    }
  };
  
  const handleFocus = () => {
    hadFocusRef.current = true;
    
    // Show suggestions again if there's a search term
    if (searchTerm.trim() && filteredCustomers.length > 0 &&
        (!lastSelectedCustomerRef.current || lastSelectedCustomerRef.current !== searchTerm)) {
      setShowSuggestions(true);
    }
  };
  
  const handleBlur = (e) => {
    // Don't hide suggestions if clicking on a suggestion
    if (!e.relatedTarget || !suggestionsRef.current?.contains(e.relatedTarget)) {
      setTimeout(() => {
        setShowSuggestions(false);
        hadFocusRef.current = false;
      }, 200);
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-1">
        <div className="flex-1">
          <input
            ref={inputRef}
            type="text"
            name="customerName"
            value={searchTerm}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Start typing customer name..."
            required
            aria-required="true"
            className={`w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white px-3 py-2 shadow-sm focus:border-sky-500 dark:focus:border-sky-400 focus:ring-1 focus:ring-sky-500 dark:focus:ring-sky-400 text-sm ${className}`}
          />
          {showSuggestions && filteredCustomers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 rounded-md shadow-lg max-h-48 overflow-auto border border-sky-100 dark:border-gray-600">
              <div 
                ref={suggestionsRef}
                className="py-1"
              >
                {filteredCustomers.map((customer, idx) => (
                  <div
                    key={customer.id}
                    className={`px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${selectedIndex === idx ? 'bg-sky-50 dark:bg-sky-900/50' : ''}`}
                    onClick={(e) => handleCustomerClick(e, customer)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    tabIndex="0"
                  >
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100">{customer.opticalName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {customer.phone} • {customer.city || 'No city'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 dark:bg-sky-500 dark:hover:bg-sky-600 focus:outline-none focus:ring-2 focus:ring-offset-2 dark:focus:ring-offset-gray-800 focus:ring-sky-500 dark:focus:ring-sky-400 transition-colors"
        >
          Add New
        </button>
      </div>
      {value && (
        <div className="mt-1 text-xs font-semibold text-sky-700 dark:text-sky-300">
          <span className="inline-flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            {customers.find(c => c.opticalName === value)?.phone || 'No phone'}
          </span>
          {customers.find(c => c.opticalName === value)?.city && (
            <span className="inline-flex items-center ml-3">
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {customers.find(c => c.opticalName === value)?.city}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch; 
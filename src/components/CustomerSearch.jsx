import React, { useState, useEffect, useRef } from 'react';

const CustomerSearch = ({ customers, value, onChange, onSelect, onAddNew, isOrderFlow = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const wrapperRef = useRef(null);

  // Initialize searchTerm from value if provided
  useEffect(() => {
    if (value && !searchTerm) {
      setSearchTerm(value);
    }
  }, [value]);

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
      setShowSuggestions(true);
    } else {
      setFilteredCustomers([]);
      setShowSuggestions(false);
    }
  }, [searchTerm, customers]);

  const handleInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value === '') {
      setShowSuggestions(false);
      setFilteredCustomers([]);
    }
    onChange({ target: { name: 'customerName', value } });
  };

  const handleSelectCustomer = (customer) => {
    setSearchTerm(customer.opticalName);
    setShowSuggestions(false);
    setFilteredCustomers([]);
    onSelect(customer);
  };

  const handleAddNew = () => {
    if (isOrderFlow && onAddNew) {
      onAddNew();
    } else {
      window.open('/customers/new', '_blank');
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-1">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            placeholder="Start typing customer name..."
            className="w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm"
          />
          {showSuggestions && filteredCustomers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-48 overflow-auto border border-sky-100">
              <div className="sticky top-0 bg-sky-50 border-b border-sky-200 px-3 py-1.5 text-xs font-bold uppercase text-sky-700">
                Matching Customers
              </div>
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="px-3 py-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div className="font-medium text-sm">{customer.opticalName}</div>
                  <div className="text-xs text-gray-500">
                    {customer.phone} • {customer.city || 'No city'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddNew}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
        >
          Add New
        </button>
      </div>
      {value && (
        <div className="mt-1 text-xs font-semibold text-sky-700">
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
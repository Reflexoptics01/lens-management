import React, { useState, useEffect, useRef } from 'react';

const CustomerSearch = ({ customers, value, onChange, onSelect, onAddNew, isOrderFlow = false }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const wrapperRef = useRef(null);

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
          opticalName: newCustomer.opticalName,
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
    if (isOrderFlow) {
      // Open in a new window with specific size
      const width = 800;
      const height = 900;
      const left = (window.screen.width - width) / 2;
      const top = (window.screen.height - height) / 2;

      window.open(
        '/customers/new',
        'newCustomer',
        `width=${width},height=${height},left=${left},top=${top},location=no,menubar=no,toolbar=no,status=no`
      );
    } else {
      window.open('/customers/new', '_blank');
    }
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={searchTerm}
            onChange={handleInputChange}
            placeholder="Start typing customer name..."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-[#4169E1] focus:ring-[#4169E1] sm:text-sm"
          />
          {showSuggestions && filteredCustomers.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white rounded-md shadow-lg max-h-60 overflow-auto">
              {filteredCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="px-4 py-2 hover:bg-gray-100 cursor-pointer"
                  onClick={() => handleSelectCustomer(customer)}
                >
                  <div className="font-medium">{customer.opticalName}</div>
                  <div className="text-sm text-gray-500">
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
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
        >
          Add New
        </button>
      </div>
      {value && (
        <div className="mt-2 text-sm text-gray-500">
          {customers.find(c => c.opticalName === value)?.phone || ''} • {customers.find(c => c.opticalName === value)?.city || ''}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch; 
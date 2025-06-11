import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, query, orderBy, doc, updateDoc, deleteDoc, Timestamp, where } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { formatDate as utilFormatDate } from '../utils/dateUtils';
import Navbar from '../components/Navbar';
import ItemSuggestions from '../components/ItemSuggestions';
import AutocompleteInput from '../components/AutocompleteInput';

const DailyDispatchLog = () => {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [selectedOptical, setSelectedOptical] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Lens inventory for suggestions
  const [lensInventory, setLensInventory] = useState([]);
  
  // Customers data for optical shop suggestions
  const [customers, setCustomers] = useState([]);
  
  // Dispatch logs
  const [dispatchLogs, setDispatchLogs] = useState([]);
  
  // Filter states for logs
  const [logFilterDate, setLogFilterDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [logFilterOptical, setLogFilterOptical] = useState('');
  const [filteredLogs, setFilteredLogs] = useState([]);
  
  // Edit mode states
  const [editMode, setEditMode] = useState(false);
  const [editingLogId, setEditingLogId] = useState(null);
  const [editingDocId, setEditingDocId] = useState(null);
  
  // Form state
  const [dispatchRows, setDispatchRows] = useState(
    Array(5).fill().map((_, index) => ({
      id: index + 1,
      slNo: index + 1,
      itemName: '',
      sph: '',
      cyl: '',
      axis: '',
      add: '',
      qty: 1
    }))
  );

  useEffect(() => {
    fetchLensInventory();
    fetchCustomers();
    fetchDispatchLogs();
  }, []);

  // Filter logs based on date and optical shop with error handling
  useEffect(() => {
    try {
      let filtered = [...dispatchLogs]; // Create a copy to avoid mutations
      
      // Filter by date
      if (logFilterDate && logFilterDate.trim()) {
        filtered = filtered.filter(log => log && log.date === logFilterDate);
      }
      
      // Filter by optical shop with defensive checks
      if (logFilterOptical && logFilterOptical.trim()) {
        const searchTerm = logFilterOptical.toLowerCase().trim();
        filtered = filtered.filter(log => {
          if (!log || !log.opticalShop) return false;
          return log.opticalShop.toLowerCase().includes(searchTerm);
        });
      }
      
      setFilteredLogs(filtered || []);
    } catch (error) {
      console.error('Error filtering logs:', error);
      setFilteredLogs([]);
    }
  }, [dispatchLogs, logFilterDate, logFilterOptical]);

  const fetchLensInventory = async () => {
    try {
      const lensRef = getUserCollection('lensInventory');
      const snapshot = await getDocs(lensRef);
      
      const lensesList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => {
          const data = doc.data();
                  return {
          id: doc.id,
          name: data.type === 'service' ? (data.serviceName || data.brandName || 'Unknown Service') : (data.brandName || data.serviceName || 'Unknown Item'),
          brandName: data.brandName,
          serviceName: data.serviceName,
          price: data.salePrice || data.purchasePrice || data.servicePrice || 0,
            salePrice: data.salePrice,
            purchasePrice: data.purchasePrice,
            servicePrice: data.servicePrice,
            type: data.type,
            sph: data.sph,
            cyl: data.cyl,
            axis: data.axis,
            add: data.add,
            eye: data.eye,
            material: data.material,
            index: data.index,
            powerSeries: data.powerSeries,
            category: data.category,
            contactType: data.contactType,
            color: data.color,
            disposalFrequency: data.disposalFrequency,
            serviceType: data.serviceType,
            serviceDescription: data.serviceDescription,
            serviceDuration: data.serviceDuration,
            isActive: data.isActive,
            qty: data.qty || 1,
            isStockLens: data.type === 'stock',
            isService: data.type === 'service',
            stockData: data.type === 'stock' ? {
              powerSeries: data.powerSeries,
              type: 'stock'
            } : null,
            serviceData: data.type === 'service' ? {
              serviceName: data.serviceName,
              serviceType: data.serviceType,
              serviceDescription: data.serviceDescription,
              serviceDuration: data.serviceDuration,
              salePrice: data.salePrice,
              servicePrice: data.servicePrice,
              price: data.salePrice || data.servicePrice,
              isActive: data.isActive,
              type: 'service'
            } : null,
            ...data
          };
        });
      
      setLensInventory(lensesList);
    } catch (error) {
      console.error('Error fetching lens inventory:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customersRef = getUserCollection('customers');
      const customersQuery = query(customersRef, where('type', '!=', 'vendor'));
      const snapshot = await getDocs(customersQuery);
      
      const customersList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  };

  const fetchDispatchLogs = async () => {
    try {
      setLoading(true);
      const logsRef = getUserCollection('dispatchLogs');
      const snapshot = await getDocs(query(logsRef, orderBy('createdAt', 'desc')));
      
      const logsList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      
      setDispatchLogs(logsList);
    } catch (error) {
      console.error('Error fetching dispatch logs:', error);
      setError('Failed to fetch dispatch logs');
    } finally {
      setLoading(false);
    }
  };

  const generateLogId = async () => {
    try {
      const logsRef = getUserCollection('dispatchLogs');
      const snapshot = await getDocs(logsRef);
      
      const existingIds = snapshot.docs.map(doc => doc.data().logId || '').filter(id => id.startsWith('L'));
      
      const numbers = existingIds.map(id => {
        const match = id.match(/L(\d+)/);
        return match ? parseInt(match[1]) : 0;
      });
      
      const nextNumber = numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
      return `L${nextNumber.toString().padStart(2, '0')}`;
    } catch (error) {
      console.error('Error generating log ID:', error);
      return `L${Date.now().toString().slice(-2)}`;
    }
  };

  const formatPowerValue = (value) => {
    if (!value || value === '') return '';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return value;
    
    const formatted = Math.abs(numValue).toFixed(2);
    const sign = numValue >= 0 ? '+' : '-';
    
    return `${sign}${formatted}`;
  };

  const handlePowerBlur = (index, field, value) => {
    if (field === 'sph' || field === 'cyl' || field === 'add') {
      const formattedValue = formatPowerValue(value);
      handleRowChange(index, field, formattedValue);
    }
  };

  const handleRowChange = (index, field, value) => {
    const updatedRows = [...dispatchRows];
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };
    setDispatchRows(updatedRows);
  };

  const handleItemSelect = (index, itemData) => {
    const updatedRows = [...dispatchRows];
    
    // Extract proper item name based on type - prioritize the display name from suggestions
    let cleanItemName = '';
    
    // First priority: use the display name from the suggestion (this is what user saw and selected)
    if (itemData.name && itemData.name.trim()) {
      cleanItemName = itemData.name.trim();
    }
    // Second priority: use itemName field
    else if (itemData.itemName && itemData.itemName.trim()) {
      cleanItemName = itemData.itemName.trim();
    }
    // Third priority: use brandName
    else if (itemData.brandName && itemData.brandName.trim()) {
      cleanItemName = itemData.brandName.trim();
    }
    // Fourth priority: use serviceName for services
    else if (itemData.serviceName && itemData.serviceName.trim()) {
      cleanItemName = itemData.serviceName.trim();
    }
    // Fallback to the raw string if provided
    else if (typeof itemData === 'string') {
      cleanItemName = itemData.trim();
    }
    
    // For services, prioritize serviceName if available
    if (itemData.isService && itemData.serviceData && itemData.serviceData.serviceName) {
      cleanItemName = itemData.serviceData.serviceName.trim();
    } else if (itemData.isService && itemData.serviceName) {
      cleanItemName = itemData.serviceName.trim();
    }
    
    updatedRows[index] = {
      ...updatedRows[index],
      itemName: cleanItemName,
    };
    setDispatchRows(updatedRows);
  };

  const addRow = () => {
    const newRows = Array(5).fill().map((_, i) => ({
      id: dispatchRows.length + i + 1,
      slNo: dispatchRows.length + i + 1,
      itemName: '',
      sph: '',
      cyl: '',
      axis: '',
      add: '',
      qty: 1
    }));
    
    setDispatchRows([...dispatchRows, ...newRows]);
  };

  const removeRow = (index) => {
    if (dispatchRows.length <= 1) return;
    const updatedRows = dispatchRows.filter((_, i) => i !== index);
    const reindexedRows = updatedRows.map((row, i) => ({
      ...row,
      id: i + 1,
      slNo: i + 1
    }));
    setDispatchRows(reindexedRows);
  };

  const resetForm = () => {
    setDispatchRows(Array(5).fill().map((_, index) => ({
      id: index + 1,
      slNo: index + 1,
      itemName: '',
      sph: '',
      cyl: '',
      axis: '',
      add: '',
      qty: 1
    })));
    setSelectedOptical('');
    setEditMode(false);
    setEditingLogId(null);
    setEditingDocId(null);
  };

  const handleEdit = (log) => {
    try {
      setEditMode(true);
      setEditingLogId(log.logId);
      setEditingDocId(log.id);
      setSelectedDate(log.date);
      setSelectedOptical(log.opticalShop);
      
      // Populate form with existing data
      if (log.items && log.items.length > 0) {
        const editRows = log.items.map((item, index) => ({
          id: index + 1,
          slNo: index + 1,
          itemName: item.itemName || '',
          sph: item.sph || '',
          cyl: item.cyl || '',
          axis: item.axis || '',
          add: item.add || '',
          qty: item.qty || 1
        }));
        
        // Ensure minimum 5 rows
        while (editRows.length < 5) {
          editRows.push({
            id: editRows.length + 1,
            slNo: editRows.length + 1,
            itemName: '',
            sph: '',
            cyl: '',
            axis: '',
            add: '',
            qty: 1
          });
        }
        
        setDispatchRows(editRows);
      }
      
      // Scroll to top of form
      window.scrollTo({ top: 0, behavior: 'smooth' });
      
    } catch (error) {
      console.error('Error setting up edit mode:', error);
      setError('Failed to load log for editing');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedOptical) {
      setError('Please select an optical shop');
      return;
    }

    const validRows = dispatchRows.filter(row => 
      row.itemName && row.itemName.trim() !== ''
    );

    if (validRows.length === 0) {
      setError('Please add at least one dispatch item');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const dispatchData = {
        date: selectedDate,
        opticalShop: selectedOptical,
        items: validRows,
        totalQty: validRows.reduce((sum, row) => sum + (parseFloat(row.qty) || 0), 0),
        updatedAt: Timestamp.now()
      };

      if (editMode && editingDocId) {
        // Update existing log
        dispatchData.logId = editingLogId;
        await updateDoc(getUserDoc('dispatchLogs', editingDocId), dispatchData);
        setSuccess(`Dispatch log ${editingLogId} updated successfully!`);
      } else {
        // Create new log
        const logId = await generateLogId();
        dispatchData.logId = logId;
        dispatchData.createdAt = Timestamp.now();
        await addDoc(getUserCollection('dispatchLogs'), dispatchData);
        setSuccess(`Dispatch log ${logId} saved successfully!`);
      }
      
      resetForm();
      fetchDispatchLogs();
      setTimeout(() => setSuccess(''), 3000);
      
    } catch (error) {
      console.error('Error saving dispatch log:', error);
      setError(`Failed to save dispatch log: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteLog = async (logId, docId) => {
    if (window.confirm(`Are you sure you want to delete dispatch log ${logId}?`)) {
      try {
        setLoading(true);
        await deleteDoc(getUserDoc('dispatchLogs', docId));
        setSuccess(`Dispatch log ${logId} deleted successfully!`);
        fetchDispatchLogs();
        setTimeout(() => setSuccess(''), 3000);
      } catch (error) {
        console.error('Error deleting dispatch log:', error);
        setError(`Failed to delete dispatch log: ${error.message}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const formatDate = (timestamp) => {
    return utilFormatDate(timestamp) || 'N/A';
  };

  const renderOpticalShop = (customer, index, isSelected) => (
    <div
      key={customer.id}
      className={`px-3 py-2 cursor-pointer border-b border-gray-100 last:border-b-0 ${
        isSelected ? 'bg-sky-50' : 'hover:bg-gray-50'
      }`}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedOptical(customer.opticalName);
      }}
    >
      <div className="flex flex-col">
        <span className="font-medium text-sm">{customer.opticalName}</span>
        {customer.contactPerson && (
          <span className="text-xs text-gray-500">{customer.contactPerson}</span>
        )}
        {customer.city && (
          <span className="text-xs text-gray-400">{customer.city}</span>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
            <div className="w-full">
              <p className="text-center text-lg" style={{ color: 'var(--text-muted)' }}>
                Track daily lens dispatches to optical shops
              </p>
            </div>
            {editMode && (
              <div className="mt-4 sm:mt-0">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                  Editing Log: {editingLogId}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Status Messages */}
        {error && (
          <div className="mb-6 p-4 border-l-4 border-red-400 rounded-r-md text-red-700" 
               style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">{error}</p>
              </div>
            </div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 border-l-4 border-green-400 rounded-r-md text-green-700" 
               style={{ backgroundColor: 'var(--bg-tertiary)' }}>
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm">{success}</p>
              </div>
            </div>
          </div>
        )}

        {/* Dispatch Form */}
        <div className="card p-6 mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              {editMode ? 'Edit Dispatch Entry' : 'New Dispatch Entry'}
            </h2>
            {editMode && (
              <button
                onClick={resetForm}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none text-sm"
              >
                Cancel Edit
              </button>
            )}
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Date and Optical Shop Selection */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Dispatch Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="form-input w-full"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                  Optical Shop
                </label>
                <AutocompleteInput
                  items={customers}
                  value={selectedOptical}
                  onChange={setSelectedOptical}
                  placeholder="Type to search optical shop..."
                  displayField="opticalName"
                  valueField="opticalName"
                  renderItem={renderOpticalShop}
                  className="w-full"
                />
              </div>
            </div>

            {/* Dispatch Items Table */}
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                  Dispatch Items
                </h3>
                <button
                  type="button"
                  onClick={addRow}
                  className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add 5 Rows
                </button>
              </div>

              <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-primary)' }}>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                    <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                      <tr>
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider" 
                            style={{ color: 'var(--text-muted)', width: '60px' }}>
                          SL NO
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider" 
                            style={{ color: 'var(--text-muted)', minWidth: '250px' }}>
                          Item Name
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider" 
                            style={{ color: 'var(--text-muted)', width: '100px' }}>
                          SPH
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider" 
                            style={{ color: 'var(--text-muted)', width: '100px' }}>
                          CYL
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider" 
                            style={{ color: 'var(--text-muted)', width: '100px' }}>
                          AXIS
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider" 
                            style={{ color: 'var(--text-muted)', width: '100px' }}>
                          ADD
                        </th>
                        <th className="px-3 py-3 text-center text-xs font-medium uppercase tracking-wider" 
                            style={{ color: 'var(--text-muted)', width: '120px' }}>
                          Qty (Pairs)
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider" 
                            style={{ color: 'var(--text-muted)', width: '100px' }}>
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                      {dispatchRows.map((row, index) => (
                        <tr key={row.id} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-center">
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium" 
                                    style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                                {row.slNo}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <ItemSuggestions
                              items={lensInventory}
                              value={row.itemName}
                              onChange={handleRowChange}
                              onSelect={handleItemSelect}
                              index={index}
                              rowQty={row.qty}
                              placeholder="Enter item name..."
                              className="w-full px-3 py-2 text-sm border rounded-lg form-input"
                              onRefreshItems={fetchLensInventory}
                              currentPrice={0}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.sph}
                              onChange={(e) => handleRowChange(index, 'sph', e.target.value)}
                              onBlur={(e) => handlePowerBlur(index, 'sph', e.target.value)}
                              className="w-full px-2 py-2 text-sm border rounded-lg form-input text-center"
                              placeholder="SPH"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.cyl}
                              onChange={(e) => handleRowChange(index, 'cyl', e.target.value)}
                              onBlur={(e) => handlePowerBlur(index, 'cyl', e.target.value)}
                              className="w-full px-2 py-2 text-sm border rounded-lg form-input text-center"
                              placeholder="CYL"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.axis}
                              onChange={(e) => handleRowChange(index, 'axis', e.target.value)}
                              className="w-full px-2 py-2 text-sm border rounded-lg form-input text-center"
                              placeholder="AXIS"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              value={row.add}
                              onChange={(e) => handleRowChange(index, 'add', e.target.value)}
                              onBlur={(e) => handlePowerBlur(index, 'add', e.target.value)}
                              className="w-full px-2 py-2 text-sm border rounded-lg form-input text-center"
                              placeholder="ADD"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="number"
                              min="0"
                              step="0.5"
                              value={row.qty}
                              onChange={(e) => handleRowChange(index, 'qty', e.target.value)}
                              className="w-full px-2 py-2 text-sm border rounded-lg form-input text-center"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => removeRow(index)}
                              className="inline-flex items-center px-2 py-1 text-xs font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded"
                              disabled={dispatchRows.length <= 1}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4">
              {editMode && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {loading ? 'Saving...' : editMode ? 'Update Dispatch Log' : 'Save Dispatch Log'}
              </button>
            </div>
          </form>
        </div>

        {/* Dispatch Logs List */}
        <div className="card p-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center mb-6 space-y-4 lg:space-y-0">
            <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
              Dispatch Logs
            </h2>
            
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Filter by Date
                </label>
                <input
                  type="date"
                  value={logFilterDate}
                  onChange={(e) => {
                    try {
                      setLogFilterDate(e.target.value);
                    } catch (error) {
                      console.error('Date filter error:', error);
                    }
                  }}
                  className="form-input text-sm w-full sm:w-auto"
                />
              </div>
              <div className="flex-1 sm:flex-none">
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  Filter by Optical Shop
                </label>
                <input
                  type="text"
                  value={logFilterOptical}
                  onChange={(e) => {
                    try {
                      setLogFilterOptical(e.target.value);
                    } catch (error) {
                      console.error('Optical filter error:', error);
                      setLogFilterOptical('');
                    }
                  }}
                  placeholder="Search optical shop..."
                  className="form-input text-sm w-full sm:w-auto"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    try {
                      setLogFilterDate('');
                      setLogFilterOptical('');
                    } catch (error) {
                      console.error('Clear filters error:', error);
                    }
                  }}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg text-sm hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
          
          {loading && (
            <div className="flex justify-center items-center py-12">
              <div className="flex items-center">
                <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="ml-3 text-base" style={{ color: 'var(--text-muted)' }}>Loading logs...</span>
              </div>
            </div>
          )}

          {!loading && filteredLogs.length === 0 && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M34 40h10v-4a6 6 0 00-10.712-3.714M34 40H14m20 0v-4a9.971 9.971 0 00-.712-3.714M14 40H4v-4a6 6 0 0110.713-3.714M14 40v-4c0-1.313.253-2.6.713-3.714M4 36v-4a9.97 9.97 0 01.713-3.714A8.003 8.003 0 0112 20c4.418 0 8 3.582 8 8 0 1.313-.253 2.6-.713 3.714" />
              </svg>
              <h3 className="mt-4 text-lg font-medium" style={{ color: 'var(--text-primary)' }}>No dispatch logs found</h3>
              <p className="mt-2" style={{ color: 'var(--text-muted)' }}>
                {logFilterDate || logFilterOptical 
                  ? 'No dispatch logs match your current filters. Try adjusting the filters or clear them to see all logs.' 
                  : 'No dispatch logs have been created yet. Create your first dispatch log using the form above.'}
              </p>
            </div>
          )}

          {!loading && filteredLogs.length > 0 && (
            <div className="space-y-6">
              {filteredLogs.map((log) => (
                <div key={log.id} className="border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="px-6 py-4" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start space-y-2 sm:space-y-0">
                      <div>
                        <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                          Log ID: {log.logId}
                        </h3>
                        <div className="flex flex-wrap gap-4 mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                          <span>📅 {log.date}</span>
                          <span>🏪 {log.opticalShop}</span>
                          <span>📦 {log.totalQty} pairs</span>
                          <span>📅 Created: {formatDate(log.createdAt)}</span>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(log)}
                          className="inline-flex items-center px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-md"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                          Edit
                        </button>
                        <button
                          onClick={() => deleteLog(log.logId, log.id)}
                          className="inline-flex items-center px-3 py-1 text-sm font-medium text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md"
                        >
                          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  <div className="px-6 py-4">
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>SL</th>
                            <th className="px-3 py-2 text-left font-medium" style={{ color: 'var(--text-muted)' }}>Item Name</th>
                            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>SPH</th>
                            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>CYL</th>
                            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>AXIS</th>
                            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>ADD</th>
                            <th className="px-3 py-2 text-center font-medium" style={{ color: 'var(--text-muted)' }}>Qty</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                          {log.items && log.items.map((item, index) => (
                            <tr key={index} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                              <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{item.slNo || index + 1}</td>
                              <td className="px-3 py-2 font-medium text-left" style={{ color: 'var(--text-primary)' }}>{item.itemName}</td>
                              <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{item.sph || '-'}</td>
                              <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{item.cyl || '-'}</td>
                              <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{item.axis || '-'}</td>
                              <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{item.add || '-'}</td>
                              <td className="px-3 py-2 text-center" style={{ color: 'var(--text-primary)' }}>{item.qty} pairs</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyDispatchLog; 
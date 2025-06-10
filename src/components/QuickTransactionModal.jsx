import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import { calculateCustomerBalance, formatCurrency, getBalanceColorClass, getBalanceStatusText } from '../utils/ledgerUtils';
import { dateToISOString } from '../utils/dateUtils';

const QuickTransactionModal = ({ isOpen, onClose, preSelectedCustomer = null, onTransactionSaved }) => {
  const [transactionType, setTransactionType] = useState('received');
  const [entities, setEntities] = useState([]);
  const [filteredEntities, setFilteredEntities] = useState([]);
  const [selectedEntityIndex, setSelectedEntityIndex] = useState(-1);
  const [showEntityList, setShowEntityList] = useState(false);
  const [suggestionBalances, setSuggestionBalances] = useState({});
  const [loadingSuggestionBalances, setLoadingSuggestionBalances] = useState(false);
  
  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayString = () => {
    return dateToISOString(new Date()).split('T')[0];
  };
  
  // Transaction form data
  const [transaction, setTransaction] = useState({
    entityName: '',
    entityId: '',
    amount: '',
    date: getTodayString(),
    paymentMethod: 'cash',
    notes: ''
  });
  
  const [entityBalance, setEntityBalance] = useState(null);
  const [loadingBalance, setLoadingBalance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Initialize with pre-selected customer if provided
  useEffect(() => {
    if (isOpen) {
      fetchEntities();
      if (preSelectedCustomer) {
        setTransaction(prev => ({
          ...prev,
          entityName: preSelectedCustomer.opticalName || '',
          entityId: preSelectedCustomer.id || ''
        }));
        if (preSelectedCustomer.id) {
          calculateEntityBalance(preSelectedCustomer.id, preSelectedCustomer.openingBalance || 0);
        }
      }
    }
  }, [isOpen, preSelectedCustomer]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess(false);
    } else {
      // Reset form when closing
      setTransaction({
        entityName: '',
        entityId: '',
        amount: '',
        date: getTodayString(),
        paymentMethod: 'cash',
        notes: ''
      });
      setEntityBalance(null);
      setFilteredEntities([]);
      setShowEntityList(false);
      setSuggestionBalances({});
    }
  }, [isOpen]);

  // Handle keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      // ESC to close
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      
      // Ctrl+Enter to save
      if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSubmit(e);
        return;
      }
      
      // Handle entity selection with arrow keys
      if (showEntityList && filteredEntities.length > 0) {
        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault();
            setSelectedEntityIndex(prev => 
              prev < filteredEntities.length - 1 ? prev + 1 : prev
            );
            break;
          case 'ArrowUp':
            e.preventDefault();
            setSelectedEntityIndex(prev => (prev > 0 ? prev - 1 : 0));
            break;
          case 'Enter':
            if (selectedEntityIndex >= 0 && selectedEntityIndex < filteredEntities.length) {
              e.preventDefault();
              handleEntitySelect(filteredEntities[selectedEntityIndex]);
            }
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, showEntityList, filteredEntities, selectedEntityIndex]);

  const fetchEntities = async () => {
    try {
      const entitiesRef = getUserCollection('customers');
      const q = query(entitiesRef, orderBy('opticalName'));
      const snapshot = await getDocs(q);
      
      const entitiesList = snapshot.docs
        .filter(doc => !doc.data()._placeholder)
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      
      setEntities(entitiesList);
    } catch (error) {
      console.error('Error fetching entities:', error);
      setError('Failed to fetch entities');
    }
  };

  const handleSearch = async (value) => {
    setTransaction(prev => ({ ...prev, entityName: value }));
    
    if (value.trim() === '') {
      setFilteredEntities([]);
      setShowEntityList(false);
      setSuggestionBalances({});
      return;
    }
    
    const filtered = entities.filter(entity => 
      entity.opticalName.toLowerCase().includes(value.toLowerCase()) ||
      (entity.contactPerson && entity.contactPerson.toLowerCase().includes(value.toLowerCase()))
    );
    
    setFilteredEntities(filtered);
    setShowEntityList(filtered.length > 0);
    setSelectedEntityIndex(-1);
    
    // Calculate balances for suggestions
    if (filtered.length > 0) {
      setLoadingSuggestionBalances(true);
      const balances = {};
      
      try {
        await Promise.all(
          filtered.map(async (entity) => {
            try {
              const balance = await calculateCustomerBalance(entity.id, entity.openingBalance || 0);
              balances[entity.id] = balance;
            } catch (error) {
              console.error(`Error calculating balance for entity ${entity.id}:`, error);
              balances[entity.id] = entity.openingBalance || 0;
            }
          })
        );
        
        setSuggestionBalances(balances);
      } catch (error) {
        console.error('Error calculating suggestion balances:', error);
      } finally {
        setLoadingSuggestionBalances(false);
      }
    }
  };

  const handleEntitySelect = async (entity) => {
    setTransaction(prev => ({
      ...prev,
      entityName: entity.opticalName,
      entityId: entity.id
    }));
    setShowEntityList(false);
    
    // Calculate current balance for selected entity
    await calculateEntityBalance(entity.id, entity.openingBalance || 0);
  };

  const calculateEntityBalance = async (entityId, openingBalance) => {
    try {
      setLoadingBalance(true);
      const balance = await calculateCustomerBalance(entityId, openingBalance);
      setEntityBalance(balance);
    } catch (error) {
      console.error('Error calculating entity balance:', error);
      setEntityBalance(openingBalance);
    } finally {
      setLoadingBalance(false);
    }
  };

  const handleInputChange = (field, value) => {
    setTransaction(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!transaction.entityName || !transaction.amount || parseFloat(transaction.amount) <= 0) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const transactionData = {
        type: transactionType,
        amount: parseFloat(transaction.amount),
        date: transaction.date,
        entityId: transaction.entityId,
        entityName: transaction.entityName,
        notes: transaction.notes || '',
        paymentMethod: transaction.paymentMethod,
        createdAt: serverTimestamp(),
        source: 'quick_entry'
      };
      
      await addDoc(getUserCollection('transactions'), transactionData);
      
      setSuccess(true);
      
      // Call callback if provided
      if (onTransactionSaved) {
        onTransactionSaved(transactionData);
      }
      
      // Close modal after short delay
      setTimeout(() => {
        onClose();
      }, 1000);
      
    } catch (error) {
      console.error('Error saving transaction:', error);
      setError('Failed to save transaction');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentMethodLabel = (method) => {
    switch(method) {
      case 'cash': return 'Cash';
      case 'upi': return 'UPI';
      case 'check': return 'Check';
      case 'bank_transfer': return 'Bank Transfer';
      default: return method;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 transition-opacity" aria-hidden="true">
          <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
        </div>

        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white dark:bg-gray-800 px-4 pt-5 pb-4 sm:p-6">
            {/* Header */}
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Quick Transaction Entry
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Keyboard shortcuts info */}
            <div className="mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-md">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Ctrl+Enter</strong> to save • <strong>ESC</strong> to close • <strong>↑↓</strong> to navigate suggestions
              </p>
            </div>

            {/* Transaction Type Toggle */}
            <div className="mb-4 flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                type="button"
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium ${
                  transactionType === 'received' 
                    ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                onClick={() => setTransactionType('received')}
              >
                Amount Received
              </button>
              <button
                type="button"
                className={`flex-1 py-2 px-3 rounded-md text-sm font-medium ${
                  transactionType === 'paid' 
                    ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 shadow-sm' 
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
                onClick={() => setTransactionType('paid')}
              >
                Amount Paid
              </button>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 rounded-md">
                Transaction saved successfully! Closing...
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-md">
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Party Name */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Party Name
                </label>
                <input
                  type="text"
                  value={transaction.entityName}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search party..."
                  className="w-full border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  autoFocus
                />
                {showEntityList && filteredEntities.length > 0 && (
                  <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-md py-1 text-sm overflow-auto border border-gray-300 dark:border-gray-600">
                    {filteredEntities.map((entity, idx) => (
                      <div
                        key={entity.id}
                        onClick={() => handleEntitySelect(entity)}
                        onMouseEnter={() => setSelectedEntityIndex(idx)}
                        className={`cursor-pointer py-3 pl-3 pr-3 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                          selectedEntityIndex === idx ? 'bg-blue-50 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300' : ''
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium block truncate text-gray-900 dark:text-white">
                              {entity.opticalName}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              {entity.city && (
                                <span className="text-gray-500 dark:text-gray-400 text-xs flex items-center">
                                  <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/>
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/>
                                  </svg>
                                  {entity.city}
                                </span>
                              )}
                              {entity.contactPerson && (
                                <span className="text-gray-500 dark:text-gray-400 text-xs">
                                  • {entity.contactPerson}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="ml-3 text-right">
                            {loadingSuggestionBalances ? (
                              <div className="flex items-center text-xs text-gray-400">
                                <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              </div>
                            ) : suggestionBalances[entity.id] !== undefined ? (
                              <div className="text-xs">
                                <div className={`font-medium ${getBalanceColorClass(suggestionBalances[entity.id])}`}>
                                  {formatCurrency(Math.abs(suggestionBalances[entity.id]))}
                                </div>
                                <div className="text-gray-500 dark:text-gray-400">
                                  {getBalanceStatusText(suggestionBalances[entity.id])}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-400">
                                Balance: --
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Current Balance Display */}
              {transaction.entityId && (
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Current Balance:</span>
                    {loadingBalance ? (
                      <div className="flex items-center text-xs text-gray-400">
                        <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Loading...
                      </div>
                    ) : entityBalance !== null ? (
                      <div className="text-right">
                        <div className={`font-semibold ${getBalanceColorClass(entityBalance)}`}>
                          {formatCurrency(Math.abs(entityBalance))}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {getBalanceStatusText(entityBalance)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm text-gray-500 dark:text-gray-400">--</span>
                    )}
                  </div>
                </div>
              )}

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500 dark:text-gray-400 sm:text-sm">₹</span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    value={transaction.amount}
                    onChange={(e) => handleInputChange('amount', e.target.value)}
                    className="w-full pl-8 border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                    placeholder="0.00"
                  />
                </div>
              </div>

              {/* Date and Payment Method */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={transaction.date}
                    onChange={(e) => handleInputChange('date', e.target.value)}
                    className="w-full border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={transaction.paymentMethod}
                    onChange={(e) => handleInputChange('paymentMethod', e.target.value)}
                    className="w-full border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="check">Check</option>
                    <option value="bank_transfer">Bank Transfer</option>
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={transaction.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  className="w-full border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  rows="2"
                  placeholder="Additional information..."
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-3 pt-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 dark:bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Transaction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default QuickTransactionModal; 
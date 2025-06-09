import React, { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, serverTimestamp, query, where, orderBy, doc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { calculateCustomerBalance, formatCurrency, getBalanceColorClass, getBalanceStatusText } from '../utils/ledgerUtils';
import { formatDate, formatDateTime, dateToISOString } from '../utils/dateUtils';

const Transactions = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [transactionType, setTransactionType] = useState('received'); // 'received' or 'paid'
  
  // Helper function to get today's date in YYYY-MM-DD format
  const getTodayString = () => {
    return dateToISOString(new Date()).split('T')[0];
  };
  
  // For batch transaction entry
  const [batchTransactions, setBatchTransactions] = useState(Array(5).fill().map(() => ({
    entityName: '',
    entityId: '',
    amount: '',
    date: getTodayString(),
    paymentMethod: 'cash',
    notes: ''
  })));
  
  // Entity search states
  const [entities, setEntities] = useState([]);
  const [filteredEntities, setFilteredEntities] = useState([]);
  const [activeRowIndex, setActiveRowIndex] = useState(null);
  const [selectedEntityIndex, setSelectedEntityIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEntityList, setShowEntityList] = useState(false);
  
  // For viewing transaction history
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Date range and search filters
  const [fromDate, setFromDate] = useState(getTodayString());
  const [toDate, setToDate] = useState(getTodayString());
  const [shopNameSearch, setShopNameSearch] = useState('');
  
  // For editing transactions
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  
  // New states for balance calculation
  const [entityBalances, setEntityBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  // New state for suggestion balances
  const [suggestionBalances, setSuggestionBalances] = useState({});
  const [loadingSuggestionBalances, setLoadingSuggestionBalances] = useState(false);
  
  useEffect(() => {
    fetchEntities();
    fetchTransactions().then(() => {
      // Check if we were passed a transaction ID to edit
      if (location.state?.editTransactionId) {
        const transactionToEdit = transactions.find(t => t.id === location.state.editTransactionId);
        if (transactionToEdit) {
          handleEdit(transactionToEdit);
        } else {
          // If not found in current list, fetch it directly
          fetchTransactionToEdit(location.state.editTransactionId);
        }
        
        // Clear the state to prevent reopening on refresh
        navigate(location.pathname, { replace: true, state: {} });
      }
    });
  }, []);
  
  // Auto-fetch transactions when filters change
  useEffect(() => {
    fetchTransactions();
  }, [transactionType, fromDate, toDate, shopNameSearch]);
  
  const fetchEntities = async () => {
    try {
      setLoading(true);
      
      // For 'received', fetch customers
      // For 'paid', fetch vendors (we'll use customers for now, could be separated later)
      const entitiesRef = getUserCollection('customers');
      const q = query(entitiesRef, orderBy('opticalName'));
      const snapshot = await getDocs(q);
      
      const entitiesList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      
      setEntities(entitiesList);
    } catch (error) {
      console.error('Error fetching entities:', error);
      setError('Failed to fetch entities');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Fetching transactions for type:', transactionType);
      
      const transactionsRef = getUserCollection('transactions');
      
      // Build query with type filter
      const q = query(
        transactionsRef,
        where('type', '==', transactionType)
      );
      
      const snapshot = await getDocs(q);
      console.log('Filtered transactions:', snapshot.docs.length);
      
      // Get transactions from snapshot data
      let transactionsList = snapshot.docs
        .filter(doc => !doc.data()._placeholder) // Filter out placeholder documents
        .map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data
          };
        });
      
      // Filter by date range
      if (fromDate || toDate) {
        transactionsList = transactionsList.filter(transaction => {
          const transactionDate = transaction.date;
          if (!transactionDate) return false;
          
          const isAfterFromDate = !fromDate || transactionDate >= fromDate;
          const isBeforeToDate = !toDate || transactionDate <= toDate;
          
          return isAfterFromDate && isBeforeToDate;
        });
      }
      
      // Filter by shop name
      if (shopNameSearch.trim()) {
        const searchTerm = shopNameSearch.toLowerCase().trim();
        transactionsList = transactionsList.filter(transaction => 
          transaction.entityName && 
          transaction.entityName.toLowerCase().includes(searchTerm)
        );
      }
      
      // Sort in memory by createdAt timestamp (most recent first)
      transactionsList.sort((a, b) => {
        // Handle missing createdAt fields
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        
        // Convert Firestore timestamps to milliseconds for comparison
        const aTime = a.createdAt.toMillis ? a.createdAt.toMillis() : a.createdAt;
        const bTime = b.createdAt.toMillis ? b.createdAt.toMillis() : b.createdAt;
        
        return bTime - aTime; // Descending order (newest first)
      });
      
      console.log('Setting transactions:', transactionsList);
      setTransactions(transactionsList);
      
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError('Failed to fetch transactions: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (value) => {
    setSearchTerm(value);
    
    if (value.trim() === '') {
      setFilteredEntities([]);
      setShowEntityList(false);
      setSuggestionBalances({}); // Clear suggestion balances
      return;
    }
    
    const filtered = entities.filter(entity => 
      entity.opticalName.toLowerCase().includes(value.toLowerCase()) ||
      (entity.contactPerson && entity.contactPerson.toLowerCase().includes(value.toLowerCase()))
    );
    
    setFilteredEntities(filtered);
    setShowEntityList(filtered.length > 0);
    setSelectedEntityIndex(-1); // Reset the selected index when search results change
    
    // Calculate balances for suggestion entities
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
  
  const handleKeyDown = (e, rowIndex) => {
    // Only handle keys if suggestions are showing and we have filtered entities
    if (!showEntityList || filteredEntities.length === 0 || activeRowIndex !== rowIndex) return;
    
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
          handleEntitySelect(filteredEntities[selectedEntityIndex], rowIndex);
        }
        break;
      case 'Tab':
        if (selectedEntityIndex >= 0 && selectedEntityIndex < filteredEntities.length) {
          e.preventDefault();
          handleEntitySelect(filteredEntities[selectedEntityIndex], rowIndex);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setShowEntityList(false);
        break;
      default:
        break;
    }
  };
  
  const handleEntitySelect = async (entity, rowIndex) => {
    const updatedTransactions = [...batchTransactions];
    updatedTransactions[rowIndex] = {
      ...updatedTransactions[rowIndex],
      entityName: entity.opticalName,
      entityId: entity.id
    };
    setBatchTransactions(updatedTransactions);
    setShowEntityList(false);
    setActiveRowIndex(null);
    
    // Calculate and show current balance for selected entity
    try {
      const balance = await calculateCustomerBalance(entity.id, entity.openingBalance || 0);
      setEntityBalances(prev => ({ ...prev, [entity.id]: balance }));
    } catch (error) {
      console.error('Error calculating entity balance:', error);
    }
  };
  
  const handleInputChange = (rowIndex, field, value) => {
    const updatedTransactions = [...batchTransactions];
    updatedTransactions[rowIndex] = {
      ...updatedTransactions[rowIndex],
      [field]: value
    };
    setBatchTransactions(updatedTransactions);
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Filter out empty rows
    const transactionsToSave = batchTransactions.filter(
      transaction => transaction.entityName && transaction.amount && parseFloat(transaction.amount) > 0
    );
    
    if (transactionsToSave.length === 0) {
      setError('Please add at least one valid transaction');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      console.log('Saving transactions:', transactionsToSave);
      
      // Save each transaction to Firestore
      for (const transaction of transactionsToSave) {
        const transactionData = {
          type: transactionType,
          amount: parseFloat(transaction.amount),
          date: transaction.date,
          entityId: transaction.entityId,
          entityName: transaction.entityName,
          notes: transaction.notes || '',
          paymentMethod: transaction.paymentMethod,
          createdAt: serverTimestamp(),
        };
        
        console.log('Saving transaction data:', transactionData);
        const docRef = await addDoc(getUserCollection('transactions'), transactionData);
        console.log('Transaction saved with ID:', docRef.id);
      }
      
      // Reset form
      setBatchTransactions(Array(5).fill().map(() => ({
        entityName: '',
        entityId: '',
        amount: '',
        date: getTodayString(),
        paymentMethod: 'cash',
        notes: ''
      })));
      
      // Show success message
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Refresh transactions
      await fetchTransactions();
      
      // Recalculate balances for entities that had new transactions
      const updatedEntitiesIds = [...new Set(transactionsToSave.map(t => t.entityId))];
      const balances = {};
      
      for (const entityId of updatedEntitiesIds) {
        try {
          const entity = entities.find(e => e.id === entityId);
          const balance = await calculateCustomerBalance(entityId, entity?.openingBalance || 0);
          balances[entityId] = balance;
        } catch (error) {
          console.error(`Error recalculating balance for entity ${entityId}:`, error);
        }
      }
      
      setEntityBalances(prev => ({ ...prev, ...balances }));
      
    } catch (error) {
      console.error('Error saving transactions:', error);
      setError('Failed to save transactions');
    } finally {
      setLoading(false);
    }
  };
  
  const formatCurrencyLocal = (amount) => {
    return formatCurrency(amount);
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
  
  const handleEdit = (transaction) => {
    setEditingTransaction({
      ...transaction,
      amount: transaction.amount.toString()
    });
  };
  
  const handleEditChange = (field, value) => {
    setEditingTransaction({
      ...editingTransaction,
      [field]: value
    });
  };
  
  const saveEdit = async () => {
    try {
      setLoading(true);
      setError('');
      
      const transactionRef = getUserDoc('transactions', editingTransaction.id);
      
      const updateData = {
        entityName: editingTransaction.entityName,
        amount: parseFloat(editingTransaction.amount),
        date: editingTransaction.date,
        paymentMethod: editingTransaction.paymentMethod,
        notes: editingTransaction.notes || ''
      };
      
      await updateDoc(transactionRef, updateData);
      
      // Close the edit mode and refresh
      setEditingTransaction(null);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Refresh transactions
      await fetchTransactions();
      
      // Recalculate balance for the edited entity
      try {
        const entity = entities.find(e => e.id === editingTransaction.entityId);
        if (entity) {
          const balance = await calculateCustomerBalance(editingTransaction.entityId, entity.openingBalance || 0);
          setEntityBalances(prev => ({ ...prev, [editingTransaction.entityId]: balance }));
        }
      } catch (error) {
        console.error('Error recalculating balance after edit:', error);
      }
      
    } catch (error) {
      console.error('Error updating transaction:', error);
      setError('Failed to update transaction: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async (transactionId) => {
    try {
      setLoading(true);
      setError('');
      
      // Get the transaction before deleting to know which entity to update
      const transactionToDelete = transactions.find(t => t.id === transactionId);
      
      // Delete from Firestore
      await deleteDoc(getUserDoc('transactions', transactionId));
      
      // Hide confirmation dialog
      setShowDeleteConfirm(null);
      
      // Show success
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
      
      // Refresh the transaction list
      await fetchTransactions();
      
      // Recalculate balance for the deleted transaction's entity
      if (transactionToDelete && transactionToDelete.entityId) {
        try {
          const entity = entities.find(e => e.id === transactionToDelete.entityId);
          if (entity) {
            const balance = await calculateCustomerBalance(transactionToDelete.entityId, entity.openingBalance || 0);
            setEntityBalances(prev => ({ ...prev, [transactionToDelete.entityId]: balance }));
          }
        } catch (error) {
          console.error('Error recalculating balance after delete:', error);
        }
      }
      
    } catch (error) {
      console.error('Error deleting transaction:', error);
      setError('Failed to delete transaction: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const cancelEdit = () => {
    setEditingTransaction(null);
  };
  
  // Fetch a specific transaction for editing
  const fetchTransactionToEdit = async (transactionId) => {
    try {
      setLoading(true);
      const transactionDoc = await getDoc(getUserDoc('transactions', transactionId));
      
      if (transactionDoc.exists()) {
        const data = transactionDoc.data();
        
        // Switch to the appropriate type tab if necessary
        if (data.type !== transactionType) {
          setTransactionType(data.type || 'received');
        }
        
        // Set to edit mode
        handleEdit({
          id: transactionId,
          ...data
        });
      } else {
        setError('Transaction not found');
      }
    } catch (error) {
      console.error('Error fetching transaction to edit:', error);
      setError('Failed to load transaction for editing');
    } finally {
      setLoading(false);
    }
  };
  
  // New function to calculate and update entity balances
  const updateEntityBalances = async (transactionsToUpdate) => {
    setLoadingBalances(true);
    const balances = {};
    
    try {
      const uniqueEntityIds = [...new Set(transactionsToUpdate.map(t => t.entityId).filter(Boolean))];
      
      await Promise.all(
        uniqueEntityIds.map(async (entityId) => {
          try {
            const entity = entities.find(e => e.id === entityId);
            const balance = await calculateCustomerBalance(entityId, entity?.openingBalance || 0);
            balances[entityId] = balance;
          } catch (error) {
            console.error(`Error calculating balance for entity ${entityId}:`, error);
            const entity = entities.find(e => e.id === entityId);
            balances[entityId] = entity?.openingBalance || 0;
          }
        })
      );
      
      setEntityBalances(prev => ({ ...prev, ...balances }));
    } catch (error) {
      console.error('Error updating entity balances:', error);
    } finally {
      setLoadingBalances(false);
    }
  };
  
  return (
    <div className="mobile-page">
      <Navbar />
      
      <div className="mobile-content">
        {/* View Toggle Buttons - Horizontal Layout */}
        <div className="mb-6 flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
              transactionType === 'received' 
                ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setTransactionType('received')}
          >
            Amount Received
          </button>
          <button
            className={`flex-1 py-2 px-4 rounded-md text-sm font-medium ${
              transactionType === 'paid' 
                ? 'bg-white dark:bg-gray-800 text-blue-700 dark:text-blue-400 shadow-sm' 
                : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
            }`}
            onClick={() => setTransactionType('paid')}
          >
            Amount Paid
          </button>
        </div>
        
        {/* Transaction Form with Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {transactionType === 'received' ? 'Record Payments Received' : 'Record Payments Made'}
          </h2>
          
          {success && (
            <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 rounded-md">
              Transactions saved successfully!
            </div>
          )}
          
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-200 rounded-md">
              {error}
            </div>
          )}
          
          <form onSubmit={handleSubmit}>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Party Name
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Current Balance
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Payment Method
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {batchTransactions.map((transaction, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2 whitespace-nowrap relative">
                        <input
                          type="text"
                          value={transaction.entityName}
                          onFocus={() => {
                            setActiveRowIndex(index);
                            setSearchTerm(transaction.entityName);
                            if (transaction.entityName) {
                              handleSearch(transaction.entityName);
                            }
                          }}
                          onChange={(e) => {
                            handleInputChange(index, 'entityName', e.target.value);
                            handleSearch(e.target.value);
                          }}
                          onKeyDown={(e) => handleKeyDown(e, index)}
                          placeholder="Search party..."
                          className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                        />
                        {activeRowIndex === index && showEntityList && filteredEntities.length > 0 && (
                          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-md py-1 text-sm overflow-auto border border-gray-300 dark:border-gray-600 min-w-[300px]">
                            {filteredEntities.map((entity, idx) => (
                              <div
                                key={entity.id}
                                onClick={() => handleEntitySelect(entity, index)}
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
                                          {formatCurrencyLocal(Math.abs(suggestionBalances[entity.id]))}
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
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {transaction.entityId && entityBalances[transaction.entityId] !== undefined ? (
                          <div className="text-sm">
                            <div className={`font-medium ${getBalanceColorClass(entityBalances[transaction.entityId])}`}>
                              {formatCurrencyLocal(Math.abs(entityBalances[transaction.entityId]))}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              {getBalanceStatusText(entityBalances[transaction.entityId])}
                            </div>
                          </div>
                        ) : transaction.entityId && loadingBalances ? (
                          <div className="flex items-center text-xs text-gray-400">
                            <svg className="animate-spin h-3 w-3 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading...
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400">
                            Select party first
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
                            <span className="text-gray-500 dark:text-gray-400 text-xs">₹</span>
                          </div>
                          <input
                            type="number"
                            step="0.01"
                            value={transaction.amount}
                            onChange={(e) => handleInputChange(index, 'amount', e.target.value)}
                            className="w-full pl-5 text-sm border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                            placeholder="0.00"
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <input
                          type="date"
                          value={transaction.date}
                          onChange={(e) => handleInputChange(index, 'date', e.target.value)}
                          className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <select
                          value={transaction.paymentMethod}
                          onChange={(e) => handleInputChange(index, 'paymentMethod', e.target.value)}
                          className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                        >
                          <option value="cash">Cash</option>
                          <option value="upi">UPI</option>
                          <option value="check">Check</option>
                          <option value="bank_transfer">Bank Transfer</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* Submit Button */}
            <div className="mt-6">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 dark:bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800"
              >
                {loading ? 'Saving...' : 'Save All Transactions'}
              </button>
            </div>
          </form>
        </div>
        
        {/* Filters Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Filter Transactions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Shop Name</label>
              <input
                type="text"
                value={shopNameSearch}
                onChange={(e) => setShopNameSearch(e.target.value)}
                placeholder="Search by shop name..."
                className="w-full text-sm border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>
          </div>
          <div className="mt-4">
            <button
              onClick={fetchTransactions}
              className="px-4 py-2 bg-blue-600 dark:bg-blue-600 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Apply Filters
            </button>
          </div>
        </div>
        
        {/* Transactions List with Edit and Delete */}
        <div className="mb-6">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 dark:border-blue-400 border-t-transparent rounded-full"></div>
            </div>
          ) : error ? (
            <div className="p-4 text-center text-red-500 dark:text-red-400 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              {error}
            </div>
          ) : transactions.length === 0 ? (
            <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
              <svg className="w-16 h-16 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400">No transactions found</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
              {success && (
                <div className="m-4 p-3 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-200 rounded-md">
                  Transaction updated successfully!
                </div>
              )}
              
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {transactions.map((transaction) => (
                  <li key={transaction.id} className="p-4">
                    {editingTransaction && editingTransaction.id === transaction.id ? (
                      /* Edit Mode */
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Party</label>
                          <input
                            type="text"
                            value={editingTransaction.entityName}
                            onChange={(e) => handleEditChange('entityName', e.target.value)}
                            className="w-full rounded border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount</label>
                            <input
                              type="number"
                              step="0.01"
                              value={editingTransaction.amount}
                              onChange={(e) => handleEditChange('amount', e.target.value)}
                              className="w-full rounded border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date</label>
                            <input
                              type="date"
                              value={editingTransaction.date}
                              onChange={(e) => handleEditChange('date', e.target.value)}
                              className="w-full rounded border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Payment Method</label>
                          <select
                            value={editingTransaction.paymentMethod}
                            onChange={(e) => handleEditChange('paymentMethod', e.target.value)}
                            className="w-full rounded border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          >
                            <option value="cash">Cash</option>
                            <option value="upi">UPI</option>
                            <option value="check">Check</option>
                            <option value="bank_transfer">Bank Transfer</option>
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
                          <textarea
                            value={editingTransaction.notes || ''}
                            onChange={(e) => handleEditChange('notes', e.target.value)}
                            className="w-full rounded border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            rows="2"
                          ></textarea>
                        </div>
                        
                        <div className="flex space-x-2 pt-2">
                          <button
                            onClick={saveEdit}
                            className="flex-1 bg-blue-600 dark:bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 dark:hover:bg-blue-700"
                            disabled={loading}
                          >
                            {loading ? 'Saving...' : 'Save'}
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex-1 bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 py-2 px-4 rounded-md hover:bg-gray-300 dark:hover:bg-gray-500"
                            disabled={loading}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* View Mode */
                      <>
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-medium text-gray-900 dark:text-white">{transaction.entityName}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {formatDate(transaction.date)}
                            </div>
                          </div>
                          <div className={`font-semibold ${transaction.type === 'received' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {transaction.type === 'received' ? '+' : '-'}{formatCurrencyLocal(transaction.amount)}
                          </div>
                        </div>
                        
                        <div className="mt-2 flex justify-between items-center text-sm">
                          <div className="text-gray-500 dark:text-gray-400">
                            {getPaymentMethodLabel(transaction.paymentMethod)}
                            {transaction.referenceNumber && ` • ${transaction.referenceNumber}`}
                          </div>
                          {transaction.invoiceNumber && (
                            <div className="text-blue-600 dark:text-blue-400">Invoice: {transaction.invoiceNumber}</div>
                          )}
                        </div>
                        
                        {transaction.notes && (
                          <div className="mt-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="text-gray-500 dark:text-gray-400">Notes:</span> {transaction.notes}
                          </div>
                        )}
                        
                        {/* Edit and Delete Buttons */}
                        <div className="mt-3 flex justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(transaction)}
                            className="px-3 py-1 text-xs rounded-md bg-blue-50 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/75"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(transaction.id)}
                            className="px-3 py-1 text-xs rounded-md bg-red-50 dark:bg-red-900/50 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/75"
                          >
                            Delete
                          </button>
                        </div>
                        
                        {/* Delete Confirmation */}
                        {showDeleteConfirm === transaction.id && (
                          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/50 rounded-md">
                            <p className="text-sm text-red-600 dark:text-red-400 mb-2">Are you sure you want to delete this transaction?</p>
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleDelete(transaction.id)}
                                className="px-3 py-1 text-xs rounded-md bg-red-600 dark:bg-red-600 text-white hover:bg-red-700 dark:hover:bg-red-700"
                                disabled={loading}
                              >
                                {loading ? 'Deleting...' : 'Yes, Delete'}
                              </button>
                              <button
                                onClick={() => setShowDeleteConfirm(null)}
                                className="px-3 py-1 text-xs rounded-md bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-500"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Transactions; 
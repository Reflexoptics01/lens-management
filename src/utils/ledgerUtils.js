import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

/**
 * Calculate the current balance for a customer/vendor
 * @param {string} customerId - The customer/vendor ID
 * @param {number} openingBalance - The opening balance
 * @returns {Promise<number>} - The current balance
 */
export const calculateCustomerBalance = async (customerId, openingBalance = 0) => {
  try {
    let currentBalance = parseFloat(openingBalance) || 0;
    
    // Get all sales (invoices) for this customer
    const salesRef = collection(db, 'sales');
    const salesQuery = query(salesRef, where('customerId', '==', customerId));
    const salesSnapshot = await getDocs(salesQuery);
    
    // Add all invoice amounts (customer owes us)
    salesSnapshot.docs.forEach(doc => {
      const sale = doc.data();
      const invoiceAmount = parseFloat(sale.totalAmount) || 0;
      const amountPaid = parseFloat(sale.amountPaid) || 0;
      const balanceDue = invoiceAmount - amountPaid;
      currentBalance += balanceDue;
    });
    
    // Get all transactions for this customer
    const transactionsRef = collection(db, 'transactions');
    const transactionsQuery = query(transactionsRef, where('entityId', '==', customerId));
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    // Process each transaction
    transactionsSnapshot.docs.forEach(doc => {
      const transaction = doc.data();
      const amount = parseFloat(transaction.amount) || 0;
      
      if (transaction.type === 'received') {
        // Payment received from customer - reduces their balance (they owe less)
        currentBalance -= amount;
      } else if (transaction.type === 'paid') {
        // Payment made to customer - increases their balance (refund/advance)
        currentBalance += amount;
      }
    });
    
    return currentBalance;
  } catch (error) {
    console.error('Error calculating customer balance:', error);
    return parseFloat(openingBalance) || 0;
  }
};

/**
 * Calculate the current balance for a vendor
 * @param {string} vendorId - The vendor ID
 * @param {number} openingBalance - The opening balance
 * @returns {Promise<number>} - The current balance (amount we owe to vendor)
 */
export const calculateVendorBalance = async (vendorId, openingBalance = 0) => {
  try {
    let currentBalance = parseFloat(openingBalance) || 0;
    
    // Get all purchases from this vendor
    const purchasesRef = collection(db, 'purchases');
    const purchasesQuery = query(purchasesRef, where('vendorId', '==', vendorId));
    const purchasesSnapshot = await getDocs(purchasesQuery);
    
    // Add all purchase amounts (we owe vendor)
    purchasesSnapshot.docs.forEach(doc => {
      const purchase = doc.data();
      const purchaseAmount = parseFloat(purchase.totalAmount || purchase.total) || 0;
      const amountPaid = parseFloat(purchase.amountPaid) || 0;
      const balanceDue = purchaseAmount - amountPaid;
      currentBalance += balanceDue;
    });
    
    // Get all transactions for this vendor
    const transactionsRef = collection(db, 'transactions');
    const transactionsQuery = query(transactionsRef, where('entityId', '==', vendorId));
    const transactionsSnapshot = await getDocs(transactionsQuery);
    
    // Process each transaction
    transactionsSnapshot.docs.forEach(doc => {
      const transaction = doc.data();
      const amount = parseFloat(transaction.amount) || 0;
      
      if (transaction.type === 'paid') {
        // Payment made to vendor - reduces balance (we owe them less)
        currentBalance -= amount;
      } else if (transaction.type === 'received') {
        // Payment received from vendor - increases balance (vendor refund/credit)
        currentBalance += amount;
      }
    });
    
    return currentBalance;
  } catch (error) {
    console.error('Error calculating vendor balance:', error);
    return parseFloat(openingBalance) || 0;
  }
};

/**
 * Format currency for display
 * @param {number} amount - The amount to format
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (amount) => {
  if (amount === undefined || amount === null) return '₹0.00';
  return `₹${parseFloat(amount).toLocaleString('en-IN', { 
    minimumFractionDigits: 2,
    maximumFractionDigits: 2 
  })}`;
};

/**
 * Get balance color class based on amount
 * @param {number} balance - The balance amount
 * @returns {string} - CSS class for styling
 */
export const getBalanceColorClass = (balance) => {
  if (balance > 0) {
    return 'text-red-600 dark:text-red-400'; // Customer owes money
  } else if (balance < 0) {
    return 'text-green-600 dark:text-green-400'; // Customer has credit/advance
  } else {
    return 'text-gray-600 dark:text-gray-400'; // Zero balance
  }
};

/**
 * Get balance status text
 * @param {number} balance - The balance amount
 * @returns {string} - Status text
 */
export const getBalanceStatusText = (balance) => {
  if (balance > 0) {
    return 'Outstanding';
  } else if (balance < 0) {
    return 'Credit';
  } else {
    return 'Settled';
  }
};

/**
 * Detect if an entity is a vendor by checking various sources
 * @param {string} entityId - The entity ID to check
 * @returns {Promise<boolean>} - True if entity is a vendor
 */
export const isVendor = async (entityId) => {
  try {
    // Check if it exists in vendors collection
    try {
      const vendorsRef = collection(db, 'vendors');
      const vendorQuery = query(vendorsRef, where('__name__', '==', entityId));
      const vendorSnapshot = await getDocs(vendorQuery);
      if (!vendorSnapshot.empty) {
        return true;
      }
    } catch (vendorError) {
      // Vendors collection might not exist
    }
    
    // Check if customer is marked as vendor
    const customersRef = collection(db, 'customers');
    const customerQuery = query(customersRef, where('__name__', '==', entityId));
    const customerSnapshot = await getDocs(customerQuery);
    
    if (!customerSnapshot.empty) {
      const customerData = customerSnapshot.docs[0].data();
      if (customerData.isVendor || customerData.type === 'vendor') {
        return true;
      }
    }
    
    // Check if entity has any purchases (indicating it's a vendor)
    const purchasesRef = collection(db, 'purchases');
    const purchaseQuery = query(purchasesRef, where('vendorId', '==', entityId));
    const purchaseSnapshot = await getDocs(purchaseQuery);
    
    return !purchaseSnapshot.empty;
  } catch (error) {
    console.error('Error checking if entity is vendor:', error);
    return false;
  }
}; 
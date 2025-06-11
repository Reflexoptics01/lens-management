import React from 'react';

const ItemTable = ({ items, loading, onEdit, onDelete }) => {
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const getStockStatus = (qty, minStock) => {
    if (qty === 0) return { status: 'Out of Stock', color: 'text-red-600 bg-red-100' };
    if (qty <= minStock) return { status: 'Low Stock', color: 'text-orange-600 bg-orange-100' };
    return { status: 'In Stock', color: 'text-green-600 bg-green-100' };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sky-600"></div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="text-center py-8">
        <svg className="w-12 h-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
        <p className="text-gray-500 dark:text-gray-400">No items found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Item Name
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Category
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Brand
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Stock
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Unit
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Purchase Price
            </th>
            <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Sale Price
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {items.map((item) => {
            const stockStatus = getStockStatus(item.qty, item.minStockLevel);
            
            return (
              <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {item.itemName}
                    </div>
                    {item.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                        {item.description}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                  {item.category || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                  {item.brand || '-'}
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {item.qty || 0}
                  </div>
                  {item.minStockLevel && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Min: {item.minStockLevel}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 text-center text-sm text-gray-900 dark:text-white">
                  {item.unit || 'Pieces'}
                </td>
                <td className="px-6 py-4 text-right text-sm text-gray-900 dark:text-white">
                  {formatCurrency(item.purchasePrice)}
                </td>
                <td className="px-6 py-4 text-right text-sm font-medium text-gray-900 dark:text-white">
                  {formatCurrency(item.salePrice)}
                </td>
                <td className="px-6 py-4 text-center">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${stockStatus.color}`}>
                    {stockStatus.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-center">
                  <div className="flex items-center justify-center space-x-2">
                    <button
                      onClick={() => onEdit(item)}
                      className="text-sky-600 dark:text-sky-400 hover:text-sky-900 dark:hover:text-sky-300"
                      title="Edit Item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => window.open(`/lens-inventory/item/${item.id}`, '_blank')}
                      className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300"
                      title="View Details"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </button>
                    
                    <button
                      onClick={() => onDelete(item.id)}
                      className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                      title="Delete Item"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ItemTable; 
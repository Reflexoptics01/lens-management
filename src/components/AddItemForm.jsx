import React, { useState, useEffect } from 'react';
import { addDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';

const AddItemForm = ({ editMode, itemToEdit, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    itemName: '',
    category: '',
    brand: '',
    description: '',
    unit: 'Pieces',
    purchasePrice: '',
    salePrice: '',
    qty: 1,
    minStockLevel: 5,
    maxStockLevel: 100,
    location: '',
    supplier: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const UNIT_OPTIONS = [
    'Pieces',
    'Dozen',
    'Box',
    'Pair',
    'Set',
    'Pack',
    'Roll',
    'Meter',
    'Gram',
    'Kilogram'
  ];

  const CATEGORY_OPTIONS = [
    'Frames',
    'Cases',
    'Cleaning',
    'Tools',
    'Accessories',
    'Packaging',
    'Display',
    'Other'
  ];

  useEffect(() => {
    if (editMode && itemToEdit) {
      setFormData({
        itemName: itemToEdit.itemName || '',
        category: itemToEdit.category || '',
        brand: itemToEdit.brand || '',
        description: itemToEdit.description || '',
        unit: itemToEdit.unit || 'Pieces',
        purchasePrice: itemToEdit.purchasePrice || '',
        salePrice: itemToEdit.salePrice || '',
        qty: itemToEdit.qty || 1,
        minStockLevel: itemToEdit.minStockLevel || 5,
        maxStockLevel: itemToEdit.maxStockLevel || 100,
        location: itemToEdit.location || '',
        supplier: itemToEdit.supplier || ''
      });
    }
  }, [editMode, itemToEdit]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.itemName.trim()) {
      setError('Item name is required');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const itemData = {
        itemName: formData.itemName.trim(),
        brandName: formData.itemName.trim(), // For compatibility with suggestions
        name: formData.itemName.trim(), // For compatibility with suggestions
        category: formData.category,
        brand: formData.brand,
        description: formData.description,
        unit: formData.unit,
        purchasePrice: parseFloat(formData.purchasePrice) || 0,
        salePrice: parseFloat(formData.salePrice) || 0,
        price: parseFloat(formData.salePrice) || 0, // For compatibility with suggestions
        qty: parseInt(formData.qty) || 0,
        minStockLevel: parseInt(formData.minStockLevel) || 5,
        maxStockLevel: parseInt(formData.maxStockLevel) || 100,
        location: formData.location,
        supplier: formData.supplier,
        type: 'item',
        isItem: true,
        updatedAt: Timestamp.now()
      };

      if (editMode && itemToEdit) {
        await updateDoc(getUserDoc('lensInventory', itemToEdit.id), itemData);
      } else {
        itemData.createdAt = Timestamp.now();
        await addDoc(getUserCollection('lensInventory'), itemData);
      }

      // Dispatch a custom event to notify other components
      window.dispatchEvent(new CustomEvent('lensInventoryUpdated'));
      
      onSubmit();
    } catch (error) {
      console.error('Error saving item:', error);
      setError(`Failed to save item: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
        {editMode ? 'Edit Item' : 'Add New Item'}
      </h2>
      
      {error && (
        <div className="mb-4 p-3 border-l-4 border-red-400 bg-red-50 dark:bg-red-900/50 text-red-700 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Item Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="itemName"
              value={formData.itemName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter item name"
              required
            />
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Category
            </label>
            <select
              name="category"
              value={formData.category}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Select Category</option>
              {CATEGORY_OPTIONS.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Brand
            </label>
            <input
              type="text"
              name="brand"
              value={formData.brand}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter brand name"
            />
          </div>

          {/* Unit */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Unit
            </label>
            <select
              name="unit"
              value={formData.unit}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              {UNIT_OPTIONS.map(unit => (
                <option key={unit} value={unit}>{unit}</option>
              ))}
            </select>
          </div>

          {/* Purchase Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Purchase Price (₹)
            </label>
            <input
              type="number"
              name="purchasePrice"
              value={formData.purchasePrice}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0.00"
            />
          </div>

          {/* Sale Price */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Sale Price (₹) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              name="salePrice"
              value={formData.salePrice}
              onChange={handleInputChange}
              step="0.01"
              min="0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0.00"
              required
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Quantity
            </label>
            <input
              type="number"
              name="qty"
              value={formData.qty}
              onChange={handleInputChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="0"
            />
          </div>

          {/* Min Stock Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Min Stock Level
            </label>
            <input
              type="number"
              name="minStockLevel"
              value={formData.minStockLevel}
              onChange={handleInputChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="5"
            />
          </div>

          {/* Max Stock Level */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Max Stock Level
            </label>
            <input
              type="number"
              name="maxStockLevel"
              value={formData.maxStockLevel}
              onChange={handleInputChange}
              min="0"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="100"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Storage Location
            </label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="e.g., Shelf A, Room 1"
            />
          </div>

          {/* Supplier */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Supplier
            </label>
            <input
              type="text"
              name="supplier"
              value={formData.supplier}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter supplier name"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Description
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleInputChange}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-sky-500 focus:border-sky-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            placeholder="Enter item description..."
          />
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : editMode ? 'Update Item' : 'Add Item'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddItemForm; 
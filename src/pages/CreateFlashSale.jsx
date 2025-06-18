import React, { useState, useEffect } from 'react';
import { collection, getDocs, addDoc } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import Navbar from '../components/Navbar';

const CreateFlashSale = ({ hideNavbar = false }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    discountType: 'percentage', // percentage or fixed
    discountValue: '',
    startDate: '',
    endDate: '',
    maxQuantity: '',
    isActive: true,
    selectedProducts: [],
    category: 'all', // all, lenses, frames, accessories
    minPurchaseAmount: '',
    maxDiscountAmount: ''
  });

  const [availableProducts, setAvailableProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchAvailableProducts();
  }, []);

  const fetchAvailableProducts = async () => {
    try {
      const lensInventoryRef = getUserCollection('lensInventory');
      const snapshot = await getDocs(lensInventoryRef);
      
      const products = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        type: 'lens'
      }));

      setAvailableProducts(products);
    } catch (error) {
      console.error('Error fetching products:', error);
      setError('Failed to load products');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleProductSelection = (productId) => {
    setFormData(prev => ({
      ...prev,
      selectedProducts: prev.selectedProducts.includes(productId)
        ? prev.selectedProducts.filter(id => id !== productId)
        : [...prev.selectedProducts, productId]
    }));
  };

  const selectAllProducts = () => {
    const filteredProducts = getFilteredProducts();
    const allIds = filteredProducts.map(product => product.id);
    setFormData(prev => ({
      ...prev,
      selectedProducts: allIds
    }));
  };

  const clearSelection = () => {
    setFormData(prev => ({
      ...prev,
      selectedProducts: []
    }));
  };

  const getFilteredProducts = () => {
    return availableProducts.filter(product => {
      if (formData.category === 'all') return true;
      if (formData.category === 'lenses') return product.type === 'lens';
      // Add more category filters as needed
      return true;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      // Validate form data
      if (!formData.title.trim()) {
        throw new Error('Flash sale title is required');
      }

      if (!formData.discountValue || formData.discountValue <= 0) {
        throw new Error('Valid discount value is required');
      }

      if (formData.discountType === 'percentage' && formData.discountValue > 100) {
        throw new Error('Percentage discount cannot exceed 100%');
      }

      if (!formData.startDate || !formData.endDate) {
        throw new Error('Start and end dates are required');
      }

      if (new Date(formData.startDate) >= new Date(formData.endDate)) {
        throw new Error('End date must be after start date');
      }

      if (formData.selectedProducts.length === 0) {
        throw new Error('At least one product must be selected');
      }

      // Create flash sale document
      const flashSaleData = {
        ...formData,
        createdAt: new Date(),
        createdBy: 'current-user', // Replace with actual user ID
        status: 'active'
      };

      const flashSalesRef = getUserCollection('flashSales');
      await addDoc(flashSalesRef, flashSaleData);

      setSuccess('Flash sale created successfully!');
      
      // Reset form
      setFormData({
        title: '',
        description: '',
        discountType: 'percentage',
        discountValue: '',
        startDate: '',
        endDate: '',
        maxQuantity: '',
        isActive: true,
        selectedProducts: [],
        category: 'all',
        minPurchaseAmount: '',
        maxDiscountAmount: ''
      });

    } catch (error) {
      console.error('Error creating flash sale:', error);
      setError(error.message || 'Failed to create flash sale');
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = getFilteredProducts();

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {!hideNavbar && <Navbar />}
      
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          {hideNavbar && (
            <div className="mb-4">
              <button
                onClick={() => window.history.back()}
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                <span>Back to Marketplace</span>
              </button>
            </div>
          )}
          
          <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Create Flash Sale
          </h1>
          <p className="text-lg" style={{ color: 'var(--text-muted)' }}>
            Set up limited-time offers to boost sales and clear inventory
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Basic Information
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Flash Sale Title *
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Weekend Lens Clearance - 50% Off"
                  className="form-input"
                  required
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Describe the flash sale offer..."
                  rows={3}
                  className="form-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Start Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => handleInputChange('startDate', e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  End Date & Time *
                </label>
                <input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => handleInputChange('endDate', e.target.value)}
                  className="form-input"
                  required
                />
              </div>
            </div>
          </div>

          {/* Discount Configuration */}
          <div className="card">
            <h2 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Discount Configuration
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Discount Type *
                </label>
                <select
                  value={formData.discountType}
                  onChange={(e) => handleInputChange('discountType', e.target.value)}
                  className="form-input"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount (₹)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Discount Value *
                </label>
                <input
                  type="number"
                  value={formData.discountValue}
                  onChange={(e) => handleInputChange('discountValue', e.target.value)}
                  placeholder={formData.discountType === 'percentage' ? 'e.g., 25' : 'e.g., 500'}
                  className="form-input"
                  min="0"
                  max={formData.discountType === 'percentage' ? '100' : undefined}
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Max Quantity (Optional)
                </label>
                <input
                  type="number"
                  value={formData.maxQuantity}
                  onChange={(e) => handleInputChange('maxQuantity', e.target.value)}
                  placeholder="Limit total sales"
                  className="form-input"
                  min="1"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Min Purchase Amount (₹)
                </label>
                <input
                  type="number"
                  value={formData.minPurchaseAmount}
                  onChange={(e) => handleInputChange('minPurchaseAmount', e.target.value)}
                  placeholder="Minimum order value"
                  className="form-input"
                  min="0"
                />
              </div>

              {formData.discountType === 'percentage' && (
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    Max Discount Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={formData.maxDiscountAmount}
                    onChange={(e) => handleInputChange('maxDiscountAmount', e.target.value)}
                    placeholder="Cap the discount"
                    className="form-input"
                    min="0"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Product Selection */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                Product Selection
              </h2>
              <div className="flex items-center space-x-4">
                <select
                  value={formData.category}
                  onChange={(e) => handleInputChange('category', e.target.value)}
                  className="form-input w-auto"
                >
                  <option value="all">All Products</option>
                  <option value="lenses">Lenses Only</option>
                  <option value="frames">Frames Only</option>
                  <option value="accessories">Accessories Only</option>
                </select>
                <button
                  type="button"
                  onClick={selectAllProducts}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Selected: {formData.selectedProducts.length} of {filteredProducts.length} products
              </p>
            </div>

            <div className="max-h-96 overflow-y-auto border rounded-lg" style={{ borderColor: 'var(--border-primary)' }}>
              <table className="min-w-full">
                <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={formData.selectedProducts.length === filteredProducts.length && filteredProducts.length > 0}
                        onChange={() => {
                          if (formData.selectedProducts.length === filteredProducts.length) {
                            clearSelection();
                          } else {
                            selectAllProducts();
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Product
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Brand
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Price
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Stock
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={formData.selectedProducts.includes(product.id)}
                          onChange={() => handleProductSelection(product.id)}
                          className="rounded"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="font-medium" style={{ color: 'var(--text-primary)' }}>
                            {product.productName || product.name}
                          </div>
                          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {product.description || 'No description'}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                        {product.brand || 'N/A'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        ₹{product.sellingPrice || product.price || 0}
                      </td>
                      <td className="px-4 py-3 text-sm" style={{ color: 'var(--text-primary)' }}>
                        {product.qty || product.quantity || 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-6 py-3 border border-gray-300 rounded-lg font-medium transition-colors"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-primary)',
                backgroundColor: 'var(--bg-secondary)'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-blue-400 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Flash Sale'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateFlashSale; 
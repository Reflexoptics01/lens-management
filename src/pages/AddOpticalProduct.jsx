import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDoc, serverTimestamp } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import toast from 'react-hot-toast';

const AddOpticalProduct = ({ hideNavbar = false }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  // Mock user for immediate loading - can be replaced with real auth later
  const user = { 
    uid: 'demo-user', 
    email: 'demo@example.com', 
    displayName: 'Demo User' 
  };
  const [formData, setFormData] = useState({
    category: 'spectacle-frames',
    productName: '',
    brand: '',
    model: '',
    description: '',
    specifications: {},
    price: '',
    quantity: '1',
    condition: 'new',
    images: [],
    contactInfo: {
      preferredContact: 'email',
      phone: '',
      email: user?.email || '',
      whatsapp: ''
    }
  });

  const productCategories = [
    {
      id: 'spectacle-frames',
      name: 'Spectacle Frames',
      icon: '👓',
      fields: ['material', 'frameType', 'bridgeSize', 'templeLength', 'lensWidth', 'color', 'gender']
    },
    {
      id: 'cases-pouches',
      name: 'Cases & Pouches',
      icon: '📦',
      fields: ['material', 'size', 'type', 'color', 'closure']
    },
    {
      id: 'optical-tools',
      name: 'Optical Tools',
      icon: '🔧',
      fields: ['toolType', 'material', 'precision', 'usage']
    },
    {
      id: 'pliers-screwdrivers',
      name: 'Pliers & Screwdrivers',
      icon: '🔩',
      fields: ['toolType', 'size', 'material', 'tipType']
    },
    {
      id: 'cleaning-supplies',
      name: 'Cleaning Supplies',
      icon: '🧽',
      fields: ['productType', 'volume', 'usage', 'compatibility']
    },
    {
      id: 'display-equipment',
      name: 'Display Equipment',
      icon: '🏪',
      fields: ['displayType', 'material', 'capacity', 'dimensions']
    },
    {
      id: 'optical-machinery',
      name: 'Optical Machinery',
      icon: '⚙️',
      fields: ['machineType', 'brand', 'model', 'condition', 'yearOfManufacture', 'powerRequirement']
    },
    {
      id: 'other-accessories',
      name: 'Other Accessories',
      icon: '📋',
      fields: ['accessoryType', 'compatibility', 'material']
    }
  ];

  const handleInputChange = (field, value) => {
    if (field.startsWith('specifications.')) {
      const specField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        specifications: {
          ...prev.specifications,
          [specField]: value
        }
      }));
    } else if (field.startsWith('contactInfo.')) {
      const contactField = field.split('.')[1];
      setFormData(prev => ({
        ...prev,
        contactInfo: {
          ...prev.contactInfo,
          [contactField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.productName.trim()) {
        throw new Error('Product name is required');
      }

      if (!formData.price || parseFloat(formData.price) <= 0) {
        throw new Error('Valid price is required');
      }

      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        quantity: parseInt(formData.quantity),
        userId: user?.uid,
        userEmail: user?.email,
        userName: user?.displayName || user?.email,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        views: 0,
        inquiries: 0
      };

      const productsRef = getUserCollection('marketplaceProducts');
      await addDoc(productsRef, productData);

      toast.success('Product added successfully!');
      navigate('/marketplace');

    } catch (error) {
      console.error('Error adding product:', error);
      toast.error(error.message || 'Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const selectedCategory = productCategories.find(cat => cat.id === formData.category);

  const renderSpecificationFields = () => {
    if (!selectedCategory) return null;

    return selectedCategory.fields.map(field => (
      <div key={field} className="mb-4">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
          {field.replace(/([A-Z])/g, ' $1').trim()}
        </label>
        <input
          type="text"
          value={formData.specifications[field] || ''}
          onChange={(e) => handleInputChange(`specifications.${field}`, e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
          placeholder={`Enter ${field.replace(/([A-Z])/g, ' $1').trim().toLowerCase()}`}
        />
      </div>
    ));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-4 mb-4">
            <button
              onClick={() => navigate('/marketplace')}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Add Optical Product
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                List your optical products in the marketplace
              </p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Product Category */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Product Category</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {productCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      category: category.id,
                      specifications: {}
                    }));
                  }}
                  className={`p-4 rounded-lg border-2 transition-all duration-200 text-center ${
                    formData.category === category.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-2">{category.icon}</div>
                  <div className="text-sm font-medium">{category.name}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Basic Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Product Name *
                </label>
                <input
                  type="text"
                  value={formData.productName}
                  onChange={(e) => handleInputChange('productName', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter product name"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Brand
                </label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => handleInputChange('brand', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter brand name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Model
                </label>
                <input
                  type="text"
                  value={formData.model}
                  onChange={(e) => handleInputChange('model', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter model number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Condition
                </label>
                <select
                  value={formData.condition}
                  onChange={(e) => handleInputChange('condition', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="new">New</option>
                  <option value="like-new">Like New</option>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="refurbished">Refurbished</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  value={formData.price}
                  onChange={(e) => handleInputChange('price', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter price"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  value={formData.quantity}
                  onChange={(e) => handleInputChange('quantity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter quantity"
                  min="1"
                />
              </div>
            </div>

            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                placeholder="Describe your product, its features, and any additional details..."
              />
            </div>
          </div>

          {/* Specifications */}
          {selectedCategory && selectedCategory.fields.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
                {selectedCategory.name} Specifications
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {renderSpecificationFields()}
              </div>
            </div>
          )}

          {/* Contact Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preferred Contact Method
                </label>
                <select
                  value={formData.contactInfo.preferredContact}
                  onChange={(e) => handleInputChange('contactInfo.preferredContact', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="email">Email</option>
                  <option value="phone">Phone</option>
                  <option value="whatsapp">WhatsApp</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={formData.contactInfo.email}
                  onChange={(e) => handleInputChange('contactInfo.email', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter email address"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.contactInfo.phone}
                  onChange={(e) => handleInputChange('contactInfo.phone', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter phone number"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  WhatsApp Number
                </label>
                <input
                  type="tel"
                  value={formData.contactInfo.whatsapp}
                  onChange={(e) => handleInputChange('contactInfo.whatsapp', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter WhatsApp number"
                />
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={() => navigate('/marketplace')}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {loading && (
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
              )}
              <span>{loading ? 'Adding Product...' : 'Add Product'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddOpticalProduct; 
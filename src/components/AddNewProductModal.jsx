import React, { useState, useEffect } from 'react';
import { db } from '../firebaseConfig';
import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { getUserCollection } from '../utils/multiTenancy';
import toast from 'react-hot-toast';

// CSS to remove number input arrows
const inputStyles = `
  .no-arrows::-webkit-outer-spin-button,
  .no-arrows::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  .no-arrows[type=number] {
    -moz-appearance: textfield;
  }
`;

const AddNewProductModal = ({ 
  isOpen, 
  onClose, 
  onProductCreated, 
  initialProductName = '', 
  initialPrice = 0,
  dataSection = '',
  className = '' 
}) => {
  const [productName, setProductName] = useState('');
  const [productPrice, setProductPrice] = useState(0);
  const [productQty, setProductQty] = useState(10);
  const [selectedProductType, setSelectedProductType] = useState('');
  const [creatingProduct, setCreatingProduct] = useState(false);
  const [itemType, setItemType] = useState('');

  // Power range fields for stock lenses
  const [powerRangeFields, setPowerRangeFields] = useState({
    maxSph: '',
    maxCyl: '',
    maxAxis: '',
    maxAdd: ''
  });

  // Contact lens specific fields
  const [contactLensFields, setContactLensFields] = useState({
    contactType: 'non-toric', // 'toric' or 'non-toric'
    color: 'clear', // 'clear' or 'colored'
    maxSph: '',
    maxCyl: '', // only for toric
    maxAxis: '' // only for toric
  });

  // Initialize form when modal opens or initialProductName changes
  useEffect(() => {
    if (isOpen) {
      setProductName(initialProductName || '');
      setProductPrice(initialPrice || 0);
      setProductQty(10);
      setSelectedProductType('');
      setItemType('');
      setPowerRangeFields({
        maxSph: '',
        maxCyl: '',
        maxAxis: '',
        maxAdd: ''
      });
      setContactLensFields({
        contactType: 'non-toric',
        color: 'clear',
        maxSph: '',
        maxCyl: '',
        maxAxis: ''
      });
    }
  }, [isOpen, initialProductName, initialPrice]);

  // Handle ESC key to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);

  const handleClose = () => {
    setProductName('');
    setProductPrice(0);
    setProductQty(10);
    setSelectedProductType('');
    setItemType('');
    setPowerRangeFields({
      maxSph: '',
      maxCyl: '',
      maxAxis: '',
      maxAdd: ''
    });
    setContactLensFields({
      contactType: 'non-toric',
      color: 'clear',
      maxSph: '',
      maxCyl: '',
      maxAxis: ''
    });
    onClose();
  };

  const createNewProduct = async () => {
    if (!productName.trim() || !selectedProductType) {
      toast.error('Please fill in product name and select a type');
      return;
    }

    try {
      setCreatingProduct(true);

      let productData = {
        brandName: productName,
        name: productName,
        createdAt: Timestamp.now(),
        createdBy: 'user',
        type: selectedProductType
      };

      // Type-specific configurations
      if (selectedProductType === 'prescription') {
        // For RX lenses - no qty needed as they're custom made
        productData = {
          ...productData,
          eye: 'both',
          sph: '',
          cyl: '',
          axis: '',
          add: '',
          material: '',
          index: '',
          purchasePrice: productPrice,
          salePrice: productPrice,
          price: productPrice,
          qty: 0, // No inventory tracking for RX
          isPrescription: true
        };

        // Special handling for RX lenses created from CreateSale page
        if (dataSection === 'create-sale' || window.location.pathname === '/create-sale') {
          productData.hiddenFromInventory = true;
          productData.createdForSale = true;
        }
      } else if (selectedProductType === 'stock') {
        // For Stock lenses - with power range and qty
        let powerSeries = '';
        if (powerRangeFields.maxSph) {
          powerSeries += `SPH: up to ${powerRangeFields.maxSph}`;
        }
        if (powerRangeFields.maxCyl) {
          if (powerSeries) powerSeries += ', ';
          powerSeries += `CYL: up to ${powerRangeFields.maxCyl}`;
        }
        if (powerRangeFields.maxAxis) {
          if (powerSeries) powerSeries += ', ';
          powerSeries += `AXIS: up to ${powerRangeFields.maxAxis}`;
        }
        if (powerRangeFields.maxAdd) {
          if (powerSeries) powerSeries += ', ';
          powerSeries += `ADD: up to ${powerRangeFields.maxAdd}`;
        }

        productData = {
          ...productData,
          powerSeries: powerSeries,
          maxSph: powerRangeFields.maxSph || '',
          maxCyl: powerRangeFields.maxCyl || '',
          maxAxis: powerRangeFields.maxAxis || '',
          maxAdd: powerRangeFields.maxAdd || '',
          purchasePrice: productPrice,
          salePrice: productPrice,
          price: productPrice,
          qty: productQty,
          isStockLens: true
        };
      } else if (selectedProductType === 'contact') {
        // For Contact lenses - with proper configuration
        let powerSeries = '';
        if (contactLensFields.maxSph) {
          powerSeries += `SPH: up to ${contactLensFields.maxSph}`;
        }
        if (contactLensFields.contactType === 'toric' && contactLensFields.maxCyl) {
          if (powerSeries) powerSeries += ', ';
          powerSeries += `CYL: up to ${contactLensFields.maxCyl}`;
        }
        if (contactLensFields.contactType === 'toric' && contactLensFields.maxAxis) {
          if (powerSeries) powerSeries += ', ';
          powerSeries += `AXIS: up to ${contactLensFields.maxAxis}`;
        }

        productData = {
          ...productData,
          powerSeries: powerSeries,
          category: 'Contact Lens',
          contactType: contactLensFields.contactType,
          color: contactLensFields.color,
          maxSph: contactLensFields.maxSph || '',
          maxCyl: contactLensFields.contactType === 'toric' ? (contactLensFields.maxCyl || '') : '',
          maxAxis: contactLensFields.contactType === 'toric' ? (contactLensFields.maxAxis || '') : '',
          disposalFrequency: 'Daily', // Default value
          purchasePrice: productPrice,
          salePrice: productPrice,
          price: productPrice,
          qty: 1, // Start with 1 piece in inventory
          isContactLens: true
        };
      } else if (selectedProductType === 'service') {
        // For Services - only price needed
        productData = {
          ...productData,
          serviceName: productName,
          serviceType: 'General Service',
          serviceDescription: 'Service created from transaction',
          category: 'General',
          servicePrice: productPrice,
          salePrice: productPrice,
          price: productPrice,
          purchasePrice: productPrice,
          isActive: true,
          qty: 0, // Services don't have qty
          isService: true
        };
      } else if (selectedProductType === 'item') {
        // For Items - price, qty, and item type
        productData = {
          ...productData,
          itemName: productName,
          category: itemType || 'Other',
          brand: '',
          unit: 'Pieces',
          purchasePrice: productPrice,
          salePrice: productPrice,
          price: productPrice,
          minStockLevel: 5,
          maxStockLevel: 100,
          location: '',
          supplier: '',
          description: `Item created from transaction`,
          qty: productQty,
          isItem: true
        };
      }

      // Save to lens_inventory collection
      await addDoc(getUserCollection('lensInventory'), productData);

      // Call the onProductCreated callback with product data
      if (onProductCreated) {
        const callbackData = {
          ...productData,
          name: productName,
          price: productPrice
        };
        onProductCreated(callbackData);
      }

      // Trigger inventory update event
      window.dispatchEvent(new CustomEvent('lensInventoryUpdated', {
        detail: { 
          type: selectedProductType, 
          product: productData 
        }
      }));

      // Show success message
      const typeLabel = {
        'prescription': 'RX Lens',
        'stock': 'Stock Lens',
        'contact': 'Contact Lens',
        'service': 'Service',
        'item': 'Item'
      }[selectedProductType];

      toast.success(`Successfully created new ${typeLabel}: "${productName}"`);
      
      handleClose();

    } catch (error) {
      console.error('Error creating new product:', error);
      toast.error(`Failed to create new product: ${error.message}`);
    } finally {
      setCreatingProduct(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Add custom CSS styles */}
      <style>{inputStyles}</style>
      
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className={`bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto ${className}`}>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Add New Product</h3>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Create a new product for your inventory
            </p>
          </div>

          {/* Product Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
              placeholder="Enter product name"
              autoFocus
              tabIndex={1}
            />
          </div>

          {/* Product Type Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Product Type *
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedProductType('prescription')}
                className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors ${
                  selectedProductType === 'prescription'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-blue-300'
                }`}
                tabIndex={2}
              >
                <span className="text-lg mb-1">👓</span>
                <span className="text-xs font-medium">RX Lens</span>
              </button>

              <button
                onClick={() => setSelectedProductType('stock')}
                className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors ${
                  selectedProductType === 'stock'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300'
                }`}
                tabIndex={3}
              >
                <span className="text-lg mb-1">📦</span>
                <span className="text-xs font-medium">Stock Lens</span>
              </button>

              <button
                onClick={() => setSelectedProductType('contact')}
                className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors ${
                  selectedProductType === 'contact'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-purple-300'
                }`}
                tabIndex={4}
              >
                <span className="text-lg mb-1">👁️</span>
                <span className="text-xs font-medium">Contact Lens</span>
              </button>

              <button
                onClick={() => setSelectedProductType('service')}
                className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors ${
                  selectedProductType === 'service'
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-teal-300'
                }`}
                tabIndex={5}
              >
                <span className="text-lg mb-1">⚙️</span>
                <span className="text-xs font-medium">Service</span>
              </button>

              <button
                onClick={() => setSelectedProductType('item')}
                className={`flex flex-col items-center p-3 border-2 rounded-lg transition-colors ${
                  selectedProductType === 'item'
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/20'
                    : 'border-gray-200 dark:border-gray-600 hover:border-orange-300'
                }`}
                tabIndex={6}
              >
                <span className="text-lg mb-1">📋</span>
                <span className="text-xs font-medium">Item</span>
              </button>
            </div>
          </div>

          {/* Type-specific fields */}
          {selectedProductType && (
            <div className="space-y-4">
              {/* Price - shown for all types */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Price (₹) *
                </label>
                <input
                  type="number"
                  value={productPrice}
                  onChange={(e) => setProductPrice(parseFloat(e.target.value) || 0)}
                  className="no-arrows w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  tabIndex={7}
                />
              </div>

              {/* Quantity - only for stock lenses and items */}
              {(selectedProductType === 'stock' || selectedProductType === 'item') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Initial Quantity
                  </label>
                  <input
                    type="number"
                    value={productQty}
                    onChange={(e) => setProductQty(parseInt(e.target.value) || 1)}
                    className="no-arrows w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    placeholder="10"
                    min="1"
                    step="1"
                    tabIndex={8}
                  />
                </div>
              )}

              {/* Contact Lens Configuration */}
              {selectedProductType === 'contact' && (
                <div className="space-y-4">
                  {/* Contact Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contact Type
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setContactLensFields(prev => ({ ...prev, contactType: 'non-toric', maxCyl: '', maxAxis: '' }))}
                        className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                          contactLensFields.contactType === 'non-toric'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 text-gray-700 dark:text-gray-300'
                        }`}
                        tabIndex={8}
                      >
                        Non-Toric (Spherical)
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactLensFields(prev => ({ ...prev, contactType: 'toric' }))}
                        className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                          contactLensFields.contactType === 'toric'
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-blue-300 text-gray-700 dark:text-gray-300'
                        }`}
                        tabIndex={9}
                      >
                        Toric (Astigmatism)
                      </button>
                    </div>
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Color
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setContactLensFields(prev => ({ ...prev, color: 'clear' }))}
                        className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                          contactLensFields.color === 'clear'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 text-gray-700 dark:text-gray-300'
                        }`}
                        tabIndex={10}
                      >
                        Clear
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactLensFields(prev => ({ ...prev, color: 'colored' }))}
                        className={`p-3 border-2 rounded-lg text-sm font-medium transition-colors ${
                          contactLensFields.color === 'colored'
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                            : 'border-gray-200 dark:border-gray-600 hover:border-emerald-300 text-gray-700 dark:text-gray-300'
                        }`}
                        tabIndex={11}
                      >
                        Colored
                      </button>
                    </div>
                  </div>

                  {/* Power Range for Contact Lenses */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Power Range (Optional)
                    </label>
                    <div className={`grid gap-2 ${contactLensFields.contactType === 'toric' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                      <input
                        type="text"
                        value={contactLensFields.maxSph}
                        onChange={(e) => setContactLensFields(prev => ({ ...prev, maxSph: e.target.value }))}
                        className="no-arrows px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="Max SPH (e.g., -6.00)"
                        tabIndex={12}
                      />
                      {contactLensFields.contactType === 'toric' && (
                        <>
                          <input
                            type="text"
                            value={contactLensFields.maxCyl}
                            onChange={(e) => setContactLensFields(prev => ({ ...prev, maxCyl: e.target.value }))}
                            className="no-arrows px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Max CYL (e.g., -2.25)"
                            tabIndex={13}
                          />
                          <input
                            type="text"
                            value={contactLensFields.maxAxis}
                            onChange={(e) => setContactLensFields(prev => ({ ...prev, maxAxis: e.target.value }))}
                            className="no-arrows px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Max AXIS (e.g., 180)"
                            tabIndex={14}
                          />
                        </>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {contactLensFields.contactType === 'toric' 
                        ? 'For toric lenses: SPH, CYL, and AXIS ranges'
                        : 'For spherical lenses: Only SPH range needed'
                      }
                    </p>
                  </div>
                </div>
              )}

              {/* Power Range - only for stock lenses - now in single line */}
              {selectedProductType === 'stock' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Power Range (Optional)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <input
                      type="text"
                      value={powerRangeFields.maxSph}
                      onChange={(e) => setPowerRangeFields(prev => ({ ...prev, maxSph: e.target.value }))}
                      className="no-arrows px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Max SPH"
                      tabIndex={15}
                    />
                    <input
                      type="text"
                      value={powerRangeFields.maxCyl}
                      onChange={(e) => setPowerRangeFields(prev => ({ ...prev, maxCyl: e.target.value }))}
                      className="no-arrows px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Max CYL"
                      tabIndex={16}
                    />
                    <input
                      type="text"
                      value={powerRangeFields.maxAxis}
                      onChange={(e) => setPowerRangeFields(prev => ({ ...prev, maxAxis: e.target.value }))}
                      className="no-arrows px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Max AXIS"
                      tabIndex={17}
                    />
                    <input
                      type="text"
                      value={powerRangeFields.maxAdd}
                      onChange={(e) => setPowerRangeFields(prev => ({ ...prev, maxAdd: e.target.value }))}
                      className="no-arrows px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="Max ADD"
                      tabIndex={18}
                    />
                  </div>
                </div>
              )}

              {/* Item Type - only for items */}
              {selectedProductType === 'item' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Item Type
                  </label>
                  <select
                    value={itemType}
                    onChange={(e) => setItemType(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    tabIndex={19}
                  >
                    <option value="">Select item type</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Tools">Tools</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Equipment">Equipment</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={handleClose}
              disabled={creatingProduct}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-200 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 transition-colors"
              tabIndex={21}
            >
              Cancel
            </button>
            
            <button
              onClick={createNewProduct}
              disabled={creatingProduct || !productName.trim() || !selectedProductType}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
              tabIndex={20}
            >
              {creatingProduct ? (
                <span className="flex items-center">
                  <svg className="animate-spin h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </span>
              ) : (
                'Create Product'
              )}
            </button>
          </div>

          {/* Loading overlay */}
          {creatingProduct && (
            <div className="absolute inset-0 bg-white dark:bg-gray-800 bg-opacity-75 flex items-center justify-center rounded-lg">
              <div className="flex items-center">
                <svg className="animate-spin h-5 w-5 text-blue-600 mr-2" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 718-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 714 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm text-gray-600 dark:text-gray-300">Creating product...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default AddNewProductModal; 
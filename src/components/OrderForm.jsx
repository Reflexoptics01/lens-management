import React, { useState, useEffect } from 'react';
import CustomerSearch from './CustomerSearch';
import LensPrescription from './LensPrescription';

const MATERIALS = ['CR', 'POLY', 'GLASS', 'POLARISED', 'TRIVEX', 'MR8'];

const INDEX_BY_MATERIAL = {
  'CR': ['1.50', '1.56', '1.60', '1.67', '1.74'],
  'POLARISED': ['1.50', '1.56', '1.60', '1.67', '1.74'],
  'GLASS': ['1.52', '1.70', '1.80', '1.90'],
  'TRIVEX': ['1.53'],
  'MR8': ['1.60'],
  'POLY': ['1.59']
};

const LENS_TYPES = [
  'SINGLE VISION',
  'ROUND TOP (KT) PROGRESSIVE',
  'DIGITAL PROGRESSIVE',
  'FREEFORM PROGRESSIVE',
  'FLAT TOP (D)',
  'EXECUTIVE BIFOCAL',
  'DIGITAL BIFOCAL'
];

const BASE_TINTS = ['WHITE', 'BLUECUT', 'PHOTOGREY (PG)', 'PHOTOGREY BLUECUT', 'OTHER'];

const COATING_TYPES = ['UC', 'HC', 'HMC', 'SHMC', 'HCT'];

const COATING_COLORS = {
  'HMC': ['GREEN', 'BLUE', 'DUAL (BLUE & GREEN)', 'MAGENTA', 'VIOLET'],
  'SHMC': ['GREEN', 'BLUE', 'DUAL (BLUE & GREEN)', 'MAGENTA', 'VIOLET']
};

const OrderForm = ({ formData, onChange, onSubmit, customers, onAddNewCustomer, loading, error, isEditing = false, matchingLenses = [], sectionColors }) => {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [otherTint, setOtherTint] = useState('');
  const [showCoatingColors, setShowCoatingColors] = useState(false);
  const [includePrescription, setIncludePrescription] = useState(true);
  const [activeSection, setActiveSection] = useState(null);

  useEffect(() => {
    if (formData.coatingType === 'HMC' || formData.coatingType === 'SHMC') {
      setShowCoatingColors(true);
    } else {
      setShowCoatingColors(false);
      onChange({ target: { name: 'coatingColour', value: '' } });
    }
  }, [formData.coatingType]);

  useEffect(() => {
    if (!includePrescription) {
      // Clear prescription values when toggled off
      onChange({ target: { name: 'rightSph', value: '' } });
      onChange({ target: { name: 'rightCyl', value: '' } });
      onChange({ target: { name: 'rightAxis', value: '' } });
      onChange({ target: { name: 'rightAdd', value: '' } });
      onChange({ target: { name: 'leftSph', value: '' } });
      onChange({ target: { name: 'leftCyl', value: '' } });
      onChange({ target: { name: 'leftAxis', value: '' } });
      onChange({ target: { name: 'leftAdd', value: '' } });
    }
  }, [includePrescription]);

  const handleCustomerSelect = (customer) => {
    setSelectedCustomer(customer);
    onChange({ target: { name: 'customerName', value: customer.opticalName } });
  };

  const handleMaterialChange = (e) => {
    const material = e.target.value;
    onChange(e);
    // Reset index when material changes
    onChange({ target: { name: 'index', value: '' } });
  };

  const handleBaseTintChange = (e) => {
    const value = e.target.value;
    onChange(e);
    if (value !== 'OTHER') {
      setOtherTint('');
    }
  };

  const handleSectionFocus = (section) => {
    setActiveSection(section);
  };

  // Define colors for each section
  const colors = sectionColors || {
    customer: { gradient: 'from-blue-600 to-indigo-600', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
    lens: { gradient: 'from-purple-600 to-pink-600', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
    coating: { gradient: 'from-teal-600 to-cyan-600', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
    prescription: { gradient: 'from-green-600 to-teal-600', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
    delivery: { gradient: 'from-amber-600 to-orange-600', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' }
  };

  // Dynamic class for input fields
  const getInputClass = (fieldName, section) => {
    const baseClass = "w-full rounded-lg shadow-sm bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-white text-sm transition-all duration-200";
    
    // Field validation style
    const validationClass = fieldName && formData[fieldName] === '' && 
      ['customerName', 'brandName', 'expectedDeliveryDate'].includes(fieldName)
      ? 'border-red-300 dark:border-red-600 focus:border-red-500 dark:focus:border-red-400 focus:ring-red-500 dark:focus:ring-red-400'
      : `border-gray-200 dark:border-gray-600 focus:border-${section}-500 dark:focus:border-${section}-400 focus:ring-${section}-500 dark:focus:ring-${section}-400`;
    
    // Active section highlight
    const activeClass = activeSection === section ? `border-${section}-400 dark:border-${section}-500` : '';
    
    return `${baseClass} ${validationClass} ${activeClass}`;
  };

  // Section styles
  const getSectionClass = (section) => {
    const baseClass = "bg-white dark:bg-gray-800 rounded-lg shadow-sm p-5 transition-all duration-300 border-l-4 border border-gray-200 dark:border-gray-700";
    const borderColor = `border-${section}-500 dark:border-${section}-400`;
    const hoverEffect = `hover:shadow-md hover:border-${section}-600 dark:hover:border-${section}-300`;
    const activeClass = activeSection === section ? `border-${section}-600 dark:border-${section}-300 shadow-md` : '';
    
    return `${baseClass} ${borderColor} ${hoverEffect} ${activeClass}`;
  };

  const getSectionHeaderClass = (section) => {
    return `flex items-center gap-2 mb-4 text-${section}-600 dark:text-${section}-400 font-medium`;
  };

  const getLabelClass = (section) => {
    return `block text-xs font-semibold tracking-wide text-${section}-700 dark:text-${section}-300 mb-1.5`;
  };

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Customer Information */}
      <div 
        className={getSectionClass('blue')}
        onFocus={() => handleSectionFocus('customer')}
        onClick={() => handleSectionFocus('customer')}
      >
        <div className={getSectionHeaderClass('blue')}>
          <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 flex items-center justify-center shadow-sm`}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-base font-medium">Customer Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={getLabelClass('blue')}>
              Optical Name <span className="text-red-500">*</span>
            </label>
            <CustomerSearch
              customers={customers}
              value={formData.customerName}
              onChange={onChange}
              onSelect={handleCustomerSelect}
              onAddNew={onAddNewCustomer}
              isOrderFlow={true}
              className={formData.customerName ? getInputClass('customerName', 'blue') : `${getInputClass('customerName', 'blue')} ring-1 ring-red-300`}
            />
            {!formData.customerName && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">This field is required</p>
            )}
          </div>
          <div>
            <label className={getLabelClass('blue')}>Consumer Name</label>
            <input
              type="text"
              name="consumerName"
              value={formData.consumerName}
              onChange={onChange}
              className={getInputClass(null, 'blue')}
              placeholder="Enter consumer name"
              onFocus={() => handleSectionFocus('customer')}
            />
          </div>
        </div>
      </div>

      {/* Lens Specifications */}
      <div 
        className={getSectionClass('purple')}
        onFocus={() => handleSectionFocus('lens')}
        onClick={() => handleSectionFocus('lens')}
      >
        <div className={getSectionHeaderClass('purple')}>
          <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center shadow-sm`}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-base font-medium">Lens Specifications</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={getLabelClass('purple')}>
              Brand Name <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="text"
              name="brandName"
              value={formData.brandName}
              onChange={onChange}
              required
              aria-required="true"
              className={formData.brandName ? getInputClass('brandName', 'purple') : `${getInputClass('brandName', 'purple')} ring-1 ring-red-300 dark:ring-red-600`}
              placeholder="Enter brand name"
              onFocus={() => handleSectionFocus('lens')}
            />
            {!formData.brandName && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">This field is required</p>
            )}
          </div>
          <div>
            <label className={getLabelClass('purple')}>Material</label>
            <select
              name="material"
              value={formData.material}
              onChange={handleMaterialChange}
              className={getInputClass(null, 'purple')}
              onFocus={() => handleSectionFocus('lens')}
            >
              <option value="">Select Material</option>
              {MATERIALS.map(material => (
                <option key={material} value={material}>{material}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={getLabelClass('purple')}>Index</label>
            <select
              name="index"
              value={formData.index}
              onChange={onChange}
              disabled={!formData.material}
              className={`${getInputClass(null, 'purple')} ${!formData.material ? 'opacity-60 cursor-not-allowed' : ''}`}
              onFocus={() => handleSectionFocus('lens')}
            >
              <option value="">Select Index</option>
              {formData.material && INDEX_BY_MATERIAL[formData.material].map(index => (
                <option key={index} value={index}>{index}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          <div>
            <label className={getLabelClass('purple')}>Lens Type</label>
            <select
              name="lensType"
              value={formData.lensType}
              onChange={onChange}
              className={getInputClass(null, 'purple')}
              onFocus={() => handleSectionFocus('lens')}
            >
              <option value="">Select Lens Type</option>
              {LENS_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={getLabelClass('purple')}>Base Tint</label>
            <select
              name="baseTint"
              value={formData.baseTint}
              onChange={handleBaseTintChange}
              className={getInputClass(null, 'purple')}
              onFocus={() => handleSectionFocus('lens')}
            >
              <option value="">Select Base Tint</option>
              {BASE_TINTS.map(tint => (
                <option key={tint} value={tint}>{tint}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Coating Details */}
      <div 
        className={getSectionClass('teal')}
        onFocus={() => handleSectionFocus('coating')}
        onClick={() => handleSectionFocus('coating')}
      >
        <div className={getSectionHeaderClass('teal')}>
          <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 flex items-center justify-center shadow-sm`}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <h3 className="text-base font-medium">Coating & Additional Details</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <label className={getLabelClass('teal')}>Coating Type</label>
            <select
              name="coatingType"
              value={formData.coatingType}
              onChange={onChange}
              className={getInputClass(null, 'teal')}
              onFocus={() => handleSectionFocus('coating')}
            >
              <option value="">Select Coating</option>
              {COATING_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {showCoatingColors && (
            <div className="transition-opacity duration-300 ease-in-out">
              <label className={getLabelClass('teal')}>Coating Color</label>
              <select
                name="coatingColour"
                value={formData.coatingColour}
                onChange={onChange}
                className={getInputClass(null, 'teal')}
                onFocus={() => handleSectionFocus('coating')}
              >
                <option value="">Select Color</option>
                {COATING_COLORS[formData.coatingType]?.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={getLabelClass('teal')}>Diameter</label>
            <input
              type="text"
              name="diameter"
              value={formData.diameter}
              onChange={onChange}
              className={getInputClass(null, 'teal')}
              placeholder="Enter diameter"
              onFocus={() => handleSectionFocus('coating')}
            />
          </div>
          <div>
            <label className={getLabelClass('teal')}>Fitting</label>
            <select
              name="fitting"
              value={formData.fitting}
              onChange={onChange}
              className={getInputClass(null, 'teal')}
              onFocus={() => handleSectionFocus('coating')}
            >
              <option value="None">None</option>
              <option value="With Fitting">With Fitting</option>
              <option value="Without Fitting">Without Fitting</option>
            </select>
          </div>
          <div className="flex items-center mt-2 ml-1">
            <label className="relative inline-flex items-center cursor-pointer">
              <input 
                type="checkbox" 
                checked={formData.fogMark}
                name="fogMark"
                onChange={onChange}
                className="sr-only peer"
                onFocus={() => handleSectionFocus('coating')}
              />
              <div className="w-9 h-5 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-teal-300 dark:peer-focus:ring-teal-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 dark:after:border-gray-500 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600 dark:peer-checked:bg-teal-500"></div>
              <span className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">Fog Mark</span>
            </label>
          </div>
        </div>
      </div>

      {/* Prescription */}
      <div 
        className={getSectionClass('green')}
        onFocus={() => handleSectionFocus('prescription')}
        onClick={() => handleSectionFocus('prescription')}
      >
        <div className={getSectionHeaderClass('green')}>
          <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-green-500 to-teal-500 flex items-center justify-center shadow-sm`}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-medium">Prescription Details</h3>
        </div>
        
        <div className="bg-gradient-to-br from-white via-white to-green-50 dark:from-gray-800 dark:via-gray-800 dark:to-green-900/20 p-4 rounded-lg border border-green-100 dark:border-green-700/50 shadow-sm">
          <LensPrescription formData={formData} onChange={onChange} matchingLenses={matchingLenses} />
        </div>
      </div>

      {/* Order Details */}
      <div 
        className={getSectionClass('amber')}
        onFocus={() => handleSectionFocus('delivery')}
        onClick={() => handleSectionFocus('delivery')}
      >
        <div className={getSectionHeaderClass('amber')}>
          <div className={`w-8 h-8 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 flex items-center justify-center shadow-sm`}>
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <h3 className="text-base font-medium">Order Details</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <label className={getLabelClass('amber')}>
              Expected Delivery Date <span className="text-red-500 dark:text-red-400">*</span>
            </label>
            <input
              type="date"
              name="expectedDeliveryDate"
              value={formData.expectedDeliveryDate}
              onChange={onChange}
              required
              aria-required="true"
              className={formData.expectedDeliveryDate ? getInputClass('expectedDeliveryDate', 'amber') : `${getInputClass('expectedDeliveryDate', 'amber')} ring-1 ring-red-300 dark:ring-red-600`}
              onFocus={() => handleSectionFocus('delivery')}
            />
            {!formData.expectedDeliveryDate && (
              <p className="mt-1 text-xs text-red-500 dark:text-red-400">This field is required</p>
            )}
          </div>
          <div>
            <label className={getLabelClass('amber')}>Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400">₹</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={onChange}
                className={`${getInputClass(null, 'amber')} pl-7`}
                placeholder="Enter price"
                onFocus={() => handleSectionFocus('delivery')}
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className={getLabelClass('amber')}>Special Notes</label>
            <textarea
              name="specialNotes"
              value={formData.specialNotes}
              onChange={onChange}
              rows="2"
              className={`${getInputClass(null, 'amber')} resize-none`}
              placeholder="Enter any special instructions or notes"
              onFocus={() => handleSectionFocus('delivery')}
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/50 border-l-4 border-red-400 dark:border-red-600 p-4 rounded-md shadow-sm animate-pulse">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400 dark:text-red-300" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Only show the submit button when not on the CreateOrder page (e.g., when editing) */}
      {isEditing && (
        <div className="flex justify-end mt-6">
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-6 py-3 border border-transparent text-sm font-medium rounded-lg shadow-md text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800 disabled:opacity-50 transition-all transform hover:scale-[1.02] duration-300"
          >
            {loading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Updating Order...
              </>
            ) : 'Update Order'}
          </button>
        </div>
      )}
    </form>
  );
};

export default OrderForm; 
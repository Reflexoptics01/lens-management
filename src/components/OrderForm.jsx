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

const OrderForm = ({ formData, onChange, onSubmit, customers, onAddNewCustomer, loading, error, isEditing = false, matchingLenses = [] }) => {
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [otherTint, setOtherTint] = useState('');
  const [showCoatingColors, setShowCoatingColors] = useState(false);
  const [includePrescription, setIncludePrescription] = useState(true);

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

  const inputClassName = "w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm";
  const selectClassName = "w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm";
  const labelClassName = "block uppercase tracking-wide text-xs font-bold text-sky-700 mb-2";
  const sectionClassName = "bg-white rounded-lg border border-gray-100 p-4 hover:shadow-sm transition-shadow duration-200";
  const sectionHeaderClassName = "flex items-center gap-1.5 text-sky-600 mb-3";
  const iconClassName = "w-4 h-4";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {/* Customer Information */}
      <div className={sectionClassName}>
        <div className={sectionHeaderClassName}>
          <svg className={iconClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-base font-medium">Customer Details</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              Optical Name <span className="text-red-500">*</span>
            </label>
            <CustomerSearch
              customers={customers}
              value={formData.customerName}
              onChange={onChange}
              onSelect={handleCustomerSelect}
              onAddNew={onAddNewCustomer}
              isOrderFlow={true}
              className={formData.customerName ? '' : 'ring-1 ring-red-300'}
            />
          </div>
          <div>
            <label className={labelClassName}>Consumer Name</label>
            <input
              type="text"
              name="consumerName"
              value={formData.consumerName}
              onChange={onChange}
              className={inputClassName}
              placeholder="Enter consumer name"
            />
          </div>
        </div>
      </div>

      {/* Lens Specifications */}
      <div className={sectionClassName}>
        <div className={sectionHeaderClassName}>
          <svg className={iconClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <h3 className="text-base font-medium">Lens Specifications</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClassName}>
              Brand Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              name="brandName"
              value={formData.brandName}
              onChange={onChange}
              required
              aria-required="true"
              className={`${inputClassName} ${formData.brandName ? '' : 'ring-1 ring-red-300'}`}
            />
          </div>
          <div>
            <label className={labelClassName}>Material</label>
            <select
              name="material"
              value={formData.material}
              onChange={handleMaterialChange}
              className={selectClassName}
            >
              <option value="">Select Material</option>
              {MATERIALS.map(material => (
                <option key={material} value={material}>{material}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Index</label>
            <select
              name="index"
              value={formData.index}
              onChange={onChange}
              disabled={!formData.material}
              className={selectClassName}
            >
              <option value="">Select Index</option>
              {formData.material && INDEX_BY_MATERIAL[formData.material].map(index => (
                <option key={index} value={index}>{index}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className={labelClassName}>Lens Type</label>
            <select
              name="lensType"
              value={formData.lensType}
              onChange={onChange}
              className={selectClassName}
            >
              <option value="">Select Lens Type</option>
              {LENS_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClassName}>Base Tint</label>
            <select
              name="baseTint"
              value={formData.baseTint}
              onChange={handleBaseTintChange}
              className={selectClassName}
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
      <div className={sectionClassName}>
        <div className={sectionHeaderClassName}>
          <svg className={iconClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
          </svg>
          <h3 className="text-base font-medium">Coating & Additional Details</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className={labelClassName}>Coating Type</label>
            <select
              name="coatingType"
              value={formData.coatingType}
              onChange={onChange}
              className={selectClassName}
            >
              <option value="">Select Coating</option>
              {COATING_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          {showCoatingColors && (
            <div>
              <label className={labelClassName}>Coating Color</label>
              <select
                name="coatingColour"
                value={formData.coatingColour}
                onChange={onChange}
                className={selectClassName}
              >
                <option value="">Select Color</option>
                {COATING_COLORS[formData.coatingType]?.map(color => (
                  <option key={color} value={color}>{color}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className={labelClassName}>Diameter</label>
            <input
              type="text"
              name="diameter"
              value={formData.diameter}
              onChange={onChange}
              className={inputClassName}
              placeholder="Enter diameter"
            />
          </div>
          <div>
            <label className={labelClassName}>Fitting</label>
            <select
              name="fitting"
              value={formData.fitting}
              onChange={onChange}
              className={selectClassName}
            >
              <option value="None">None</option>
              <option value="With Fitting">With Fitting</option>
              <option value="Without Fitting">Without Fitting</option>
            </select>
          </div>
        </div>
      </div>

      {/* Prescription */}
      <div className={sectionClassName}>
        <div className={sectionHeaderClassName}>
          <svg className={iconClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="text-base font-medium">Prescription Details</h3>
        </div>
        
        <div className="bg-gray-50 p-3 rounded">
          <LensPrescription formData={formData} onChange={onChange} matchingLenses={matchingLenses} />
        </div>
      </div>

      {/* Order Details */}
      <div className={sectionClassName}>
        <div className={sectionHeaderClassName}>
          <svg className={iconClassName} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <h3 className="text-base font-medium">Order Details</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={labelClassName}>
              Expected Delivery Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              name="expectedDeliveryDate"
              value={formData.expectedDeliveryDate}
              onChange={onChange}
              required
              aria-required="true"
              className={`${inputClassName} ${formData.expectedDeliveryDate ? '' : 'ring-1 ring-red-300'}`}
            />
          </div>
          <div>
            <label className={labelClassName}>Price</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={onChange}
                className={`${inputClassName} pl-7`}
                placeholder="Enter price"
              />
            </div>
          </div>
          <div className="md:col-span-2">
            <label className={labelClassName}>Special Notes</label>
            <textarea
              name="specialNotes"
              value={formData.specialNotes}
              onChange={onChange}
              rows="2"
              className={`${inputClassName} resize-none`}
              placeholder="Enter any special instructions or notes"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border-l-4 border-red-400 p-3 rounded text-sm">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end mt-4">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center px-5 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:opacity-50 transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {isEditing ? 'Updating Order...' : 'Creating Order...'}
            </>
          ) : isEditing ? 'Update Order' : 'Create Order'}
        </button>
      </div>
    </form>
  );
};

export default OrderForm; 
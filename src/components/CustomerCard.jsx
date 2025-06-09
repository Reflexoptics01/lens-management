import React from 'react';
import { 
  PencilIcon, 
  TrashIcon, 
  PhoneIcon, 
  MapPinIcon, 
  EnvelopeIcon,
  IdentificationIcon, 
  BanknotesIcon,
  ClockIcon,
  BuildingStorefrontIcon,
  UserIcon
} from '@heroicons/react/24/outline';

const CustomerCard = ({ customer, onEdit, onDelete, formatCurrency, isVendor = false, onPrintAddress, isSelected = false, onSelect }) => {
  const {
    opticalName,
    contactPerson,
    phone,
    email,
    city,
    state,
    creditLimit,
    openingBalance,
    creditPeriod,
    gstNumber
  } = customer;

  // Use provided formatCurrency or fall back to local implementation
  const formatAmount = formatCurrency || ((amount) => {
    if (!amount && amount !== 0) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN')}`;
  });

  const EntityIcon = isVendor ? BuildingStorefrontIcon : UserIcon;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-3 flex-1">
            {onSelect && (
              <div className="flex items-center mt-1">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onSelect(customer.id)}
                  className="h-4 w-4 text-sky-600 focus:ring-sky-500 border-gray-300 rounded"
                />
              </div>
            )}
            <div className="space-y-1 flex-1">
              <div className="flex items-center">
                <EntityIcon className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{opticalName}</h3>
              </div>
              {contactPerson && (
                <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center">
                  <IdentificationIcon className="w-4 h-4 mr-1 text-gray-400 dark:text-gray-500" />
                  {contactPerson}
                </p>
              )}
            </div>
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => onEdit()}
              className="p-2 text-gray-400 hover:text-sky-600 dark:text-gray-500 dark:hover:text-sky-400 rounded-full hover:bg-sky-50 dark:hover:bg-sky-900/50 transition-colors"
              aria-label={`Edit ${isVendor ? 'vendor' : 'customer'}`}
            >
              <PencilIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                onPrintAddress && onPrintAddress(customer);
              }}
              className="p-2 text-gray-400 hover:text-purple-600 dark:text-gray-500 dark:hover:text-purple-400 rounded-full hover:bg-purple-50 dark:hover:bg-purple-900/50 transition-colors"
              aria-label="Print address"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete()}
              className="p-2 text-gray-400 hover:text-red-600 dark:text-gray-500 dark:hover:text-red-400 rounded-full hover:bg-red-50 dark:hover:bg-red-900/50 transition-colors"
              aria-label={`Delete ${isVendor ? 'vendor' : 'customer'}`}
            >
              <TrashIcon className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="col-span-1">
            {phone && (
              <div className="flex items-center text-sm">
                <PhoneIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                <a href={`tel:${phone}`} className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300">
                  {phone}
                </a>
              </div>
            )}
            
            {email && (
              <div className="flex items-center text-sm mt-2">
                <EnvelopeIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                <a href={`mailto:${email}`} className="text-sky-600 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300 truncate max-w-xs">
                  {email}
                </a>
              </div>
            )}

            {(city || state) && (
              <div className="flex items-start text-sm mt-2">
                <MapPinIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500 mt-0.5" />
                <span className="text-gray-600 dark:text-gray-300">
                  {[city, state].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          <div className="col-span-1 space-y-2">
            {(creditLimit || creditLimit === 0) && (
              <div className="flex items-center text-sm">
                <BanknotesIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-300">
                  <span className="text-gray-500 dark:text-gray-400">Credit: </span>
                  {formatAmount(creditLimit)}
                </span>
              </div>
            )}
            
            {(openingBalance || openingBalance === 0) && (
              <div className="flex items-center text-sm">
                <BanknotesIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-300">
                  <span className="text-gray-500 dark:text-gray-400">Balance: </span>
                  {formatAmount(openingBalance)}
                </span>
              </div>
            )}
            
            {(creditPeriod || creditPeriod === 0) && (
              <div className="flex items-center text-sm">
                <ClockIcon className="w-4 h-4 mr-2 text-gray-400 dark:text-gray-500" />
                <span className="text-gray-600 dark:text-gray-300">
                  <span className="text-gray-500 dark:text-gray-400">Terms: </span>
                  {creditPeriod} days
                </span>
              </div>
            )}
            
            {gstNumber && (
              <div className="flex items-center text-sm">
                <span className="mr-2 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 py-0.5 px-1.5 rounded">GST</span>
                <span className="text-gray-600 dark:text-gray-300">{gstNumber}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard; 
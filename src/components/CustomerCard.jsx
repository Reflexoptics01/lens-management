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

const CustomerCard = ({ customer, onEdit, onDelete, formatCurrency, isVendor = false }) => {
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center">
              <EntityIcon className="w-5 h-5 mr-2 text-gray-500" />
              <h3 className="text-lg font-semibold text-gray-900">{opticalName}</h3>
            </div>
            {contactPerson && (
              <p className="text-sm text-gray-600 flex items-center">
                <IdentificationIcon className="w-4 h-4 mr-1 text-gray-400" />
                {contactPerson}
              </p>
            )}
          </div>
          <div className="flex space-x-1">
            <button
              onClick={() => onEdit()}
              className="p-2 text-gray-400 hover:text-sky-600 rounded-full hover:bg-sky-50 transition-colors"
              aria-label={`Edit ${isVendor ? 'vendor' : 'customer'}`}
            >
              <PencilIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => onDelete()}
              className="p-2 text-gray-400 hover:text-red-600 rounded-full hover:bg-red-50 transition-colors"
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
                <PhoneIcon className="w-4 h-4 mr-2 text-gray-400" />
                <a href={`tel:${phone}`} className="text-sky-600 hover:text-sky-800">
                  {phone}
                </a>
              </div>
            )}
            
            {email && (
              <div className="flex items-center text-sm mt-2">
                <EnvelopeIcon className="w-4 h-4 mr-2 text-gray-400" />
                <a href={`mailto:${email}`} className="text-sky-600 hover:text-sky-800 truncate max-w-xs">
                  {email}
                </a>
              </div>
            )}

            {(city || state) && (
              <div className="flex items-start text-sm mt-2">
                <MapPinIcon className="w-4 h-4 mr-2 text-gray-400 mt-0.5" />
                <span className="text-gray-600">
                  {[city, state].filter(Boolean).join(', ')}
                </span>
              </div>
            )}
          </div>

          <div className="col-span-1 space-y-2">
            {(creditLimit || creditLimit === 0) && (
              <div className="flex items-center text-sm">
                <BanknotesIcon className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">
                  <span className="text-gray-500">Credit: </span>
                  {formatAmount(creditLimit)}
                </span>
              </div>
            )}
            
            {(openingBalance || openingBalance === 0) && (
              <div className="flex items-center text-sm">
                <BanknotesIcon className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">
                  <span className="text-gray-500">Balance: </span>
                  {formatAmount(openingBalance)}
                </span>
              </div>
            )}
            
            {(creditPeriod || creditPeriod === 0) && (
              <div className="flex items-center text-sm">
                <ClockIcon className="w-4 h-4 mr-2 text-gray-400" />
                <span className="text-gray-600">
                  <span className="text-gray-500">Terms: </span>
                  {creditPeriod} days
                </span>
              </div>
            )}
            
            {gstNumber && (
              <div className="flex items-center text-sm">
                <span className="mr-2 text-xs font-medium bg-gray-100 text-gray-800 py-0.5 px-1.5 rounded">GST</span>
                <span className="text-gray-600">{gstNumber}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerCard; 
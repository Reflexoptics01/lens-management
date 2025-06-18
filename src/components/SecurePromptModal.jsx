import React, { useState, useEffect } from 'react';
import { EyeIcon, EyeSlashIcon, ExclamationTriangleIcon, LockClosedIcon } from '@heroicons/react/24/outline';

/**
 * Secure Modal Component to replace window.prompt()
 * Provides proper validation and security features
 */
const SecurePromptModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title, 
  message, 
  inputType = 'text',
  placeholder = '',
  isPassword = false,
  requireConfirmation = false,
  validationRules = {},
  danger = false
}) => {
  const [inputValue, setInputValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setConfirmValue('');
      setError('');
      setShowPassword(false);
      setShowConfirmPassword(false);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Validation function
  const validateInput = (value, confirmValue = '') => {
    const { minLength, maxLength, pattern, required = true } = validationRules;

    if (required && !value.trim()) {
      return 'This field is required';
    }

    if (minLength && value.length < minLength) {
      return `Minimum ${minLength} characters required`;
    }

    if (maxLength && value.length > maxLength) {
      return `Maximum ${maxLength} characters allowed`;
    }

    if (pattern && !pattern.test(value)) {
      return 'Invalid format';
    }

    if (requireConfirmation && value !== confirmValue) {
      return 'Values do not match';
    }

    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validateInput(inputValue, confirmValue);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await onConfirm(inputValue);
      onClose();
    } catch (error) {
      setError(error.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setInputValue('');
    setConfirmValue('');
    setError('');
    onClose();
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleCancel();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleCancel}
          aria-hidden="true"
        />

        {/* Center modal */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>

        <div className="inline-block align-bottom bg-white dark:bg-gray-800 rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          {/* Header */}
          <div className="sm:flex sm:items-start">
            <div className={`mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full ${
              danger ? 'bg-red-100 dark:bg-red-900' : 'bg-blue-100 dark:bg-blue-900'
            } sm:mx-0 sm:h-10 sm:w-10`}>
              {danger ? (
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600 dark:text-red-400" />
              ) : (
                <LockClosedIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900 dark:text-white">
                {title}
              </h3>
              {message && (
                <div className="mt-2">
                  <p className="text-sm text-gray-500 dark:text-gray-400 whitespace-pre-line">
                    {message}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="mt-5">
            <div className="space-y-4">
              {/* Main input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {isPassword ? 'Password' : 'Value'}
                </label>
                <div className="relative">
                  <input
                    type={isPassword && !showPassword ? 'password' : inputType}
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={placeholder}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                    autoFocus
                    disabled={isLoading}
                  />
                  {isPassword && (
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeSlashIcon className="h-5 w-5" />
                      ) : (
                        <EyeIcon className="h-5 w-5" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Confirmation input */}
              {requireConfirmation && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Confirm {isPassword ? 'Password' : 'Value'}
                  </label>
                  <div className="relative">
                    <input
                      type={isPassword && !showConfirmPassword ? 'password' : inputType}
                      value={confirmValue}
                      onChange={(e) => setConfirmValue(e.target.value)}
                      placeholder={`Confirm ${placeholder}`}
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                      disabled={isLoading}
                    />
                    {isPassword && (
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                      >
                        {showConfirmPassword ? (
                          <EyeSlashIcon className="h-5 w-5" />
                        ) : (
                          <EyeIcon className="h-5 w-5" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                  <div className="flex">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
                    <div className="text-sm text-red-700 dark:text-red-200">
                      {error}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse space-y-2 sm:space-y-0 sm:space-x-reverse sm:space-x-3">
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  danger
                    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
                    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin -ml-1 mr-3 h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                    Processing...
                  </div>
                ) : (
                  'Confirm'
                )}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isLoading}
                className="w-full inline-flex justify-center rounded-md border border-gray-300 dark:border-gray-600 shadow-sm px-4 py-2 bg-white dark:bg-gray-700 text-base font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SecurePromptModal; 
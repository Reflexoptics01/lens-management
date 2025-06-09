import React, { useState, useEffect, useRef } from 'react';

const GlobalCalculator = ({ isOpen, onClose }) => {
  const [display, setDisplay] = useState('0');
  const [previousValue, setPreviousValue] = useState(null);
  const [operation, setOperation] = useState(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [gstRate, setGstRate] = useState(12); // Default GST rate
  const inputRef = useRef(null);

  // Focus on calculator when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      const key = e.key;
      
      // Numbers
      if (/[0-9]/.test(key)) {
        inputNumber(key);
      }
      // Operations
      else if (key === '+') {
        performOperation('+');
      }
      else if (key === '-') {
        performOperation('-');
      }
      else if (key === '*') {
        performOperation('*');
      }
      else if (key === '/') {
        e.preventDefault(); // Prevent browser search
        performOperation('/');
      }
      // Equals
      else if (key === '=' || key === 'Enter') {
        calculate();
      }
      // Clear
      else if (key === 'c' || key === 'C') {
        clear();
      }
      // Decimal
      else if (key === '.') {
        inputDecimal();
      }
      // Backspace
      else if (key === 'Backspace') {
        backspace();
      }
      // ESC to close
      else if (key === 'Escape') {
        onClose();
      }
      // GST shortcuts
      else if (key === 'g' || key === 'G') {
        deductGST();
      }
      else if (key === 'h' || key === 'H') {
        addGST();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, display, previousValue, operation, waitingForOperand]);

  const inputNumber = (num) => {
    if (waitingForOperand) {
      setDisplay(String(num));
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? String(num) : display + num);
    }
  };

  const inputDecimal = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
    } else if (display.indexOf('.') === -1) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setPreviousValue(null);
    setOperation(null);
    setWaitingForOperand(false);
  };

  const backspace = () => {
    if (display.length > 1) {
      setDisplay(display.slice(0, -1));
    } else {
      setDisplay('0');
    }
  };

  const performOperation = (nextOperation) => {
    const inputValue = parseFloat(display);

    if (previousValue === null) {
      setPreviousValue(inputValue);
    } else if (operation) {
      const currentValue = previousValue || 0;
      const newValue = calculate(currentValue, inputValue, operation);

      setDisplay(String(newValue));
      setPreviousValue(newValue);
    }

    setWaitingForOperand(true);
    setOperation(nextOperation);
  };

  const calculate = (firstValue, secondValue, operation) => {
    switch (operation) {
      case '+':
        return firstValue + secondValue;
      case '-':
        return firstValue - secondValue;
      case '*':
        return firstValue * secondValue;
      case '/':
        return firstValue / secondValue;
      default:
        return secondValue;
    }
  };

  const handleCalculate = () => {
    const inputValue = parseFloat(display);

    if (previousValue !== null && operation) {
      const newValue = calculate(previousValue, inputValue, operation);
      setDisplay(String(newValue));
      setPreviousValue(null);
      setOperation(null);
      setWaitingForOperand(true);
    }
  };

  // GST Deduction: Remove GST from the current display value
  const deductGST = () => {
    const value = parseFloat(display);
    if (!isNaN(value)) {
      const withoutGST = value / (1 + gstRate / 100);
      setDisplay(String(Math.round(withoutGST * 100) / 100));
      setWaitingForOperand(true);
    }
  };

  // GST Addition: Add GST to the current display value
  const addGST = () => {
    const value = parseFloat(display);
    if (!isNaN(value)) {
      const withGST = value * (1 + gstRate / 100);
      setDisplay(String(Math.round(withGST * 100) / 100));
      setWaitingForOperand(true);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 w-64">
        {/* Header */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-bold text-gray-900 dark:text-white">Calculator</h2>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 dark:text-gray-400">GST:</span>
            <input
              type="number"
              value={gstRate}
              onChange={(e) => setGstRate(Number(e.target.value))}
              className="w-10 text-xs px-1 py-0.5 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              min="0"
              max="50"
            />
            <span className="text-xs text-gray-500 dark:text-gray-400">%</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Display */}
        <div className="mb-3">
          <input
            ref={inputRef}
            type="text"
            value={display}
            readOnly
            className="w-full text-right text-lg font-mono p-2 border rounded-lg bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>

        {/* GST Buttons */}
        <div className="grid grid-cols-2 gap-1 mb-3">
          <button
            onClick={deductGST}
            className="px-2 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium"
          >
            Remove GST (G)
          </button>
          <button
            onClick={addGST}
            className="px-2 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium"
          >
            Add GST (H)
          </button>
        </div>

        {/* Calculator Buttons */}
        <div className="grid grid-cols-4 gap-1">
          {/* Row 1 */}
          <button
            onClick={clear}
            className="col-span-2 px-2 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-xs font-medium"
          >
            Clear (C)
          </button>
          <button
            onClick={backspace}
            className="px-2 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded text-xs font-medium"
          >
            ⌫
          </button>
          <button
            onClick={() => performOperation('/')}
            className="px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium"
          >
            ÷
          </button>

          {/* Row 2 */}
          <button
            onClick={() => inputNumber('7')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            7
          </button>
          <button
            onClick={() => inputNumber('8')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            8
          </button>
          <button
            onClick={() => inputNumber('9')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            9
          </button>
          <button
            onClick={() => performOperation('*')}
            className="px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium"
          >
            ×
          </button>

          {/* Row 3 */}
          <button
            onClick={() => inputNumber('4')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            4
          </button>
          <button
            onClick={() => inputNumber('5')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            5
          </button>
          <button
            onClick={() => inputNumber('6')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            6
          </button>
          <button
            onClick={() => performOperation('-')}
            className="px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium"
          >
            −
          </button>

          {/* Row 4 */}
          <button
            onClick={() => inputNumber('1')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            1
          </button>
          <button
            onClick={() => inputNumber('2')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            2
          </button>
          <button
            onClick={() => inputNumber('3')}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            3
          </button>
          <button
            onClick={() => performOperation('+')}
            className="px-2 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs font-medium"
          >
            +
          </button>

          {/* Row 5 */}
          <button
            onClick={() => inputNumber('0')}
            className="col-span-2 px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            0
          </button>
          <button
            onClick={inputDecimal}
            className="px-2 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-900 dark:text-white rounded text-xs font-medium"
          >
            .
          </button>
          <button
            onClick={handleCalculate}
            className="px-2 py-2 bg-green-500 hover:bg-green-600 text-white rounded text-xs font-medium"
          >
            =
          </button>
        </div>

        {/* Keyboard shortcuts info */}
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          C=Open • ESC=Close • G=Remove GST • H=Add GST
        </div>
      </div>
    </div>
  );
};

export default GlobalCalculator; 
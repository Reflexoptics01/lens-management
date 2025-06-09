import React from 'react';

const TestPrintPage = () => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <div style={{ padding: '50px', textAlign: 'center', backgroundColor: '#f0f0f0', minHeight: 'calc(100vh - 40px)' }} className="no-print">
        <h1>Test Print Page</h1>
        <p>This is a very simple page to test the browser's print functionality.</p>
        <button 
          onClick={handlePrint} 
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          Test Print
        </button>
      </div>
      <div className="print-only" style={{ border: '1px solid #ccc', padding: '20px', backgroundColor: 'white', color: 'black', margin: '20px' }}>
        <h2>Content to Print</h2>
        <p>Some sample text inside a box.</p>
        <ul>
          <li>Item 1</li>
          <li>Item 2</li>
          <li>Item 3</li>
        </ul>
      </div>
    </>
  );
};

export default TestPrintPage; 
import fs from 'fs';

const files = [
  'src/pages/Customers.jsx',
  'src/pages/Ledger.jsx',
  'src/components/AddStockLensForm.jsx'
];

files.forEach(filePath => {
  if (!fs.existsSync(filePath)) {
    console.log(`File not found: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  
  // Fix the multiline console.log pattern
  content = content.replace(
    /\/\/ REMOVED FOR PRODUCTION: console\.log\([^)]*\{[^}]*$/gm,
    (match) => match + ' */'
  );
  
  // Comment out any remaining uncommented lines that are part of console.log
  content = content.replace(
    /^(\s*)([\w\s:,]+),?\s*$/gm,
    (match, indent, code) => {
      // If this line looks like it's part of a console.log object
      if (code.includes(':') && !code.trim().startsWith('//')) {
        return `${indent}// ${code.trim()}`;
      }
      return match;
    }
  );

  fs.writeFileSync(filePath, content);
  console.log(`Fixed: ${filePath}`);
});

console.log('Syntax fixes completed!'); 
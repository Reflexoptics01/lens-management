import fs from 'fs';
import path from 'path';

const FILES_TO_CLEAN = [
  'src/pages/Transactions.jsx',
  'src/pages/SystemAnalytics.jsx',
  'src/pages/Settings.jsx',
  'src/pages/DailyDispatchLog.jsx',
  'src/pages/EditSale.jsx',
  'src/pages/CreateSale.jsx',
  'src/pages/CreatePurchase.jsx',
  'src/pages/EditPurchase.jsx',
  'src/pages/Orders.jsx',
  'src/pages/Customers.jsx',
  'src/pages/Purchases.jsx',
  'src/pages/Ledger.jsx',
  'src/pages/LensInventory.jsx',
  'src/components/Navbar.jsx',
  'src/components/AddStockLensForm.jsx',
  'src/components/CustomerForm.jsx'
];

function cleanFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  let lines = content.split('\n');
  let changes = 0;

  lines = lines.map(line => {
    // Remove debug console.log statements (but keep error handling)
    if (line.includes('console.log(') && 
        !line.includes('console.error') && 
        !line.includes('console.warn')) {
      
      // Skip if it's already commented
      if (line.trim().startsWith('//')) {
        return line;
      }

      // Comment out the console.log line
      const indentation = line.match(/^\s*/)[0];
      changes++;
      return `${indentation}// REMOVED FOR PRODUCTION: ${line.trim()}`;
    }

    return line;
  });

  if (changes > 0) {
    fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
    console.log(`✅ Fixed ${changes} console.log statements in ${filePath}`);
  } else {
    console.log(`✓ No console.log statements to fix in ${filePath}`);
  }
}

console.log('🧹 Starting production cleanup...\n');

FILES_TO_CLEAN.forEach(filePath => {
  cleanFile(filePath);
});

console.log('\n🎉 Production cleanup completed!');
console.log('\n📋 IMPORTANT NOTES:');
console.log('1. ⚠️  Many alert() calls remain and should be replaced with proper UI toasts');
console.log('2. ⚠️  Confirm/prompt dialogs should be replaced with proper modals');
console.log('3. ✅ Debug console.log statements have been commented out');
console.log('4. ✅ Error handling console.error/warn statements are preserved');
console.log('\n🚀 READY FOR MANUAL REVIEW AND TESTING'); 
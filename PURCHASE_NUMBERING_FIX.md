# Purchase Numbering Display Fix

## Issue Description
The Purchases.jsx page was displaying incorrect purchase numbers. The first purchase entry showed "P-002" instead of the correct purchase number that was assigned during creation.

## Root Cause
The issue was in the `fetchPurchases` function in `Purchases.jsx`. Instead of using the actual stored `purchaseNumber` from the database, the code was calculating a `displayId` based on the current document count:

```javascript
// INCORRECT: Calculating displayId based on document count
displayId: `P-${(snapshot.docs.length - index).toString().padStart(3, '0')}`
```

This meant:
- If there were 2 documents, the first document (index 0) got displayId `P-002`
- The second document (index 1) got displayId `P-001`
- This was backwards and ignored the actual stored purchase number

## Solution Applied
Updated the `fetchPurchases` function to use the actual stored `purchaseNumber` from each document:

```javascript
// FIXED: Using actual stored purchaseNumber
displayId: doc.data().purchaseNumber || `P-${doc.id.slice(-3)}`
```

### Changes Made

**File: `src/pages/Purchases.jsx`**
- **Line Changed**: ~99
- **Before**:
  ```javascript
  .map((doc, index) => ({
    id: doc.id,
    displayId: `P-${(snapshot.docs.length - index).toString().padStart(3, '0')}`,
    ...doc.data()
  }));
  ```
- **After**:
  ```javascript
  .map((doc) => ({
    id: doc.id,
    // Use the actual stored purchaseNumber instead of calculating displayId
    displayId: doc.data().purchaseNumber || `P-${doc.id.slice(-3)}`,
    ...doc.data()
  }));
  ```

## How Purchase Numbers Are Generated
Purchase numbers are correctly generated in `CreatePurchase.jsx` using:

1. **Financial Year-Based Counter System**: Uses user-specific counter documents
2. **Format**: `P-0001`, `P-0002`, etc.
3. **Storage**: Stored as `purchaseNumber` field in each purchase document
4. **Counter Management**: Auto-increments for each new purchase

## Verification
- ✅ Build completed successfully
- ✅ No compilation errors
- ✅ Maintains backward compatibility with fallback for missing purchase numbers
- ✅ Preserves user-specific multi-tenancy

## Result
Now the Purchases.jsx page correctly displays the actual purchase numbers that were assigned during creation, ensuring consistency between the creation process and the display.

## Related Files
- `src/pages/Purchases.jsx` - Fixed display logic
- `src/pages/CreatePurchase.jsx` - Purchase number generation (unchanged)

## Testing Recommendations
1. Create a new purchase and verify the correct number is shown
2. Check existing purchases display their original numbers
3. Verify purchase numbers increment correctly for new entries
4. Test across different users to ensure multi-tenancy works properly 
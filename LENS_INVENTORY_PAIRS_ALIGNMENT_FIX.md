# Lens Inventory Pairs and Alignment Improvements

## Overview
Updated the LensInventory.jsx page and all its components to support decimal quantities (pairs) allowing 0.5 for half pairs, and fixed alignment issues throughout the interface.

## Changes Made

### 1. **Quantity Support for Pairs (Decimal Values)**

**Problem**: Quantity fields only supported whole numbers (integers), but lenses are sold in pairs and users needed to enter 0.5 for half pairs.

**Solution**: 
- Changed all `parseInt(qty)` to `parseFloat(qty)` throughout the codebase
- Updated quantity input fields to support decimal values with `step="0.5"` and `min="0.5"`
- Added placeholder text "1" for clarity
- Updated table headers to show "QTY (Pairs)" for better understanding

**Files Updated**:
- `src/pages/LensInventory.jsx`
- `src/components/AddLensForm.jsx`
- `src/components/AddStockLensForm.jsx`
- `src/components/AddContactLensForm.jsx`
- `src/components/AddServiceForm.jsx`

### 2. **Alignment Improvements**

**Problem**: Input fields were center-aligned (`text-center`) making text entry awkward, and some table content was not properly left-aligned.

**Solution**:
- Changed all input field styling from `text-center` to `text-left`
- Ensured table headers and content are consistently left-aligned
- Updated display of quantity values to show "pairs" for clarity

**Styling Changes**:
```javascript
// Before
const inputClassName = "... text-center";

// After  
const inputClassName = "... text-left";
```

### 3. **Specific Component Updates**

#### **LensInventory.jsx**
- Updated `calculateInventoryMetrics()` to use `parseFloat()` for all quantity calculations
- Changed quantity display in card view to show `{parseFloat(lens.qty) || 1} pairs`
- Fixed table cell alignment to be left-aligned with `text-left` class
- Updated styling constants to use left alignment

#### **AddLensForm.jsx**
- Updated prescription table header: `QTY` → `QTY (Pairs)`
- Modified quantity input:
  ```jsx
  <input
    type="number"
    value={row.qty}
    onChange={(e) => handlePrescriptionChange(index, 'qty', parseFloat(e.target.value))}
    min="0.5"
    step="0.5"
    className={inputClassName + " text-xs"}
    placeholder="1"
  />
  ```
- Updated lens data handling to use `parseFloat(lensToEdit.qty)`

#### **AddStockLensForm.jsx**
- Updated table header: `QTY` → `QTY (Pairs)`
- Modified quantity input to support decimals with step="0.5" and min="0.5"
- Updated stock lens data processing to use `parseFloat(row.qty)`
- Changed input styling from center to left alignment

#### **AddContactLensForm.jsx**
- Updated table header: `QTY` → `QTY (Pairs)`
- Modified quantity input to support decimal values
- Updated contact lens data processing to use `parseFloat(row.qty)`
- Fixed input alignment issues

#### **AddServiceForm.jsx**
- Updated service quantity comment to clarify "1 pair" for consistency
- Services maintain quantity of 1 but follow the pairs concept

### 4. **Data Processing Updates**

**Inventory Metrics Calculation**:
- All quantity summations now use `parseFloat()` instead of `parseInt()`
- Inventory value calculations account for decimal quantities
- Brand grouping calculations handle decimal quantities properly

**Database Operations**:
- All create/update operations now store quantities as decimal values
- Filtering and display operations handle decimal quantities correctly

### 5. **User Interface Improvements**

**Table Headers**:
- All quantity columns now clearly labeled as "QTY (Pairs)"
- Consistent left alignment for all headers and content

**Input Fields**:
- All quantity inputs accept decimal values (0.5, 1, 1.5, 2, etc.)
- Minimum value set to 0.5 (half pair)
- Step value set to 0.5 for easy increment/decrement
- Placeholder text shows "1" for clarity

**Display Values**:
- Mobile card view shows quantities as "{qty} pairs"
- Table view shows decimal quantities properly formatted
- All calculations account for decimal quantities

## Benefits

1. **Better User Experience**: Users can now enter half pairs (0.5) for single lenses
2. **Improved Readability**: Left-aligned text in inputs is more natural for data entry
3. **Clarity**: "QTY (Pairs)" headers make it clear what the quantity represents
4. **Consistency**: All components follow the same patterns for quantity handling
5. **Accurate Inventory**: Decimal quantities provide more precise inventory tracking

## Testing

- Build completed successfully with no compilation errors
- All quantity calculations updated to handle decimal values
- Input validation maintains minimum value requirements
- Display formatting shows decimal quantities correctly

## Technical Details

**Quantity Input Configuration**:
```jsx
<input
  type="number"
  min="0.5"
  step="0.5"
  placeholder="1"
  onChange={(e) => handleChange(index, 'qty', parseFloat(e.target.value))}
/>
```

**Data Processing**:
```javascript
// Quantity calculations
const totalQty = lenses.reduce((sum, lens) => sum + (parseFloat(lens.qty) || 0), 0);

// Database storage
qty: parseFloat(row.qty) || 1
```

This update ensures the lens inventory system properly supports the concept of lens pairs while providing a more intuitive and consistent user interface. 
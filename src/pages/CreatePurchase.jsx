import { useState, useEffect, useRef } from 'react';
import { db } from '../firebaseConfig';
import { collection, getDocs, addDoc, serverTimestamp, query, where, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomerForm from '../components/CustomerForm';
import ItemSuggestions from '../components/ItemSuggestions';
import PowerInventoryModal from '../components/PowerInventoryModal';
import AddNewProductModal from '../components/AddNewProductModal';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import { dateToISOString } from '../utils/dateUtils';

const TAX_OPTIONS = [
  { id: 'TAX_FREE', label: 'Tax Free', rate: 0 },
  { id: 'CGST_SGST_6', label: 'CGST/SGST 6%', rate: 6, split: true },
  { id: 'CGST_SGST_12', label: 'CGST/SGST 12%', rate: 12, split: true },
  { id: 'CGST_SGST_18', label: 'CGST/SGST 18%', rate: 18, split: true },
  { id: 'IGST_6', label: 'IGST 6%', rate: 6 },
  { id: 'IGST_12', label: 'IGST 12%', rate: 12 },
  { id: 'IGST_18', label: 'IGST 18%', rate: 18 }
];

const UNIT_OPTIONS = [
  'Pairs',
  'Pcs',
  'Boxes',
  'Sets',
  'Bottles',
  'Cases'
];

const LENS_TYPES = [
  'Not Lens',
  'Stock Lens',
  'Contact Lens'
];

// Move the EMPTY_ROW constant above the CreatePurchase component
const EMPTY_ROW = {
  itemName: '',
  lensType: 'Stock Lens',
  maxSph: '',
  maxCyl: '',
  powerInventorySetup: false,
  powerInventoryData: null,
  qty: 1,
  unit: 'Pairs',
  price: 0,
  total: 0,
  // Add a unique identifier that changes when data is populated
  rowKey: Math.random().toString(36).substr(2, 9)
};

// CSS to remove number input arrows
const numberInputStyles = `
  .no-arrows::-webkit-outer-spin-button,
  .no-arrows::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  
  .no-arrows[type=number] {
    -moz-appearance: textfield;
  }
`;

const CreatePurchase = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showVendorModal, setShowVendorModal] = useState(false);
  
  // Purchase details
  const [purchaseNumber, setPurchaseNumber] = useState('');
  const [vendorInvoiceNumber, setVendorInvoiceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(dateToISOString(new Date()).split('T')[0]);
  const [selectedTaxOption, setSelectedTaxOption] = useState(TAX_OPTIONS[0].id);
  const [discountType, setDiscountType] = useState('amount'); // 'amount' or 'percentage'
  const [discountValue, setDiscountValue] = useState(0);
  const [frieghtCharge, setFrieghtCharge] = useState(0);
  const [notes, setNotes] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('UNPAID'); // 'UNPAID', 'PARTIAL', 'PAID'
  const [amountPaid, setAmountPaid] = useState(0);
  
  // Table rows (purchase items) - use the EMPTY_ROW constant
  const [tableRows, setTableRows] = useState(Array(5).fill().map(() => ({...EMPTY_ROW, rowKey: Math.random().toString(36).substr(2, 9)})));
  // Add a render trigger to force React re-rendering
  const [renderTrigger, setRenderTrigger] = useState(0);

  const [showVendorDropdown, setShowVendorDropdown] = useState(false);
  const [vendorSearchTerm, setVendorSearchTerm] = useState('');

  // Add item suggestions state
  const [itemSuggestions, setItemSuggestions] = useState([]);
  
  // PowerInventoryModal states
  const [showPowerInventoryModal, setShowPowerInventoryModal] = useState(false);
  const [pendingStockLens, setPendingStockLens] = useState(null);
  const [pendingPurchaseItems, setPendingPurchaseItems] = useState([]);

  // Add refs for direct DOM manipulation if React state isn't working
  const maxSphRefs = useRef([]);
  const maxCylRefs = useRef([]);

  // AddNewProductModal state
  const [showAddProductModal, setShowAddProductModal] = useState(false);

  // Monitor table rows state changes
  useEffect(() => {
    // State monitoring for table rows
  }, [tableRows]);

  useEffect(() => {
    fetchVendors();
    generatePurchaseNumber();
    fetchItems();
  }, []);

  // Listen for messages from popup windows
  useEffect(() => {
    const handleMessage = (event) => {
      // Check if the message is about a new vendor being created
      if (event.data && event.data.type === "VENDOR_CREATED") {
        fetchVendors().then(() => {
          // Find the newly created vendor in our updated vendors list
          const newVendor = vendors.find(v => v.id === event.data.customer.id);
          if (newVendor) {
            setSelectedVendor(newVendor);
            setVendorSearchTerm('');
          }
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [vendors]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const customersRef = getUserCollection('customers');
      const q = query(customersRef, where('type', '==', 'vendor'));
      const snapshot = await getDocs(q);
      const vendorsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setVendors(vendorsList);
      return vendorsList;
    } catch (error) {
      console.error('Error fetching vendors:', error);
      setError('Failed to fetch vendors');
      return [];
    } finally {
      setLoading(false);
    }
  };

  const generatePurchaseNumber = async () => {
    try {
      // Get the current financial year from user-specific settings
      const settingsDoc = await getDoc(getUserDoc('settings', 'shopSettings'));
      let financialYear = null;
      
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data();
        financialYear = settings.financialYear;
      }
      
      if (!financialYear) {
        // Fallback to simple counting method if no financial year is set
        const purchasesRef = getUserCollection('purchases');
        const snapshot = await getDocs(purchasesRef);
        const newPurchaseNumber = `P-${(snapshot.docs.length + 1).toString().padStart(4, '0')}`;
        setPurchaseNumber(newPurchaseNumber);
        return;
      }
      
      // Get the user-specific counter document for purchases in this financial year (DO NOT INCREMENT YET)
      const counterRef = getUserDoc('counters', `purchases_${financialYear}`);
      const counterDoc = await getDoc(counterRef);
      
      let counter;
      if (!counterDoc.exists()) {
        // If counter doesn't exist, preview starting from 1 (but don't create the counter yet)
        counter = {
          count: 1,
          prefix: 'P',
          separator: '-',
          format: '${prefix}${separator}${number}'
        };
      } else {
        counter = counterDoc.data();
        // Preview the next count (current + 1) without incrementing in Firestore
        counter.count = (counter.count || 0) + 1;
      }
      
      // Format the purchase number for preview
      const paddedNumber = counter.count.toString().padStart(4, '0');
      
      // Use the format specified in the counter or fall back to default
      let purchaseNumber;
      if (counter.format) {
        purchaseNumber = counter.format
          .replace('${prefix}', counter.prefix || 'P')
          .replace('${separator}', counter.separator || '-')
          .replace('${number}', paddedNumber);
      } else {
        purchaseNumber = `${counter.prefix || 'P'}${counter.separator || '-'}${paddedNumber}`;
      }
      
      setPurchaseNumber(purchaseNumber);
    } catch (error) {
      console.error('Error generating purchase number:', error);
      // Fallback to simple method
      try {
        const purchasesRef = getUserCollection('purchases');
        const snapshot = await getDocs(purchasesRef);
        const fallbackNumber = `P-${(snapshot.docs.length + 1).toString().padStart(4, '0')}`;
        setPurchaseNumber(fallbackNumber);
      } catch (fallbackError) {
        console.error('Error in fallback purchase numbering:', fallbackError);
        setPurchaseNumber('P-0001');
      }
    }
  };

  // Add function to fetch items and services for suggestions
  const fetchItems = async () => {
    try {
      // Only fetch items from 'lens_inventory' collection to restrict suggestions
      const lensRef = getUserCollection('lensInventory');
      const lensSnapshot = await getDocs(lensRef);
      
      // Process all items without deduplication to show all variants
      const itemsList = [];
      
      // Add lens inventory items to the list
      lensSnapshot.docs.forEach(doc => {
        const lens = { id: doc.id, ...doc.data() };
        
        let itemName = '';
        let displayName = '';
        
        if (lens.type === 'stock' && lens.brandName) {
          // For stock lenses, separate brand name and power series
          itemName = lens.brandName; // Just the brand name for the item field
          displayName = lens.powerSeries ? `${lens.brandName} (${lens.powerSeries})` : lens.brandName; // Display name with power range for suggestions
        } else if (lens.type === 'service' && (lens.serviceName || lens.brandName)) {
          itemName = lens.serviceName || lens.brandName;
          displayName = itemName;
        } else if (lens.type === 'contact' && lens.brandName) {
          itemName = lens.brandName;
          displayName = lens.powerSeries ? `${lens.brandName} (${lens.powerSeries})` : lens.brandName;
        } else if (lens.brandName) {
          itemName = lens.brandName;
          displayName = itemName;
        }
        
        if (itemName) {
          itemsList.push({
            id: lens.id,
            name: displayName, // For showing in suggestions with power range
            itemName: itemName, // Actual item name (brand only)
            price: lens.salePrice || lens.purchasePrice || lens.servicePrice || 0,
            createdAt: lens.createdAt,
            isStockLens: lens.type === 'stock',
            isService: lens.type === 'service',
            isContactLens: lens.type === 'contact',
            stockData: lens.type === 'stock' ? lens : null,
            serviceData: lens.type === 'service' ? lens : null,
            contactData: lens.type === 'contact' ? lens : null,
            type: lens.type,
            // Separate fields for proper form filling
            brandName: lens.brandName,
            powerSeries: lens.powerSeries,
            serviceDescription: lens.serviceDescription,
            maxSph: lens.maxSph,
            maxCyl: lens.maxCyl,
            material: lens.material,
            index: lens.index,
            axis: lens.axis,
            lensType: lens.lensType,
            ...lens
          });
        }
      });
      
      // Sort by display name and then by price
      itemsList.sort((a, b) => {
        const nameCompare = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
        if (nameCompare !== 0) return nameCompare;
        return (parseFloat(a.price) || 0) - (parseFloat(b.price) || 0);
      });
      
      setItemSuggestions(itemsList);
      // REMOVED FOR PRODUCTION: console.log(`Fetched ${itemsList.length} lens items for purchase (all variants included)`);
    } catch (error) {
      console.error('Error fetching items for purchase:', error);
    }
  };

  // Calculate row total
  const calculateRowTotal = (item) => {
    // If power inventory is set up, use the total quantity from power inventory data
    const quantity = item.powerInventorySetup && item.powerInventoryData 
      ? item.powerInventoryData.totalQuantity 
      : item.qty;
    return quantity * item.price;
  };

  // Calculate subtotal before tax/discount
  const calculateSubtotal = () => {
    return tableRows.reduce((sum, row) => {
      return sum + calculateRowTotal(row);
    }, 0);
  };
  
  // Calculate discount amount
  const calculateDiscountAmount = () => {
    const subtotal = calculateSubtotal();
    if (discountType === 'percentage') {
      return (subtotal * parseFloat(discountValue || 0)) / 100;
    }
    return parseFloat(discountValue || 0);
  };
  
  // Calculate tax amount
  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const taxableAmount = subtotal - discountAmount;
    const taxOption = TAX_OPTIONS.find(option => option.id === selectedTaxOption) || TAX_OPTIONS[0];
    return (taxableAmount * taxOption.rate) / 100;
  };
  
  // Calculate grand total
  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmount = calculateDiscountAmount();
    const taxAmount = calculateTaxAmount();
    const freight = parseFloat(frieghtCharge || 0);
    return subtotal - discountAmount + taxAmount + freight;
  };

  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor);
    setShowVendorDropdown(false);
  };

  // Add function to handle item selection from suggestions
  const handleItemSelect = (index, itemData) => {
    try {
      // Calculate maxSph and maxCyl values
      const maxSphValue = (itemData.type === 'stock' || itemData.type === 'contact') ? 
        (itemData.maxSph || itemData.MaxSph || itemData.max_sph || '') : '';
      const maxCylValue = (itemData.type === 'stock' || itemData.type === 'contact') ? 
        (itemData.maxCyl || itemData.MaxCyl || itemData.max_cyl || '') : '';
      
      // Use functional update to ensure React detects the change
      setTableRows(prevRows => {
        const updatedRows = [...prevRows];
        
        // Update the item with the selected data
        updatedRows[index] = {
          ...updatedRows[index],
          itemName: itemData.name || itemData.itemName || '',
          price: parseFloat(itemData.price || 0),
          description: itemData.serviceDescription || itemData.description || '',
          lensType: itemData.isService ? 'Not Lens' : (itemData.type === 'stock' ? 'Stock Lens' : itemData.type === 'contact' ? 'Contact Lens' : 'Stock Lens'),
          // Populate maxSph and maxCyl for lens items
          maxSph: maxSphValue,
          maxCyl: maxCylValue,
          // Generate new rowKey to force React re-render
          rowKey: Math.random().toString(36).substr(2, 9)
        };
        
        // Calculate the total using the calculateRowTotal function
        updatedRows[index].total = calculateRowTotal(updatedRows[index]);
        
        return updatedRows;
      });
      
      // Force React to re-render by updating a separate trigger
      setRenderTrigger(prev => prev + 1);
      
      // Add debug to check if state persists
      setTimeout(() => {
        setTableRows(currentRows => {
          return currentRows; // Return unchanged to avoid infinite loop
        });
      }, 10);
      
      // Add a small delay to ensure state update is complete, then force another render
      setTimeout(() => {
        setRenderTrigger(prev => prev + 1);
        
        // Direct DOM manipulation as fallback if React state isn't working
        try {
          if (maxSphRefs.current[index]) {
            maxSphRefs.current[index].value = maxSphValue;
            
            // Try multiple times in case React overrides it
            setTimeout(() => {
              maxSphRefs.current[index].value = maxSphValue;
            }, 200);
            
            setTimeout(() => {
              maxSphRefs.current[index].value = maxSphValue;
              
              // Try alternative approaches
              maxSphRefs.current[index].setAttribute('value', maxSphValue);
              
              // Dispatch input event to notify React
              const inputEvent = new Event('input', { bubbles: true });
              maxSphRefs.current[index].dispatchEvent(inputEvent);
            }, 500);
          }
          if (maxCylRefs.current[index]) {
            maxCylRefs.current[index].value = maxCylValue;
            
            // Try multiple times in case React overrides it
            setTimeout(() => {
              maxCylRefs.current[index].value = maxCylValue;
            }, 200);
            
            setTimeout(() => {
              maxCylRefs.current[index].value = maxCylValue;
              
              // Try alternative approaches
              maxCylRefs.current[index].setAttribute('value', maxCylValue);
              
              // Dispatch input event to notify React
              const inputEvent = new Event('input', { bubbles: true });
              maxCylRefs.current[index].dispatchEvent(inputEvent);
            }, 500);
          }
        } catch (error) {
          console.error('Error with DOM manipulation:', error);
        }
      }, 100);
      
    } catch (error) {
      console.error('Error in handleItemSelect:', error);
    }
  };

  const handleTableRowChange = (index, field, value) => {
    const updatedRows = [...tableRows];
    
    updatedRows[index] = {
      ...updatedRows[index],
      [field]: value
    };
    
    // Update the total when relevant fields change
    if (['qty', 'price'].includes(field)) {
      updatedRows[index].total = calculateRowTotal(updatedRows[index]);
    }
    
    setTableRows(updatedRows);
  };

  const handleVendorModalClose = async (vendorCreated) => {
    setShowVendorModal(false);
    if (vendorCreated) {
      // Refresh vendors list
      const updatedVendors = await fetchVendors();
      // Find the most recently created vendor (assuming it's the one with the latest createdAt timestamp)
      if (updatedVendors.length > 0) {
        const sortedVendors = [...updatedVendors].sort((a, b) => {
          // If createdAt is a timestamp, convert to Date objects
          const dateA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
          const dateB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
          return dateB - dateA;
        });
        
        setSelectedVendor(sortedVendors[0]);
      }
    }
  };

  // Function to increment the purchase counter after successful creation
  const incrementPurchaseCounter = async () => {
    try {
      // Get the current financial year from user-specific settings
      const settingsDoc = await getDoc(getUserDoc('settings', 'shopSettings'));
      let financialYear = null;
      
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data();
        financialYear = settings.financialYear;
      }
      
      if (!financialYear) {
        // Simple counter without financial year - not needed for fallback method
        return;
      }
      
      // Get or create the user-specific counter document for purchases in this financial year
      const counterRef = getUserDoc('counters', `purchases_${financialYear}`);
      const counterDoc = await getDoc(counterRef);
      
      if (!counterDoc.exists()) {
        // Create initial counter
        await setDoc(counterRef, {
          count: 1,
          prefix: 'P',
          separator: '-',
          format: '${prefix}${separator}${number}',
          createdAt: serverTimestamp()
        });
      } else {
        // Increment the counter
        const currentCount = counterDoc.data().count || 0;
        await updateDoc(counterRef, {
          count: currentCount + 1,
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error('Error incrementing purchase counter:', error);
      // Don't throw error to prevent blocking the purchase creation
    }
  };

  const addLensesToInventory = async (purchaseId) => {
    try {
      const stockLenses = [];
      const contactLenses = [];
      
      // Filter out lens items from the purchase
      for (const row of tableRows) {
        if (row.itemName && row.qty > 0 && (row.lensType === 'Stock Lens' || row.lensType === 'Contact Lens')) {
          // Generate power series from maxSph and maxCyl if available
          let powerSeries = 'N/A';
          if (row.maxSph && row.maxCyl) {
            const maxSphNum = parseFloat(row.maxSph);
            const maxCylNum = parseFloat(row.maxCyl);
            const sphRange = maxSphNum < 0 ? `${maxSphNum} to 0` : `0 to +${maxSphNum}`;
            const cylRange = maxCylNum < 0 ? `${maxCylNum} to 0` : `0 to +${maxCylNum}`;
            powerSeries = `SPH: ${sphRange}, CYL: ${cylRange}`;
          }
          
          if (row.lensType === 'Stock Lens') {
            let lensData = {
              brandName: row.itemName,
              powerSeries: powerSeries,
              maxSph: row.maxSph,
              maxCyl: row.maxCyl,
              purchasePrice: parseFloat(row.price) || 0,
              salePrice: (parseFloat(row.price) * 1.3) || 0, // 30% markup for sale price
              type: 'stock',
              createdAt: serverTimestamp(),
              purchaseId: purchaseId,
              notes: `Added from Purchase #${purchaseNumber}`,
              location: 'Main Cabinet'
            };
            
            // If power inventory was set up for this row, include that data
            if (row.powerInventorySetup && row.powerInventoryData) {
              lensData = {
                ...lensData,
                inventoryType: 'individual',
                powerInventory: row.powerInventoryData.powerInventory,
                powerLimits: row.powerInventoryData.powerLimits,
                totalQuantity: row.powerInventoryData.totalQuantity
              };
            } else {
              // Default to simple quantity
              lensData.qty = parseInt(row.qty) || 1;
            }
            
            stockLenses.push(lensData);
          } else if (row.lensType === 'Contact Lens') {
            contactLenses.push({
              brandName: row.itemName,
              powerSeries: powerSeries,
              purchasePrice: parseFloat(row.price) || 0,
              salePrice: (parseFloat(row.price) * 1.3) || 0,
              qty: parseInt(row.qty) || 1,
              type: 'contact',
              category: row.description || 'Standard',
              contactType: 'Standard',
              color: 'Clear',
              disposalFrequency: 'Daily',
              createdAt: serverTimestamp(),
              purchaseId: purchaseId,
              notes: `Added from Purchase #${purchaseNumber}`,
              location: 'Main Cabinet'
            });
          }
        }
      }
      
      // Add stock lenses to inventory
      for (const lens of stockLenses) {
        await addDoc(getUserCollection('lensInventory'), lens);
      }
      
      // Add contact lenses to inventory
      for (const lens of contactLenses) {
        await addDoc(getUserCollection('lensInventory'), lens);
      }
      
      const totalLensesAdded = stockLenses.length + contactLenses.length;
      
      return totalLensesAdded;
    } catch (error) {
      console.error('Error adding lenses to inventory:', error);
      throw error;
    }
  };

  // PowerInventoryModal handlers for CreatePurchase
  const handlePowerInventoryModalSave = async (inventoryData) => {
    try {
      setLoading(true);
      setError('');
      
      // Update the current row to mark power inventory as set up
      const updatedRows = [...tableRows];
      const rowIndex = pendingStockLens.rowIndex;
      
      updatedRows[rowIndex] = {
        ...updatedRows[rowIndex],
        powerInventorySetup: inventoryData.type === 'individual',
        powerInventoryData: inventoryData.type === 'individual' ? inventoryData.data : null
      };

      // Recalculate the total for this row
      updatedRows[rowIndex].total = calculateRowTotal(updatedRows[rowIndex]);
      
      setTableRows(updatedRows);
      
      // Close modal and reset states
      setShowPowerInventoryModal(false);
      setPendingStockLens(null);
      
      setError('');
      
    } catch (error) {
      console.error('Error setting up power inventory:', error);
      setError(`Failed to setup power inventory: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handlePowerInventoryModalClose = () => {
    setShowPowerInventoryModal(false);
    setPendingStockLens(null);
    setPendingPurchaseItems([]);
    setLoading(false);
  };
  
  const handleSavePurchase = async () => {
    if (!selectedVendor) {
      setError('Please select a vendor');
      return;
    }

    // Filter based on correct quantity (either qty or totalQuantity from power inventory)
    const filteredRows = tableRows.filter(row => {
      const hasItemName = row.itemName && row.itemName.trim();
      const hasPrice = row.price > 0;
      const effectiveQty = row.powerInventorySetup && row.powerInventoryData 
        ? row.powerInventoryData.totalQuantity 
        : row.qty;
      const hasQuantity = effectiveQty > 0;
      
      return hasItemName && hasPrice && hasQuantity;
    });
    
    if (filteredRows.length === 0) {
      setError('Please add at least one item to the purchase');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const purchaseData = {
        vendorId: selectedVendor.id,
        vendorName: selectedVendor.opticalName,
        vendorInvoiceNumber,
        purchaseNumber,
        purchaseDate,
        items: filteredRows,
        subtotal: calculateSubtotal(),
        discountType,
        discountValue: parseFloat(discountValue) || 0,
        discountAmount: calculateDiscountAmount(),
        taxOption: selectedTaxOption,
        taxAmount: calculateTaxAmount(),
        frieghtCharge: parseFloat(frieghtCharge) || 0,
        totalAmount: calculateTotal(),
        amountPaid: parseFloat(amountPaid) || 0,
        paymentStatus,
        balance: calculateTotal() - (parseFloat(amountPaid) || 0),
        notes,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(getUserCollection('purchases'), purchaseData);
      
      // Add lenses to inventory if any
      const lensItems = filteredRows.filter(row => 
        row.lensType === 'Stock Lens' || row.lensType === 'Contact Lens'
      );
      
      if (lensItems.length > 0) {
        const addedLensCount = await addLensesToInventory(docRef.id);
      }
      
      // Increment the purchase counter
      await incrementPurchaseCounter();
      
      setSuccess(true);
      navigate('/purchases');
    } catch (error) {
      console.error('Error saving purchase:', error);
      setError('Failed to save purchase. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Format currency for display
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  const filteredVendors = vendorSearchTerm
    ? vendors.filter(vendor => 
        vendor.opticalName.toLowerCase().includes(vendorSearchTerm.toLowerCase()) ||
        vendor.contactPerson?.toLowerCase().includes(vendorSearchTerm.toLowerCase())
      )
    : vendors;

  const handleSetupPowerInventoryForPurchase = (index) => {
    const row = tableRows[index];
    
    // Get DOM values for maxSph and maxCyl
    const domMaxSph = maxSphRefs.current[index]?.value || '';
    const domMaxCyl = maxCylRefs.current[index]?.value || '';
    
    if (!row.itemName || (!domMaxSph && !domMaxCyl)) {
      setError('Please fill in Item Name and at least one of Max SPH or Max CYL before setting up individual power inventory.');
      return;
    }
    
    if (row.lensType === 'Not Lens') {
      setError('Individual power inventory is only available for Stock Lens and Contact Lens items.');
      return;
    }
    
    // Use DOM values instead of React state
    const maxSphValue = domMaxSph || '0';
    const maxCylValue = domMaxCyl || '0';
    
    // Convert to numbers
    const maxSphNum = parseFloat(maxSphValue);
    const maxCylNum = parseFloat(maxCylValue);
    
    if ((domMaxSph && isNaN(maxSphNum)) || (domMaxCyl && isNaN(maxCylNum))) {
      setError('Max SPH and Max CYL must be valid numbers when provided.');
      return;
    }
    
    // Calculate power ranges based on the logic:
    // If negative: range is from entered value to 0 (e.g., -6 to 0)
    // If positive: range is from 0 to entered value (e.g., 0 to +3)
    // If not provided, use default value 0
    const sphMin = domMaxSph ? (maxSphNum < 0 ? maxSphNum : 0) : 0;
    const sphMax = domMaxSph ? (maxSphNum < 0 ? 0 : maxSphNum) : 0;
    const cylMin = domMaxCyl ? (maxCylNum < 0 ? maxCylNum : 0) : 0;
    const cylMax = domMaxCyl ? (maxCylNum < 0 ? 0 : maxCylNum) : 0;
    
    // Create power range string for display
    const sphRange = domMaxSph ? `${sphMin} to ${sphMax}` : '0 (Default)';
    const cylRange = domMaxCyl ? `${cylMin} to ${cylMax}` : '0 (Default)';
    const powerRange = `SPH: ${sphRange}, CYL: ${cylRange}`;
    
    // Clear any existing error
    setError('');
    
    setPendingStockLens({
      name: row.itemName,
      powerRange: powerRange,
      maxSph: maxSphValue,
      maxCyl: maxCylValue,
      sphMin,
      sphMax,
      cylMin,
      cylMax,
      purchasePrice: row.price,
      salePrice: row.price * 1.2, // Default 20% markup
      rowIndex: index
    });
    setShowPowerInventoryModal(true);
  };

  // Handle opening the AddNewProductModal
  const handleShowAddProduct = () => {
    setShowAddProductModal(true);
  };

  // Handle product creation from modal
  const handleProductCreated = (productData) => {
    setShowAddProductModal(false);
    // Refresh the items to include the new product
    fetchItems();
  };

  return (
    <>
      {/* Add custom styles */}
      <style>{numberInputStyles}</style>
      
      <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <Navbar />
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {/* Enhanced Header with Progress */}
          <div className="mb-8">
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start space-y-4 lg:space-y-0">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                      Create Purchase Order
                    </h1>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      Add new purchase from vendor with detailed item information
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <div className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Purchase Number</div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{purchaseNumber}</div>
                </div>
                <button
                  onClick={() => navigate('/purchases')}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Cancel
                </button>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 border-l-4 border-red-400 dark:border-red-500 rounded-r-lg" 
                 style={{ backgroundColor: 'var(--bg-tertiary)' }}>
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {/* Vendor Selection Card */}
            <div className="card p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                </div>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Vendor Information
                </h2>
              </div>
              
              {/* Selected Vendor Display */}
              {selectedVendor && (
                <div className="mb-6 bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100">
                        {selectedVendor.opticalName}
                      </h3>
                      <div className="mt-2 space-y-1">
                        {selectedVendor.contactPerson && (
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">Contact:</span> {selectedVendor.contactPerson}
                          </div>
                        )}
                        {selectedVendor.phone && (
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">Phone:</span> {selectedVendor.phone}
                          </div>
                        )}
                        {selectedVendor.email && (
                          <div className="text-sm text-blue-700 dark:text-blue-300">
                            <span className="font-medium">Email:</span> {selectedVendor.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedVendor(null);
                        setVendorSearchTerm('');
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 text-sm font-medium"
                    >
                      Change Vendor
                    </button>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Vendor Selection */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {selectedVendor ? 'Selected Vendor' : 'Select Vendor'} *
                    </label>
                    {!selectedVendor ? (
                      <div className="flex space-x-2">
                        <div className="relative flex-1">
                          <input 
                            type="text" 
                            value={vendorSearchTerm}
                            onChange={(e) => {
                              setVendorSearchTerm(e.target.value);
                              setShowVendorDropdown(true);
                            }}
                            onClick={() => setShowVendorDropdown(true)}
                            className="form-input w-full"
                            placeholder="Search for vendor..."
                          />
                          
                          {showVendorDropdown && (
                            <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg bg-white dark:bg-gray-800 py-1 text-sm shadow-lg ring-1 ring-black ring-opacity-5 border border-gray-200 dark:border-gray-600">
                              {filteredVendors.length === 0 ? (
                                <div className="py-3 px-4 text-gray-500 dark:text-gray-400 text-center">No vendors found</div>
                              ) : (
                                filteredVendors.map(vendor => (
                                  <div
                                    key={vendor.id}
                                    className="cursor-pointer py-3 px-4 hover:bg-gray-100 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-600 last:border-b-0"
                                    onClick={() => handleVendorSelect(vendor)}
                                  >
                                    <div className="font-medium text-gray-900 dark:text-white">{vendor.opticalName}</div>
                                    {vendor.contactPerson && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Contact: {vendor.contactPerson}</div>
                                    )}
                                    {vendor.phone && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400">Phone: {vendor.phone}</div>
                                    )}
                                  </div>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => setShowVendorModal(true)}
                          className="btn-primary flex items-center px-4 py-2 text-sm whitespace-nowrap"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                          </svg>
                          Add New
                        </button>
                      </div>
                    ) : (
                      <div className="text-base font-medium text-gray-900 dark:text-white">
                        {selectedVendor.opticalName}
                      </div>
                    )}
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Vendor Invoice Number
                    </label>
                    <input 
                      type="text" 
                      value={vendorInvoiceNumber}
                      onChange={(e) => setVendorInvoiceNumber(e.target.value)}
                      className="form-input w-full"
                      placeholder="Enter vendor's invoice number"
                    />
                  </div>
                </div>
                
                {/* Purchase Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Purchase Date *
                    </label>
                    <input 
                      type="date" 
                      value={purchaseDate}
                      onChange={(e) => setPurchaseDate(e.target.value)}
                      className="form-input w-full"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Purchase Number
                    </label>
                    <input 
                      type="text" 
                      value={purchaseNumber}
                      readOnly
                      className="form-input w-full bg-gray-50 dark:bg-gray-700 cursor-not-allowed"
                      placeholder="Auto-generated"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Purchase Items Card */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                    </div>
                  </div>
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Purchase Items
                  </h2>
                </div>
                
                <button
                  onClick={() => {
                    const newRows = Array(5).fill().map(() => ({...EMPTY_ROW, rowKey: Math.random().toString(36).substr(2, 9)}));
                    setTableRows([...tableRows, ...newRows]);
                  }}
                  className="btn-primary flex items-center px-4 py-2 text-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Add 5 Rows
                </button>
              </div>
              
              <div className="overflow-x-auto">
                <div className="inline-block min-w-full align-middle">
                  <div className="overflow-hidden rounded-lg border" style={{ borderColor: 'var(--border-primary)' }}>
                    <table className="min-w-full divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                      <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                        <tr>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '50px' }}>
                            #
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', minWidth: '250px' }}>
                            Item Details
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '120px' }}>
                            Lens Type
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '100px' }}>
                            Max SPH
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '100px' }}>
                            Max CYL
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '80px' }}>
                            Setup
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '80px' }}>
                            Qty
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '80px' }}>
                            Unit
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '100px' }}>
                            Price
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '100px' }}>
                            Total
                          </th>
                          <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wider" 
                              style={{ color: 'var(--text-muted)', width: '60px' }}>
                            Action
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                        {tableRows.map((row, index) => (
                          <tr key={`${row.rowKey}-${renderTrigger}`} className="hover:bg-opacity-50" style={{ ':hover': { backgroundColor: 'var(--bg-tertiary)' } }}>
                            <td className="px-3 py-3 text-center">
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                                {index + 1}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <ItemSuggestions
                                items={itemSuggestions}
                                value={row.itemName}
                                onChange={handleTableRowChange}
                                onSelect={handleItemSelect}
                                index={index}
                                placeholder="Enter item name..."
                                className="w-full px-3 py-2 text-sm border rounded-lg form-input"
                                onRefreshItems={fetchItems}
                                currentPrice={parseFloat(row.price) || 0}
                                onShowAddProduct={handleShowAddProduct}
                              />
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={row.lensType}
                                onChange={(e) => handleTableRowChange(index, 'lensType', e.target.value)}
                                className="form-input w-full text-sm text-center"
                              >
                                {LENS_TYPES.map(type => (
                                  <option key={type} value={type}>{type}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <input 
                                key={`maxSph-${row.rowKey}-${renderTrigger}`}
                                ref={el => maxSphRefs.current[index] = el}
                                type="number" 
                                defaultValue={row.maxSph || ''}
                                onChange={(e) => handleTableRowChange(index, 'maxSph', e.target.value)}
                                disabled={row.lensType === 'Not Lens'}
                                className="form-input w-full text-sm text-center no-arrows"
                                placeholder="-6.00"
                                step="0.25"
                              />
                            </td>
                            <td className="px-3 py-3">
                              <input 
                                key={`maxCyl-${row.rowKey}-${renderTrigger}`}
                                ref={el => maxCylRefs.current[index] = el}
                                type="number" 
                                defaultValue={row.maxCyl || ''}
                                onChange={(e) => handleTableRowChange(index, 'maxCyl', e.target.value)}
                                disabled={row.lensType === 'Not Lens'}
                                className="form-input w-full text-sm text-center no-arrows"
                                placeholder="-2.00"
                                step="0.25"
                              />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => {
                                  handleSetupPowerInventoryForPurchase(index);
                                }}
                                disabled={(() => {
                                  // Check DOM values for maxSph and maxCyl - activate if either is entered
                                  const domMaxSph = maxSphRefs.current[index]?.value || '';
                                  const domMaxCyl = maxCylRefs.current[index]?.value || '';
                                  return !row.itemName || (!domMaxSph && !domMaxCyl) || row.lensType === 'Not Lens';
                                })()}
                                className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                                  row.powerInventorySetup 
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                    : 'bg-blue-100 hover:bg-blue-200 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-700 dark:text-blue-400'
                                } disabled:opacity-50 disabled:cursor-not-allowed`}
                                title={row.powerInventorySetup ? 'Power inventory configured' : 'Setup power inventory'}
                              >
                                {row.powerInventorySetup ? '✓' : '⚙️'}
                              </button>
                            </td>
                            <td className="px-3 py-3">
                              {row.powerInventorySetup && row.powerInventoryData && row.lensType !== 'Not Lens' ? (
                                <input
                                  type="number"
                                  value={row.powerInventoryData.totalQuantity || 0}
                                  readOnly
                                  className="form-input w-full text-sm text-center bg-gray-100 dark:bg-gray-600 cursor-not-allowed"
                                  title="Quantity calculated from power inventory"
                                />
                              ) : (
                                <input 
                                  type="number" 
                                  value={row.qty}
                                  onChange={(e) => handleTableRowChange(index, 'qty', e.target.value)}
                                  className="form-input w-full text-sm text-center no-arrows"
                                  min="1"
                                />
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <select
                                value={row.unit}
                                onChange={(e) => handleTableRowChange(index, 'unit', e.target.value)}
                                className="form-input w-full text-sm text-center"
                              >
                                {UNIT_OPTIONS.map(unit => (
                                  <option key={unit} value={unit}>{unit}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-3">
                              <input 
                                type="number" 
                                value={row.price}
                                onChange={(e) => handleTableRowChange(index, 'price', e.target.value)}
                                className="form-input w-full text-sm text-center no-arrows"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                              />
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="font-semibold text-gray-900 dark:text-white">
                                {formatCurrency(row.total)}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <button
                                onClick={() => {
                                  const updatedRows = [...tableRows];
                                  updatedRows.splice(index, 1);
                                  setTableRows(updatedRows);
                                }}
                                className="w-8 h-8 rounded-lg bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 transition-colors"
                                title="Remove item"
                              >
                                <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </td>
                          </tr>
                        ))}
                        {tableRows.length === 0 && (
                          <tr>
                            <td colSpan="11" className="px-6 py-12 text-center">
                              <div className="flex flex-col items-center">
                                <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">No items added yet</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Click the "Add 5 Rows" button to start adding purchase items.</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
              
              {tableRows.length > 0 && (
                <div className="mt-4 flex justify-between items-center">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-medium">{tableRows.length}</span> items added
                  </div>
                  <button
                    onClick={() => {
                      const newRows = Array(5).fill().map(() => ({...EMPTY_ROW, rowKey: Math.random().toString(36).substr(2, 9)}));
                      setTableRows([...tableRows, ...newRows]);
                    }}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center font-medium"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Add 5 More Items
                  </button>
                </div>
              )}
            </div>

            {/* Purchase Summary Card */}
            <div className="card p-6">
              <div className="flex items-center space-x-3 mb-6">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Purchase Summary
                </h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Left Side - Input Controls */}
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Adjustments & Settings
                  </h4>
                  
                  {/* Discount Section */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Discount
                    </label>
                    <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value)}
                        className="form-input w-20 text-sm border-0 bg-transparent focus:ring-0"
                      >
                        <option value="amount">₹</option>
                        <option value="percentage">%</option>
                      </select>
                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                      <input 
                        type="number" 
                        value={discountValue}
                        onChange={(e) => setDiscountValue(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:focus:ring-blue-400 dark:focus:border-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white no-arrows"
                        min="0"
                        step={discountType === 'percentage' ? "0.01" : "1"}
                        placeholder={discountType === 'percentage' ? "Enter percentage (e.g., 10.5)" : "Enter amount (e.g., 500)"}
                      />
                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                      <div className="text-sm font-medium min-w-[80px] text-right text-green-600 dark:text-green-400">
                        {calculateDiscountAmount() > 0 ? formatCurrency(calculateDiscountAmount()) : '₹0.00'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Tax Section */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Tax Option
                    </label>
                    <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                      <select
                        value={selectedTaxOption}
                        onChange={(e) => setSelectedTaxOption(e.target.value)}
                        className="form-input flex-1 text-sm border-0 bg-transparent focus:ring-0"
                      >
                        {TAX_OPTIONS.map(option => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                      <div className="text-sm font-medium min-w-[80px] text-right text-blue-600 dark:text-blue-400">
                        {calculateTaxAmount() > 0 ? formatCurrency(calculateTaxAmount()) : '₹0.00'}
                      </div>
                    </div>
                  </div>
                  
                  {/* Freight Section */}
                  <div className="space-y-3">
                    <label className="block text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Freight Charges
                    </label>
                    <div className="flex items-center space-x-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-3">
                      <input 
                        type="number" 
                        value={frieghtCharge}
                        onChange={(e) => setFrieghtCharge(e.target.value)}
                        className="form-input flex-1 text-sm border-0 bg-transparent focus:ring-0"
                        min="0"
                        step="0.01"
                        placeholder="Enter freight charges (e.g., 200.00)"
                      />
                      <div className="w-px h-6 bg-gray-300 dark:bg-gray-600"></div>
                      <div className="text-sm font-medium min-w-[80px] text-right text-purple-600 dark:text-purple-400">
                        {parseFloat(frieghtCharge) > 0 ? formatCurrency(parseFloat(frieghtCharge) || 0) : '₹0.00'}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Right Side - Calculation Summary */}
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Calculation Breakdown
                  </h4>
                  
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-4">
                    {/* Subtotal */}
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
                        Subtotal
                      </span>
                      <span className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(calculateSubtotal())}
                      </span>
                    </div>
                    
                    {/* Discount Applied */}
                    {calculateDiscountAmount() > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-red-600 dark:text-red-400">
                          Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Amount'})
                        </span>
                        <span className="text-base font-semibold text-red-600 dark:text-red-400">
                          -{formatCurrency(calculateDiscountAmount())}
                        </span>
                      </div>
                    )}
                    
                    {/* Tax Applied */}
                    {calculateTaxAmount() > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-blue-600 dark:text-blue-400">
                          {TAX_OPTIONS.find(opt => opt.id === selectedTaxOption)?.label || 'Tax'}
                        </span>
                        <span className="text-base font-semibold text-blue-600 dark:text-blue-400">
                          +{formatCurrency(calculateTaxAmount())}
                        </span>
                      </div>
                    )}
                    
                    {/* Freight Applied */}
                    {parseFloat(frieghtCharge) > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-green-600 dark:text-green-400">
                          Freight Charges
                        </span>
                        <span className="text-base font-semibold text-green-600 dark:text-green-400">
                          +{formatCurrency(parseFloat(frieghtCharge) || 0)}
                        </span>
                      </div>
                    )}
                    
                    {/* Divider */}
                    <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                          Total Amount
                        </span>
                        <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(calculateTotal())}
                        </span>
                      </div>
                    </div>
                    
                    {/* Items Summary */}
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
                        <div className="flex justify-between">
                          <span>Total Items:</span>
                          <span>{tableRows.filter(row => row.itemName && row.itemName.trim()).length}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Total Quantity:</span>
                          <span>
                            {tableRows.reduce((sum, row) => {
                              if (!row.itemName || !row.itemName.trim()) return sum;
                              const qty = row.powerInventorySetup && row.powerInventoryData 
                                ? row.powerInventoryData.totalQuantity 
                                : row.qty;
                              return sum + (parseInt(qty) || 0);
                            }, 0)} pieces
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Details Card */}
            <div className="card p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-900/50 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                </div>
                <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Payment Details
                </h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Payment Status
                  </label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => {
                      setPaymentStatus(e.target.value);
                      if (e.target.value === 'PAID') {
                        setAmountPaid(calculateTotal());
                      } else if (e.target.value === 'UNPAID') {
                        setAmountPaid(0);
                      }
                    }}
                    className="form-input w-full"
                  >
                    <option value="UNPAID">Unpaid</option>
                    <option value="PARTIAL">Partially Paid</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
                
                {paymentStatus !== 'UNPAID' && (
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                      Amount Paid
                    </label>
                    <input 
                      type="number" 
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="form-input w-full no-arrows"
                      min="0"
                      max={calculateTotal()}
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                )}
                
                <div className={paymentStatus === 'UNPAID' ? 'md:col-span-2' : ''}>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Notes (Optional)
                  </label>
                  <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="form-input w-full"
                    rows="3"
                    placeholder="Additional notes about this purchase..."
                  ></textarea>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-4 pb-8">
              <button
                onClick={() => navigate('/purchases')}
                className="px-6 py-3 text-base font-medium rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel & Return
              </button>
              
              <button
                onClick={handleSavePurchase}
                disabled={loading || !selectedVendor || tableRows.filter(row => row.itemName).length === 0}
                className="btn-primary px-6 py-3 text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Saving Purchase...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                    </svg>
                    Save Purchase Order
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      {showVendorModal && (
        <CustomerForm isVendor={true} onClose={handleVendorModalClose} />
      )}

      {showPowerInventoryModal && (
        <PowerInventoryModal
          isOpen={showPowerInventoryModal}
          onClose={handlePowerInventoryModalClose}
          onSave={handlePowerInventoryModalSave}
          lensData={pendingStockLens}
        />
      )}

      {/* AddNewProductModal */}
      {showAddProductModal && (
        <AddNewProductModal
          isOpen={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          onProductCreated={handleProductCreated}
        />
      )}
    </>
  );
};

export default CreatePurchase; 
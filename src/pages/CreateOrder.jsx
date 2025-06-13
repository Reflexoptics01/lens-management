import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, Timestamp, query, orderBy, where, doc, getDoc, setDoc, updateDoc, increment } from 'firebase/firestore';
import { getUserCollection, getUserDoc } from '../utils/multiTenancy';
import Navbar from '../components/Navbar';
import OrderForm from '../components/OrderForm';
import { ArrowLeftIcon, PlusIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';
import CustomerForm from '../components/CustomerForm';
import { searchMatchingLenses } from '../utils/shopAPI';
import { useShortcutContext, useKeyboardShortcut } from '../utils/keyboardShortcuts';

// Define colors for visual organization
const SECTION_COLORS = {
  customer: { gradient: 'from-blue-600 to-indigo-600', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  lens: { gradient: 'from-purple-600 to-pink-600', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  coating: { gradient: 'from-teal-600 to-cyan-600', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  prescription: { gradient: 'from-green-600 to-teal-600', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  delivery: { gradient: 'from-amber-600 to-orange-600', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' }
};

// Helper function to get date 3 days from today in YYYY-MM-DD format
const getDateThreeDaysFromNow = () => {
  const today = new Date();
  const threeDaysFromNow = new Date(today.getTime() + (3 * 24 * 60 * 60 * 1000));
  return threeDaysFromNow.toISOString().split('T')[0];
};

const CreateOrder = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    customerName: '',
    consumerName: '',
    brandName: '',
    material: '',
    index: '',
    lensType: '',
    baseTint: '',
    coatingType: '',
    coatingColour: '',
    diameter: '',
    fogMark: false,
    fitting: 'None',
    rightSph: '',
    rightCyl: '',
    rightAxis: '',
    rightAdd: '',
    rightQty: '1',
    leftSph: '',
    leftCyl: '',
    leftAxis: '',
    leftAdd: '',
    leftQty: '1',
    expectedDeliveryDate: getDateThreeDaysFromNow(),
    price: '',
    specialNotes: ''
  });

  const [customers, setCustomers] = useState([]);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [vendorPhone, setVendorPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderId, setOrderId] = useState(null);
  const [nextOrderDisplayId, setNextOrderDisplayId] = useState('');
  
  // Add state for lens inventory matches
  const [matchingLenses, setMatchingLenses] = useState([]);
  const [showLensMatches, setShowLensMatches] = useState(false);
  
  // Add state for shop lens matches
  const [shopMatchingLenses, setShopMatchingLenses] = useState([]);
  const [shopLoading, setShopLoading] = useState(false);

  useEffect(() => {
    fetchCustomers();
    calculateNextOrderDisplayId();
  }, []);

  // Set up keyboard shortcuts context
  useShortcutContext('create-order');

  // ESC key to go back to orders
  useKeyboardShortcut('escape', () => {
    if (showCustomerForm || showWhatsAppModal) {
      // Let modals handle their own ESC key
      return;
    }
    navigate('/orders');
  }, {
    context: 'create-order',
    priority: 'high',
    description: 'Go back to orders list'
  });

  // Ctrl+S to submit form
  useKeyboardShortcut('ctrl+s', (e) => {
    e.preventDefault();
    if (!loading && !showCustomerForm && !showWhatsAppModal) {
      handleSubmit(e);
    }
  }, {
    context: 'create-order',
    priority: 'high',
    description: 'Save order'
  });

  // Add useEffect to update the expected delivery date to always be 3 days from today
  useEffect(() => {
    // Update the date immediately
    const updateDeliveryDate = () => {
      const newDate = getDateThreeDaysFromNow();
      if (formData.expectedDeliveryDate !== newDate) {
        setFormData(prev => ({
          ...prev,
          expectedDeliveryDate: newDate
        }));
      }
    };

    // Update immediately
    updateDeliveryDate();

    // Set up interval to check for date changes (check every hour)
    const interval = setInterval(() => {
      updateDeliveryDate();
    }, 60 * 60 * 1000); // Check every hour

    return () => clearInterval(interval);
  }, []); // Run only once on mount

  // Modify useEffect to search every time formData changes for prescription fields
  useEffect(() => {
    // Check for matching lenses whenever prescription data changes
    checkLensInventory();
  }, [
    formData.rightSph, 
    formData.rightCyl, 
    formData.rightAxis, 
    formData.rightAdd,
    formData.leftSph, 
    formData.leftCyl, 
    formData.leftAxis, 
    formData.leftAdd
  ]);

  const checkLensInventory = async () => {
    try {
      // Only search if we have prescription data for at least one eye
      if (!formData.rightSph && !formData.leftSph) {
        setMatchingLenses([]);
        setShopMatchingLenses([]);
        return;
      }
      
      // Search local lens inventory
      const lensInventoryRef = getUserCollection('lensInventory');
      
      // Get all RX lenses 
      const rxQuery = query(
        lensInventoryRef,
        where('type', '==', 'prescription')
      );
      
      const snapshot = await getDocs(rxQuery);
      
      if (snapshot.empty) {
        setMatchingLenses([]);
      } else {
        // Get all lenses
        const allLenses = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Apply the existing matching logic for local lenses
        const localMatches = findLocalMatches(allLenses);
        setMatchingLenses(localMatches);
      }
      
      // Search centralized shop for matching lenses
      setShopLoading(true);
      try {
        const prescriptionData = {
          rightSph: formData.rightSph,
          rightCyl: formData.rightCyl,
          rightAxis: formData.rightAxis,
          rightAdd: formData.rightAdd,
          leftSph: formData.leftSph,
          leftCyl: formData.leftCyl,
          leftAxis: formData.leftAxis,
          leftAdd: formData.leftAdd
        };
        
        const shopMatches = await searchMatchingLenses(prescriptionData);
        setShopMatchingLenses(shopMatches);
      } catch (error) {
        console.error('Error searching shop lenses:', error);
        setShopMatchingLenses([]);
      } finally {
        setShopLoading(false);
      }
      
    } catch (error) {
      console.error('Error checking lens inventory:', error);
      setMatchingLenses([]);
      setShopMatchingLenses([]);
    }
  };

  // Extract the existing local matching logic into a separate function
  const findLocalMatches = (allLenses) => {
    // Set tolerance parameters as specified
    const SPH_TOLERANCE = 0.25;
    const CYL_TOLERANCE = 0.25;
    const ADD_TOLERANCE = 0.25;
    const AXIS_TOLERANCE = 10; // 10 degrees tolerance
    
    // Helper function to check if prescription values match within tolerance
    const isWithinTolerance = (val1, val2, tolerance) => {
      // Handle empty strings and null/undefined values
      if (!val1 || val1 === '' || !val2 || val2 === '') return false;
      
      try {
        const num1 = parseFloat(val1);
        const num2 = parseFloat(val2);
        if (isNaN(num1) || isNaN(num2)) return false;
        
        const diff = Math.abs(num1 - num2);
        return diff <= tolerance;
      } catch (e) {
        return false;
      }
    };
    
    // Helper function to check if axis values match within tolerance
    const isAxisWithinTolerance = (val1, val2, tolerance = AXIS_TOLERANCE) => {
      // Handle empty strings and null/undefined values
      if (!val1 || val1 === '' || !val2 || val2 === '') return false;
      
      try {
        const num1 = parseInt(val1);
        const num2 = parseInt(val2);
        if (isNaN(num1) || isNaN(num2)) return false;
        
        // Handle wrap-around case (e.g., 5 degrees is close to 175 degrees in lens terminology)
        const diff = Math.abs(num1 - num2);
        const normalizedDiff = Math.min(diff, 180 - diff);
        return normalizedDiff <= tolerance;
      } catch (e) {
        return false;
      }
    };
    
    // Create separate matching arrays for right eye and left eye
    const rightEyeMatches = [];
    const leftEyeMatches = [];
    
    // If we have right eye prescription data, find matches
    if (formData.rightSph) {
      // Look for right eye lenses or lenses without specified eye
      for (const lens of allLenses) {
        // Only consider right eye lenses or unspecified eye
        if (lens.eye !== 'left') {
          // Require ALL values to match when present
          
          // Check SPH (always required to match)
          if (!lens.sph || !isWithinTolerance(lens.sph, formData.rightSph, SPH_TOLERANCE)) {
            continue;
          }
          
          // Check CYL
          // If either the prescription or lens has CYL, both must have it and match
          // But if both are empty, that's also a match
          if (formData.rightCyl || lens.cyl) {
            // If one has CYL but the other doesn't, it's not a match
            if ((!formData.rightCyl || formData.rightCyl === '') && (lens.cyl && lens.cyl !== '')) {
              continue;
            }
            if ((formData.rightCyl && formData.rightCyl !== '') && (!lens.cyl || lens.cyl === '')) {
              continue;
            }
            // If both have CYL, check if they match within tolerance
            if ((formData.rightCyl && formData.rightCyl !== '') && (lens.cyl && lens.cyl !== '')) {
              if (!isWithinTolerance(lens.cyl, formData.rightCyl, CYL_TOLERANCE)) {
                continue;
              }
            }
          }
          
          // Check AXIS (only if CYL is present in both)
          if ((formData.rightCyl && formData.rightCyl !== '') && (lens.cyl && lens.cyl !== '')) {
            // If either has AXIS, both must have it and match
            if (formData.rightAxis || lens.axis) {
              if ((!formData.rightAxis || formData.rightAxis === '') && (lens.axis && lens.axis !== '')) {
                continue;
              }
              if ((formData.rightAxis && formData.rightAxis !== '') && (!lens.axis || lens.axis === '')) {
                continue;
              }
              // If both have AXIS, check if they match within tolerance
              if ((formData.rightAxis && formData.rightAxis !== '') && (lens.axis && lens.axis !== '')) {
                if (!isAxisWithinTolerance(lens.axis, formData.rightAxis)) {
                  continue;
                }
              }
            }
          }
          
          // Check ADD
          // If either has ADD, both must have it and match
          // But if both are empty, that's also a match
          if (formData.rightAdd || lens.add) {
            // If one has ADD but the other doesn't, it's not a match
            if ((!formData.rightAdd || formData.rightAdd === '') && (lens.add && lens.add !== '')) {
              continue;
            }
            if ((formData.rightAdd && formData.rightAdd !== '') && (!lens.add || lens.add === '')) {
              continue;
            }
            // If both have ADD, check if they match within tolerance
            if ((formData.rightAdd && formData.rightAdd !== '') && (lens.add && lens.add !== '')) {
              if (!isWithinTolerance(lens.add, formData.rightAdd, ADD_TOLERANCE)) {
                continue;
              }
            }
          }
          
          // If we got here, all values match within tolerances
          rightEyeMatches.push({
            ...lens,
            matchedEye: 'right',
            isLocal: true,
            matchQuality: calculateMatchQuality(
              lens, 
              formData.rightSph, 
              formData.rightCyl, 
              formData.rightAxis, 
              formData.rightAdd
            )
          });
        }
      }
    }
    
    // If we have left eye prescription data, find matches
    if (formData.leftSph) {
      // Look for left eye lenses or lenses without specified eye
      for (const lens of allLenses) {
        // Only consider left eye lenses or unspecified eye
        if (lens.eye !== 'right') {
          // Require ALL values to match when present
          
          // Check SPH (always required to match)
          if (!lens.sph || !isWithinTolerance(lens.sph, formData.leftSph, SPH_TOLERANCE)) {
            continue;
          }
          
          // Check CYL
          // If either the prescription or lens has CYL, both must have it and match
          if (formData.leftCyl || lens.cyl) {
            // If one has CYL but the other doesn't, it's not a match
            if ((!formData.leftCyl || formData.leftCyl === '') && (lens.cyl && lens.cyl !== '')) {
              continue;
            }
            if ((formData.leftCyl && formData.leftCyl !== '') && (!lens.cyl || lens.cyl === '')) {
              continue;
            }
            // If both have CYL, check if they match within tolerance
            if ((formData.leftCyl && formData.leftCyl !== '') && (lens.cyl && lens.cyl !== '')) {
              if (!isWithinTolerance(lens.cyl, formData.leftCyl, CYL_TOLERANCE)) {
                continue;
              }
            }
          }
          
          // Check AXIS (only if CYL is present in both)
          if ((formData.leftCyl && formData.leftCyl !== '') && (lens.cyl && lens.cyl !== '')) {
            // If either has AXIS, both must have it and match
            if (formData.leftAxis || lens.axis) {
              if ((!formData.leftAxis || formData.leftAxis === '') && (lens.axis && lens.axis !== '')) {
                continue;
              }
              if ((formData.leftAxis && formData.leftAxis !== '') && (!lens.axis || lens.axis === '')) {
                continue;
              }
              // If both have AXIS, check if they match within tolerance
              if ((formData.leftAxis && formData.leftAxis !== '') && (lens.axis && lens.axis !== '')) {
                if (!isAxisWithinTolerance(lens.axis, formData.leftAxis)) {
                  continue;
                }
              }
            }
          }
          
          // Check ADD
          // If either has ADD, both must have it and match
          if (formData.leftAdd || lens.add) {
            // If one has ADD but the other doesn't, it's not a match
            if ((!formData.leftAdd || formData.leftAdd === '') && (lens.add && lens.add !== '')) {
              continue;
            }
            if ((formData.leftAdd && formData.leftAdd !== '') && (!lens.add || lens.add === '')) {
              continue;
            }
            // If both have ADD, check if they match within tolerance
            if ((formData.leftAdd && formData.leftAdd !== '') && (lens.add && lens.add !== '')) {
              if (!isWithinTolerance(lens.add, formData.leftAdd, ADD_TOLERANCE)) {
                continue;
              }
            }
          }
          
          // If we got here, all values match within tolerances
          leftEyeMatches.push({
            ...lens,
            matchedEye: 'left',
            isLocal: true,
            matchQuality: calculateMatchQuality(
              lens, 
              formData.leftSph, 
              formData.leftCyl, 
              formData.leftAxis, 
              formData.leftAdd
            )
          });
        }
      }
    }
    
    // Calculate match quality score (0-100%) to sort results
    function calculateMatchQuality(lens, sph, cyl, axis, add) {
      let score = 0;
      let factors = 0;
      
      // SPH match quality
      if (lens.sph && sph) {
        const sphDiff = Math.abs(parseFloat(lens.sph) - parseFloat(sph));
        score += Math.max(0, 1 - (sphDiff / SPH_TOLERANCE));
        factors++;
      }
      
      // CYL match quality
      if (lens.cyl && cyl) {
        const cylDiff = Math.abs(parseFloat(lens.cyl) - parseFloat(cyl));
        score += Math.max(0, 1 - (cylDiff / CYL_TOLERANCE));
        factors++;
      }
      
      // AXIS match quality
      if (lens.axis && axis) {
        const axisDiff = Math.abs(parseInt(lens.axis) - parseInt(axis));
        const normalizedAxisDiff = Math.min(axisDiff, 180 - axisDiff);
        score += Math.max(0, 1 - (normalizedAxisDiff / AXIS_TOLERANCE));
        factors++;
      }
      
      // ADD match quality
      if (lens.add && add) {
        const addDiff = Math.abs(parseFloat(lens.add) - parseFloat(add));
        score += Math.max(0, 1 - (addDiff / ADD_TOLERANCE));
        factors++;
      }
      
      // Calculate percentage
      return factors > 0 ? Math.round((score / factors) * 100) : 0;
    }
    
    // Combine both match arrays and sort by match quality
    const combinedMatches = [...rightEyeMatches, ...leftEyeMatches]
      .sort((a, b) => b.matchQuality - a.matchQuality);
    
    return combinedMatches;
  };

  const calculateNextOrderDisplayId = async () => {
    try {
      // Get the current financial year from user-specific settings
      const settingsDoc = await getDoc(getUserDoc('settings', 'shopSettings'));
      let financialYear = null;
      
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data();
        financialYear = settings.financialYear;
      }
      
      if (!financialYear) {

        // Fallback to simple counter without financial year
        const counterDoc = await getDoc(getUserDoc('counters', 'orderCounter'));
        
        if (!counterDoc.exists()) {
          // Preview starting from 001 (but don't create counter yet)
          setNextOrderDisplayId('001');
        } else {
          const currentCount = counterDoc.data().count || 0;
          const nextCount = currentCount + 1;
          setNextOrderDisplayId(nextCount.toString().padStart(3, '0'));
        }
        return;
      }
      
      // Use financial year-based counter
      const counterId = `orderCounter_${financialYear}`;
      const counterDoc = await getDoc(getUserDoc('counters', counterId));
      
      if (!counterDoc.exists()) {
        // Preview starting from 001 for this financial year (but don't create counter yet)
        setNextOrderDisplayId('001');
      } else {
        const currentCount = counterDoc.data().count || 0;
        const nextCount = currentCount + 1;
        setNextOrderDisplayId(nextCount.toString().padStart(3, '0'));
      }
    } catch (error) {
      console.error('Error calculating next order ID:', error);
      // Fallback to counting existing orders
      const ordersRef = getUserCollection('orders');
      const orderQuery = query(ordersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(orderQuery);
      
      const orderCount = snapshot.docs.length;
      const nextId = (orderCount + 1).toString().padStart(3, '0');
      setNextOrderDisplayId(nextId);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customersRef = getUserCollection('customers');
      const snapshot = await getDocs(customersRef);
      const customersList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCustomers(customersList);
    } catch (error) {
      console.error('Error fetching customers:', error);
      setError('Failed to fetch customers');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const selectInventoryLens = (lens) => {
    // Update form data with selected lens details
    if (lens.eye === 'right') {
      setFormData(prev => ({
        ...prev,
        rightSph: lens.sph || prev.rightSph,
        rightCyl: lens.cyl || prev.rightCyl,
        rightAxis: lens.axis || prev.rightAxis,
        rightAdd: lens.add || prev.rightAdd,
        material: lens.material || prev.material,
        index: lens.index || prev.index,
        baseTint: lens.baseTint || prev.baseTint,
        diameter: lens.diameter || prev.diameter,
        specialNotes: `Using inventory lens ID: ${lens.id}. ${prev.specialNotes || ''}`
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        leftSph: lens.sph || prev.leftSph,
        leftCyl: lens.cyl || prev.leftCyl,
        leftAxis: lens.axis || prev.leftAxis,
        leftAdd: lens.add || prev.leftAdd,
        material: lens.material || prev.material,
        index: lens.index || prev.index,
        baseTint: lens.baseTint || prev.baseTint,
        diameter: lens.diameter || prev.diameter,
        specialNotes: `Using inventory lens ID: ${lens.id}. ${prev.specialNotes || ''}`
      }));
    }
    
    // Close the matches panel
    setShowLensMatches(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Set error to empty initially
    setError('');
    
    // Additional validation for required fields - check customer name first
    if (!formData.customerName || formData.customerName.trim() === '') {
      setError('Customer name is required');
      // Focus on the customer name field
      document.querySelector('input[name="customerName"]')?.focus();
      return;
    }

    if (!formData.brandName || formData.brandName.trim() === '') {
      setError('Brand name is required');
      return;
    }

    if (!formData.expectedDeliveryDate || formData.expectedDeliveryDate.trim() === '') {
      setError('Expected delivery date is required');
      return;
    }
    
    // If we reach here, proceed with form submission
    setLoading(true);

    try {
      // Use the pre-calculated next order display ID
      const displayId = nextOrderDisplayId;

      const orderData = {
        ...formData,
        status: 'PENDING',
        displayId,
        createdAt: Timestamp.now()
      };

      const docRef = await addDoc(getUserCollection('orders'), orderData);
      setOrderId(docRef.id);
      
      // Increment the order counter after successful creation
      await incrementOrderCounter();
      
      // Add the lens to inventory
      await addLensToInventory(orderData, docRef.id);
      
      const customer = customers.find(c => c.opticalName === formData.customerName);
      if (customer?.phone) {
        setCustomerPhone(customer.phone);
      }
      
      setShowWhatsAppModal(true);
      
    } catch (error) {
      console.error('Error creating order:', error);
      setError('Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  // Function to increment the order counter
  const incrementOrderCounter = async () => {
    try {
      // Get the current financial year from user-specific settings
      const settingsDoc = await getDoc(getUserDoc('settings', 'shopSettings'));
      let financialYear = null;
      
      if (settingsDoc.exists()) {
        const settings = settingsDoc.data();
        financialYear = settings.financialYear;
      }
      
      if (!financialYear) {
        // Use simple counter without financial year
        const counterRef = getUserDoc('counters', 'orderCounter');
        const counterDoc = await getDoc(counterRef);
        
        if (!counterDoc.exists()) {
          // Create initial counter
          await setDoc(counterRef, { 
            count: 1,
            createdAt: Timestamp.now()
          });
        } else {
          const currentCount = counterDoc.data().count || 0;
          await updateDoc(counterRef, { 
            count: currentCount + 1,
            updatedAt: Timestamp.now()
          });
        }
        return;
      }
      
      // Use financial year-based counter
      const counterId = `orderCounter_${financialYear}`;
      const counterRef = getUserDoc('counters', counterId);
      const counterDoc = await getDoc(counterRef);
      
      if (!counterDoc.exists()) {
        // Create initial counter for this financial year
        await setDoc(counterRef, { 
          count: 1,
          financialYear: financialYear,
          createdAt: Timestamp.now()
        });
      } else {
        const currentCount = counterDoc.data().count || 0;
        await updateDoc(counterRef, { 
          count: currentCount + 1,
          updatedAt: Timestamp.now()
        });
      }
    } catch (error) {
      console.error('Error incrementing order counter:', error);
      // Don't throw error to prevent blocking the order creation
    }
  };

  // New function to add lens to inventory
  const addLensToInventory = async (orderData, orderId) => {
    try {
      // Check if the order has prescription data
      const hasRightEye = orderData.rightSph || orderData.rightCyl;
      const hasLeftEye = orderData.leftSph || orderData.leftCyl;
      
      if (!hasRightEye && !hasLeftEye) {

        return;
      }
      
      // Check order status - only add to inventory for valid statuses
      const validStatuses = ['RECEIVED', 'DISPATCHED', 'DELIVERED'];
      if (!validStatuses.includes(orderData.status)) {

        return;
      }
      
      // Create lens inventory items
      if (hasRightEye) {
        const rightLensData = {
          orderId: orderId,
          orderDisplayId: orderData.displayId,
          brandName: orderData.brandName,
          eye: 'right',
          sph: orderData.rightSph || '',
          cyl: orderData.rightCyl || '',
          axis: orderData.rightAxis || '',
          add: orderData.rightAdd || '',
          material: orderData.material || '',
          index: orderData.index || '',
          baseTint: orderData.baseTint || '',
          coatingType: orderData.coatingType || '',
          coatingColor: orderData.coatingColour || '',
          diameter: orderData.diameter || '',
          qty: parseInt(orderData.rightQty) || 1,
          purchasePrice: orderData.price || 0,
          salePrice: (parseFloat(orderData.price) * 1.3) || 0, // 30% markup for sale price
          type: 'prescription',
          status: orderData.status,
          location: 'Main Cabinet',
          notes: `Added from Order #${orderData.displayId}`,
          createdAt: Timestamp.now()
        };
        
        await addDoc(getUserCollection('lensInventory'), rightLensData);

      }
      
      if (hasLeftEye) {
        const leftLensData = {
          orderId: orderId,
          orderDisplayId: orderData.displayId,
          brandName: orderData.brandName,
          eye: 'left',
          sph: orderData.leftSph || '',
          cyl: orderData.leftCyl || '',
          axis: orderData.leftAxis || '',
          add: orderData.leftAdd || '',
          material: orderData.material || '',
          index: orderData.index || '',
          baseTint: orderData.baseTint || '',
          coatingType: orderData.coatingType || '',
          coatingColor: orderData.coatingColour || '',
          diameter: orderData.diameter || '',
          qty: parseInt(orderData.leftQty) || 1,
          purchasePrice: orderData.price || 0,
          salePrice: (parseFloat(orderData.price) * 1.3) || 0, // 30% markup for sale price
          type: 'prescription',
          status: orderData.status,
          location: 'Main Cabinet',
          notes: `Added from Order #${orderData.displayId}`,
          createdAt: Timestamp.now()
        };
        
        await addDoc(getUserCollection('lensInventory'), leftLensData);

      }
    } catch (error) {
      console.error('Error adding lens to inventory:', error);
      // Don't throw error to prevent blocking the order creation
    }
  };

  const handleCustomerFormClose = async (refreshNeeded = false) => {
    setShowCustomerForm(false);
    if (refreshNeeded) {
      await fetchCustomers();
    }
  };

  const sendWhatsAppMessage = (type, phone) => {
    if (!phone || !orderId) return;
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    
    // Use the nextOrderDisplayId that's already calculated and displayed in the UI
    const displayOrderId = nextOrderDisplayId || orderId.substring(0, 3);
    
    const message = type === 'vendor' 
      ? `🔔 *New Order #${displayOrderId}*\n\n` +
        `👤 *Consumer Details:*\n` +
        `Name: ${formData.consumerName || 'N/A'}\n\n` +
        `🕶 *Order Details:*\n` +
        `Brand: ${formData.brandName}\n` +
        `Expected Delivery: ${formData.expectedDeliveryDate}\n\n` +
        `*Lens Details:*\n` +
        `📍 Material: ${formData.material}\n` +
        `📍 Index: ${formData.index}\n` +
        `📍 Type: ${formData.lensType}\n` +
        `📍 Base Tint: ${formData.baseTint}\n` +
        `📍 Coating: ${formData.coatingType}${formData.coatingColour ? ` - ${formData.coatingColour}` : ''}\n` +
        `📍 Diameter: ${formData.diameter}\n` +
        `📍 Fitting: ${formData.fitting}\n\n` +
        `*Prescription Details:*\n` +
        `Right Eye:\n` +
        `• SPH: ${formData.rightSph || '0.00'}\n` +
        `• CYL: ${formData.rightCyl || '0.00'}\n` +
        `• AXIS: ${formData.rightAxis || '0'}\n` +
        `• ADD: ${formData.rightAdd || '0.00'}\n` +
        `• Qty: ${formData.rightQty || '1'} pieces\n\n` +
        `Left Eye:\n` +
        `• SPH: ${formData.leftSph || '0.00'}\n` +
        `• CYL: ${formData.leftCyl || '0.00'}\n` +
        `• AXIS: ${formData.leftAxis || '0'}\n` +
        `• ADD: ${formData.leftAdd || '0.00'}\n` +
        `• Qty: ${formData.leftQty || '1'} pieces\n\n` +
        `💰 Price: ₹${formData.price}\n` +
        (formData.specialNotes ? `\n📝 *Special Notes:*\n${formData.specialNotes}` : '')
      : `🎉 *Order Confirmation*\n\n` +
        `Dear ${formData.customerName || 'Customer'},\n\n` +
        `Your order has been successfully placed!\n\n` +
        `*Order Details:*\n` +
        `Order Reference: #${displayOrderId}\n` +
        `Brand: ${formData.brandName}\n` +
        `Expected Delivery: ${formData.expectedDeliveryDate}\n\n` +
        `*Lens Details:*\n` +
        `${formData.material ? `📍 Material: ${formData.material}\n` : ''}` +
        `${formData.index ? `📍 Index: ${formData.index}\n` : ''}` +
        `${formData.lensType ? `📍 Type: ${formData.lensType}\n` : ''}` +
        `${formData.baseTint ? `📍 Base Tint: ${formData.baseTint}\n` : ''}` +
        `${formData.coatingType ? `📍 Coating: ${formData.coatingType}${formData.coatingColour ? ` - ${formData.coatingColour}` : ''}\n` : ''}` +
        `${formData.diameter ? `📍 Diameter: ${formData.diameter}\n` : ''}` +
        `${formData.fitting !== 'None' ? `📍 Fitting: ${formData.fitting}\n` : ''}` +
        `\n*Prescription Details:*\n` +
        `Right Eye:\n` +
        `• SPH: ${formData.rightSph || '0.00'}\n` +
        `• CYL: ${formData.rightCyl || '0.00'}\n` +
        `• AXIS: ${formData.rightAxis || '0'}\n` +
        `• ADD: ${formData.rightAdd || '0.00'}\n` +
        `• Qty: ${formData.rightQty || '1'} pieces\n\n` +
        `Left Eye:\n` +
        `• SPH: ${formData.leftSph || '0.00'}\n` +
        `• CYL: ${formData.leftCyl || '0.00'}\n` +
        `• AXIS: ${formData.leftAxis || '0'}\n` +
        `• ADD: ${formData.leftAdd || '0.00'}\n` +
        `• Qty: ${formData.leftQty || '1'} pieces\n\n` +
        `💰 Amount: ₹${formData.price}\n` +
        (formData.specialNotes ? `\n📝 *Special Notes:*\n${formData.specialNotes}\n\n` : '\n\n') +
        `Thank you for choosing our services! We'll keep you updated on your order status.`;
    
    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <Navbar />
      
      <main className="flex-grow pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <button
                onClick={() => navigate('/orders')}
                className="flex items-center text-sm font-medium mb-4 px-4 py-2 rounded-lg bg-white dark:bg-gray-800 shadow-sm hover:shadow-md transition-all text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-400 border border-gray-100 dark:border-gray-700 hover:border-indigo-200 dark:hover:border-indigo-600 transform hover:scale-[1.02] duration-200"
              >
                <ArrowLeftIcon className="w-4 h-4 mr-2" />
                Back to Orders
              </button>
              <div className="flex items-center">
                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3.5 rounded-xl shadow-md mr-4">
                  <DocumentPlusIcon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent">Create New Order</h1>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Fill in the details below to create a new order</p>
                </div>
                {nextOrderDisplayId && (
                  <span className="ml-4 px-4 py-1.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-full text-sm font-medium shadow-sm">
                    Order #{nextOrderDisplayId}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Main Content Area for OrderForm */}
          <div className="bg-white dark:bg-gray-800 shadow-lg rounded-xl p-6 sm:p-8 border-t-4 border-blue-500">
            {/* Error message display - stays above form */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/50 border-l-4 border-red-500 rounded-md text-red-700 dark:text-red-200 shadow-sm animate-pulse">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-red-500 dark:text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {error}
                </div>
              </div>
            )}
            
            <OrderForm
              formData={formData}
              onChange={handleInputChange}
              onSubmit={handleSubmit}
              customers={customers}
              onAddNewCustomer={() => setShowCustomerForm(true)}
              loading={loading}
              error={error}
              matchingLenses={matchingLenses}
              shopMatchingLenses={shopMatchingLenses}
              shopLoading={shopLoading}
              sectionColors={SECTION_COLORS}
            />
            
            {/* Submit button for desktop view */}
            <div className="mt-10 hidden sm:flex sm:justify-end">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="relative px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] duration-300 flex items-center justify-center font-medium overflow-hidden group"
              >
                <span className="absolute inset-0 w-full h-full bg-gradient-to-br from-blue-600 to-indigo-600"></span>
                <span className="absolute bottom-0 right-0 block w-64 h-64 mb-32 mr-4 transition-all duration-500 origin-bottom-left transform rotate-45 translate-x-24 bg-pink-500 opacity-30 group-hover:rotate-90 ease rounded-full"></span>
                <span className="relative flex items-center">
                  {loading ? (
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <DocumentPlusIcon className="w-5 h-5 mr-2" />
                  )}
                  {loading ? 'Creating Order...' : 'Submit Order'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Floating Submit Button - Mobile Only */}
      <div className="fixed bottom-0 left-0 right-0 p-3 bg-gradient-to-br from-blue-600 to-indigo-600 border-t border-blue-700 shadow-xl z-30 mb-[65px] sm:hidden">
        <div className="relative max-w-5xl mx-auto">
          {/* Animated background element */}
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] animate-pulse-slow bg-gradient-to-br from-blue-500/30 to-indigo-500/30 rounded-full"></div>
          </div>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="relative w-full px-4 py-2 bg-white text-blue-700 rounded-lg shadow-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] duration-300 flex items-center justify-center font-medium"
          >
            {loading ? (
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <DocumentPlusIcon className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Creating Order...' : 'Submit Order'}
          </button>
        </div>
      </div>

      {/* Customer Form Modal */}
      {showCustomerForm && (
        <CustomerForm 
          onClose={handleCustomerFormClose}
          customer={null}
        />
      )}

      {/* WhatsApp Modal */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Send Order Details</h3>
              <button 
                onClick={() => { 
                  setShowWhatsAppModal(false); 
                  setVendorPhone(''); 
                  navigate('/orders');
                }} 
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label htmlFor="vendorPhone" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Vendor's Phone Number (Optional)
                </label>
                <input
                  id="vendorPhone"
                  type="tel"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="Enter with country code (e.g., +911234567890)"
                  className="w-full rounded-lg border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2.5 text-gray-900 dark:text-white shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 text-sm transition-colors"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Leave blank if you don't want to message the vendor.</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {/* Primary Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                {customerPhone && (
                  <button
                    type="button"
                    onClick={() => sendWhatsAppMessage('customer', customerPhone)}
                    className="flex-1 inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.787"/>
                    </svg>
                    Send to Customer
                  </button>
                )}
                {vendorPhone && (
                  <button
                    type="button"
                    onClick={() => sendWhatsAppMessage('vendor', vendorPhone)}
                    className="flex-1 inline-flex items-center justify-center px-4 py-3 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
                  >
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.787"/>
                    </svg>
                    Send to Vendor
                  </button>
                )}
              </div>
              
              {/* Secondary Action */}
              <button
                type="button"
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setVendorPhone('');
                  navigate('/orders');
                }}
                className="w-full px-4 py-3 text-sm font-medium rounded-lg text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition-all duration-200"
              >
                Skip & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateOrder; 
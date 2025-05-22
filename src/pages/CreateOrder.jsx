import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, addDoc, getDocs, Timestamp, query, orderBy, where } from 'firebase/firestore';
import Navbar from '../components/Navbar';
import OrderForm from '../components/OrderForm';
import { ArrowLeftIcon, PlusIcon, DocumentPlusIcon } from '@heroicons/react/24/outline';
import CustomerForm from '../components/CustomerForm';

// Define colors for visual organization
const SECTION_COLORS = {
  customer: { gradient: 'from-blue-600 to-indigo-600', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  lens: { gradient: 'from-purple-600 to-pink-600', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  coating: { gradient: 'from-teal-600 to-cyan-600', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700' },
  prescription: { gradient: 'from-green-600 to-teal-600', bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  delivery: { gradient: 'from-amber-600 to-orange-600', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' }
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
    expectedDeliveryDate: '',
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

  useEffect(() => {
    fetchCustomers();
    calculateNextOrderDisplayId();
  }, []);

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
        return;
      }
      
      console.log("Checking lens inventory for matches...");
      
      const lensInventoryRef = collection(db, 'lens_inventory');
      
      // Get all RX lenses 
      const rxQuery = query(
        lensInventoryRef,
        where('type', '==', 'prescription')
      );
      
      const snapshot = await getDocs(rxQuery);
      if (snapshot.empty) {
        console.log("No RX lenses found in inventory");
        setMatchingLenses([]);
        return;
      }
      
      // Get all lenses
      const allLenses = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`Found ${allLenses.length} RX lenses in inventory`);
      
      // Set tolerance parameters as specified
      const SPH_TOLERANCE = 0.25;
      const CYL_TOLERANCE = 0.25;
      const ADD_TOLERANCE = 0.25;
      const AXIS_TOLERANCE = 10; // 10 degrees tolerance
      
      // Helper function to check if prescription values match within tolerance
      const isWithinTolerance = (val1, val2, tolerance) => {
        if (!val1 || !val2) return false;
        
        try {
          const num1 = parseFloat(val1);
          const num2 = parseFloat(val2);
          if (isNaN(num1) || isNaN(num2)) return false;
          
          return Math.abs(num1 - num2) <= tolerance;
        } catch (e) {
          return false;
        }
      };
      
      // Helper function to check if axis values match within tolerance
      const isAxisWithinTolerance = (val1, val2, tolerance = AXIS_TOLERANCE) => {
        if (!val1 || !val2) return false;
        
        try {
          const num1 = parseInt(val1);
          const num2 = parseInt(val2);
          if (isNaN(num1) || isNaN(num2)) return false;
          
          // Handle wrap-around case (e.g., 5 degrees is close to 175 degrees in lens terminology)
          const diff = Math.abs(num1 - num2);
          return diff <= tolerance || diff >= (180 - tolerance);
        } catch (e) {
          return false;
        }
      };
      
      // Create separate matching arrays for right eye and left eye
      const rightEyeMatches = [];
      const leftEyeMatches = [];
      
      // If we have right eye prescription data, find matches
      if (formData.rightSph) {
        console.log(`Searching for right eye matches with SPH: ${formData.rightSph}`);
        
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
            if ((formData.rightCyl || lens.cyl) && 
                (!formData.rightCyl || !lens.cyl || !isWithinTolerance(lens.cyl, formData.rightCyl, CYL_TOLERANCE))) {
              continue;
            }
            
            // Check AXIS (only if CYL is present in both)
            if (formData.rightCyl && lens.cyl) {
              // If either has AXIS, both must have it and match
              if ((formData.rightAxis || lens.axis) && 
                  (!formData.rightAxis || !lens.axis || !isAxisWithinTolerance(lens.axis, formData.rightAxis))) {
                continue;
              }
            }
            
            // Check ADD
            // If either has ADD, both must have it and match
            if ((formData.rightAdd || lens.add) && 
                (!formData.rightAdd || !lens.add || !isWithinTolerance(lens.add, formData.rightAdd, ADD_TOLERANCE))) {
              continue;
            }
            
            // If we got here, all values match within tolerances
            {
              console.log(`Found matching lens for right eye:`, lens);
              rightEyeMatches.push({
                ...lens,
                matchedEye: 'right',
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
      }
      
      // If we have left eye prescription data, find matches
      if (formData.leftSph) {
        console.log(`Searching for left eye matches with SPH: ${formData.leftSph}`);
        
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
            if ((formData.leftCyl || lens.cyl) && 
                (!formData.leftCyl || !lens.cyl || !isWithinTolerance(lens.cyl, formData.leftCyl, CYL_TOLERANCE))) {
              continue;
            }
            
            // Check AXIS (only if CYL is present in both)
            if (formData.leftCyl && lens.cyl) {
              // If either has AXIS, both must have it and match
              if ((formData.leftAxis || lens.axis) && 
                  (!formData.leftAxis || !lens.axis || !isAxisWithinTolerance(lens.axis, formData.leftAxis))) {
                continue;
              }
            }
            
            // Check ADD
            // If either has ADD, both must have it and match
            if ((formData.leftAdd || lens.add) && 
                (!formData.leftAdd || !lens.add || !isWithinTolerance(lens.add, formData.leftAdd, ADD_TOLERANCE))) {
              continue;
            }
            
            // If we got here, all values match within tolerances
            {
              console.log(`Found matching lens for left eye:`, lens);
              leftEyeMatches.push({
                ...lens,
                matchedEye: 'left',
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
      
      console.log(`Found ${combinedMatches.length} total matching lenses`);
      
      setMatchingLenses(combinedMatches);
      
    } catch (error) {
      console.error('Error checking lens inventory:', error);
      setMatchingLenses([]);
    }
  };

  const calculateNextOrderDisplayId = async () => {
    try {
      const ordersRef = collection(db, 'orders');
      const orderQuery = query(ordersRef, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(orderQuery);
      
      // Calculate the next order number
      const orderCount = snapshot.docs.length;
      const nextId = (orderCount + 1).toString().padStart(3, '0');
      setNextOrderDisplayId(nextId);
    } catch (error) {
      console.error('Error calculating next order ID:', error);
    }
  };

  const fetchCustomers = async () => {
    try {
      const customersRef = collection(db, 'customers');
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

      const docRef = await addDoc(collection(db, 'orders'), orderData);
      setOrderId(docRef.id);
      
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

  // New function to add lens to inventory
  const addLensToInventory = async (orderData, orderId) => {
    try {
      // Check if the order has prescription data
      const hasRightEye = orderData.rightSph || orderData.rightCyl;
      const hasLeftEye = orderData.leftSph || orderData.leftCyl;
      
      if (!hasRightEye && !hasLeftEye) {
        console.log('No prescription data to add to inventory');
        return;
      }
      
      // Check order status - only add to inventory for valid statuses
      const validStatuses = ['RECEIVED', 'DISPATCHED', 'DELIVERED'];
      if (!validStatuses.includes(orderData.status)) {
        console.log(`Not adding to inventory due to status: ${orderData.status}`);
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
        
        await addDoc(collection(db, 'lens_inventory'), rightLensData);
        console.log('Added right eye lens to inventory');
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
        
        await addDoc(collection(db, 'lens_inventory'), leftLensData);
        console.log('Added left eye lens to inventory');
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
    
    // Get the display ID from the form data or use the first 3 characters of the ID as fallback
    const displayOrderId = formData.displayId || orderId.substring(0, 3);
    
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
    console.log('Opening WhatsApp URL:', whatsappUrl);
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <Navbar />
      
      <main className="flex-grow pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
          {/* Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
            <div>
              <button
                onClick={() => navigate('/orders')}
                className="flex items-center text-sm font-medium mb-4 px-4 py-2 rounded-lg bg-white shadow-sm hover:shadow-md transition-all text-gray-700 hover:text-indigo-700 border border-gray-100 hover:border-indigo-200 transform hover:scale-[1.02] duration-200"
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
                  <p className="text-gray-500 text-sm mt-1">Fill in the details below to create a new order</p>
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
          <div className="bg-white shadow-lg rounded-xl p-6 sm:p-8 border-t-4 border-blue-500">
            {/* Error message display - stays above form */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 rounded-md text-red-700 shadow-sm animate-pulse">
                <div className="flex items-center">
                  <svg className="w-5 h-5 mr-2 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
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
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-br from-blue-600 to-indigo-600 border-t border-blue-700 shadow-xl z-30 mb-[65px] sm:hidden">
        <div className="relative max-w-5xl mx-auto">
          {/* Animated background element */}
          <div className="absolute inset-0 overflow-hidden rounded-lg">
            <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] animate-pulse-slow bg-gradient-to-br from-blue-500/30 to-indigo-500/30 rounded-full"></div>
          </div>
          
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="relative w-full px-4 py-3.5 bg-white text-blue-700 rounded-lg shadow-md hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all transform hover:scale-[1.02] duration-300 flex items-center justify-center font-medium"
          >
            {loading ? (
              <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-blue-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            ) : (
              <DocumentPlusIcon className="w-5 h-5 mr-2" />
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
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity duration-300 ease-in-out opacity-100">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md transform transition-all duration-300 ease-in-out scale-100 p-5">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-800">Send Order Details</h3>
               <button onClick={() => { setShowWhatsAppModal(false); setVendorPhone(''); navigate('/orders');}} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="vendorPhone" className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor's Phone Number (Optional)
                </label>
                <input
                  id="vendorPhone"
                  type="tel"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="Enter with country code (e.g., +911234567890)"
                  className="w-full rounded-lg border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500 text-sm"
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank if you don't want to message the vendor.</p>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row sm:justify-end sm:space-x-3 space-y-2 sm:space-y-0">
              <button
                type="button"
                onClick={() => {
                  setShowWhatsAppModal(false);
                  setVendorPhone('');
                  navigate('/orders');
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium rounded-lg text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400"
              >
                Skip & Close
              </button>
              {customerPhone && (
                <button
                  type="button"
                  onClick={() => sendWhatsAppMessage('customer', customerPhone)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Send to Customer
                </button>
              )}
              {vendorPhone && (
                <button
                  type="button"
                  onClick={() => sendWhatsAppMessage('vendor', vendorPhone)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
                >
                  Send to Vendor
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CreateOrder; 
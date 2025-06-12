import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import AdminPanel from './pages/AdminPanel';
import ForgotPassword from './pages/ForgotPassword';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import CreateOrder from './pages/CreateOrder';
import EditOrder from './pages/EditOrder';
import DailyDispatchLog from './pages/DailyDispatchLog';
import Customers from './pages/Customers';
import CreateCustomer from './pages/CreateCustomer';
import Sales from './pages/Sales';
import CreateSale from './pages/CreateSale';
import EditSale from './pages/EditSale';
import Settings from './pages/Settings';
import SaleDetail from './pages/SaleDetail';
import TestPrintPage from './pages/TestPrintPage';
import Transactions from './pages/Transactions';
import Ledger from './pages/Ledger';
import GSTReturns from './pages/GSTReturns';
import Dashboard from './pages/Dashboard';
import Purchases from './pages/Purchases';
import CreatePurchase from './pages/CreatePurchase';
import EditPurchase from './pages/EditPurchase';
import PurchaseDetail from './pages/PurchaseDetail';
import LensInventory from './pages/LensInventory';
import LensDetail from './pages/LensDetail';
import LensInventoryReport from './pages/LensInventoryReport';
import ReorderDashboard from './pages/ReorderDashboard';
import SalesReturn from "./pages/SalesReturn";
import PurchaseReturn from "./pages/PurchaseReturn";
import Shop from './pages/Shop';
import FloatingShopIcon from './components/FloatingShopIcon';
import UserManagement from './pages/UserManagement';
import SystemAnalytics from './pages/SystemAnalytics';
import GlobalCalculator from './components/GlobalCalculator';
import './App.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import production monitoring
import { initializeMonitoring } from './utils/productionMonitoring';

function App() {
  const [calculatorOpen, setCalculatorOpen] = useState(false);

  useEffect(() => {
    // Remove console.log statements for production
    // Environment validation is handled by firebaseConfig.js

    // Initialize production monitoring in production environment
    // Safe check for environment variable
    const isProduction = import.meta.env?.REACT_APP_ENV === 'production' || 
                        (typeof process !== 'undefined' && process.env?.REACT_APP_ENV === 'production');
    
    if (isProduction) {
      initializeMonitoring();
    }
  }, []);

  // Listen for calculator open events from universal keyboard handler
  useEffect(() => {
    const handleOpenCalculator = () => {
      if (!calculatorOpen) {
        setCalculatorOpen(true);
      }
    };

    window.addEventListener('openCalculator', handleOpenCalculator);
    return () => window.removeEventListener('openCalculator', handleOpenCalculator);
  }, [calculatorOpen]);

  return (
    <div className="app-container">
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            style: {
              background: 'green',
            },
          },
          error: {
            style: {
              background: 'red',
            },
          },
        }}
      />
      <AuthProvider>
        <ThemeProvider>
          <Router>
            <UniversalKeyboardHandler />
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              
              {/* Protected routes - require authentication */}
              <Route path="/dashboard" element={
                <ProtectedRoute requireAuth={true}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              {/* Admin route - requires super admin role */}
              <Route path="/admin" element={
                <ProtectedRoute requiredRoles={['superadmin']}>
                  <AdminPanel />
                </ProtectedRoute>
              } />
              
              {/* Order routes - require order permission */}
              <Route path="/orders" element={
                <ProtectedRoute requiredPermission="/orders">
                  <Orders />
                </ProtectedRoute>
              } />
              <Route path="/orders/new" element={
                <ProtectedRoute requiredPermission="/orders">
                  <CreateOrder />
                </ProtectedRoute>
              } />
              <Route path="/orders/:orderId" element={
                <ProtectedRoute requiredPermission="/orders">
                  <OrderDetail />
                </ProtectedRoute>
              } />
              <Route path="/orders/edit/:orderId" element={
                <ProtectedRoute requiredPermission="/orders">
                  <EditOrder />
                </ProtectedRoute>
              } />
              <Route path="/daily-dispatch-log" element={
                <ProtectedRoute requiredPermission="/orders">
                  <DailyDispatchLog />
                </ProtectedRoute>
              } />
              
              {/* Customer routes - require customer permission */}
              <Route path="/customers" element={
                <ProtectedRoute requiredPermission="/customers">
                  <Customers />
                </ProtectedRoute>
              } />
              <Route path="/customers/new" element={
                <ProtectedRoute requiredPermission="/customers">
                  <CreateCustomer />
                </ProtectedRoute>
              } />
              <Route path="/add-vendor" element={
                <ProtectedRoute requiredPermission="/customers">
                  <CreateCustomer isVendor={true} />
                </ProtectedRoute>
              } />
              
              {/* Sales routes - require sales permission */}
              <Route path="/sales" element={
                <ProtectedRoute requiredPermission="/sales">
                  <Sales />
                </ProtectedRoute>
              } />
              <Route path="/sales/new" element={
                <ProtectedRoute requiredPermission="/sales">
                  <CreateSale />
                </ProtectedRoute>
              } />
              <Route path="/sales/:saleId" element={
                <ProtectedRoute requiredPermission="/sales">
                  <SaleDetail />
                </ProtectedRoute>
              } />
              <Route path="/sales/edit/:saleId" element={
                <ProtectedRoute requiredPermission="/sales">
                  <EditSale />
                </ProtectedRoute>
              } />
              <Route path="/sales-returns" element={
                <ProtectedRoute requiredPermission="/sales">
                  <SalesReturn />
                </ProtectedRoute>
              } />
              <Route path="/sales/return/:id" element={
                <ProtectedRoute requiredPermission="/sales">
                  <SalesReturn isCreate={true} />
                </ProtectedRoute>
              } />
              <Route path="/sales/return/new" element={
                <ProtectedRoute requiredPermission="/sales">
                  <SalesReturn isCreate={true} newReturn={true} />
                </ProtectedRoute>
              } />
              <Route path="/sales-returns/:id" element={
                <ProtectedRoute requiredPermission="/sales">
                  <SalesReturn isView={true} />
                </ProtectedRoute>
              } />
              
              {/* Purchase routes - require purchase permission */}
              <Route path="/purchases" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <Purchases />
                </ProtectedRoute>
              } />
              <Route path="/purchases/new" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <CreatePurchase />
                </ProtectedRoute>
              } />
              <Route path="/purchases/:purchaseId" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <PurchaseDetail />
                </ProtectedRoute>
              } />
              <Route path="/purchases/edit/:purchaseId" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <EditPurchase />
                </ProtectedRoute>
              } />
              <Route path="/purchase-returns" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <PurchaseReturn />
                </ProtectedRoute>
              } />
              <Route path="/purchases/return/:id" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <PurchaseReturn isCreate={true} />
                </ProtectedRoute>
              } />
              <Route path="/purchases/return/new" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <PurchaseReturn isCreate={true} newReturn={true} />
                </ProtectedRoute>
              } />
              <Route path="/purchase-returns/:id" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <PurchaseReturn isView={true} />
                </ProtectedRoute>
              } />
              
              {/* Financial routes - require transaction permission */}
              <Route path="/transactions" element={
                <ProtectedRoute requiredPermission="/transactions">
                  <Transactions />
                </ProtectedRoute>
              } />
              <Route path="/ledger" element={
                <ProtectedRoute requiredPermission="/ledger">
                  <Ledger />
                </ProtectedRoute>
              } />
              <Route path="/gst-returns" element={
                <ProtectedRoute requiredPermission="/gst-returns">
                  <GSTReturns />
                </ProtectedRoute>
              } />
              
              {/* Inventory routes - require lens inventory permission */}
              <Route path="/lens-inventory" element={
                <ProtectedRoute requiredPermission="/lens-inventory">
                  <LensInventory />
                </ProtectedRoute>
              } />
              <Route path="/lens-inventory/:id" element={
                <ProtectedRoute requiredPermission="/lens-inventory">
                  <LensDetail />
                </ProtectedRoute>
              } />
              <Route path="/lens-inventory-report" element={
                <ProtectedRoute requiredPermission="/lens-inventory">
                  <LensInventoryReport />
                </ProtectedRoute>
              } />
              <Route path="/reorder-dashboard" element={
                <ProtectedRoute requiredPermission="/lens-inventory">
                  <ReorderDashboard />
                </ProtectedRoute>
              } />
              
              {/* Settings route - require settings permission */}
              <Route path="/settings" element={
                <ProtectedRoute requiredPermission="/settings">
                  <Settings />
                </ProtectedRoute>
              } />
              
              {/* Test print - admin only */}
              <Route path="/test-print" element={
                <ProtectedRoute requiredRoles={['superadmin', 'admin']}>
                  <TestPrintPage />
                </ProtectedRoute>
              } />
              
              {/* User Management - super admin only */}
              <Route path="/user-management" element={
                <ProtectedRoute requiredRoles={['superadmin']}>
                  <UserManagement />
                </ProtectedRoute>
              } />
              
              {/* System Analytics - super admin only */}
              <Route path="/system-analytics" element={
                <ProtectedRoute requiredRoles={['superadmin']}>
                  <SystemAnalytics />
                </ProtectedRoute>
              } />
              
              {/* Shop route - require authentication */}
              <Route path="/shop" element={
                <ProtectedRoute requireAuth={true}>
                  <Shop />
                </ProtectedRoute>
              } />
              
              {/* Default routes */}
              <Route path="/" element={<Navigate to="/orders" replace />} />
              <Route path="*" element={<Navigate to="/orders" replace />} />
            </Routes>
            
            {/* Floating Shop Icon - appears only on specific pages */}
            <FloatingShopIcon />
          </Router>
          
          {/* Global Calculator - accessible from anywhere with 'T' key */}
          <GlobalCalculator 
            isOpen={calculatorOpen} 
            onClose={() => setCalculatorOpen(false)} 
          />
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}

// Universal Keyboard Handler Component
const UniversalKeyboardHandler = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Only trigger if not typing in an input field, textarea, select, or contentEditable
      const isTypingInInput = (
        e.target.tagName === 'INPUT' || 
        e.target.tagName === 'TEXTAREA' || 
        e.target.tagName === 'SELECT' ||
        e.target.contentEditable === 'true'
      );
      
      // Don't interfere with modals or if user is typing
      if (isTypingInInput) {
        return;
      }

      const key = e.key.toLowerCase();

      // ESC key - smart back navigation
      if (key === 'escape') {
        e.preventDefault();
        
        // Check for open modals, forms, or components that should be closed first
        const shouldCloseLocalComponent = handleLocalEscapeActions();
        
        // Only navigate back if no local components were closed
        if (!shouldCloseLocalComponent) {
          window.history.back();
        }
        return;
      }

      // Calculator shortcut
      if (key === 't') {
        e.preventDefault();
        // Trigger calculator open event
        window.dispatchEvent(new CustomEvent('openCalculator'));
        return;
      }

      // Navigation shortcuts - don't interfere with other functionality
      switch (key) {
        case 'x':
          e.preventDefault();
          navigate('/dashboard');
          break;
        case 'h':
          e.preventDefault();
          navigate('/orders');
          break;
        case 'u':
          e.preventDefault();
          navigate('/customers');
          break;
        case 'l':
          e.preventDefault();
          navigate('/sales');
          break;
        case 'e':
          e.preventDefault();
          navigate('/purchases');
          break;
        case 'n':
          e.preventDefault();
          navigate('/transactions');
          break;
        case 'g':
          e.preventDefault();
          navigate('/ledger');
          break;
        case 'q':
          e.preventDefault();
          navigate('/gst-returns');
          break;
        case 'v':
          e.preventDefault();
          navigate('/lens-inventory');
          break;
        case 'r':
          e.preventDefault();
          navigate('/reorder-dashboard');
          break;
        case 'z':
          e.preventDefault();
          navigate('/settings');
          break;
        default:
          // Don't prevent default for other keys
          break;
      }
    };

    // Function to handle local ESC actions (close modals, forms, etc.)
    const handleLocalEscapeActions = () => {
      // First, try to close any modals
      const modals = document.querySelectorAll('.fixed.inset-0, [role="dialog"], .modal');
      for (const modal of modals) {
        const style = window.getComputedStyle(modal);
        if (style.display !== 'none' && style.visibility !== 'hidden') {
          // Try to find and click a close button in the modal
          const closeBtn = modal.querySelector('button[aria-label*="close"], button[title*="close"], .close, [data-dismiss="modal"]');
          if (closeBtn) {
            closeBtn.click();
            return true;
          }
          // Dispatch close modal event
          window.dispatchEvent(new CustomEvent('closeModal'));
          return true;
        }
      }

      // Then, try to close any visible forms by looking for Cancel buttons
      const cancelButtons = Array.from(document.querySelectorAll('button')).filter(button => {
        const text = button.textContent.toLowerCase().trim();
        return (text === 'cancel' || text === 'close') && 
               button.offsetParent !== null && 
               !button.disabled;
      });

      if (cancelButtons.length > 0) {
        // Click the first visible cancel button
        cancelButtons[0].click();
        return true;
      }

      // Also dispatch the closeForm event for components that listen to it
      const hasFormInputs = document.querySelectorAll('form input, form select, form textarea').length > 0;
      if (hasFormInputs) {
        window.dispatchEvent(new CustomEvent('closeForm'));
        return true;
      }

      return false;
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [navigate, location]);

  return null; // This component doesn't render anything
};

export default App;

import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
import MarketplaceLayout from './pages/MarketplaceLayout';
import ItemDetail from './pages/ItemDetail';
import UserManagement from './pages/UserManagement';
import SystemAnalytics from './pages/SystemAnalytics';

import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import keyboardManager, { ShortcutUtils } from './utils/keyboardShortcuts';
import { ThemeProvider } from './contexts/ThemeContext';
import './App.css';

function App() {
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
      
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <UniversalShortcuts />
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              
              {/* Protected routes */}
              <Route path="/dashboard" element={
                <ProtectedRoute requireAuth={true}>
                  <Dashboard />
                </ProtectedRoute>
              } />
              
              <Route path="/admin" element={
                <ProtectedRoute requiredRoles={['superadmin']}>
                  <AdminPanel />
                </ProtectedRoute>
              } />
              
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
              
              <Route path="/sales" element={
                <ProtectedRoute requiredPermission="/sales">
                  <Sales />
                </ProtectedRoute>
              } />
              <Route path="/sales/new" element={<CreateSale />} />
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
              <Route path="/sales-returns/new" element={
                <ProtectedRoute requiredPermission="/sales">
                  <SalesReturn isCreate={true} newReturn={true} />
                </ProtectedRoute>
              } />
              <Route path="/sales-returns/:id" element={
                <ProtectedRoute requiredPermission="/sales">
                  <SalesReturn isView={true} />
                </ProtectedRoute>
              } />
              
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
              <Route path="/purchase-returns/new" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <PurchaseReturn isCreate={true} newReturn={true} />
                </ProtectedRoute>
              } />
              <Route path="/purchase-returns/:id" element={
                <ProtectedRoute requiredPermission="/purchases">
                  <PurchaseReturn isView={true} />
                </ProtectedRoute>
              } />
              
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
              
              {/* Lens inventory routes - treated exactly like other detail pages */}
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
              
              <Route path="/item/:id" element={
                <ProtectedRoute requiredPermission="/sales">
                  <ItemDetail />
                </ProtectedRoute>
              } />
              
              <Route path="/settings" element={
                <ProtectedRoute requiredPermission="/settings">
                  <Settings />
                </ProtectedRoute>
              } />
              
              <Route path="/test-print" element={
                <ProtectedRoute requiredRoles={['superadmin', 'admin']}>
                  <TestPrintPage />
                </ProtectedRoute>
              } />
              
              <Route path="/user-management" element={
                <ProtectedRoute requiredRoles={['superadmin']}>
                  <UserManagement />
                </ProtectedRoute>
              } />
              
              <Route path="/system-analytics" element={
                <ProtectedRoute requiredRoles={['superadmin']}>
                  <SystemAnalytics />
                </ProtectedRoute>
              } />
              
              {/* Marketplace routes */}
              <Route path="/marketplace" element={<MarketplaceLayout />} />
              <Route path="/create-flash-sale" element={<MarketplaceLayout activeTab="create-flash-sale" />} />
              <Route path="/add-optical-product" element={<MarketplaceLayout activeTab="add-optical-product" />} />
              <Route path="/shop" element={<Shop />} />
              
              {/* Default routes */}
              <Route path="/" element={<Navigate to="/orders" replace />} />
              <Route path="*" element={<Navigate to="/orders" replace />} />
            </Routes>
          </Router>
        </AuthProvider>
      </ThemeProvider>
    </div>
  );
}

// Component to handle universal keyboard shortcuts
const UniversalShortcuts = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Register global navigation shortcuts
    const globalShortcuts = [
      ['l', () => navigate('/sales'), 'Go to sales'],
      ['h', () => navigate('/orders'), 'Go to orders'],
      ['u', () => navigate('/customers'), 'Go to customers'],
      ['e', () => navigate('/purchases'), 'Go to purchases'],
      ['n', () => navigate('/transactions'), 'Go to transactions'],
      ['g', () => navigate('/ledger'), 'Go to ledger'],
      ['q', () => navigate('/gst-returns'), 'Go to GST returns'],
      ['v', () => navigate('/lens-inventory'), 'Go to lens inventory'],
      ['r', () => navigate('/reorder-dashboard'), 'Go to reorder dashboard'],
      ['z', () => navigate('/settings'), 'Go to settings'],
      ['x', () => navigate('/dashboard'), 'Go to dashboard'],
      ['escape', () => {
        // Don't navigate back on marketplace pages
        const marketplacePaths = ['/marketplace', '/create-flash-sale', '/add-optical-product', '/shop'];
        if (!marketplacePaths.includes(location.pathname)) {
          window.history.back();
        }
      }, 'Navigate back']
    ];

    const shortcutIds = ShortcutUtils.registerGlobalShortcuts(globalShortcuts);

    return () => {
      shortcutIds.forEach(id => keyboardManager.unregister(id));
    };
  }, [navigate, location.pathname]);

  return null; // This component doesn't render anything
};

export default App;

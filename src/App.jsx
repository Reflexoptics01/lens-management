import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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
import SalesReturn from "./pages/SalesReturn";
import PurchaseReturn from "./pages/PurchaseReturn";
import Shop from './pages/Shop';
import './App.css';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Import debug utility for development
import './utils/debugFirestore';

function App() {
  useEffect(() => {
    console.log('App component mounted');
    console.log('Environment variables loaded:', {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY ? 'Present' : 'Missing',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ? 'Present' : 'Missing',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ? 'Present' : 'Missing'
    });
  }, []);

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
          </Router>
        </ThemeProvider>
      </AuthProvider>
    </div>
  );
}

export default App;

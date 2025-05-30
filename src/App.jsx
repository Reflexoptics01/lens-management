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
import './App.css';
import { ThemeProvider } from './contexts/ThemeContext';

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
      <ThemeProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/admin" element={<AdminPanel />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/new" element={<CreateOrder />} />
            <Route path="/orders/:orderId" element={<OrderDetail />} />
            <Route path="/orders/edit/:orderId" element={<EditOrder />} />
            <Route path="/daily-dispatch-log" element={<DailyDispatchLog />} />
            <Route path="/customers" element={<Customers />} />
            <Route path="/customers/new" element={<CreateCustomer />} />
            <Route path="/add-vendor" element={<CreateCustomer isVendor={true} />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/sales/new" element={<CreateSale />} />
            <Route path="/sales/:saleId" element={<SaleDetail />} />
            <Route path="/sales/edit/:saleId" element={<EditSale />} />
            <Route path="/purchases" element={<Purchases />} />
            <Route path="/purchases/new" element={<CreatePurchase />} />
            <Route path="/purchases/:purchaseId" element={<PurchaseDetail />} />
            <Route path="/purchases/edit/:purchaseId" element={<EditPurchase />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/ledger" element={<Ledger />} />
            <Route path="/gst-returns" element={<GSTReturns />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/test-print" element={<TestPrintPage />} />
            <Route path="/lens-inventory" element={<LensInventory />} />
            <Route path="/lens-inventory/:id" element={<LensDetail />} />
            <Route path="/lens-inventory-report" element={<LensInventoryReport />} />
            <Route path="/sales-returns" element={<SalesReturn />} />
            <Route path="/purchase-returns" element={<PurchaseReturn />} />
            <Route path="/sales/return/:id" element={<SalesReturn isCreate={true} />} />
            <Route path="/purchases/return/:id" element={<PurchaseReturn isCreate={true} />} />
            <Route path="/sales/return/new" element={<SalesReturn isCreate={true} newReturn={true} />} />
            <Route path="/purchases/return/new" element={<PurchaseReturn isCreate={true} newReturn={true} />} />
            <Route path="/sales-returns/:id" element={<SalesReturn isView={true} />} />
            <Route path="/purchase-returns/:id" element={<PurchaseReturn isView={true} />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </ThemeProvider>
    </div>
  );
}

export default App;

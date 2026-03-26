import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { Toaster } from './components/ui/sonner';
import PWAInstallPrompt from './components/PWAInstallPrompt';
import './App.css';

// Customer Pages
import CustomerLogin from './pages/customer/Login';
import CustomerHome from './pages/customer/Home';
import Cart from './pages/customer/Cart';
import Orders from './pages/customer/Orders';
import OrderDetail from './pages/customer/OrderDetail';

// Staff Pages
import StaffLogin from './pages/staff/Login';
import PharmacistDashboard from './pages/pharmacist/Dashboard';
import PharmacyDashboard from './pages/pharmacy/Dashboard';
import OpsDashboard from './pages/ops/Dashboard';

// Delivery Partner Pages
import DeliveryLogin from './pages/delivery/Login';
import DeliveryDashboard from './pages/delivery/Dashboard';

// Protected Route Components
const CustomerRoute = ({ children }) => {
  const { isAuthenticated, isCustomer, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  if (!isCustomer) {
    return <Navigate to="/staff/login" replace />;
  }
  
  return children;
};

const PharmacistRoute = ({ children }) => {
  const { isAuthenticated, isPharmacist, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isPharmacist) {
    return <Navigate to="/staff/login" replace />;
  }
  
  return children;
};

const PharmacyStaffRoute = ({ children }) => {
  const { isAuthenticated, isPharmacyStaff, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isPharmacyStaff) {
    return <Navigate to="/staff/login" replace />;
  }
  
  return children;
};

const OpsRoute = ({ children }) => {
  const { isAuthenticated, isOps, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isOps) {
    return <Navigate to="/staff/login" replace />;
  }
  
  return children;
};

const DeliveryRoute = ({ children }) => {
  const { isAuthenticated, isDeliveryPartner, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (!isAuthenticated || !isDeliveryPartner) {
    return <Navigate to="/delivery/login" replace />;
  }
  
  return children;
};

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }
  
  if (isAuthenticated) {
    // Redirect based on role
    switch (user?.role) {
      case 'customer':
        return <Navigate to="/" replace />;
      case 'pharmacist':
        return <Navigate to="/pharmacist/dashboard" replace />;
      case 'pharmacy_staff':
        return <Navigate to="/pharmacy/dashboard" replace />;
      case 'ops':
        return <Navigate to="/ops/dashboard" replace />;
      case 'delivery_partner':
        return <Navigate to="/delivery/dashboard" replace />;
      default:
        return children;
    }
  }
  
  return children;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route 
        path="/login" 
        element={
          <PublicRoute>
            <CustomerLogin />
          </PublicRoute>
        } 
      />
      <Route 
        path="/staff/login" 
        element={
          <PublicRoute>
            <StaffLogin />
          </PublicRoute>
        } 
      />
      <Route 
        path="/delivery/login" 
        element={
          <PublicRoute>
            <DeliveryLogin />
          </PublicRoute>
        } 
      />

      {/* Customer Routes (Mobile) */}
      <Route 
        path="/" 
        element={
          <CustomerRoute>
            <CustomerHome />
          </CustomerRoute>
        } 
      />
      <Route 
        path="/cart" 
        element={
          <CustomerRoute>
            <Cart />
          </CustomerRoute>
        } 
      />
      <Route 
        path="/orders" 
        element={
          <CustomerRoute>
            <Orders />
          </CustomerRoute>
        } 
      />
      <Route 
        path="/order/:orderId" 
        element={
          <CustomerRoute>
            <OrderDetail />
          </CustomerRoute>
        } 
      />

      {/* Pharmacist Routes (Desktop) */}
      <Route 
        path="/pharmacist/dashboard" 
        element={
          <PharmacistRoute>
            <PharmacistDashboard />
          </PharmacistRoute>
        } 
      />

      {/* Pharmacy Staff Routes (Desktop) */}
      <Route 
        path="/pharmacy/dashboard" 
        element={
          <PharmacyStaffRoute>
            <PharmacyDashboard />
          </PharmacyStaffRoute>
        } 
      />

      {/* Ops Routes (Desktop) */}
      <Route 
        path="/ops/dashboard" 
        element={
          <OpsRoute>
            <OpsDashboard />
          </OpsRoute>
        } 
      />

      {/* Delivery Partner Routes (Mobile) */}
      <Route 
        path="/delivery/dashboard" 
        element={
          <DeliveryRoute>
            <DeliveryDashboard />
          </DeliveryRoute>
        } 
      />

      {/* Catch all - redirect to login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <div className="App">
            <AppRoutes />
            <Toaster position="top-center" richColors />
            <PWAInstallPrompt />
          </div>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * ProtectedRoute component that uses the centralized AuthContext
 * This replaces scattered auth logic throughout the application
 */
const ProtectedRoute = ({ 
  children, 
  requiredPermission = null, 
  requiredRoles = [], 
  requireAuth = false,  // New prop for auth-only access
  fallbackPath = '/login',
  showLoading = true 
}) => {
  const { 
    isAuthenticated, 
    isLoading, 
    canAccess, 
    authState, 
    authError,
    AUTH_STATES 
  } = useAuth();
  
  const location = useLocation();

  // Show loading state while checking authentication
  if (isLoading() && showLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-gray-50 to-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-800">Checking authentication...</div>
        </div>
      </div>
    );
  }

  // Handle different auth states
  switch (authState) {
    case AUTH_STATES.UNAUTHENTICATED:
      return <Navigate to={fallbackPath} state={{ from: location }} replace />;
      
    case AUTH_STATES.PENDING_APPROVAL:
      return (
        <div className="min-h-screen bg-gradient-to-r from-yellow-50 to-orange-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center p-6 bg-white rounded-lg shadow-lg">
            <div className="text-yellow-600 text-6xl mb-4">⏳</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Approval Pending</h2>
            <p className="text-gray-600 mb-4">{authError}</p>
            <button 
              onClick={() => window.location.href = '/login'}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
      
    case AUTH_STATES.REJECTED:
      return (
        <div className="min-h-screen bg-gradient-to-r from-red-50 to-pink-50 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center p-6 bg-white rounded-lg shadow-lg">
            <div className="text-red-600 text-6xl mb-4">❌</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">{authError}</p>
            <button 
              onClick={() => window.location.href = '/login'}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
      
    case AUTH_STATES.INACTIVE:
      return (
        <div className="min-h-screen bg-gradient-to-r from-gray-50 to-gray-100 flex items-center justify-center">
          <div className="max-w-md mx-auto text-center p-6 bg-white rounded-lg shadow-lg">
            <div className="text-gray-600 text-6xl mb-4">🚫</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Account Inactive</h2>
            <p className="text-gray-600 mb-4">{authError}</p>
            <button 
              onClick={() => window.location.href = '/login'}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Back to Login
            </button>
          </div>
        </div>
      );
      
    case AUTH_STATES.AUTHENTICATED:
      // If requireAuth is true, only check authentication (for routes like dashboard)
      if (requireAuth && !requiredPermission && requiredRoles.length === 0) {
        return children;
      }
      
      // Check specific permissions if required
      if (!canAccess(requiredPermission, requiredRoles)) {
        return (
          <div className="min-h-screen bg-gradient-to-r from-orange-50 to-red-50 flex items-center justify-center">
            <div className="max-w-md mx-auto text-center p-6 bg-white rounded-lg shadow-lg">
              <div className="text-orange-600 text-6xl mb-4">🔒</div>
              <h2 className="text-2xl font-bold text-gray-800 mb-2">Insufficient Permissions</h2>
              <p className="text-gray-600 mb-4">
                You don't have permission to access this page.
                {requiredPermission && <><br/>Required permission: <code className="bg-gray-100 px-2 py-1 rounded">{requiredPermission}</code></>}
                {requiredRoles.length > 0 && <><br/>Required roles: <code className="bg-gray-100 px-2 py-1 rounded">{requiredRoles.join(', ')}</code></>}
              </p>
              <button 
                onClick={() => window.history.back()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 mr-2"
              >
                Go Back
              </button>
              <button 
                onClick={() => window.location.href = '/dashboard'}
                className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
              >
                Dashboard
              </button>
            </div>
          </div>
        );
      }
      
      // User is authenticated and has required permissions
      return children;
      
    default:
      // Unknown auth state
      return (
        <div className="min-h-screen bg-gradient-to-r from-gray-50 to-white flex items-center justify-center">
          <div className="max-w-md mx-auto text-center p-6 bg-white rounded-lg shadow-lg">
            <div className="text-gray-600 text-6xl mb-4">❓</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Error</h2>
            <p className="text-gray-600 mb-4">
              Unknown authentication state. Please try refreshing the page.
            </p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
  }
};

export default ProtectedRoute; 
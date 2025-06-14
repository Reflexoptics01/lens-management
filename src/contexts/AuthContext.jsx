import React, { createContext, useContext, useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { onAuthStateChanged, signOut, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { getUserUid, isSuperAdmin } from '../utils/multiTenancy';
import { dateToISOString } from '../utils/dateUtils';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auth states
const AUTH_STATES = {
  LOADING: 'loading',
  AUTHENTICATED: 'authenticated', 
  UNAUTHENTICATED: 'unauthenticated',
  PENDING_APPROVAL: 'pending_approval',
  REJECTED: 'rejected',
  INACTIVE: 'inactive'
};

// User roles
const USER_ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin', 
  USER: 'user',
  GUEST: 'guest'
};

export const AuthProvider = ({ children }) => {
  // Core auth state
  const [authState, setAuthState] = useState(AUTH_STATES.LOADING);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(USER_ROLES.GUEST);
  const [userPermissions, setUserPermissions] = useState({});
  const [userProfile, setUserProfile] = useState(null);
  
  // Loading states
  const [initializing, setInitializing] = useState(true);
  const [checkingPermissions, setCheckingPermissions] = useState(false);
  
  // Error handling
  const [authError, setAuthError] = useState(null);

  // Set Firebase Auth persistence on component mount
  useEffect(() => {
    const setupAuthPersistence = async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
        console.log('🔐 Firebase Auth persistence set to LOCAL');
      } catch (error) {
        console.error('🔐 Error setting auth persistence:', error);
      }
    };
    
    setupAuthPersistence();
  }, []);

  // Initialize auth listener
  useEffect(() => {
    console.log('🔐 AuthContext: Initializing auth listener...');
    
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        setAuthError(null);
        console.log('🔐 Auth state changed:', firebaseUser ? firebaseUser.email : 'No user');
        
        if (!firebaseUser) {
          // User signed out
          handleSignOut();
          return;
        }

        // User signed in - validate and setup
        await validateAndSetupUser(firebaseUser);
        
      } catch (error) {
        console.error('🔐 Auth listener error:', error);
        setAuthError(error.message);
        setAuthState(AUTH_STATES.UNAUTHENTICATED);
      } finally {
        setInitializing(false);
      }
    });

    return () => {
      console.log('🔐 AuthContext: Cleaning up auth listener');
      unsubscribe();
    };
  }, []);

  // Backward compatibility: Expose current user for components still using auth.currentUser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // Make current user available globally for backward compatibility
      window.__authUser = user;
    }
  }, [user]);

  // Handle user sign out
  const handleSignOut = () => {
    setAuthState(AUTH_STATES.UNAUTHENTICATED);
    setUser(null);
    setUserRole(USER_ROLES.GUEST);
    setUserPermissions({});
    setUserProfile(null);
    
    // Clear localStorage
    localStorage.removeItem('userUid');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userPermissions');
    localStorage.removeItem('organizationId'); // Clear organization ID for team members
  };

  // Validate and setup authenticated user
  const validateAndSetupUser = async (firebaseUser) => {
    console.log('🔐 Validating user:', firebaseUser.email);
    setCheckingPermissions(true);
    
    try {
      // Check if super admin first
      if (isSuperAdmin(firebaseUser.email)) {
        console.log('🔐 Super admin detected');
        await setupSuperAdmin(firebaseUser);
        return;
      }

      // Check if user exists in approved users collection
      const userData = await checkApprovedUser(firebaseUser);
      
      if (userData) {
        console.log('🔐 Approved user found:', userData);
        await setupApprovedUser(firebaseUser, userData);
        return;
      }

      // Check if user is a team member in any organization
      const teamMemberData = await checkTeamMemberStatus(firebaseUser);
      
      if (teamMemberData) {
        console.log('🔐 Team member found:', teamMemberData);
        await setupTeamMember(firebaseUser, teamMemberData);
        return;
      }

      // Check registration status
      const registrationData = await checkUserRegistration(firebaseUser);
      
      if (registrationData) {
        await handleRegistrationStatus(firebaseUser, registrationData);
        return;
      }

      // User not found anywhere - unauthorized
      console.log('🔐 Unauthorized user - not found in any collection');
      setAuthState(AUTH_STATES.UNAUTHENTICATED);
      setAuthError('Unauthorized access. Please register for an account or contact an administrator.');
      await signOut(auth);
      
    } catch (error) {
      console.error('🔐 Error validating user:', error);
      
      // Handle specific network and authentication errors
      if (error.code === 'auth/network-request-failed') {
        setAuthError('Network error. Please check your internet connection and try again.');
        console.log('🔐 Network error detected - not signing out user');
        // Don't sign out on network errors, just show error
        setAuthState(AUTH_STATES.UNAUTHENTICATED);
      } else if (error.code === 'auth/internal-error') {
        setAuthError('Authentication service temporarily unavailable. Please try again.');
        console.log('🔐 Internal auth error - not signing out user');
        setAuthState(AUTH_STATES.UNAUTHENTICATED);
      } else if (error.message?.includes('Missing or insufficient permissions')) {
        setAuthError('Database access error. Please contact an administrator.');
        console.log('🔐 Firestore permissions error - not signing out user');
        setAuthState(AUTH_STATES.UNAUTHENTICATED);
      } else {
        setAuthError('Authentication error. Please try again.');
        setAuthState(AUTH_STATES.UNAUTHENTICATED);
        await signOut(auth);
      }
    } finally {
      setCheckingPermissions(false);
    }
  };

  // Setup super admin user
  const setupSuperAdmin = async (firebaseUser) => {
    setUser(firebaseUser);
    setUserRole(USER_ROLES.SUPER_ADMIN);
    setUserPermissions({});
    setUserProfile({
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || 'Super Admin',
      role: USER_ROLES.SUPER_ADMIN,
      isSuperAdmin: true
    });
    setAuthState(AUTH_STATES.AUTHENTICATED);
    
    // Store in localStorage
    localStorage.setItem('userUid', firebaseUser.uid);
    localStorage.setItem('userEmail', firebaseUser.email);
    localStorage.setItem('userRole', USER_ROLES.SUPER_ADMIN);
    localStorage.setItem('userPermissions', JSON.stringify({}));
  };

  // Check if user exists in approved users collection
  const checkApprovedUser = async (firebaseUser) => {
    try {
      // Use direct document access instead of query since document ID = UID
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // Security check - ensure email matches
        if (userData.email !== firebaseUser.email) {
          throw new Error('Account verification failed - email mismatch');
        }
        
        return userData;
      }
      
      return null;
    } catch (error) {
      console.error('🔐 Error checking approved user:', error);
      throw error;
    }
  };

  // Setup approved user
  const setupApprovedUser = async (firebaseUser, userData) => {
    // Check if user is active
    if (userData.isActive === false) {
      setAuthState(AUTH_STATES.INACTIVE);
      setAuthError('Your account has been deactivated. Please contact an administrator.');
      await signOut(auth);
      return;
    }
    
    // Check approval status
    if (userData.status === 'pending') {
      setAuthState(AUTH_STATES.PENDING_APPROVAL);
      setAuthError('Your account is pending approval. Please wait for admin verification.');
      await signOut(auth);
      return;
    }
    
    setUser(firebaseUser);
    setUserRole(userData.role || USER_ROLES.USER);
    setUserPermissions(userData.permissions || {});
    setUserProfile({
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || userData.companyName || userData.email,
      role: userData.role || USER_ROLES.USER,
      companyName: userData.companyName,
      ...userData
    });
    setAuthState(AUTH_STATES.AUTHENTICATED);
    
    // Store in localStorage
    localStorage.setItem('userUid', firebaseUser.uid);
    localStorage.setItem('userEmail', firebaseUser.email);
    localStorage.setItem('userRole', userData.role || USER_ROLES.USER);
    localStorage.setItem('userPermissions', JSON.stringify(userData.permissions || {}));
  };

  // Check if user is a team member in any organization using Cloud Function
  const checkTeamMemberStatus = async (firebaseUser) => {
    try {
      // Import functions dynamically to avoid issues with SSR
      const { httpsCallable } = await import('firebase/functions');
      const { functions } = await import('../firebaseConfig');
      
      const findTeamMemberFunction = httpsCallable(functions, 'findTeamMember');
      const result = await findTeamMemberFunction({
        uid: firebaseUser.uid,
        email: firebaseUser.email
      });
      
      if (result.data && result.data.found) {
        return result.data.teamMemberData;
      }
      
      return null;
    } catch (error) {
      console.error('Team member authentication error:', error.code);
      
      // Handle different error types
      if (error.code === 'functions/not-found') {
        throw new Error('Team member authentication service unavailable. Please contact your administrator.');
      }
      
      if (error.code === 'functions/unavailable' || error.code === 'functions/deadline-exceeded') {
        throw new Error('Authentication service is temporarily unavailable. Please try again in a moment.');
      }
      
      if (error.code === 'functions/permission-denied') {
        return null; // User is not a team member
      }
      
      throw error;
    }
  };

  // Setup team member user
  const setupTeamMember = async (firebaseUser, teamMemberData) => {
    console.log('🔐 Setting up team member:', teamMemberData);
    
    // Check if team member is active
    if (teamMemberData.isActive === false) {
      setAuthState(AUTH_STATES.INACTIVE);
      setAuthError('Your team member account has been deactivated. Please contact your administrator.');
      await signOut(auth);
      return;
    }
    
    setUser(firebaseUser);
    setUserRole(teamMemberData.role || USER_ROLES.USER);
    setUserPermissions(teamMemberData.permissions || {});
    setUserProfile({
      email: firebaseUser.email,
      displayName: firebaseUser.displayName || teamMemberData.email,
      role: teamMemberData.role || USER_ROLES.USER,
      isTeamMember: true,
      organizationId: teamMemberData.organizationId,
      organizationOwner: teamMemberData.organizationOwner,
      ...teamMemberData
    });
    setAuthState(AUTH_STATES.AUTHENTICATED);
    
    // Store in localStorage with organization context
    localStorage.setItem('userUid', firebaseUser.uid);
    localStorage.setItem('userEmail', firebaseUser.email);
    localStorage.setItem('userRole', teamMemberData.role || USER_ROLES.USER);
    localStorage.setItem('userPermissions', JSON.stringify(teamMemberData.permissions || {}));
    localStorage.setItem('organizationId', teamMemberData.organizationId);
    
    console.log('🔐 Team member setup complete for organization:', teamMemberData.organizationId);
  };

  // Check user registration status
  const checkUserRegistration = async (firebaseUser) => {
    try {
      const registrationsRef = collection(db, 'userRegistrations');
      const registrationQuery = query(registrationsRef, where('uid', '==', firebaseUser.uid));
      const registrationSnapshot = await getDocs(registrationQuery);
      
      if (!registrationSnapshot.empty) {
        const registrationData = registrationSnapshot.docs[0].data();
        
        // Security check - ensure email matches
        if (registrationData.email !== firebaseUser.email) {
          throw new Error('Account verification failed - email mismatch');
        }
        
        return registrationData;
      }
      
      return null;
    } catch (error) {
      console.error('🔐 Error checking user registration:', error);
      throw error;
    }
  };

  // Handle registration status
  const handleRegistrationStatus = async (firebaseUser, registrationData) => {
    console.log('🔐 Handling registration status:', registrationData.status);
    
    switch (registrationData.status) {
      case 'pending':
        setAuthState(AUTH_STATES.PENDING_APPROVAL);
        setAuthError('Your account is pending approval. Please wait for admin verification.');
        await signOut(auth);
        break;
        
      case 'rejected':
        setAuthState(AUTH_STATES.REJECTED);
        setAuthError('Your account registration was rejected. Please contact an administrator.');
        await signOut(auth);
        break;
        
      case 'approved':
        // User has approved registration but no user document - complete the setup
        console.log('🔐 User has approved registration but no user document - completing setup...');
        try {
          await completeApprovedUserSetup(firebaseUser, registrationData);
        } catch (error) {
          console.error('🔐 Error completing approved user setup:', error);
          setAuthState(AUTH_STATES.UNAUTHENTICATED);
          setAuthError('Error setting up your account. Please contact an administrator.');
          await signOut(auth);
        }
        break;
        
      default:
        setAuthState(AUTH_STATES.UNAUTHENTICATED);
        setAuthError('Your account is not properly configured. Please contact an administrator.');
        await signOut(auth);
        break;
    }
  };

  // Complete setup for approved user who doesn't have a user document yet
  const completeApprovedUserSetup = async (firebaseUser, registrationData) => {
    console.log('🔐 Completing approved user setup...');
    
    // Create the user document that should have been created during approval
    const defaultPermissions = {
      '/dashboard': true,
      '/orders': true,
      '/customers': true,
      '/sales': true,
      '/purchases': true,
      '/transactions': true,
      '/ledger': true,
      '/gst-returns': true,
      '/lens-inventory': true,
      '/settings': true
    };

    const userData = {
      uid: firebaseUser.uid,
      email: firebaseUser.email,
      role: 'admin',
      permissions: defaultPermissions,
      isActive: true,
      status: 'approved',
      approvedAt: registrationData.approvedAt,
      approvedBy: registrationData.approvedBy,
      // Use current timestamp for creation since this is a recovery operation
      createdAt: new Date()
    };

    // Create the user document
    await setDoc(doc(db, 'users', firebaseUser.uid), userData);
    
    console.log('🔐 User document created during recovery setup');
    
    // Now set up the user normally
    await setupApprovedUser(firebaseUser, userData);
  };

  // Permission checking utilities
  const hasPermission = (permission) => {
    if (userRole === USER_ROLES.SUPER_ADMIN) return true;
    if (userRole === USER_ROLES.ADMIN) return true;
    return userPermissions[permission] === true;
  };

  const hasRole = (role) => {
    return userRole === role;
  };

  const hasAnyRole = (roles) => {
    return roles.includes(userRole);
  };

  const isAuthenticated = () => {
    return authState === AUTH_STATES.AUTHENTICATED;
  };

  const isLoading = () => {
    return initializing || checkingPermissions;
  };

  const canAccess = (requiredPermission, requiredRoles = []) => {
    if (!isAuthenticated()) return false;
    
    // Super admin can access everything
    if (userRole === USER_ROLES.SUPER_ADMIN) return true;
    
    // Check role-based access
    if (requiredRoles.length > 0 && hasAnyRole(requiredRoles)) return true;
    
    // Check permission-based access
    if (requiredPermission && hasPermission(requiredPermission)) return true;
    
    return false;
  };

  // Sign out function
  const logout = async () => {
    try {
      console.log('🔐 User requested logout...');
      await signOut(auth);
      // handleSignOut will be called by onAuthStateChanged
    } catch (error) {
      console.error('🔐 Error during logout:', error);
      // Force cleanup even if signOut fails
      handleSignOut();
    }
  };

  // Get auth info for debugging
  const getAuthInfo = () => {
    return {
      authState,
      userRole,
      userPermissions,
      userEmail: user?.email,
      userUid: user?.uid,
      isAuthenticated: isAuthenticated(),
      isLoading: isLoading(),
      timestamp: dateToISOString(new Date())
    };
  };

  // Context value
  const value = {
    // Core state
    authState,
    user,
    userRole,
    userPermissions,
    userProfile,
    authError,
    
    // Loading states
    initializing,
    checkingPermissions,
    isLoading,
    
    // Permission checking
    hasPermission,
    hasRole,
    hasAnyRole,
    canAccess,
    isAuthenticated,
    
    // Actions
    logout,
    
    // Utilities
    getAuthInfo,
    
    // Constants
    AUTH_STATES,
    USER_ROLES
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 
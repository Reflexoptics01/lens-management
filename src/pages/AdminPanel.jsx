import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebaseConfig';
import { collection, query, where, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, setDoc, getDoc } from 'firebase/firestore';
import { deleteUser } from 'firebase/auth';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import { 
  CheckCircleIcon, 
  XCircleIcon, 
  UserGroupIcon,
  ClockIcon,
  BuildingOfficeIcon,
  PhoneIcon,
  EnvelopeIcon,
  MapPinIcon,
  BanknotesIcon,
  ShieldCheckIcon,
  TrashIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '../contexts/AuthContext';

const AdminPanel = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all'); // 'all', 'pending', 'approved', 'rejected'

  // Use centralized auth
  const { 
    user, 
    userRole, 
    isAuthenticated, 
    isLoading: authLoading, 
    USER_ROLES 
  } = useAuth();

  // Check authentication and authorization
  useEffect(() => {
    // If we have valid authentication data, proceed regardless of authLoading state
    const hasValidAuth = user?.email && userRole && isAuthenticated();
    
    if (!hasValidAuth && !authLoading) {
      // Only redirect if auth is complete and we don't have valid auth
      toast.error('Please login to access admin panel');
      navigate('/login');
      return;
    }
    
    if (hasValidAuth && userRole !== USER_ROLES.SUPER_ADMIN) {
      toast.error('Unauthorized access - Admin privileges required');
      navigate('/dashboard');
      return;
    }
    
    // If we have valid super admin auth, load the panel
    if (hasValidAuth && userRole === USER_ROLES.SUPER_ADMIN) {
      if (loading) {
        fetchUsers();
        setLoading(false);
      }
    }
  }, [user?.email, userRole, authLoading, loading, navigate, USER_ROLES.SUPER_ADMIN]);

  const fetchUsers = async () => {
    setRefreshing(true);
    try {
      // Fetch all user registrations regardless of status
      const registrationsRef = collection(db, 'userRegistrations');
      const allRegistrationsSnapshot = await getDocs(registrationsRef);
      
      const allUsersData = allRegistrationsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'registration'
      }));

      // Also fetch from users collection to see if there are any discrepancies
      const usersRef = collection(db, 'users');
      const allUsersSnapshot = await getDocs(usersRef);
      
      const approvedUsersData = allUsersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        source: 'users',
        status: doc.data().status || 'approved' // Default to approved if no status
      }));

      // Combine and deduplicate by UID, prioritizing registration data
      const combinedUsers = [...allUsersData];
      
      // Merge mobile app permissions from users collection
      combinedUsers.forEach(regUser => {
        try {
          // Find ALL user documents with the same UID (handle potential duplicates)
          const allUserData = approvedUsersData.filter(u => u.uid === regUser.uid);
          
          if (allUserData.length > 0) {
            // If there are multiple documents, prefer the one with mobile app permissions
            const userData = allUserData.find(u => u.hasOwnProperty('mobileAppAccess')) || allUserData[0];
            
            // Merge mobile app permission fields with proper null checks
            regUser.mobileAppAccess = userData.mobileAppAccess !== undefined ? userData.mobileAppAccess : false;
            regUser.mobileAppApprovedAt = userData.mobileAppApprovedAt || null;
            regUser.mobileAppApprovedBy = userData.mobileAppApprovedBy || null;
            regUser.mobileAppRevokedAt = userData.mobileAppRevokedAt || null;
            regUser.mobileAppRevokedBy = userData.mobileAppRevokedBy || null;
          } else {
            // Set default values if no user data found
            regUser.mobileAppAccess = false;
            regUser.mobileAppApprovedAt = null;
            regUser.mobileAppApprovedBy = null;
            regUser.mobileAppRevokedAt = null;
            regUser.mobileAppRevokedBy = null;
          }
        } catch (error) {
          console.error('Error merging mobile permissions for user:', regUser.email, error);
          // Set safe defaults
          regUser.mobileAppAccess = false;
          regUser.mobileAppApprovedAt = null;
          regUser.mobileAppApprovedBy = null;
          regUser.mobileAppRevokedAt = null;
          regUser.mobileAppRevokedBy = null;
        }
      });
      
      // Add users from users collection that aren't in registrations (orphaned users)
      approvedUsersData.forEach(approvedUser => {
        // Skip the main admin user - don't show them in the user list
        if (approvedUser.email === 'reflexopticsolutions@gmail.com') {
          return;
        }
        
        const existsInRegistrations = allUsersData.find(regUser => regUser.uid === approvedUser.uid);
        if (!existsInRegistrations) {
          const orphanedUser = {
            ...approvedUser,
            // Mark as orphaned and add warning
            companyDetails: approvedUser.companyDetails || { 
              companyName: 'Unknown Company (ORPHANED - Registration Deleted)' 
            },
            status: 'orphaned', // Special status for orphaned users
            isOrphaned: true,
            source: 'users' // Keep track that this came from users collection only
          };
          
          combinedUsers.push(orphanedUser);
        }
      });

      // Sort by creation date (newest first)
      combinedUsers.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });

      setAllUsers(combinedUsers);

    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Failed to fetch users: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleApproveUser = async (registration) => {
    try {
      setRefreshing(true);
      
      // Update registration status
      await updateDoc(doc(db, 'userRegistrations', registration.id), {
        status: 'approved',
        approvedAt: serverTimestamp(),
        approvedBy: user.email
      });

      // Check if user document already exists
      const userDocRef = doc(db, 'users', registration.uid);
      const existingUserDoc = await getDoc(userDocRef);

      if (!existingUserDoc.exists()) {
        // Create new user document with default permissions
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

        await setDoc(doc(db, 'users', registration.uid), {
          uid: registration.uid,
          email: registration.email,
          role: 'admin',
          permissions: defaultPermissions,
          isActive: true,
          status: 'approved',
          createdAt: serverTimestamp(),
          approvedAt: serverTimestamp(),
          approvedBy: user.email,
          // Mobile app permission fields
          mobileAppAccess: false,
          mobileAppApprovedAt: null,
          mobileAppApprovedBy: null,
          mobileAppRevokedAt: null,
          mobileAppRevokedBy: null
        });

        // Create company settings for the user
        await setDoc(doc(db, `users/${registration.uid}/settings/shopSettings`), {
          // Shop information from registration
          shopName: registration.companyDetails?.companyName || '',
          address: registration.companyDetails?.address || '',
          city: registration.companyDetails?.city || '',
          state: registration.companyDetails?.state || '',
          pincode: registration.companyDetails?.pincode || '',
          phone: registration.companyDetails?.contactNumber || '',
          email: registration.companyDetails?.shopEmail || registration.email,
          gstNumber: registration.companyDetails?.gstNumber || '',
          
          // Bank details from registration
          bankName: registration.companyDetails?.bankName || '',
          accountNumber: registration.companyDetails?.accountNumber || '',
          ifscCode: registration.companyDetails?.ifscCode || '',
          accountHolderName: registration.companyDetails?.accountHolderName || '',
          upiId: registration.companyDetails?.upiId || '',
          
          // Settings from registration
          financialYear: registration.settings?.financialYear || '2024-2025',
          dateFormat: registration.settings?.dateFormat || 'DD/MM/YYYY',
          timeFormat: registration.settings?.timeFormat || '12-hour',
          currency: registration.settings?.currency || 'INR',
          decimalPlaces: registration.settings?.decimalPlaces || 2,
          quantityDecimalPlaces: registration.settings?.quantityDecimalPlaces || 0,
          rateDecimalPlaces: registration.settings?.rateDecimalPlaces || 2,
          roundOffTotal: registration.settings?.roundOffTotal || true,
          showPreviousBalance: registration.settings?.showPreviousBalance || true,
          enableOrderTracking: registration.settings?.enableOrderTracking || false,
          enableCreditLimit: registration.settings?.enableCreditLimit || false,
          enableGST: registration.settings?.enableGST || true,
          enableMultipleBranches: registration.settings?.enableMultipleBranches || false,
          
          // Logo and QR code placeholders
          logoDataURL: '',
          qrCodeDataURL: '',
          
          // Metadata
          createdAt: serverTimestamp(),
          importedFromRegistration: true
        });

        // Initialize empty collections for the user
        const collections = [
          'customers',
          'sales',
          'purchases',
          'orders',
          'transactions',
          'lensInventory',
          'salesReturns',
          'purchaseReturns'
        ];

        // Create initial documents for each collection to establish the structure
        for (const collectionName of collections) {
          await setDoc(doc(db, `users/${registration.uid}/${collectionName}/_placeholder`), {
            _placeholder: true,
            createdAt: serverTimestamp()
          });
        }
      } else {
        // Update existing user document
        await updateDoc(userDocRef, {
          status: 'approved',
          isActive: true,
          approvedAt: serverTimestamp(),
          approvedBy: user.email
        });
      }

      toast.success(`User ${registration.email} approved successfully`);
      
      // Close modal first, then refresh
      setShowUserModal(false);
      await fetchUsers();
      
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Failed to approve user: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleRejectUser = async (registration) => {
    if (!window.confirm(`Are you sure you want to reject ${registration.email}?`)) {
      return;
    }

    try {
      setRefreshing(true);
      
      // Update registration status
      await updateDoc(doc(db, 'userRegistrations', registration.id), {
        status: 'rejected',
        rejectedAt: serverTimestamp(),
        rejectedBy: user.email
      });

      // Check if user exists in users collection and deactivate them
      const userDocRef = doc(db, 'users', registration.uid);
      const existingUserDoc = await getDoc(userDocRef);

      if (existingUserDoc.exists()) {
        await updateDoc(userDocRef, {
          status: 'rejected',
          isActive: false,
          rejectedAt: serverTimestamp(),
          rejectedBy: user.email
        });
      }

      toast.success(`User ${registration.email} rejected`);
      
      // Close modal first, then refresh
      setShowUserModal(false);
      await fetchUsers();
      
    } catch (error) {
      console.error('Error rejecting user:', error);
      toast.error('Failed to reject user: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDisapproveUser = async (registration) => {
    if (!window.confirm(`Are you sure you want to disapprove ${registration.email}? This will revoke their access.`)) {
      return;
    }

    try {
      setRefreshing(true);
      
      // Update registration status back to pending
      await updateDoc(doc(db, 'userRegistrations', registration.id), {
        status: 'pending',
        disapprovedAt: serverTimestamp(),
        disapprovedBy: user.email
      });

      // Deactivate user in users collection
      const userDocRef = doc(db, 'users', registration.uid);
      const existingUserDoc = await getDoc(userDocRef);

      if (existingUserDoc.exists()) {
        await updateDoc(userDocRef, {
          status: 'pending',
          isActive: false,
          disapprovedAt: serverTimestamp(),
          disapprovedBy: user.email
        });
      }

      toast.success(`User ${registration.email} disapproved - access revoked`);
      
      // Close modal first, then refresh
      setShowUserModal(false);
      await fetchUsers();
      
    } catch (error) {
      console.error('Error disapproving user:', error);
      toast.error('Failed to disapprove user: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleDeleteUser = async (registration) => {
    // First confirmation
    if (!window.confirm(`Are you sure you want to PERMANENTLY DELETE ${registration.email}?\n\nThis will delete ALL user data including their business records and cannot be undone.`)) {
      return;
    }

    // Second confirmation with text input
    const confirmText = window.prompt(
      `To confirm deletion, please type "DELETE" (all caps) for ${registration.email}:`
    );
    
    if (confirmText !== 'DELETE') {
      toast.error('Deletion cancelled - confirmation text did not match');
      return;
    }

    try {
      setRefreshing(true);
      
      // Check if this is an orphaned user (no registration document)
      if (registration.isOrphaned || !registration.id || registration.source === 'users') {
        // For orphaned users, only delete from users collection
        const userDocRef = doc(db, 'users', registration.uid);
        const existingUserDoc = await getDoc(userDocRef);
        
        if (existingUserDoc.exists()) {
          await deleteDoc(userDocRef);
        }
      } else {
        // For regular users, delete from both collections
        // Delete from userRegistrations first
        if (registration.id) {
          await deleteDoc(doc(db, 'userRegistrations', registration.id));
        }

        // Delete from users collection if exists
        const userDocRef = doc(db, 'users', registration.uid);
        const existingUserDoc = await getDoc(userDocRef);

        if (existingUserDoc.exists()) {
          await deleteDoc(userDocRef);
        }
      }

      toast.success(`User ${registration.email} deleted from database. Note: Firebase Auth account may still exist - user should contact support if they cannot re-register.`);
      
      // Close modal first, then refresh
      setShowUserModal(false);
      await fetchUsers();
      
    } catch (error) {
      console.error('Error deleting user:', error);
      toast.error('Failed to delete user: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const handleEnableReregistration = async (registration) => {
    if (!window.confirm(`Allow ${registration.email} to register again?\n\nThis will remove their current registration record, allowing them to create a fresh application.\n\nNote: If they still cannot register, they may need to contact support to delete their Firebase Auth account.`)) {
      return;
    }

    try {
      setRefreshing(true);
      
      // Delete from userRegistrations to allow fresh registration
      await deleteDoc(doc(db, 'userRegistrations', registration.id));

      // If user exists in users collection, also remove them
      const userDocRef = doc(db, 'users', registration.uid);
      const existingUserDoc = await getDoc(userDocRef);

      if (existingUserDoc.exists()) {
        await deleteDoc(userDocRef);
      }

      toast.success(`${registration.email} can now register again with a fresh application. If they still get "email already in use" error, they should contact support.`);
      
      // Close modal first, then refresh
      setShowUserModal(false);
      await fetchUsers();
      
    } catch (error) {
      console.error('Error enabling re-registration:', error);
      toast.error('Failed to enable re-registration: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const badges = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      approved: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300',
      orphaned: 'bg-orange-100 text-orange-800 border-orange-300'
    };

    const icons = {
      pending: <ClockIcon className="w-4 h-4" />,
      approved: <CheckCircleIcon className="w-4 h-4" />,
      rejected: <XCircleIcon className="w-4 h-4" />,
      orphaned: <ExclamationTriangleIcon className="w-4 h-4" />
    };

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${badges[status] || badges.pending}`}>
        {icons[status] || icons.pending}
        {status === 'orphaned' ? 'Orphaned' : status?.charAt(0).toUpperCase() + status?.slice(1) || 'Unknown'}
      </span>
    );
  };

  const getActionButtons = (user) => {
    const buttonClass = "px-3 py-1 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const isOperating = refreshing; // Disable buttons during any operation
    
    // Special handling for orphaned users
    if (user.isOrphaned) {
      return (
        <div className="flex gap-2">
          <button
            onClick={() => handleDeleteOrphanedUser(user)}
            disabled={isOperating}
            className={`${buttonClass} bg-orange-100 text-orange-700 hover:bg-orange-200`}
          >
            {isOperating ? 'Processing...' : 'Clean Up'}
          </button>
          <button
            onClick={() => handleDeleteUser(user)}
            disabled={isOperating}
            className={`${buttonClass} bg-red-100 text-red-700 hover:bg-red-200`}
          >
            {isOperating ? 'Processing...' : 'Force Delete'}
          </button>
        </div>
      );
    }
    
    switch (user.status) {
      case 'pending':
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleApproveUser(user)}
              disabled={isOperating}
              className={`${buttonClass} bg-green-100 text-green-700 hover:bg-green-200`}
            >
              {isOperating ? 'Processing...' : 'Approve'}
            </button>
            <button
              onClick={() => handleRejectUser(user)}
              disabled={isOperating}
              className={`${buttonClass} bg-red-100 text-red-700 hover:bg-red-200`}
            >
              {isOperating ? 'Processing...' : 'Reject'}
            </button>
            <button
              onClick={() => handleDeleteUser(user)}
              disabled={isOperating}
              className={`${buttonClass} bg-gray-100 text-gray-700 hover:bg-gray-200`}
            >
              {isOperating ? 'Processing...' : 'Delete'}
            </button>
          </div>
        );
      
      case 'approved':
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleDisapproveUser(user)}
              disabled={isOperating}
              className={`${buttonClass} bg-yellow-100 text-yellow-700 hover:bg-yellow-200`}
            >
              {isOperating ? 'Processing...' : 'Disapprove'}
            </button>
            <button
              onClick={() => handleDeleteUser(user)}
              disabled={isOperating}
              className={`${buttonClass} bg-red-100 text-red-700 hover:bg-red-200`}
            >
              {isOperating ? 'Processing...' : 'Delete'}
            </button>
          </div>
        );
      
      case 'rejected':
        return (
          <div className="flex gap-2">
            <button
              onClick={() => handleApproveUser(user)}
              disabled={isOperating}
              className={`${buttonClass} bg-green-100 text-green-700 hover:bg-green-200`}
            >
              {isOperating ? 'Processing...' : 'Reapprove'}
            </button>
            <button
              onClick={() => handleEnableReregistration(user)}
              disabled={isOperating}
              className={`${buttonClass} bg-blue-100 text-blue-700 hover:bg-blue-200`}
            >
              {isOperating ? 'Processing...' : 'Enable Re-registration'}
            </button>
            <button
              onClick={() => handleDeleteUser(user)}
              disabled={isOperating}
              className={`${buttonClass} bg-red-100 text-red-700 hover:bg-red-200`}
            >
              {isOperating ? 'Processing...' : 'Delete'}
            </button>
          </div>
        );
      
      default:
        return (
          <button
            onClick={() => handleDeleteUser(user)}
            disabled={isOperating}
            className={`${buttonClass} bg-red-100 text-red-700 hover:bg-red-200`}
          >
            {isOperating ? 'Processing...' : 'Delete'}
          </button>
        );
    }
  };

  // Handle orphaned user cleanup
  const handleDeleteOrphanedUser = async (user) => {
    if (!window.confirm(`Clean up orphaned user ${user.email}?\n\nThis user exists in the users collection but has no registration record. This will remove them from the users collection only.`)) {
      return;
    }

    try {
      setRefreshing(true);
      
      // For orphaned users, we only need to delete from users collection
      // since they don't exist in userRegistrations
      const userDocRef = doc(db, 'users', user.uid);
      await deleteDoc(userDocRef);

      toast.success(`Orphaned user ${user.email} cleaned up successfully`);
      
      // Close modal first, then refresh
      setShowUserModal(false);
      await fetchUsers();
      
    } catch (error) {
      console.error('Error cleaning up orphaned user:', error);
      toast.error('Failed to clean up orphaned user: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };

  // Mobile App Permission Functions
  const handleApproveMobileAccess = useCallback(async (userRecord) => {
    // Validate inputs
    if (!userRecord?.uid || !userRecord?.email || !user?.email) {
      toast.error('Invalid user data or admin session');
      return;
    }

    if (!confirm(`Grant mobile app access to ${userRecord.email}?`)) {
      return;
    }

    try {
      setRefreshing(true);
      
      // Get or create user document in users collection
      const userDocRef = doc(db, 'users', userRecord.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        // Create user document if it doesn't exist
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

        await setDoc(userDocRef, {
          uid: userRecord.uid,
          email: userRecord.email,
          role: 'admin',
          permissions: defaultPermissions,
          isActive: true,
          status: 'approved',
          createdAt: serverTimestamp(),
          mobileAppAccess: true,
          mobileAppApprovedAt: serverTimestamp(),
          mobileAppApprovedBy: user.email,
          mobileAppRevokedAt: null,
          mobileAppRevokedBy: null
        });
      } else {
        // Update existing user document
        await updateDoc(userDocRef, {
          mobileAppAccess: true,
          mobileAppApprovedAt: serverTimestamp(),
          mobileAppApprovedBy: user.email,
          mobileAppRevokedAt: null,
          mobileAppRevokedBy: null
        });
      }

      await fetchUsers();
      toast.success(`Mobile app access granted to ${userRecord.email}`);

    } catch (error) {
      console.error('Error approving mobile access:', error);
      toast.error('Failed to grant mobile access. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [user?.email, fetchUsers]);

  const handleRevokeMobileAccess = useCallback(async (userRecord) => {
    // Validate inputs
    if (!userRecord?.uid || !userRecord?.email || !user?.email) {
      toast.error('Invalid user data or admin session');
      return;
    }

    if (!confirm(`Revoke mobile app access for ${userRecord.email}? They will be signed out automatically.`)) {
      return;
    }

    try {
      setRefreshing(true);
      
      const userDocRef = doc(db, 'users', userRecord.uid);
      await updateDoc(userDocRef, {
        mobileAppAccess: false,
        mobileAppRevokedAt: serverTimestamp(),
        mobileAppRevokedBy: user.email
      });

      await fetchUsers();
      toast.success(`Mobile app access revoked for ${userRecord.email}`);

    } catch (error) {
      console.error('Error revoking mobile access:', error);
      toast.error('Failed to revoke mobile access. Please try again.');
    } finally {
      setRefreshing(false);
    }
  }, [user?.email, fetchUsers]);

  const renderMobileAppStatus = useCallback((userRecord) => {
    // For users not in the users collection yet (only in registrations)
    if (userRecord.mobileAppAccess === undefined || userRecord.mobileAppAccess === null) {
      return (
        <div className="text-sm">
          <span className="text-gray-500">Not Approved</span>
        </div>
      );
    }

    if (userRecord.mobileAppAccess) {
      return (
        <div className="text-sm">
          <span className="text-green-600 font-medium">✅ Approved</span>
          {userRecord.mobileAppApprovedAt && (
            <div className="text-xs text-gray-500 mt-1">
              {formatDate(userRecord.mobileAppApprovedAt)}
            </div>
          )}
        </div>
      );
    } else {
      return (
        <div className="text-sm">
          <span className="text-red-600">❌ Not Approved</span>
          {userRecord.mobileAppRevokedAt && (
            <div className="text-xs text-gray-500 mt-1">
              Revoked: {formatDate(userRecord.mobileAppRevokedAt)}
            </div>
          )}
        </div>
      );
    }
  }, [formatDate]);

  const getMobileAppActionButtons = useCallback((userRecord) => {
    const buttonClass = "px-2 py-1 text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
    const isOperating = refreshing;

    // Only show mobile app buttons for approved users (users that exist in the system)
    if (userRecord.status !== 'approved') {
      return (
        <span className="text-xs text-gray-400">Approve user first</span>
      );
    }

    if (userRecord.mobileAppAccess) {
      return (
        <button
          onClick={() => handleRevokeMobileAccess(userRecord)}
          disabled={isOperating}
          className={`${buttonClass} bg-red-100 text-red-700 hover:bg-red-200 disabled:hover:bg-red-100`}
          title="Revoke mobile app access"
        >
          {isOperating ? 'Processing...' : 'Revoke'}
        </button>
      );
    } else {
      return (
        <button
          onClick={() => handleApproveMobileAccess(userRecord)}
          disabled={isOperating}
          className={`${buttonClass} bg-green-100 text-green-700 hover:bg-green-200 disabled:hover:bg-green-100`}
          title="Grant mobile app access"
        >
          {isOperating ? 'Processing...' : 'Approve'}
        </button>
      );
    }
  }, [refreshing, handleRevokeMobileAccess, handleApproveMobileAccess]);

  const filteredUsers = useMemo(() => allUsers.filter(user => {
    if (filterStatus === 'all') return true;
    return user.status === filterStatus;
  }), [allUsers, filterStatus]);

  const statusCounts = useMemo(() => ({
    all: allUsers.length,
    pending: allUsers.filter(u => u.status === 'pending').length,
    approved: allUsers.filter(u => u.status === 'approved').length,
    rejected: allUsers.filter(u => u.status === 'rejected').length,
    orphaned: allUsers.filter(u => u.status === 'orphaned').length
  }), [allUsers]);



  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <div className="text-xl text-gray-800">Loading Admin Panel...</div>
          <div className="text-sm text-gray-600 mt-2">Please wait while we load the user management interface.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">User Management</h1>
          <p className="text-gray-600">Manage user registrations and system access</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-blue-600 text-sm font-medium">Total Users</p>
                <p className="text-3xl font-bold text-blue-800 mt-1">{statusCounts.all}</p>
              </div>
              <UserGroupIcon className="w-10 h-10 text-blue-500" />
            </div>
          </div>
          
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-yellow-600 text-sm font-medium">Pending Approvals</p>
                <p className="text-3xl font-bold text-yellow-800 mt-1">{statusCounts.pending}</p>
              </div>
              <ClockIcon className="w-10 h-10 text-yellow-500" />
            </div>
          </div>
          
          <div className="bg-green-50 border border-green-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-600 text-sm font-medium">Approved Users</p>
                <p className="text-3xl font-bold text-green-800 mt-1">{statusCounts.approved}</p>
              </div>
              <CheckCircleIcon className="w-10 h-10 text-green-500" />
            </div>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-red-600 text-sm font-medium">Rejected</p>
                <p className="text-3xl font-bold text-red-800 mt-1">{statusCounts.rejected}</p>
              </div>
              <XCircleIcon className="w-10 h-10 text-red-500" />
            </div>
          </div>
        </div>

        {/* Add warning for orphaned users if any exist */}
        {statusCounts.orphaned > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <ExclamationTriangleIcon className="w-5 h-5 text-orange-500 mr-2" />
              <div>
                <h3 className="text-sm font-medium text-orange-800">
                  Orphaned Users Detected ({statusCounts.orphaned})
                </h3>
                <p className="text-sm text-orange-700 mt-1">
                  These users exist in the users collection but have no registration records. 
                  Use "Clean Up" to remove them or "Force Delete" for complete removal.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-sm mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                All ({statusCounts.all})
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  filterStatus === 'pending'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Pending ({statusCounts.pending})
              </button>
              <button
                onClick={() => setFilterStatus('approved')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  filterStatus === 'approved'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Approved ({statusCounts.approved})
              </button>
              <button
                onClick={() => setFilterStatus('rejected')}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  filterStatus === 'rejected'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Rejected ({statusCounts.rejected})
              </button>
              {statusCounts.orphaned > 0 && (
                <button
                  onClick={() => setFilterStatus('orphaned')}
                  className={`px-6 py-3 text-sm font-medium transition-colors ${
                    filterStatus === 'orphaned'
                      ? 'border-b-2 border-blue-500 text-blue-600'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Orphaned ({statusCounts.orphaned})
                </button>
              )}
            </nav>
          </div>

          <div className="p-6">
            <div className="flex justify-end mb-4">
              <button
                onClick={fetchUsers}
                disabled={refreshing}
                className="flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Users Table */}
            {filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User Details
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Company
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Mobile App
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Registration Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Details
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                              <BuildingOfficeIcon className="w-5 h-5 text-gray-600" />
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-medium text-gray-900">{user.email}</div>
                              <div className="text-sm text-gray-500">UID: {user.uid?.slice(0, 8)}...</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{user.companyDetails?.companyName || 'N/A'}</div>
                          <div className="text-sm text-gray-500">{user.companyDetails?.state || 'N/A'}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(user.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col gap-2">
                            {renderMobileAppStatus(user)}
                            {getMobileAppActionButtons(user)}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getActionButtons(user)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 text-sm font-medium"
                          >
                            <EyeIcon className="w-4 h-4 inline mr-1" />
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <UserGroupIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">
                  No {filterStatus === 'all' ? '' : filterStatus + ' '}users found
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold">User Details</h2>
                  <div className="flex items-center gap-2 mt-2">
                    {getStatusBadge(selectedUser.status)}
                    <span className="text-sm text-gray-500">
                      UID: {selectedUser.uid}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircleIcon className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* Company Information */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <BuildingOfficeIcon className="w-5 h-5 mr-2" />
                  Company Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-gray-600">Company Name</label>
                    <p className="font-medium">{selectedUser.companyDetails?.companyName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Email</label>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">Contact Number</label>
                    <p className="font-medium">{selectedUser.companyDetails?.contactNumber}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">GSTIN</label>
                    <p className="font-medium">{selectedUser.companyDetails?.gstin || 'Not provided'}</p>
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-sm text-gray-600">Address</label>
                    <p className="font-medium">{selectedUser.companyDetails?.address}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">State</label>
                    <p className="font-medium">{selectedUser.companyDetails?.state}</p>
                  </div>
                  <div>
                    <label className="text-sm text-gray-600">State Code</label>
                    <p className="font-medium">{selectedUser.companyDetails?.stateCode}</p>
                  </div>
                </div>
              </div>

              {/* Bank Information */}
              {(selectedUser.companyDetails?.bankName || selectedUser.companyDetails?.bankAccountNumber) && (
                <div className="mb-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center">
                    <BanknotesIcon className="w-5 h-5 mr-2" />
                    Bank Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-gray-600">Bank Name</label>
                      <p className="font-medium">{selectedUser.companyDetails?.bankName || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Branch</label>
                      <p className="font-medium">{selectedUser.companyDetails?.bankBranch || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">Account Number</label>
                      <p className="font-medium">{selectedUser.companyDetails?.bankAccountNumber || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-sm text-gray-600">IFSC Code</label>
                      <p className="font-medium">{selectedUser.companyDetails?.ifscCode || 'Not provided'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Settings */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center">
                  <ShieldCheckIcon className="w-5 h-5 mr-2" />
                  Settings & Preferences
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {selectedUser.settings?.enableGST && (
                    <div className="flex items-center">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
                      <span className="text-sm">GST Enabled</span>
                    </div>
                  )}
                  {selectedUser.settings?.enableOrderTracking && (
                    <div className="flex items-center">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
                      <span className="text-sm">Order Tracking</span>
                    </div>
                  )}
                  {selectedUser.settings?.enableCreditLimit && (
                    <div className="flex items-center">
                      <CheckCircleIcon className="w-4 h-4 text-green-500 mr-2" />
                      <span className="text-sm">Credit Limit</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Registration Info */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Registration Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <label className="text-gray-600">Status</label>
                    <p className="font-medium capitalize">{selectedUser.status}</p>
                  </div>
                  <div>
                    <label className="text-gray-600">Registered On</label>
                    <p className="font-medium">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                  {selectedUser.approvedAt && (
                    <div>
                      <label className="text-gray-600">Approved On</label>
                      <p className="font-medium">{formatDate(selectedUser.approvedAt)}</p>
                    </div>
                  )}
                  {selectedUser.approvedBy && (
                    <div>
                      <label className="text-gray-600">Approved By</label>
                      <p className="font-medium">{selectedUser.approvedBy}</p>
                    </div>
                  )}
                  {selectedUser.rejectedAt && (
                    <div>
                      <label className="text-gray-600">Rejected On</label>
                      <p className="font-medium">{formatDate(selectedUser.rejectedAt)}</p>
                    </div>
                  )}
                  {selectedUser.disapprovedAt && (
                    <div>
                      <label className="text-gray-600">Disapproved On</label>
                      <p className="font-medium">{formatDate(selectedUser.disapprovedAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-between items-center pt-4 border-t">
                <div className="flex gap-3">
                  {getActionButtons(selectedUser)}
                </div>
                <button
                  onClick={() => setShowUserModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel; 
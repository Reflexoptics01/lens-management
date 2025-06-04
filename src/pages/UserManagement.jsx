import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  orderBy,
  where,
  onSnapshot 
} from 'firebase/firestore';
import { 
  deleteUser,
  getAuth,
  onAuthStateChanged 
} from 'firebase/auth';
import Navbar from '../components/Navbar';
import { formatDate } from '../utils/dateUtils';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const USER_ROLES = {
    SUPER_ADMIN: 'super_admin',
    ADMIN: 'admin',
    MANAGER: 'manager',
    STAFF: 'staff',
    VIEWER: 'viewer'
  };

  const USER_STATUS = {
    ACTIVE: 'active',
    PENDING: 'pending',
    SUSPENDED: 'suspended'
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        checkUserPermissions(user.uid);
        fetchUsers();
      }
    });

    return () => unsubscribe();
  }, []);

  const checkUserPermissions = async (uid) => {
    try {
      const userDoc = await getDocs(query(
        collection(db, 'users'),
        where('uid', '==', uid)
      ));
      
      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        if (userData.role !== USER_ROLES.SUPER_ADMIN && userData.role !== USER_ROLES.ADMIN) {
          setError('You do not have permission to access user management');
          return;
        }
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      setError('Error checking permissions');
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      const q = query(usersRef, orderBy('createdAt', 'desc'));
      
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setUsers(usersList);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Error fetching users:', error);
      setError('Failed to fetch users');
      setLoading(false);
    }
  };

  const updateUserRole = async (userId, newRole) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        role: newRole,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating user role:', error);
      setError('Failed to update user role');
    }
  };

  const updateUserStatus = async (userId, newStatus) => {
    try {
      await updateDoc(doc(db, 'users', userId), {
        status: newStatus,
        updatedAt: new Date()
      });
    } catch (error) {
      console.error('Error updating user status:', error);
      setError('Failed to update user status');
    }
  };

  const suspendUser = async (userId) => {
    if (!window.confirm('Are you sure you want to suspend this user?')) return;
    await updateUserStatus(userId, USER_STATUS.SUSPENDED);
  };

  const activateUser = async (userId) => {
    await updateUserStatus(userId, USER_STATUS.ACTIVE);
  };

  const deleteUserAccount = async (userId) => {
    if (!window.confirm('Are you sure you want to permanently delete this user? This action cannot be undone.')) return;
    
    try {
      // Delete from Firestore
      await deleteDoc(doc(db, 'users', userId));
      // Note: Firebase Auth user deletion requires admin SDK on backend
      // For now, just mark as deleted in Firestore
    } catch (error) {
      console.error('Error deleting user:', error);
      setError('Failed to delete user');
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesFilter = filter === 'all' || user.status === filter || user.role === filter;
    const matchesSearch = user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.opticalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesFilter && matchesSearch;
  });

  const getRoleBadgeColor = (role) => {
    switch(role) {
      case USER_ROLES.SUPER_ADMIN:
        return 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200';
      case USER_ROLES.ADMIN:
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      case USER_ROLES.MANAGER:
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case USER_ROLES.STAFF:
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case USER_ROLES.VIEWER:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
    }
  };

  const getStatusBadgeColor = (status) => {
    switch(status) {
      case USER_STATUS.ACTIVE:
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case USER_STATUS.PENDING:
        return 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200';
      case USER_STATUS.SUSPENDED:
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200';
    }
  };

  if (loading) {
    return (
      <div className="mobile-page bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-8 h-8 border-4 border-sky-600 dark:border-sky-400 border-t-transparent rounded-full"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mobile-page bg-gray-50 dark:bg-gray-900 min-h-screen">
        <Navbar />
        <div className="mobile-content">
          <div className="p-4 text-center text-red-500 dark:text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-page bg-gray-50 dark:bg-gray-900 min-h-screen">
      <Navbar />
      
      <div className="mobile-content">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">User Management</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Manage user accounts, roles, and permissions
            </p>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search users by email, optical name, or contact person..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
          </div>
          <div>
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            >
              <option value="all">All Users</option>
              <option value={USER_STATUS.ACTIVE}>Active Users</option>
              <option value={USER_STATUS.PENDING}>Pending Approval</option>
              <option value={USER_STATUS.SUSPENDED}>Suspended Users</option>
              <option value={USER_ROLES.SUPER_ADMIN}>Super Admins</option>
              <option value={USER_ROLES.ADMIN}>Admins</option>
              <option value={USER_ROLES.MANAGER}>Managers</option>
              <option value={USER_ROLES.STAFF}>Staff</option>
              <option value={USER_ROLES.VIEWER}>Viewers</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.filter(u => u.status === USER_STATUS.ACTIVE).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active Users</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
              {users.filter(u => u.status === USER_STATUS.PENDING).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Pending</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {users.filter(u => u.status === USER_STATUS.SUSPENDED).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Suspended</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {users.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Total Users</div>
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Last Activity
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10">
                          <div className="h-10 w-10 rounded-full bg-sky-100 dark:bg-sky-900 flex items-center justify-center">
                            <span className="text-sm font-medium text-sky-600 dark:text-sky-300">
                              {user.opticalName?.charAt(0) || user.email?.charAt(0) || 'U'}
                            </span>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {user.opticalName || 'No Name'}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {user.email}
                          </div>
                          {user.contactPerson && (
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              Contact: {user.contactPerson}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={user.role || USER_ROLES.VIEWER}
                        onChange={(e) => updateUserRole(user.id, e.target.value)}
                        className={`px-2 py-1 text-xs rounded-full font-semibold ${getRoleBadgeColor(user.role)} border-0 focus:ring-2 focus:ring-sky-500`}
                      >
                        <option value={USER_ROLES.VIEWER}>Viewer</option>
                        <option value={USER_ROLES.STAFF}>Staff</option>
                        <option value={USER_ROLES.MANAGER}>Manager</option>
                        <option value={USER_ROLES.ADMIN}>Admin</option>
                        <option value={USER_ROLES.SUPER_ADMIN}>Super Admin</option>
                      </select>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 text-xs rounded-full font-semibold ${getStatusBadgeColor(user.status)}`}>
                        {user.status || USER_STATUS.PENDING}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {user.createdAt ? formatDate(user.createdAt.toDate()) : 'Unknown'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {user.lastLogin ? formatDate(user.lastLogin.toDate()) : 'Never'}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        {user.status === USER_STATUS.SUSPENDED ? (
                          <button
                            onClick={() => activateUser(user.id)}
                            className="text-green-600 dark:text-green-400 hover:text-green-900 dark:hover:text-green-300"
                            title="Activate User"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        ) : (
                          <button
                            onClick={() => suspendUser(user.id)}
                            className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                            title="Suspend User"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                            </svg>
                          </button>
                        )}
                        <button
                          onClick={() => deleteUserAccount(user.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-900 dark:hover:text-red-300"
                          title="Delete User"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8">
            <svg className="w-16 h-16 text-gray-400 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
            <p className="text-gray-500 dark:text-gray-400">No users found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserManagement; 
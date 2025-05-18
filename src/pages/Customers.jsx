import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomerForm from '../components/CustomerForm';
import CustomerCard from '../components/CustomerCard';
import { 
  MagnifyingGlassIcon, 
  PlusIcon, 
  UserGroupIcon, 
  ArrowPathIcon 
} from '@heroicons/react/24/outline';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let unsubscribe;

    const initializeCustomers = async () => {
      try {
        if (!auth.currentUser) {
          navigate('/login');
          return;
        }

        // Set up real-time listener for customers collection
        const customersRef = collection(db, 'customers');
        unsubscribe = onSnapshot(customersRef, (snapshot) => {
          const customersList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setCustomers(customersList);
          setError('');
          setLoading(false);
        }, (err) => {
          console.error('Error fetching customers:', err);
          setError('Failed to load customers. Please try again.');
          setLoading(false);
        });

      } catch (error) {
        console.error('Error initializing customers:', error);
        setError('Failed to initialize customers view');
        setLoading(false);
      }
    };

    initializeCustomers();
    return () => unsubscribe && unsubscribe();
  }, [navigate]);

  const handleDelete = async (customerId) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) {
      return;
    }

    try {
      await deleteDoc(doc(db, 'customers', customerId));
      // No need to update state as the onSnapshot listener will handle it
    } catch (error) {
      console.error('Error deleting customer:', error);
      setError('Failed to delete customer');
    }
  };

  const handleEdit = (customer) => {
    setEditingCustomer(customer);
    setShowAddModal(true);
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setEditingCustomer(null);
    // No need to manually fetch as onSnapshot will handle updates
  };

  // Filter customers based on search term
  const filteredCustomers = searchTerm.trim() 
    ? customers.filter(customer => 
        customer.opticalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.contactPerson?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.phone?.includes(searchTerm) ||
        customer.city?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : customers;

  // Format currency for display
  const formatCurrency = (amount) => {
    if (amount === undefined || amount === null) return '-';
    return `₹${parseFloat(amount).toLocaleString('en-IN', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    })}`;
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-slate-50">
        <Navbar />
        <main className="flex-grow flex items-center justify-center">
          <div className="flex flex-col items-center p-8 text-gray-600">
            <ArrowPathIcon className="animate-spin w-12 h-12 mb-4 text-sky-600" />
            <p>Loading customers...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <Navbar />
      
      <main className="flex-grow max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="mt-1 text-sm text-gray-500">Manage your optical store customers</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search customers..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full sm:w-auto"
              />
            </div>
            
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            >
              <PlusIcon className="w-5 h-5 mr-2 -ml-1" />
              <span>Add Customer</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-400 text-red-700 rounded-md">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* No Customers State */}
        {customers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <UserGroupIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No customers found</h3>
            <p className="text-gray-500 mb-6">Get started by adding your first customer</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500"
            >
              <PlusIcon className="w-5 h-5 mr-2 -ml-1" />
              Add New Customer
            </button>
          </div>
        ) : (
          <>
            {/* Search Results Summary */}
            {searchTerm && (
              <div className="mb-4 text-sm text-gray-500">
                Found {filteredCustomers.length} {filteredCustomers.length === 1 ? 'customer' : 'customers'} matching "{searchTerm}"
                {filteredCustomers.length === 0 && (
                  <button 
                    onClick={() => setSearchTerm('')}
                    className="ml-2 text-sky-600 hover:text-sky-800"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}

            {/* Desktop Table View */}
            <div className="hidden md:block mb-8">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Optical Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact Person
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone / City
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Financial
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredCustomers.map((customer) => (
                        <tr key={customer.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {customer.opticalName}
                            </div>
                            {customer.gstNumber && (
                              <div className="text-xs text-gray-500 mt-1">
                                <span className="bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded">GST</span> {customer.gstNumber}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {customer.contactPerson}
                            </div>
                            {customer.email && (
                              <div className="text-sm text-sky-600 truncate max-w-[200px]">
                                <a href={`mailto:${customer.email}`}>{customer.email}</a>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-sky-600">
                              <a href={`tel:${customer.phone}`}>{customer.phone}</a>
                            </div>
                            <div className="text-sm text-gray-500">
                              {customer.city}{customer.state ? `, ${customer.state}` : ''}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {(customer.creditLimit !== undefined || customer.openingBalance !== undefined || customer.creditPeriod !== undefined) && (
                              <div className="space-y-1 text-sm">
                                {(customer.creditLimit !== undefined) && (
                                  <div className="text-gray-600">
                                    <span className="text-gray-500">Credit Limit:</span> {formatCurrency(customer.creditLimit)}
                                  </div>
                                )}
                                {(customer.openingBalance !== undefined) && (
                                  <div className="text-gray-600">
                                    <span className="text-gray-500">Balance:</span> {formatCurrency(customer.openingBalance)}
                                  </div>
                                )}
                                {(customer.creditPeriod !== undefined) && (
                                  <div className="text-gray-600">
                                    <span className="text-gray-500">Terms:</span> {customer.creditPeriod} days
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => handleEdit(customer)}
                              className="text-sky-600 hover:text-sky-900 font-medium mr-4"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDelete(customer.id)}
                              className="text-red-600 hover:text-red-900 font-medium"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {filteredCustomers.map((customer) => (
                <CustomerCard 
                  key={customer.id} 
                  customer={customer} 
                  onEdit={handleEdit} 
                  onDelete={handleDelete} 
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Customer Form Modal */}
      {showAddModal && (
        <CustomerForm 
          onClose={handleCloseModal} 
          customer={editingCustomer} 
        />
      )}
    </div>
  );
};

export default Customers; 
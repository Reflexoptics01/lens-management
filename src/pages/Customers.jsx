import { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, getDocs, deleteDoc, doc, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import CustomerForm from '../components/CustomerForm';

const Customers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Navbar />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="text-center text-gray-500">Loading customers...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Navbar />
      
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Customers</h1>
          <a
            href="/customers/new"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-[#4169E1] hover:bg-[#3154b3] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#4169E1]"
          >
            Add New Customer
          </a>
        </div>

        {error && (
          <div className="mb-4 p-4 text-red-700 bg-red-100 rounded-md">
            {error}
          </div>
        )}

        {/* Customers List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {customers.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No customers found. Click "Add New Customer" to create one.
            </div>
          ) : (
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
                      Phone
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      City
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {customer.opticalName}
                        </div>
                        {customer.email && (
                          <div className="text-sm text-gray-500">
                            {customer.email}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {customer.contactPerson}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.phone}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.city}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleEdit(customer)}
                          className="text-[#4169E1] hover:text-[#3154b3] mr-4"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(customer.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Customer Form Modal */}
        {showAddModal && (
          <CustomerForm
            onClose={handleCloseModal}
            customer={editingCustomer}
          />
        )}
      </div>
    </div>
  );
};

export default Customers; 
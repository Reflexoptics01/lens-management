import { useState } from 'react';
import { auth } from '../firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import { Link } from 'react-router-dom';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);

    try {
      const trimmedEmail = email.trim();
      
      await sendPasswordResetEmail(auth, trimmedEmail);
      setSuccess(true);
    } catch (error) {
      console.error('Error sending reset email:', error);
      let errorMessage = 'Failed to send password reset email';
      
      if (error.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address. Please check and try again.';
      } else if (error.code === 'auth/user-not-found') {
        errorMessage = 'No account exists with this email address.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-r from-white to-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
        <div className="mb-6">
          <h2 className="text-center text-xl font-medium text-gray-800">
            Reset Your Password
          </h2>
          <p className="text-center text-sm text-gray-600 mt-2">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        </div>
        
        {success ? (
          <div className="space-y-6">
            <div className="text-sm text-center font-medium text-green-600 bg-green-100 py-3 px-4 rounded-lg">
              Password reset email sent! Check your inbox for further instructions.
            </div>
            <div className="text-center">
              <Link 
                to="/login" 
                className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
              >
                Return to login
              </Link>
            </div>
          </div>
        ) : (
          <form className="space-y-6" onSubmit={handleResetPassword}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            {error && (
              <div className="text-sm text-center font-medium text-red-600 bg-red-100 py-2 px-3 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="relative w-full flex justify-center py-3 px-4 rounded-lg text-white bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all duration-300 overflow-hidden group"
              >
                <span className="relative z-10 font-medium text-sm tracking-wide">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </span>
                <span className="absolute bottom-0 left-0 w-full h-full transform translate-y-full bg-gradient-to-r from-indigo-600 to-blue-700 transition-transform duration-300 ease-in-out group-hover:translate-y-0"></span>
              </button>
            </div>
            
            <div className="text-center">
              <Link 
                to="/login" 
                className="text-blue-600 hover:text-blue-800 text-sm font-medium transition-colors"
              >
                Return to login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword; 
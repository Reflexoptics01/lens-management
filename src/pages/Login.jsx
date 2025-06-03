import { useState, useEffect } from 'react';
import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  
  // Use centralized auth state
  const { 
    isAuthenticated, 
    isLoading, 
    userRole, 
    authError,
    USER_ROLES 
  } = useAuth();

  // Use theme context for proper dark mode
  const { isDark } = useTheme();

  const slides = [
    { 
      image: '/images/1.png', 
      title: 'Complete Optical Business Solutions', 
      description: 'Comprehensive software for billing, CRM, and lens management tailored for optical businesses'
    },
    { 
      image: '/images/2.png', 
      title: 'Website & E-commerce Development', 
      description: 'Custom optical websites with integrated e-commerce and affordable hosting solutions'
    },
    { 
      image: '/images/3.png', 
      title: 'Custom Lens Brand Development', 
      description: 'End-to-end support to establish and grow your own lens brand with our management platform'
    },
    { 
      image: '/images/4.png', 
      title: 'Franchise Management Software', 
      description: 'Streamlined operations for manufacturers, distributors, and retailers in the optical industry'
    },
  ];

  // Handle navigation when user is authenticated
  useEffect(() => {
    if (isAuthenticated()) {
      console.log('🔐 User authenticated, navigating based on role:', userRole);
      
      // Navigate based on user role
      switch (userRole) {
        case USER_ROLES.SUPER_ADMIN:
          navigate('/admin');
          break;
        case USER_ROLES.ADMIN:
          navigate('/orders');
          break;
        default:
          navigate('/orders');
          break;
      }
    }
  }, [isAuthenticated, userRole, navigate]);

  // Show auth error if present
  useEffect(() => {
    if (authError) {
      setError(authError);
    }
  }, [authError]);

  // Slideshow automation
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      console.log('🔐 Attempting to sign in with email:', email);
      
      // Trim whitespace from email and password
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      
      if (trimmedEmail !== email || trimmedPassword !== password) {
        console.log('🔐 Trimmed whitespace from credentials');
      }
      
      // Sign in user with Firebase authentication
      // The AuthContext will handle the rest (validation, role assignment, navigation)
      await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      
      console.log('🔐 Firebase sign-in successful, AuthContext will handle the rest');
      
    } catch (error) {
      console.error('🔐 Error signing in:', error);
      let errorMessage = 'Failed to sign in';
      
      // Provide more helpful error messages
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email' || error.code === 'auth/user-not-found') {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password. Please try again.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled. Please contact an administrator.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Too many unsuccessful login attempts. Please try again later or reset your password.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Show loading while AuthContext initializes
  if (isLoading()) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-gray-50 to-white dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
          <div className="text-xl text-gray-800 dark:text-gray-200">Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Left side - Slideshow */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 to-indigo-800">
        <div className="absolute inset-0 bg-black bg-opacity-20"></div>
        <div className="relative z-10 flex flex-col justify-center items-center text-white p-12">
          <div className="w-full max-w-lg">
            {slides.map((slide, index) => (
              <div
                key={index}
                className={`transition-all duration-1000 ${
                  index === currentSlide ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-8 absolute'
                }`}
              >
                <div className="text-center">
                  <img 
                    src={slide.image} 
                    alt={slide.title}
                    className="w-48 h-48 mx-auto mb-8 object-contain"
                  />
                  <h2 className="text-3xl font-bold mb-4">{slide.title}</h2>
                  <p className="text-lg text-blue-100">{slide.description}</p>
                </div>
              </div>
            ))}
          </div>
          
          {/* Slide indicators */}
          <div className="flex space-x-2 mt-8">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${
                  index === currentSlide ? 'bg-white' : 'bg-white bg-opacity-50'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white dark:bg-gray-900">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2 text-gray-900 dark:text-white">Welcome Back</h1>
            <p className="text-gray-600 dark:text-gray-400">Sign in to your account</p>
          </div>

          {error && (
            <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-2 text-gray-700 dark:text-gray-300">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 focus:border-transparent pr-10 transition-colors bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 transition-colors text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Link
                to="/forgot-password"
                className="text-sm transition-colors text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  Signing in...
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Don't have an account?{' '}
              <Link 
                to="/register" 
                className="font-medium transition-colors text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                Register here
              </Link>
            </p>
          </div>

          <div className="mt-8 text-center text-xs text-gray-500 dark:text-gray-400">
            <p>© 2024 Reflex Optic Solutions. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;

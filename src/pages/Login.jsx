import { useState, useEffect } from 'react';
import { auth, db } from '../firebaseConfig';
import { signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, getDocs, query, where, doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Check if user exists and get permissions
        try {
          const usersRef = collection(db, 'users');
          const userQuery = query(usersRef, where('email', '==', user.email));
          const userSnapshot = await getDocs(userQuery);
          
          if (!userSnapshot.empty) {
            // Store user role and permissions in localStorage for app-wide access
            const userData = userSnapshot.docs[0].data();
            
            // Check if user is inactive
            if (userData.isActive === false) {
              console.error('User account is inactive');
              // Sign out the user
              await auth.signOut();
              setError('Your account has been deactivated. Please contact an administrator.');
              setInitializing(false);
              return;
            }
            
            localStorage.setItem('userRole', userData.role || 'user');
            localStorage.setItem('userPermissions', JSON.stringify(userData.permissions || {}));
            
            // Navigate based on role or permissions
            if (userData.role === 'admin') {
              navigate('/dashboard');
            } else {
              // For regular users, navigate to the first permitted page
              const permissions = userData.permissions || {};
              const availablePaths = Object.entries(permissions)
                .filter(([_, hasAccess]) => hasAccess)
                .map(([path]) => path);
                
              if (availablePaths.length > 0) {
                navigate(availablePaths[0]);
              } else {
                navigate('/orders'); // Default page if no specific permissions
              }
            }
          } else {
            // Create new user document if it doesn't exist (for first login)
            await addDoc(collection(db, 'users'), {
              uid: user.uid,
              email: user.email,
              role: 'admin', // First user is admin by default
              permissions: {}, // Admin has all permissions by default
              createdAt: new Date(),
              isActive: true // Mark as active by default
            });
            localStorage.setItem('userRole', 'admin');
            localStorage.setItem('userPermissions', JSON.stringify({}));
            navigate('/dashboard');
          }
        } catch (error) {
          console.error('Error checking user:', error);
          // Still navigate to default page on error
          navigate('/orders');
        }
      }
      setInitializing(false);
    });

    return () => unsubscribe();
  }, [navigate]);

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
      console.log('Attempting to sign in with email:', email);
      
      // Trim whitespace from email and password
      const trimmedEmail = email.trim();
      const trimmedPassword = password.trim();
      
      if (trimmedEmail !== email || trimmedPassword !== password) {
        console.log('Trimmed whitespace from credentials');
      }
      
      // Sign in user with Firebase authentication
      await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      
      // Navigation is handled in the onAuthStateChanged listener
    } catch (error) {
      console.error('Error signing in:', error);
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

  if (initializing) {
    return (
      <div className="min-h-screen bg-gradient-to-r from-gray-50 to-white flex items-center justify-center">
        <div className="text-xl text-gray-800">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-r from-white to-gray-50 flex flex-col md:flex-row overflow-hidden">
      {/* Left Section - Login Form */}
      <div className="w-full md:w-5/12 flex items-center justify-center p-6 md:p-12 z-10">
        <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-lg border border-gray-200">
          <div className="mb-6">
            <h2 className="text-center text-xl font-medium text-gray-800">
              Sign in to your account
            </h2>
          </div>
          
          <form className="space-y-6" onSubmit={handleLogin}>
            <div className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Email
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
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    className="w-full px-4 py-3 bg-white border border-gray-300 text-gray-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700 transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="mt-2 text-right">
                  <Link to="/forgot-password" className="text-sm text-blue-600 hover:text-blue-800 transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>
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
                  {loading ? 'Signing in...' : 'Sign In'}
                </span>
                <span className="absolute bottom-0 left-0 w-full h-full transform translate-y-full bg-gradient-to-r from-indigo-600 to-blue-700 transition-transform duration-300 ease-in-out group-hover:translate-y-0"></span>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Right Section - Slideshow */}
      <div className="hidden md:block md:w-7/12 relative overflow-hidden">
        {/* Company header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black to-transparent py-8 px-8 z-30">
          <div className="max-w-3xl mx-auto">
            <h1 className="text-3xl font-bold text-white mb-2">
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-indigo-500">
                REFLEX OPTIC SOLUTIONS
              </span>
            </h1>
            <h2 className="text-xl font-medium text-gray-200">
              Empowering Optical Businesses
            </h2>
            <p className="text-sm text-gray-300 mt-1">
              Affordable Solutions for Every Optical Business
            </p>
            
            {/* Contact Info */}
            <div className="mt-4 pt-3 border-t border-gray-700 border-opacity-40 flex flex-wrap justify-start items-center gap-4 text-white">
              <a href="tel:+916361773719" className="flex items-center space-x-2 text-sm hover:text-blue-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                <span>91 - 63617 73719</span>
              </a>
              <a href="mailto:Info@reflexoptics.in" className="flex items-center space-x-2 text-sm hover:text-blue-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span>Info@reflexoptics.in</span>
              </a>
              <a href="https://www.reflexoptics.in" target="_blank" rel="noopener noreferrer" className="flex items-center space-x-2 text-sm hover:text-blue-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                </svg>
                <span>www.reflexoptics.in</span>
              </a>
            </div>
          </div>
        </div>
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black opacity-30 z-10"></div>
        
        {/* Slideshow Images */}
        <div className="absolute inset-0 flex items-center justify-center z-0">
          {slides.map((slide, index) => (
            <div 
              key={index}
              className={`absolute w-full h-full max-w-3xl max-h-[650px] mx-auto transition-all duration-1000 ease-in-out ${
                index === currentSlide 
                  ? 'opacity-100 scale-100' 
                  : 'opacity-0 scale-105'
              }`}
            >
              <div className="w-full h-full flex items-center justify-center p-8">
                <img 
                  src={slide.image} 
                  alt={slide.title} 
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
              </div>
            </div>
          ))}
        </div>
        
        {/* Content Overlay */}
        <div className="absolute bottom-16 left-12 right-12 z-20">
          <div className="bg-black bg-opacity-30 backdrop-blur-sm p-6 rounded-xl border border-white border-opacity-10 transform transition-all duration-700 ease-out translate-y-0 opacity-100">
            <h3 className="text-3xl font-bold text-white mb-2">
              {slides[currentSlide].title}
            </h3>
            <div className="w-16 h-1 bg-gradient-to-r from-blue-400 to-indigo-500 mb-4"></div>
            <p className="text-gray-200 mb-2">{slides[currentSlide].description}</p>
            <div className="mt-4 flex flex-wrap items-center">
              <span className="text-blue-300 text-sm font-semibold mr-2 mb-2">OUR SERVICES:</span>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 bg-blue-900 bg-opacity-40 rounded text-xs text-white">Billing</span>
                <span className="px-2 py-1 bg-blue-900 bg-opacity-40 rounded text-xs text-white">CRM</span>
                <span className="px-2 py-1 bg-blue-900 bg-opacity-40 rounded text-xs text-white">E-commerce</span>
                <span className="px-2 py-1 bg-blue-900 bg-opacity-40 rounded text-xs text-white">Applications</span>
                <span className="px-2 py-1 bg-blue-900 bg-opacity-40 rounded text-xs text-white">Hosting</span>
              </div>
            </div>
          </div>
        </div>

        {/* Slideshow Navigation Dots */}
        <div className="absolute bottom-6 left-0 right-0 flex justify-center space-x-3 z-20">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`w-12 h-1 rounded-full transition-all duration-300 ${
                index === currentSlide 
                  ? 'bg-gradient-to-r from-blue-400 to-indigo-500 w-16' 
                  : 'bg-gray-400 bg-opacity-40'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Login;

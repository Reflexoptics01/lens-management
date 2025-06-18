import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details for debugging
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
          <div className="max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg p-6">
            <div className="flex items-center justify-center w-12 h-12 mx-auto bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white text-center mb-2">
              Application Error
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
              Something went wrong. Please refresh the page to continue.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.location.reload()}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md text-sm font-medium transition-colors"
              >
                Refresh Page
              </button>
              {import.meta.env.DEV && (
                <details className="mt-4">
                  <summary className="text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                    Debug Information
                  </summary>
                  <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700 rounded text-xs">
                    <pre className="whitespace-pre-wrap text-red-600 dark:text-red-400">
                      {this.state.error && this.state.error.toString()}
                    </pre>
                    <pre className="whitespace-pre-wrap text-gray-600 dark:text-gray-400 mt-2">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </div>
                </details>
              )}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary; 
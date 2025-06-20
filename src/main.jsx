import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './styles/global.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'

// Clean up service workers only in development to prevent conflicts
if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    registrations.forEach(function(registration) {
      registration.unregister();
    });
  });
}

// Create root only once and render
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)

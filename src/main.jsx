import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'
import './styles/global.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary'
import { ThemeProvider } from './contexts/ThemeContext.jsx'

// Debug service workers that might be causing Firestore issues
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(function(registrations) {
    console.log('Found service worker registrations:', registrations.length);
    for(let registration of registrations) {
      console.log('Service worker registration:', registration);
      // Unregister service workers that might be causing Firestore issues
      registration.unregister().then(function(success) {
        console.log('Service worker unregistered:', success);
      });
    }
  });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </React.StrictMode>
)

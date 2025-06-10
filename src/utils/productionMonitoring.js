// Production monitoring and analytics utilities

import { db } from '../firebaseConfig';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

// Error tracking and logging
export const logError = async (error, context = {}) => {
  try {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      timestamp: serverTimestamp(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId: localStorage.getItem('userUid'),
      context,
      severity: determineSeverity(error),
      environment: import.meta.env?.REACT_APP_ENV || 'development'
    };

    // Log to Firestore for persistent storage
    await addDoc(collection(db, 'errorLogs'), errorLog);
    
    // Log to console in development
    if (import.meta.env?.MODE === 'development') {
      // Error logged to Firestore
    }
  } catch (logError) {
    // Fallback to console if logging fails
    console.error('Failed to log error:', logError);
    console.error('Original error:', error);
  }
};

// Determine error severity
const determineSeverity = (error) => {
  const criticalErrors = [
    'ChunkLoadError',
    'Script error',
    'Network Error',
    'Firebase Auth Error'
  ];
  
  const errorString = error.toString();
  
  if (criticalErrors.some(critical => errorString.includes(critical))) {
    return 'critical';
  }
  
  if (error.name === 'TypeError' || error.name === 'ReferenceError') {
    return 'high';
  }
  
  return 'medium';
};

// User activity tracking
export const trackUserActivity = async (action, details = {}) => {
  try {
    const activity = {
      action,
      details,
      timestamp: serverTimestamp(),
      userId: localStorage.getItem('userUid'),
      userAgent: navigator.userAgent,
      url: window.location.href,
      sessionId: getSessionId()
    };

    await addDoc(collection(db, 'userActivity'), activity);
  } catch (error) {
    console.error('Failed to track user activity:', error);
  }
};

// Performance monitoring
export const trackPerformance = async (metric, value, context = {}) => {
  try {
    const performanceLog = {
      metric,
      value,
      context,
      timestamp: serverTimestamp(),
      userId: localStorage.getItem('userUid'),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    await addDoc(collection(db, 'performanceLogs'), performanceLog);
  } catch (error) {
    console.error('Failed to track performance:', error);
  }
};

// Page load time tracking
export const trackPageLoad = () => {
  window.addEventListener('load', () => {
    const loadTime = performance.now();
    trackPerformance('page_load_time', loadTime, {
      page: window.location.pathname
    });
  });
};

// Feature usage tracking
export const trackFeatureUsage = async (feature, action = 'used') => {
  await trackUserActivity('feature_usage', {
    feature,
    action,
    timestamp: new Date().toISOString()
  });
};

// Business metrics tracking
export const trackBusinessMetric = async (metric, value, metadata = {}) => {
  try {
    const businessMetric = {
      metric,
      value,
      metadata,
      timestamp: serverTimestamp(),
      userId: localStorage.getItem('userUid'),
      date: new Date().toISOString().split('T')[0] // YYYY-MM-DD
    };

    await addDoc(collection(db, 'businessMetrics'), businessMetric);
  } catch (error) {
    console.error('Failed to track business metric:', error);
  }
};

// Session management
let sessionId = null;

const getSessionId = () => {
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  return sessionId;
};

// System health check
export const performHealthCheck = async () => {
  const healthCheck = {
    timestamp: new Date(),
    checks: {}
  };

  try {
    // Check Firebase connection
    const testDoc = await addDoc(collection(db, 'healthChecks'), {
      test: true,
      timestamp: serverTimestamp()
    });
    healthCheck.checks.firebase = 'healthy';
  } catch (error) {
    healthCheck.checks.firebase = 'unhealthy';
    logError(error, { context: 'health_check_firebase' });
  }

  // Check local storage
  try {
    localStorage.setItem('health_check', 'test');
    localStorage.removeItem('health_check');
    healthCheck.checks.localStorage = 'healthy';
  } catch (error) {
    healthCheck.checks.localStorage = 'unhealthy';
  }

  // Check network connectivity
  healthCheck.checks.network = navigator.onLine ? 'healthy' : 'unhealthy';

  return healthCheck;
};

// User session tracking
export const startUserSession = async () => {
  const sessionStart = {
    sessionId: getSessionId(),
    userId: localStorage.getItem('userUid'),
    startTime: serverTimestamp(),
    userAgent: navigator.userAgent,
    referrer: document.referrer,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight
    }
  };

  await addDoc(collection(db, 'userSessions'), sessionStart);
};

export const endUserSession = async () => {
  // This would typically be called on page unload
  // Note: Beacon API might be better for this
  const sessionEnd = {
    sessionId: getSessionId(),
    endTime: serverTimestamp(),
    duration: performance.now()
  };

  try {
    await addDoc(collection(db, 'sessionEnds'), sessionEnd);
  } catch (error) {
    // Use sendBeacon as fallback for page unload
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/session-end', JSON.stringify(sessionEnd));
    }
  }
};

// Critical alert system
export const sendCriticalAlert = async (alert) => {
  const criticalAlert = {
    ...alert,
    severity: 'critical',
    timestamp: serverTimestamp(),
    acknowledged: false,
    userId: localStorage.getItem('userUid')
  };

  await addDoc(collection(db, 'criticalAlerts'), criticalAlert);
  
  // In production, you might want to integrate with external alerting services
  // like PagerDuty, Slack webhooks, etc.
};

// Automated error reporting
export const setupGlobalErrorHandling = () => {
  // Catch unhandled JavaScript errors
  window.addEventListener('error', (event) => {
    logError(new Error(event.message), {
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      type: 'javascript_error'
    });
  });

  // Catch unhandled Promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    logError(new Error(event.reason), {
      type: 'unhandled_promise_rejection'
    });
  });

  // Track page visibility changes
  document.addEventListener('visibilitychange', () => {
    trackUserActivity('page_visibility_change', {
      hidden: document.hidden
    });
  });
};

// Initialize monitoring
export const initializeMonitoring = () => {
  setupGlobalErrorHandling();
  trackPageLoad();
  startUserSession();
  
  // Clean up on page unload
  window.addEventListener('beforeunload', () => {
    endUserSession();
  });
  
  // Periodic health checks (every 5 minutes)
  setInterval(async () => {
    const health = await performHealthCheck();
    if (Object.values(health.checks).includes('unhealthy')) {
      await sendCriticalAlert({
        type: 'system_health',
        message: 'System health check failed',
        details: health
      });
    }
  }, 5 * 60 * 1000);
};

// Analytics dashboard data helpers
export const getAnalyticsData = async (timeRange = '7d') => {
  // This would query the logged data for dashboard display
  // Implementation depends on your specific needs
  
  const analyticsData = {
    timeRange,
    userActivity: {
      // Query userActivity collection
    },
    errors: {
      // Query errorLogs collection  
    },
    performance: {
      // Query performanceLogs collection
    },
    businessMetrics: {
      // Query businessMetrics collection
    }
  };

  return analyticsData;
};

// Export for use in components
export default {
  logError,
  trackUserActivity,
  trackPerformance,
  trackFeatureUsage,
  trackBusinessMetric,
  performHealthCheck,
  initializeMonitoring,
  getAnalyticsData
}; 
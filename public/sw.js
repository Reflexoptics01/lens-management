// Development-friendly service worker
// Only provides minimal functionality to avoid interfering with Vite dev server

const CACHE_NAME = 'lens-management-v1';
const isProduction = location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';

// Install event
self.addEventListener('install', event => {
  self.skipWaiting();
});

// Activate event
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      self.clients.claim()
    ])
  );
});

// Fetch event - minimal intervention for development
self.addEventListener('fetch', event => {
  // In development, let all requests pass through normally
  if (!isProduction) {
    return; // Don't intercept any requests in development
  }

  // In production, only cache static assets
  if (event.request.method === 'GET' && 
      (event.request.url.includes('/images/') || 
       event.request.url.includes('/fonts/') ||
       event.request.url.endsWith('.ico'))) {
    
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request)
            .then(fetchResponse => {
              if (fetchResponse.status === 200) {
                const responseClone = fetchResponse.clone();
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, responseClone);
                });
              }
              return fetchResponse;
            });
        })
        .catch(() => {
          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
  }
}); 
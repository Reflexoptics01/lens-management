const CACHE_NAME = `lens-management-v${Date.now()}`;
const STATIC_CACHE = 'lens-management-static-v2';

// Install event - skip waiting to activate immediately
self.addEventListener('install', event => {
  // Skip waiting to activate immediately
  self.skipWaiting();
  
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        // Only cache truly static assets
        return cache.addAll([
          '/',
          '/images/Copy of Phoenix_20240923_001818_0000.svg'
        ]);
      })
      .catch(() => {
        // Silently handle cache installation errors
      })
  );
});

// Fetch event - Network First strategy for dynamic assets
self.addEventListener('fetch', event => {
  // Skip service worker for Firebase and external API requests
  if (event.request.url.includes('firestore.googleapis.com') ||
      event.request.url.includes('firebase') ||
      event.request.url.includes('googleapis.com') ||
      event.request.url.includes('chrome-extension://') ||
      event.request.url.includes('api/') ||
      event.request.method !== 'GET') {
    return; // Let the network handle these requests directly
  }

  // For JS/CSS assets, use Network First strategy
  if (event.request.url.includes('/assets/') || 
      event.request.url.endsWith('.js') || 
      event.request.url.endsWith('.css')) {
    
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // If network succeeds, cache the new version
          if (response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(event.request);
        })
    );
  } else {
    // For other requests, try cache first, then network
    event.respondWith(
      caches.match(event.request)
        .then(response => {
          return response || fetch(event.request)
            .then(fetchResponse => {
              // Cache successful responses
              if (fetchResponse.status === 200) {
                const responseClone = fetchResponse.clone();
                caches.open(STATIC_CACHE).then(cache => {
                  cache.put(event.request, responseClone);
                });
              }
              return fetchResponse;
            });
        })
        .catch(() => {
          return new Response('Offline - content not available', {
            status: 503,
            statusText: 'Service Unavailable'
          });
        })
    );
  }
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', event => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
}); 
const CACHE_NAME = 'overtime-logger-v2';
const urlsToCache = [
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/style.css',
  '/script.js',
  // CDN resources
  'https://unpkg.com/jspdf@latest/dist/jspdf.umd.min.js',
  'https://unpkg.com/jspdf-autotable@latest/dist/jspdf.plugin.autotable.min.js'
];

// Install event - cache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.log('Cache failed:', error);
        // Continue even if some resources fail to cache
        return caches.open(CACHE_NAME)
          .then(cache => {
            return cache.addAll([
              '/index.html',
              '/manifest.json',
              '/style.css',
              '/script.js'
            ]);
          });
      })
  );
});

// Fetch event - serve from cache, fallback to network, then offline page
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version if found
        if (response) {
          return response;
        }
        
        // Otherwise, try network
        return fetch(event.request)
          .then(response => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            // Add it to cache for later
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return response;
          })
          .catch(async () => {
            // Network failed, check if this was a navigation request
            if (event.request.mode === 'navigate') {
              // Show offline page
              const cache = await caches.open(CACHE_NAME);
              return cache.match('/offline.html');
            }
            
            // For non-navigation requests, just fail
            throw new Error('Network unavailable');
          });
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for offline data storage
self.addEventListener('sync', event => {
  if (event.tag === 'backup-overtime') {
    event.waitUntil(
      // Handle background sync for overtime data
      handleBackgroundSync()
    );
  }
});

function handleBackgroundSync() {
  // This would handle syncing offline data when connection is restored
  return new Promise((resolve) => {
    console.log('Background sync triggered for overtime data');
    resolve();
  });
}

// Push notifications (future feature)
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Don\'t forget to export your overtime data!',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open App',
        icon: '/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Overtime Logger', options)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      self.clients.openWindow('/index.html')
    );
  }
});
const APP_VERSION = '1.8.1';  // Update this to force cache refresh
const CACHE_NAME = `overtime-logger-v${APP_VERSION}`;
console.log('[SW] Service Worker script loaded, version:', APP_VERSION);

const urlsToCache = [
  '/',
  '/index.html',
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
  console.log('[SW Install] Service Worker installation started');
  // Skip waiting during install to activate immediately
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME)
        .then(cache => {
          console.log('[SW Install] Cache opened:', CACHE_NAME);
          console.log('[SW Install] Caching resources:', urlsToCache);
          return cache.addAll(urlsToCache).then(() => {
            console.log('[SW Install] All resources cached successfully');
          }).catch(error => {
            console.error('[SW Install] Cache addAll failed:', error);
            throw error;
          });
        }),
      self.skipWaiting() // Force activation
    ])
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW Activate] Service Worker activation started');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        console.log('[SW Activate] Existing caches:', cacheNames);
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW Activate] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Take control of all clients immediately and notify them
      self.clients.claim().then(() => {
        console.log('[SW Activate] Clients claimed');
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ 
              type: 'REFRESH_NEEDED',
              version: APP_VERSION 
            });
          });
        });
      })
    ]).then(() => {
      console.log('[SW Activate] Activation complete');
    })
  );
});

// Fetch event - serve from cache, falling back to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('[SW Fetch] Serving from cache:', event.request.url);
          return response;
        }
        console.log('[SW Fetch] Fetching from network:', event.request.url);
        return fetch(event.request).then(response => {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            console.log('[SW Fetch] Not caching response:', event.request.url);
            return response;
          }
          
          // Clone the response since it can only be consumed once
          const responseToCache = response.clone();
          
          caches.open(CACHE_NAME)
            .then(cache => {
              console.log('[SW Fetch] Caching new resource:', event.request.url);
              cache.put(event.request, responseToCache);
            });
            
          return response;
        });
      })
  );
});

// Message handling for update
self.addEventListener('message', event => {
  if (event.data.type === 'SKIP_WAITING') {
    console.log('[SW Message] Skip waiting message received');
    Promise.all([
      self.skipWaiting(),
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[SW Message] Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
    ]).then(() => {
      console.log('[SW Message] skipWaiting and cache cleanup completed');
    }).catch(err => {
      console.error('[SW Message] Error during update:', err);
    });
  }
});

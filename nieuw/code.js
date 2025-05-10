// sw.js - Service Worker
const CACHE_NAME = 'overuren-tracker-cache-v1.7.0'; // Increment version on app updates
const urlsToCache = [
  './', // Alias for index.html if server configured this way
  './index.html',
  './manifest.json',
  // Add app icons (ensure these paths are correct and files exist)
  './images/icon-192x192.png',
  './images/icon-512x512.png',
  './images/apple-touch-icon.png',
  // External CDN resources
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.25/jspdf.plugin.autotable.min.js'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache: ' + CACHE_NAME);
        
        // Create Request objects for CDN URLs to attempt 'cors' mode
        // This is a better practice than just passing string URLs for external resources
        // to cache.addAll, as it gives more control.
        const requests = urlsToCache.map(url => {
          if (url.startsWith('http')) { // External CDN URL
            return new Request(url, { mode: 'cors' }); // Try CORS for CDNs
          }
          return url; // Local asset
        });

        // Use cache.addAll for simplicity if most are local or CORS-friendly
        // For more robust error handling on individual external resources:
        return Promise.all(
            requests.map(req => 
                cache.add(req).catch(err => console.warn(`Failed to cache during install - ${req.url || req}: ${err}`))
            )
        );
      })
      .catch(err => {
        console.error('Cache open failed during install:', err);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of uncontrolled clients immediately
  );
});

self.addEventListener('fetch', event => {
  // For navigation requests (HTML pages), try network first, then cache (NetworkFallingBackToCache).
  // This ensures users get the latest HTML if online.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Optional: If you want to cache the HTML page upon successful fetch.
          // Be mindful of caching dynamic HTML if it changes frequently.
          // if (response && response.ok) { // response.ok checks for status 200-299
          //   const responseToCache = response.clone();
          //   caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseToCache));
          // }
          return response;
        })
        .catch(() => {
          // Fallback to cache if network fails
          return caches.match(event.request)
            .then(cachedResponse => {
              return cachedResponse || caches.match('./index.html'); // Fallback to main index if specific page not cached
            });
        })
    );
    return;
  }

  // For other requests (CSS, JS, images, fonts), use CacheFirst strategy.
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response; // Serve from cache
        }
        // If not in cache, fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Cache new non-navigation resources dynamically if they are valid
            if (networkResponse && networkResponse.ok && 
                (networkResponse.type === 'basic' || networkResponse.type === 'cors')) { 
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
            }
            return networkResponse;
          }
        ).catch(error => {
            console.warn(`Fetch failed for ${event.request.url}; returning offline fallback or error`, error);
            // Optionally, return a generic offline fallback for images/assets here
            // e.g., if (event.request.destination === 'image') return caches.match('./images/offline-placeholder.png');
        });
      })
  );
});
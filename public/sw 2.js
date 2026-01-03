/**
 * AmiDash Service Worker
 * Enables offline file capture and background sync
 */

const CACHE_NAME = 'amidash-v1';
const OFFLINE_URL = '/offline';

// Assets to cache for offline use (focused on file upload functionality)
const PRECACHE_ASSETS = [
  '/',
  '/offline',
  '/manifest.json',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

// Routes that should work offline (will serve from cache or show offline page)
const OFFLINE_CAPABLE_ROUTES = [
  '/projects',
  '/files',
];

/**
 * Install event - cache core assets
 */
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching core assets');
      return cache.addAll(PRECACHE_ASSETS);
    })
  );

  // Activate immediately
  self.skipWaiting();
});

/**
 * Activate event - clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  // Take control of all pages immediately
  self.clients.claim();
});

/**
 * Fetch event - network-first with cache fallback
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip cross-origin requests (except for allowed domains)
  if (url.origin !== self.location.origin) {
    // Allow Supabase and Microsoft auth
    const allowedOrigins = [
      'supabase.co',
      'login.microsoftonline.com',
      'graph.microsoft.com',
    ];

    if (!allowedOrigins.some(origin => url.hostname.includes(origin))) {
      return;
    }
  }

  // Skip API routes - they should always go to network
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // For navigation requests, use network-first with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses for offline use
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(async () => {
          // Try to serve from cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }

          // Fall back to offline page
          const offlineResponse = await caches.match(OFFLINE_URL);
          if (offlineResponse) {
            return offlineResponse;
          }

          // Last resort - return a basic offline response
          return new Response(
            '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        })
    );
    return;
  }

  // For other requests (assets), use cache-first
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(request).then((response) => {
        // Cache static assets
        if (response.ok && shouldCacheRequest(request)) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

/**
 * Determine if a request should be cached
 */
function shouldCacheRequest(request) {
  const url = new URL(request.url);

  // Cache static assets
  const staticExtensions = ['.js', '.css', '.png', '.jpg', '.jpeg', '.svg', '.woff', '.woff2'];
  return staticExtensions.some(ext => url.pathname.endsWith(ext));
}

/**
 * Background Sync - upload files when back online
 */
self.addEventListener('sync', (event) => {
  console.log('[SW] Sync event:', event.tag);

  if (event.tag === 'file-sync') {
    event.waitUntil(syncPendingFiles());
  }
});

/**
 * Sync pending files from IndexedDB
 */
async function syncPendingFiles() {
  console.log('[SW] Starting file sync...');

  try {
    // Notify all clients to trigger sync
    const clients = await self.clients.matchAll({ type: 'window' });

    for (const client of clients) {
      client.postMessage({
        type: 'SYNC_REQUESTED',
        timestamp: Date.now(),
      });
    }

    console.log('[SW] Notified clients to sync');
  } catch (error) {
    console.error('[SW] Sync failed:', error);
    throw error; // Rethrow to retry sync
  }
}

/**
 * Handle messages from the main thread
 */
self.addEventListener('message', (event) => {
  const { type, data } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      if (data && Array.isArray(data.urls)) {
        caches.open(CACHE_NAME).then((cache) => {
          cache.addAll(data.urls);
        });
      }
      break;

    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME);
      break;

    default:
      console.log('[SW] Unknown message type:', type);
  }
});

/**
 * Push notification handler (for future use)
 */
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();

  event.waitUntil(
    self.registration.showNotification(data.title || 'AmiDash', {
      body: data.body || 'You have a new notification',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      data: data.url ? { url: data.url } : undefined,
    })
  );
});

/**
 * Notification click handler
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Focus existing window if available
      for (const client of clients) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      // Open new window
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});

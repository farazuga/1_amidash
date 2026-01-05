'use client';

import { useEffect } from 'react';

/**
 * Registers the service worker and handles updates
 */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Register service worker
    registerServiceWorker();

    // Request persistent storage for offline files
    requestPersistentStorage();

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', handleSWMessage);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleSWMessage);
    };
  }, []);

  return null;
}

/**
 * Register the service worker
 */
async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[App] Service worker registered:', registration.scope);

    // Check for updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (!newWorker) return;

      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          // New version available
          console.log('[App] New service worker available');

          // Optionally prompt user to refresh
          if (window.confirm('A new version is available. Reload to update?')) {
            newWorker.postMessage({ type: 'SKIP_WAITING' });
            window.location.reload();
          }
        }
      });
    });

    // Handle controller change (new SW activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('[App] Service worker controller changed');
    });

  } catch (error) {
    console.error('[App] Service worker registration failed:', error);
  }
}

/**
 * Request persistent storage to prevent data loss
 */
async function requestPersistentStorage() {
  if (!navigator.storage?.persist) {
    console.log('[App] Persistent storage not supported');
    return;
  }

  try {
    const isPersisted = await navigator.storage.persisted();

    if (isPersisted) {
      console.log('[App] Storage is already persistent');
      return;
    }

    const granted = await navigator.storage.persist();
    console.log(`[App] Persistent storage ${granted ? 'granted' : 'denied'}`);
  } catch (error) {
    console.error('[App] Error requesting persistent storage:', error);
  }
}

/**
 * Handle messages from the service worker
 */
function handleSWMessage(event: MessageEvent) {
  const { type } = event.data || {};

  switch (type) {
    case 'SYNC_REQUESTED':
      console.log('[App] Sync requested by service worker');
      // Trigger sync via the offline module
      triggerSync();
      break;

    default:
      console.log('[App] Unknown message from SW:', type);
  }
}

/**
 * Trigger file sync
 */
async function triggerSync() {
  try {
    // Dynamically import to avoid loading offline code on every page
    const { triggerSync } = await import('@/lib/offline/sync-manager');
    await triggerSync();
  } catch (error) {
    console.error('[App] Sync trigger failed:', error);
  }
}

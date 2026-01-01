/**
 * Background sync manager for offline file uploads
 * Handles syncing files from IndexedDB to the server when online
 */

import {
  getNextPendingUpload,
  updateFileSyncStatus,
  deleteOfflineFile,
  getPendingUploadCount,
  updateSyncState,
  getSyncState,
  type OfflineFileRecord,
} from './indexed-db';

// Sync configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const SYNC_INTERVAL_MS = 30000; // 30 seconds

type SyncProgressCallback = (progress: {
  synced: number;
  total: number;
  current: string | null;
}) => void;

let syncIntervalId: NodeJS.Timeout | null = null;
let isSyncing = false;
let progressCallback: SyncProgressCallback | null = null;

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

/**
 * Upload a single file to the server
 */
async function uploadFileToServer(file: OfflineFileRecord): Promise<{ success: boolean; error?: string }> {
  try {
    // Determine the appropriate endpoint based on whether it's a project file or presales file
    const endpoint = file.projectId
      ? '/api/files/upload'
      : '/api/files/presales/upload';

    const formData = new FormData();

    // Create a Blob from the ArrayBuffer
    const blob = new Blob([file.fileData], { type: file.contentType });
    const fileObj = new File([blob], file.fileName, { type: file.contentType });

    formData.append('file', fileObj);
    formData.append('category', file.category);

    if (file.projectId) {
      formData.append('projectId', file.projectId);
    }
    if (file.dealId) {
      formData.append('dealId', file.dealId);
    }
    if (file.phase) {
      formData.append('phase', file.phase);
    }
    if (file.notes) {
      formData.append('notes', file.notes);
    }
    if (file.location) {
      formData.append('location', JSON.stringify(file.location));
    }

    // Mark as captured offline
    formData.append('capturedOffline', 'true');
    formData.append('capturedOnDevice', file.deviceType);
    formData.append('capturedAt', file.capturedAt);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `Upload failed with status ${response.status}`,
      };
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Upload failed',
    };
  }
}

/**
 * Sync a single file with retry logic
 */
async function syncFile(file: OfflineFileRecord): Promise<boolean> {
  // Update status to syncing
  await updateFileSyncStatus(file.id, 'syncing');

  const result = await uploadFileToServer(file);

  if (result.success) {
    // Mark as synced and remove from IndexedDB
    await updateFileSyncStatus(file.id, 'synced');
    await deleteOfflineFile(file.id);
    return true;
  }

  // Check retry count
  if (file.syncAttempts >= MAX_RETRY_ATTEMPTS) {
    await updateFileSyncStatus(file.id, 'failed', result.error);
    return false;
  }

  // Mark as pending for retry
  await updateFileSyncStatus(file.id, 'pending', result.error);
  return false;
}

/**
 * Process the upload queue
 */
export async function processUploadQueue(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (!isOnline()) {
    return { synced: 0, failed: 0, remaining: await getPendingUploadCount() };
  }

  if (isSyncing) {
    console.log('[Sync] Already syncing, skipping...');
    return { synced: 0, failed: 0, remaining: await getPendingUploadCount() };
  }

  isSyncing = true;
  await updateSyncState({ isSyncing: true, error: null });

  let synced = 0;
  let failed = 0;
  const startCount = await getPendingUploadCount();

  try {
    while (true) {
      const file = await getNextPendingUpload();
      if (!file) break;

      // Notify progress
      if (progressCallback) {
        progressCallback({
          synced,
          total: startCount,
          current: file.fileName,
        });
      }

      const success = await syncFile(file);
      if (success) {
        synced++;
      } else {
        failed++;
      }

      // Small delay between uploads to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await updateSyncState({
      lastSync: new Date().toISOString(),
      isSyncing: false,
    });
  } catch (error) {
    console.error('[Sync] Error processing queue:', error);
    await updateSyncState({
      isSyncing: false,
      error: error instanceof Error ? error.message : 'Sync failed',
    });
  } finally {
    isSyncing = false;
  }

  const remaining = await getPendingUploadCount();

  // Notify completion
  if (progressCallback) {
    progressCallback({
      synced,
      total: startCount,
      current: null,
    });
  }

  return { synced, failed, remaining };
}

/**
 * Start background sync (call this when app starts or comes online)
 */
export function startBackgroundSync(onProgress?: SyncProgressCallback): void {
  if (syncIntervalId) {
    return; // Already running
  }

  progressCallback = onProgress || null;

  // Initial sync
  processUploadQueue().catch(console.error);

  // Set up interval
  syncIntervalId = setInterval(() => {
    if (isOnline()) {
      processUploadQueue().catch(console.error);
    }
  }, SYNC_INTERVAL_MS);

  // Listen for online events
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  console.log('[Sync] Background sync started');
}

/**
 * Stop background sync
 */
export function stopBackgroundSync(): void {
  if (syncIntervalId) {
    clearInterval(syncIntervalId);
    syncIntervalId = null;
  }

  progressCallback = null;

  if (typeof window !== 'undefined') {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  }

  console.log('[Sync] Background sync stopped');
}

/**
 * Handle coming back online
 */
function handleOnline(): void {
  console.log('[Sync] Device is online, triggering sync...');
  processUploadQueue().catch(console.error);
}

/**
 * Handle going offline
 */
function handleOffline(): void {
  console.log('[Sync] Device is offline, pausing sync...');
}

/**
 * Trigger an immediate sync (user-initiated)
 */
export async function triggerSync(): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  return processUploadQueue();
}

/**
 * Get current sync status
 */
export async function getSyncStatus(): Promise<{
  isSyncing: boolean;
  pendingCount: number;
  lastSync: string | null;
  error: string | null;
  isOnline: boolean;
}> {
  const state = await getSyncState();
  const pendingCount = await getPendingUploadCount();

  return {
    isSyncing: state.isSyncing,
    pendingCount,
    lastSync: state.lastSync,
    error: state.error,
    isOnline: isOnline(),
  };
}

/**
 * Register for Background Sync API (if supported)
 * This allows sync even when the app is closed
 */
export async function registerBackgroundSync(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;

  if ('serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const registration = await navigator.serviceWorker.ready;
      // Type assertion for Background Sync API
      const swRegistration = registration as ServiceWorkerRegistration & {
        sync: { register: (tag: string) => Promise<void> };
      };

      if (swRegistration.sync) {
        await swRegistration.sync.register('file-sync');
        console.log('[Sync] Background sync registered');
        return true;
      }
    } catch (error) {
      console.error('[Sync] Failed to register background sync:', error);
      return false;
    }
  }

  console.log('[Sync] Background Sync API not supported');
  return false;
}

/**
 * Check if there are pending files and register for background sync
 */
export async function scheduleBackgroundSync(): Promise<void> {
  const pendingCount = await getPendingUploadCount();

  if (pendingCount > 0) {
    const registered = await registerBackgroundSync();
    if (!registered) {
      // Fallback: start the foreground sync instead
      startBackgroundSync();
    }
  }
}

/**
 * Request persistent storage for offline files
 */
export async function requestPersistence(): Promise<boolean> {
  if (navigator.storage?.persist) {
    const granted = await navigator.storage.persist();
    if (granted) {
      console.log('[Storage] Persistent storage granted');
    } else {
      console.log('[Storage] Persistent storage denied');
    }
    return granted;
  }
  return false;
}

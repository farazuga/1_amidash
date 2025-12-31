/**
 * IndexedDB layer for offline file storage
 * Uses the 'idb' library for promise-based IndexedDB operations
 */

import { openDB, type IDBPDatabase } from 'idb';
import type { FileCategory, ProjectPhase, DeviceType } from '@/types';

// Database schema version
const DB_VERSION = 1;
const DB_NAME = 'amidash-offline';

// Types for offline file captures
export interface OfflineFileRecord {
  id: string; // UUID
  projectId: string | null; // null for presales files
  dealId: string | null; // For presales files
  fileName: string;
  fileData: ArrayBuffer;
  contentType: string;
  category: FileCategory;
  phase?: ProjectPhase;
  notes?: string;
  capturedAt: string; // ISO timestamp
  deviceType: DeviceType;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncAttempts: number;
  lastSyncError?: string;
  lastSyncAttempt?: string;
}

// Pending upload queue entry
export interface PendingUpload {
  id: string;
  fileRecordId: string;
  createdAt: string;
  priority: number; // Lower = higher priority
}

// Sync state record
export interface SyncStateRecord {
  key: string;
  lastSync: string | null;
  isSyncing: boolean;
  error: string | null;
}

// Use simpler typing for IndexedDB
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OfflineDB = IDBPDatabase<any>;
let dbInstance: OfflineDB | null = null;

/**
 * Get or create the IndexedDB database instance
 */
export async function getDB(): Promise<OfflineDB> {
  if (dbInstance) {
    return dbInstance;
  }

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create offline-files store
      if (!db.objectStoreNames.contains('offline-files')) {
        const fileStore = db.createObjectStore('offline-files', { keyPath: 'id' });
        fileStore.createIndex('by-project', 'projectId');
        fileStore.createIndex('by-deal', 'dealId');
        fileStore.createIndex('by-status', 'syncStatus');
        fileStore.createIndex('by-captured', 'capturedAt');
      }

      // Create upload queue store
      if (!db.objectStoreNames.contains('upload-queue')) {
        const queueStore = db.createObjectStore('upload-queue', { keyPath: 'id' });
        queueStore.createIndex('by-priority', 'priority');
        queueStore.createIndex('by-created', 'createdAt');
      }

      // Create sync state store
      if (!db.objectStoreNames.contains('sync-state')) {
        db.createObjectStore('sync-state', { keyPath: 'key' });
      }
    },
  });

  return dbInstance;
}

/**
 * Generate a UUID for file records
 */
function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Save a captured file to IndexedDB
 */
export async function saveOfflineFile(
  file: Omit<OfflineFileRecord, 'id' | 'syncStatus' | 'syncAttempts'>
): Promise<OfflineFileRecord> {
  const db = await getDB();

  const record: OfflineFileRecord = {
    ...file,
    id: generateId(),
    syncStatus: 'pending',
    syncAttempts: 0,
  };

  await db.put('offline-files', record);

  // Add to upload queue
  await addToUploadQueue(record.id);

  return record;
}

/**
 * Get all offline files for a project
 */
export async function getOfflineFilesByProject(projectId: string): Promise<OfflineFileRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline-files', 'by-project', projectId);
}

/**
 * Get all offline files for a deal (presales)
 */
export async function getOfflineFilesByDeal(dealId: string): Promise<OfflineFileRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline-files', 'by-deal', dealId);
}

/**
 * Get all pending offline files
 */
export async function getPendingFiles(): Promise<OfflineFileRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('offline-files', 'by-status', 'pending');
}

/**
 * Get all offline files regardless of status
 */
export async function getAllOfflineFiles(): Promise<OfflineFileRecord[]> {
  const db = await getDB();
  return db.getAll('offline-files');
}

/**
 * Get a single offline file by ID
 */
export async function getOfflineFile(id: string): Promise<OfflineFileRecord | undefined> {
  const db = await getDB();
  return db.get('offline-files', id);
}

/**
 * Update an offline file's sync status
 */
export async function updateFileSyncStatus(
  id: string,
  status: OfflineFileRecord['syncStatus'],
  error?: string
): Promise<void> {
  const db = await getDB();
  const record = await db.get('offline-files', id);

  if (record) {
    record.syncStatus = status;
    record.syncAttempts += 1;
    record.lastSyncAttempt = new Date().toISOString();
    if (error) {
      record.lastSyncError = error;
    }
    await db.put('offline-files', record);
  }
}

/**
 * Delete an offline file (after successful sync)
 */
export async function deleteOfflineFile(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('offline-files', id);
  await removeFromUploadQueue(id);
}

/**
 * Add a file to the upload queue
 */
async function addToUploadQueue(fileRecordId: string, priority: number = 1): Promise<void> {
  const db = await getDB();
  const entry: PendingUpload = {
    id: generateId(),
    fileRecordId,
    createdAt: new Date().toISOString(),
    priority,
  };
  await db.put('upload-queue', entry);
}

/**
 * Remove a file from the upload queue
 */
async function removeFromUploadQueue(fileRecordId: string): Promise<void> {
  const db = await getDB();
  const allEntries = await db.getAll('upload-queue');
  const entry = allEntries.find(e => e.fileRecordId === fileRecordId);
  if (entry) {
    await db.delete('upload-queue', entry.id);
  }
}

/**
 * Get the next file to upload from the queue
 */
export async function getNextPendingUpload(): Promise<OfflineFileRecord | null> {
  const db = await getDB();
  const queueEntries = await db.getAllFromIndex('upload-queue', 'by-priority');

  for (const entry of queueEntries) {
    const file = await db.get('offline-files', entry.fileRecordId);
    if (file && file.syncStatus === 'pending') {
      return file;
    }
  }

  return null;
}

/**
 * Get count of pending uploads
 */
export async function getPendingUploadCount(): Promise<number> {
  const db = await getDB();
  const pending = await db.getAllFromIndex('offline-files', 'by-status', 'pending');
  return pending.length;
}

/**
 * Get sync state
 */
export async function getSyncState(): Promise<{
  lastSync: string | null;
  isSyncing: boolean;
  error: string | null;
}> {
  const db = await getDB();
  const state = await db.get('sync-state', 'global');
  return state || { key: 'global', lastSync: null, isSyncing: false, error: null };
}

/**
 * Update sync state
 */
export async function updateSyncState(
  updates: Partial<{ lastSync: string; isSyncing: boolean; error: string | null }>
): Promise<void> {
  const db = await getDB();
  const current = await getSyncState();
  await db.put('sync-state', { ...current, key: 'global', ...updates });
}

/**
 * Clear all synced files (cleanup)
 */
export async function clearSyncedFiles(): Promise<number> {
  const db = await getDB();
  const synced = await db.getAllFromIndex('offline-files', 'by-status', 'synced');

  for (const file of synced) {
    await db.delete('offline-files', file.id);
  }

  return synced.length;
}

/**
 * Get storage estimate
 */
export async function getStorageEstimate(): Promise<{
  usage: number;
  quota: number;
  files: number;
}> {
  const estimate = await navigator.storage?.estimate();
  const db = await getDB();
  const files = await db.count('offline-files');

  return {
    usage: estimate?.usage || 0,
    quota: estimate?.quota || 0,
    files,
  };
}

/**
 * Request persistent storage (prevents browser from clearing data)
 */
export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persist) {
    return navigator.storage.persist();
  }
  return false;
}

/**
 * Check if we have persistent storage
 */
export async function hasPersistentStorage(): Promise<boolean> {
  if (navigator.storage?.persisted) {
    return navigator.storage.persisted();
  }
  return false;
}

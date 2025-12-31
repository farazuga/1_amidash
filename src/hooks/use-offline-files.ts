'use client';

/**
 * React hook for managing offline file captures
 * Provides integration with IndexedDB and background sync
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { FileCategory, ProjectPhase, DeviceType } from '@/types';

// Dynamic import for offline modules (client-side only)
let offlineModule: typeof import('@/lib/offline') | null = null;

async function getOfflineModule() {
  if (!offlineModule) {
    offlineModule = await import('@/lib/offline');
  }
  return offlineModule;
}

export interface UseOfflineFilesOptions {
  projectId?: string;
  dealId?: string;
  autoSync?: boolean;
}

export interface OfflineFileCapture {
  file: File;
  category: FileCategory;
  phase?: ProjectPhase;
  notes?: string;
  location?: {
    latitude: number;
    longitude: number;
    accuracy?: number;
  };
}

export interface OfflineFilesState {
  files: Array<{
    id: string;
    fileName: string;
    category: FileCategory;
    phase?: ProjectPhase;
    capturedAt: string;
    syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
    thumbnailUrl?: string;
  }>;
  pendingCount: number;
  isSyncing: boolean;
  isOnline: boolean;
  lastSync: string | null;
  error: string | null;
}

export function useOfflineFiles(options: UseOfflineFilesOptions = {}) {
  const { projectId, dealId, autoSync = true } = options;
  const [state, setState] = useState<OfflineFilesState>({
    files: [],
    pendingCount: 0,
    isSyncing: false,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    lastSync: null,
    error: null,
  });
  const [isReady, setIsReady] = useState(false);
  const syncStartedRef = useRef(false);

  // Initialize and load files
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const init = async () => {
      try {
        const offline = await getOfflineModule();

        // Request persistent storage
        await offline.requestPersistence();

        // Load existing files
        await refreshFiles();

        // Start background sync if enabled
        if (autoSync && !syncStartedRef.current) {
          syncStartedRef.current = true;
          offline.startBackgroundSync((progress) => {
            setState(prev => ({
              ...prev,
              isSyncing: progress.current !== null,
              pendingCount: progress.total - progress.synced,
            }));
          });
        }

        setIsReady(true);
      } catch (error) {
        console.error('Failed to initialize offline files:', error);
        setState(prev => ({
          ...prev,
          error: 'Failed to initialize offline storage',
        }));
      }
    };

    init();

    // Listen for online/offline events
    const handleOnline = () => setState(prev => ({ ...prev, isOnline: true }));
    const handleOffline = () => setState(prev => ({ ...prev, isOnline: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      // Don't stop sync on unmount - let it continue in background
    };
  }, [autoSync]);

  // Refresh files list
  const refreshFiles = useCallback(async () => {
    try {
      const offline = await getOfflineModule();
      let files;

      if (projectId) {
        files = await offline.getOfflineFilesByProject(projectId);
      } else if (dealId) {
        files = await offline.getOfflineFilesByDeal(dealId);
      } else {
        files = await offline.getAllOfflineFiles();
      }

      const status = await offline.getSyncStatus();

      setState(prev => ({
        ...prev,
        files: files.map(f => ({
          id: f.id,
          fileName: f.fileName,
          category: f.category,
          phase: f.phase,
          capturedAt: f.capturedAt,
          syncStatus: f.syncStatus,
        })),
        pendingCount: status.pendingCount,
        isSyncing: status.isSyncing,
        lastSync: status.lastSync,
        error: status.error,
      }));
    } catch (error) {
      console.error('Failed to refresh offline files:', error);
    }
  }, [projectId, dealId]);

  // Capture a file offline
  const captureFile = useCallback(async (capture: OfflineFileCapture): Promise<string | null> => {
    try {
      const offline = await getOfflineModule();

      // Read file as ArrayBuffer
      const arrayBuffer = await capture.file.arrayBuffer();

      // Detect device type
      const deviceType = getDeviceType();

      // Save to IndexedDB
      const record = await offline.saveOfflineFile({
        projectId: projectId || null,
        dealId: dealId || null,
        fileName: capture.file.name,
        fileData: arrayBuffer,
        contentType: capture.file.type,
        category: capture.category,
        phase: capture.phase,
        notes: capture.notes,
        capturedAt: new Date().toISOString(),
        deviceType,
        location: capture.location,
      });

      // Refresh file list
      await refreshFiles();

      // Try to sync immediately if online
      if (navigator.onLine) {
        offline.triggerSync().catch(console.error);
      }

      return record.id;
    } catch (error) {
      console.error('Failed to capture file offline:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to save file offline',
      }));
      return null;
    }
  }, [projectId, dealId, refreshFiles]);

  // Delete an offline file
  const deleteFile = useCallback(async (id: string): Promise<boolean> => {
    try {
      const offline = await getOfflineModule();
      await offline.deleteOfflineFile(id);
      await refreshFiles();
      return true;
    } catch (error) {
      console.error('Failed to delete offline file:', error);
      return false;
    }
  }, [refreshFiles]);

  // Manually trigger sync
  const sync = useCallback(async () => {
    if (!navigator.onLine) {
      setState(prev => ({ ...prev, error: 'Cannot sync while offline' }));
      return;
    }

    try {
      const offline = await getOfflineModule();
      setState(prev => ({ ...prev, isSyncing: true, error: null }));

      const result = await offline.triggerSync();

      setState(prev => ({
        ...prev,
        isSyncing: false,
        pendingCount: result.remaining,
        lastSync: new Date().toISOString(),
      }));

      await refreshFiles();
    } catch (error) {
      console.error('Sync failed:', error);
      setState(prev => ({
        ...prev,
        isSyncing: false,
        error: 'Sync failed',
      }));
    }
  }, [refreshFiles]);

  // Get storage info
  const getStorageInfo = useCallback(async () => {
    const offline = await getOfflineModule();
    return offline.getStorageEstimate();
  }, []);

  return {
    ...state,
    isReady,
    captureFile,
    deleteFile,
    sync,
    refreshFiles,
    getStorageInfo,
  };
}

/**
 * Detect the device type based on user agent
 */
function getDeviceType(): DeviceType {
  if (typeof navigator === 'undefined') return 'Unknown';

  const ua = navigator.userAgent;

  if (/iPad/.test(ua)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac|Windows|Linux/.test(ua)) return 'Desktop';

  return 'Unknown';
}

/**
 * Hook for getting current location (for geotagging photos)
 */
export function useGeolocation() {
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
      },
      (error) => {
        setError(error.message);
        setLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0,
      }
    );
  }, []);

  return { location, error, loading, getLocation };
}

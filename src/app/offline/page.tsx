'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CloudOff, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Get pending upload count
    loadPendingCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  async function loadPendingCount() {
    try {
      const { getPendingUploadCount } = await import('@/lib/offline/indexed-db');
      const count = await getPendingUploadCount();
      setPendingCount(count);
    } catch (error) {
      console.error('Failed to load pending count:', error);
    }
  }

  function handleRetry() {
    if (isOnline) {
      window.location.href = '/';
    } else {
      // Just reload to check again
      window.location.reload();
    }
  }

  async function handleSync() {
    try {
      const { triggerSync } = await import('@/lib/offline/sync-manager');
      await triggerSync();
      await loadPendingCount();
    } catch (error) {
      console.error('Sync failed:', error);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="mx-auto h-24 w-24 rounded-full bg-gray-100 flex items-center justify-center">
          {isOnline ? (
            <RefreshCw className="h-12 w-12 text-green-600" />
          ) : (
            <WifiOff className="h-12 w-12 text-gray-400" />
          )}
        </div>

        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isOnline ? "You're back online!" : "You're offline"}
          </h1>
          <p className="mt-2 text-gray-600">
            {isOnline
              ? 'Click below to continue to AmiDash.'
              : "The page you're looking for isn't available offline."}
          </p>
        </div>

        {/* Pending uploads indicator */}
        {pendingCount > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-center gap-2 text-yellow-800">
              <CloudOff className="h-5 w-5" />
              <span className="font-medium">
                {pendingCount} file{pendingCount !== 1 ? 's' : ''} waiting to upload
              </span>
            </div>
            {isOnline && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleSync}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Sync Now
              </Button>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="space-y-3">
          <Button className="w-full" onClick={handleRetry}>
            {isOnline ? 'Go to AmiDash' : 'Try Again'}
          </Button>

          {!isOnline && (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => (window.location.href = '/projects')}
            >
              <Camera className="h-4 w-4 mr-2" />
              Capture Files Offline
            </Button>
          )}
        </div>

        {/* Status */}
        <p className="text-sm text-gray-500">
          Status:{' '}
          <span className={isOnline ? 'text-green-600' : 'text-red-600'}>
            {isOnline ? 'Connected' : 'No internet connection'}
          </span>
        </p>
      </div>
    </div>
  );
}

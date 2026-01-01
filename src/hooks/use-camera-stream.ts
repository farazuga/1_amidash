'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import {
  getCameraConstraints,
  mapMediaError,
  isGetUserMediaSupported,
  hasMultipleCameras,
  type CameraError,
  type FacingMode,
  type VideoResolution,
} from '@/lib/video-utils';

/**
 * Camera capabilities detected at runtime
 */
export interface CameraCapabilities {
  isSupported: boolean;
  canSwitchCamera: boolean;
}

/**
 * Options for the camera stream hook
 */
export interface UseCameraStreamOptions {
  resolution?: VideoResolution;
  facingMode?: FacingMode;
  includeAudio?: boolean;
  autoStart?: boolean;
}

/**
 * Return type for the camera stream hook
 */
export interface UseCameraStreamReturn {
  // State
  stream: MediaStream | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: CameraError | null;
  hasPermission: boolean | null;
  capabilities: CameraCapabilities;
  currentFacingMode: FacingMode;

  // Actions
  startStream: () => Promise<boolean>;
  stopStream: () => void;
  switchCamera: () => Promise<boolean>;

  // Refs
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Hook for managing getUserMedia camera stream
 * Optimized for iOS Safari with 720p capture
 */
export function useCameraStream(
  options: UseCameraStreamOptions = {}
): UseCameraStreamReturn {
  const {
    resolution = '720p',
    facingMode: initialFacingMode = 'environment',
    includeAudio = false,
    autoStart = false,
  } = options;

  // State
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<CameraError | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [currentFacingMode, setCurrentFacingMode] = useState<FacingMode>(initialFacingMode);
  const [capabilities, setCapabilities] = useState<CameraCapabilities>({
    isSupported: false,
    canSwitchCamera: false,
  });

  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Detect capabilities on mount
  useEffect(() => {
    const detectCapabilities = async () => {
      const isSupported = isGetUserMediaSupported();
      const canSwitchCamera = await hasMultipleCameras();

      setCapabilities({
        isSupported,
        canSwitchCamera,
      });
    };

    detectCapabilities();
  }, []);

  // Stop all tracks in a stream
  const stopAllTracks = useCallback((mediaStream: MediaStream | null) => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
    }
  }, []);

  // Start the camera stream
  const startStream = useCallback(async (): Promise<boolean> => {
    if (!capabilities.isSupported) {
      setError('not_supported');
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Stop existing stream first
      stopAllTracks(streamRef.current);

      const constraints = getCameraConstraints({
        resolution,
        facingMode: currentFacingMode,
        includeAudio,
      });

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

      // Store in ref for cleanup
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setHasPermission(true);

      // Attach to video element if available
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // iOS Safari requires these attributes
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current;
          if (!video) {
            resolve();
            return;
          }

          const handleLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('error', handleError);
            video.play().then(resolve).catch(reject);
          };

          const handleError = () => {
            video.removeEventListener('loadedmetadata', handleLoadedMetadata);
            video.removeEventListener('error', handleError);
            reject(new Error('Video failed to load'));
          };

          video.addEventListener('loadedmetadata', handleLoadedMetadata);
          video.addEventListener('error', handleError);
        });
      }

      setIsLoading(false);
      return true;
    } catch (err) {
      const cameraError = mapMediaError(err);
      setError(cameraError);
      setHasPermission(cameraError === 'permission_denied' ? false : null);
      setIsLoading(false);
      return false;
    }
  }, [capabilities.isSupported, currentFacingMode, includeAudio, resolution, stopAllTracks]);

  // Stop the camera stream
  const stopStream = useCallback(() => {
    stopAllTracks(streamRef.current);

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    streamRef.current = null;
    setStream(null);
  }, [stopAllTracks]);

  // Switch between front and back camera
  const switchCamera = useCallback(async (): Promise<boolean> => {
    if (!capabilities.canSwitchCamera) {
      return false;
    }

    const newFacingMode: FacingMode = currentFacingMode === 'user' ? 'environment' : 'user';
    setCurrentFacingMode(newFacingMode);

    // If currently streaming, restart with new facing mode
    if (stream) {
      stopStream();

      // Small delay to ensure proper cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));

      setIsLoading(true);
      setError(null);

      try {
        const constraints = getCameraConstraints({
          resolution,
          facingMode: newFacingMode,
          includeAudio,
        });

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);

        streamRef.current = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }

        setIsLoading(false);
        return true;
      } catch (err) {
        const cameraError = mapMediaError(err);
        setError(cameraError);
        setIsLoading(false);
        return false;
      }
    }

    return true;
  }, [capabilities.canSwitchCamera, currentFacingMode, includeAudio, resolution, stopStream, stream]);

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && capabilities.isSupported && !stream && !isLoading) {
      startStream();
    }
  }, [autoStart, capabilities.isSupported, isLoading, startStream, stream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllTracks(streamRef.current);
    };
  }, [stopAllTracks]);

  // Handle visibility change (app backgrounding on iOS)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && streamRef.current) {
        // Pause tracks when app goes to background
        streamRef.current.getTracks().forEach((track) => {
          track.enabled = false;
        });
      } else if (document.visibilityState === 'visible' && streamRef.current) {
        // Resume tracks when app comes back
        streamRef.current.getTracks().forEach((track) => {
          track.enabled = true;
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return {
    // State
    stream,
    isLoading,
    isStreaming: !!stream,
    error,
    hasPermission,
    capabilities,
    currentFacingMode,

    // Actions
    startStream,
    stopStream,
    switchCamera,

    // Refs
    videoRef,
  };
}

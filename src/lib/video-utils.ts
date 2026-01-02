/**
 * Video capture utilities for getUserMedia + MediaRecorder
 * Optimized for iOS Safari with 720p capture
 */

// Supported MIME types in order of preference
const MIME_TYPE_PRIORITY = [
  'video/mp4',              // iOS Safari preferred
  'video/webm;codecs=vp9',  // Chrome preferred
  'video/webm;codecs=vp8',  // Firefox fallback
  'video/webm',             // Generic webm
];

// Default video bitrate for 720p
const DEFAULT_VIDEO_BITRATE = 2_500_000; // 2.5 Mbps

/**
 * Camera facing mode
 */
export type FacingMode = 'user' | 'environment';

/**
 * Video resolution preset
 */
export type VideoResolution = '720p' | '480p';

/**
 * Camera error types
 */
export type CameraError =
  | 'permission_denied'
  | 'not_found'
  | 'not_supported'
  | 'in_use'
  | 'unknown';

/**
 * Check if MediaRecorder API is supported
 */
export function isMediaRecorderSupported(): boolean {
  return typeof MediaRecorder !== 'undefined';
}

/**
 * Check if getUserMedia API is supported
 */
export function isGetUserMediaSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'mediaDevices' in navigator &&
    'getUserMedia' in navigator.mediaDevices
  );
}

/**
 * Get the best supported MIME type for video recording
 * Returns null if no supported type found
 */
export function getSupportedMimeType(): string | null {
  if (!isMediaRecorderSupported()) {
    return null;
  }

  for (const mimeType of MIME_TYPE_PRIORITY) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

/**
 * Get video constraints for a given resolution
 * Optimized for iOS Safari's 720p limit
 */
export function getVideoConstraints(
  resolution: VideoResolution = '720p',
  facingMode: FacingMode = 'environment'
): MediaTrackConstraints {
  const resolutionMap: Record<VideoResolution, { width: number; height: number }> = {
    '720p': { width: 1280, height: 720 },
    '480p': { width: 854, height: 480 },
  };

  const { width, height } = resolutionMap[resolution];

  return {
    width: { ideal: width, max: width },
    height: { ideal: height, max: height },
    facingMode: { ideal: facingMode },
  };
}

/**
 * Get full getUserMedia constraints for camera access
 */
export function getCameraConstraints(options: {
  resolution?: VideoResolution;
  facingMode?: FacingMode;
  includeAudio?: boolean;
} = {}): MediaStreamConstraints {
  const { resolution = '720p', facingMode = 'environment', includeAudio = false } = options;

  return {
    video: getVideoConstraints(resolution, facingMode),
    audio: includeAudio,
  };
}

/**
 * Map DOM exception to user-friendly error type
 */
export function mapMediaError(error: unknown): CameraError {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        return 'permission_denied';
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        return 'not_found';
      case 'NotSupportedError':
      case 'NotReadableError':
        return 'not_supported';
      case 'AbortError':
      case 'OverconstrainedError':
        return 'in_use';
      default:
        return 'unknown';
    }
  }
  return 'unknown';
}

/**
 * Get user-friendly error message
 */
export function getErrorMessage(error: CameraError): string {
  const messages: Record<CameraError, string> = {
    permission_denied: 'Camera access denied. Please enable camera permissions in your browser settings.',
    not_found: 'No camera found on this device.',
    not_supported: 'Camera is not supported on this browser.',
    in_use: 'Camera is currently in use by another application.',
    unknown: 'An unexpected error occurred. Please try again.',
  };
  return messages[error];
}

/**
 * Capture a photo from a video stream using Canvas
 * Uses standard Canvas API (NOT OffscreenCanvas) for iOS Safari compatibility
 */
export async function capturePhotoFromStream(
  videoElement: HTMLVideoElement,
  options: {
    quality?: number;
    format?: 'jpeg' | 'png';
  } = {}
): Promise<Blob> {
  const { quality = 0.8, format = 'jpeg' } = options;

  // Ensure video is ready
  if (videoElement.readyState < 2) {
    throw new Error('Video is not ready for capture');
  }

  // Create canvas matching video dimensions
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Draw current video frame
  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to create image blob'));
        }
      },
      `image/${format}`,
      quality
    );
  });
}

/**
 * Create a MediaRecorder for video capture
 */
export function createVideoRecorder(
  stream: MediaStream,
  options: {
    mimeType?: string;
    videoBitsPerSecond?: number;
  } = {}
): MediaRecorder {
  const mimeType = options.mimeType ?? getSupportedMimeType();

  if (!mimeType) {
    throw new Error('No supported video MIME type found');
  }

  const recorderOptions: MediaRecorderOptions = {
    mimeType,
    videoBitsPerSecond: options.videoBitsPerSecond ?? DEFAULT_VIDEO_BITRATE,
  };

  return new MediaRecorder(stream, recorderOptions);
}

/**
 * Stop recording and get the video blob
 * Returns a promise that resolves when recording is complete
 */
export function stopRecordingAndGetBlob(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // Check state first
    if (recorder.state !== 'recording') {
      reject(new Error('Recorder is not recording'));
      return;
    }

    const chunks: Blob[] = [];

    const cleanup = () => {
      recorder.removeEventListener('dataavailable', handleDataAvailable);
      recorder.removeEventListener('stop', handleStop);
      recorder.removeEventListener('error', handleError);
    };

    const handleDataAvailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const handleStop = () => {
      cleanup();

      if (chunks.length === 0) {
        reject(new Error('No video data recorded'));
        return;
      }

      const blob = new Blob(chunks, { type: recorder.mimeType });
      resolve(blob);
    };

    const handleError = () => {
      cleanup();
      reject(new Error('Recording failed'));
    };

    // Add listeners BEFORE stopping
    recorder.addEventListener('dataavailable', handleDataAvailable);
    recorder.addEventListener('stop', handleStop);
    recorder.addEventListener('error', handleError);

    // Just call stop() - it will trigger dataavailable with all data
    recorder.stop();
  });
}

/**
 * Create a File object from a Blob
 */
export function createFileFromBlob(
  blob: Blob,
  filename?: string,
  type?: 'photo' | 'video'
): File {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = blob.type.includes('mp4') ? 'mp4' :
                   blob.type.includes('webm') ? 'webm' :
                   blob.type.includes('png') ? 'png' : 'jpg';

  const defaultName = type === 'video'
    ? `video-${timestamp}.${extension}`
    : `photo-${timestamp}.${extension}`;

  return new File([blob], filename ?? defaultName, {
    type: blob.type,
    lastModified: Date.now(),
  });
}

/**
 * Format recording duration as MM:SS
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Check if device has multiple cameras
 */
export async function hasMultipleCameras(): Promise<boolean> {
  if (!isGetUserMediaSupported()) {
    return false;
  }

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoInputs = devices.filter((device) => device.kind === 'videoinput');
    return videoInputs.length > 1;
  } catch {
    return false;
  }
}

/**
 * Get file extension from MIME type
 */
export function getExtensionFromMimeType(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('webm')) return 'webm';
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return 'bin';
}

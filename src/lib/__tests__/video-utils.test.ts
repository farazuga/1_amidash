import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  isMediaRecorderSupported,
  isGetUserMediaSupported,
  getSupportedMimeType,
  getVideoConstraints,
  getCameraConstraints,
  mapMediaError,
  getErrorMessage,
  capturePhotoFromStream,
  createFileFromBlob,
  formatDuration,
  getExtensionFromMimeType,
} from '../video-utils';
import { createMockVideoElement } from '@/test/mocks/media-devices';

describe('video-utils', () => {
  describe('isMediaRecorderSupported', () => {
    it('returns true when MediaRecorder exists', () => {
      expect(isMediaRecorderSupported()).toBe(true);
    });
  });

  describe('isGetUserMediaSupported', () => {
    it('returns true when mediaDevices.getUserMedia exists', () => {
      expect(isGetUserMediaSupported()).toBe(true);
    });
  });

  describe('getSupportedMimeType', () => {
    it('returns a supported MIME type', () => {
      const result = getSupportedMimeType();
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('returns null when no types are supported', () => {
      const originalIsTypeSupported = MediaRecorder.isTypeSupported;
      (MediaRecorder.isTypeSupported as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(false);

      const result = getSupportedMimeType();
      expect(result).toBeNull();

      MediaRecorder.isTypeSupported = originalIsTypeSupported;
    });
  });

  describe('getVideoConstraints', () => {
    it('returns 720p constraints by default', () => {
      const constraints = getVideoConstraints();

      expect(constraints.width).toEqual({ ideal: 1280, max: 1280 });
      expect(constraints.height).toEqual({ ideal: 720, max: 720 });
      expect(constraints.facingMode).toEqual({ ideal: 'environment' });
    });

    it('returns 480p constraints when specified', () => {
      const constraints = getVideoConstraints('480p');

      expect(constraints.width).toEqual({ ideal: 854, max: 854 });
      expect(constraints.height).toEqual({ ideal: 480, max: 480 });
    });

    it('respects facingMode parameter', () => {
      const constraints = getVideoConstraints('720p', 'user');

      expect(constraints.facingMode).toEqual({ ideal: 'user' });
    });
  });

  describe('getCameraConstraints', () => {
    it('returns constraints with video and no audio by default', () => {
      const constraints = getCameraConstraints();

      expect(constraints.video).toBeDefined();
      expect(constraints.audio).toBe(false);
    });

    it('includes audio when specified', () => {
      const constraints = getCameraConstraints({ includeAudio: true });

      expect(constraints.audio).toBe(true);
    });

    it('uses specified resolution and facingMode', () => {
      const constraints = getCameraConstraints({
        resolution: '480p',
        facingMode: 'user',
      });

      expect(constraints.video).toEqual({
        width: { ideal: 854, max: 854 },
        height: { ideal: 480, max: 480 },
        facingMode: { ideal: 'user' },
      });
    });
  });

  describe('mapMediaError', () => {
    it('maps NotAllowedError to permission_denied', () => {
      const error = new DOMException('Permission denied', 'NotAllowedError');
      expect(mapMediaError(error)).toBe('permission_denied');
    });

    it('maps NotFoundError to not_found', () => {
      const error = new DOMException('Device not found', 'NotFoundError');
      expect(mapMediaError(error)).toBe('not_found');
    });

    it('maps NotSupportedError to not_supported', () => {
      const error = new DOMException('Not supported', 'NotSupportedError');
      expect(mapMediaError(error)).toBe('not_supported');
    });

    it('maps AbortError to in_use', () => {
      const error = new DOMException('Aborted', 'AbortError');
      expect(mapMediaError(error)).toBe('in_use');
    });

    it('returns unknown for other errors', () => {
      const error = new Error('Random error');
      expect(mapMediaError(error)).toBe('unknown');
    });
  });

  describe('getErrorMessage', () => {
    it('returns appropriate message for each error type', () => {
      expect(getErrorMessage('permission_denied')).toContain('Camera access denied');
      expect(getErrorMessage('not_found')).toContain('No camera found');
      expect(getErrorMessage('not_supported')).toContain('not supported');
      expect(getErrorMessage('in_use')).toContain('in use');
      expect(getErrorMessage('unknown')).toContain('unexpected error');
    });
  });

  describe('capturePhotoFromStream', () => {
    it('captures photo from video element', async () => {
      // Create mock video element
      const mockVideo = createMockVideoElement({
        videoWidth: 1280,
        videoHeight: 720,
        readyState: 4,
      });

      // Mock canvas and context
      const mockCanvas = {
        width: 0,
        height: 0,
        getContext: vi.fn().mockReturnValue({
          drawImage: vi.fn(),
        }),
        toBlob: vi.fn().mockImplementation((callback) => {
          callback(new Blob(['test'], { type: 'image/jpeg' }));
        }),
      };

      const originalCreateElement = document.createElement;
      document.createElement = vi.fn().mockImplementation((tag) => {
        if (tag === 'canvas') return mockCanvas;
        return originalCreateElement.call(document, tag);
      });

      const blob = await capturePhotoFromStream(mockVideo);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('image/jpeg');

      document.createElement = originalCreateElement;
    });

    it('throws when video is not ready', async () => {
      const mockVideo = createMockVideoElement({ readyState: 1 });

      await expect(capturePhotoFromStream(mockVideo)).rejects.toThrow(
        'Video is not ready for capture'
      );
    });
  });

  describe('createFileFromBlob', () => {
    it('creates a File from Blob with auto-generated name', () => {
      const blob = new Blob(['test'], { type: 'image/jpeg' });
      const file = createFileFromBlob(blob);

      expect(file).toBeInstanceOf(File);
      expect(file.name).toMatch(/photo-\d{4}-\d{2}-\d{2}T.*\.jpg/);
      expect(file.type).toBe('image/jpeg');
    });

    it('uses provided filename', () => {
      const blob = new Blob(['test'], { type: 'video/mp4' });
      const file = createFileFromBlob(blob, 'my-video.mp4');

      expect(file.name).toBe('my-video.mp4');
    });

    it('generates video filename when type is video', () => {
      const blob = new Blob(['test'], { type: 'video/mp4' });
      const file = createFileFromBlob(blob, undefined, 'video');

      expect(file.name).toMatch(/video-\d{4}-\d{2}-\d{2}T.*\.mp4/);
    });
  });

  describe('formatDuration', () => {
    it('formats seconds as MM:SS', () => {
      expect(formatDuration(0)).toBe('00:00');
      expect(formatDuration(5)).toBe('00:05');
      expect(formatDuration(65)).toBe('01:05');
      expect(formatDuration(3661)).toBe('61:01');
    });

    it('handles fractional seconds', () => {
      expect(formatDuration(5.7)).toBe('00:05');
    });
  });

  describe('getExtensionFromMimeType', () => {
    it('returns correct extension for common types', () => {
      expect(getExtensionFromMimeType('video/mp4')).toBe('mp4');
      expect(getExtensionFromMimeType('video/webm')).toBe('webm');
      expect(getExtensionFromMimeType('image/png')).toBe('png');
      expect(getExtensionFromMimeType('image/jpeg')).toBe('jpg');
    });

    it('returns bin for unknown types', () => {
      expect(getExtensionFromMimeType('application/octet-stream')).toBe('bin');
    });
  });
});

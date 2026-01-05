import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCameraStream } from '../use-camera-stream';
import {
  createMockMediaStream,
  createMockMediaDevices,
  createPermissionDeniedError,
  createCameraNotFoundError,
} from '@/test/mocks/media-devices';

describe('useCameraStream', () => {
  let mockMediaDevices: MediaDevices;

  beforeEach(() => {
    // Setup fresh mocks for each test
    mockMediaDevices = createMockMediaDevices();
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      configurable: true,
      value: mockMediaDevices,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('starts with null stream and no error', () => {
      const { result } = renderHook(() => useCameraStream());

      expect(result.current.stream).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isStreaming).toBe(false);
    });

    it('detects camera capabilities', async () => {
      const { result } = renderHook(() => useCameraStream());

      // isSupported is detected immediately
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      // canSwitchCamera is only detected after stream starts (to avoid permission prompts)
      expect(result.current.capabilities.canSwitchCamera).toBe(false);

      // Start stream to trigger camera detection
      await act(async () => {
        await result.current.startStream();
      });

      expect(result.current.capabilities.canSwitchCamera).toBe(true);
    });

    it('uses default 720p resolution and environment facing mode', () => {
      const { result } = renderHook(() => useCameraStream());

      expect(result.current.currentFacingMode).toBe('environment');
    });

    it('accepts custom options', () => {
      const { result } = renderHook(() =>
        useCameraStream({
          resolution: '480p',
          facingMode: 'user',
        })
      );

      expect(result.current.currentFacingMode).toBe('user');
    });
  });

  describe('startStream', () => {
    it('requests camera with correct constraints', async () => {
      const { result } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startStream();
      });

      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: {
          width: { ideal: 1280, max: 1280 },
          height: { ideal: 720, max: 720 },
          facingMode: { ideal: 'environment' },
        },
        audio: false,
      });
    });

    it('sets stream on success', async () => {
      const { result } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      await act(async () => {
        const success = await result.current.startStream();
        expect(success).toBe(true);
      });

      expect(result.current.stream).not.toBeNull();
      expect(result.current.isStreaming).toBe(true);
      expect(result.current.hasPermission).toBe(true);
    });

    it('handles permission denied error', async () => {
      const mockDevices = createMockMediaDevices({
        getUserMedia: vi.fn().mockRejectedValue(createPermissionDeniedError()),
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: mockDevices,
      });

      const { result } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      await act(async () => {
        const success = await result.current.startStream();
        expect(success).toBe(false);
      });

      expect(result.current.error).toBe('permission_denied');
      expect(result.current.hasPermission).toBe(false);
      expect(result.current.stream).toBeNull();
    });

    it('handles camera not found error', async () => {
      const mockDevices = createMockMediaDevices({
        getUserMedia: vi.fn().mockRejectedValue(createCameraNotFoundError()),
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: mockDevices,
      });

      const { result } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      await act(async () => {
        const success = await result.current.startStream();
        expect(success).toBe(false);
      });

      expect(result.current.error).toBe('not_found');
    });

    it('sets isLoading during stream acquisition', async () => {
      // Create a delayed mock
      const mockDevices = createMockMediaDevices({
        getUserMedia: vi.fn().mockImplementation(
          () =>
            new Promise((resolve) => {
              setTimeout(() => resolve(createMockMediaStream()), 50);
            })
        ),
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: mockDevices,
      });

      const { result } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      // Start without awaiting
      act(() => {
        result.current.startStream();
      });

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('stopStream', () => {
    it('stops all tracks on stream', async () => {
      const mockStream = createMockMediaStream();
      const mockDevices = createMockMediaDevices({
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: mockDevices,
      });

      const { result } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startStream();
      });

      expect(result.current.isStreaming).toBe(true);

      act(() => {
        result.current.stopStream();
      });

      expect(result.current.stream).toBeNull();
      expect(result.current.isStreaming).toBe(false);

      // Verify tracks were stopped
      const tracks = mockStream.getTracks();
      tracks.forEach((track) => {
        expect(track.stop).toHaveBeenCalled();
      });
    });
  });

  describe('switchCamera', () => {
    it('toggles between front and back camera', async () => {
      const { result } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      // Start stream first (canSwitchCamera is only available after stream starts)
      await act(async () => {
        await result.current.startStream();
      });

      expect(result.current.currentFacingMode).toBe('environment');
      expect(result.current.capabilities.canSwitchCamera).toBe(true);

      await act(async () => {
        await result.current.switchCamera();
      });

      expect(result.current.currentFacingMode).toBe('user');

      await act(async () => {
        await result.current.switchCamera();
      });

      expect(result.current.currentFacingMode).toBe('environment');
    });

    it('restarts stream with new facing mode when streaming', async () => {
      const { result } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startStream();
      });

      expect(result.current.isStreaming).toBe(true);

      await act(async () => {
        await result.current.switchCamera();
      });

      // Should have called getUserMedia twice (initial + switch)
      expect(mockMediaDevices.getUserMedia).toHaveBeenCalledTimes(2);

      // Second call should use 'user' facing mode
      expect(mockMediaDevices.getUserMedia).toHaveBeenLastCalledWith(
        expect.objectContaining({
          video: expect.objectContaining({
            facingMode: { ideal: 'user' },
          }),
        })
      );
    });

    it('returns false when device has single camera', async () => {
      const mockDevices = createMockMediaDevices({
        enumerateDevices: vi.fn().mockResolvedValue([
          {
            deviceId: 'camera',
            groupId: 'group',
            kind: 'videoinput',
            label: 'Camera',
            toJSON: () => ({}),
          },
        ]),
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: mockDevices,
      });

      const { result } = renderHook(() => useCameraStream());

      await waitFor(() => {
        expect(result.current.capabilities.canSwitchCamera).toBe(false);
      });

      await act(async () => {
        const success = await result.current.switchCamera();
        expect(success).toBe(false);
      });
    });
  });

  describe('cleanup', () => {
    it('stops stream on unmount', async () => {
      const mockStream = createMockMediaStream();
      const mockDevices = createMockMediaDevices({
        getUserMedia: vi.fn().mockResolvedValue(mockStream),
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        writable: true,
        configurable: true,
        value: mockDevices,
      });

      const { result, unmount } = renderHook(() => useCameraStream());

      // Wait for capability detection
      await waitFor(() => {
        expect(result.current.capabilities.isSupported).toBe(true);
      });

      await act(async () => {
        await result.current.startStream();
      });

      unmount();

      // Verify tracks were stopped
      const tracks = mockStream.getTracks();
      tracks.forEach((track) => {
        expect(track.stop).toHaveBeenCalled();
      });
    });
  });

  describe('videoRef', () => {
    it('provides a ref for video element', () => {
      const { result } = renderHook(() => useCameraStream());

      expect(result.current.videoRef).toBeDefined();
      expect(result.current.videoRef.current).toBeNull();
    });
  });
});

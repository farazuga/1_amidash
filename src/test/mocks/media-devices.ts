/**
 * Mock factories for browser media device APIs
 * Used in unit tests for camera and video utilities
 */

import { vi } from 'vitest';

/**
 * Create a mock MediaStream
 */
export function createMockMediaStream(options: {
  videoWidth?: number;
  videoHeight?: number;
  facingMode?: 'user' | 'environment';
} = {}): MediaStream {
  const { videoWidth = 1280, videoHeight = 720, facingMode = 'environment' } = options;

  const mockVideoTrack = {
    kind: 'video' as const,
    id: 'mock-video-track-id',
    label: facingMode === 'user' ? 'Front Camera' : 'Back Camera',
    enabled: true,
    muted: false,
    readyState: 'live' as const,
    stop: vi.fn(),
    clone: vi.fn(),
    getSettings: vi.fn().mockReturnValue({
      width: videoWidth,
      height: videoHeight,
      facingMode,
      deviceId: 'mock-device-id',
    }),
    getCapabilities: vi.fn().mockReturnValue({
      width: { min: 320, max: 1920 },
      height: { min: 240, max: 1080 },
      facingMode: ['user', 'environment'],
    }),
    getConstraints: vi.fn().mockReturnValue({}),
    applyConstraints: vi.fn().mockResolvedValue(undefined),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onended: null,
    onmute: null,
    onunmute: null,
  };

  const stream = {
    id: 'mock-stream-id',
    active: true,
    getTracks: vi.fn().mockReturnValue([mockVideoTrack]),
    getVideoTracks: vi.fn().mockReturnValue([mockVideoTrack]),
    getAudioTracks: vi.fn().mockReturnValue([]),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    clone: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onaddtrack: null,
    onremovetrack: null,
  } as unknown as MediaStream;

  return stream;
}

/**
 * Create a mock MediaDevices object
 */
export function createMockMediaDevices(overrides: {
  getUserMedia?: ReturnType<typeof vi.fn>;
  enumerateDevices?: ReturnType<typeof vi.fn>;
} = {}): MediaDevices {
  const defaultDevices: MediaDeviceInfo[] = [
    {
      deviceId: 'back-camera',
      groupId: 'camera-group',
      kind: 'videoinput',
      label: 'Back Camera',
      toJSON: () => ({}),
    },
    {
      deviceId: 'front-camera',
      groupId: 'camera-group',
      kind: 'videoinput',
      label: 'Front Camera',
      toJSON: () => ({}),
    },
  ];

  return {
    getUserMedia: overrides.getUserMedia ?? vi.fn().mockResolvedValue(createMockMediaStream()),
    enumerateDevices: overrides.enumerateDevices ?? vi.fn().mockResolvedValue(defaultDevices),
    getSupportedConstraints: vi.fn().mockReturnValue({
      width: true,
      height: true,
      facingMode: true,
      deviceId: true,
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    ondevicechange: null,
  } as unknown as MediaDevices;
}

/**
 * Create a mock MediaRecorder
 */
export function createMockMediaRecorder(stream?: MediaStream) {
  type MockRecorder = {
    stream: MediaStream;
    mimeType: string;
    state: RecordingState;
    videoBitsPerSecond: number;
    audioBitsPerSecond: number;
    ondataavailable: ((event: BlobEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onstart: (() => void) | null;
    onstop: (() => void) | null;
    onpause: (() => void) | null;
    onresume: (() => void) | null;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    pause: ReturnType<typeof vi.fn>;
    resume: ReturnType<typeof vi.fn>;
    requestData: ReturnType<typeof vi.fn>;
    addEventListener: ReturnType<typeof vi.fn>;
    removeEventListener: ReturnType<typeof vi.fn>;
    dispatchEvent: ReturnType<typeof vi.fn>;
  };

  const recorder: MockRecorder = {
    stream: stream ?? createMockMediaStream(),
    mimeType: 'video/mp4',
    state: 'inactive',
    videoBitsPerSecond: 2500000,
    audioBitsPerSecond: 0,

    // Event handlers
    ondataavailable: null,
    onerror: null,
    onstart: null,
    onstop: null,
    onpause: null,
    onresume: null,

    start: vi.fn().mockImplementation(function (this: MockRecorder) {
      this.state = 'recording';
      this.onstart?.();
    }),

    stop: vi.fn().mockImplementation(function (this: MockRecorder) {
      this.state = 'inactive';
      // Simulate data available
      const mockBlob = new Blob(['mock video data'], { type: 'video/mp4' });
      this.ondataavailable?.({ data: mockBlob } as BlobEvent);
      this.onstop?.();
    }),

    pause: vi.fn().mockImplementation(function (this: MockRecorder) {
      this.state = 'paused';
      this.onpause?.();
    }),

    resume: vi.fn().mockImplementation(function (this: MockRecorder) {
      this.state = 'recording';
      this.onresume?.();
    }),

    requestData: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };

  return recorder as unknown as MediaRecorder;
}

/**
 * Mock MediaRecorder class constructor
 */
export function createMockMediaRecorderClass() {
  const MockMediaRecorder = vi.fn().mockImplementation((stream: MediaStream) => {
    return createMockMediaRecorder(stream);
  }) as unknown as {
    new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
    isTypeSupported: (mimeType: string) => boolean;
  } & ReturnType<typeof vi.fn>;

  // Static methods
  MockMediaRecorder.isTypeSupported = vi.fn().mockImplementation((mimeType: string) => {
    // iOS Safari supports mp4, Chrome supports webm
    return ['video/mp4', 'video/webm', 'video/webm;codecs=vp9'].includes(mimeType);
  });

  return MockMediaRecorder;
}

/**
 * Create a mock HTMLVideoElement for testing
 */
export function createMockVideoElement(options: {
  videoWidth?: number;
  videoHeight?: number;
  readyState?: number;
} = {}): HTMLVideoElement {
  const { videoWidth = 1280, videoHeight = 720, readyState = 4 } = options;

  return {
    videoWidth,
    videoHeight,
    readyState,
    paused: false,
    ended: false,
    muted: true,
    volume: 1,
    currentTime: 0,
    duration: 0,
    autoplay: false,
    loop: false,
    controls: false,
    srcObject: null,
    src: '',

    play: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    load: vi.fn(),

    setAttribute: vi.fn(),
    getAttribute: vi.fn(),
    removeAttribute: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  } as unknown as HTMLVideoElement;
}

/**
 * Setup global media device mocks for tests
 */
export function setupMediaDeviceMocks(options: {
  getUserMedia?: ReturnType<typeof vi.fn>;
  enumerateDevices?: ReturnType<typeof vi.fn>;
} = {}) {
  const mockMediaDevices = createMockMediaDevices(options);

  Object.defineProperty(navigator, 'mediaDevices', {
    writable: true,
    configurable: true,
    value: mockMediaDevices,
  });

  // Mock MediaRecorder class
  const MockMediaRecorder = createMockMediaRecorderClass();
  (global as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

  return {
    mediaDevices: mockMediaDevices,
    MediaRecorder: MockMediaRecorder,
  };
}

/**
 * Create permission denied error
 */
export function createPermissionDeniedError(): DOMException {
  return new DOMException('Permission denied', 'NotAllowedError');
}

/**
 * Create camera not found error
 */
export function createCameraNotFoundError(): DOMException {
  return new DOMException('Requested device not found', 'NotFoundError');
}

/**
 * Create camera in use error
 */
export function createCameraInUseError(): DOMException {
  return new DOMException('Could not start video source', 'AbortError');
}

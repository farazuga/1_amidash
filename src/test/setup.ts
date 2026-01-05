import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock navigator.mediaDevices
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  configurable: true,
  value: {
    getUserMedia: vi.fn().mockRejectedValue(new Error('Not mocked for this test')),
    enumerateDevices: vi.fn().mockResolvedValue([]),
    getSupportedConstraints: vi.fn().mockReturnValue({
      width: true,
      height: true,
      facingMode: true,
    }),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});

// Mock MediaRecorder
const MockMediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
  onerror: null,
})) as unknown as {
  new (stream: MediaStream, options?: MediaRecorderOptions): MediaRecorder;
  isTypeSupported: (mimeType: string) => boolean;
};
MockMediaRecorder.isTypeSupported = vi.fn().mockReturnValue(true) as unknown as (mimeType: string) => boolean;
(global as Record<string, unknown>).MediaRecorder = MockMediaRecorder;

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
global.URL.revokeObjectURL = vi.fn();

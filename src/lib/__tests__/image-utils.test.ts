import { describe, it, expect } from 'vitest';
import { isImageFile, isVideoFile, estimateCompressedSize } from '../image-utils';

// ---------------------------------------------------------------------------
// Helpers – create lightweight File objects without touching the DOM
// ---------------------------------------------------------------------------

function makeFile(name: string, type: string, sizeBytes: number = 0): File {
  // File constructor accepts an array of BlobParts. A single Uint8Array of
  // the required byte-length gives us a file with the right .size property
  // without allocating a large buffer in the test process.
  const content = new Uint8Array(sizeBytes);
  return new File([content], name, { type });
}

// ---------------------------------------------------------------------------
// isImageFile
// ---------------------------------------------------------------------------

describe('isImageFile', () => {
  it('returns true for image/jpeg', () => {
    const file = makeFile('photo.jpg', 'image/jpeg');
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for image/png', () => {
    const file = makeFile('screenshot.png', 'image/png');
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for image/webp', () => {
    const file = makeFile('image.webp', 'image/webp');
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for image/gif', () => {
    const file = makeFile('anim.gif', 'image/gif');
    expect(isImageFile(file)).toBe(true);
  });

  it('returns true for image/svg+xml', () => {
    const file = makeFile('icon.svg', 'image/svg+xml');
    expect(isImageFile(file)).toBe(true);
  });

  it('returns false for video/mp4', () => {
    const file = makeFile('video.mp4', 'video/mp4');
    expect(isImageFile(file)).toBe(false);
  });

  it('returns false for text/plain', () => {
    const file = makeFile('readme.txt', 'text/plain');
    expect(isImageFile(file)).toBe(false);
  });

  it('returns false for application/pdf', () => {
    const file = makeFile('doc.pdf', 'application/pdf');
    expect(isImageFile(file)).toBe(false);
  });

  it('returns false for an empty MIME type', () => {
    const file = makeFile('noext', '');
    expect(isImageFile(file)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isVideoFile
// ---------------------------------------------------------------------------

describe('isVideoFile', () => {
  it('returns true for video/mp4', () => {
    const file = makeFile('clip.mp4', 'video/mp4');
    expect(isVideoFile(file)).toBe(true);
  });

  it('returns true for video/webm', () => {
    const file = makeFile('clip.webm', 'video/webm');
    expect(isVideoFile(file)).toBe(true);
  });

  it('returns true for video/quicktime', () => {
    const file = makeFile('clip.mov', 'video/quicktime');
    expect(isVideoFile(file)).toBe(true);
  });

  it('returns true for video/ogg', () => {
    const file = makeFile('clip.ogv', 'video/ogg');
    expect(isVideoFile(file)).toBe(true);
  });

  it('returns false for image/jpeg', () => {
    const file = makeFile('photo.jpg', 'image/jpeg');
    expect(isVideoFile(file)).toBe(false);
  });

  it('returns false for audio/mpeg', () => {
    const file = makeFile('track.mp3', 'audio/mpeg');
    expect(isVideoFile(file)).toBe(false);
  });

  it('returns false for text/plain', () => {
    const file = makeFile('readme.txt', 'text/plain');
    expect(isVideoFile(file)).toBe(false);
  });

  it('returns false for an empty MIME type', () => {
    const file = makeFile('noext', '');
    expect(isVideoFile(file)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// estimateCompressedSize
// ---------------------------------------------------------------------------

describe('estimateCompressedSize', () => {
  // ---- Non-image files ----

  it('returns the original size for a video file', () => {
    const bytes = 2 * 1024 * 1024; // 2 MB
    const file = makeFile('clip.mp4', 'video/mp4', bytes);
    expect(estimateCompressedSize(file)).toBe(bytes);
  });

  it('returns the original size for a text file', () => {
    const bytes = 10_000;
    const file = makeFile('readme.txt', 'text/plain', bytes);
    expect(estimateCompressedSize(file)).toBe(bytes);
  });

  it('returns the original size for an application/pdf file', () => {
    const bytes = 1 * 1024 * 1024; // 1 MB
    const file = makeFile('report.pdf', 'application/pdf', bytes);
    expect(estimateCompressedSize(file)).toBe(bytes);
  });

  // ---- Small image files (under 500 KB) ----

  it('returns the original size for a small image (1 KB)', () => {
    const bytes = 1024;
    const file = makeFile('tiny.jpg', 'image/jpeg', bytes);
    expect(estimateCompressedSize(file)).toBe(bytes);
  });

  it('returns the original size for an image exactly at the 500 KB boundary minus 1 byte', () => {
    const bytes = 500 * 1024 - 1;
    const file = makeFile('near-limit.jpg', 'image/jpeg', bytes);
    expect(estimateCompressedSize(file)).toBe(bytes);
  });

  it('returns the original size for an image of exactly 499 KB', () => {
    const bytes = 499 * 1024;
    const file = makeFile('medium.png', 'image/png', bytes);
    expect(estimateCompressedSize(file)).toBe(bytes);
  });

  // ---- Large image files (500 KB or more) ----

  it('returns ~15% of original size for a large jpeg', () => {
    const bytes = 4 * 1024 * 1024; // 4 MB
    const file = makeFile('large-photo.jpg', 'image/jpeg', bytes);
    const estimated = estimateCompressedSize(file);
    expect(estimated).toBe(Math.round(bytes * 0.15));
  });

  it('returns ~15% of original size for a large png', () => {
    const bytes = 2 * 1024 * 1024; // 2 MB
    const file = makeFile('screenshot.png', 'image/png', bytes);
    const estimated = estimateCompressedSize(file);
    expect(estimated).toBe(Math.round(bytes * 0.15));
  });

  it('returns ~15% of original size for a large webp', () => {
    const bytes = 1 * 1024 * 1024; // 1 MB
    const file = makeFile('banner.webp', 'image/webp', bytes);
    const estimated = estimateCompressedSize(file);
    expect(estimated).toBe(Math.round(bytes * 0.15));
  });

  it('returns ~15% of original size for an image exactly at the 500 KB threshold', () => {
    const bytes = 500 * 1024;
    const file = makeFile('exact.jpg', 'image/jpeg', bytes);
    const estimated = estimateCompressedSize(file);
    expect(estimated).toBe(Math.round(bytes * 0.15));
  });

  it('compressed estimate is always less than original for large images', () => {
    const bytes = 3 * 1024 * 1024;
    const file = makeFile('photo.jpg', 'image/jpeg', bytes);
    const estimated = estimateCompressedSize(file);
    expect(estimated).toBeLessThan(bytes);
  });

  it('ignores CompressionOptions parameter (function signature accepts it)', () => {
    const bytes = 4 * 1024 * 1024;
    const file = makeFile('photo.jpg', 'image/jpeg', bytes);
    const withOptions = estimateCompressedSize(file, { quality: 0.5, format: 'webp' });
    const withoutOptions = estimateCompressedSize(file);
    // The current implementation does not use the options, so results are equal
    expect(withOptions).toBe(withoutOptions);
  });
});

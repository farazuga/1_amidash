/**
 * Image compression utilities for reducing file size before upload
 * Uses Canvas API for browser-native compression without dependencies
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'webp';
}

const DEFAULT_OPTIONS: Required<CompressionOptions> = {
  maxWidth: 1920,
  maxHeight: 1440,
  quality: 0.8,
  format: 'jpeg',
};

/**
 * Compress an image file to reduce size
 * Uses standard Canvas API for iOS Safari compatibility (OffscreenCanvas not supported)
 *
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns A new compressed File object
 *
 * @example
 * const compressed = await compressImage(originalFile);
 * // Original: 4MB -> Compressed: ~500KB
 */
export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<File> {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Skip compression for non-image files
  if (!file.type.startsWith('image/')) {
    console.log('[Compress] Skipping non-image file:', file.type);
    return file;
  }

  // Skip compression for already small files (under 500KB)
  if (file.size < 500 * 1024) {
    console.log('[Compress] Skipping small file:', formatSize(file.size));
    return file;
  }

  try {
    // Load image using standard Image element (works on all browsers including iOS Safari)
    const img = await loadImage(file);

    // Calculate new dimensions
    const { width, height } = calculateDimensions(
      img.width,
      img.height,
      opts.maxWidth,
      opts.maxHeight
    );

    // Create standard canvas (iOS Safari compatible)
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Use high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, width, height);

    // Convert to blob with compression
    const mimeType = opts.format === 'webp' ? 'image/webp' : 'image/jpeg';

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Failed to create blob'));
          }
        },
        mimeType,
        opts.quality
      );
    });

    // Create new file with compressed content
    const extension = opts.format === 'webp' ? 'webp' : 'jpg';
    const newFileName = replaceExtension(file.name, extension);

    const compressedFile = new File([blob], newFileName, {
      type: mimeType,
      lastModified: Date.now(),
    });

    // Log compression results
    const savings = ((1 - compressedFile.size / file.size) * 100).toFixed(1);
    console.log(
      `[Compress] ${formatSize(file.size)} -> ${formatSize(compressedFile.size)} (${savings}% savings)`
    );

    return compressedFile;
  } catch (error) {
    console.error('[Compress] Failed to compress image:', error);
    // Return original file if compression fails
    return file;
  }
}

/**
 * Load an image file into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}

/**
 * Calculate new dimensions while maintaining aspect ratio
 */
function calculateDimensions(
  origWidth: number,
  origHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  // If image is smaller than max, keep original size
  if (origWidth <= maxWidth && origHeight <= maxHeight) {
    return { width: origWidth, height: origHeight };
  }

  // Calculate aspect ratio
  const aspectRatio = origWidth / origHeight;

  let width = maxWidth;
  let height = maxWidth / aspectRatio;

  // If height exceeds max, scale based on height instead
  if (height > maxHeight) {
    height = maxHeight;
    width = maxHeight * aspectRatio;
  }

  return {
    width: Math.round(width),
    height: Math.round(height),
  };
}

/**
 * Replace file extension
 */
function replaceExtension(filename: string, newExt: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) {
    return `${filename}.${newExt}`;
  }
  return `${filename.substring(0, lastDot)}.${newExt}`;
}

/**
 * Format file size for display
 */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Check if a file is an image
 */
export function isImageFile(file: File): boolean {
  return file.type.startsWith('image/');
}

/**
 * Check if a file is a video
 */
export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

/**
 * Get estimated compressed size (rough estimate)
 */
export function estimateCompressedSize(file: File, options: CompressionOptions = {}): number {
  if (!isImageFile(file)) return file.size;
  if (file.size < 500 * 1024) return file.size;

  // Rough estimate: compressed is typically 10-20% of original for photos
  const compressionRatio = 0.15;
  return Math.round(file.size * compressionRatio);
}

/**
 * Generate a thumbnail from an image file
 * Uses standard Canvas API for iOS Safari compatibility
 */
export async function generateThumbnail(
  file: File,
  maxSize: number = 200
): Promise<Blob | null> {
  if (!isImageFile(file)) return null;

  try {
    const img = await loadImage(file);

    const { width, height } = calculateDimensions(
      img.width,
      img.height,
      maxSize,
      maxSize
    );

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(img, 0, 0, width, height);

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/jpeg',
        0.6
      );
    });
  } catch (error) {
    console.error('[Thumbnail] Failed to generate:', error);
    return null;
  }
}

/**
 * Create object URL for preview (remember to revoke when done)
 */
export function createPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}

/**
 * Revoke object URL to free memory
 */
export function revokePreviewUrl(url: string): void {
  URL.revokeObjectURL(url);
}

/**
 * Generate a thumbnail from a video file by capturing a frame
 * Captures frame at 1 second or 10% into the video (whichever is earlier)
 */
export async function generateVideoThumbnail(
  file: File,
  maxSize: number = 320
): Promise<Blob | null> {
  if (!isVideoFile(file)) return null;

  try {
    const video = document.createElement('video');
    const url = URL.createObjectURL(file);

    return new Promise((resolve) => {
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        // Seek to 1 second or 10% of duration, whichever is smaller
        const seekTime = Math.min(1, video.duration * 0.1);
        video.currentTime = seekTime;
      };

      video.onseeked = () => {
        // Calculate thumbnail dimensions
        const { width, height } = calculateThumbnailDimensions(
          video.videoWidth,
          video.videoHeight,
          maxSize
        );

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          resolve(null);
          return;
        }

        ctx.drawImage(video, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(url);
            resolve(blob);
          },
          'image/jpeg',
          0.7
        );
      };

      video.onerror = () => {
        URL.revokeObjectURL(url);
        console.error('[VideoThumbnail] Failed to load video');
        resolve(null);
      };

      // Timeout after 10 seconds
      setTimeout(() => {
        URL.revokeObjectURL(url);
        resolve(null);
      }, 10000);

      video.src = url;
    });
  } catch (error) {
    console.error('[VideoThumbnail] Failed to generate:', error);
    return null;
  }
}

/**
 * Generate thumbnail from either image or video file
 */
export async function generateFileThumbnail(
  file: File,
  maxSize: number = 320
): Promise<Blob | null> {
  if (isImageFile(file)) {
    return generateThumbnail(file, maxSize);
  }
  if (isVideoFile(file)) {
    return generateVideoThumbnail(file, maxSize);
  }
  return null;
}

/**
 * Calculate thumbnail dimensions maintaining aspect ratio
 */
function calculateThumbnailDimensions(
  origWidth: number,
  origHeight: number,
  maxSize: number
): { width: number; height: number } {
  if (origWidth <= maxSize && origHeight <= maxSize) {
    return { width: origWidth, height: origHeight };
  }

  const aspectRatio = origWidth / origHeight;

  if (origWidth > origHeight) {
    return {
      width: maxSize,
      height: Math.round(maxSize / aspectRatio),
    };
  } else {
    return {
      width: Math.round(maxSize * aspectRatio),
      height: maxSize,
    };
  }
}

/**
 * Convert blob to base64 data URL
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Failed to convert blob to base64'));
      }
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

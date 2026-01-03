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
    // Load image
    const imageBitmap = await createImageBitmap(file);

    // Calculate new dimensions
    const { width, height } = calculateDimensions(
      imageBitmap.width,
      imageBitmap.height,
      opts.maxWidth,
      opts.maxHeight
    );

    // Create canvas and draw resized image
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    // Use high-quality rendering
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageBitmap, 0, 0, width, height);

    // Convert to blob with compression
    const mimeType = opts.format === 'webp' ? 'image/webp' : 'image/jpeg';
    const blob = await canvas.convertToBlob({
      type: mimeType,
      quality: opts.quality,
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
 */
export async function generateThumbnail(
  file: File,
  maxSize: number = 200
): Promise<Blob | null> {
  if (!isImageFile(file)) return null;

  try {
    const imageBitmap = await createImageBitmap(file);

    const { width, height } = calculateDimensions(
      imageBitmap.width,
      imageBitmap.height,
      maxSize,
      maxSize
    );

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    ctx.drawImage(imageBitmap, 0, 0, width, height);

    return canvas.convertToBlob({
      type: 'image/jpeg',
      quality: 0.6,
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

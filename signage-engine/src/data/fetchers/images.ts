import { Image, loadImage } from '@napi-rs/canvas';
import { logger } from '../../utils/logger.js';

const imageCache = new Map<string, Image>();
const loadingSet = new Set<string>();

/**
 * Returns a cached Image for the given URL, or starts loading it.
 * Returns null if the image is still loading or failed to load.
 */
export async function getCachedImage(url: string): Promise<Image | null> {
  if (imageCache.has(url)) {
    return imageCache.get(url)!;
  }

  if (loadingSet.has(url)) {
    return null; // still loading
  }

  loadingSet.add(url);

  try {
    const image = await loadImage(url);
    imageCache.set(url, image);
    loadingSet.delete(url);
    return image;
  } catch (error) {
    logger.error({ error, url }, 'Failed to load image');
    loadingSet.delete(url);
    return null;
  }
}

/**
 * Synchronous check — returns cached image or null (does not start loading).
 */
export function getCachedImageSync(url: string): Image | null {
  return imageCache.get(url) || null;
}

/**
 * Start loading an image in the background (fire-and-forget).
 */
export function preloadImage(url: string): void {
  if (imageCache.has(url) || loadingSet.has(url)) return;
  // Fire and forget
  getCachedImage(url).catch(() => {});
}

/**
 * Check if an image URL is currently being loaded.
 */
export function isImageLoading(url: string): boolean {
  return loadingSet.has(url);
}

/**
 * Clear the entire image cache.
 */
export function clearImageCache(): void {
  imageCache.clear();
  loadingSet.clear();
}

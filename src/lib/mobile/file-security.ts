import { sanitizeFilename, stripExifData } from '@/lib/portal/file-security';

// Re-export shared utilities
export { sanitizeFilename, stripExifData };

// Mobile supports broader file types than portal (photos + videos + documents)
export const MOBILE_ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  // Videos
  'video/mp4',
  'video/quicktime',
  'video/webm',
  // Documents
  'application/pdf',
] as const;

export const MAX_MOBILE_FILE_SIZE = 50 * 1024 * 1024; // 50MB for videos

export function validateMobileFileSize(sizeBytes: number): boolean {
  return sizeBytes <= MAX_MOBILE_FILE_SIZE;
}

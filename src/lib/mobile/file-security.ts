import { sanitizeFilename, stripExifData } from '@/lib/portal/file-security';
import fileType from 'file-type';

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

export async function validateMobileFileType(buffer: Buffer, filename: string): Promise<{
  valid: boolean;
  detectedMime?: string;
  error?: string;
}> {
  const type = await fileType.fromBuffer(buffer);

  if (type) {
    if (!MOBILE_ALLOWED_MIME_TYPES.includes(type.mime as typeof MOBILE_ALLOWED_MIME_TYPES[number])) {
      return { valid: false, detectedMime: type.mime, error: `File type ${type.mime} is not allowed` };
    }
    return { valid: true, detectedMime: type.mime };
  }

  // If file-type can't detect (some formats), check extension
  const ext = filename.toLowerCase().split('.').pop();
  const extensionMimeMap: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    heic: 'image/heic', heif: 'image/heif', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  };

  const mimeFromExt = ext ? extensionMimeMap[ext] : undefined;
  if (!mimeFromExt) {
    return { valid: false, error: `Could not determine file type for .${ext}` };
  }
  return { valid: true, detectedMime: mimeFromExt };
}

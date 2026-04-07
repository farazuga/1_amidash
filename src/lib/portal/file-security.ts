import fileType from 'file-type';

export const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024; // 3MB

export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/postscript', // EPS
  'application/eps', // EPS (file-type v16 detection)
  'image/x-eps',
] as const;

export const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.eps'] as const;

export async function validateFileType(buffer: Buffer, filename: string): Promise<{
  valid: boolean;
  mimeType?: string;
  error?: string;
}> {
  // 1. Check extension
  const ext = filename.toLowerCase().split('.').pop();
  if (!ALLOWED_EXTENSIONS.some(e => e === `.${ext}`)) {
    return { valid: false, error: `File type .${ext} is not allowed` };
  }

  // 2. Check magic bytes
  const type = await fileType.fromBuffer(buffer);
  if (!type) {
    // EPS files may not have detectable magic bytes — check for %!PS header
    if (ext === 'eps' && buffer.toString('ascii', 0, 4) === '%!PS') {
      return { valid: true, mimeType: 'application/postscript' };
    }
    return { valid: false, error: 'Could not determine file type from content' };
  }

  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(type.mime)) {
    return { valid: false, error: `File content is ${type.mime}, which is not allowed` };
  }

  return { valid: true, mimeType: type.mime };
}

export function sanitizeFilename(filename: string): string {
  // Strip path components
  let clean = filename.replace(/^.*[\\/]/, '');
  // Strip null bytes and control chars
  clean = clean.replace(/[\x00-\x1f\x80-\x9f]/g, '');
  // Strip special chars
  clean = clean.replace(/[<>:"|?*]/g, '');
  // Strip path traversal
  clean = clean.replace(/\.\./g, '');
  // Get extension
  const lastDot = clean.lastIndexOf('.');
  const ext = lastDot > 0 ? clean.substring(lastDot) : '';
  const name = lastDot > 0 ? clean.substring(0, lastDot) : clean;
  // Truncate name to 100 chars
  const truncated = name.substring(0, 100);
  // Prefix with timestamp
  return `${Date.now()}_${truncated}${ext}`;
}

export function validateFileSize(sizeBytes: number): boolean {
  return sizeBytes <= MAX_FILE_SIZE_BYTES;
}

export async function stripExifData(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (mimeType === 'image/jpeg' || mimeType === 'image/png') {
    const sharp = (await import('sharp')).default;
    return sharp(buffer).rotate().toBuffer(); // rotate() strips EXIF
  }
  return buffer;
}

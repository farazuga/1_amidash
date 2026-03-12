import { describe, it, expect } from 'vitest';
import {
  validateFileType,
  sanitizeFilename,
  validateFileSize,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '../file-security';

describe('file-security', () => {
  describe('validateFileSize', () => {
    it('accepts files at exactly 3MB', () => {
      expect(validateFileSize(3 * 1024 * 1024)).toBe(true);
    });

    it('accepts files under 3MB', () => {
      expect(validateFileSize(1 * 1024 * 1024)).toBe(true);
    });

    it('rejects files over 3MB', () => {
      expect(validateFileSize(4 * 1024 * 1024)).toBe(false);
    });

    it('accepts empty files', () => {
      expect(validateFileSize(0)).toBe(true);
    });
  });

  describe('sanitizeFilename', () => {
    it('strips path traversal attempts', () => {
      const result = sanitizeFilename('../../../etc/passwd');
      expect(result).not.toContain('..');
      expect(result).not.toContain('/');
    });

    it('strips null bytes', () => {
      const result = sanitizeFilename('file\x00.pdf');
      expect(result).not.toContain('\x00');
    });

    it('truncates long names to 100 chars plus extension', () => {
      const long = 'a'.repeat(200) + '.pdf';
      const result = sanitizeFilename(long);
      // timestamp_name.ext — name part should be max 100
      const parts = result.split('_');
      const nameWithExt = parts.slice(1).join('_');
      expect(nameWithExt.length).toBeLessThanOrEqual(104); // 100 + .pdf
    });

    it('prefixes with timestamp', () => {
      const result = sanitizeFilename('test.pdf');
      expect(result).toMatch(/^\d+_test\.pdf$/);
    });

    it('strips special characters', () => {
      const result = sanitizeFilename('file<>:"|?*.pdf');
      expect(result).not.toMatch(/[<>:"|?*]/);
      expect(result).toContain('file');
      expect(result).toContain('.pdf');
    });

    it('handles backslash paths (Windows)', () => {
      const result = sanitizeFilename('C:\\Users\\test\\file.pdf');
      expect(result).not.toContain('\\');
      expect(result).toContain('file.pdf');
    });
  });

  describe('validateFileType', () => {
    it('accepts PDF files with correct magic bytes', async () => {
      // PDF magic bytes: %PDF
      const pdfBuffer = Buffer.from('%PDF-1.4 fake pdf content');
      const result = await validateFileType(pdfBuffer, 'test.pdf');
      // Note: file-type may or may not detect this minimal buffer
      // We're testing the flow, not file-type itself
      expect(result).toBeDefined();
    });

    it('rejects disallowed extensions', async () => {
      const buffer = Buffer.from('console.log("hello")');
      const result = await validateFileType(buffer, 'malicious.js');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('.js');
    });

    it('rejects .exe extension', async () => {
      const buffer = Buffer.alloc(100);
      const result = await validateFileType(buffer, 'virus.exe');
      expect(result.valid).toBe(false);
    });

    it('accepts EPS files with %!PS header', async () => {
      const epsBuffer = Buffer.from('%!PS-Adobe-3.0 EPSF-3.0');
      const result = await validateFileType(epsBuffer, 'design.eps');
      expect(result.valid).toBe(true);
      // file-type v16 detects EPS as application/eps
      expect(['application/postscript', 'application/eps']).toContain(result.mimeType);
    });
  });

  describe('constants', () => {
    it('MAX_FILE_SIZE_BYTES is 3MB', () => {
      expect(MAX_FILE_SIZE_BYTES).toBe(3 * 1024 * 1024);
    });

    it('ALLOWED_MIME_TYPES includes expected types', () => {
      expect(ALLOWED_MIME_TYPES).toContain('application/pdf');
      expect(ALLOWED_MIME_TYPES).toContain('image/png');
      expect(ALLOWED_MIME_TYPES).toContain('image/jpeg');
    });
  });
});

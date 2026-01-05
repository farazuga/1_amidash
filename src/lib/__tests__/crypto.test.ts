import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  encryptToken,
  decryptToken,
  encryptTokens,
  decryptTokens,
  isEncryptionConfigured,
} from '../crypto';

describe('crypto module', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
    // Set a test encryption key (32 bytes for AES-256)
    process.env.TOKEN_ENCRYPTION_KEY = 'test-encryption-key-for-tokens-32';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('isEncryptionConfigured', () => {
    it('returns true when TOKEN_ENCRYPTION_KEY is set', () => {
      expect(isEncryptionConfigured()).toBe(true);
    });

    it('returns false when TOKEN_ENCRYPTION_KEY is not set', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;
      expect(isEncryptionConfigured()).toBe(false);
    });

    it('returns false when TOKEN_ENCRYPTION_KEY is empty', () => {
      process.env.TOKEN_ENCRYPTION_KEY = '';
      expect(isEncryptionConfigured()).toBe(false);
    });
  });

  describe('encryptToken / decryptToken', () => {
    it('encrypts and decrypts a token successfully', () => {
      const originalToken = 'my-secret-access-token-12345';
      const encrypted = encryptToken(originalToken);

      // Encrypted should be different from original
      expect(encrypted).not.toBe(originalToken);

      // Encrypted should be base64 encoded
      expect(encrypted).toMatch(/^[A-Za-z0-9+/]+=*$/);

      // Decrypted should match original
      const decrypted = decryptToken(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('returns empty string for empty input', () => {
      expect(encryptToken('')).toBe('');
      expect(decryptToken('')).toBe('');
    });

    it('generates different ciphertext for the same input (due to random IV)', () => {
      const token = 'same-token';
      const encrypted1 = encryptToken(token);
      const encrypted2 = encryptToken(token);

      // Different encryptions should produce different ciphertext
      expect(encrypted1).not.toBe(encrypted2);

      // But both should decrypt to the same value
      expect(decryptToken(encrypted1)).toBe(token);
      expect(decryptToken(encrypted2)).toBe(token);
    });

    it('throws error when decrypting with wrong key', () => {
      const originalToken = 'my-secret-token';
      const encrypted = encryptToken(originalToken);

      // Change the key
      process.env.TOKEN_ENCRYPTION_KEY = 'different-key-for-decryption-32';

      expect(() => decryptToken(encrypted)).toThrow('Failed to decrypt token');
    });

    it('throws error when encryption key is missing', () => {
      delete process.env.TOKEN_ENCRYPTION_KEY;

      expect(() => encryptToken('token')).toThrow('TOKEN_ENCRYPTION_KEY environment variable is required');
    });

    it('handles long tokens correctly', () => {
      const longToken = 'a'.repeat(2000); // Very long token
      const encrypted = encryptToken(longToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(longToken);
    });

    it('handles special characters in tokens', () => {
      const specialToken = 'token/with+special=chars&more!@#$%^*()';
      const encrypted = encryptToken(specialToken);
      const decrypted = decryptToken(encrypted);

      expect(decrypted).toBe(specialToken);
    });
  });

  describe('encryptTokens / decryptTokens', () => {
    it('encrypts and decrypts token objects', () => {
      const tokens = {
        access_token: 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...',
        refresh_token: 'refresh-token-value-12345',
      };

      const encrypted = encryptTokens(tokens);

      // Both should be encrypted
      expect(encrypted.access_token).not.toBe(tokens.access_token);
      expect(encrypted.refresh_token).not.toBe(tokens.refresh_token);

      // Decrypt and verify
      const decrypted = decryptTokens(encrypted);
      expect(decrypted.access_token).toBe(tokens.access_token);
      expect(decrypted.refresh_token).toBe(tokens.refresh_token);
    });

    it('handles null refresh_token', () => {
      const tokens = {
        access_token: 'access-token-value',
        refresh_token: null,
      };

      const encrypted = encryptTokens(tokens);
      expect(encrypted.refresh_token).toBeNull();

      const decrypted = decryptTokens(encrypted);
      expect(decrypted.access_token).toBe(tokens.access_token);
      expect(decrypted.refresh_token).toBeNull();
    });

    it('handles undefined refresh_token', () => {
      const tokens = {
        access_token: 'access-token-value',
      };

      const encrypted = encryptTokens(tokens);
      expect(encrypted.refresh_token).toBeNull();

      const decrypted = decryptTokens({
        access_token: encrypted.access_token,
        refresh_token: null,
      });
      expect(decrypted.access_token).toBe(tokens.access_token);
    });
  });
});

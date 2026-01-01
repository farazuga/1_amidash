/**
 * Token encryption utilities for secure storage of OAuth tokens
 * Uses AES-256-GCM encryption with Node.js crypto module
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

// Encryption algorithm
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;

/**
 * Get the encryption key from environment variable
 * Key is derived using scrypt for added security
 */
function getEncryptionKey(salt: Buffer): Buffer {
  const secret = process.env.TOKEN_ENCRYPTION_KEY;

  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_KEY environment variable is required for token encryption');
  }

  // Derive key using scrypt (memory-hard function resistant to brute force)
  return scryptSync(secret, salt, KEY_LENGTH);
}

/**
 * Check if encryption is available (key is configured)
 */
export function isEncryptionConfigured(): boolean {
  return !!process.env.TOKEN_ENCRYPTION_KEY;
}

/**
 * Encrypt a token for secure storage
 * Returns a base64 string containing: salt + iv + authTag + ciphertext
 *
 * @param plaintext - The token to encrypt
 * @returns Encrypted token as base64 string
 */
export function encryptToken(plaintext: string): string {
  if (!plaintext) {
    return plaintext;
  }

  // Generate random salt and IV
  const salt = randomBytes(SALT_LENGTH);
  const iv = randomBytes(IV_LENGTH);

  // Derive key from secret + salt
  const key = getEncryptionKey(salt);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, key, iv);

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Get auth tag (GCM mode provides authentication)
  const authTag = cipher.getAuthTag();

  // Combine: salt + iv + authTag + ciphertext
  const combined = Buffer.concat([salt, iv, authTag, encrypted]);

  return combined.toString('base64');
}

/**
 * Decrypt a token from storage
 *
 * @param encryptedBase64 - The encrypted token as base64 string
 * @returns Decrypted plaintext token
 */
export function decryptToken(encryptedBase64: string): string {
  if (!encryptedBase64) {
    return encryptedBase64;
  }

  try {
    const combined = Buffer.from(encryptedBase64, 'base64');

    // Extract components
    const salt = combined.subarray(0, SALT_LENGTH);
    const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
    const authTag = combined.subarray(
      SALT_LENGTH + IV_LENGTH,
      SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
    );
    const ciphertext = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);

    // Derive key from secret + salt
    const key = getEncryptionKey(salt);

    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  } catch (error) {
    // Log error but don't expose details
    console.error('Token decryption failed:', error instanceof Error ? error.message : 'Unknown error');
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Encrypt tokens object for storage
 * Handles access_token and refresh_token
 */
export function encryptTokens(tokens: {
  access_token: string;
  refresh_token?: string | null;
}): { access_token: string; refresh_token: string | null } {
  return {
    access_token: encryptToken(tokens.access_token),
    refresh_token: tokens.refresh_token ? encryptToken(tokens.refresh_token) : null,
  };
}

/**
 * Decrypt tokens object from storage
 * Handles access_token and refresh_token
 */
export function decryptTokens(encryptedTokens: {
  access_token: string;
  refresh_token?: string | null;
}): { access_token: string; refresh_token: string | null } {
  return {
    access_token: decryptToken(encryptedTokens.access_token),
    refresh_token: encryptedTokens.refresh_token
      ? decryptToken(encryptedTokens.refresh_token)
      : null,
  };
}

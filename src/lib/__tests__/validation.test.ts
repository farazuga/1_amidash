import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  roleSchema,
  statusChangeEmailSchema,
  welcomeEmailSchema,
} from '../validation';

describe('validation schemas', () => {
  describe('emailSchema', () => {
    it('accepts valid emails', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
      expect(emailSchema.safeParse('user.name@domain.co.uk').success).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('').success).toBe(false);
    });
  });

  describe('roleSchema', () => {
    it('accepts valid roles', () => {
      expect(roleSchema.safeParse('admin').success).toBe(true);
      expect(roleSchema.safeParse('editor').success).toBe(true);
      expect(roleSchema.safeParse('viewer').success).toBe(true);
    });

    it('rejects invalid roles', () => {
      expect(roleSchema.safeParse('superadmin').success).toBe(false);
      expect(roleSchema.safeParse('').success).toBe(false);
    });
  });

  describe('statusChangeEmailSchema', () => {
    const validData = {
      to: 'client@example.com',
      clientName: 'Acme Corp',
      newStatus: 'In Progress',
    };

    it('accepts valid data', () => {
      expect(statusChangeEmailSchema.safeParse(validData).success).toBe(true);
    });

    it('rejects invalid email', () => {
      expect(statusChangeEmailSchema.safeParse({ ...validData, to: 'invalid' }).success).toBe(false);
    });

    it('rejects empty required fields', () => {
      expect(statusChangeEmailSchema.safeParse({ ...validData, clientName: '' }).success).toBe(false);
    });
  });

  describe('welcomeEmailSchema', () => {
    const validData = {
      to: 'poc@client.com',
      clientName: 'Acme Corp',
      pocName: 'John Doe',
      clientToken: 'token123',
    };

    it('accepts valid data', () => {
      expect(welcomeEmailSchema.safeParse(validData).success).toBe(true);
    });

    it('rejects invalid email', () => {
      expect(welcomeEmailSchema.safeParse({ ...validData, to: 'invalid' }).success).toBe(false);
    });

    it('rejects empty clientToken', () => {
      expect(welcomeEmailSchema.safeParse({ ...validData, clientToken: '' }).success).toBe(false);
    });
  });
});

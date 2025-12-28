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
      expect(emailSchema.safeParse('a@b.io').success).toBe(true);
    });

    it('rejects invalid emails', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('missing@domain').success).toBe(false);
      expect(emailSchema.safeParse('@nodomain.com').success).toBe(false);
      expect(emailSchema.safeParse('').success).toBe(false);
    });

    it('provides error message for invalid email', () => {
      const result = emailSchema.safeParse('invalid');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe('Invalid email address');
      }
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
      expect(roleSchema.safeParse('Admin').success).toBe(false);
      expect(roleSchema.safeParse('').success).toBe(false);
      expect(roleSchema.safeParse('user').success).toBe(false);
    });
  });

  describe('statusChangeEmailSchema', () => {
    const validData = {
      to: 'client@example.com',
      clientName: 'Acme Corp',
      newStatus: 'In Progress',
    };

    it('accepts valid data with required fields only', () => {
      const result = statusChangeEmailSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts valid data with all fields', () => {
      const result = statusChangeEmailSchema.safeParse({
        ...validData,
        previousStatus: 'Started',
        clientToken: 'abc123',
        note: 'Project update note',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = statusChangeEmailSchema.safeParse({
        ...validData,
        to: 'invalid-email',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty clientName', () => {
      const result = statusChangeEmailSchema.safeParse({
        ...validData,
        clientName: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty newStatus', () => {
      const result = statusChangeEmailSchema.safeParse({
        ...validData,
        newStatus: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      expect(statusChangeEmailSchema.safeParse({}).success).toBe(false);
      expect(statusChangeEmailSchema.safeParse({ to: 'a@b.com' }).success).toBe(false);
    });
  });

  describe('welcomeEmailSchema', () => {
    const validData = {
      to: 'poc@client.com',
      clientName: 'Acme Corp',
      pocName: 'John Doe',
      clientToken: 'token123',
    };

    it('accepts valid data with required fields only', () => {
      const result = welcomeEmailSchema.safeParse(validData);
      expect(result.success).toBe(true);
    });

    it('accepts valid data with all fields', () => {
      const result = welcomeEmailSchema.safeParse({
        ...validData,
        projectType: 'Development',
        initialStatus: 'Started',
      });
      expect(result.success).toBe(true);
    });

    it('rejects invalid email', () => {
      const result = welcomeEmailSchema.safeParse({
        ...validData,
        to: 'not-valid',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty pocName', () => {
      const result = welcomeEmailSchema.safeParse({
        ...validData,
        pocName: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty clientToken', () => {
      const result = welcomeEmailSchema.safeParse({
        ...validData,
        clientToken: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects missing required fields', () => {
      expect(welcomeEmailSchema.safeParse({}).success).toBe(false);
      expect(welcomeEmailSchema.safeParse({ to: 'a@b.com', clientName: 'Test' }).success).toBe(false);
    });
  });
});

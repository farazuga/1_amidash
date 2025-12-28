import { z } from 'zod';

// Reusable email schema
export const emailSchema = z.string().email('Invalid email address');

// Role enum validation
export const roleSchema = z.enum(['admin', 'editor', 'viewer', 'customer']);

// Status change email request schema
export const statusChangeEmailSchema = z.object({
  to: emailSchema,
  clientName: z.string().min(1, 'Client name required'),
  newStatus: z.string().min(1, 'Status required'),
  previousStatus: z.string().optional(),
  clientToken: z.string().optional(),
  note: z.string().optional(),
  projectId: z.string().optional(), // For checking project email settings
});

// Welcome email request schema
export const welcomeEmailSchema = z.object({
  to: emailSchema,
  clientName: z.string().min(1, 'Client name required'),
  pocName: z.string().min(1, 'POC name required'),
  projectType: z.string().optional(),
  initialStatus: z.string().optional(),
  clientToken: z.string().min(1, 'Client token required'),
});

// Type exports for convenience
export type StatusChangeEmailInput = z.infer<typeof statusChangeEmailSchema>;
export type WelcomeEmailInput = z.infer<typeof welcomeEmailSchema>;
export type Role = z.infer<typeof roleSchema>;

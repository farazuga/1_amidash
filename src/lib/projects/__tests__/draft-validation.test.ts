import { describe, it, expect } from 'vitest';
import { validateDraftProjectForm, validateProjectForm } from '../utils';

describe('validateDraftProjectForm', () => {
  it('accepts when client_name provided', () => {
    expect(validateDraftProjectForm({ clientName: 'Acme Corp' })).toEqual({ valid: true });
  });

  it('rejects empty client_name', () => {
    const result = validateDraftProjectForm({ clientName: '' });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Client name');
  });

  it('rejects whitespace-only client_name', () => {
    const result = validateDraftProjectForm({ clientName: '   ' });
    expect(result.valid).toBe(false);
  });
});

describe('validateProjectForm delivery address', () => {
  const validParams = {
    selectedSalesperson: 'user-1',
    selectedProjectType: 'type-1',
    isEditing: false,
    salesOrderNumber: 'S12345',
    pocName: 'John',
    pocEmail: 'john@test.com',
    pocPhone: '1234567890',
    goalCompletionDate: '2026-06-15',
    createdDate: '2026-03-12',
    startDate: '',
    endDate: '',
    salesAmount: '5000',
    secondaryPocEmail: '',
  };

  it('passes with valid delivery address', () => {
    const result = validateProjectForm({
      ...validParams,
      deliveryAddress: { street: '123 Main St', city: 'Atlanta', state: 'GA', zip: '30301' },
    });
    expect(result.valid).toBe(true);
  });

  it('fails when delivery address is null', () => {
    const result = validateProjectForm({
      ...validParams,
      deliveryAddress: null,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Delivery address');
  });

  it('fails when street is missing', () => {
    const result = validateProjectForm({
      ...validParams,
      deliveryAddress: { street: '', city: 'Atlanta', state: 'GA', zip: '30301' },
    });
    expect(result.valid).toBe(false);
  });

  it('passes when deliveryAddress param not provided (grandfathered)', () => {
    const result = validateProjectForm(validParams);
    expect(result.valid).toBe(true);
  });
});

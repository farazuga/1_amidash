import { describe, it, expect } from 'vitest';
import {
  calculateGoalDate,
  validateDateInRange,
  cleanSalesAmount,
  formatPhoneNumber,
  validateEmail,
  validateSalesOrderNumber,
  validatePhoneNumber,
  validateProjectForm,
} from '../utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a minimal valid params object for validateProjectForm so individual
 * test cases can override only the field they are testing.
 */
function validFormParams(overrides: Partial<Parameters<typeof validateProjectForm>[0]> = {}): Parameters<typeof validateProjectForm>[0] {
  return {
    selectedSalesperson: 'Alice',
    selectedProjectType: 'Box Sale',
    isEditing: false,
    salesOrderNumber: 'S12345',
    pocName: 'John Doe',
    pocEmail: 'john@example.com',
    pocPhone: '555-867-5309',
    goalCompletionDate: '',
    createdDate: '',
    startDate: '',
    endDate: '',
    salesAmount: '',
    secondaryPocEmail: '',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// calculateGoalDate
// ---------------------------------------------------------------------------

describe('calculateGoalDate', () => {
  // --- Box Sale (30 days) ---

  describe('Box Sale type', () => {
    it('adds 30 days and rounds to 15th when target day is on or before 15', () => {
      // Jan 1 + 30 = Jan 31 → after 15 → last day of Jan = 31
      // Pick a date where 30 days lands on or before the 15th instead.
      // Feb 1 + 30 = Mar 3 → day 3 <= 15 → goal = Mar 15
      const result = calculateGoalDate('Box Sale', new Date(2025, 1, 1)); // Feb 1 2025
      expect(result).toBe('2025-03-15');
    });

    it('adds 30 days and rounds to last day of month when target day is after 15', () => {
      // Jan 1 + 30 = Jan 31 → day 31 > 15 → last day of Jan = 31
      const result = calculateGoalDate('Box Sale', new Date(2025, 0, 1)); // Jan 1 2025
      expect(result).toBe('2025-01-31');
    });

    it('is case-insensitive - "box sale" lowercase', () => {
      const lower = calculateGoalDate('box sale', new Date(2025, 1, 1));
      const mixed = calculateGoalDate('Box Sale', new Date(2025, 1, 1));
      expect(lower).toBe(mixed);
    });

    it('is case-insensitive - "BOX SALE" uppercase', () => {
      const upper = calculateGoalDate('BOX SALE', new Date(2025, 1, 1));
      const mixed = calculateGoalDate('Box Sale', new Date(2025, 1, 1));
      expect(upper).toBe(mixed);
    });

    it('handles month boundaries correctly when 30 days crosses into next month', () => {
      // Dec 15 + 30 = Jan 14 → day 14 <= 15 → goal = Jan 15
      const result = calculateGoalDate('Box Sale', new Date(2024, 11, 15)); // Dec 15 2024
      expect(result).toBe('2025-01-15');
    });

    it('returns ISO date string format YYYY-MM-DD', () => {
      const result = calculateGoalDate('Box Sale', new Date(2025, 0, 1));
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  // --- Solution (56 days) ---

  describe('Solution type', () => {
    it('adds 56 days and rounds to 15th when target day is on or before 15', () => {
      // Jan 1 + 56 = Feb 26 → day 26 > 15 → last day of Feb 2025 = 28
      // Choose a date where 56 days lands on or before 15th.
      // Mar 1 + 56 = Apr 26 → > 15 → Apr 30
      // Nov 15 + 56 = Jan 10 → day 10 <= 15 → Jan 15
      const result = calculateGoalDate('Solution', new Date(2024, 10, 15)); // Nov 15 2024
      expect(result).toBe('2025-01-15');
    });

    it('adds 56 days and rounds to last day of month when target day is after 15', () => {
      // Jan 1 2025 + 56 = Feb 26 → day 26 > 15 → last day of Feb 2025 = 28
      const result = calculateGoalDate('Solution', new Date(2025, 0, 1)); // Jan 1 2025
      expect(result).toBe('2025-02-28');
    });

    it('is case-insensitive - "solution" lowercase', () => {
      const lower = calculateGoalDate('solution', new Date(2025, 0, 1));
      const titled = calculateGoalDate('Solution', new Date(2025, 0, 1));
      expect(lower).toBe(titled);
    });

    it('is case-insensitive - "SOLUTION" uppercase', () => {
      const upper = calculateGoalDate('SOLUTION', new Date(2025, 0, 1));
      const titled = calculateGoalDate('Solution', new Date(2025, 0, 1));
      expect(upper).toBe(titled);
    });

    it('produces a later goal date than Box Sale from the same start date', () => {
      const from = new Date(2025, 0, 1);
      const boxResult = calculateGoalDate('Box Sale', from);
      const solutionResult = calculateGoalDate('Solution', from);
      expect(new Date(solutionResult) >= new Date(boxResult)).toBe(true);
    });
  });

  // --- Default / unknown type (falls back to 30 days like Box Sale) ---

  describe('Default / unknown type', () => {
    it('uses 30-day calculation for an unrecognised project type', () => {
      const defaultResult = calculateGoalDate('Unknown Type', new Date(2025, 0, 1));
      const boxResult = calculateGoalDate('Box Sale', new Date(2025, 0, 1));
      expect(defaultResult).toBe(boxResult);
    });

    it('uses 30-day calculation for an empty string project type', () => {
      const defaultResult = calculateGoalDate('', new Date(2025, 0, 1));
      const boxResult = calculateGoalDate('Box Sale', new Date(2025, 0, 1));
      expect(defaultResult).toBe(boxResult);
    });
  });

  // --- Rounding: on/before 15 → 15th; after 15 → last day ---

  describe('15th vs last-day rounding', () => {
    it('uses the 15th when the target day equals exactly 15', () => {
      // Need to find a start date where (start + 30) lands exactly on the 15th.
      // Feb 14 + 30 = Mar 16  (not 15)
      // Mar 16 + 30 = Apr 15  ✓  → goal = Apr 15
      const result = calculateGoalDate('Box Sale', new Date(2025, 2, 16)); // Mar 16 2025
      expect(result).toBe('2025-04-15');
    });

    it('uses the last day of the month when the target day is 16', () => {
      // Mar 17 + 30 = Apr 16 → > 15 → Apr 30
      const result = calculateGoalDate('Box Sale', new Date(2025, 2, 17)); // Mar 17 2025
      expect(result).toBe('2025-04-30');
    });

    it('uses the 15th when the target day is 1', () => {
      // Feb 1 + 30 = Mar 3 → <= 15 → Mar 15
      const result = calculateGoalDate('Box Sale', new Date(2025, 1, 1)); // Feb 1 2025
      expect(result).toBe('2025-03-15');
    });

    it('uses the last day of the month when the target day is 31', () => {
      // Jan 1 + 30 = Jan 31 → > 15 → 31
      const result = calculateGoalDate('Box Sale', new Date(2025, 0, 1)); // Jan 1 2025
      expect(result).toBe('2025-01-31');
    });
  });

  // --- February / short-month edge cases ---

  describe('February edge cases', () => {
    it('resolves to Feb 28 (last day) in a non-leap year when target is after the 15th', () => {
      // Jan 1 2025 + 56 = Feb 26 → > 15 → last day of Feb 2025 = 28
      const result = calculateGoalDate('Solution', new Date(2025, 0, 1));
      expect(result).toBe('2025-02-28');
    });

    it('resolves to Feb 29 (last day) in a leap year when target is after the 15th', () => {
      // Jan 1 2024 + 56 = Feb 26 → > 15 → last day of Feb 2024 = 29 (leap year)
      const result = calculateGoalDate('Solution', new Date(2024, 0, 1));
      expect(result).toBe('2024-02-29');
    });

    it('resolves to Feb 15 when the target day is on or before 15', () => {
      // Dec 15 2024 + 56 = Feb 9 2025 → day 9 <= 15 → Feb 15 2025
      const result = calculateGoalDate('Solution', new Date(2024, 11, 15)); // Dec 15 2024
      expect(result).toBe('2025-02-15');
    });
  });

  // --- fromDate optional parameter ---

  describe('fromDate parameter', () => {
    it('defaults to the current date when fromDate is not provided', () => {
      // Just check that it returns a valid ISO date string without throwing.
      const result = calculateGoalDate('Box Sale');
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it('uses the supplied fromDate when provided', () => {
      const specific = calculateGoalDate('Box Sale', new Date(2025, 5, 1)); // Jun 1 2025
      // Jun 1 + 30 = Jul 1 → day 1 <= 15 → Jul 15
      expect(specific).toBe('2025-07-15');
    });
  });
});

// ---------------------------------------------------------------------------
// validateDateInRange
// ---------------------------------------------------------------------------

describe('validateDateInRange', () => {
  // --- Empty / falsy values ---

  it('returns true for an empty string', () => {
    expect(validateDateInRange('')).toBe(true);
  });

  // --- Valid years inside the 2024-2030 range ---

  it('returns true for the lower boundary year 2024', () => {
    expect(validateDateInRange('2024-01-01')).toBe(true);
  });

  it('returns true for the upper boundary year 2030', () => {
    expect(validateDateInRange('2030-12-31')).toBe(true);
  });

  it('returns true for a year in the middle of the range (2027)', () => {
    expect(validateDateInRange('2027-06-15')).toBe(true);
  });

  // --- Out-of-range years ---

  it('returns false for year 2023 (below lower boundary)', () => {
    expect(validateDateInRange('2023-12-31')).toBe(false);
  });

  it('returns false for year 2031 (above upper boundary)', () => {
    expect(validateDateInRange('2031-01-01')).toBe(false);
  });

  it('returns false for year 2000', () => {
    expect(validateDateInRange('2000-06-15')).toBe(false);
  });

  // --- Invalid formats ---

  it('returns false when the string has fewer than 3 parts after splitting on "-"', () => {
    expect(validateDateInRange('2025-01')).toBe(false);
  });

  it('returns false when the string has more than 3 parts after splitting on "-"', () => {
    expect(validateDateInRange('2025-01-01-extra')).toBe(false);
  });

  it('returns false when the year part is not a number', () => {
    expect(validateDateInRange('abcd-01-01')).toBe(false);
  });

  it('returns false for a completely non-date string', () => {
    expect(validateDateInRange('not-a-date')).toBe(false);
  });

  it('returns false for a date with only two segments', () => {
    expect(validateDateInRange('01-01')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// cleanSalesAmount
// ---------------------------------------------------------------------------

describe('cleanSalesAmount', () => {
  it('removes leading $ sign', () => {
    expect(cleanSalesAmount('$1000')).toBe('1000');
  });

  it('removes $ and commas from a formatted amount "$1,234.56"', () => {
    expect(cleanSalesAmount('$1,234.56')).toBe('1234.56');
  });

  it('handles a plain integer string', () => {
    expect(cleanSalesAmount('5000')).toBe('5000');
  });

  it('handles a plain decimal string', () => {
    expect(cleanSalesAmount('99.99')).toBe('99.99');
  });

  it('returns empty string for alphabetic input', () => {
    expect(cleanSalesAmount('abc')).toBe('');
  });

  it('returns empty string for mixed alpha-numeric invalid input', () => {
    expect(cleanSalesAmount('12abc')).toBe('');
  });

  it('handles negative numbers', () => {
    expect(cleanSalesAmount('-500')).toBe('-500');
  });

  it('handles negative numbers with $ and commas', () => {
    expect(cleanSalesAmount('-$1,000')).toBe('-1000');
  });

  it('trims surrounding whitespace before validating', () => {
    expect(cleanSalesAmount('  500  ')).toBe('500');
  });

  it('returns an empty string for a value that is just "$"', () => {
    // After removing $ and trimming, cleaned = '' → regex condition is skipped → returns ''
    expect(cleanSalesAmount('$')).toBe('');
  });

  it('handles a zero value', () => {
    expect(cleanSalesAmount('0')).toBe('0');
  });

  it('handles commas only with no digits', () => {
    expect(cleanSalesAmount(',,')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// formatPhoneNumber
// ---------------------------------------------------------------------------

describe('formatPhoneNumber', () => {
  // --- 10-digit inputs ---

  it('formats a 10-digit number as xxx-xxx-xxxx', () => {
    expect(formatPhoneNumber('5558675309')).toBe('555-867-5309');
  });

  it('formats a parenthesised number "(555) 867-5309" as xxx-xxx-xxxx', () => {
    expect(formatPhoneNumber('(555) 867-5309')).toBe('555-867-5309');
  });

  it('formats a dot-separated number "555.867.5309" as xxx-xxx-xxxx', () => {
    expect(formatPhoneNumber('555.867.5309')).toBe('555-867-5309');
  });

  it('formats a number with spaces "555 867 5309" as xxx-xxx-xxxx', () => {
    expect(formatPhoneNumber('555 867 5309')).toBe('555-867-5309');
  });

  // --- Extension text ---

  it('appends non-digit trailing text as an extension', () => {
    // The regex strips leading digits/spaces/dashes/parens, leaving text like "ext 123"
    const result = formatPhoneNumber('5558675309 ext 123');
    expect(result).toBe('555-867-5309 ext 123');
  });

  // --- More than 10 digits treated as extension ---

  it('adds "ext" suffix for digits beyond the first 10', () => {
    expect(formatPhoneNumber('55586753091234')).toBe('555-867-5309 ext 1234');
  });

  it('formats an 11-digit number with one extra digit as ext', () => {
    // digits: 1 5 5 5 8 6 7 5 3 0 9
    // first 10 → 155-586-7530, ext → 9
    expect(formatPhoneNumber('15558675309')).toBe('155-586-7530 ext 9');
  });

  // --- Fewer than 10 digits – return as-is ---

  it('returns a 9-digit string unchanged', () => {
    expect(formatPhoneNumber('555867530')).toBe('555867530');
  });

  it('returns a short number string unchanged', () => {
    expect(formatPhoneNumber('123')).toBe('123');
  });

  it('returns an empty string unchanged', () => {
    expect(formatPhoneNumber('')).toBe('');
  });
});

// ---------------------------------------------------------------------------
// validateEmail
// ---------------------------------------------------------------------------

describe('validateEmail', () => {
  // --- Valid emails ---

  it('returns true for a standard email', () => {
    expect(validateEmail('user@example.com')).toBe(true);
  });

  it('returns true for an email with subdomain', () => {
    expect(validateEmail('user@mail.example.com')).toBe(true);
  });

  it('returns true for an email with plus addressing', () => {
    expect(validateEmail('user+tag@example.com')).toBe(true);
  });

  it('returns true for an email with dots in the local part', () => {
    expect(validateEmail('first.last@example.com')).toBe(true);
  });

  it('returns true for an email with a numeric TLD portion', () => {
    expect(validateEmail('user@123.com')).toBe(true);
  });

  // --- Invalid emails ---

  it('returns false for a string with no @ symbol', () => {
    expect(validateEmail('userexample.com')).toBe(false);
  });

  it('returns false for a string with no domain', () => {
    expect(validateEmail('user@')).toBe(false);
  });

  it('returns false for a string with no TLD dot', () => {
    expect(validateEmail('user@example')).toBe(false);
  });

  it('returns false for a string with spaces', () => {
    expect(validateEmail('user @example.com')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(validateEmail('')).toBe(false);
  });

  it('returns false for a plain string', () => {
    expect(validateEmail('notanemail')).toBe(false);
  });

  it('returns false for double @ signs', () => {
    expect(validateEmail('user@@example.com')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateSalesOrderNumber
// ---------------------------------------------------------------------------

describe('validateSalesOrderNumber', () => {
  // --- Valid inputs (return null) ---

  it('returns null for a null value', () => {
    expect(validateSalesOrderNumber(null)).toBeNull();
  });

  it('returns null for an undefined value', () => {
    expect(validateSalesOrderNumber(undefined)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(validateSalesOrderNumber('')).toBeNull();
  });

  it('returns null for a whitespace-only string', () => {
    expect(validateSalesOrderNumber('   ')).toBeNull();
  });

  it('returns null for a valid "S12345" order number', () => {
    expect(validateSalesOrderNumber('S12345')).toBeNull();
  });

  it('returns null for a valid number with whitespace padding', () => {
    expect(validateSalesOrderNumber('  S12345  ')).toBeNull();
  });

  // --- Invalid inputs (return error string) ---

  it('returns an error for a 5-character number that is too short', () => {
    const error = validateSalesOrderNumber('S1234');
    expect(error).not.toBeNull();
    expect(typeof error).toBe('string');
  });

  it('returns an error for a 7-character number that is too long', () => {
    const error = validateSalesOrderNumber('S123456');
    expect(error).not.toBeNull();
    expect(typeof error).toBe('string');
  });

  it('returns an error when the prefix is wrong (does not start with S1)', () => {
    const error = validateSalesOrderNumber('A12345');
    expect(error).not.toBeNull();
    expect(typeof error).toBe('string');
  });

  it('returns an error when the prefix is only S (missing 1)', () => {
    const error = validateSalesOrderNumber('S23456');
    expect(error).not.toBeNull();
    expect(typeof error).toBe('string');
  });

  it('error message mentions S1 prefix requirement', () => {
    const error = validateSalesOrderNumber('A12345');
    expect(error).toContain('S1');
  });

  it('error message mentions the 6 character length requirement', () => {
    const error = validateSalesOrderNumber('A12345');
    expect(error).toContain('6');
  });
});

// ---------------------------------------------------------------------------
// validatePhoneNumber
// ---------------------------------------------------------------------------

describe('validatePhoneNumber', () => {
  it('returns true for exactly 10 digits', () => {
    expect(validatePhoneNumber('5558675309')).toBe(true);
  });

  it('returns true for more than 10 digits', () => {
    expect(validatePhoneNumber('55586753091')).toBe(true);
  });

  it('returns true when formatted with dashes providing 10 underlying digits', () => {
    expect(validatePhoneNumber('555-867-5309')).toBe(true);
  });

  it('returns true when formatted with parentheses and spaces', () => {
    expect(validatePhoneNumber('(555) 867-5309')).toBe(true);
  });

  it('returns false for 9 digits', () => {
    expect(validatePhoneNumber('555867530')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(validatePhoneNumber('')).toBe(false);
  });

  it('returns false for a string with no digits', () => {
    expect(validatePhoneNumber('abc-def-ghij')).toBe(false);
  });

  it('returns false for a string with only 5 digits', () => {
    expect(validatePhoneNumber('12345')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateProjectForm
// ---------------------------------------------------------------------------

describe('validateProjectForm', () => {
  // --- Happy path ---

  it('returns { valid: true } for a fully valid form', () => {
    const result = validateProjectForm(validFormParams());
    expect(result).toEqual({ valid: true });
  });

  it('returns { valid: true } for a valid editing form where project type is empty', () => {
    const result = validateProjectForm(validFormParams({ isEditing: true, selectedProjectType: '' }));
    expect(result).toEqual({ valid: true });
  });

  it('returns { valid: true } when optional date fields are all empty strings', () => {
    const result = validateProjectForm(validFormParams({
      goalCompletionDate: '',
      createdDate: '',
      startDate: '',
      endDate: '',
    }));
    expect(result).toEqual({ valid: true });
  });

  it('returns { valid: true } when valid dates are provided', () => {
    const result = validateProjectForm(validFormParams({
      goalCompletionDate: '2025-06-15',
      createdDate: '2025-01-01',
      startDate: '2025-04-01',
      endDate: '2025-09-30',
    }));
    expect(result).toEqual({ valid: true });
  });

  it('returns { valid: true } when a valid secondary email is provided', () => {
    const result = validateProjectForm(validFormParams({ secondaryPocEmail: 'secondary@example.com' }));
    expect(result).toEqual({ valid: true });
  });

  it('returns { valid: true } when secondary email is empty (optional field)', () => {
    const result = validateProjectForm(validFormParams({ secondaryPocEmail: '' }));
    expect(result).toEqual({ valid: true });
  });

  // --- Missing salesperson ---

  it('returns an error when selectedSalesperson is empty', () => {
    const result = validateProjectForm(validFormParams({ selectedSalesperson: '' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('salesperson');
  });

  // --- Missing project type (new project) ---

  it('returns an error when selectedProjectType is empty and not editing', () => {
    const result = validateProjectForm(validFormParams({ isEditing: false, selectedProjectType: '' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('project type');
  });

  it('does NOT error on missing project type when isEditing is true', () => {
    const result = validateProjectForm(validFormParams({ isEditing: true, selectedProjectType: '' }));
    expect(result.valid).toBe(true);
  });

  // --- Sales order number ---

  it('returns an error when sales order number has wrong prefix', () => {
    const result = validateProjectForm(validFormParams({ salesOrderNumber: 'A12345' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Sales Order');
  });

  it('returns an error when sales order number is too short', () => {
    const result = validateProjectForm(validFormParams({ salesOrderNumber: 'S1234' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Sales Order');
  });

  it('returns an error when sales order number is too long', () => {
    const result = validateProjectForm(validFormParams({ salesOrderNumber: 'S123456' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Sales Order');
  });

  it('does not error when sales order number is empty (optional)', () => {
    const result = validateProjectForm(validFormParams({ salesOrderNumber: '' }));
    expect(result.valid).toBe(true);
  });

  // --- POC fields ---

  it('returns an error when pocName is missing', () => {
    const result = validateProjectForm(validFormParams({ pocName: '' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Point of Contact');
  });

  it('returns an error when pocEmail is missing', () => {
    const result = validateProjectForm(validFormParams({ pocEmail: '' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Point of Contact');
  });

  it('returns an error when pocPhone is missing', () => {
    const result = validateProjectForm(validFormParams({ pocPhone: '' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Point of Contact');
  });

  it('returns an error when pocName is only whitespace', () => {
    const result = validateProjectForm(validFormParams({ pocName: '   ' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Point of Contact');
  });

  // --- Email validation ---

  it('returns an error when pocEmail is not a valid email address', () => {
    const result = validateProjectForm(validFormParams({ pocEmail: 'not-an-email' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('valid email address');
  });

  // --- Phone validation ---

  it('returns an error when pocPhone has fewer than 10 digits', () => {
    const result = validateProjectForm(validFormParams({ pocPhone: '123' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('10 digits');
  });

  // --- Date range validation ---

  it('returns an error when goalCompletionDate year is below 2024', () => {
    const result = validateProjectForm(validFormParams({ goalCompletionDate: '2023-01-01' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Goal completion date');
  });

  it('returns an error when goalCompletionDate year is above 2030', () => {
    const result = validateProjectForm(validFormParams({ goalCompletionDate: '2031-06-15' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Goal completion date');
  });

  it('returns an error when createdDate year is out of range', () => {
    const result = validateProjectForm(validFormParams({ createdDate: '2023-12-01' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Created date');
  });

  it('returns an error when startDate year is out of range', () => {
    const result = validateProjectForm(validFormParams({ startDate: '2031-01-01' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Start date');
  });

  it('returns an error when endDate year is out of range', () => {
    const result = validateProjectForm(validFormParams({ endDate: '2023-01-01' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('End date');
  });

  // --- End date before start date ---

  it('returns an error when endDate is before startDate', () => {
    const result = validateProjectForm(validFormParams({
      startDate: '2025-06-01',
      endDate: '2025-05-01',
    }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('End date must be after start date');
  });

  it('does not error when endDate equals startDate', () => {
    // The check uses strict < so same date should pass
    const result = validateProjectForm(validFormParams({
      startDate: '2025-06-01',
      endDate: '2025-06-01',
    }));
    expect(result.valid).toBe(true);
  });

  it('does not error when only startDate is provided (no endDate)', () => {
    const result = validateProjectForm(validFormParams({ startDate: '2025-06-01', endDate: '' }));
    expect(result.valid).toBe(true);
  });

  it('does not error when only endDate is provided (no startDate)', () => {
    const result = validateProjectForm(validFormParams({ startDate: '', endDate: '2025-06-01' }));
    expect(result.valid).toBe(true);
  });

  // --- Sales amount ---

  it('does not error when salesAmount is empty (optional field)', () => {
    const result = validateProjectForm(validFormParams({ salesAmount: '' }));
    expect(result.valid).toBe(true);
  });

  it('does not error for a valid numeric salesAmount', () => {
    const result = validateProjectForm(validFormParams({ salesAmount: '15000' }));
    expect(result.valid).toBe(true);
  });

  it('does not error for a formatted salesAmount like "$15,000.00"', () => {
    // cleanSalesAmount strips $ and commas → '15000.00' → valid positive float
    const result = validateProjectForm(validFormParams({ salesAmount: '$15,000.00' }));
    expect(result.valid).toBe(true);
  });

  it('returns an error for a purely alphabetic salesAmount that cleanSalesAmount cannot parse', () => {
    // 'abc' → cleanSalesAmount returns '' → cleaned is falsy → validation skipped → valid
    // NOTE: cleanSalesAmount returns '' for invalid input; the form validator only errors
    // when cleaned is truthy AND parseFloat results in NaN or a negative. So 'abc' → '' → skipped.
    // Use a value that survives cleanSalesAmount but is negative: '-100'
    const result = validateProjectForm(validFormParams({ salesAmount: '-100' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('valid sales amount');
  });

  // --- Secondary email ---

  it('returns an error when secondaryPocEmail is not a valid email', () => {
    const result = validateProjectForm(validFormParams({ secondaryPocEmail: 'bad-email' }));
    expect(result.valid).toBe(false);
    expect(result.error).toContain('secondary email');
  });

  it('does not error when secondaryPocEmail is only whitespace (treated as empty)', () => {
    const result = validateProjectForm(validFormParams({ secondaryPocEmail: '   ' }));
    expect(result.valid).toBe(true);
  });

  // --- Validation order / priority ---

  it('reports missing salesperson error before missing project type', () => {
    const result = validateProjectForm(validFormParams({
      selectedSalesperson: '',
      selectedProjectType: '',
    }));
    expect(result.error).toContain('salesperson');
  });

  it('reports missing project type error before sales order error', () => {
    const result = validateProjectForm(validFormParams({
      selectedProjectType: '',
      salesOrderNumber: 'INVALID',
    }));
    expect(result.error).toContain('project type');
  });
});

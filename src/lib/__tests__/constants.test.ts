import { describe, it, expect } from 'vitest';
import {
  APP_NAME,
  LOGO_URL,
  BRAND_COLORS,
  CONTRACT_TYPES,
  DEFAULT_STATUSES,
  USER_ROLES,
  EXPECTED_UPDATE_DAYS_BEFORE,
} from '../constants';

// ---------------------------------------------------------------------------
// APP_NAME
// ---------------------------------------------------------------------------

describe('APP_NAME', () => {
  it('is the string "Amitrace"', () => {
    expect(APP_NAME).toBe('Amitrace');
  });

  it('is a non-empty string', () => {
    expect(typeof APP_NAME).toBe('string');
    expect(APP_NAME.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// LOGO_URL
// ---------------------------------------------------------------------------

describe('LOGO_URL', () => {
  it('is a non-empty string', () => {
    expect(typeof LOGO_URL).toBe('string');
    expect(LOGO_URL.length).toBeGreaterThan(0);
  });

  it('starts with https://', () => {
    expect(LOGO_URL.startsWith('https://')).toBe(true);
  });

  it('is a valid URL', () => {
    expect(() => new URL(LOGO_URL)).not.toThrow();
  });

  it('contains the amitrace domain', () => {
    expect(LOGO_URL).toContain('amitrace.com');
  });

  it('ends with a recognised image extension', () => {
    const lower = LOGO_URL.toLowerCase();
    const hasImageExtension = ['.png', '.jpg', '.jpeg', '.webp', '.svg', '.gif'].some((ext) =>
      lower.endsWith(ext)
    );
    expect(hasImageExtension).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// BRAND_COLORS
// ---------------------------------------------------------------------------

const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

describe('BRAND_COLORS', () => {
  it('has a "primary" hex color', () => {
    expect(BRAND_COLORS.primary).toMatch(HEX_COLOR_RE);
  });

  it('primary is #023A2D', () => {
    expect(BRAND_COLORS.primary).toBe('#023A2D');
  });

  it('has a "primaryLight" hex color', () => {
    expect(BRAND_COLORS.primaryLight).toMatch(HEX_COLOR_RE);
  });

  it('primaryLight is #035544', () => {
    expect(BRAND_COLORS.primaryLight).toBe('#035544');
  });

  it('has a "primaryDark" hex color', () => {
    expect(BRAND_COLORS.primaryDark).toMatch(HEX_COLOR_RE);
  });

  it('primaryDark is #012219', () => {
    expect(BRAND_COLORS.primaryDark).toBe('#012219');
  });

  it('has a "white" hex color', () => {
    expect(BRAND_COLORS.white).toMatch(HEX_COLOR_RE);
  });

  it('white is #FFFFFF', () => {
    expect(BRAND_COLORS.white).toBe('#FFFFFF');
  });

  it('has a "gray" object', () => {
    expect(typeof BRAND_COLORS.gray).toBe('object');
    expect(BRAND_COLORS.gray).not.toBeNull();
  });

  it('gray has all 10 shade keys (50, 100 … 900)', () => {
    const expectedShades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
    for (const shade of expectedShades) {
      expect(BRAND_COLORS.gray).toHaveProperty(String(shade));
    }
  });

  it('every gray shade is a valid hex color', () => {
    const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const;
    for (const shade of shades) {
      expect(BRAND_COLORS.gray[shade], `gray[${shade}]`).toMatch(HEX_COLOR_RE);
    }
  });

  it('gray shades have the correct values', () => {
    expect(BRAND_COLORS.gray[50]).toBe('#F9FAFB');
    expect(BRAND_COLORS.gray[100]).toBe('#F3F4F6');
    expect(BRAND_COLORS.gray[200]).toBe('#E5E7EB');
    expect(BRAND_COLORS.gray[300]).toBe('#D1D5DB');
    expect(BRAND_COLORS.gray[400]).toBe('#9CA3AF');
    expect(BRAND_COLORS.gray[500]).toBe('#6B7280');
    expect(BRAND_COLORS.gray[600]).toBe('#4B5563');
    expect(BRAND_COLORS.gray[700]).toBe('#374151');
    expect(BRAND_COLORS.gray[800]).toBe('#1F2937');
    expect(BRAND_COLORS.gray[900]).toBe('#111827');
  });
});

// ---------------------------------------------------------------------------
// CONTRACT_TYPES
// ---------------------------------------------------------------------------

describe('CONTRACT_TYPES', () => {
  it('has exactly 4 items', () => {
    expect(CONTRACT_TYPES).toHaveLength(4);
  });

  it('first item is "None"', () => {
    expect(CONTRACT_TYPES[0]).toBe('None');
  });

  it('contains "South Carolina Purchasing"', () => {
    expect(CONTRACT_TYPES).toContain('South Carolina Purchasing');
  });

  it('contains "TIPs Contract"', () => {
    expect(CONTRACT_TYPES).toContain('TIPs Contract');
  });

  it('contains "State of Georgia Purchasing Agreement"', () => {
    expect(CONTRACT_TYPES).toContain('State of Georgia Purchasing Agreement');
  });

  it('every item is a non-empty string', () => {
    for (const type of CONTRACT_TYPES) {
      expect(typeof type).toBe('string');
      expect(type.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// DEFAULT_STATUSES
// ---------------------------------------------------------------------------

describe('DEFAULT_STATUSES', () => {
  it('has exactly 8 entries', () => {
    expect(DEFAULT_STATUSES).toHaveLength(8);
  });

  it('display_order values are sequential starting from 1', () => {
    const orders = DEFAULT_STATUSES.map((s) => s.display_order);
    orders.forEach((order, idx) => {
      expect(order).toBe(idx + 1);
    });
  });

  it('only "Hold" has require_note set to true', () => {
    const requireNoteEntries = DEFAULT_STATUSES.filter((s) => s.require_note);
    expect(requireNoteEntries).toHaveLength(1);
    expect(requireNoteEntries[0].name).toBe('Hold');
  });

  it('all other statuses have require_note set to false', () => {
    const nonHold = DEFAULT_STATUSES.filter((s) => s.name !== 'Hold');
    for (const status of nonHold) {
      expect(status.require_note).toBe(false);
    }
  });

  it('contains expected status names in order', () => {
    const names = DEFAULT_STATUSES.map((s) => s.name);
    expect(names).toEqual([
      'PO Received',
      'Engineering Review',
      'In Procurement',
      'Pending Scheduling',
      'Scheduled',
      'IP',
      'Hold',
      'Invoiced',
    ]);
  });

  it('every status has a name, display_order, and require_note field', () => {
    for (const status of DEFAULT_STATUSES) {
      expect(status).toHaveProperty('name');
      expect(status).toHaveProperty('display_order');
      expect(status).toHaveProperty('require_note');
    }
  });

  it('first status is "PO Received" with display_order 1', () => {
    expect(DEFAULT_STATUSES[0].name).toBe('PO Received');
    expect(DEFAULT_STATUSES[0].display_order).toBe(1);
  });

  it('last status is "Invoiced" with display_order 8', () => {
    const last = DEFAULT_STATUSES[DEFAULT_STATUSES.length - 1];
    expect(last.name).toBe('Invoiced');
    expect(last.display_order).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// USER_ROLES
// ---------------------------------------------------------------------------

describe('USER_ROLES', () => {
  it('has exactly 3 roles', () => {
    expect(USER_ROLES).toHaveLength(3);
  });

  it('contains "viewer"', () => {
    expect(USER_ROLES).toContain('viewer');
  });

  it('contains "editor"', () => {
    expect(USER_ROLES).toContain('editor');
  });

  it('contains "admin"', () => {
    expect(USER_ROLES).toContain('admin');
  });

  it('roles are in the correct order: viewer, editor, admin', () => {
    expect(USER_ROLES[0]).toBe('viewer');
    expect(USER_ROLES[1]).toBe('editor');
    expect(USER_ROLES[2]).toBe('admin');
  });
});

// ---------------------------------------------------------------------------
// EXPECTED_UPDATE_DAYS_BEFORE
// ---------------------------------------------------------------------------

describe('EXPECTED_UPDATE_DAYS_BEFORE', () => {
  it('is the number 7', () => {
    expect(EXPECTED_UPDATE_DAYS_BEFORE).toBe(7);
  });

  it('is a positive integer', () => {
    expect(typeof EXPECTED_UPDATE_DAYS_BEFORE).toBe('number');
    expect(EXPECTED_UPDATE_DAYS_BEFORE).toBeGreaterThan(0);
    expect(Number.isInteger(EXPECTED_UPDATE_DAYS_BEFORE)).toBe(true);
  });
});

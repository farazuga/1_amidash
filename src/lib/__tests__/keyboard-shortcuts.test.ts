import { describe, it, expect } from 'vitest';
import {
  GLOBAL_SHORTCUTS,
  ADMIN_SHORTCUTS,
  CALENDAR_SHORTCUTS,
  PROJECTS_SHORTCUTS,
  PROJECT_DETAIL_SHORTCUTS,
} from '../keyboard-shortcuts';

describe('keyboard-shortcuts', () => {
  it('exports global shortcuts with required fields', () => {
    expect(GLOBAL_SHORTCUTS.length).toBeGreaterThan(0);
    for (const s of GLOBAL_SHORTCUTS) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('keys');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('section');
    }
  });

  it('has no duplicate shortcut ids across all groups', () => {
    const all = [
      ...GLOBAL_SHORTCUTS,
      ...ADMIN_SHORTCUTS,
      ...CALENDAR_SHORTCUTS,
      ...PROJECTS_SHORTCUTS,
      ...PROJECT_DETAIL_SHORTCUTS,
    ];
    const ids = all.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('navigation shortcuts use G-then-X chord pattern', () => {
    const navShortcuts = GLOBAL_SHORTCUTS.filter((s) => s.section === 'Navigation');
    for (const s of navShortcuts) {
      expect(s.keys).toMatch(/^g /);
    }
  });
});

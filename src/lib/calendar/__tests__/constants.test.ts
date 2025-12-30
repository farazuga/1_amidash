import { describe, it, expect } from 'vitest';
import {
  BOOKING_STATUS_CONFIG,
  BOOKING_STATUS_ORDER,
  BOOKING_STATUS_CYCLE,
  DEFAULT_WORKING_HOURS,
  WEEKDAYS,
  WEEKDAYS_FULL,
  MONTHS,
} from '../constants';
import type { BookingStatus } from '@/types/calendar';

describe('Calendar Constants', () => {
  describe('BOOKING_STATUS_CONFIG', () => {
    it('has exactly 4 status entries', () => {
      const statuses = Object.keys(BOOKING_STATUS_CONFIG);
      expect(statuses).toHaveLength(4);
    });

    it('contains all expected statuses', () => {
      const expectedStatuses: BookingStatus[] = ['draft', 'tentative', 'pending_confirm', 'confirmed'];
      expectedStatuses.forEach((status) => {
        expect(BOOKING_STATUS_CONFIG).toHaveProperty(status);
      });
    });

    it('does not contain complete status', () => {
      expect(BOOKING_STATUS_CONFIG).not.toHaveProperty('complete');
    });

    it('each status has required properties', () => {
      const requiredProps = [
        'label',
        'shortLabel',
        'bgColor',
        'textColor',
        'borderColor',
        'dotColor',
        'description',
        'visibleToEngineers',
      ];

      Object.values(BOOKING_STATUS_CONFIG).forEach((config) => {
        requiredProps.forEach((prop) => {
          expect(config).toHaveProperty(prop);
        });
      });
    });

    it('draft is not visible to engineers', () => {
      expect(BOOKING_STATUS_CONFIG.draft.visibleToEngineers).toBe(false);
    });

    it('other statuses are visible to engineers', () => {
      expect(BOOKING_STATUS_CONFIG.tentative.visibleToEngineers).toBe(true);
      expect(BOOKING_STATUS_CONFIG.pending_confirm.visibleToEngineers).toBe(true);
      expect(BOOKING_STATUS_CONFIG.confirmed.visibleToEngineers).toBe(true);
    });

    it('has correct short labels', () => {
      expect(BOOKING_STATUS_CONFIG.draft.shortLabel).toBe('D');
      expect(BOOKING_STATUS_CONFIG.tentative.shortLabel).toBe('T');
      expect(BOOKING_STATUS_CONFIG.pending_confirm.shortLabel).toBe('PC');
      expect(BOOKING_STATUS_CONFIG.confirmed.shortLabel).toBe('C');
    });
  });

  describe('BOOKING_STATUS_ORDER', () => {
    it('has 4 entries', () => {
      expect(BOOKING_STATUS_ORDER).toHaveLength(4);
    });

    it('confirmed is first (highest priority)', () => {
      expect(BOOKING_STATUS_ORDER[0]).toBe('confirmed');
    });

    it('draft is last (lowest priority)', () => {
      expect(BOOKING_STATUS_ORDER[BOOKING_STATUS_ORDER.length - 1]).toBe('draft');
    });

    it('does not contain complete', () => {
      expect(BOOKING_STATUS_ORDER).not.toContain('complete');
    });
  });

  describe('BOOKING_STATUS_CYCLE', () => {
    it('has 3 entries (skips pending_confirm)', () => {
      expect(BOOKING_STATUS_CYCLE).toHaveLength(3);
    });

    it('starts with draft', () => {
      expect(BOOKING_STATUS_CYCLE[0]).toBe('draft');
    });

    it('ends with confirmed', () => {
      expect(BOOKING_STATUS_CYCLE[BOOKING_STATUS_CYCLE.length - 1]).toBe('confirmed');
    });

    it('does not contain pending_confirm (requires confirmation flow)', () => {
      expect(BOOKING_STATUS_CYCLE).not.toContain('pending_confirm');
    });

    it('does not contain complete', () => {
      expect(BOOKING_STATUS_CYCLE).not.toContain('complete');
    });

    it('has correct order: draft -> tentative -> confirmed', () => {
      expect(BOOKING_STATUS_CYCLE).toEqual(['draft', 'tentative', 'confirmed']);
    });
  });

  describe('DEFAULT_WORKING_HOURS', () => {
    it('has start time of 07:00', () => {
      expect(DEFAULT_WORKING_HOURS.start).toBe('07:00');
    });

    it('has end time of 16:00', () => {
      expect(DEFAULT_WORKING_HOURS.end).toBe('16:00');
    });
  });

  describe('WEEKDAYS', () => {
    it('has 5 weekdays (no weekends)', () => {
      expect(WEEKDAYS).toHaveLength(5);
    });

    it('starts with Monday', () => {
      expect(WEEKDAYS[0]).toBe('Mon');
    });

    it('ends with Friday', () => {
      expect(WEEKDAYS[4]).toBe('Fri');
    });

    it('does not include Saturday', () => {
      expect(WEEKDAYS).not.toContain('Sat');
    });

    it('does not include Sunday', () => {
      expect(WEEKDAYS).not.toContain('Sun');
    });
  });

  describe('WEEKDAYS_FULL', () => {
    it('has 5 weekdays (no weekends)', () => {
      expect(WEEKDAYS_FULL).toHaveLength(5);
    });

    it('starts with Monday', () => {
      expect(WEEKDAYS_FULL[0]).toBe('Monday');
    });

    it('ends with Friday', () => {
      expect(WEEKDAYS_FULL[4]).toBe('Friday');
    });

    it('does not include Saturday', () => {
      expect(WEEKDAYS_FULL).not.toContain('Saturday');
    });

    it('does not include Sunday', () => {
      expect(WEEKDAYS_FULL).not.toContain('Sunday');
    });
  });

  describe('MONTHS', () => {
    it('has 12 months', () => {
      expect(MONTHS).toHaveLength(12);
    });

    it('starts with January', () => {
      expect(MONTHS[0]).toBe('January');
    });

    it('ends with December', () => {
      expect(MONTHS[11]).toBe('December');
    });
  });
});

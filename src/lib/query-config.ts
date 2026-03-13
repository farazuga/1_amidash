/**
 * Centralized TanStack Query configuration constants.
 * Use these instead of hardcoding stale times in individual hooks.
 */
export const STALE_TIMES = {
  /** For real-time or frequently changing data (calendar, assignments) */
  REALTIME: 30 * 1000,
  /** For moderately changing data (audit logs, admin users) */
  STANDARD: 60 * 1000,
  /** For slowly changing data (tags, project types, statuses) */
  SLOW: 5 * 60 * 1000,
} as const;

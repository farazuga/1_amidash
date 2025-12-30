# ProjectCalendarMonthView Test Architecture

This directory contains the test suite for the `ProjectCalendarMonthView` component, which renders a Gantt-style month calendar view with project bars spanning across weekdays.

## Architecture Overview

### File Structure

```
__tests__/
├── README.md                           # This file - test architecture documentation
├── test-setup.ts                       # Test factories, fixtures, and utilities
├── project-calendar-month-view.test.tsx # Main component tests (to be created)
└── integration.test.tsx                # Integration tests (to be created)
```

## Test Setup (`test-setup.ts`)

The test setup file provides a comprehensive testing infrastructure following established patterns from the codebase.

### Date Utilities

Utilities for working with dates in tests:

```typescript
import { toISODate, dateOffset, getFirstMonday, createDateRange } from './test-setup';

// Convert Date to ISO string
const isoDate = toISODate(new Date(2024, 0, 15)); // "2024-01-15"

// Create date relative to reference
const futureDate = dateOffset(new Date(2024, 0, 1), 5); // Jan 6, 2024
const pastDate = dateOffset(new Date(2024, 0, 15), -3); // Jan 12, 2024

// Get first Monday of a month
const firstMonday = getFirstMonday(new Date(2024, 0, 15)); // Jan 1, 2024

// Create a date range
const range = createDateRange(startDate, endDate); // { start: "2024-01-01", end: "2024-01-05" }

// Get only weekdays in range
const weekdays = getWeekdaysInRange(startDate, endDate); // [Mon, Tue, Wed, Thu, Fri]
```

### Test Data Factories

Factories for creating test data with sensible defaults:

#### Creating Test Users

```typescript
import { createTestUser } from './test-setup';

// Auto-generated user
const user = createTestUser();
// { id: 'user-abc123', full_name: 'Test User abc1' }

// Custom user
const alice = createTestUser({ id: 'user-alice', full_name: 'Alice Engineer' });
```

#### Creating Test Assignments

```typescript
import { createTestAssignment, createTestUser } from './test-setup';

// Auto-generated assignment
const assignment = createTestAssignment();

// Assignment with specific user
const alice = createTestUser({ full_name: 'Alice Engineer' });
const assignment = createTestAssignment({
  user: alice,
  user_id: alice.id,
});
```

#### Creating Test Projects

```typescript
import { createTestProject, createTestAssignment } from './test-setup';

// Simple project with defaults
const project = createTestProject();

// Custom project
const project = createTestProject({
  client_name: 'Acme Corp',
  start_date: '2024-01-15',
  end_date: '2024-01-19',
  schedule_status: 'confirmed',
  assignments: [
    createTestAssignment({ user: alice }),
    createTestAssignment({ user: bob }),
  ],
});

// Multi-week project
const project = createMultiWeekProject({
  startWeek: 0,        // First week of month
  duration: 3,         // 3 weeks
  currentMonth: new Date(2024, 0, 15),
  client_name: 'Long Project',
  schedule_status: 'confirmed',
});

// Overlapping projects (for conflict testing)
const [project1, project2] = createOverlappingProjects({
  startDate: new Date(2024, 0, 15),
  engineer: alice,
  currentMonth: new Date(2024, 0, 15),
});
```

### Test Fixtures

Pre-configured test scenarios for common use cases:

#### Month Fixtures

```typescript
import { JANUARY_2024_FIXTURE, FEBRUARY_2024_FIXTURE } from './test-setup';

// January 2024 metadata
console.log(JANUARY_2024_FIXTURE);
// {
//   currentMonth: Date(2024, 0, 15),
//   firstMonday: Date(2024, 0, 1),
//   lastFriday: Date(2024, 1, 2),
//   totalWeeks: 5,
//   weekdaysCount: 25
// }
```

#### Scenario Fixtures

```typescript
import {
  createEmptyMonthFixture,
  createSingleProjectFixture,
  createMultipleProjectsFixture,
  createConflictFixture,
  createLongProjectFixture,
  createMixedStatusFixture,
  TEST_ENGINEERS,
} from './test-setup';

// Empty month - no projects
const fixture = createEmptyMonthFixture(new Date(2024, 0, 15));

// Single project
const fixture = createSingleProjectFixture(new Date(2024, 0, 15));
// Returns: { currentMonth, projects: [project] }

// Multiple non-overlapping projects
const fixture = createMultipleProjectsFixture(new Date(2024, 0, 15));
// Returns: { currentMonth, projects: [project1, project2, project3] }

// Overlapping projects (conflict)
const fixture = createConflictFixture(new Date(2024, 0, 15));
// Returns: { currentMonth, projects: [project1, project2], conflictingEngineer }

// Long project spanning multiple weeks
const fixture = createLongProjectFixture(new Date(2024, 0, 15));

// Projects with different statuses
const fixture = createMixedStatusFixture(new Date(2024, 0, 15));
// Returns projects with: draft, tentative, pending_confirm, confirmed

// Pre-defined engineers
console.log(TEST_ENGINEERS);
// {
//   alice: { id: 'user-alice', full_name: 'Alice Engineer' },
//   bob: { id: 'user-bob', full_name: 'Bob Developer' },
//   charlie: { id: 'user-charlie', full_name: 'Charlie Tech' }
// }
```

### Mock Setup

Setup mocks for external dependencies:

```typescript
import { setupComponentMocks, resetComponentMocks } from './test-setup';
import { describe, beforeAll, afterEach } from 'vitest';

describe('ProjectCalendarMonthView', () => {
  beforeAll(() => {
    setupComponentMocks(); // Setup all mocks
  });

  afterEach(() => {
    resetComponentMocks(); // Clear mocks between tests
  });

  // Your tests here
});
```

Mocks provided:
- `BOOKING_STATUS_CONFIG` - Status configuration constants
- `next/link` - Next.js Link component
- `@/components/ui/tooltip` - Tooltip components
- `lucide-react` - Icons
- `@/lib/utils` - Utility functions (cn)

### Assertion Helpers

Helper functions for testing component output:

```typescript
import {
  assertBarPosition,
  getProjectBar,
  countProjectBars,
  hasConflictIndicator,
} from './test-setup';

// Assert bar positioning
const bar = screen.getByText('Acme Corp').closest('a');
assertBarPosition(bar, expect, {
  left: '0%',
  width: '20%',
  top: '0px',
});

// Get project bar by name
const bar = getProjectBar(container, 'Acme Corp');

// Count visible bars
const count = countProjectBars(container);
expect(count).toBe(3);

// Check for conflict indicator
const bar = screen.getByText('Project A').closest('a');
expect(hasConflictIndicator(bar)).toBe(true);
```

## Test Patterns

### Following Established Patterns

The test architecture follows patterns from existing tests:

1. **Vitest + React Testing Library** (from `src/components/dashboard/__tests__/charts.test.tsx`)
   - Use `render`, `screen`, `expect` from `@testing-library/react`
   - Use `describe`, `it`, `expect`, `vi`, `beforeEach`, `afterEach` from `vitest`

2. **Date Manipulation** (from `src/lib/calendar/__tests__/utils.test.ts`)
   - Use `date-fns` for date operations
   - Use `vi.useFakeTimers()` when testing "today" scenarios
   - Convert dates to ISO format for consistency

3. **Mock Strategy** (from `src/app/(dashboard)/calendar/__tests__/actions.test.ts`)
   - Mock external dependencies using `vi.mock()`
   - Create mock implementations in `beforeEach`
   - Reset mocks in `afterEach`

4. **Test Organization**
   - Group related tests with `describe` blocks
   - Use descriptive test names with `it('should...')`
   - Test happy paths and edge cases

## Example Test Structure

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectCalendarMonthView } from '../project-calendar-month-view';
import {
  setupComponentMocks,
  resetComponentMocks,
  createSingleProjectFixture,
  createMultipleProjectsFixture,
  createConflictFixture,
  JANUARY_2024_FIXTURE,
  countProjectBars,
} from './test-setup';

describe('ProjectCalendarMonthView', () => {
  beforeAll(() => {
    setupComponentMocks();
  });

  afterEach(() => {
    resetComponentMocks();
  });

  describe('Basic Rendering', () => {
    it('renders day headers for weekdays only', () => {
      const { currentMonth, projects } = createSingleProjectFixture(
        JANUARY_2024_FIXTURE.currentMonth
      );

      render(
        <ProjectCalendarMonthView
          projects={projects}
          currentMonth={currentMonth}
        />
      );

      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.queryByText('Sat')).not.toBeInTheDocument();
      expect(screen.queryByText('Sun')).not.toBeInTheDocument();
    });

    it('renders correct number of weeks', () => {
      const { currentMonth, projects } = createSingleProjectFixture(
        JANUARY_2024_FIXTURE.currentMonth
      );

      const { container } = render(
        <ProjectCalendarMonthView
          projects={projects}
          currentMonth={currentMonth}
        />
      );

      const weeks = container.querySelectorAll('.border-b.last\\:border-b-0');
      expect(weeks).toHaveLength(JANUARY_2024_FIXTURE.totalWeeks);
    });
  });

  describe('Project Bars', () => {
    it('renders single project bar', () => {
      const { currentMonth, projects } = createSingleProjectFixture(
        JANUARY_2024_FIXTURE.currentMonth
      );

      const { container } = render(
        <ProjectCalendarMonthView
          projects={projects}
          currentMonth={currentMonth}
        />
      );

      expect(countProjectBars(container)).toBe(1);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });

    it('renders multiple non-overlapping projects', () => {
      const { currentMonth, projects } = createMultipleProjectsFixture(
        JANUARY_2024_FIXTURE.currentMonth
      );

      const { container } = render(
        <ProjectCalendarMonthView
          projects={projects}
          currentMonth={currentMonth}
        />
      );

      expect(countProjectBars(container)).toBe(3);
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
      expect(screen.getByText('Beta Inc')).toBeInTheDocument();
      expect(screen.getByText('Gamma LLC')).toBeInTheDocument();
    });
  });

  describe('Conflict Detection', () => {
    it('shows conflict indicator for overlapping assignments', () => {
      const { currentMonth, projects } = createConflictFixture(
        JANUARY_2024_FIXTURE.currentMonth
      );

      render(
        <ProjectCalendarMonthView
          projects={projects}
          currentMonth={currentMonth}
        />
      );

      // Both projects should show conflict indicators
      const conflictIcons = screen.getAllByTestId('alert-triangle-icon');
      expect(conflictIcons).toHaveLength(2);
    });
  });
});
```

## Test Coverage Goals

### Component Rendering
- ✓ Day headers (Mon-Fri only)
- ✓ Week grid structure
- ✓ Day numbers
- ✓ Today indicator
- ✓ Month boundary styling

### Project Bars
- ✓ Single project rendering
- ✓ Multiple non-overlapping projects
- ✓ Project spanning multiple weeks
- ✓ Bar positioning (left, width, top)
- ✓ Bar styling by status
- ✓ Rounded corners (start/end)
- ✓ Border handling for continued bars

### Conflict Detection
- ✓ Engineer double-booking detection
- ✓ Conflict indicator display
- ✓ Conflict ring styling

### Edge Cases
- ✓ Empty month (no projects)
- ✓ Project starting before month
- ✓ Project ending after month
- ✓ Projects with no assignments
- ✓ Month with 4 vs 5 vs 6 weeks
- ✓ Leap year February
- ✓ Maximum rows safety limit

### Status Handling
- ✓ Draft status styling
- ✓ Tentative status styling
- ✓ Pending confirmation styling
- ✓ Confirmed status styling

### Interactions
- ✓ Clickable project bars (Link to project page)
- ✓ Tooltip content
- ✓ Tooltip with assignment details

## Running Tests

```bash
# Run all tests
npm test

# Run only ProjectCalendarMonthView tests
npm test -- src/app/\(dashboard\)/project-calendar

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Next Steps

1. Create `project-calendar-month-view.test.tsx` using the test setup
2. Create `integration.test.tsx` for complex scenarios
3. Achieve >90% test coverage
4. Add performance tests for large project counts
5. Add accessibility tests

## References

- Main component: `/Users/faraz/Desktop/1_amidash/src/app/(dashboard)/project-calendar/project-calendar-month-view.tsx`
- Test setup: `/Users/faraz/Desktop/1_amidash/src/app/(dashboard)/project-calendar/__tests__/test-setup.ts`
- Similar tests: `/Users/faraz/Desktop/1_amidash/src/lib/calendar/__tests__/utils.test.ts`
- Calendar types: `/Users/faraz/Desktop/1_amidash/src/types/calendar.ts`

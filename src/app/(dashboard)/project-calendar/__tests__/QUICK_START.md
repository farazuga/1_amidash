# Quick Start Guide - ProjectCalendarMonthView Tests

This guide helps you quickly write tests for the ProjectCalendarMonthView component.

## Basic Test Template

```typescript
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProjectCalendarMonthView } from '../project-calendar-month-view';
import {
  setupComponentMocks,
  resetComponentMocks,
  createSingleProjectFixture,
  JANUARY_2024_FIXTURE,
} from './test-setup';

describe('ProjectCalendarMonthView', () => {
  beforeAll(() => {
    setupComponentMocks();
  });

  afterEach(() => {
    resetComponentMocks();
  });

  it('renders a single project', () => {
    const { currentMonth, projects } = createSingleProjectFixture(
      JANUARY_2024_FIXTURE.currentMonth
    );

    render(
      <ProjectCalendarMonthView
        projects={projects}
        currentMonth={currentMonth}
      />
    );

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });
});
```

## Common Test Patterns

### 1. Testing Empty State

```typescript
it('renders empty month', () => {
  const { currentMonth, projects } = createEmptyMonthFixture(
    JANUARY_2024_FIXTURE.currentMonth
  );

  const { container } = render(
    <ProjectCalendarMonthView
      projects={projects}
      currentMonth={currentMonth}
    />
  );

  expect(countProjectBars(container)).toBe(0);
});
```

### 2. Testing Multiple Projects

```typescript
it('renders multiple projects', () => {
  const { currentMonth, projects } = createMultipleProjectsFixture(
    JANUARY_2024_FIXTURE.currentMonth
  );

  render(
    <ProjectCalendarMonthView
      projects={projects}
      currentMonth={currentMonth}
    />
  );

  expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  expect(screen.getByText('Beta Inc')).toBeInTheDocument();
  expect(screen.getByText('Gamma LLC')).toBeInTheDocument();
});
```

### 3. Testing Conflict Detection

```typescript
it('shows conflict indicator', () => {
  const { currentMonth, projects, conflictingEngineer } = createConflictFixture(
    JANUARY_2024_FIXTURE.currentMonth
  );

  render(
    <ProjectCalendarMonthView
      projects={projects}
      currentMonth={currentMonth}
    />
  );

  const conflictIcons = screen.getAllByTestId('alert-triangle-icon');
  expect(conflictIcons.length).toBeGreaterThan(0);
});
```

### 4. Testing Status Styling

```typescript
it('applies correct status styling', () => {
  const { currentMonth, projects } = createMixedStatusFixture(
    JANUARY_2024_FIXTURE.currentMonth
  );

  const { container } = render(
    <ProjectCalendarMonthView
      projects={projects}
      currentMonth={currentMonth}
    />
  );

  // Find draft project
  const draftBar = screen.getByText('Draft Project').closest('a');
  expect(draftBar?.className).toContain('bg-blue-100');

  // Find confirmed project
  const confirmedBar = screen.getByText('Confirmed Project').closest('a');
  expect(confirmedBar?.className).toContain('bg-green-100');
});
```

### 5. Testing Bar Positioning

```typescript
it('positions bar correctly', () => {
  const { currentMonth, projects } = createSingleProjectFixture(
    JANUARY_2024_FIXTURE.currentMonth
  );

  render(
    <ProjectCalendarMonthView
      projects={projects}
      currentMonth={currentMonth}
    />
  );

  const bar = screen.getByText('Acme Corp').closest('a');
  assertBarPosition(bar, expect, {
    left: '0%',      // First column
    width: '20%',    // 1 day out of 5
  });
});
```

### 6. Creating Custom Test Data

```typescript
it('renders custom project', () => {
  const alice = createTestUser({ full_name: 'Alice Engineer' });
  const assignment = createTestAssignment({ user: alice });

  const project = createTestProject({
    client_name: 'Custom Project',
    start_date: '2024-01-15',
    end_date: '2024-01-19',
    schedule_status: 'confirmed',
    assignments: [assignment],
  });

  render(
    <ProjectCalendarMonthView
      projects={[project]}
      currentMonth={JANUARY_2024_FIXTURE.currentMonth}
    />
  );

  expect(screen.getByText('Custom Project')).toBeInTheDocument();
});
```

### 7. Testing Long Projects

```typescript
it('renders project spanning multiple weeks', () => {
  const { currentMonth, projects } = createLongProjectFixture(
    JANUARY_2024_FIXTURE.currentMonth
  );

  const { container } = render(
    <ProjectCalendarMonthView
      projects={projects}
      currentMonth={currentMonth}
    />
  );

  // Project should appear in multiple weeks
  const bars = container.querySelectorAll('[href*="/projects/"]');
  expect(bars.length).toBeGreaterThan(1);
});
```

### 8. Testing Today Indicator

```typescript
import { vi } from 'vitest';

it('highlights today', () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2024, 0, 15)); // January 15, 2024

  const { currentMonth, projects } = createSingleProjectFixture(
    JANUARY_2024_FIXTURE.currentMonth
  );

  render(
    <ProjectCalendarMonthView
      projects={projects}
      currentMonth={currentMonth}
    />
  );

  // Find day number 15
  const todayCell = screen.getByText('15');
  expect(todayCell.className).toContain('bg-primary');

  vi.useRealTimers();
});
```

### 9. Testing Tooltips

```typescript
import { within } from '@testing-library/react';

it('shows tooltip with project details', () => {
  const { currentMonth, projects } = createSingleProjectFixture(
    JANUARY_2024_FIXTURE.currentMonth
  );

  render(
    <ProjectCalendarMonthView
      projects={projects}
      currentMonth={currentMonth}
    />
  );

  const bar = screen.getByText('Acme Corp').closest('a');
  const tooltip = bar?.closest('[data-testid="tooltip"]');

  // Tooltip should contain project name and dates
  expect(within(tooltip).getByText('Acme Corp')).toBeInTheDocument();
});
```

### 10. Testing Links

```typescript
it('links to project page', () => {
  const project = createTestProject({
    id: 'project-123',
    client_name: 'Test Project',
  });

  render(
    <ProjectCalendarMonthView
      projects={[project]}
      currentMonth={JANUARY_2024_FIXTURE.currentMonth}
    />
  );

  const link = screen.getByText('Test Project').closest('a');
  expect(link?.getAttribute('href')).toBe('/projects/project-123');
});
```

## Common Utilities Cheat Sheet

### Date Utilities

```typescript
import { toISODate, dateOffset, getFirstMonday } from './test-setup';

// Convert Date to ISO string
toISODate(new Date(2024, 0, 15)) // "2024-01-15"

// Add/subtract days
dateOffset(new Date(2024, 0, 1), 5)   // Jan 6, 2024
dateOffset(new Date(2024, 0, 15), -3) // Jan 12, 2024

// Get first Monday of month
getFirstMonday(new Date(2024, 0, 15)) // Jan 1, 2024
```

### Factories

```typescript
import {
  createTestUser,
  createTestAssignment,
  createTestProject,
  createMultiWeekProject,
} from './test-setup';

// Create user
const alice = createTestUser({ full_name: 'Alice Engineer' });

// Create assignment
const assignment = createTestAssignment({ user: alice });

// Create simple project
const project = createTestProject({
  client_name: 'My Project',
  schedule_status: 'confirmed',
});

// Create multi-week project
const longProject = createMultiWeekProject({
  startWeek: 0,
  duration: 3,
  currentMonth: JANUARY_2024_FIXTURE.currentMonth,
});
```

### Fixtures

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

// Use pre-built engineers
const { alice, bob, charlie } = TEST_ENGINEERS;

// Use scenario fixtures
const emptyMonth = createEmptyMonthFixture(JANUARY_2024_FIXTURE.currentMonth);
const singleProject = createSingleProjectFixture(JANUARY_2024_FIXTURE.currentMonth);
const multipleProjects = createMultipleProjectsFixture(JANUARY_2024_FIXTURE.currentMonth);
```

### Assertions

```typescript
import {
  countProjectBars,
  assertBarPosition,
  hasConflictIndicator,
} from './test-setup';

// Count bars
expect(countProjectBars(container)).toBe(3);

// Assert positioning
const bar = screen.getByText('Project').closest('a');
assertBarPosition(bar, expect, {
  left: '0%',
  width: '20%',
  top: '0px',
});

// Check for conflict
expect(hasConflictIndicator(bar)).toBe(true);
```

## Pre-defined Fixtures

```typescript
// January 2024 metadata
JANUARY_2024_FIXTURE = {
  currentMonth: Date(2024, 0, 15),
  firstMonday: Date(2024, 0, 1),
  lastFriday: Date(2024, 1, 2),
  totalWeeks: 5,
  weekdaysCount: 25,
}

// February 2024 metadata (leap year)
FEBRUARY_2024_FIXTURE = {
  currentMonth: Date(2024, 1, 15),
  firstMonday: Date(2024, 0, 29),
  lastFriday: Date(2024, 2, 1),
  totalWeeks: 5,
  weekdaysCount: 25,
}

// Test engineers
TEST_ENGINEERS = {
  alice: { id: 'user-alice', full_name: 'Alice Engineer' },
  bob: { id: 'user-bob', full_name: 'Bob Developer' },
  charlie: { id: 'user-charlie', full_name: 'Charlie Tech' },
}
```

## Running Your Tests

```bash
# Run all tests
npm test

# Run only calendar tests
npm test -- src/app/\(dashboard\)/project-calendar

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Tips

1. **Always use fixtures** - They provide consistent test data
2. **Use factories for custom data** - When you need specific scenarios
3. **Reset mocks** - Always call `resetComponentMocks()` in `afterEach`
4. **Test weekdays only** - Calendar shows Mon-Fri, not weekends
5. **Use ISO dates** - Always format dates as "YYYY-MM-DD"
6. **Check conflicts** - Use `createConflictFixture()` for overlap testing
7. **Test status colors** - Each status has specific CSS classes
8. **Test bar positioning** - Use `assertBarPosition()` helper
9. **Count bars** - Use `countProjectBars()` for quick checks
10. **Use fake timers** - For testing "today" indicator

## Need Help?

- See `README.md` for detailed documentation
- See `ARCHITECTURE.md` for visual diagrams
- See `test-setup.ts` for all available utilities
- Check existing tests in `src/lib/calendar/__tests__/` for patterns

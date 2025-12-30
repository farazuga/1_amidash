# Test Architecture Diagram

## Component Under Test

```
ProjectCalendarMonthView
├── Props
│   ├── projects: ProjectWithDetails[]
│   └── currentMonth: Date
│
├── Dependencies
│   ├── date-fns (format, startOfMonth, endOfMonth, etc.)
│   ├── @/lib/calendar/constants (BOOKING_STATUS_CONFIG)
│   ├── @/components/ui/tooltip (Tooltip components)
│   ├── next/link (Link component)
│   └── lucide-react (AlertTriangle icon)
│
└── Output
    ├── Calendar Grid
    │   ├── Day Headers (Mon-Fri)
    │   ├── Week Rows
    │   ├── Day Numbers
    │   └── Today Indicator
    │
    └── Project Bars
        ├── Bar Positioning (left, width, top)
        ├── Status Styling (draft, tentative, pending, confirmed)
        ├── Conflict Indicators
        ├── Tooltips
        └── Links to Project Pages
```

## Test Setup Architecture

```
test-setup.ts
│
├── Date Utilities
│   ├── toISODate(date: Date): string
│   ├── dateOffset(referenceDate: Date, days: number): Date
│   ├── getFirstMonday(month: Date): Date
│   ├── createDateRange(start: Date, end: Date): { start, end }
│   ├── isWeekday(date: Date): boolean
│   └── getWeekdaysInRange(start: Date, end: Date): Date[]
│
├── Test Data Factories
│   ├── createTestUser(options?): User
│   ├── createTestAssignment(options?): TestAssignment
│   ├── createTestProject(options?): ProjectWithDetails
│   ├── createMultiWeekProject(options): ProjectWithDetails
│   └── createOverlappingProjects(options): [Project, Project]
│
├── Test Fixtures
│   ├── Month Fixtures
│   │   ├── JANUARY_2024_FIXTURE
│   │   └── FEBRUARY_2024_FIXTURE
│   │
│   ├── Engineer Fixtures
│   │   └── TEST_ENGINEERS { alice, bob, charlie }
│   │
│   └── Scenario Fixtures
│       ├── createEmptyMonthFixture(month)
│       ├── createSingleProjectFixture(month)
│       ├── createMultipleProjectsFixture(month)
│       ├── createConflictFixture(month)
│       ├── createLongProjectFixture(month)
│       └── createMixedStatusFixture(month)
│
├── Mock Utilities
│   ├── MOCK_BOOKING_STATUS_CONFIG
│   ├── setupComponentMocks()
│   └── resetComponentMocks()
│
└── Assertion Helpers
    ├── assertBarPosition(bar, expected)
    ├── getProjectBar(container, projectName)
    ├── countProjectBars(container)
    └── hasConflictIndicator(projectBar)
```

## Test Flow

```
┌─────────────────────────────────────────────────────────────┐
│ Test Suite: ProjectCalendarMonthView                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ beforeAll: setupComponentMocks()                            │
│  - Mock BOOKING_STATUS_CONFIG                               │
│  - Mock next/link                                           │
│  - Mock UI components (Tooltip)                             │
│  - Mock icons (AlertTriangle)                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Test Case                                                    │
│  1. Create test data using factories/fixtures               │
│  2. Render component with test data                         │
│  3. Assert expected output                                  │
│  4. Assert DOM structure                                    │
│  5. Assert interactions                                     │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ afterEach: resetComponentMocks()                            │
│  - Clear all mocks                                          │
│  - Reset mock state                                         │
└─────────────────────────────────────────────────────────────┘
```

## Test Data Flow

```
Test Data Creation Flow
━━━━━━━━━━━━━━━━━━━━━━

1. Create Engineers
   ┌──────────────────┐
   │ createTestUser() │ → alice, bob, charlie
   └──────────────────┘

2. Create Assignments
   ┌─────────────────────────┐
   │ createTestAssignment()  │ → assignment with engineer
   └─────────────────────────┘

3. Create Projects
   ┌──────────────────────┐
   │ createTestProject()  │ → project with assignments
   └──────────────────────┘
            │
            ├─ start_date: "2024-01-15"
            ├─ end_date: "2024-01-19"
            ├─ schedule_status: "confirmed"
            └─ assignments: [assignment1, assignment2]

4. Create Test Scenario
   ┌──────────────────────────────┐
   │ createSingleProjectFixture() │
   └──────────────────────────────┘
            │
            └─ { currentMonth, projects: [project] }

5. Render Component
   ┌────────────────────────────────────────┐
   │ <ProjectCalendarMonthView              │
   │   projects={projects}                  │
   │   currentMonth={currentMonth}          │
   │ />                                     │
   └────────────────────────────────────────┘
```

## Test Categories

```
Test Organization
━━━━━━━━━━━━━━━━

describe('ProjectCalendarMonthView')
│
├── describe('Basic Rendering')
│   ├── it('renders day headers for weekdays only')
│   ├── it('renders correct number of weeks')
│   ├── it('renders day numbers correctly')
│   ├── it('highlights today')
│   └── it('dims days outside current month')
│
├── describe('Project Bars')
│   ├── it('renders single project bar')
│   ├── it('renders multiple non-overlapping projects')
│   ├── it('renders project spanning multiple weeks')
│   ├── it('positions bars correctly')
│   ├── it('calculates bar width correctly')
│   ├── it('handles rounded corners for start/end')
│   └── it('shows client name only on start bar')
│
├── describe('Bar Positioning')
│   ├── it('calculates left position as percentage')
│   ├── it('calculates width as percentage')
│   ├── it('stacks bars in different rows')
│   └── it('respects MAX_ROWS safety limit')
│
├── describe('Status Styling')
│   ├── it('applies draft status colors')
│   ├── it('applies tentative status colors')
│   ├── it('applies pending_confirm status colors')
│   └── it('applies confirmed status colors')
│
├── describe('Conflict Detection')
│   ├── it('detects engineer double-booking')
│   ├── it('shows conflict indicator (AlertTriangle)')
│   ├── it('applies conflict ring styling')
│   └── it('shows conflict for all overlapping projects')
│
├── describe('Edge Cases')
│   ├── it('handles empty month (no projects)')
│   ├── it('handles project starting before month')
│   ├── it('handles project ending after month')
│   ├── it('handles projects with no assignments')
│   ├── it('handles month with 4 weeks')
│   ├── it('handles month with 5 weeks')
│   ├── it('handles month with 6 weeks')
│   └── it('handles leap year February')
│
├── describe('Tooltips')
│   ├── it('shows project name in tooltip')
│   ├── it('shows date range in tooltip')
│   └── it('shows assigned engineers in tooltip')
│
└── describe('Interactions')
    ├── it('project bars link to project page')
    ├── it('generates correct href for projects')
    └── it('tooltip triggers on hover')
```

## Factory Pattern Usage

```
Factory Pattern
━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────┐
│ Base Factory: createTestProject()                           │
│                                                              │
│ const project = createTestProject({                         │
│   client_name: 'Acme Corp',                                 │
│   start_date: '2024-01-15',                                 │
│   end_date: '2024-01-19',                                   │
│   schedule_status: 'confirmed',                             │
│   assignments: [assignment1, assignment2]                   │
│ });                                                          │
└─────────────────────────────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
          ▼                ▼                ▼
┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Specialized      │  │ Scenario     │  │ Edge Case        │
│ Factories        │  │ Fixtures     │  │ Helpers          │
│                  │  │              │  │                  │
│ • Multi-week     │  │ • Empty      │  │ • Overlapping    │
│ • Long project   │  │ • Single     │  │ • Conflicts      │
│ • Short project  │  │ • Multiple   │  │ • No dates       │
└──────────────────┘  └──────────────┘  └──────────────────┘
```

## Mock Strategy

```
Mock Layers
━━━━━━━━━━━

Application Layer
├── Component: ProjectCalendarMonthView
│   └── Uses dependencies below

Dependency Layer (Mocked)
├── @/lib/calendar/constants → MOCK_BOOKING_STATUS_CONFIG
├── next/link → Simple <a> tag mock
├── @/components/ui/tooltip → Transparent wrapper mocks
├── lucide-react → Test icon mocks
└── @/lib/utils → Simple implementation mock

Test Layer
└── Test setup provides all mocks via setupComponentMocks()
```

## Assertion Strategy

```
Assertion Layers
━━━━━━━━━━━━━━━━

1. Structural Assertions
   └── DOM structure matches expected layout

2. Content Assertions
   └── Correct text content is rendered

3. Style Assertions
   └── Correct CSS classes and inline styles applied

4. Interaction Assertions
   └── Links and tooltips work correctly

5. Edge Case Assertions
   └── Component handles edge cases gracefully
```

## Coverage Map

```
Coverage Goals
━━━━━━━━━━━━━

Component Areas                              Target Coverage
├── Basic Rendering                          100%
│   ├── Day headers                          ✓
│   ├── Week grid                            ✓
│   ├── Day numbers                          ✓
│   └── Today indicator                      ✓
│
├── Project Bars                             100%
│   ├── Single project                       ✓
│   ├── Multiple projects                    ✓
│   ├── Bar positioning                      ✓
│   ├── Bar styling                          ✓
│   └── Multi-week bars                      ✓
│
├── Conflict Detection                       100%
│   ├── Overlap detection                    ✓
│   ├── Conflict indicator                   ✓
│   └── Multiple conflicts                   ✓
│
├── Edge Cases                               95%
│   ├── Empty month                          ✓
│   ├── Month boundaries                     ✓
│   ├── No assignments                       ✓
│   └── Safety limits                        ✓
│
└── Interactions                             90%
    ├── Links                                ✓
    └── Tooltips                             ✓

Overall Target: 95%+
```

## Example Test Execution Flow

```
Test: "renders single project bar"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Setup Phase
   ┌────────────────────────────────────────┐
   │ const fixture =                        │
   │   createSingleProjectFixture(          │
   │     JANUARY_2024_FIXTURE.currentMonth  │
   │   );                                   │
   └────────────────────────────────────────┘
                    ↓
   ┌────────────────────────────────────────┐
   │ fixture = {                            │
   │   currentMonth: Date(2024, 0, 15),     │
   │   projects: [                          │
   │     {                                  │
   │       client_name: 'Acme Corp',        │
   │       start_date: '2024-01-01',        │
   │       end_date: '2024-01-05',          │
   │       schedule_status: 'confirmed',    │
   │       assignments: [assignment]        │
   │     }                                  │
   │   ]                                    │
   │ }                                      │
   └────────────────────────────────────────┘

2. Render Phase
   ┌────────────────────────────────────────┐
   │ const { container } = render(          │
   │   <ProjectCalendarMonthView            │
   │     projects={fixture.projects}        │
   │     currentMonth={fixture.currentMonth}│
   │   />                                   │
   │ );                                     │
   └────────────────────────────────────────┘
                    ↓
   ┌────────────────────────────────────────┐
   │ Component renders:                     │
   │ - 5 week rows                          │
   │ - 5 day columns                        │
   │ - 1 project bar                        │
   │ - "Acme Corp" text                     │
   │ - Green confirmed styling              │
   └────────────────────────────────────────┘

3. Assertion Phase
   ┌────────────────────────────────────────┐
   │ expect(countProjectBars(container))    │
   │   .toBe(1);                            │
   │                                        │
   │ expect(screen.getByText('Acme Corp'))  │
   │   .toBeInTheDocument();                │
   │                                        │
   │ const bar = screen.getByText(...)      │
   │   .closest('a');                       │
   │                                        │
   │ assertBarPosition(bar, {               │
   │   left: '0%',                          │
   │   width: '20%'                         │
   │ });                                    │
   └────────────────────────────────────────┘

4. Cleanup Phase
   ┌────────────────────────────────────────┐
   │ afterEach:                             │
   │ - resetComponentMocks()                │
   │ - cleanup() (automatic)                │
   └────────────────────────────────────────┘
```

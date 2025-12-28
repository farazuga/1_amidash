# Server Actions Test Suite

This directory contains comprehensive tests for Next.js server actions.

## Test Files

### 1. auth.test.ts
Tests for authentication server actions (`/src/app/actions/auth.ts`)

**Coverage**: 100% (Statements, Branches, Functions, Lines)

#### Test Suites:

**signOut Function (3 tests)**
- Should sign out user, revalidate path, and redirect to login
- Should handle signOut even if Supabase returns error
- Should handle errors from createClient

**getCurrentUser Function (7 tests)**
- Should return user and profile when both exist
- Should return null user and profile when auth.getUser returns error
- Should return null user and profile when user is null
- Should return user with null profile when profile fetch fails
- Should query profile with correct user id
- Should handle createClient failure
- Should handle unexpected errors during profile fetch

### 2. dashboard.test.ts
Tests for dashboard data fetching server actions (`/src/app/actions/dashboard.ts`)

**Coverage**: 100% (Statements, Branches, Functions, Lines)

#### Test Suites:

**getDashboardData Function (10 tests)**
- Should fetch and return all dashboard data successfully
- Should return empty arrays when no data exists
- Should return empty arrays when data is null
- Should handle partial data fetch failures gracefully
- Should fetch projects with status relations
- Should fetch statuses ordered by display_order
- Should fetch status history ordered by changed_at descending
- Should handle createClient failure
- Should execute all queries in parallel using Promise.all
- Should return correct TypeScript types for all fields

## Running Tests

### Run all action tests
```bash
npm test -- src/app/actions/__tests__/
```

### Run specific test file
```bash
npm test -- src/app/actions/__tests__/auth.test.ts
npm test -- src/app/actions/__tests__/dashboard.test.ts
```

### Run with coverage
```bash
npm run test:coverage -- src/app/actions/__tests__/
```

### Run in watch mode
```bash
npm run test:watch -- src/app/actions/__tests__/
```

### Run with verbose output
```bash
npm test -- src/app/actions/__tests__/ --reporter=verbose
```

## Test Patterns Used

### 1. Mocking Strategy
- **Supabase Client**: Mocked using `vi.mock('@/lib/supabase/server')`
- **Next.js Functions**: Mocked `redirect()` and `revalidatePath()` from Next.js
- **Type-safe Mocks**: All mocks maintain TypeScript type safety

### 2. Test Structure
All tests follow the Arrange-Act-Assert (AAA) pattern:
```typescript
it('should do something', async () => {
  // Arrange - Set up mocks and test data
  const mockData = { ... };
  vi.mocked(createClient).mockResolvedValue(mockSupabase);

  // Act - Call the function under test
  const result = await functionUnderTest();

  // Assert - Verify the results
  expect(result).toEqual(expectedResult);
});
```

### 3. Mock Implementation Examples

#### Basic Supabase Mock
```typescript
const mockSupabase = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: mockUser },
      error: null,
    }),
  },
  from: vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: mockProfile,
          error: null,
        }),
      }),
    }),
  }),
};
```

#### Complex Query Chain Mock
```typescript
const mockSupabase = {
  from: vi.fn().mockImplementation((table: string) => {
    if (table === 'projects') {
      return {
        select: vi.fn().mockResolvedValue({
          data: mockProjects,
          error: null,
        }),
      };
    }
    if (table === 'statuses') {
      return {
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: mockStatuses,
            error: null,
          }),
        }),
      };
    }
    // ... more tables
  }),
};
```

## Error Handling Coverage

All tests include comprehensive error handling scenarios:

1. **Network/Connection Errors**: Client creation failures
2. **Authentication Errors**: Invalid or missing user sessions
3. **Database Errors**: Query failures, null responses
4. **Partial Failures**: Some queries succeed while others fail
5. **Edge Cases**: Empty data, null values, missing relations

## Key Testing Principles

1. **Isolation**: Each test is completely isolated with `beforeEach(() => vi.clearAllMocks())`
2. **Completeness**: Tests cover happy path, error cases, and edge cases
3. **Type Safety**: All mocks maintain TypeScript type safety
4. **Realistic Mocks**: Mock data structures match actual Supabase responses
5. **Performance**: Tests verify parallel execution using `Promise.all`

## Assertions Used

- `expect(fn).toHaveBeenCalledTimes(n)` - Verify call count
- `expect(fn).toHaveBeenCalledWith(args)` - Verify call arguments
- `expect(result).toEqual(expected)` - Deep equality check
- `expect(promise).rejects.toThrow(message)` - Async error handling
- `expect(fn).not.toHaveBeenCalled()` - Verify function wasn't called

## TypeScript Types Tested

All tests verify proper TypeScript typing:
- `DashboardProject`
- `DashboardStatus`
- `DashboardStatusHistoryItem`
- `DashboardRevenueGoal`
- `DashboardData`
- User and Profile types from Supabase

## Best Practices Demonstrated

1. Clear test descriptions that explain what is being tested
2. Comprehensive mock setup that mirrors production behavior
3. Both positive and negative test cases
4. Edge case handling
5. Type safety throughout
6. Proper cleanup between tests
7. Testing of side effects (redirect, revalidatePath)
8. Verification of parallel execution
9. Error propagation testing
10. Null/undefined handling

## Next Steps

When adding new server actions:

1. Create a new test file in this directory
2. Follow the established patterns for mocking
3. Achieve 100% coverage for critical paths
4. Test all error scenarios
5. Verify TypeScript type safety
6. Update this README with new test information

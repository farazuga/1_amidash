import { test, expect } from './fixtures';
import { TestHelpers, AuthHelpers } from './fixtures';

/**
 * Calendar E2E Tests
 *
 * Tests for project calendar/scheduling functionality including:
 * - Calendar navigation
 * - Project assignments
 * - Booking status changes
 * - Conflict handling
 * - Personal schedule view
 */

test.describe('Calendar', () => {
  test.describe('Calendar Navigation', () => {
    test.skip('should display master calendar page', async ({ page }) => {
      // Skip until auth is set up
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/calendar');
      await page.waitForLoadState('networkidle');

      // Check calendar elements
      await expect(page.getByRole('heading', { name: /calendar/i })).toBeVisible();

      // Check for navigation controls
      await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /today/i })).toBeVisible();
    });

    test.skip('should navigate between months', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/calendar');
      await page.waitForLoadState('networkidle');

      // Get current month display
      const monthDisplay = page.locator('[data-testid="current-month"]');
      const initialMonth = await monthDisplay.textContent();

      // Click next month
      await page.getByRole('button', { name: /next/i }).click();
      await page.waitForLoadState('networkidle');

      // Verify month changed
      const newMonth = await monthDisplay.textContent();
      expect(newMonth).not.toBe(initialMonth);
    });

    test.skip('should display calendar legend with 4 statuses', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/calendar');

      // Check for booking status legend - 4 statuses (no 'complete')
      await expect(page.getByText('Draft')).toBeVisible();
      await expect(page.getByText('Tentative')).toBeVisible();
      await expect(page.getByText('Pending Confirmation')).toBeVisible();
      await expect(page.getByText('Confirmed')).toBeVisible();

      // 'Complete' should NOT be visible
      await expect(page.getByText('Complete')).not.toBeVisible();
    });
  });

  test.describe('Project Calendar', () => {
    test.skip('should display project-specific calendar', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      // Navigate to a project calendar (replace with actual project ID)
      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Check for project calendar elements
      await expect(page.getByRole('heading', { name: /schedule/i })).toBeVisible();
    });

    test.skip('should show assignment sidebar on project calendar', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Check for team members sidebar
      await expect(page.getByText('Team Members')).toBeVisible();
    });
  });

  test.describe('Assignments', () => {
    test.skip('should create assignment via dialog', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Open assignment dialog
      await page.getByRole('button', { name: /add assignment/i }).click();

      // Fill in assignment form
      await page.getByLabel(/user/i).click();
      await page.getByRole('option').first().click();

      // Submit
      await page.getByRole('button', { name: /save|create/i }).click();

      // Verify assignment appears
      await expect(page.getByTestId('assignment-card')).toBeVisible();
    });

    test.skip('should create assignment via drag and drop', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Find a draggable user avatar
      const userAvatar = page.locator('[data-testid="draggable-user"]').first();

      // Find a droppable day cell
      const dayCell = page.locator('[data-testid="calendar-day-cell"]').first();

      // Perform drag and drop
      await userAvatar.dragTo(dayCell);

      // Verify assignment was created
      await expect(page.getByTestId('assignment-card')).toBeVisible();
    });

    test.skip('should remove assignment', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Click on existing assignment
      await page.getByTestId('assignment-card').first().click();

      // Click remove button
      await page.getByRole('button', { name: /remove/i }).click();

      // Confirm removal
      await page.getByRole('button', { name: /confirm|yes/i }).click();

      // Verify assignment removed
      await expect(page.getByText('Assignment removed')).toBeVisible();
    });
  });

  test.describe('Booking Status', () => {
    test.skip('should change booking status', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Click on assignment
      await page.getByTestId('assignment-card').first().click();

      // Open status dropdown
      await page.getByLabel(/status/i).click();

      // Select new status
      await page.getByRole('option', { name: /confirmed/i }).click();

      // Save changes
      await page.getByRole('button', { name: /save/i }).click();

      // Verify status changed
      await expect(page.getByText('Confirmed')).toBeVisible();
    });

    test.skip('should show status history', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Click on assignment to open details
      await page.getByTestId('assignment-card').first().click();

      // Check for status history section
      await expect(page.getByText('Status History')).toBeVisible();
    });
  });

  test.describe('Excluded Dates', () => {
    test.skip('should exclude specific dates from assignment', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Click on assignment
      await page.getByTestId('assignment-card').first().click();

      // Click exclude dates button
      await page.getByRole('button', { name: /exclude dates/i }).click();

      // Select dates to exclude
      await page.locator('[data-testid="date-checkbox"]').first().check();

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // Verify dates excluded
      await expect(page.getByText('Dates excluded')).toBeVisible();
    });

    test.skip('should remove excluded date', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Click on assignment
      await page.getByTestId('assignment-card').first().click();

      // Find excluded date and remove it
      await page.locator('[data-testid="excluded-date"]').first().getByRole('button', { name: /remove/i }).click();

      // Verify date restored
      await expect(page.getByText('Date restored')).toBeVisible();
    });
  });

  test.describe('Conflict Handling', () => {
    test.skip('should show conflict warning when double-booking', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Try to assign user already assigned to another project
      await page.getByRole('button', { name: /add assignment/i }).click();
      await page.getByLabel(/user/i).click();
      await page.getByRole('option').first().click();
      await page.getByRole('button', { name: /save/i }).click();

      // Check for conflict warning dialog
      await expect(page.getByText(/conflict/i)).toBeVisible();
    });

    test.skip('should allow conflict override with reason', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Trigger conflict scenario
      await page.getByRole('button', { name: /add assignment/i }).click();
      await page.getByLabel(/user/i).click();
      await page.getByRole('option').first().click();
      await page.getByRole('button', { name: /save/i }).click();

      // Enter override reason
      await page.getByLabel(/reason/i).fill('Customer requested specific technician');

      // Confirm override
      await page.getByRole('button', { name: /override|proceed/i }).click();

      // Verify assignment created despite conflict
      await expect(page.getByText('Assignment created')).toBeVisible();
    });
  });

  test.describe('Personal Schedule', () => {
    test.skip('should display personal schedule page', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/my-schedule');
      await page.waitForLoadState('networkidle');

      // Check for personal schedule elements
      await expect(page.getByRole('heading', { name: /my schedule/i })).toBeVisible();
    });

    test.skip('should show user assignments on personal schedule', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/my-schedule');
      await page.waitForLoadState('networkidle');

      // Check for assignment display
      // This should show projects the logged-in user is assigned to
      await expect(page.locator('[data-testid="schedule-event"]').first()).toBeVisible();
    });
  });

  test.describe('Customer Portal Schedule', () => {
    test.skip('should display schedule on customer portal project page', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      // Login as customer
      await authHelpers.login('customer@example.com', 'password123');

      await page.goto('/customer/projects/test-project-id');
      await page.waitForLoadState('networkidle');

      // Check for schedule section (dates only, no team info)
      await expect(page.getByText('Project Schedule')).toBeVisible();
    });

    test.skip('should not show team assignments to customer', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('customer@example.com', 'password123');

      await page.goto('/customer/projects/test-project-id');
      await page.waitForLoadState('networkidle');

      // Team members should not be visible
      await expect(page.getByText('Team Members')).not.toBeVisible();
      await expect(page.getByTestId('assignment-card')).not.toBeVisible();
    });

    test.skip('should show calendar download option for customer', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('customer@example.com', 'password123');

      await page.goto('/customer/projects/test-project-id');
      await page.waitForLoadState('networkidle');

      // Check for add to calendar option
      await expect(page.getByRole('button', { name: /add to calendar/i })).toBeVisible();
    });
  });

  test.describe('iCal Integration', () => {
    test.skip('should show calendar subscription URL', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/calendar');

      // Click subscribe button
      await page.getByRole('button', { name: /subscribe/i }).click();

      // Check for subscription dialog
      await expect(page.getByText('Subscribe to Calendar')).toBeVisible();

      // Check for copyable URL
      await expect(page.getByRole('textbox', { name: /url/i })).toBeVisible();
    });

    test.skip('should copy calendar URL to clipboard', async ({ page, context }) => {
      // Grant clipboard permissions
      await context.grantPermissions(['clipboard-read', 'clipboard-write']);

      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/calendar');

      // Click subscribe button
      await page.getByRole('button', { name: /subscribe/i }).click();

      // Click copy button
      await page.getByRole('button', { name: /copy/i }).click();

      // Verify copy success message
      await expect(page.getByText(/copied/i)).toBeVisible();
    });
  });

  test.describe('Bulk Operations', () => {
    test.skip('should select multiple dates for bulk action', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Enable multi-select mode
      await page.getByRole('button', { name: /select dates/i }).click();

      // Click multiple day cells while holding shift
      const cells = page.locator('[data-testid="calendar-day-cell"]');
      await cells.nth(0).click();
      await cells.nth(5).click({ modifiers: ['Shift'] });

      // Check bulk action toolbar appears
      await expect(page.getByTestId('bulk-actions-toolbar')).toBeVisible();
    });

    test.skip('should bulk assign user to selected dates', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Select dates
      await page.getByRole('button', { name: /select dates/i }).click();
      const cells = page.locator('[data-testid="calendar-day-cell"]');
      await cells.nth(0).click();
      await cells.nth(2).click({ modifiers: ['Shift'] });

      // Click bulk assign
      await page.getByRole('button', { name: /bulk assign/i }).click();

      // Select users
      await page.getByLabel(/user/i).click();
      await page.getByRole('option').first().click();

      // Confirm
      await page.getByRole('button', { name: /assign/i }).click();

      // Verify success
      await expect(page.getByText(/assigned/i)).toBeVisible();
    });

    test.skip('should bulk exclude selected dates', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Select dates
      await page.getByRole('button', { name: /select dates/i }).click();
      const cells = page.locator('[data-testid="calendar-day-cell"]');
      await cells.nth(0).click();
      await cells.nth(2).click({ modifiers: ['Shift'] });

      // Click exclude
      await page.getByRole('button', { name: /exclude/i }).click();

      // Confirm
      await page.getByRole('button', { name: /confirm/i }).click();

      // Verify success
      await expect(page.getByText(/excluded/i)).toBeVisible();
    });
  });

  test.describe('Access Control', () => {
    test.skip('should not allow viewer to create assignments', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('viewer@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Add assignment button should not exist or be disabled
      const addButton = page.getByRole('button', { name: /add assignment/i });
      await expect(addButton).not.toBeVisible();
    });

    test.skip('should not allow editor to create assignments', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('editor@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Add assignment button should not exist or be disabled
      const addButton = page.getByRole('button', { name: /add assignment/i });
      await expect(addButton).not.toBeVisible();
    });

    test.skip('should allow admin to create assignments', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');

      // Add assignment button should be visible and enabled
      const addButton = page.getByRole('button', { name: /add assignment/i });
      await expect(addButton).toBeVisible();
      await expect(addButton).toBeEnabled();
    });
  });

  // =========================================
  // NEW FEATURE TESTS - Calendar Improvements
  // =========================================

  test.describe('My Schedule Views', () => {
    test.skip('should default to calendar view', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/my-schedule');
      await page.waitForLoadState('networkidle');

      // Calendar view button should be active/selected by default
      const calendarButton = page.getByRole('button', { name: /calendar/i }).first();
      await expect(calendarButton).toHaveAttribute('data-state', 'on');

      // Month grid should be visible
      await expect(page.locator('[data-testid="month-grid"]')).toBeVisible();
    });

    test.skip('should toggle between calendar and list views', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/my-schedule');
      await page.waitForLoadState('networkidle');

      // Click list view
      await page.getByRole('button', { name: /list/i }).first().click();
      await expect(page.locator('[data-testid="list-view"]')).toBeVisible();

      // Click calendar view
      await page.getByRole('button', { name: /calendar/i }).first().click();
      await expect(page.locator('[data-testid="month-grid"]')).toBeVisible();
    });
  });

  test.describe('Status Cycle', () => {
    test.skip('should cycle through 3 statuses: draft -> tentative -> confirmed -> draft', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Find an assignment card with draft status
      const assignmentCard = page.getByTestId('assignment-card').first();

      // Click to cycle status (assuming click cycles status)
      await assignmentCard.click();

      // Status should cycle: draft -> tentative -> confirmed -> draft
      // Verify status doesn't include 'complete'
      const statusBadge = page.getByTestId('booking-status-badge').first();
      const statusText = await statusBadge.textContent();

      // Status should be one of: Draft, Tentative, Confirmed (not Complete)
      expect(['Draft', 'Tentative', 'Confirmed']).toContain(statusText);
    });
  });

  test.describe('Bulk Status Change', () => {
    test.skip('should show confirmation dialog for bulk status change', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Click on a status in the status summary bar
      await page.getByTestId('status-summary-bar').locator('button').first().click();

      // Confirmation dialog should appear
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText('Change all assignments?')).toBeVisible();
    });

    test.skip('should change all assignments status on confirm', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Click on confirmed status
      await page.getByTestId('status-summary-bar').getByText('Confirmed').click();

      // Confirm the action
      await page.getByRole('button', { name: 'Confirm' }).click();

      // Success toast should appear
      await expect(page.getByText('All assignments changed')).toBeVisible();
    });
  });

  test.describe('List View Dates', () => {
    test.skip('should show dates for each assignment in list view', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Switch to list view
      await page.getByRole('tab', { name: /list/i }).click();

      // Each assignment should show dates
      const assignmentCards = page.locator('[data-testid="assignment-list-item"]');
      const firstCard = assignmentCards.first();

      // Should contain date information like "Jan 15" or "Jan 15 - Jan 20 (5 days)"
      await expect(firstCard.locator('.text-muted-foreground')).toContainText(/\w{3} \d+/);
    });
  });

  test.describe('Toggle All Days', () => {
    test.skip('should toggle all days when clicking user name in manage schedule', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open manage schedule dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Click on a user name to toggle all days
      const userName = page.locator('[data-testid="assignment-user-name"]').first();
      await userName.click();

      // All checkboxes for that user should be toggled
      const checkboxes = page.locator('[data-testid="assignment-day-checkbox"]');
      const firstCheckboxChecked = await checkboxes.first().isChecked();

      // All checkboxes should have the same state
      const checkboxCount = await checkboxes.count();
      for (let i = 0; i < checkboxCount; i++) {
        expect(await checkboxes.nth(i).isChecked()).toBe(firstCheckboxChecked);
      }
    });
  });

  test.describe('Drag and Drop Move', () => {
    test.skip('should move assignment to different day via drag and drop', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Find an existing assignment card
      const assignmentCard = page.getByTestId('draggable-assignment-card').first();

      // Find a different day cell
      const targetDayCell = page.getByTestId('droppable-day-cell').nth(2);

      // Drag the assignment to the new day
      await assignmentCard.dragTo(targetDayCell);

      // Success toast should appear
      await expect(page.getByText('Assignment moved')).toBeVisible();
    });
  });

  test.describe('Time Adjustments', () => {
    test.skip('should have 1-hour adjustment buttons in time editor', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open time editor popover
      await page.getByTestId('time-editor-trigger').first().click();

      // Check for +/- buttons
      await expect(page.getByRole('button', { name: /earlier by 1 hour/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /later by 1 hour/i })).toBeVisible();
    });

    test.skip('should adjust time by 1 hour when clicking buttons', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open time editor
      await page.getByTestId('time-editor-trigger').first().click();

      // Get initial start time
      const startTimeInput = page.getByLabel('Start Time');
      const initialTime = await startTimeInput.inputValue();

      // Click + button for start time
      await page.getByRole('button', { name: /later by 1 hour/i }).first().click();

      // Time should be 1 hour later
      const newTime = await startTimeInput.inputValue();
      expect(newTime).not.toBe(initialTime);
    });
  });
});

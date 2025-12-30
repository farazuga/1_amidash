import { test, expect } from './fixtures';
import { AuthHelpers } from './fixtures';

/**
 * Manage Schedule E2E Tests
 *
 * Tests for the Manage Schedule dialog including:
 * - Click-to-select days
 * - Toggle all days for a user
 * - Weekend removal
 * - Status cascade
 */

test.describe('Manage Schedule Dialog', () => {
  test.describe('Opening and Closing', () => {
    test.skip('should open manage schedule dialog', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Click manage schedule button
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Dialog should be visible
      await expect(page.getByRole('dialog')).toBeVisible();
      await expect(page.getByText(/manage schedule/i)).toBeVisible();
    });

    test.skip('should close dialog with Escape key', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Press Escape
      await page.keyboard.press('Escape');

      // Dialog should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });
  });

  test.describe('Click-to-Select Days', () => {
    test.skip('should toggle individual day assignment on click', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open manage schedule dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Find a day cell and click to toggle
      const dayCheckbox = page.getByTestId('assignment-day-checkbox').first();
      const initialState = await dayCheckbox.isChecked();

      // Click to toggle
      await dayCheckbox.click();

      // Verify toggle
      const newState = await dayCheckbox.isChecked();
      expect(newState).toBe(!initialState);
    });

    test.skip('should show visual feedback on day selection', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Find unchecked day
      const dayCell = page.locator('[data-testid="assignment-day-cell"]').first();

      // Get initial background color
      const initialBg = await dayCell.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      // Check the day
      await dayCell.click();

      // Get new background color - should be different (highlight)
      const newBg = await dayCell.evaluate((el) =>
        window.getComputedStyle(el).backgroundColor
      );

      expect(newBg).not.toBe(initialBg);
    });
  });

  test.describe('Toggle All Days', () => {
    test.skip('should toggle all days when clicking user name', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();
      await expect(page.getByRole('dialog')).toBeVisible();

      // Find user row and count checkboxes
      const userRow = page.locator('[data-testid="assignment-user-row"]').first();
      const checkboxes = userRow.locator('[data-testid="assignment-day-checkbox"]');
      const checkboxCount = await checkboxes.count();

      // Get initial states
      const initialStates: boolean[] = [];
      for (let i = 0; i < checkboxCount; i++) {
        initialStates.push(await checkboxes.nth(i).isChecked());
      }

      // Click user name to toggle all
      const userName = userRow.locator('[data-testid="assignment-user-name"]');
      await userName.click();

      // All checkboxes should have same state
      const firstNewState = await checkboxes.first().isChecked();
      for (let i = 0; i < checkboxCount; i++) {
        const state = await checkboxes.nth(i).isChecked();
        expect(state).toBe(firstNewState);
      }
    });

    test.skip('should select all if any day is unselected', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Find user row
      const userRow = page.locator('[data-testid="assignment-user-row"]').first();
      const checkboxes = userRow.locator('[data-testid="assignment-day-checkbox"]');

      // Uncheck some but not all
      const firstCheckbox = checkboxes.first();
      if (await firstCheckbox.isChecked()) {
        await firstCheckbox.click(); // Uncheck first
      }

      // Now click user name - should select ALL
      const userName = userRow.locator('[data-testid="assignment-user-name"]');
      await userName.click();

      // All should now be checked
      const checkboxCount = await checkboxes.count();
      for (let i = 0; i < checkboxCount; i++) {
        await expect(checkboxes.nth(i)).toBeChecked();
      }
    });

    test.skip('should deselect all if all days are selected', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Find user row
      const userRow = page.locator('[data-testid="assignment-user-row"]').first();
      const checkboxes = userRow.locator('[data-testid="assignment-day-checkbox"]');

      // Ensure all are checked first
      const checkboxCount = await checkboxes.count();
      for (let i = 0; i < checkboxCount; i++) {
        if (!(await checkboxes.nth(i).isChecked())) {
          await checkboxes.nth(i).click();
        }
      }

      // Now click user name - should deselect ALL
      const userName = userRow.locator('[data-testid="assignment-user-name"]');
      await userName.click();

      // All should now be unchecked
      for (let i = 0; i < checkboxCount; i++) {
        await expect(checkboxes.nth(i)).not.toBeChecked();
      }
    });
  });

  test.describe('Weekend Removal', () => {
    test.skip('should not show Saturday in manage schedule grid', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Check column headers
      const headers = page.locator('[data-testid="schedule-header-day"]');
      const headerTexts = await headers.allTextContents();

      expect(headerTexts.join(' ')).not.toMatch(/sat/i);
      expect(headerTexts.join(' ')).not.toMatch(/saturday/i);
    });

    test.skip('should not show Sunday in manage schedule grid', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Check column headers
      const headers = page.locator('[data-testid="schedule-header-day"]');
      const headerTexts = await headers.allTextContents();

      expect(headerTexts.join(' ')).not.toMatch(/sun/i);
      expect(headerTexts.join(' ')).not.toMatch(/sunday/i);
    });

    test.skip('should only show 5-column grid in manage schedule', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Count header columns
      const headers = page.locator('[data-testid="schedule-header-day"]');
      const headerCount = await headers.count();

      // Should be exactly 5 weekdays
      expect(headerCount).toBe(5);
    });
  });

  test.describe('Saving Changes', () => {
    test.skip('should save changes when clicking save button', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Make a change
      const dayCheckbox = page.getByTestId('assignment-day-checkbox').first();
      await dayCheckbox.click();

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for save
      await page.waitForTimeout(500);

      // Verify success toast
      await expect(page.getByText(/saved|updated/i)).toBeVisible();
    });

    test.skip('should close dialog after successful save', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Make a change
      const dayCheckbox = page.getByTestId('assignment-day-checkbox').first();
      await dayCheckbox.click();

      // Save
      await page.getByRole('button', { name: /save/i }).click();

      // Wait for save and dialog close
      await page.waitForTimeout(500);

      // Dialog should be closed
      await expect(page.getByRole('dialog')).not.toBeVisible();
    });

    test.skip('should persist changes after dialog reopened', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Get current state
      const dayCheckbox = page.getByTestId('assignment-day-checkbox').first();
      const initialState = await dayCheckbox.isChecked();

      // Toggle
      await dayCheckbox.click();

      // Save
      await page.getByRole('button', { name: /save/i }).click();
      await page.waitForTimeout(500);

      // Reopen dialog
      await page.getByRole('button', { name: /manage schedule/i }).click();

      // Verify change persisted
      const newState = await page.getByTestId('assignment-day-checkbox').first().isChecked();
      expect(newState).toBe(!initialState);
    });
  });

  test.describe('Status Cascade Dialog', () => {
    test.skip('should show cascade status dialog when changing project status', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Click on schedule status selector
      const statusSelector = page.getByTestId('schedule-status-select');
      await statusSelector.click();

      // Select a different status
      await page.getByRole('option', { name: /confirmed/i }).click();

      // Cascade dialog should appear
      await expect(page.getByRole('alertdialog')).toBeVisible();
      await expect(page.getByText(/cascade.*assignments/i)).toBeVisible();
    });

    test.skip('should update all assignments when cascade is confirmed', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Change status to trigger cascade dialog
      const statusSelector = page.getByTestId('schedule-status-select');
      await statusSelector.click();
      await page.getByRole('option', { name: /confirmed/i }).click();

      // Confirm cascade
      await page.getByRole('button', { name: /yes.*cascade|confirm/i }).click();

      // Wait for update
      await page.waitForTimeout(500);

      // Verify success toast
      await expect(page.getByText(/updated|changed/i)).toBeVisible();
    });

    test.skip('should only update project status when cascade is declined', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Change status to trigger cascade dialog
      const statusSelector = page.getByTestId('schedule-status-select');
      await statusSelector.click();
      await page.getByRole('option', { name: /confirmed/i }).click();

      // Decline cascade
      await page.getByRole('button', { name: /no.*project only/i }).click();

      // Wait for update
      await page.waitForTimeout(500);

      // Verify success toast for project only
      await expect(page.getByText(/project.*updated/i)).toBeVisible();
    });
  });

  test.describe('Booking Status Cycle', () => {
    test.skip('should have exactly 4 status options (no complete)', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open schedule status selector
      const statusSelector = page.getByTestId('schedule-status-select');
      await statusSelector.click();

      // Count options
      const options = page.getByRole('option');
      const optionCount = await options.count();

      // Should be 4: draft, tentative, pending_confirm, confirmed
      expect(optionCount).toBe(4);

      // Verify no 'complete' option
      const optionTexts = await options.allTextContents();
      expect(optionTexts.join(' ').toLowerCase()).not.toContain('complete');
    });

    test.skip('should have correct status options', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open selector
      const statusSelector = page.getByTestId('schedule-status-select');
      await statusSelector.click();

      // Verify expected options
      await expect(page.getByRole('option', { name: /draft/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /tentative/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /pending.*confirm/i })).toBeVisible();
      await expect(page.getByRole('option', { name: /confirmed/i })).toBeVisible();
    });
  });
});

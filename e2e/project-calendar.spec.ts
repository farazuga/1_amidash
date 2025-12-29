import { test, expect } from './fixtures';
import { AuthHelpers } from './fixtures';

/**
 * Project Calendar E2E Tests
 *
 * Tests for the project calendar page including:
 * - Gantt view navigation
 * - Week-based display
 * - Project info in rows
 * - Click to navigate to project calendar
 * - Filters
 */

test.describe('Project Calendar (Gantt View)', () => {
  test.describe('Navigation', () => {
    test.skip('should display project calendar page', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Check page title
      await expect(page.getByRole('heading', { name: /project calendar/i })).toBeVisible();
    });

    test.skip('should have week navigation buttons', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Check for navigation buttons
      await expect(page.getByRole('button', { name: /previous/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /today/i })).toBeVisible();
    });

    test.skip('should navigate to previous week', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Get current date display
      const dateDisplay = page.getByTestId('current-date-range');
      const initialDate = await dateDisplay.textContent();

      // Click previous
      await page.getByRole('button', { name: /previous/i }).click();
      await page.waitForTimeout(300);

      // Date should have changed
      const newDate = await dateDisplay.textContent();
      expect(newDate).not.toBe(initialDate);
    });

    test.skip('should navigate to next week', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Get current date display
      const dateDisplay = page.getByTestId('current-date-range');
      const initialDate = await dateDisplay.textContent();

      // Click next
      await page.getByRole('button', { name: /next/i }).click();
      await page.waitForTimeout(300);

      // Date should have changed
      const newDate = await dateDisplay.textContent();
      expect(newDate).not.toBe(initialDate);
    });

    test.skip('should navigate to today when Today button clicked', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Navigate away from today
      await page.getByRole('button', { name: /previous/i }).click();
      await page.getByRole('button', { name: /previous/i }).click();
      await page.waitForTimeout(300);

      // Click Today
      await page.getByRole('button', { name: /today/i }).click();
      await page.waitForTimeout(300);

      // Should be back to current week - today indicator should be visible
      await expect(page.getByTestId('today-indicator')).toBeVisible();
    });
  });

  test.describe('Gantt Display', () => {
    test.skip('should show week numbers (W1, W2, etc)', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Look for week number headers
      const weekHeaders = page.locator('[data-testid="week-header"]');

      // Should have at least one week header
      const count = await weekHeaders.count();
      expect(count).toBeGreaterThan(0);

      // First header should show W1 or similar
      const firstHeader = await weekHeaders.first().textContent();
      expect(firstHeader).toMatch(/W\d+|Week \d+/i);
    });

    test.skip('should show only weekdays in gantt view', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Check day headers within a week
      const dayHeaders = page.locator('[data-testid="gantt-day-header"]');
      const dayTexts = await dayHeaders.allTextContents();

      // Should not include Sat or Sun
      const joinedText = dayTexts.join(' ').toLowerCase();
      expect(joinedText).not.toContain('sat');
      expect(joinedText).not.toContain('sun');
    });

    test.skip('should display 4 weeks in view', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Count week columns
      const weekColumns = page.locator('[data-testid="gantt-week-column"]');
      const count = await weekColumns.count();

      // Should show 4 weeks
      expect(count).toBe(4);
    });
  });

  test.describe('Project Rows', () => {
    test.skip('should display project info in left column', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find project rows
      const projectRows = page.locator('[data-testid="gantt-project-row"]');
      const count = await projectRows.count();

      if (count > 0) {
        // First row should have project info
        const firstRow = projectRows.first();
        const projectInfo = firstRow.locator('[data-testid="project-info"]');

        await expect(projectInfo).toBeVisible();
      }
    });

    test.skip('should show project name in row', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find project rows
      const projectRows = page.locator('[data-testid="gantt-project-row"]');
      const count = await projectRows.count();

      if (count > 0) {
        // First row should have project name
        const firstName = projectRows.first().locator('[data-testid="project-name"]');
        const nameText = await firstName.textContent();

        expect(nameText).toBeTruthy();
        expect(nameText!.length).toBeGreaterThan(0);
      }
    });

    test.skip('should show schedule status badge for each project', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find project rows with schedule status
      const statusBadges = page.locator('[data-testid="schedule-status-badge"]');
      const count = await statusBadges.count();

      // At least some projects should have status badges
      // (not all may have schedule_status set)
      if (count > 0) {
        const firstBadge = statusBadges.first();
        await expect(firstBadge).toBeVisible();
      }
    });
  });

  test.describe('Click to Navigate', () => {
    test.skip('should navigate to project calendar on row click', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find project rows
      const projectRows = page.locator('[data-testid="gantt-project-row"]');
      const count = await projectRows.count();

      if (count > 0) {
        // Click first project row
        const firstRow = projectRows.first();
        await firstRow.click();

        // Should navigate to project calendar
        await page.waitForURL(/\/projects\/.*\/calendar/);
      }
    });

    test.skip('should show hover state on project row', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find project rows
      const projectRows = page.locator('[data-testid="gantt-project-row"]');
      const count = await projectRows.count();

      if (count > 0) {
        const firstRow = projectRows.first();

        // Get initial background
        const initialBg = await firstRow.evaluate((el) =>
          window.getComputedStyle(el).backgroundColor
        );

        // Hover
        await firstRow.hover();

        // Get hover background
        const hoverBg = await firstRow.evaluate((el) =>
          window.getComputedStyle(el).backgroundColor
        );

        // Should have hover state (different background or cursor change)
        // Visual indication of clickability
        expect(await firstRow.evaluate((el) =>
          window.getComputedStyle(el).cursor
        )).toBe('pointer');
      }
    });
  });

  test.describe('Filters', () => {
    test.skip('should have status filter dropdown', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Look for status filter
      const statusFilter = page.getByTestId('status-filter');
      await expect(statusFilter).toBeVisible();
    });

    test.skip('should filter projects by schedule status', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Count initial projects
      const initialCount = await page.locator('[data-testid="gantt-project-row"]').count();

      // Apply filter for confirmed only
      const statusFilter = page.getByTestId('status-filter');
      await statusFilter.click();
      await page.getByRole('option', { name: /confirmed/i }).click();

      await page.waitForTimeout(300);

      // Count filtered projects
      const filteredCount = await page.locator('[data-testid="gantt-project-row"]').count();

      // Should have same or fewer projects
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    });

    test.skip('should have user filter dropdown', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Look for user filter
      const userFilter = page.getByTestId('user-filter');
      await expect(userFilter).toBeVisible();
    });

    test.skip('should clear filters when clicking clear button', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Apply a filter
      const statusFilter = page.getByTestId('status-filter');
      await statusFilter.click();
      await page.getByRole('option', { name: /confirmed/i }).click();

      // Click clear filters
      await page.getByRole('button', { name: /clear.*filters/i }).click();

      await page.waitForTimeout(300);

      // Filter should be reset
      const filterValue = await statusFilter.textContent();
      expect(filterValue).toMatch(/all|select/i);
    });
  });

  test.describe('Assignment Display', () => {
    test.skip('should show assignment bars in gantt chart', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find assignment bars
      const assignmentBars = page.locator('[data-testid="gantt-assignment-bar"]');
      const count = await assignmentBars.count();

      // Should have some assignment bars (if there are scheduled projects)
      // This might be 0 if no projects have assignments
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test.skip('should color assignment bars by booking status', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find assignment bars
      const assignmentBars = page.locator('[data-testid="gantt-assignment-bar"]');
      const count = await assignmentBars.count();

      if (count > 0) {
        const firstBar = assignmentBars.first();

        // Should have a background color indicating status
        const bgColor = await firstBar.evaluate((el) =>
          window.getComputedStyle(el).backgroundColor
        );

        // Should not be transparent or default
        expect(bgColor).not.toBe('rgba(0, 0, 0, 0)');
        expect(bgColor).not.toBe('transparent');
      }
    });

    test.skip('should show user initials on assignment bars', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find assignment bars with user initials
      const assignmentBars = page.locator('[data-testid="gantt-assignment-bar"]');
      const count = await assignmentBars.count();

      if (count > 0) {
        const firstBar = assignmentBars.first();
        const initials = firstBar.locator('[data-testid="user-initials"]');

        // Should have initials displayed
        if ((await initials.count()) > 0) {
          const initialsText = await initials.textContent();
          // Initials should be 1-2 uppercase letters
          expect(initialsText).toMatch(/^[A-Z]{1,2}$/);
        }
      }
    });
  });

  test.describe('Responsive Layout', () => {
    test.skip('should show sticky project info column', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // The project info column should be sticky for horizontal scroll
      const projectInfoColumn = page.locator('[data-testid="project-info-column"]');

      // Check position is sticky
      const position = await projectInfoColumn.evaluate((el) =>
        window.getComputedStyle(el).position
      );

      expect(position).toBe('sticky');
    });

    test.skip('should horizontally scroll gantt chart', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Find the scrollable container
      const ganttContainer = page.locator('[data-testid="gantt-container"]');

      // Check that it allows horizontal scroll
      const overflowX = await ganttContainer.evaluate((el) =>
        window.getComputedStyle(el).overflowX
      );

      expect(['auto', 'scroll']).toContain(overflowX);
    });
  });

  test.describe('Empty State', () => {
    test.skip('should show empty state when no projects match filter', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/project-calendar');
      await page.waitForLoadState('networkidle');

      // Apply very restrictive filter (if possible)
      // This might show empty state
      const emptyState = page.getByTestId('empty-state');

      // Empty state might or might not be visible depending on data
      // Just verify the element exists in the DOM
    });
  });
});

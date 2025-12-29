import { test, expect } from './fixtures';
import { AuthHelpers } from './fixtures';

/**
 * Calendar Interactions E2E Tests
 *
 * Tests for calendar interaction features including:
 * - Drag and drop to move assignments
 * - Cmd+drag to copy assignments
 * - Option+click to delete assignments
 * - Keyboard shortcuts
 * - Undo functionality
 */

test.describe('Calendar Interactions', () => {
  test.describe('Drag and Drop', () => {
    test.skip('should move assignment day via drag and drop', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Find a draggable assignment card
      const assignmentCard = page.getByTestId('draggable-assignment-card').first();

      // Get the initial day cell
      const initialParent = await assignmentCard.locator('..').first();

      // Find a different day cell to drop into
      const targetDayCell = page.getByTestId('droppable-day-cell').nth(3);

      // Perform drag and drop
      await assignmentCard.dragTo(targetDayCell);

      // Wait for optimistic update
      await page.waitForTimeout(500);

      // Verify toast notification
      await expect(page.getByText(/moved/i)).toBeVisible();
    });

    test.skip('should copy assignment day with Cmd+drag (Mac)', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Count initial assignments
      const initialCount = await page.getByTestId('draggable-assignment-card').count();

      // Find a draggable assignment card
      const assignmentCard = page.getByTestId('draggable-assignment-card').first();
      const targetDayCell = page.getByTestId('droppable-day-cell').nth(3);

      // Get bounding boxes for manual drag
      const sourceBox = await assignmentCard.boundingBox();
      const targetBox = await targetDayCell.boundingBox();

      if (sourceBox && targetBox) {
        // Start drag with Meta key pressed (Cmd on Mac)
        await page.mouse.move(
          sourceBox.x + sourceBox.width / 2,
          sourceBox.y + sourceBox.height / 2
        );
        await page.keyboard.down('Meta');
        await page.mouse.down();
        await page.mouse.move(
          targetBox.x + targetBox.width / 2,
          targetBox.y + targetBox.height / 2,
          { steps: 5 }
        );
        await page.mouse.up();
        await page.keyboard.up('Meta');
      }

      // Wait for update
      await page.waitForTimeout(500);

      // Verify copy was created (should have one more assignment)
      const finalCount = await page.getByTestId('draggable-assignment-card').count();
      expect(finalCount).toBe(initialCount + 1);
    });

    test.skip('should show copy indicator when Cmd key is held during drag', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      const assignmentCard = page.getByTestId('draggable-assignment-card').first();
      const sourceBox = await assignmentCard.boundingBox();

      if (sourceBox) {
        // Start drag
        await page.mouse.move(
          sourceBox.x + sourceBox.width / 2,
          sourceBox.y + sourceBox.height / 2
        );
        await page.mouse.down();

        // Move to trigger drag start
        await page.mouse.move(
          sourceBox.x + sourceBox.width / 2 + 50,
          sourceBox.y + sourceBox.height / 2,
          { steps: 3 }
        );

        // Hold Cmd key
        await page.keyboard.down('Meta');

        // Check for copy indicator in drag overlay
        await expect(page.locator('[data-testid="copy-indicator"]')).toBeVisible();

        // Clean up
        await page.keyboard.up('Meta');
        await page.mouse.up();
      }
    });
  });

  test.describe('Option+Click Delete', () => {
    test.skip('should delete assignment day with Option+click (Mac)', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Count initial assignments
      const initialCount = await page.getByTestId('draggable-assignment-card').count();
      expect(initialCount).toBeGreaterThan(0);

      // Click with Alt/Option key
      const assignmentCard = page.getByTestId('draggable-assignment-card').first();
      await assignmentCard.click({ modifiers: ['Alt'] });

      // Wait for deletion
      await page.waitForTimeout(500);

      // Verify deletion toast
      await expect(page.getByText(/deleted|removed/i)).toBeVisible();

      // Verify count decreased
      const finalCount = await page.getByTestId('draggable-assignment-card').count();
      expect(finalCount).toBe(initialCount - 1);
    });

    test.skip('should show delete cursor on Option+hover', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      const assignmentCard = page.getByTestId('draggable-assignment-card').first();

      // Hold Alt key and hover
      await page.keyboard.down('Alt');
      await assignmentCard.hover();

      // Check for delete cursor styling (implementation-dependent)
      // This might be a CSS class or inline style
      await expect(assignmentCard).toHaveClass(/cursor-pointer|delete-cursor/);

      await page.keyboard.up('Alt');
    });
  });

  test.describe('Keyboard Shortcuts', () => {
    test.skip('should show keyboard shortcuts help when pressing ?', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Press ? to show help
      await page.keyboard.press('Shift+?');

      // Check for shortcuts help dialog/tooltip
      await expect(page.getByTestId('keyboard-shortcuts-help')).toBeVisible();
    });

    test.skip('should display correct shortcut keys', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Open shortcuts help
      await page.keyboard.press('Shift+?');

      // Verify shortcut descriptions are visible
      await expect(page.getByText(/drag.*copy/i)).toBeVisible();
      await expect(page.getByText(/click.*delete/i)).toBeVisible();
      await expect(page.getByText(/undo/i)).toBeVisible();
    });
  });

  test.describe('Undo Functionality', () => {
    test.skip('should undo assignment move with Cmd+Z', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Get initial state
      const assignmentCard = page.getByTestId('draggable-assignment-card').first();
      const initialText = await assignmentCard.textContent();

      // Move the assignment
      const targetDayCell = page.getByTestId('droppable-day-cell').nth(3);
      await assignmentCard.dragTo(targetDayCell);

      await page.waitForTimeout(500);

      // Press Cmd+Z to undo
      await page.keyboard.press('Meta+z');

      // Wait for undo
      await page.waitForTimeout(500);

      // Verify undo toast
      await expect(page.getByText(/undone|undo/i)).toBeVisible();
    });

    test.skip('should undo assignment delete with Cmd+Z', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Count initial
      const initialCount = await page.getByTestId('draggable-assignment-card').count();

      // Delete with Option+click
      const assignmentCard = page.getByTestId('draggable-assignment-card').first();
      await assignmentCard.click({ modifiers: ['Alt'] });

      await page.waitForTimeout(500);

      // Verify deleted
      const afterDeleteCount = await page.getByTestId('draggable-assignment-card').count();
      expect(afterDeleteCount).toBe(initialCount - 1);

      // Undo
      await page.keyboard.press('Meta+z');
      await page.waitForTimeout(500);

      // Verify restored
      const finalCount = await page.getByTestId('draggable-assignment-card').count();
      expect(finalCount).toBe(initialCount);
    });

    test.skip('should not allow more than 10 undos', async ({ page }) => {
      // This test would require setting up many actions
      // and verifying the undo stack limit
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      // Implementation would involve performing 15+ actions
      // then verifying only 10 can be undone
    });
  });

  test.describe('Weekdays Only Calendar', () => {
    test.skip('should only show weekdays (Mon-Fri) in calendar grid', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Check column headers - should be Mon, Tue, Wed, Thu, Fri
      const headers = page.locator('[data-testid="calendar-header-day"]');
      const headerCount = await headers.count();

      // Should be exactly 5 columns (weekdays only)
      expect(headerCount).toBe(5);

      // Verify header text
      const headerTexts = await headers.allTextContents();
      expect(headerTexts).toContain('Mon');
      expect(headerTexts).toContain('Tue');
      expect(headerTexts).toContain('Wed');
      expect(headerTexts).toContain('Thu');
      expect(headerTexts).toContain('Fri');

      // Should NOT contain weekend days
      expect(headerTexts).not.toContain('Sat');
      expect(headerTexts).not.toContain('Sun');
    });

    test.skip('should have 5-column grid layout', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Check that each row has exactly 5 day cells
      const calendarGrid = page.locator('[data-testid="calendar-grid"]');
      const firstRow = calendarGrid.locator('[data-testid="calendar-week-row"]').first();
      const dayCells = firstRow.locator('[data-testid="droppable-day-cell"]');

      const cellCount = await dayCells.count();
      expect(cellCount).toBe(5);
    });
  });

  test.describe('Today Indicator', () => {
    test.skip('should show today indicator on current date', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      // Check for today indicator
      const todayIndicator = page.getByTestId('today-indicator');
      await expect(todayIndicator).toBeVisible();
    });

    test.skip('today indicator should be a vertical line', async ({ page }) => {
      const authHelpers = new AuthHelpers(page);
      await authHelpers.login('admin@example.com', 'password123');

      await page.goto('/projects/test-project-id/calendar');
      await page.waitForLoadState('networkidle');

      const todayIndicator = page.getByTestId('today-indicator');

      // Check styling - should be a thin vertical line
      const styles = await todayIndicator.evaluate((el) => {
        const computed = window.getComputedStyle(el);
        return {
          width: computed.width,
          height: computed.height,
          backgroundColor: computed.backgroundColor,
        };
      });

      // Width should be small (1-3px for a line)
      const width = parseInt(styles.width);
      expect(width).toBeLessThanOrEqual(4);
    });
  });
});

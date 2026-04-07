# Navigation Condensation + Keyboard Shortcuts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Condense sidebar navigation, add admin settings flyout submenu, command palette (Cmd+K), and comprehensive keyboard shortcuts.

**Architecture:** Central keyboard shortcut system via React context provider. Sidebar restructured with Radix Popover for admin flyout. Command palette built on existing shadcn CommandDialog (cmdk). Pages register their own shortcuts on mount.

**Tech Stack:** React context, Zustand (recent pages store), Radix Popover, cmdk (already installed via shadcn command.tsx), lucide-react icons.

---

### Task 1: Keyboard Shortcuts Registry

Create the central shortcut system that all other tasks depend on.

**Files:**
- Create: `src/lib/keyboard-shortcuts.ts`
- Test: `src/lib/__tests__/keyboard-shortcuts.test.ts`

**Step 1: Write the failing test**

```typescript
// src/lib/__tests__/keyboard-shortcuts.test.ts
import { describe, it, expect } from 'vitest';
import {
  GLOBAL_SHORTCUTS,
  ADMIN_SHORTCUTS,
  CALENDAR_SHORTCUTS,
  PROJECTS_SHORTCUTS,
  PROJECT_DETAIL_SHORTCUTS,
  type ShortcutDefinition,
} from '../keyboard-shortcuts';

describe('keyboard-shortcuts', () => {
  it('exports global shortcuts with required fields', () => {
    expect(GLOBAL_SHORTCUTS.length).toBeGreaterThan(0);
    for (const s of GLOBAL_SHORTCUTS) {
      expect(s).toHaveProperty('id');
      expect(s).toHaveProperty('keys');
      expect(s).toHaveProperty('label');
      expect(s).toHaveProperty('section');
    }
  });

  it('has no duplicate shortcut ids across all groups', () => {
    const all = [
      ...GLOBAL_SHORTCUTS,
      ...ADMIN_SHORTCUTS,
      ...CALENDAR_SHORTCUTS,
      ...PROJECTS_SHORTCUTS,
      ...PROJECT_DETAIL_SHORTCUTS,
    ];
    const ids = all.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('navigation shortcuts use G-then-X chord pattern', () => {
    const navShortcuts = GLOBAL_SHORTCUTS.filter((s) => s.section === 'Navigation');
    for (const s of navShortcuts) {
      expect(s.keys).toMatch(/^g /);
    }
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/lib/__tests__/keyboard-shortcuts.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/lib/keyboard-shortcuts.ts
export interface ShortcutDefinition {
  id: string;
  keys: string; // e.g. "g d" for chord, "mod+k" for modifier combo
  label: string;
  section: 'Global' | 'Navigation' | 'Admin' | 'Calendar' | 'Projects' | 'Project Detail';
  action?: string; // route to navigate to, or action name
}

export const GLOBAL_SHORTCUTS: ShortcutDefinition[] = [
  { id: 'command-palette', keys: 'mod+k', label: 'Open command palette', section: 'Global' },
  { id: 'shortcuts-help', keys: '?', label: 'Keyboard shortcuts', section: 'Global' },
  { id: 'new-project', keys: 'n', label: 'New project', section: 'Global', action: '/projects/new' },
  { id: 'close-modal', keys: 'Escape', label: 'Close dialog', section: 'Global' },
  { id: 'nav-dashboard', keys: 'g d', label: 'Go to Dashboard', section: 'Navigation', action: '/' },
  { id: 'nav-projects', keys: 'g p', label: 'Go to Projects', section: 'Navigation', action: '/projects' },
  { id: 'nav-project-calendar', keys: 'g c', label: 'Go to Project Calendar', section: 'Navigation', action: '/project-calendar' },
  { id: 'nav-my-schedule', keys: 'g m', label: 'Go to My Schedule', section: 'Navigation', action: '/my-schedule' },
  { id: 'nav-upcoming-deals', keys: 'g u', label: 'Go to Upcoming Deals', section: 'Navigation', action: '/upcoming-deals' },
  { id: 'nav-l10', keys: 'g l', label: 'Go to L10 Meetings', section: 'Navigation', action: '/l10' },
  { id: 'nav-todos', keys: 'g t', label: 'Go to My To-Dos', section: 'Navigation', action: '/l10/todos' },
];

export const ADMIN_SHORTCUTS: ShortcutDefinition[] = [
  { id: 'nav-approvals', keys: 'g a', label: 'Go to Approvals', section: 'Admin', action: '/approvals' },
  { id: 'nav-revenue-goals', keys: 'g r', label: 'Go to Revenue Goals', section: 'Admin', action: '/admin/goals' },
];

export const CALENDAR_SHORTCUTS: ShortcutDefinition[] = [
  { id: 'cal-undo', keys: 'mod+z', label: 'Undo', section: 'Calendar' },
  { id: 'cal-prev-week', keys: 'ArrowLeft', label: 'Previous week', section: 'Calendar' },
  { id: 'cal-next-week', keys: 'ArrowRight', label: 'Next week', section: 'Calendar' },
  { id: 'cal-today', keys: 't', label: 'Jump to today', section: 'Calendar' },
];

export const PROJECTS_SHORTCUTS: ShortcutDefinition[] = [
  { id: 'proj-down', keys: 'j', label: 'Move selection down', section: 'Projects' },
  { id: 'proj-up', keys: 'k', label: 'Move selection up', section: 'Projects' },
  { id: 'proj-open', keys: 'Enter', label: 'Open selected project', section: 'Projects' },
  { id: 'proj-search', keys: '/', label: 'Focus search', section: 'Projects' },
];

export const PROJECT_DETAIL_SHORTCUTS: ShortcutDefinition[] = [
  { id: 'proj-edit', keys: 'e', label: 'Edit project', section: 'Project Detail' },
  { id: 'proj-back', keys: 'Backspace', label: 'Back to projects', section: 'Project Detail' },
];

/** Format a shortcut key string for display. Replaces "mod" with platform symbol. */
export function formatShortcutKeys(keys: string): string {
  const isMac = typeof navigator !== 'undefined' && navigator.platform?.includes('Mac');
  return keys
    .replace(/mod\+/g, isMac ? '⌘' : 'Ctrl+')
    .replace(/ArrowLeft/g, '←')
    .replace(/ArrowRight/g, '→')
    .replace(/Escape/g, 'Esc')
    .replace(/Backspace/g, '⌫')
    .replace(/Enter/g, '↵')
    .replace(/\b([a-z])\b/g, (_, c) => c.toUpperCase())
    .replace(/ /g, ' then ');
}

/** Get all shortcut definitions grouped by section. */
export function getAllShortcuts(isAdmin: boolean): Record<string, ShortcutDefinition[]> {
  const all = [...GLOBAL_SHORTCUTS, ...(isAdmin ? ADMIN_SHORTCUTS : [])];
  return all.reduce(
    (acc, s) => {
      if (!acc[s.section]) acc[s.section] = [];
      acc[s.section].push(s);
      return acc;
    },
    {} as Record<string, ShortcutDefinition[]>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/lib/__tests__/keyboard-shortcuts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/keyboard-shortcuts.ts src/lib/__tests__/keyboard-shortcuts.test.ts
git commit -m "feat: add keyboard shortcut definitions registry"
```

---

### Task 2: Keyboard Shortcuts Hook (useKeyboardShortcuts)

The core hook that listens for keyboard events and dispatches actions. Handles chord sequences (G then D) and modifier combos (Cmd+K).

**Files:**
- Create: `src/hooks/use-keyboard-shortcuts.ts`
- Test: `src/hooks/__tests__/use-keyboard-shortcuts.test.ts`

**Step 1: Write the failing test**

```typescript
// src/hooks/__tests__/use-keyboard-shortcuts.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardShortcuts } from '../use-keyboard-shortcuts';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/',
}));

describe('useKeyboardShortcuts', () => {
  it('calls handler for simple key shortcut', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ keys: 'n', handler }])
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n' }));
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores shortcuts when typing in input', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ keys: 'n', handler }])
    );

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', bubbles: true }));
    });

    expect(handler).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it('handles modifier combos (mod+k)', () => {
    const handler = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts([{ keys: 'mod+k', handler }])
    );

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'k', metaKey: true })
      );
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('handles chord sequences (g then d)', async () => {
    const handler = vi.fn();
    vi.useFakeTimers();

    renderHook(() =>
      useKeyboardShortcuts([{ keys: 'g d', handler }])
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    });

    expect(handler).toHaveBeenCalledTimes(1);

    vi.useRealTimers();
  });

  it('chord sequence times out after 1000ms', () => {
    const handler = vi.fn();
    vi.useFakeTimers();

    renderHook(() =>
      useKeyboardShortcuts([{ keys: 'g d', handler }])
    );

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'g' }));
    });

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'd' }));
    });

    expect(handler).not.toHaveBeenCalled();

    vi.useRealTimers();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/hooks/__tests__/use-keyboard-shortcuts.test.ts`
Expected: FAIL — module not found

**Step 3: Write minimal implementation**

```typescript
// src/hooks/use-keyboard-shortcuts.ts
'use client';

import { useEffect, useRef, useCallback } from 'react';

interface ShortcutBinding {
  keys: string; // "n", "mod+k", "g d" (chord)
  handler: () => void;
}

function isTypingInInput(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement;
  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable ||
    target.closest('[role="combobox"]') !== null ||
    target.closest('[cmdk-input]') !== null
  );
}

function parseKeys(keys: string): { isChord: boolean; parts: string[] } {
  const parts = keys.split(' ');
  return { isChord: parts.length > 1, parts };
}

function matchesModifierCombo(e: KeyboardEvent, keys: string): boolean {
  const parts = keys.split('+');
  const key = parts.pop()!;
  const modifiers = parts;

  if (e.key.toLowerCase() !== key.toLowerCase()) return false;

  const needsMod = modifiers.includes('mod');
  const hasMod = e.metaKey || e.ctrlKey;

  if (needsMod && !hasMod) return false;
  if (!needsMod && (e.metaKey || e.ctrlKey)) return false;

  return true;
}

export function useKeyboardShortcuts(bindings: ShortcutBinding[]) {
  const chordBuffer = useRef<string | null>(null);
  const chordTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bindingsRef = useRef(bindings);
  bindingsRef.current = bindings;

  const clearChord = useCallback(() => {
    chordBuffer.current = null;
    if (chordTimeout.current) {
      clearTimeout(chordTimeout.current);
      chordTimeout.current = null;
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Allow Escape everywhere (for closing dialogs)
      if (e.key === 'Escape') {
        const escBinding = bindingsRef.current.find((b) => b.keys === 'Escape');
        if (escBinding) escBinding.handler();
        return;
      }

      // Skip if typing in input (except for modifier combos)
      const hasModifier = e.metaKey || e.ctrlKey;
      if (isTypingInInput(e) && !hasModifier) return;

      // Check for chord continuation
      if (chordBuffer.current) {
        const firstKey = chordBuffer.current;
        clearChord();

        const match = bindingsRef.current.find((b) => {
          const { isChord, parts } = parseKeys(b.keys);
          return isChord && parts[0] === firstKey && parts[1] === e.key.toLowerCase();
        });

        if (match) {
          e.preventDefault();
          match.handler();
        }
        return;
      }

      // Check for modifier combos (mod+k, mod+z, etc.)
      if (hasModifier) {
        const match = bindingsRef.current.find(
          (b) => b.keys.includes('+') && matchesModifierCombo(e, b.keys)
        );
        if (match) {
          e.preventDefault();
          match.handler();
        }
        return;
      }

      // Check if this key starts a chord
      const startsChord = bindingsRef.current.some((b) => {
        const { isChord, parts } = parseKeys(b.keys);
        return isChord && parts[0] === e.key.toLowerCase();
      });

      if (startsChord) {
        chordBuffer.current = e.key.toLowerCase();
        chordTimeout.current = setTimeout(clearChord, 1000);
        return;
      }

      // Simple single-key shortcut
      const match = bindingsRef.current.find((b) => {
        const { isChord } = parseKeys(b.keys);
        return !isChord && !b.keys.includes('+') && b.keys === e.key.toLowerCase();
      });

      // Special case: ? requires shift+/ but key is "?"
      const questionMatch = bindingsRef.current.find((b) => b.keys === '?' && e.key === '?');

      if (questionMatch) {
        e.preventDefault();
        questionMatch.handler();
      } else if (match) {
        e.preventDefault();
        match.handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearChord();
    };
  }, [clearChord]);
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/hooks/__tests__/use-keyboard-shortcuts.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/hooks/use-keyboard-shortcuts.ts src/hooks/__tests__/use-keyboard-shortcuts.test.ts
git commit -m "feat: add useKeyboardShortcuts hook with chord sequence support"
```

---

### Task 3: Recent Pages Store

Zustand store tracking last 5 visited pages for the command palette.

**Files:**
- Create: `src/lib/stores/recent-pages-store.ts`

**Step 1: Write the store**

```typescript
// src/lib/stores/recent-pages-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface RecentPage {
  href: string;
  title: string;
  visitedAt: number;
}

interface RecentPagesStore {
  pages: RecentPage[];
  addPage: (href: string, title: string) => void;
}

export const useRecentPagesStore = create<RecentPagesStore>()(
  persist(
    (set) => ({
      pages: [],
      addPage: (href, title) =>
        set((state) => {
          const filtered = state.pages.filter((p) => p.href !== href);
          return {
            pages: [{ href, title, visitedAt: Date.now() }, ...filtered].slice(0, 5),
          };
        }),
    }),
    { name: 'amidash-recent-pages' }
  )
);
```

**Step 2: Commit**

```bash
git add src/lib/stores/recent-pages-store.ts
git commit -m "feat: add recent pages Zustand store for command palette"
```

---

### Task 4: Sidebar Restructure

Condense the sidebar: merge L10 into Main, remove Settings from Main, add admin flyout, add footer link.

**Files:**
- Modify: `src/components/layout/sidebar.tsx` (entire file)

**Step 1: Restructure the nav item arrays**

In `sidebar.tsx`, replace the three nav arrays (lines 46-133) with:

```typescript
const mainNavItems = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'Projects', href: '/projects', icon: FolderKanban },
  { title: 'Project Calendar', href: '/project-calendar', icon: CalendarRange },
  { title: 'My Schedule', href: '/my-schedule', icon: CalendarDays },
  { title: 'Upcoming Deals', href: '/upcoming-deals', icon: Handshake },
  { title: 'L10 Meetings', href: '/l10', icon: Presentation },
  { title: 'My To-Dos', href: '/l10/todos', icon: ListChecks },
];

const adminTopItems = [
  { title: 'Revenue Goals', href: '/admin/goals', icon: Target },
  { title: 'Approvals', href: '/approvals', icon: CheckSquare },
];

const adminSettingsItems = [
  { title: 'General Settings', href: '/admin/settings', icon: Settings2 },
  { title: 'Statuses', href: '/admin/statuses', icon: ListChecks },
  { title: 'Users', href: '/admin/users', icon: Users },
  { title: 'Portal Builder', href: '/admin/portal-builder', icon: LayoutTemplate },
  { title: 'Audit Log', href: '/admin/audit', icon: FileText },
  { title: 'Digital Signage', href: '/admin/signage', icon: Tv },
];
```

Remove `l10NavItems` array. Remove the Settings entry from `mainNavItems`. Remove the old `adminNavItems` array.

**Step 2: Add the admin settings flyout**

Add imports at the top:
```typescript
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ChevronRight as ChevronRightIcon } from 'lucide-react'; // already imported as ChevronRight
import { Keyboard } from 'lucide-react';
```

Create a new `AdminSettingsFlyout` component inside `sidebar.tsx`:

```typescript
function AdminSettingsFlyout({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const isAnyActive = adminSettingsItems.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  );

  const trigger = (
    <button
      className={cn(
        'relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-2',
        isAnyActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
      )}
    >
      <Settings2 className="h-5 w-5 shrink-0" />
      {!collapsed && (
        <>
          Admin Settings
          <ChevronRight className="ml-auto h-4 w-4" />
        </>
      )}
    </button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {collapsed ? (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>{trigger}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              Admin Settings
            </TooltipContent>
          </Tooltip>
        ) : (
          trigger
        )}
      </PopoverTrigger>
      <PopoverContent
        side="right"
        sideOffset={8}
        align="start"
        className="w-48 p-1"
      >
        {adminSettingsItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
                isActive
                  ? 'bg-accent text-accent-foreground'
                  : 'text-foreground hover:bg-accent/50'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.title}
            </Link>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
```

**Step 3: Update SidebarContent to use new structure**

Replace the navigation rendering in `SidebarContent` (lines 228-322). The new nav section should:

1. Render `mainNavItems` (no L10 section separator)
2. Render admin section header, `adminTopItems`, then `<AdminSettingsFlyout />`
3. Render footer with "Keyboard Shortcuts" link

Replace the L10 and Admin blocks with:

```typescript
{/* Main nav items (includes L10) */}
{mainNavItems.map((item) => {
  const isActive = pathname === item.href ||
    (item.href !== '/' && pathname.startsWith(item.href));
  return (
    <NavItem
      key={item.href}
      item={item}
      isActive={isActive}
      collapsed={collapsed}
      onNavigate={onNavigate}
      badge={item.href === '/l10/todos' ? overdueCount : undefined}
    />
  );
})}

{/* Admin section */}
{isAdmin && (
  <>
    {!collapsed && (
      <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
        Admin
      </div>
    )}
    {collapsed && <div className="mt-4 mb-2 border-t border-sidebar-border/50" />}
    {adminTopItems.map((item) => {
      const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
      return (
        <NavItem
          key={item.href}
          item={item}
          isActive={isActive}
          collapsed={collapsed}
          onNavigate={onNavigate}
          badge={item.href === '/approvals' ? pendingApprovalCount : undefined}
        />
      );
    })}
    <AdminSettingsFlyout collapsed={collapsed} onNavigate={onNavigate} />
  </>
)}
```

**Step 4: Add Keyboard Shortcuts footer link**

In the footer section (after the collapse toggle button, before the version text), add:

```typescript
{!collapsed && (
  <button
    onClick={() => {
      // This will be connected to the shortcuts dialog in Task 6
      window.dispatchEvent(new CustomEvent('open-shortcuts-dialog'));
    }}
    className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
  >
    <Keyboard className="h-3.5 w-3.5" />
    Keyboard Shortcuts
    <span className="ml-auto text-[10px] opacity-60">?</span>
  </button>
)}
```

**Step 5: Run the app and verify sidebar renders**

Run: `npm run dev` and check the sidebar visually. Verify:
- L10 items appear in Main section
- Settings is gone from Main
- Admin has Revenue Goals, Approvals, then "Admin Settings →" with flyout
- Footer shows "Keyboard Shortcuts"

**Step 6: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat: condense sidebar - merge L10, add admin settings flyout"
```

---

### Task 5: Header User Dropdown Updates

Add Settings and Keyboard Shortcuts links to the top-right user dropdown.

**Files:**
- Modify: `src/components/layout/header.tsx` (lines 81-90)

**Step 1: Add imports**

Add to imports at top of `header.tsx`:

```typescript
import { LogOut, Menu, Settings, Keyboard } from 'lucide-react';
import Link from 'next/link';
```

**Step 2: Add menu items before Sign Out**

Insert after `<DropdownMenuSeparator />` (line 81) and before the Sign Out `DropdownMenuItem` (line 82):

```typescript
<DropdownMenuItem asChild className="cursor-pointer">
  <Link href="/settings">
    <Settings className="mr-2 h-4 w-4" />
    Settings
  </Link>
</DropdownMenuItem>
<DropdownMenuItem
  className="cursor-pointer"
  onClick={() => window.dispatchEvent(new CustomEvent('open-shortcuts-dialog'))}
>
  <Keyboard className="mr-2 h-4 w-4" />
  Keyboard Shortcuts
</DropdownMenuItem>
<DropdownMenuSeparator />
```

**Step 3: Commit**

```bash
git add src/components/layout/header.tsx
git commit -m "feat: add Settings and Keyboard Shortcuts to user dropdown"
```

---

### Task 6: Keyboard Shortcuts Dialog

Modal showing all available shortcuts, organized by section.

**Files:**
- Create: `src/components/keyboard-shortcuts-dialog.tsx`

**Step 1: Write the component**

```typescript
// src/components/keyboard-shortcuts-dialog.tsx
'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useUser } from '@/contexts/user-context';
import {
  GLOBAL_SHORTCUTS,
  ADMIN_SHORTCUTS,
  CALENDAR_SHORTCUTS,
  PROJECTS_SHORTCUTS,
  PROJECT_DETAIL_SHORTCUTS,
  formatShortcutKeys,
  type ShortcutDefinition,
} from '@/lib/keyboard-shortcuts';

function ShortcutSection({
  title,
  shortcuts,
}: {
  title: string;
  shortcuts: ShortcutDefinition[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-muted-foreground mb-2">{title}</h3>
      <div className="space-y-1">
        {shortcuts.map((s) => (
          <div key={s.id} className="flex items-center justify-between py-1">
            <span className="text-sm">{s.label}</span>
            <kbd className="inline-flex items-center gap-1 rounded border bg-muted px-1.5 py-0.5 text-xs font-mono text-muted-foreground">
              {formatShortcutKeys(s.keys)}
            </kbd>
          </div>
        ))}
      </div>
    </div>
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);
  const { isAdmin } = useUser();

  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('open-shortcuts-dialog', handler);
    return () => window.removeEventListener('open-shortcuts-dialog', handler);
  }, []);

  const globalNonNav = GLOBAL_SHORTCUTS.filter((s) => s.section === 'Global');
  const navigation = GLOBAL_SHORTCUTS.filter((s) => s.section === 'Navigation');

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          <ShortcutSection title="Global" shortcuts={globalNonNav} />
          <ShortcutSection title="Navigation" shortcuts={navigation} />
          {isAdmin && <ShortcutSection title="Admin" shortcuts={ADMIN_SHORTCUTS} />}
          <ShortcutSection title="Calendar" shortcuts={CALENDAR_SHORTCUTS} />
          <ShortcutSection title="Projects List" shortcuts={PROJECTS_SHORTCUTS} />
          <ShortcutSection title="Project Detail" shortcuts={PROJECT_DETAIL_SHORTCUTS} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/keyboard-shortcuts-dialog.tsx
git commit -m "feat: add keyboard shortcuts cheatsheet dialog"
```

---

### Task 7: Command Palette

The Cmd+K command palette using existing shadcn CommandDialog.

**Files:**
- Create: `src/components/command-palette.tsx`

**Step 1: Write the component**

```typescript
// src/components/command-palette.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from '@/components/ui/command';
import {
  LayoutDashboard,
  FolderKanban,
  CalendarRange,
  CalendarDays,
  Handshake,
  Presentation,
  ListChecks,
  Target,
  CheckSquare,
  Settings2,
  Users,
  LayoutTemplate,
  FileText,
  Tv,
  Plus,
  LogOut,
  Clock,
} from 'lucide-react';
import { useUser } from '@/contexts/user-context';
import { useRecentPagesStore } from '@/lib/stores/recent-pages-store';
import { formatShortcutKeys } from '@/lib/keyboard-shortcuts';

interface PaletteItem {
  id: string;
  label: string;
  icon: React.ElementType;
  action: () => void;
  shortcut?: string;
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { isAdmin, signOut } = useUser();
  const { pages: recentPages } = useRecentPagesStore();

  // Listen for Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router]
  );

  const navItems: PaletteItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, action: () => navigate('/'), shortcut: 'G D' },
    { id: 'projects', label: 'Projects', icon: FolderKanban, action: () => navigate('/projects'), shortcut: 'G P' },
    { id: 'project-calendar', label: 'Project Calendar', icon: CalendarRange, action: () => navigate('/project-calendar'), shortcut: 'G C' },
    { id: 'my-schedule', label: 'My Schedule', icon: CalendarDays, action: () => navigate('/my-schedule'), shortcut: 'G M' },
    { id: 'upcoming-deals', label: 'Upcoming Deals', icon: Handshake, action: () => navigate('/upcoming-deals'), shortcut: 'G U' },
    { id: 'l10', label: 'L10 Meetings', icon: Presentation, action: () => navigate('/l10'), shortcut: 'G L' },
    { id: 'todos', label: 'My To-Dos', icon: ListChecks, action: () => navigate('/l10/todos'), shortcut: 'G T' },
  ];

  const adminItems: PaletteItem[] = [
    { id: 'revenue-goals', label: 'Revenue Goals', icon: Target, action: () => navigate('/admin/goals'), shortcut: 'G R' },
    { id: 'approvals', label: 'Approvals', icon: CheckSquare, action: () => navigate('/approvals'), shortcut: 'G A' },
    { id: 'admin-settings', label: 'General Settings', icon: Settings2, action: () => navigate('/admin/settings') },
    { id: 'statuses', label: 'Statuses', icon: ListChecks, action: () => navigate('/admin/statuses') },
    { id: 'users', label: 'Users', icon: Users, action: () => navigate('/admin/users') },
    { id: 'portal-builder', label: 'Portal Builder', icon: LayoutTemplate, action: () => navigate('/admin/portal-builder') },
    { id: 'audit-log', label: 'Audit Log', icon: FileText, action: () => navigate('/admin/audit') },
    { id: 'digital-signage', label: 'Digital Signage', icon: Tv, action: () => navigate('/admin/signage') },
  ];

  const actionItems: PaletteItem[] = [
    { id: 'new-project', label: 'New Project', icon: Plus, action: () => navigate('/projects/new'), shortcut: 'N' },
    {
      id: 'sign-out',
      label: 'Sign Out',
      icon: LogOut,
      action: () => {
        setOpen(false);
        signOut();
      },
    },
  ];

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Command Palette" description="Search for pages and actions">
      <CommandInput placeholder="Type to search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {recentPages.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentPages.map((page) => (
                <CommandItem key={page.href} onSelect={() => navigate(page.href)}>
                  <Clock className="mr-2 h-4 w-4" />
                  {page.title}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        <CommandGroup heading="Navigation">
          {navItems.map((item) => (
            <CommandItem key={item.id} onSelect={item.action}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>

        {isAdmin && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Admin">
              {adminItems.map((item) => (
                <CommandItem key={item.id} onSelect={item.action}>
                  <item.icon className="mr-2 h-4 w-4" />
                  {item.label}
                  {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        <CommandSeparator />
        <CommandGroup heading="Actions">
          {actionItems.map((item) => (
            <CommandItem key={item.id} onSelect={item.action}>
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
              {item.shortcut && <CommandShortcut>{item.shortcut}</CommandShortcut>}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

**Step 2: Commit**

```bash
git add src/components/command-palette.tsx
git commit -m "feat: add Cmd+K command palette with navigation and actions"
```

---

### Task 8: Wire Everything into Dashboard Layout

Connect the keyboard shortcuts hook, command palette, and shortcuts dialog into the dashboard layout.

**Files:**
- Modify: `src/components/layout/dashboard-content.tsx`
- Modify: `src/app/(dashboard)/layout.tsx`

**Step 1: Update DashboardContent**

Replace the existing keyboard shortcut `useEffect` in `dashboard-content.tsx` (lines 17-33) with the new hook. Add the global navigation shortcuts:

```typescript
// Add imports at top
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useUser } from '@/contexts/user-context';
import { useRecentPagesStore } from '@/lib/stores/recent-pages-store';
import { usePathname } from 'next/navigation';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';
```

Inside the component, replace the `useEffect` with:

```typescript
const pathname = usePathname();
const { isAdmin } = useUser();
const { addPage } = useRecentPagesStore();

// Track recent pages
useEffect(() => {
  const titles: Record<string, string> = {
    '/': 'Dashboard',
    '/projects': 'Projects',
    '/project-calendar': 'Project Calendar',
    '/my-schedule': 'My Schedule',
    '/upcoming-deals': 'Upcoming Deals',
    '/l10': 'L10 Meetings',
    '/l10/todos': 'My To-Dos',
    '/approvals': 'Approvals',
    '/admin/goals': 'Revenue Goals',
    '/settings': 'Settings',
  };
  if (titles[pathname]) {
    addPage(pathname, titles[pathname]);
  }
}, [pathname, addPage]);

// Global keyboard shortcuts
const shortcuts = [
  { keys: '?', handler: () => window.dispatchEvent(new CustomEvent('open-shortcuts-dialog')) },
  { keys: 'n', handler: () => router.push('/projects/new') },
  { keys: 'g d', handler: () => router.push('/') },
  { keys: 'g p', handler: () => router.push('/projects') },
  { keys: 'g c', handler: () => router.push('/project-calendar') },
  { keys: 'g m', handler: () => router.push('/my-schedule') },
  { keys: 'g u', handler: () => router.push('/upcoming-deals') },
  { keys: 'g l', handler: () => router.push('/l10') },
  { keys: 'g t', handler: () => router.push('/l10/todos') },
  ...(isAdmin
    ? [
        { keys: 'g a', handler: () => router.push('/approvals') },
        { keys: 'g r', handler: () => router.push('/admin/goals') },
      ]
    : []),
];

useKeyboardShortcuts(shortcuts);
```

Add the palette and dialog to the JSX return, after `<GlobalCreateFAB />`:

```typescript
<CommandPalette />
<KeyboardShortcutsDialog />
```

**Step 2: Verify the build compiles**

Run: `npm run build` (or at minimum `npx tsc --noEmit`)

**Step 3: Commit**

```bash
git add src/components/layout/dashboard-content.tsx
git commit -m "feat: wire global shortcuts, command palette, and shortcuts dialog"
```

---

### Task 9: Calendar Page Shortcuts

Add ←/→ for week navigation and T for today.

**Files:**
- Modify: Calendar page components that handle week navigation (identify exact file by checking `src/app/(dashboard)/calendar/` or `src/components/calendar/` for the component with week navigation state)

**Step 1: Identify the calendar component with week navigation**

Look for `previousWeek`/`nextWeek` or date navigation functions in `src/components/calendar/` or `src/app/(dashboard)/calendar/`.

**Step 2: Add shortcuts**

Import `useKeyboardShortcuts` and register:

```typescript
useKeyboardShortcuts([
  { keys: 'ArrowLeft', handler: goToPreviousWeek },
  { keys: 'ArrowRight', handler: goToNextWeek },
  { keys: 't', handler: goToToday },
]);
```

Note: The existing `useUndo` hook already handles `Cmd+Z` — no changes needed for that.

**Step 3: Commit**

```bash
git commit -am "feat: add arrow key and T shortcut for calendar navigation"
```

---

### Task 10: Projects Page J/K Navigation

Add vim-style keyboard navigation to the projects list.

**Files:**
- Modify: `src/app/(dashboard)/projects/page.tsx`

**Step 1: Add selection state and shortcuts**

Add a `selectedIndex` state and `useKeyboardShortcuts` bindings:

```typescript
const [selectedIndex, setSelectedIndex] = useState(-1);
const searchInputRef = useRef<HTMLInputElement>(null);

useKeyboardShortcuts([
  {
    keys: 'j',
    handler: () => setSelectedIndex((prev) => Math.min(prev + 1, projectCount - 1)),
  },
  {
    keys: 'k',
    handler: () => setSelectedIndex((prev) => Math.max(prev - 1, 0)),
  },
  {
    keys: 'Enter',
    handler: () => {
      if (selectedIndex >= 0 && projects[selectedIndex]) {
        router.push(`/projects/${projects[selectedIndex].id}`);
      }
    },
  },
  {
    keys: '/',
    handler: () => searchInputRef.current?.focus(),
  },
]);
```

**Step 2: Add visual highlight**

Apply a highlight class to the selected project row:

```typescript
className={cn(
  'existing-classes',
  selectedIndex === index && 'ring-2 ring-primary ring-inset'
)}
```

**Step 3: Auto-scroll selected item into view**

```typescript
useEffect(() => {
  if (selectedIndex >= 0) {
    const el = document.querySelector(`[data-project-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }
}, [selectedIndex]);
```

**Step 4: Commit**

```bash
git commit -am "feat: add J/K keyboard navigation to projects list"
```

---

### Task 11: Project Detail Page Shortcuts

Add E to edit and Backspace to go back.

**Files:**
- Modify: `src/app/(dashboard)/projects/[id]/page.tsx`

**Step 1: Add shortcuts**

```typescript
useKeyboardShortcuts([
  {
    keys: 'e',
    handler: () => router.push(`/projects/${projectId}/edit`),
  },
  {
    keys: 'Backspace',
    handler: () => router.push('/projects'),
  },
]);
```

**Step 2: Commit**

```bash
git commit -am "feat: add E and Backspace shortcuts to project detail page"
```

---

### Task 12: Remove Old Cmd+P Shortcut

The old Cmd+P shortcut in `dashboard-content.tsx` was replaced by the new system. Verify the old useEffect was removed in Task 8. Also remove the Cmd+P reference from any existing help text.

**Files:**
- Verify: `src/components/layout/dashboard-content.tsx` — old useEffect is gone
- Check: `src/components/calendar/keyboard-shortcuts-help.tsx` — update if it references Cmd+P

**Step 1: Verify and clean up**

Read `keyboard-shortcuts-help.tsx` and update it to reference the new shortcut system or remove it if the new shortcuts dialog replaces it.

**Step 2: Commit**

```bash
git commit -am "chore: remove old Cmd+P shortcut, update help references"
```

---

### Task 13: Final Verification

**Step 1: Run all tests**

Run: `npm test`
Expected: All existing tests pass, new tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Manual testing checklist**

- [ ] Sidebar shows condensed layout (L10 in Main, no Settings link)
- [ ] Admin Settings flyout opens and navigates correctly
- [ ] User dropdown has Settings, Keyboard Shortcuts, Sign Out
- [ ] Cmd+K opens command palette with fuzzy search
- [ ] G then D navigates to Dashboard (test a few chord shortcuts)
- [ ] ? opens shortcuts cheatsheet dialog
- [ ] N navigates to new project
- [ ] Calendar: ← → T work for navigation
- [ ] Projects: J/K moves selection, Enter opens project
- [ ] Shortcuts are suppressed when typing in inputs
- [ ] Collapsed sidebar flyout works correctly

**Step 4: Commit any fixes, then squash or finalize**

```bash
git commit -am "test: verify navigation and keyboard shortcuts"
```

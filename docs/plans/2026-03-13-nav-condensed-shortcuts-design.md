# Navigation Condensation + Keyboard Shortcuts Design

**Date:** 2026-03-13
**Branch:** claude/cool-jepsen

## Goals

1. Condense the sidebar navigation
2. Move user settings to the top-right user dropdown
3. Group admin settings behind a flyout submenu
4. Add a command palette (Cmd+K)
5. Add comprehensive keyboard shortcuts
6. Document all shortcuts in a cheatsheet dialog

## Sidebar Restructure

### New Layout

```
[+ New Project]

── MAIN ──
  Dashboard           /
  Projects            /projects
  Project Calendar    /project-calendar
  My Schedule         /my-schedule
  Upcoming Deals      /upcoming-deals
  L10 Meetings        /l10
  My To-Dos (badge)   /l10/todos

── ADMIN ── (admins only)
  Revenue Goals       /admin/goals
  Approvals (badge)   /admin/approvals
  Admin Settings →    flyout trigger

── FOOTER ──
  Keyboard Shortcuts
```

### Changes from Current

- **Removed from sidebar:** Settings link (moved to user dropdown)
- **L10 section merged into Main:** L10 Meetings and My To-Dos move from separate section into Main
- **Admin section condensed:** Revenue Goals and Approvals stay top-level. The remaining 6 items (General Settings, Statuses, Users, Portal Builder, Audit Log, Digital Signage) move behind a flyout submenu triggered by "Admin Settings"

### Admin Settings Flyout

Triggered by hover/click on "Admin Settings →". Appears as a Radix Popover anchored to the right of the sidebar item.

Contents:
- General Settings → /admin/settings
- Statuses → /admin/statuses
- Users → /admin/users
- Portal Builder → /admin/portal-builder
- Audit Log → /admin/audit
- Digital Signage → /admin/signage

When sidebar is collapsed (icon-only mode), the flyout appears on hover — same pattern as existing tooltips.

### User Dropdown (Top-Right Header)

Current: name, email, role badge, Sign Out
New: name, email, role badge, **Settings** (→ /settings), **Keyboard Shortcuts**, Sign Out

## Command Palette

Opened with `Cmd+K` (Mac) / `Ctrl+K` (Windows). Built with shadcn CommandDialog (wraps cmdk).

### Sections

1. **Navigation** — all sidebar pages
2. **Admin** — admin settings pages (admin users only)
3. **Actions** — New Project, Sign Out
4. **Recent** — last 5 visited pages (tracked in localStorage via Zustand)

### Behavior

- Type to fuzzy-filter results
- Arrow keys to navigate, Enter to select, Esc to close
- Each item shows its keyboard shortcut on the right
- Closing navigates to selected item

## Keyboard Shortcuts

### Global (work everywhere)

| Shortcut | Action |
|----------|--------|
| `Cmd+K` | Open command palette |
| `?` | Open keyboard shortcuts cheatsheet |
| `G then D` | Go to Dashboard |
| `G then P` | Go to Projects |
| `G then C` | Go to Project Calendar |
| `G then M` | Go to My Schedule |
| `G then U` | Go to Upcoming Deals |
| `G then L` | Go to L10 Meetings |
| `G then T` | Go to My To-Dos |
| `N` | New Project |
| `Esc` | Close any open modal/dialog/palette |

### Admin (admin users only)

| Shortcut | Action |
|----------|--------|
| `G then A` | Go to Approvals |
| `G then R` | Go to Revenue Goals |

### Calendar Page

| Shortcut | Action |
|----------|--------|
| `Cmd+Z` | Undo (existing) |
| `←` / `→` | Previous/Next week |
| `T` | Jump to today |
| `Cmd+Drag` | Copy assignment (existing) |
| `Option+Click` | Delete assignment (existing) |

### Projects List Page

| Shortcut | Action |
|----------|--------|
| `J` / `↓` | Move selection down |
| `K` / `↑` | Move selection up |
| `Enter` | Open selected project |
| `/` | Focus search/filter |
| `Esc` | Clear selection / unfocus |

### Project Detail Page

| Shortcut | Action |
|----------|--------|
| `E` | Edit project |
| `Backspace` | Go back to projects list |

## Implementation Architecture

### useKeyboardShortcuts Hook

Central hook that:
- Maintains a registry of shortcuts
- Handles two-key chord sequences (G then D) with 500ms timeout
- Ignores shortcuts when user is typing in input/textarea/contenteditable
- Pages register page-specific shortcuts on mount/unmount

### KeyboardShortcutsProvider

Context provider wrapping the dashboard layout. Holds the shortcut registry. Pages call `useRegisterShortcuts()` to add page-specific shortcuts.

### KeyboardShortcutsDialog

Full-screen modal showing all shortcuts organized by section:
- Global, Navigation, Calendar, Projects
- Accessible via `?` key and sidebar footer link
- Shows platform-appropriate modifier keys (Cmd vs Ctrl)

### RecentPagesStore

Zustand store with persist middleware. Tracks last 5 visited pages for the command palette "Recent" section.

## Files to Create/Modify

### New Files
- `src/hooks/use-keyboard-shortcuts.ts` — central shortcut hook
- `src/components/keyboard-shortcuts-dialog.tsx` — cheatsheet modal
- `src/components/command-palette.tsx` — Cmd+K command palette
- `src/lib/stores/recent-pages-store.ts` — recent pages tracking
- `src/lib/keyboard-shortcuts.ts` — shortcut definitions and registry

### Modified Files
- `src/components/layout/sidebar.tsx` — restructure sections, add flyout, add footer
- `src/components/layout/header.tsx` — add Settings + Shortcuts to user dropdown
- `src/app/(dashboard)/layout.tsx` — add KeyboardShortcutsProvider + CommandPalette
- `src/app/(dashboard)/projects/page.tsx` — register J/K navigation shortcuts
- `src/app/(dashboard)/projects/[id]/page.tsx` — register E/Backspace shortcuts
- Calendar pages — register ←/→/T shortcuts

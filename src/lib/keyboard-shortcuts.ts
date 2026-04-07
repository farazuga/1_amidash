export interface ShortcutDefinition {
  id: string;
  keys: string;
  label: string;
  section: 'Global' | 'Navigation' | 'Admin' | 'Calendar' | 'Projects' | 'Project Detail';
  action?: string;
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

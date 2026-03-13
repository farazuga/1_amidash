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
      action: () => { setOpen(false); signOut(); },
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

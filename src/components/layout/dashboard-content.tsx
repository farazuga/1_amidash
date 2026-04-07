'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { useAutoCollapseSidebar } from '@/hooks/use-auto-collapse-sidebar';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { useUser } from '@/contexts/user-context';
import { useRecentPagesStore } from '@/lib/stores/recent-pages-store';
import { Header } from './header';
import { GlobalCreateFAB } from '@/components/global-create-fab';
import { CommandPalette } from '@/components/command-palette';
import { KeyboardShortcutsDialog } from '@/components/keyboard-shortcuts-dialog';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isCollapsed } = useSidebarStore();
  const { isAdmin } = useUser();
  const { addPage } = useRecentPagesStore();
  useAutoCollapseSidebar();

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
  useKeyboardShortcuts([
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
  ]);

  return (
    <div className={cn('transition-all duration-300', isCollapsed ? 'md:ml-16' : 'md:ml-64')}>
      <Header />
      <main className="p-4 md:p-6">{children}</main>
      <GlobalCreateFAB />
      <CommandPalette />
      <KeyboardShortcutsDialog />
    </div>
  );
}

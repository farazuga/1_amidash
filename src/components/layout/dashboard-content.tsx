'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { useAutoCollapseSidebar } from '@/hooks/use-auto-collapse-sidebar';
import { Header } from './header';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isCollapsed } = useSidebarStore();
  useAutoCollapseSidebar();

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+P or Cmd+P to go to projects
      if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        // Don't trigger if user is in an input field
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
        }
        e.preventDefault();
        router.push('/projects');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [router]);

  return (
    <div
      className={cn(
        'transition-all duration-300',
        isCollapsed ? 'md:ml-16' : 'md:ml-64'
      )}
    >
      <Header />
      <main className="p-4 md:p-6">{children}</main>
    </div>
  );
}

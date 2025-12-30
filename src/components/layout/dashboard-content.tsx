'use client';

import { cn } from '@/lib/utils';
import { useSidebarStore } from '@/lib/stores/sidebar-store';
import { useAutoCollapseSidebar } from '@/hooks/use-auto-collapse-sidebar';
import { Header } from './header';

export function DashboardContent({ children }: { children: React.ReactNode }) {
  const { isCollapsed } = useSidebarStore();
  useAutoCollapseSidebar();

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

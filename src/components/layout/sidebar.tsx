'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { LOGO_URL, APP_NAME } from '@/lib/constants';
import { useUser } from '@/contexts/user-context';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Tags,
  ListChecks,
  FileText,
  Plus,
  Target,
  Settings,
  Tv,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useSidebarStore } from '@/lib/stores/sidebar-store';

const mainNavItems = [
  {
    title: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
  },
  {
    title: 'Projects',
    href: '/projects',
    icon: FolderKanban,
  },
];

const adminNavItems = [
  {
    title: 'Statuses',
    href: '/admin/statuses',
    icon: ListChecks,
  },
  {
    title: 'Revenue Goals',
    href: '/admin/goals',
    icon: Target,
  },
  {
    title: 'Tags',
    href: '/admin/tags',
    icon: Tags,
  },
  {
    title: 'Users',
    href: '/admin/users',
    icon: Users,
  },
  {
    title: 'Audit Log',
    href: '/admin/audit',
    icon: FileText,
  },
  {
    title: 'Digital Signage',
    href: '/admin/signage',
    icon: Tv,
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { isAdmin } = useUser();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
        <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
          <Image
            src={LOGO_URL}
            alt={APP_NAME}
            width={150}
            height={40}
            className="brightness-0 invert"
            priority
          />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {/* New Project Button */}
        <Link href="/projects/new" className="block mb-4" onClick={onNavigate}>
          <Button
            className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 active:bg-sidebar-primary/80"
            size="sm"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </Link>

        <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
          Main
        </div>
        {mainNavItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.title}
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              Admin
            </div>
            {adminNavItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                      : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.title}
                </Link>
              );
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-4">
        <p className="text-xs text-sidebar-foreground/60 text-center">
          {APP_NAME} Dashboard v1.0
        </p>
      </div>
    </div>
  );
}

export function Sidebar() {
  const { isOpen, close } = useSidebarStore();

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <aside className="hidden md:fixed md:left-0 md:top-0 md:z-40 md:h-screen md:w-64 md:block bg-sidebar text-sidebar-foreground">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar - Sheet/Drawer */}
      <Sheet open={isOpen} onOpenChange={close}>
        <SheetContent side="left" className="w-64 p-0 bg-sidebar text-sidebar-foreground">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation Menu</SheetTitle>
          </SheetHeader>
          <SidebarContent onNavigate={close} />
        </SheetContent>
      </Sheet>
    </>
  );
}

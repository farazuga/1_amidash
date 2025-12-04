'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { LOGO_URL, APP_NAME } from '@/lib/constants';
import { useUser } from '@/hooks/use-user';
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Tags,
  ListChecks,
  FileText,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

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
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useUser();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground">
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className="flex h-16 items-center justify-center border-b border-sidebar-border px-4">
          <Link href="/" className="flex items-center gap-2">
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
        <nav className="flex-1 space-y-1 px-3 py-4">
          {/* New Project Button */}
          <Link href="/projects/new" className="block mb-4">
            <Button className="w-full" size="sm">
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
    </aside>
  );
}

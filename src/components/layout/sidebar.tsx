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
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  CalendarRange,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
  {
    title: 'Project Calendar',
    href: '/project-calendar',
    icon: CalendarRange,
  },
  {
    title: 'My Schedule',
    href: '/my-schedule',
    icon: CalendarDays,
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
    title: 'Digital Signage',
    href: '/admin/signage',
    icon: Tv,
  },
  {
    title: 'Audit Log',
    href: '/admin/audit',
    icon: FileText,
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: Settings,
  },
];

function NavItem({
  item,
  isActive,
  collapsed,
  onNavigate,
}: {
  item: { title: string; href: string; icon: React.ElementType };
  isActive: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const linkContent = (
    <Link
      href={item.href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        collapsed && 'justify-center px-2',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
      )}
    >
      <item.icon className="h-5 w-5 shrink-0" />
      {!collapsed && item.title}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {item.title}
        </TooltipContent>
      </Tooltip>
    );
  }

  return linkContent;
}

function SidebarContent({
  onNavigate,
  collapsed,
  onToggleCollapse,
}: {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname = usePathname();
  const { isAdmin } = useUser();

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col">
        {/* Logo */}
        <div className={cn(
          'flex h-16 items-center border-b border-sidebar-border',
          collapsed ? 'justify-center px-2' : 'justify-center px-4'
        )}>
          <Link href="/" className="flex items-center gap-2" onClick={onNavigate}>
            {collapsed ? (
              <span className="text-xl font-bold text-sidebar-foreground">A</span>
            ) : (
              <Image
                src={LOGO_URL}
                alt={APP_NAME}
                width={150}
                height={40}
                className="brightness-0 invert"
                priority
              />
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className={cn(
          'flex-1 space-y-1 py-4 overflow-y-auto',
          collapsed ? 'px-2' : 'px-3'
        )}>
          {/* New Project Button */}
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href="/projects/new" className="block mb-4" onClick={onNavigate}>
                  <Button
                    className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 active:bg-sidebar-primary/80"
                    size="icon"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={10}>
                New Project
              </TooltipContent>
            </Tooltip>
          ) : (
            <Link href="/projects/new" className="block mb-4" onClick={onNavigate}>
              <Button
                className="w-full bg-sidebar-primary text-sidebar-primary-foreground hover:bg-sidebar-primary/90 active:bg-sidebar-primary/80"
                size="sm"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </Link>
          )}

          {!collapsed && (
            <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              Main
            </div>
          )}
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
              />
            );
          })}

          {isAdmin && (
            <>
              {!collapsed && (
                <div className="mb-2 mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                  Admin
                </div>
              )}
              {collapsed && <div className="mt-4 mb-2 border-t border-sidebar-border/50" />}
              {adminNavItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <NavItem
                    key={item.href}
                    item={item}
                    isActive={isActive}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                  />
                );
              })}
            </>
          )}
        </nav>

        {/* Footer with collapse toggle */}
        <div className="border-t border-sidebar-border p-2">
          {onToggleCollapse && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggleCollapse}
              className={cn(
                'w-full text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50',
                collapsed ? 'justify-center' : 'justify-end'
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <>
                  <span className="text-xs mr-2">Collapse</span>
                  <ChevronLeft className="h-4 w-4" />
                </>
              )}
            </Button>
          )}
          {!collapsed && (
            <p className="text-xs text-sidebar-foreground/60 text-center mt-2">
              {APP_NAME} Dashboard v1.0
            </p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

export function Sidebar() {
  const { isOpen, close, isCollapsed, setCollapsed } = useSidebarStore();

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <aside
        className={cn(
          'hidden md:fixed md:left-0 md:top-0 md:z-40 md:h-screen md:block bg-sidebar text-sidebar-foreground transition-all duration-300',
          isCollapsed ? 'md:w-16' : 'md:w-64'
        )}
      >
        <SidebarContent
          collapsed={isCollapsed}
          onToggleCollapse={() => setCollapsed(!isCollapsed)}
        />
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

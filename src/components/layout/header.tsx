'use client';

import { useRouter } from 'next/navigation';
import { useUser } from '@/hooks/use-user';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { LogOut, Menu } from 'lucide-react';
import { useSidebarStore } from '@/lib/stores/sidebar-store';

export function Header() {
  const { user, profile, signOut } = useUser();
  const router = useRouter();
  const { toggle } = useSidebarStore();

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  const initials = profile?.full_name
    ? profile.full_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : user?.email?.[0].toUpperCase() || 'U';

  const roleColor = {
    admin: 'bg-primary text-primary-foreground',
    editor: 'bg-blue-500 text-white',
    viewer: 'bg-gray-500 text-white',
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden h-10 w-10"
          onClick={toggle}
          aria-label="Toggle navigation menu"
        >
          <Menu className="h-6 w-6" />
        </Button>
        {/* Placeholder for breadcrumbs or page title */}
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-primary-foreground">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-2">
                <p className="text-sm font-medium leading-none">
                  {profile?.full_name || 'User'}
                </p>
                <p className="text-xs leading-none text-muted-foreground break-all">
                  {user?.email}
                </p>
                {profile?.role && (
                  <Badge
                    className={`w-fit text-xs ${roleColor[profile.role as keyof typeof roleColor] || roleColor.viewer}`}
                  >
                    {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
                  </Badge>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="cursor-pointer text-destructive focus:text-destructive"
              onClick={handleSignOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

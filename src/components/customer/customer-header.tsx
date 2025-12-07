'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { LOGO_URL, APP_NAME } from '@/lib/constants';
import { LogOut, Settings, Loader2 } from 'lucide-react';
import { signOut } from '@/app/actions/auth';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';

interface CustomerHeaderProps {
  user: User;
  profile: Profile | null;
}

export function CustomerHeader({ user, profile }: CustomerHeaderProps) {
  const [isPending, startTransition] = useTransition();

  const handleSignOut = () => {
    startTransition(async () => {
      await signOut();
    });
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link href="/customer" className="flex items-center gap-2">
            <Image
              src={LOGO_URL}
              alt={APP_NAME}
              width={120}
              height={40}
              className="h-8 w-auto"
            />
          </Link>

          {/* User info and actions */}
          <div className="flex items-center gap-4">
            <div className="hidden sm:block text-sm text-muted-foreground">
              {profile?.full_name || user.email}
            </div>
            <Link href="/customer/settings">
              <Button variant="ghost" size="icon" title="Settings">
                <Settings className="h-5 w-5" />
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              disabled={isPending}
              title="Sign out"
            >
              {isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <LogOut className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

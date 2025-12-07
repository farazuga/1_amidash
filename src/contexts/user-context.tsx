'use client';

import { createContext, useContext, useTransition } from 'react';
import type { Profile } from '@/types';
import type { User } from '@supabase/supabase-js';
import { signOut as serverSignOut } from '@/app/actions/auth';

interface UserContextType {
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  isCustomer: boolean;
  signOut: () => void;
  isSigningOut: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

interface UserProviderProps {
  children: React.ReactNode;
  user: User | null;
  profile: Profile | null;
}

export function UserProvider({ children, user, profile }: UserProviderProps) {
  const [isSigningOut, startTransition] = useTransition();

  const isCustomer = profile?.role === 'customer';
  const isAdmin = profile?.role === 'admin';
  const isEditor = profile?.role === 'editor' || isAdmin;
  const isViewer = profile?.role === 'viewer' || isEditor;

  const signOut = () => {
    startTransition(async () => {
      await serverSignOut();
    });
  };

  return (
    <UserContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        isEditor,
        isViewer,
        isCustomer,
        signOut,
        isSigningOut,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}

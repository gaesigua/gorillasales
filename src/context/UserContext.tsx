'use client';

import React, { createContext, useContext } from 'react';
import { isManagerRole } from '@/lib/roles';
import type { CurrentUser } from '@/lib/types';

const UserContext = createContext<CurrentUser | null>(null);

/** Provides the signed-in user, resolved on the server from the session cookie. */
export function UserProvider({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  const currentUser = useContext(UserContext);
  if (!currentUser) throw new Error('useUser must be used inside UserProvider');
  return {
    currentUser,
    isManager: currentUser.role === 'MANAGER',
    isAdmin: currentUser.role === 'ADMIN',
    canViewAllReps: isManagerRole(currentUser.role),
  };
}

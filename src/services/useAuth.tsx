import { createContext, useContext, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';

export type AuthUser = {
  sub: string;
  email: string;
  workspaceSlug: string;
};

type AuthContextValue = {
  isLoading: boolean;
  user: AuthUser | null;
  refresh: () => Promise<AuthUser | null>;
};

async function fetchSession(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { user: AuthUser | null };
  return data.user;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const authQuery = useQuery({
    queryKey: queryKeys.auth.me,
    queryFn: fetchSession,
    staleTime: 10 * 60 * 1000,
  });

  const value: AuthContextValue = {
    isLoading: authQuery.isLoading,
    user: authQuery.data ?? null,
    refresh: async () => {
      const result = await queryClient.fetchQuery({
        queryKey: queryKeys.auth.me,
        queryFn: fetchSession,
        staleTime: 0,
      });
      return result ?? null;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider.');
  }
  return context;
}

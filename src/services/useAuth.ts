import { useCallback, useEffect, useState } from 'react';

export type AuthUser = {
  sub: string;
  email: string;
  workspaceSlug: string;
};

type AuthState = {
  isLoading: boolean;
  user: AuthUser | null;
};

async function fetchSession(): Promise<AuthUser | null> {
  const response = await fetch('/api/auth/me', { credentials: 'include' });
  if (!response.ok) {
    return null;
  }
  const data = (await response.json()) as { user: AuthUser | null };
  return data.user;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({ isLoading: true, user: null });

  const refresh = useCallback(async () => {
    try {
      const user = await fetchSession();
      setState({ isLoading: false, user });
    } catch {
      setState({ isLoading: false, user: null });
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchSession()
      .then((user) => {
        if (active) {
          setState({ isLoading: false, user });
        }
      })
      .catch(() => {
        if (active) {
          setState({ isLoading: false, user: null });
        }
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  return { ...state, refresh };
}

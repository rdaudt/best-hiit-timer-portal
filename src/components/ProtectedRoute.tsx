import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../services/useAuth';

type Props = { children: ReactNode };

export function ProtectedRoute({ children }: Props) {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <main className="page"><p>Loading session...</p></main>;
  }

  if (!user) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}

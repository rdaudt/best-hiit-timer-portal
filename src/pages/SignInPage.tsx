import { useAuth } from '../services/useAuth';
import { Navigate } from 'react-router-dom';

export function SignInPage() {
  const { isLoading, user } = useAuth();

  if (isLoading) {
    return <main className="page"><p>Loading session...</p></main>;
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <main className="page">
      <section className="panel">
        <h1>Coach Sign In</h1>
        <p>Use your Google account to access your workspace.</p>
        <a className="button" href="/api/auth/login?redirect=/">Continue with Google</a>
      </section>
    </main>
  );
}

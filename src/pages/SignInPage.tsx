import { useAuth } from '../services/useAuth';

export function SignInPage() {
  const { user } = useAuth();

  if (user) {
    window.location.assign('/');
    return null;
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
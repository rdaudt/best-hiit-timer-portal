import { useAuth } from '../services/useAuth';
import { Navigate } from 'react-router-dom';

export function SignInPage() {
  const { isLoading, user } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const deleted = params.get('deleted') === '1';

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
        {deleted ? <p className="ok">Profile deleted. Your workspace is now inactive.</p> : null}
        <p>Use your Google account to access your workspace.</p>
        <form action="/api/auth/login" method="get" className="signin-form">
          <input type="hidden" name="redirect" value="/" />
          <button className="button" type="submit">Continue with Google</button>
        </form>
      </section>
    </main>
  );
}

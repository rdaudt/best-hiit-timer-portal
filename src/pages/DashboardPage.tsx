import { useAuth } from '../services/useAuth';

export function DashboardPage() {
  const { user, refresh } = useAuth();

  const onSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refresh();
    window.location.assign('/signin');
  };

  return (
    <main className="page">
      <header className="panel">
        <h1>Best HIIT Timer Portal</h1>
        <p>Authenticated coach workspace shell is active.</p>
      </header>
      <section className="panel">
        <h2>Session</h2>
        <p><strong>Coach:</strong> {user?.email}</p>
        <p><strong>Google Sub:</strong> {user?.sub}</p>
        <p><strong>Workspace:</strong> {user?.workspaceSlug ?? 'pending'}</p>
        <button className="button" onClick={onSignOut}>Sign out</button>
      </section>
    </main>
  );
}
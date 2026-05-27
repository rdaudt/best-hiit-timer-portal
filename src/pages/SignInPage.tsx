import { useAuth } from '../services/useAuth';
import { Navigate } from 'react-router-dom';

const inviteErrorMap: Record<string, string> = {
  missing: 'An invite code is required for first-time coach onboarding.',
  invalid: 'That invite code is not valid. Please verify and try again.',
  expired: 'That invite code has expired. Ask for a new invite code.',
  used: 'That invite code has already been used. Ask for a new invite code.',
};

export function SignInPage() {
  const { isLoading, user } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const deleted = params.get('deleted') === '1';
  const inviteError = params.get('invite_error') ?? '';
  const inviteValue = params.get('invite') ?? '';

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
        {inviteErrorMap[inviteError] ? <p className="error">{inviteErrorMap[inviteError]}</p> : null}
        <p>Use your Google account to access your workspace.</p>
        <form action="/api/auth/login" method="get" className="signin-form">
          <input type="hidden" name="redirect" value="/" />
          <label htmlFor="invite">Invite code (first-time coaches only)</label>
          <input id="invite" name="invite" type="text" defaultValue={inviteValue} autoComplete="off" />
          <button className="button" type="submit">Continue with Google</button>
        </form>
      </section>
    </main>
  );
}

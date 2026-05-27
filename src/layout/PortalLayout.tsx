import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../services/useAuth';

export function PortalLayout() {
  const { user, refresh } = useAuth();

  const onSignOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    await refresh();
    window.location.assign('/signin');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar panel">
        <h1>HIIT Portal</h1>
        <p className="muted">{user?.email}</p>
        <nav className="nav-list" aria-label="Primary Navigation">
          <NavLink to="/branding" className="nav-link">Profile</NavLink>
          <NavLink to="/class-locations" className="nav-link">Class Locations</NavLink>
        </nav>
        <button className="button" onClick={onSignOut}>Sign out</button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}

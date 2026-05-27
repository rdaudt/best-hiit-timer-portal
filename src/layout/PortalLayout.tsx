import { NavLink, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../services/useAuth';
import { portalApi } from '../services/portalApi';
import { queryKeys } from '../services/queryKeys';

export function PortalLayout() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();

  const prefetchBranding = () => queryClient.prefetchQuery({
    queryKey: queryKeys.branding.current,
    queryFn: portalApi.getBranding,
  });

  const prefetchClassLocations = () => queryClient.prefetchQuery({
    queryKey: queryKeys.classLocations.list,
    queryFn: portalApi.listClassLocations,
  });

  const onSignOut = async () => {
    await portalApi.logout();
    queryClient.removeQueries({ queryKey: queryKeys.auth.me });
    await refresh();
    window.location.assign('/signin');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar panel">
        <h1>COACH PORTAL</h1>
        <p className="muted">{user?.email}</p>
        <nav className="nav-list" aria-label="Primary Navigation">
          <NavLink to="/branding" className="nav-link" onMouseEnter={() => void prefetchBranding()} onFocus={() => void prefetchBranding()} onTouchStart={() => void prefetchBranding()}>Profile</NavLink>
          <NavLink to="/class-locations" className="nav-link" onMouseEnter={() => void prefetchClassLocations()} onFocus={() => void prefetchClassLocations()} onTouchStart={() => void prefetchClassLocations()}>Class Locations</NavLink>
        </nav>
        <button className="button" onClick={onSignOut}>Sign out</button>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      <nav className="mobile-footer-nav" aria-label="Mobile Navigation">
        <NavLink to="/branding" className="mobile-tab-link" onMouseEnter={() => void prefetchBranding()} onFocus={() => void prefetchBranding()} onTouchStart={() => void prefetchBranding()}>Profile</NavLink>
        <NavLink to="/class-locations" className="mobile-tab-link" onMouseEnter={() => void prefetchClassLocations()} onFocus={() => void prefetchClassLocations()} onTouchStart={() => void prefetchClassLocations()}>Class Locations</NavLink>
      </nav>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../services/useAuth';
import { portalApi } from '../services/portalApi';
import { queryKeys } from '../services/queryKeys';

export function PortalLayout() {
  const { user, refresh } = useAuth();
  const queryClient = useQueryClient();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onEscape);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onEscape);
    };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <aside className="sidebar panel">
        <h1>COACH PORTAL</h1>
        <nav className="nav-list" aria-label="Primary Navigation">
          <NavLink to="/branding" className="nav-link" onMouseEnter={() => void prefetchBranding()} onFocus={() => void prefetchBranding()} onTouchStart={() => void prefetchBranding()}>Profile</NavLink>
          <NavLink to="/class-locations" className="nav-link" onMouseEnter={() => void prefetchClassLocations()} onFocus={() => void prefetchClassLocations()} onTouchStart={() => void prefetchClassLocations()}>Class Locations</NavLink>
        </nav>
      </aside>
      <main className="content">
        <div className="portal-user-menu" ref={menuRef}>
          <button
            type="button"
            className="portal-avatar-button"
            aria-label="Open account menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {user?.picture
              ? <img src={user.picture} alt="Authenticated user profile" className="portal-avatar-image" />
              : <span className="portal-avatar-fallback">{(user?.email?.[0] ?? 'U').toUpperCase()}</span>}
          </button>
          {menuOpen ? (
            <div className="portal-user-dropdown panel" role="menu" aria-label="Account menu">
              <p className="portal-user-email">{user?.email}</p>
              <button className="button" onClick={() => void onSignOut()}>Sign out</button>
            </div>
          ) : null}
        </div>
        <Outlet />
      </main>
      <nav className="mobile-footer-nav" aria-label="Mobile Navigation">
        <NavLink to="/branding" className="mobile-tab-link" onMouseEnter={() => void prefetchBranding()} onFocus={() => void prefetchBranding()} onTouchStart={() => void prefetchBranding()}>Profile</NavLink>
        <NavLink to="/class-locations" className="mobile-tab-link" onMouseEnter={() => void prefetchClassLocations()} onFocus={() => void prefetchClassLocations()} onTouchStart={() => void prefetchClassLocations()}>Class Locations</NavLink>
      </nav>
    </div>
  );
}

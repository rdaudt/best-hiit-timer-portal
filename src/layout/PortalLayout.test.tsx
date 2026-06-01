import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { PortalLayout } from './PortalLayout';
import { useAuth } from '../services/useAuth';

vi.mock('../services/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('PortalLayout', () => {
  it('renders mobile navigation with the expected portal routes', () => {
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      user: { sub: 'coach-1', email: 'coach@example.com', workspaceSlug: 'coach' },
      refresh: vi.fn(),
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/branding']}>
          <Routes>
            <Route path="/" element={<PortalLayout />}>
              <Route path="branding" element={<div>Branding content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const mobileNav = screen.getByRole('navigation', { name: 'Mobile Navigation' });
    const profileLink = within(mobileNav).getByRole('link', { name: 'Profile' });
    const classLocationsLink = within(mobileNav).getByRole('link', { name: 'Class Locations' });

    expect(profileLink).toHaveAttribute('href', '/branding');
    expect(classLocationsLink).toHaveAttribute('href', '/class-locations');
  });

  it('shows account email and sign-out action when avatar is clicked', async () => {
    const user = userEvent.setup();
    vi.mocked(useAuth).mockReturnValue({
      isLoading: false,
      user: { sub: 'coach-1', email: 'coach@example.com', workspaceSlug: 'coach', picture: 'https://example.com/avatar.jpg' },
      refresh: vi.fn(),
    });

    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter initialEntries={['/branding']}>
          <Routes>
            <Route path="/" element={<PortalLayout />}>
              <Route path="branding" element={<div>Branding content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Open account menu' }));

    expect(screen.getByText('coach@example.com')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});

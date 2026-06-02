import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInPage } from './SignInPage';
import { useAuth } from '../services/useAuth';

vi.mock('../services/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('SignInPage', () => {
  it('renders the google sign-in form without invite controls', () => {
    vi.mocked(useAuth).mockReturnValue({ isLoading: false, user: null, refresh: vi.fn() });
    window.history.replaceState({}, '', '/signin?deleted=1');
    render(
      <MemoryRouter initialEntries={['/signin']}>
        <SignInPage />
      </MemoryRouter>,
    );

    const form = document.querySelector('form[action="/api/auth/login"]') as HTMLFormElement | null;
    expect(form).toBeTruthy();
    expect(screen.queryByLabelText('Invite code (first-time coaches only)')).toBeNull();
    expect(screen.getByText('Profile deleted. Your workspace is now inactive.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });
});

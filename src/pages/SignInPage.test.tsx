import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SignInPage } from './SignInPage';
import { useAuth } from '../services/useAuth';

vi.mock('../services/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('SignInPage', () => {
  it('renders invite field and login form query params', () => {
    vi.mocked(useAuth).mockReturnValue({ isLoading: false, user: null, refresh: vi.fn() });
    window.history.replaceState({}, '', '/signin?invite=AbC123');
    render(
      <MemoryRouter initialEntries={['/signin']}>
        <SignInPage />
      </MemoryRouter>,
    );

    const form = document.querySelector('form[action="/api/auth/login"]') as HTMLFormElement | null;
    expect(form).toBeTruthy();

    const inviteInput = screen.getByLabelText('Invite code (first-time coaches only)') as HTMLInputElement;
    expect(inviteInput.value).toBe('AbC123');
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeInTheDocument();
  });

  it('shows friendly invite error message', () => {
    vi.mocked(useAuth).mockReturnValue({ isLoading: false, user: null, refresh: vi.fn() });
    window.history.replaceState({}, '', '/signin?invite_error=used');
    render(
      <MemoryRouter initialEntries={['/signin']}>
        <SignInPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('That invite code has already been used. Ask for a new invite code.')).toBeInTheDocument();
  });
});

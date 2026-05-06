import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { useAuth } from './services/useAuth';

vi.mock('./services/useAuth', () => ({
  useAuth: vi.fn(),
}));

describe('auth routing', () => {
  it('shows sign in page when unauthenticated user hits root', async () => {
    vi.mocked(useAuth).mockReturnValue({ isLoading: false, user: null, refresh: vi.fn() });
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Coach Sign In')).toBeInTheDocument();
  });
});

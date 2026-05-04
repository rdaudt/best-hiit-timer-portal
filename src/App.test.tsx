import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from './App';

vi.mock('./services/useAuth', () => ({
  useAuth: () => ({ isLoading: false, user: null, refresh: vi.fn() }),
}));

describe('auth routing', () => {
  it('shows sign in page when unauthenticated user hits root', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    );

    expect(await screen.findByText('Coach Sign In')).toBeInTheDocument();
  });
});
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import * as api from '../services/api';

vi.mock('../services/api');

function Probe() {
  const { user, loading, login, logout, refetch } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <button onClick={() => login({ email: 'new@x.com' })}>login</button>
      <button onClick={() => logout().catch(() => {})}>logout</button>
      <button onClick={() => refetch()}>refetch</button>
    </div>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('AuthProvider', () => {
  it('sets the user after a successful profile fetch on mount', async () => {
    api.getProfile.mockResolvedValue({ data: { email: 'a@b.com' } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('a@b.com');
  });

  it('sets user to null when the profile fetch fails', async () => {
    api.getProfile.mockRejectedValue(new Error('unauthorized'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('login() sets the user directly without an API call', async () => {
    api.getProfile.mockResolvedValue({ data: null });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    act(() => screen.getByText('login').click());
    expect(screen.getByTestId('user')).toHaveTextContent('new@x.com');
  });

  it('logout() clears the user on success', async () => {
    api.getProfile.mockResolvedValue({ data: { email: 'a@b.com' } });
    api.logout.mockResolvedValue({});
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('a@b.com'));
    await act(async () => screen.getByText('logout').click());
    expect(api.logout).toHaveBeenCalled();
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('logout() still clears the user when the API call rejects', async () => {
    api.getProfile.mockResolvedValue({ data: { email: 'a@b.com' } });
    api.logout.mockRejectedValue(new Error('network error'));
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId('user')).toHaveTextContent('a@b.com'));
    await act(async () => screen.getByText('logout').click());
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('refetch() re-invokes getProfile', async () => {
    api.getProfile.mockResolvedValue({ data: { email: 'a@b.com' } });
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(api.getProfile).toHaveBeenCalledTimes(1));
    api.getProfile.mockResolvedValue({ data: { email: 'updated@b.com' } });
    await act(async () => screen.getByText('refetch').click());
    expect(api.getProfile).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('user')).toHaveTextContent('updated@b.com');
  });
});

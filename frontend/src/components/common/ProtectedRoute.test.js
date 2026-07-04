import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute, AdminRoute } from './ProtectedRoute';
import { useAuth } from '../../context/AuthContext';

vi.mock('../../context/AuthContext');

const renderWithRoutes = (element) => render(
  <MemoryRouter initialEntries={['/']}>
    <Routes>
      <Route path="/" element={element} />
      <Route path="/login" element={<div>Login Page</div>} />
      <Route path="/dashboard" element={<div>Dashboard Page</div>} />
    </Routes>
  </MemoryRouter>
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProtectedRoute', () => {
  it('shows a spinner while loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = renderWithRoutes(<ProtectedRoute><div>Secret</div></ProtectedRoute>);
    expect(container.querySelector('.center-page')).toBeInTheDocument();
  });

  it('redirects to /login when there is no user', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderWithRoutes(<ProtectedRoute><div>Secret</div></ProtectedRoute>);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('renders children when a user is present', () => {
    useAuth.mockReturnValue({ user: { role: 'user' }, loading: false });
    renderWithRoutes(<ProtectedRoute><div>Secret</div></ProtectedRoute>);
    expect(screen.getByText('Secret')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('shows a spinner while loading', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    const { container } = renderWithRoutes(<AdminRoute><div>Admin Secret</div></AdminRoute>);
    expect(container.querySelector('.center-page')).toBeInTheDocument();
  });

  it('redirects to /login when there is no user', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderWithRoutes(<AdminRoute><div>Admin Secret</div></AdminRoute>);
    expect(screen.getByText('Login Page')).toBeInTheDocument();
  });

  it('redirects to /dashboard when the user is not an admin', () => {
    useAuth.mockReturnValue({ user: { role: 'user' }, loading: false });
    renderWithRoutes(<AdminRoute><div>Admin Secret</div></AdminRoute>);
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
  });

  it('renders children when the user is an admin', () => {
    useAuth.mockReturnValue({ user: { role: 'admin' }, loading: false });
    renderWithRoutes(<AdminRoute><div>Admin Secret</div></AdminRoute>);
    expect(screen.getByText('Admin Secret')).toBeInTheDocument();
  });
});

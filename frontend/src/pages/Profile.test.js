import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Profile from './Profile';
import * as api from '../services/api';
import { useAuth } from '../context/AuthContext';

vi.mock('../services/api');
vi.mock('../context/AuthContext');

const navigateMock = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigateMock }));

const logoutFn = vi.fn().mockResolvedValue();
const refetchFn = vi.fn().mockResolvedValue();

beforeEach(() => {
  vi.clearAllMocks();
  logoutFn.mockResolvedValue();
  refetchFn.mockResolvedValue();
  useAuth.mockReturnValue({
    user: { email: 'a@b.com', full_name: 'Alice', role: 'user', created_at: '2026-01-01T00:00:00Z' },
    logout: logoutFn,
    refetch: refetchFn,
  });
});

describe('Profile name update', () => {
  it('shows a success message and refetches on success', async () => {
    api.updateProfile.mockResolvedValue({});
    render(<Profile />);
    fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alice B' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Name' }));
    expect(await screen.findByText('Name updated successfully.')).toBeInTheDocument();
    expect(refetchFn).toHaveBeenCalled();
  });

  it('shows an error message on failure', async () => {
    api.updateProfile.mockRejectedValue({ response: { data: { message: 'Name taken' } } });
    render(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Update Name' }));
    expect(await screen.findByText('Name taken')).toBeInTheDocument();
  });
});

describe('Profile password update', () => {
  it('shows a success message and clears the form', async () => {
    api.updateProfile.mockResolvedValue({});
    render(<Profile />);
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    expect(await screen.findByText('Password updated successfully.')).toBeInTheDocument();
    expect(screen.getByLabelText('Current Password')).toHaveValue('');
  });

  it('shows an error message on failure', async () => {
    api.updateProfile.mockRejectedValue({ response: { data: { message: 'Wrong password' } } });
    render(<Profile />);
    fireEvent.change(screen.getByLabelText('Current Password'), { target: { value: 'oldpass123' } });
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'newpassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Change Password' }));
    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
  });
});

describe('Profile delete account', () => {
  it('does not call the API when the confirmation is declined', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    render(<Profile />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));
    expect(api.deleteAccount).not.toHaveBeenCalled();
    globalThis.confirm.mockRestore();
  });

  it('deletes the account, logs out, and navigates home on success', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    api.deleteAccount.mockResolvedValue({});
    render(<Profile />);
    fireEvent.change(screen.getByLabelText('Confirm your password to delete'), { target: { value: 'mypassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));
    await waitFor(() => expect(api.deleteAccount).toHaveBeenCalled());
    expect(logoutFn).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/');
    globalThis.confirm.mockRestore();
  });

  it('shows an error message when deletion fails', async () => {
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    api.deleteAccount.mockRejectedValue({ response: { data: { message: 'Wrong password' } } });
    render(<Profile />);
    fireEvent.change(screen.getByLabelText('Confirm your password to delete'), { target: { value: 'mypassword123' } });
    fireEvent.click(screen.getByRole('button', { name: 'Delete My Account' }));
    expect(await screen.findByText('Wrong password')).toBeInTheDocument();
    expect(logoutFn).not.toHaveBeenCalled();
    globalThis.confirm.mockRestore();
  });
});

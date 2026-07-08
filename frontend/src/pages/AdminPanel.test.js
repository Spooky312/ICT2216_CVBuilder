import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import AdminPanel from './AdminPanel';
import * as api from '../services/api';

vi.mock('../services/api');

const user = (overrides = {}) => ({
  user_id: 'u1',
  full_name: 'Alice Example',
  email: 'alice@example.com',
  role: 'user',
  is_active: true,
  locked_until: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const log = (overrides = {}) => ({
  log_id: 'l1',
  event_type: 'login_success',
  user_id: 'u1',
  ip_address: '1.2.3.4',
  occurred_at: '2026-01-01T00:00:00Z',
  metadata: null,
  ...overrides,
});

const template = (overrides = {}) => ({
  id: 'modern',
  name: 'Modern',
  description: 'A modern template',
  active: true,
  source_template_id: 'modern',
  is_uploaded: false,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.adminListUsers.mockResolvedValue({ data: { users: [user()] } });
  api.adminGetAuditLog.mockResolvedValue({ data: { logs: [log()] } });
  api.adminListTemplates.mockResolvedValue({ data: [template()] });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AdminPanel tabs', () => {
  it('loads the users tab by default and shows stats', async () => {
    render(<AdminPanel />);
    await waitFor(() => expect(api.adminListUsers).toHaveBeenCalled());
    expect(await screen.findByText('Alice Example')).toBeInTheDocument();
    expect(screen.getByText('Total Users').previousSibling).toHaveTextContent('1');
  });

  it('switches to logs tab and loads audit log', async () => {
    render(<AdminPanel />);
    await waitFor(() => expect(api.adminListUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Audit Log/ }));
    await waitFor(() => expect(api.adminGetAuditLog).toHaveBeenCalled());
    expect(await screen.findByText('login_success')).toBeInTheDocument();
  });

  it('switches to templates tab and loads templates', async () => {
    render(<AdminPanel />);
    await waitFor(() => expect(api.adminListUsers).toHaveBeenCalled());
    fireEvent.click(screen.getByRole('button', { name: /Templates/ }));
    await waitFor(() => expect(api.adminListTemplates).toHaveBeenCalled());
    expect(await screen.findByText('Modern')).toBeInTheDocument();
  });

  it('shows an error with a retry button when a tab fails to load', async () => {
    api.adminListUsers.mockRejectedValueOnce(new Error('boom'));
    render(<AdminPanel />);
    expect(await screen.findByText(/Failed to load data/)).toBeInTheDocument();
    api.adminListUsers.mockResolvedValueOnce({ data: { users: [user()] } });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(api.adminListUsers).toHaveBeenCalledTimes(2));
  });
});

describe('AdminPanel users tab actions', () => {
  it('filters users by search term', async () => {
    api.adminListUsers.mockResolvedValue({
      data: { users: [user(), user({ user_id: 'u2', full_name: 'Bob Other', email: 'bob@example.com' })] },
    });
    render(<AdminPanel />);
    expect(await screen.findByText('Bob Other')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search by name or email'), { target: { value: 'alice' } });
    expect(screen.queryByText('Bob Other')).not.toBeInTheDocument();
    expect(screen.getByText('Alice Example')).toBeInTheDocument();
  });

  it('shows pagination when there are more than 10 filtered users', async () => {
    const many = Array.from({ length: 12 }, (_, i) => user({ user_id: `u${i}`, full_name: `User ${i}`, email: `u${i}@example.com` }));
    api.adminListUsers.mockResolvedValue({ data: { users: many } });
    render(<AdminPanel />);
    expect(await screen.findByText('User 0')).toBeInTheDocument();
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
  });

  it('locks a user after confirming minutes', async () => {
    api.adminLockUser.mockResolvedValue({ data: { locked_until: '2099-01-01T00:00:00Z' } });
    render(<AdminPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Lock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Lock' }));
    await waitFor(() => expect(api.adminLockUser).toHaveBeenCalledWith('u1', 60));
    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeInTheDocument();
  });

  it('unlocks a locked user', async () => {
    api.adminListUsers.mockResolvedValue({
      data: { users: [user({ locked_until: '2099-01-01T00:00:00Z' })] },
    });
    api.adminUnlockUser.mockResolvedValue({});
    render(<AdminPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(api.adminUnlockUser).toHaveBeenCalledWith('u1'));
    expect(await screen.findByRole('button', { name: 'Lock' })).toBeInTheDocument();
  });

  it('deactivates a user only when confirmed', async () => {
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(false);
    render(<AdminPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));
    expect(api.adminDeactivateUser).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    api.adminDeactivateUser.mockResolvedValue({ data: { user: { is_active: false, locked_until: null, failed_logins: 0 } } });
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.adminDeactivateUser).toHaveBeenCalledWith('u1'));
    expect(await screen.findByText('Deactivated', { selector: '.badge' })).toBeInTheDocument();
    confirmSpy.mockRestore();
  });

  it('blocks deletion when the confirmation email does not match', async () => {
    const promptSpy = vi.spyOn(globalThis, 'prompt').mockReturnValue('wrong@example.com');
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    render(<AdminPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    expect(api.adminDeleteUser).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith(expect.stringContaining('did not match'));
    promptSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('deletes a user when the confirmation email matches', async () => {
    vi.spyOn(globalThis, 'prompt').mockReturnValue('alice@example.com');
    api.adminDeleteUser.mockResolvedValue({});
    render(<AdminPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.adminDeleteUser).toHaveBeenCalledWith('u1'));
    await waitFor(() => expect(screen.queryByText('Alice Example')).not.toBeInTheDocument());
  });
});

describe('AdminPanel logs tab', () => {
  it('applies and clears filters', async () => {
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Audit Log/ }));
    await waitFor(() => expect(api.adminGetAuditLog).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('Event type'), { target: { value: 'login_success' } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(api.adminGetAuditLog).toHaveBeenCalledTimes(2));
    expect(api.adminGetAuditLog).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ event_type: 'login_success' }));

    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    await waitFor(() => expect(api.adminGetAuditLog).toHaveBeenCalledTimes(3));
    expect(api.adminGetAuditLog).toHaveBeenLastCalledWith(1, 100, expect.objectContaining({ event_type: '' }));
  });

  it('expands and collapses a log row with metadata', async () => {
    api.adminGetAuditLog.mockResolvedValue({ data: { logs: [log({ metadata: { foo: 'bar' } })] } });
    render(<AdminPanel />);
    fireEvent.click(screen.getByRole('button', { name: /Audit Log/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Details' }));
    expect(screen.getByText(/"foo": "bar"/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide' }));
    expect(screen.queryByText(/"foo": "bar"/)).not.toBeInTheDocument();
  });
});

describe('AdminPanel templates tab', () => {
  const openTemplatesTab = async () => {
    render(<AdminPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Templates/ }));
    await screen.findByText('Modern');
  };

  it('uploads an HTML template', async () => {
    api.adminUploadTemplate.mockResolvedValue({ data: template({ id: 'custom', name: 'Custom', is_uploaded: true }) });
    await openTemplatesTab();
    fireEvent.click(screen.getByRole('button', { name: 'Add Template' }));
    fireEvent.change(screen.getByLabelText('Template ID'), { target: { value: 'custom' } });
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Custom' } });
    const file = new File(['<html></html>'], 'custom.html', { type: 'text/html' });
    const fileInput = screen.getByLabelText('HTML File');
    Object.defineProperty(fileInput, 'files', { value: [file] });
    fireEvent.change(fileInput);
    fireEvent.submit(screen.getByRole('button', { name: 'Upload Template' }).closest('form'));
    await waitFor(() => expect(api.adminUploadTemplate).toHaveBeenCalled());
    expect(await screen.findByText('Custom')).toBeInTheDocument();
  });

  it('shows an alert when template deletion fails', async () => {
    api.adminListTemplates.mockResolvedValue({ data: [template({ id: 'custom', name: 'Custom', is_uploaded: true })] });
    api.adminDeleteTemplate.mockRejectedValue({ response: { data: { message: 'In use' } } });
    vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    const alertSpy = vi.spyOn(globalThis, 'alert').mockImplementation(() => {});
    render(<AdminPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Templates/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith('Error: In use'));
    globalThis.confirm.mockRestore();
    alertSpy.mockRestore();
  });

  it('toggles a template active state', async () => {
    api.adminUpdateTemplate.mockResolvedValue({ data: template({ active: false }) });
    await openTemplatesTab();
    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }));
    await waitFor(() => expect(api.adminUpdateTemplate).toHaveBeenCalledWith('modern', { active: false }));
  });

  it('edits and saves a template', async () => {
    api.adminUpdateTemplate.mockResolvedValue({ data: template({ name: 'Modern 2' }) });
    await openTemplatesTab();
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Modern 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(api.adminUpdateTemplate).toHaveBeenCalled());
    expect(await screen.findByText('Modern 2')).toBeInTheDocument();
  });

  it('deletes a custom template when confirmed', async () => {
    api.adminListTemplates.mockResolvedValue({ data: [template({ id: 'custom', name: 'Custom', is_uploaded: true })] });
    api.adminDeleteTemplate.mockResolvedValue({});
    const confirmSpy = vi.spyOn(globalThis, 'confirm').mockReturnValue(true);
    render(<AdminPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Templates/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(api.adminDeleteTemplate).toHaveBeenCalledWith('custom'));
    confirmSpy.mockRestore();
  });

  it('disables delete for core templates', async () => {
    await openTemplatesTab();
    const deleteButtons = within(screen.getByText('Modern').closest('.entry-card')).getAllByRole('button', { name: 'Delete' });
    expect(deleteButtons[0]).toBeDisabled();
  });
});

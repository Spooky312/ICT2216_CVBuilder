import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Register from './Register';
import * as api from '../../services/api';

vi.mock('../../services/api');

beforeEach(() => {
  vi.clearAllMocks();
});

const renderRegister = () => render(<MemoryRouter><Register /></MemoryRouter>);

const fillForm = () => {
  fireEvent.change(screen.getByLabelText('Full Name'), { target: { value: 'Alice' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@b.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Passw0rd' } });
};

describe('Register', () => {
  it('shows the success view with a login link after a successful submit', async () => {
    api.register.mockResolvedValue({});
    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(await screen.findByText('Account created')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to Login' })).toHaveAttribute('href', '/login');
  });

  it('shows field errors returned by the server', async () => {
    api.register.mockRejectedValue({ response: { data: { errors: { email: 'Already registered' } } } });
    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(await screen.findByText('Already registered')).toBeInTheDocument();
  });

  it('shows a general error when the server has no field errors', async () => {
    api.register.mockRejectedValue({ response: { data: { message: 'Server error' } } });
    renderRegister();
    fillForm();
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));
    expect(await screen.findByText('Server error')).toBeInTheDocument();
  });

  it('marks password rules as satisfied as the user types', () => {
    renderRegister();
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Str0ng!Passw0rd' } });
    const items = screen.getAllByRole('listitem');
    expect(items.every((li) => li.className === 'rule-ok')).toBe(true);
  });
});

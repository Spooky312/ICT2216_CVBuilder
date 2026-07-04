import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';
import * as api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

vi.mock('../../services/api');
vi.mock('../../context/AuthContext');
vi.mock('./TotpQrCode', () => ({ default: ({ uri }) => <div data-testid="totp-qr">{uri}</div> }));

const navigateMock = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

const loginFn = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  useAuth.mockReturnValue({ login: loginFn });
});

const renderLogin = () => render(<MemoryRouter><Login /></MemoryRouter>);

const fillPassword = (email = 'a@b.com', password = 'secret123') => {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
};

describe('Login password step', () => {
  it('logs in and redirects a non-admin user to the dashboard', async () => {
    api.login.mockResolvedValue({ data: { user: { role: 'user' } } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(loginFn).toHaveBeenCalledWith({ role: 'user' }));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('logs in and redirects an admin user to the admin panel', async () => {
    api.login.mockResolvedValue({ data: { user: { role: 'admin' } } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/admin'));
  });

  it('shows an error message on failed login', async () => {
    api.login.mockRejectedValue({ response: { data: { message: 'Bad credentials' } } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Bad credentials')).toBeInTheDocument();
  });

  it('shows the CAPTCHA field after a show_captcha error and requires an answer', async () => {
    api.login.mockRejectedValueOnce({ response: { data: { message: 'Try again', show_captcha: true } } });
    api.getCaptcha.mockResolvedValue({ data: { captcha_token: 'tok', question: 'What is 2+2?' } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText(/What is 2\+2\?/)).toBeInTheDocument();
    await waitFor(() => expect(api.getCaptcha).toHaveBeenCalled());

    api.login.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Please solve the CAPTCHA to continue.')).toBeInTheDocument();
    expect(api.login).not.toHaveBeenCalled();
  });

  it('submits the captcha token and answer once solved', async () => {
    api.login
      .mockRejectedValueOnce({ response: { data: { message: 'Try again', show_captcha: true } } })
      .mockResolvedValueOnce({ data: { user: { role: 'user' } } });
    api.getCaptcha.mockResolvedValue({ data: { captcha_token: 'tok', question: 'What is 2+2?' } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText(/What is 2\+2\?/);

    fireEvent.change(screen.getByLabelText(/Security check/), { target: { value: '4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await waitFor(() => expect(api.login).toHaveBeenLastCalledWith(
      expect.objectContaining({ captcha_token: 'tok', captcha_answer: '4' })
    ));
  });
});

describe('Login two-factor step', () => {
  it('shows the TOTP setup QR code when the server returns a totp_uri', async () => {
    api.login.mockResolvedValue({ data: { requires_2fa: true, challenge_token: 'chal', totp_uri: 'otpauth://...' } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByTestId('totp-qr')).toHaveTextContent('otpauth://...');
  });

  it('shows only the code prompt when no setup is required', async () => {
    api.login.mockResolvedValue({ data: { requires_2fa: true, challenge_token: 'chal' } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByLabelText('Authenticator Code');
    expect(screen.queryByTestId('totp-qr')).not.toBeInTheDocument();
  });

  it('verifies the TOTP code and redirects on success', async () => {
    api.login.mockResolvedValue({ data: { requires_2fa: true, challenge_token: 'chal' } });
    api.verifyTwoFactor.mockResolvedValue({ data: { user: { role: 'user' } } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(await screen.findByLabelText('Authenticator Code'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    await waitFor(() => expect(api.verifyTwoFactor).toHaveBeenCalledWith({ challenge_token: 'chal', totp_code: '123456' }));
    expect(navigateMock).toHaveBeenCalledWith('/dashboard');
  });

  it('shows an error when TOTP verification fails', async () => {
    api.login.mockResolvedValue({ data: { requires_2fa: true, challenge_token: 'chal' } });
    api.verifyTwoFactor.mockRejectedValue({ response: { data: { message: 'Invalid code' } } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    fireEvent.change(await screen.findByLabelText('Authenticator Code'), { target: { value: '000000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));
    expect(await screen.findByText('Invalid code')).toBeInTheDocument();
  });

  it('resets to the password step via "Use a different account"', async () => {
    api.login.mockResolvedValue({ data: { requires_2fa: true, challenge_token: 'chal' } });
    renderLogin();
    fillPassword();
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByLabelText('Authenticator Code');
    fireEvent.click(screen.getByRole('button', { name: 'Use a different account' }));
    expect(await screen.findByLabelText('Email')).toHaveValue('');
  });
});

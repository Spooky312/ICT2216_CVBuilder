import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as apiLogin, verifyTwoFactor } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState('');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleRedirect = (user) => {
    if (user && user.role === 'admin') {
      navigate('/admin');
    } else {
      navigate('/dashboard');
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await apiLogin(form);
      if (res.data.requires_2fa) {
        setChallenge(res.data.challenge_token);
        setSetup(res.data.totp_secret ? {
          secret: res.data.totp_secret,
          uri: res.data.totp_uri,
        } : null);
        setTotpCode('');
        return;
      }
      login(res.data.user);
      handleRedirect(res.data.user);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || 'Login failed.');
      if (data?.show_captcha) setShowCaptcha(true);
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await verifyTwoFactor({ challenge_token: challenge, totp_code: totpCode });
      login(res.data.user);
      handleRedirect(res.data.user);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || 'Two-factor verification failed.');
      if (data?.show_captcha) setShowCaptcha(true);
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordStep = () => {
    setChallenge(null);
    setSetup(null);
    setTotpCode('');
    setError('');
  };

  return (
    <div className="auth-card">
      <h2>Welcome back</h2>
      <p className="text-muted">Log in to manage your resumes.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {showCaptcha && (
        <div className="alert alert-warning">
          Too many failed attempts. Please prove you're human before continuing.
        </div>
      )}

      {!challenge ? (
        <form onSubmit={handlePasswordSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email"
              value={form.email} onChange={onChange} required />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password"
              value={form.password} onChange={onChange} required />
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Checking password...' : 'Continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleTotpSubmit} noValidate>
          {setup && (
            <div className="alert alert-warning">
              <p>Set up two-factor authentication in your authenticator app before continuing.</p>
              <p><strong>Setup key:</strong> <code>{setup.secret}</code></p>
              <p><strong>URI:</strong> <code>{setup.uri}</code></p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="totp_code">Authenticator Code</label>
            <input id="totp_code" name="totp_code" type="text" inputMode="numeric"
              autoComplete="one-time-code" pattern="[0-9 ]*" maxLength={12}
              value={totpCode} onChange={(e) => setTotpCode(e.target.value)} required />
          </div>

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Verifying...' : 'Log In'}
          </button>
          <button type="button" className="btn-secondary btn-full" onClick={resetPasswordStep}
            disabled={loading} style={{ marginTop: '0.75rem' }}>
            Use a different account
          </button>
        </form>
      )}

      <p className="auth-footer">
        No account? <Link to="/register">Sign up for free</Link>
      </p>
    </div>
  );
}

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as apiLogin, verifyTwoFactor } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import TotpQrCode from './TotpQrCode';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState('');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captchaSolved, setCaptchaSolved] = useState(false);
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
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
    if (showCaptcha && !captchaSolved) {
      setError('Please complete the CAPTCHA to continue.');
      return;
    }
    setError('');
    setAttemptsRemaining(null);
    setLoading(true);
    try {
      const res = await apiLogin(form);
      if (res.data.requires_2fa) {
        setChallenge(res.data.challenge_token);
        setSetup(res.data.totp_uri ? { uri: res.data.totp_uri } : null);
        setTotpCode('');
        return;
      }
      login(res.data.user);
      handleRedirect(res.data.user);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || 'Login failed.');
      if (data?.show_captcha) setShowCaptcha(true);
      if (data?.attempts_remaining !== undefined) setAttemptsRemaining(data.attempts_remaining);
    } finally {
      setLoading(false);
    }
  };

  const handleTotpSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setAttemptsRemaining(null);
    setLoading(true);
    try {
      const res = await verifyTwoFactor({ challenge_token: challenge, totp_code: totpCode });
      login(res.data.user);
      handleRedirect(res.data.user);
    } catch (err) {
      const data = err.response?.data;
      setError(data?.message || 'Two-factor verification failed.');
      if (data?.show_captcha) setShowCaptcha(true);
      if (data?.attempts_remaining !== undefined) setAttemptsRemaining(data.attempts_remaining);
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordStep = () => {
    setChallenge(null);
    setSetup(null);
    setTotpCode('');
    setError('');
    setAttemptsRemaining(null);
  };

  return (
    <div className="auth-card">
      <h2>Welcome back</h2>
      <p className="text-muted">Log in to manage your resumes.</p>

      {error && <div className="alert alert-error">{error}</div>}

      {attemptsRemaining !== null && attemptsRemaining > 0 && attemptsRemaining <= 3 && (
        <div className="alert alert-warning" role="alert">
          <strong>Warning:</strong> {attemptsRemaining} login attempt{attemptsRemaining === 1 ? '' : 's'} remaining before account lockout.
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

          {showCaptcha && (
            <div className="form-group" style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#f8f9fa', display: 'flex', alignItems: 'center', gap: '12px', marginTop: '1rem', marginBottom: '1rem' }}>
              <input 
                type="checkbox" 
                id="captcha" 
                checked={captchaSolved} 
                onChange={(e) => setCaptchaSolved(e.target.checked)} 
                style={{ width: '20px', height: '20px', cursor: 'pointer' }}
              />
              <label htmlFor="captcha" style={{ margin: 0, cursor: 'pointer', userSelect: 'none', fontWeight: 'bold' }}>
                I'm not a robot
              </label>
            </div>
          )}

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Checking password...' : 'Continue'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleTotpSubmit} noValidate>
          {setup && (
            <>
              <p className="text-muted">Set up two-factor authentication in your authenticator app before continuing.</p>
              <TotpQrCode uri={setup.uri} />
            </>
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

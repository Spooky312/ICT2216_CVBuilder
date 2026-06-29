import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login as apiLogin, verifyTwoFactor, getCaptcha } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import TotpQrCode from './TotpQrCode';

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' });
  const [totpCode, setTotpCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [setup, setSetup] = useState(null);
  const [error, setError] = useState('');
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [captcha, setCaptcha] = useState(null); // { token, question } from the server
  const [captchaAnswer, setCaptchaAnswer] = useState('');
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

  // Fetch a fresh server-issued challenge. The answer never leaves the server,
  // so the only way through is to actually solve the question shown here.
  const loadCaptcha = async () => {
    try {
      const res = await getCaptcha();
      setCaptcha({ token: res.data.captcha_token, question: res.data.question });
    } catch {
      setCaptcha(null);
    }
    setCaptchaAnswer('');
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (showCaptcha && !captchaAnswer.trim()) {
      setError('Please solve the CAPTCHA to continue.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const payload = { ...form };
      if (showCaptcha && captcha) {
        payload.captcha_token = captcha.token;
        payload.captcha_answer = captchaAnswer;
      }
      const res = await apiLogin(payload);
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
      // A consumed/expired challenge can't be reused, so always pull a fresh
      // one whenever the server still wants a CAPTCHA.
      if (data?.show_captcha) {
        setShowCaptcha(true);
        await loadCaptcha();
      }
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
    } finally {
      setLoading(false);
    }
  };

  const resetPasswordStep = (event) => {
    event?.preventDefault();
    event?.stopPropagation();
    setForm({ email: '', password: '' });
    setChallenge(null);
    setSetup(null);
    setTotpCode('');
    setShowCaptcha(false);
    setCaptcha(null);
    setCaptchaAnswer('');
    setLoading(false);
    setError('');
  };

  return (
    <div className="auth-card">
      <h2>Welcome back</h2>
      <p className="text-muted">Log in to manage your resumes.</p>

      {error && <div className="alert alert-error">{error}</div>}

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

          {showCaptcha && captcha && (
            <div className="form-group" style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '6px', backgroundColor: '#f8f9fa', marginTop: '1rem', marginBottom: '1rem' }}>
              <label htmlFor="captcha_answer" style={{ fontWeight: 'bold' }}>
                Security check: {captcha.question}
              </label>
              <input
                id="captcha_answer"
                name="captcha_answer"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={captchaAnswer}
                onChange={(e) => setCaptchaAnswer(e.target.value)}
                required
              />
            </div>
          )}

          <button type="submit" className="btn-primary btn-full" disabled={loading}>
            {loading ? 'Checking password...' : 'Continue'}
          </button>
        </form>
      ) : (
        <>
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
          </form>
          <button type="button" className="btn-secondary btn-full" onClick={resetPasswordStep}
            disabled={loading} style={{ marginTop: '0.75rem' }}>
            Use a different account
          </button>
        </>
      )}

      <p className="auth-footer">
        No account? <Link to="/register">Sign up for free</Link>
      </p>
    </div>
  );
}

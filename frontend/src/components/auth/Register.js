import { useState } from 'react';
import { Link } from 'react-router-dom';
import { register } from '../../services/api';
import TotpQrCode from './TotpQrCode';

const PASSWORD_RULES = [
  { test: (p) => p.length >= 12, label: 'At least 12 characters' },
  { test: (p) => /[A-Z]/.test(p), label: 'Uppercase letter' },
  { test: (p) => /[a-z]/.test(p), label: 'Lowercase letter' },
  { test: (p) => /\d/.test(p), label: 'Number' },
  { test: (p) => /[!@#$%^&*(),.?":{}|<>_+=\[\]\\;'`~-]/.test(p), label: 'Special character' },
];

export default function Register() {
  const [form, setForm] = useState({ full_name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(false);

  const onChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});
    setLoading(true);
    try {
      const res = await register(form);
      setSetup({ uri: res.data.totp_uri });
    } catch (err) {
      const data = err.response?.data;
      if (data?.errors) setErrors(data.errors);
      else setErrors({ general: data?.message || 'Registration failed.' });
    } finally {
      setLoading(false);
    }
  };

  if (setup) {
    return (
      <div className="auth-card">
        <h2>Set up two-factor authentication</h2>
        <p className="text-muted">
          Add this account to your authenticator app, then use the generated code when logging in.
        </p>
        <TotpQrCode uri={setup.uri} />
        <Link to="/login" className="btn-primary" style={{ marginTop: '1rem', display: 'inline-block' }}>
          Go to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <h2>Create your account</h2>
      <p className="text-muted">Start building your ATS-ready resume today.</p>

      {errors.general && <div className="alert alert-error">{errors.general}</div>}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-group">
          <label htmlFor="full_name">Full Name</label>
          <input id="full_name" name="full_name" type="text" autoComplete="name"
            value={form.full_name} onChange={onChange} required />
          {errors.full_name && <span className="field-error">{errors.full_name}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email"
            value={form.email} onChange={onChange} required />
          {errors.email && <span className="field-error">{errors.email}</span>}
        </div>

        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="new-password"
            value={form.password} onChange={onChange} required />
          {errors.password && <span className="field-error">{errors.password}</span>}
          <ul className="password-rules">
            {PASSWORD_RULES.map((r) => (
              <li key={r.label} className={r.test(form.password) ? 'rule-ok' : 'rule-fail'}>
                {r.test(form.password) ? 'OK' : '--'} {r.label}
              </li>
            ))}
          </ul>
        </div>

        <button type="submit" className="btn-primary btn-full" disabled={loading}>
          {loading ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="auth-footer">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}

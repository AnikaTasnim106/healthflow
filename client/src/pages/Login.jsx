// ============================================================
//  Login.jsx
//  Login ar Register — ekta screen, upore toggle.
// ============================================================

import { useState } from 'react';
import { useAuth } from '../auth';
import { apiRegister } from '../api';

export default function Login() {
  const { login } = useAuth();

  const [mode, setMode] = useState('login');      // 'login' | 'register'
  const [busy, setBusy] = useState(false);
  const [error, setError]   = useState('');
  const [notice, setNotice] = useState('');

  const [form, setForm] = useState({
    email: '', password: '', full_name: '', confirm: '',
  });

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  function switchMode(next) {
    setMode(next);
    setError('');
    setNotice('');
    setForm({ email: '', password: '', full_name: '', confirm: '' });
  }

  async function handleLogin() {
    if (!form.email.trim())  { setError('Enter your email address.'); return; }
    if (!form.password)      { setError('Enter your password.'); return; }
    try {
      setBusy(true);
      setError('');
      await login(form.email.trim(), form.password);
      // safol hole App.jsx nijei dashboard e niye jabe
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. Is the backend running on port 5000?');
      } else {
        setError(err.response.data?.error || 'Could not sign you in.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister() {
    if (!form.full_name.trim()) { setError('Enter your full name.'); return; }
    if (!form.email.trim())     { setError('Enter your email address.'); return; }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.'); return;
    }
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.'); return;
    }
    try {
      setBusy(true);
      setError('');
      await apiRegister({
        name: form.full_name.trim(),
        email: form.email.trim(),
        password: form.password,
        });
      switchMode('login');
      setNotice('Account created. You can sign in now.');
    } catch (err) {
      if (!err.response) {
        setError('Cannot reach the server. Is the backend running on port 5000?');
      } else {
        // 409 = ei email e account already ache
        setError(err.response.data?.error || 'Could not create the account.');
      }
    } finally {
      setBusy(false);
    }
  }

  const submit = mode === 'login' ? handleLogin : handleRegister;

  return (
    <div className="gate">
      <div className="gate-card">
        <div className="gate-brand">
          <span className="mark">HealthFlow</span>
          <span className="sub">Hospital Records</span>
        </div>

        <div className="gate-tabs">
          <button
            className={mode === 'login' ? 'gate-tab on' : 'gate-tab'}
            onClick={() => switchMode('login')}>
            Sign in
          </button>
          <button
            className={mode === 'register' ? 'gate-tab on' : 'gate-tab'}
            onClick={() => switchMode('register')}>
            Register
          </button>
        </div>

        {error && (
          <div className="alert" style={{ marginBottom: 14 }}>
            <span>{error}</span>
            <button className="x" onClick={() => setError('')}>Dismiss</button>
          </div>
        )}
        {notice && (
          <div className="alert" style={{
            marginBottom: 14,
            background: 'var(--clear-pale)', borderColor: '#c8ddd0',
            borderLeftColor: 'var(--clear)', color: 'var(--clear)',
          }}>
            <span>{notice}</span>
          </div>
        )}

        <div className="gate-fields">
          {mode === 'register' && (
            <label>
              Full name
              <input value={form.full_name} onChange={set('full_name')}
                placeholder="Your name" autoComplete="name" />
            </label>
          )}

          <label>
            Email
            <input type="email" value={form.email} onChange={set('email')}
              placeholder="you@example.com" autoComplete="email" />
          </label>

          <label>
            Password
            <input type="password" value={form.password} onChange={set('password')}
              placeholder={mode === 'register' ? 'At least 8 characters' : ''}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
          </label>

          {mode === 'register' && (
            <label>
              Confirm password
              <input type="password" value={form.confirm} onChange={set('confirm')}
                autoComplete="new-password"
                onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} />
            </label>
          )}
        </div>

        <button className="btn primary gate-submit" onClick={submit} disabled={busy}>
          {busy
            ? (mode === 'login' ? 'Signing in\u2026' : 'Creating account\u2026')
            : (mode === 'login' ? 'Sign in' : 'Create account')}
        </button>

        {mode === 'register' && (
          <p className="gate-note">
            Registering creates a patient account. Staff accounts are created
            by an administrator.
          </p>
        )}
      </div>
    </div>
  );
}
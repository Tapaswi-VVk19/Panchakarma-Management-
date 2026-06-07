import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('anita@example.com');
  const [password, setPassword] = useState('patient123');
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get('/auth/demo-accounts').then(setAccounts).catch(() => {});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="logo big">☘</span>
          <h1>Panchakarma Management</h1>
          <p>Authentic Ayurveda. Modern efficiency.</p>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            Email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <div className="error-banner">{error}</div>}
          <button className="btn-primary" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="demo-accounts">
          <div className="demo-title">Demo accounts — click to fill</div>
          <div className="demo-grid">
            {accounts.map((a) => (
              <button
                key={a.email}
                type="button"
                className="demo-chip"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(a.password);
                }}
              >
                <span className={`role-pill role-${a.role}`}>{a.role}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{a.name}</div>
                  <div className="muted small">{a.email}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const [channels, setChannels] = useState(user.channels || { inApp: true, sms: false, email: false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function save() {
    setSaving(true);
    setMessage('');
    try {
      const updated = await api.patch(`/users/${user.id}/channels`, channels);
      updateUser(updated);
      setMessage('✓ Preferences saved.');
    } catch (e) {
      setMessage('✗ ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="muted">Choose how the system contacts you.</p>
        </div>
      </header>

      <section className="card">
        <h3>Notification channels</h3>
        <p className="muted">Pre- and post-procedure reminders will be delivered via the channels you enable.</p>

        <div className="channel-grid">
          <Channel
            label="In-app notifications"
            desc="Always visible on the notifications page."
            checked={channels.inApp}
            onChange={(v) => setChannels({ ...channels, inApp: v })}
          />
          <Channel
            label="SMS"
            desc={user.phone ? `Sent to ${user.phone}` : 'No phone number on file'}
            checked={channels.sms}
            onChange={(v) => setChannels({ ...channels, sms: v })}
          />
          <Channel
            label="Email"
            desc={`Sent to ${user.email}`}
            checked={channels.email}
            onChange={(v) => setChannels({ ...channels, email: v })}
          />
        </div>

        <button className="btn-primary" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save preferences'}
        </button>
        {message && <span style={{ marginLeft: 12 }}>{message}</span>}
      </section>

      <section className="card">
        <h3>Profile</h3>
        <div className="kv-row">
          <span><b>Name:</b> {user.name}</span>
          <span><b>Email:</b> {user.email}</span>
          <span><b>Role:</b> {user.role}</span>
          {user.phone && <span><b>Phone:</b> {user.phone}</span>}
        </div>
      </section>
    </div>
  );
}

function Channel({ label, desc, checked, onChange }) {
  return (
    <label className={'channel-card' + (checked ? ' on' : '')}>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div className="muted small">{desc}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

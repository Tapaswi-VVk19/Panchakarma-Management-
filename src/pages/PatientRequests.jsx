// Patient-only page: raise an appointment request and see request history.
// Replaces self-booking — only doctors/admin can create real sessions.

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime } from '../utils/constants.js';

export default function PatientRequests() {
  const { user } = useAuth();
  const [therapies, setTherapies] = useState([]);
  const [doctor, setDoctor] = useState(null);
  const [requests, setRequests] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [reason, setReason] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [preferredAt, setPreferredAt] = useState('');
  const [therapyId, setTherapyId] = useState('');

  useEffect(() => {
    api.get('/therapies').then(setTherapies);
    if (user.assignedDoctorId) {
      api.get(`/users/${user.assignedDoctorId}`).then(setDoctor).catch(() => {});
    }
    refreshRequests();
  }, [user.id]);

  function refreshRequests() {
    api.get(`/appointment-requests?patientId=${user.id}`).then(setRequests);
  }

  async function submit(e) {
    e.preventDefault();
    if (!reason.trim()) {
      setMessage('✗ Please describe the issue.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await api.post('/appointment-requests', {
        patientId: user.id,
        reason,
        urgency,
        preferredAt: preferredAt ? new Date(preferredAt).toISOString() : null,
        therapyId: therapyId || null,
      });
      setReason('');
      setPreferredAt('');
      setUrgency('normal');
      setTherapyId('');
      setMessage('✓ Request submitted. Your doctor has been notified.');
      refreshRequests();
    } catch (err) {
      setMessage('✗ ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Request an appointment</h1>
          <p className="muted">
            Raise this if you have any concern about your treatment, a new symptom,
            or you'd like an extra session. {doctor && <>Your assigned doctor <b>{doctor.name}</b> will be notified.</>}
          </p>
        </div>
      </header>

      <div className="two-col">
        <section className="card">
          <h3>New request</h3>
          {!user.assignedDoctorId && (
            <div className="info-banner" style={{ background: '#fef3c7', borderColor: '#fcd34d', color: '#92400e', marginBottom: 10 }}>
              You don't have an assigned doctor yet. Please contact the centre admin.
            </div>
          )}
          <form onSubmit={submit} className="form-grid">
            <label className="span-2">
              What is the issue or reason?
              <textarea
                rows={4}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Mild headache started after yesterday's Shirodhara session…"
                required
              />
            </label>
            <label>
              Urgency
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)}>
                <option value="low">Low — general query</option>
                <option value="normal">Normal — within a few days</option>
                <option value="high">High — please attend to me soon</option>
              </select>
            </label>
            <label>
              Preferred time (optional)
              <input
                type="datetime-local"
                value={preferredAt}
                onChange={(e) => setPreferredAt(e.target.value)}
              />
            </label>
            <label className="span-2">
              Therapy you'd like (optional)
              <select value={therapyId} onChange={(e) => setTherapyId(e.target.value)}>
                <option value="">— let the doctor decide —</option>
                {therapies.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            <div className="span-2">
              <button className="btn-primary" disabled={busy || !user.assignedDoctorId}>
                {busy ? 'Submitting…' : 'Submit request'}
              </button>
              {message && <span style={{ marginLeft: 12 }}>{message}</span>}
            </div>
          </form>
        </section>

        <section className="card">
          <h3>Your requests</h3>
          {requests.length === 0 && <p className="muted">You haven't raised any requests yet.</p>}
          <ul className="notif-list">
            {requests.map((r) => (
              <li key={r.id} className="notif-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>{r.reason}</strong>
                  <span className={`status-pill request-${r.status}`}>{r.status}</span>
                </div>
                <div className="muted small">
                  raised {formatDateTime(r.createdAt)} · urgency: {r.urgency}
                  {r.preferredAt && <> · preferred: {formatDateTime(r.preferredAt)}</>}
                </div>
                {r.decisionNote && (
                  <div style={{ marginTop: 4 }}>
                    <b>Doctor's note:</b> {r.decisionNote}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

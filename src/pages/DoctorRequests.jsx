// Doctor-only inbox of patient-raised appointment requests. Doctor can
// ACCEPT (which auto-books a session) or REJECT (with optional note).

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime } from '../utils/constants.js';

export default function DoctorRequests() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [therapies, setTherapies] = useState([]);
  const [patients, setPatients] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [message, setMessage] = useState('');

  useEffect(() => {
    refresh();
    api.get('/therapies').then(setTherapies);
    api.get('/users?role=patient').then(setPatients);
  }, [user.id]);

  function refresh() {
    const q = user.role === 'admin' ? '' : `?doctorId=${user.id}`;
    api.get(`/appointment-requests${q}`).then(setRequests);
  }

  const patientOf = (id) => patients.find((p) => p.id === id);
  const therapyOf = (id) => therapies.find((t) => t.id === id);
  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Patient appointment requests</h1>
          <p className="muted">Accept to auto-book a session, or decline with a note.</p>
        </div>
      </header>

      <div className="filter-bar">
        {['pending', 'accepted', 'rejected', 'all'].map((k) => (
          <button
            key={k}
            className={'chip' + (filter === k ? ' active' : '')}
            onClick={() => setFilter(k)}
          >
            {k} {k !== 'all' && `(${requests.filter((r) => r.status === k).length})`}
          </button>
        ))}
      </div>

      {message && <div className="info-banner">{message}</div>}

      {filtered.length === 0 && (
        <section className="card"><p className="muted">No requests in this category.</p></section>
      )}

      {filtered.map((r) => (
        <RequestCard
          key={r.id}
          r={r}
          patient={patientOf(r.patientId)}
          therapies={therapies}
          therapyOf={therapyOf}
          onDone={(msg) => {
            setMessage(msg);
            refresh();
          }}
        />
      ))}
    </div>
  );
}

function RequestCard({ r, patient, therapies, therapyOf, onDone }) {
  const [open, setOpen] = useState(r.status === 'pending');
  const [therapyId, setTherapyId] = useState(r.therapyId || (therapies[0]?.id || ''));
  const [startAt, setStartAt] = useState(toLocalInput(r.preferredAt || nextHour()));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!therapyId && therapies[0]) setTherapyId(therapies[0].id);
  }, [therapies]); // eslint-disable-line

  async function accept() {
    setBusy(true);
    try {
      await api.post(`/appointment-requests/${r.id}/decision`, {
        action: 'accept',
        startAt: new Date(startAt).toISOString(),
        therapyId,
        note,
      });
      onDone(`✓ Accepted — session booked for ${patient?.name} at ${new Date(startAt).toLocaleString()}.`);
    } catch (e) {
      onDone('✗ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    setBusy(true);
    try {
      await api.post(`/appointment-requests/${r.id}/decision`, { action: 'reject', note });
      onDone(`✓ Request from ${patient?.name} declined.`);
    } catch (e) {
      onDone('✗ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={'card request-card urgency-' + r.urgency}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ flex: 1 }}>
          <div className="row" style={{ gap: 8 }}>
            <strong style={{ fontSize: 16 }}>{patient?.name || r.patientId}</strong>
            <span className={`status-pill request-${r.status}`}>{r.status}</span>
            <span className={`urgency-pill u-${r.urgency}`}>{r.urgency} urgency</span>
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            raised {formatDateTime(r.createdAt)}
            {r.preferredAt && <> · preferred {formatDateTime(r.preferredAt)}</>}
            {r.therapyId && <> · wants {therapyOf(r.therapyId)?.name}</>}
          </div>
          <p style={{ margin: '8px 0' }}><b>Issue:</b> {r.reason}</p>
          {r.decisionNote && (
            <p className="muted small"><b>Note:</b> {r.decisionNote}</p>
          )}
        </div>
        {r.status === 'pending' && (
          <button className="btn-ghost" onClick={() => setOpen((o) => !o)}>
            {open ? 'Hide' : 'Decide'}
          </button>
        )}
      </div>

      {r.status === 'pending' && open && (
        <div className="form-grid" style={{ marginTop: 12 }}>
          <label>
            Therapy
            <select value={therapyId} onChange={(e) => setTherapyId(e.target.value)}>
              {therapies.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Date &amp; time
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
            />
          </label>
          <label className="span-2">
            Note to patient (optional)
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Please come 15 minutes early to fill the form"
            />
          </label>
          <div className="span-2 row" style={{ gap: 10 }}>
            <button className="btn-primary" onClick={accept} disabled={busy}>
              {busy ? '…' : '✓ Accept & book'}
            </button>
            <button className="btn-ghost danger" onClick={reject} disabled={busy}>
              ✕ Decline
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function nextHour() {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 24);
  return d.toISOString();
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

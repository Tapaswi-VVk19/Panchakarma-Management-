import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime, statusColor } from '../utils/constants.js';

export default function Schedule() {
  const { user } = useAuth();

  // Patients can no longer self-book. They see a friendly redirect to the
  // "Request appointment" workflow instead.
  if (user.role === 'patient') {
    return (
      <div className="page">
        <header className="page-header">
          <div>
            <h1>Booking is managed by your doctor</h1>
            <p className="muted">
              For your safety and continuity of care, only your assigned doctor or the
              centre admin can schedule therapy sessions. If you'd like an appointment —
              for a new symptom, a follow-up, or any concern about your treatment —
              please raise a request and your doctor will respond.
            </p>
          </div>
          <Link to="/requests" className="btn-primary">+ Request appointment</Link>
        </header>
        <section className="card">
          <h3>Why this change?</h3>
          <ul>
            <li>Doctors can match the right therapy and timing to your current state.</li>
            <li>It prevents scheduling conflicts and unsafe back-to-back sessions.</li>
            <li>Urgent issues are flagged and handled faster.</li>
          </ul>
          <Link to="/requests" className="btn-primary">Raise a request</Link>
          &nbsp;<Link to="/" className="btn-ghost">Back to dashboard</Link>
        </section>
      </div>
    );
  }
  const [therapies, setTherapies] = useState([]);
  const [patients, setPatients] = useState([]);
  const [practitioners, setPractitioners] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  // Form state
  const [therapyId, setTherapyId] = useState('');
  const [patientId, setPatientId] = useState(user.role === 'patient' ? user.id : '');
  const [practitionerId, setPractitionerId] = useState('');
  const [startAt, setStartAt] = useState(defaultStart());
  const [count, setCount] = useState(1);
  const [autoCourse, setAutoCourse] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/therapies'),
      api.get('/users?role=patient'),
      api.get('/users?role=practitioner'),
    ]).then(([t, pa, pr]) => {
      setTherapies(t);
      setPatients(pa);
      setPractitioners(pr);
      if (!therapyId && t[0]) {
        setTherapyId(t[0].id);
        setCount(t[0].sessionsRecommended);
      }
      if (!practitionerId && pr[0]) setPractitionerId(pr[0].id);
    });
    refreshSessions();
  }, []);

  function refreshSessions() {
    const q = user.role === 'patient' ? `?patientId=${user.id}` : user.role === 'practitioner' ? `?practitionerId=${user.id}` : '';
    api.get(`/sessions${q}`).then(setSessions);
  }

  const selectedTherapy = useMemo(
    () => therapies.find((t) => t.id === therapyId),
    [therapies, therapyId],
  );

  useEffect(() => {
    if (selectedTherapy) setCount(selectedTherapy.sessionsRecommended);
  }, [therapyId]); // eslint-disable-line

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      if (autoCourse && count > 1) {
        const created = await api.post('/sessions/auto', {
          patientId,
          practitionerId,
          therapyId,
          startAt: new Date(startAt).toISOString(),
          count: Number(count),
          bookedBy: user.id, // server requires this — patients cannot self-book.
        });
        setMessage(`✓ Auto-scheduled ${created.length} sessions.`);
      } else {
        await api.post('/sessions', {
          patientId,
          practitionerId,
          therapyId,
          startAt: new Date(startAt).toISOString(),
          bookedBy: user.id,
        });
        setMessage('✓ Session booked.');
      }
      refreshSessions();
    } catch (err) {
      setMessage('✗ ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reschedule(id) {
    const value = prompt('New date & time (YYYY-MM-DDTHH:mm):');
    if (!value) return;
    await api.patch(`/sessions/${id}`, { startAt: new Date(value).toISOString() });
    refreshSessions();
  }

  async function cancel(id) {
    if (!confirm('Cancel this session?')) return;
    await api.del(`/sessions/${id}`);
    refreshSessions();
  }

  const therapyOf = (id) => therapies.find((t) => t.id === id);
  const patientOf = (id) => patients.find((p) => p.id === id);
  const practitionerOf = (id) => practitioners.find((p) => p.id === id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Schedule therapy sessions</h1>
          <p className="muted">
            Choose a therapy and start date — we'll auto-space sessions using the recommended cadence.
          </p>
        </div>
      </header>

      <div className="two-col">
        <section className="card">
          <h3>New booking</h3>
          <form onSubmit={submit} className="form-grid">
            <label>
              Therapy
              <select value={therapyId} onChange={(e) => setTherapyId(e.target.value)} required>
                {therapies.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            {user.role !== 'patient' && (
              <label>
                Patient
                <select value={patientId} onChange={(e) => setPatientId(e.target.value)} required>
                  <option value="">— select —</option>
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </label>
            )}

            <label>
              Practitioner
              <select value={practitionerId} onChange={(e) => setPractitionerId(e.target.value)} required>
                <option value="">— select —</option>
                {practitioners.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>

            <label>
              Start date & time
              <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} required />
            </label>

            <label className="span-2 row" style={{ alignItems: 'center', gap: 12 }}>
              <input
                type="checkbox"
                checked={autoCourse}
                onChange={(e) => setAutoCourse(e.target.checked)}
              />
              Auto-schedule full course
            </label>

            <label>
              Number of sessions
              <input
                type="number"
                min={1}
                max={30}
                value={count}
                onChange={(e) => setCount(e.target.value)}
                disabled={!autoCourse}
              />
            </label>

            <div className="span-2">
              <button className="btn-primary" disabled={busy}>
                {busy ? 'Booking…' : autoCourse ? 'Auto-schedule course' : 'Book session'}
              </button>
              {message && <span style={{ marginLeft: 12 }}>{message}</span>}
            </div>
          </form>
        </section>

        <section className="card">
          <h3>{selectedTherapy?.name || 'Therapy details'}</h3>
          {selectedTherapy && (
            <>
              <p className="muted">{selectedTherapy.description}</p>
              <div className="kv-row">
                <span><b>Duration:</b> {selectedTherapy.durationMinutes} min</span>
                <span><b>Cadence:</b> every {selectedTherapy.cadenceDays} day(s)</span>
                <span><b>Recommended:</b> {selectedTherapy.sessionsRecommended} sessions</span>
              </div>
              <h4>Pre-procedure precautions</h4>
              <ul>{selectedTherapy.preCare.map((x) => <li key={x}>{x}</li>)}</ul>
              <h4>Post-procedure care</h4>
              <ul>{selectedTherapy.postCare.map((x) => <li key={x}>{x}</li>)}</ul>
            </>
          )}
        </section>
      </div>

      <section className="card">
        <h3>{user.role === 'patient' ? 'Your sessions' : 'All sessions'}</h3>
        <table className="table">
          <thead>
            <tr>
              <th>When</th>
              <th>Therapy</th>
              {user.role !== 'patient' && <th>Patient</th>}
              <th>Practitioner</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{formatDateTime(s.startAt)}</td>
                <td>{therapyOf(s.therapyId)?.name}</td>
                {user.role !== 'patient' && <td>{patientOf(s.patientId)?.name}</td>}
                <td>{practitionerOf(s.practitionerId)?.name}</td>
                <td><span className="status-pill" style={{ background: statusColor(s.status) }}>{s.status}</span></td>
                <td>
                  {s.status !== 'cancelled' && s.status !== 'completed' && (
                    <>
                      <button className="btn-ghost" onClick={() => reschedule(s.id)}>Reschedule</button>
                      <button className="btn-ghost danger" onClick={() => cancel(s.id)}>Cancel</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function defaultStart() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(10, 0, 0, 0);
  // datetime-local expects YYYY-MM-DDTHH:mm
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

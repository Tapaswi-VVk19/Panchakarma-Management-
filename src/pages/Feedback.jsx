import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime } from '../utils/constants.js';

const SIDE_EFFECTS = ['Headache', 'Nausea', 'Dizziness', 'Skin irritation', 'Mild fever', 'Insomnia'];

export default function Feedback() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [therapies, setTherapies] = useState([]);
  const [history, setHistory] = useState([]);
  const [sessionId, setSessionId] = useState('');
  const [vals, setVals] = useState({ energy: 5, fatigue: 3, pain: 2, mood: 7, sleep: 6 });
  const [side, setSide] = useState([]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    Promise.all([
      api.get(`/sessions?patientId=${user.id}`),
      api.get('/therapies'),
      api.get(`/feedback?patientId=${user.id}`),
    ]).then(([s, t, f]) => {
      setSessions(s);
      setTherapies(t);
      setHistory(f);
      const candidate = s.find((x) => x.status !== 'completed' && x.status !== 'cancelled');
      if (candidate) setSessionId(candidate.id);
    });
  }, [user.id]);

  const therapyOf = (id) => therapies.find((t) => t.id === id);
  const eligible = useMemo(
    () => sessions.filter((s) => s.status !== 'cancelled'),
    [sessions],
  );

  function toggleSide(s) {
    setSide((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  }

  async function submit(e) {
    e.preventDefault();
    if (!sessionId) {
      setMessage('Please pick a session');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const res = await api.post('/feedback', {
        sessionId,
        patientId: user.id,
        ...vals,
        sideEffects: side,
        notes,
      });
      let msg = '✓ Feedback submitted — thank you!';
      if (res.adjustedSession) {
        msg += ' Your next session was pushed back 24 h based on your responses.';
      }
      setMessage(msg);
      setNotes('');
      setSide([]);
      // refresh history
      api.get(`/feedback?patientId=${user.id}`).then(setHistory);
    } catch (err) {
      setMessage('✗ ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  if (user.role !== 'patient') {
    return (
      <div className="page">
        <h1>Patient feedback</h1>
        <p className="muted">Switch to a patient account to record post-session feedback.</p>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Session feedback</h1>
          <p className="muted">
            Tell us how you feel — the system will adapt your schedule if needed.
          </p>
        </div>
      </header>

      <div className="two-col">
        <section className="card">
          <form onSubmit={submit} className="form-grid">
            <label className="span-2">
              Session
              <select value={sessionId} onChange={(e) => setSessionId(e.target.value)} required>
                <option value="">— pick one —</option>
                {eligible.map((s) => (
                  <option key={s.id} value={s.id}>
                    {therapyOf(s.therapyId)?.name} — {formatDateTime(s.startAt)} ({s.status})
                  </option>
                ))}
              </select>
            </label>

            {['energy', 'mood', 'sleep', 'fatigue', 'pain'].map((k) => (
              <label key={k} className="slider-row">
                <span className="cap">{k}</span>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={vals[k]}
                  onChange={(e) => setVals({ ...vals, [k]: Number(e.target.value) })}
                />
                <span className="slider-val">{vals[k]}</span>
              </label>
            ))}

            <div className="span-2">
              <div className="muted small" style={{ marginBottom: 6 }}>Side effects (optional)</div>
              <div className="chip-grid">
                {SIDE_EFFECTS.map((s) => (
                  <button
                    type="button"
                    key={s}
                    className={'chip' + (side.includes(s) ? ' active' : '')}
                    onClick={() => toggleSide(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <label className="span-2">
              Notes / improvements observed
              <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </label>

            <div className="span-2">
              <button className="btn-primary" disabled={busy}>
                {busy ? 'Submitting…' : 'Submit feedback'}
              </button>
              {message && <span style={{ marginLeft: 12 }}>{message}</span>}
            </div>
          </form>
        </section>

        <section className="card">
          <h3>Your feedback history</h3>
          {history.length === 0 && <p className="muted">No feedback submitted yet.</p>}
          <ul className="notif-list">
            {history.slice().reverse().slice(0, 8).map((f) => (
              <li key={f.id} className="notif-item">
                <div className="row" style={{ justifyContent: 'space-between' }}>
                  <strong>Wellness: {f.wellness}/10</strong>
                  <span className="muted small">{formatDateTime(f.createdAt)}</span>
                </div>
                <div className="muted small">
                  energy {f.energy} · mood {f.mood} · sleep {f.sleep} · fatigue {f.fatigue} · pain {f.pain}
                </div>
                {f.sideEffects?.length > 0 && (
                  <div className="muted small">side-effects: {f.sideEffects.join(', ')}</div>
                )}
                {f.notes && <div style={{ marginTop: 4 }}>{f.notes}</div>}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}

// Unified doctor/practitioner page that combines THREE workflows in one nav item:
//   1) Reassign the patient's upcoming sessions to another practitioner
//      (used when the doctor will be absent).
//   2) Reschedule a specific appointment to a new date/time.
//   3) Create / edit the patient's diet plan.
//
// Only practitioners and admins see this page (App.jsx route-guards it).

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime, statusColor } from '../utils/constants.js';

const EMPTY_PLAN = () => ({
  title: '',
  notes: '',
  meals: [
    { time: 'Breakfast', items: '' },
    { time: 'Lunch', items: '' },
    { time: 'Dinner', items: '' },
  ],
  restrictions: [],
});

export default function PatientManagement() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [practitioners, setPractitioners] = useState([]);
  const [therapies, setTherapies] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [plan, setPlan] = useState(null); // existing latest plan or null
  const [draft, setDraft] = useState(EMPTY_PLAN());
  const [patientId, setPatientId] = useState('');
  const [tab, setTab] = useState('reassign'); // 'reassign' | 'reschedule' | 'diet' | 'emergency'
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Load lookups once
  useEffect(() => {
    Promise.all([
      api.get('/users?role=patient'),
      api.get('/users?role=practitioner'),
      api.get('/therapies'),
    ]).then(([pa, pr, th]) => {
      setPatients(pa);
      setPractitioners(pr);
      setTherapies(th);
      if (!patientId && pa[0]) setPatientId(pa[0].id);
    });
  }, []);

  // Whenever the selected patient changes, refresh their sessions + diet plan.
  useEffect(() => {
    if (!patientId) return;
    refresh();
  }, [patientId]);

  async function refresh() {
    const [s, p] = await Promise.all([
      api.get(`/sessions?patientId=${patientId}`),
      api.get(`/diet-plans?patientId=${patientId}&latest=1`),
    ]);
    setSessions(s);
    setPlan(p);
    setDraft(
      p
        ? {
            title: p.title,
            notes: p.notes,
            meals: p.meals?.length ? p.meals : EMPTY_PLAN().meals,
            restrictions: p.restrictions || [],
          }
        : EMPTY_PLAN(),
    );
  }

  const therapyOf = (id) => therapies.find((t) => t.id === id);
  const practitionerOf = (id) => practitioners.find((p) => p.id === id);
  const selectedPatient = useMemo(
    () => patients.find((p) => p.id === patientId),
    [patients, patientId],
  );

  const upcoming = sessions
    .filter((s) => ['scheduled', 'rescheduled'].includes(s.status) && new Date(s.startAt) > new Date())
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Patient management</h1>
          <p className="muted">
            Reassign, reschedule and update diet — all from one place.
          </p>
        </div>
        <select
          value={patientId}
          onChange={(e) => {
            setPatientId(e.target.value);
            setMessage('');
          }}
        >
          {patients.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </header>

      {selectedPatient && (
        <section className="card patient-summary">
          <div className="avatar lg">{initials(selectedPatient.name)}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedPatient.name}</div>
            <div className="muted small">{selectedPatient.email} · {selectedPatient.phone || 'no phone'}</div>
            <div className="kv-row" style={{ marginTop: 6 }}>
              <span><b>Upcoming:</b> {upcoming.length}</span>
              <span><b>Completed:</b> {sessions.filter((s) => s.status === 'completed').length}</span>
              <span><b>Active plan:</b> {plan ? plan.title : '— none —'}</span>
            </div>
          </div>
        </section>
      )}

      <div className="tab-bar">
        <TabBtn active={tab === 'reassign'} onClick={() => setTab('reassign')}>
          🔄 Reassign doctor
        </TabBtn>
        <TabBtn active={tab === 'reschedule'} onClick={() => setTab('reschedule')}>
          🗓️ Reschedule appointment
        </TabBtn>
        <TabBtn active={tab === 'diet'} onClick={() => setTab('diet')}>
          🥗 Diet plan
        </TabBtn>
        <TabBtn active={tab === 'emergency'} onClick={() => setTab('emergency')}>
          🚨 Emergency alert
        </TabBtn>
      </div>

      {message && <div className="info-banner">{message}</div>}

      {tab === 'reassign' && (
        <ReassignPanel
          patientId={patientId}
          upcoming={upcoming}
          practitioners={practitioners}
          currentUser={user}
          therapyOf={therapyOf}
          practitionerOf={practitionerOf}
          busy={busy}
          setBusy={setBusy}
          onDone={(m) => {
            setMessage(m);
            refresh();
          }}
        />
      )}

      {tab === 'reschedule' && (
        <ReschedulePanel
          upcoming={upcoming}
          therapyOf={therapyOf}
          practitionerOf={practitionerOf}
          busy={busy}
          setBusy={setBusy}
          onDone={(m) => {
            setMessage(m);
            refresh();
          }}
        />
      )}

      {tab === 'diet' && (
        <DietPanel
          plan={plan}
          draft={draft}
          setDraft={setDraft}
          patientId={patientId}
          patientName={selectedPatient?.name}
          practitionerId={user.id}
          busy={busy}
          setBusy={setBusy}
          onDone={(m) => {
            setMessage(m);
            refresh();
          }}
        />
      )}

      {tab === 'emergency' && (
        <EmergencyPanel
          fromUserId={user.id}
          patientId={patientId}
          patientName={selectedPatient?.name}
          busy={busy}
          setBusy={setBusy}
          onDone={(m) => setMessage(m)}
        />
      )}
    </div>
  );
}

/* ───────────── Emergency alert ───────────── */

function EmergencyPanel({ fromUserId, patientId, patientName, busy, setBusy, onDone }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [scope, setScope] = useState('one'); // 'one' | 'all'

  async function send() {
    if (!title.trim() || !body.trim()) return onDone('✗ Title and message are required.');
    setBusy(true);
    try {
      const res = await api.post('/notifications/emergency', {
        fromUserId,
        patientId: scope === 'one' ? patientId : null,
        title,
        message: body,
      });
      onDone(`✓ Emergency alert delivered to ${res.sent} patient(s).`);
      setTitle('');
      setBody('');
    } catch (e) {
      onDone('✗ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card emergency-card">
      <h3>🚨 Send an emergency alert</h3>
      <p className="muted">
        Use this only for urgent matters (clinic closure, side-effect warning,
        immediate instructions). It will be marked as <b>emergency</b> in the patient's
        notifications and sent via every channel they have enabled.
      </p>
      <div className="form-grid">
        <label className="span-2">
          Recipients
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="one">Just {patientName || 'this patient'}</option>
            <option value="all">All my assigned patients</option>
          </select>
        </label>
        <label className="span-2">
          Title
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Skip tomorrow's session"
          />
        </label>
        <label className="span-2">
          Message
          <textarea
            rows={4}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Describe what the patient should do next…"
          />
        </label>
        <div className="span-2">
          <button className="btn-primary danger" onClick={send} disabled={busy}>
            {busy ? 'Sending…' : '🚨 Send emergency alert'}
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Reassign ───────────── */

function ReassignPanel({
  patientId, upcoming, practitioners, currentUser, therapyOf, practitionerOf,
  busy, setBusy, onDone,
}) {
  const [toPractitionerId, setToPractitionerId] = useState('');
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState(() => new Set());

  // Default: select every upcoming session assigned to the current doctor.
  useEffect(() => {
    const mine = upcoming
      .filter((s) => s.practitionerId === currentUser.id)
      .map((s) => s.id);
    setSelected(new Set(mine));
  }, [upcoming, currentUser.id]);

  const others = practitioners.filter((p) => p.id !== currentUser.id);

  useEffect(() => {
    if (!toPractitionerId && others[0]) setToPractitionerId(others[0].id);
  }, [practitioners]); // eslint-disable-line

  function toggle(id) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  async function submit() {
    if (!toPractitionerId) return onDone('✗ Pick a doctor to reassign to.');
    if (selected.size === 0) return onDone('✗ Select at least one session.');
    setBusy(true);
    try {
      const res = await api.post('/sessions/reassign', {
        sessionIds: Array.from(selected),
        toPractitionerId,
        reason,
      });
      onDone('✓ ' + res.message);
      setReason('');
    } catch (e) {
      onDone('✗ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (upcoming.length === 0) {
    return (
      <section className="card">
        <h3>Reassign sessions</h3>
        <p className="muted">No upcoming sessions for this patient — nothing to reassign.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Reassign upcoming sessions</h3>
      <p className="muted">
        Use this when you'll be unavailable. Select the sessions to hand off and
        choose a colleague. The patient is automatically notified.
      </p>

      <div className="form-grid">
        <label>
          New practitioner
          <select value={toPractitionerId} onChange={(e) => setToPractitionerId(e.target.value)}>
            {others.length === 0 && <option value="">— no other practitioners —</option>}
            {others.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
        </label>
        <label>
          Reason (optional)
          <input
            type="text"
            placeholder="e.g. On leave 10–12 June"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
      </div>

      <table className="table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th style={{ width: 36 }}>
              <input
                type="checkbox"
                checked={selected.size === upcoming.length}
                onChange={(e) => setSelected(new Set(e.target.checked ? upcoming.map((s) => s.id) : []))}
              />
            </th>
            <th>When</th>
            <th>Therapy</th>
            <th>Current doctor</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {upcoming.map((s) => (
            <tr key={s.id}>
              <td>
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                />
              </td>
              <td>{formatDateTime(s.startAt)}</td>
              <td>{therapyOf(s.therapyId)?.name || s.therapyId}</td>
              <td>{practitionerOf(s.practitionerId)?.name || s.practitionerId}</td>
              <td>
                <span className="status-pill" style={{ background: statusColor(s.status) }}>
                  {s.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ marginTop: 12 }}>
        <button className="btn-primary" onClick={submit} disabled={busy}>
          {busy ? 'Reassigning…' : `Reassign ${selected.size} session(s)`}
        </button>
      </div>
    </section>
  );
}

/* ───────────── Reschedule ───────────── */

function ReschedulePanel({ upcoming, therapyOf, practitionerOf, busy, setBusy, onDone }) {
  const [sessionId, setSessionId] = useState('');
  const [when, setWhen] = useState('');

  useEffect(() => {
    if (!sessionId && upcoming[0]) {
      setSessionId(upcoming[0].id);
      setWhen(toLocalInput(upcoming[0].startAt));
    }
  }, [upcoming]); // eslint-disable-line

  useEffect(() => {
    const s = upcoming.find((x) => x.id === sessionId);
    if (s) setWhen(toLocalInput(s.startAt));
  }, [sessionId]); // eslint-disable-line

  async function submit() {
    if (!sessionId || !when) return onDone('✗ Pick a session and a new time.');
    setBusy(true);
    try {
      await api.patch(`/sessions/${sessionId}`, { startAt: new Date(when).toISOString() });
      onDone('✓ Session rescheduled. The patient was notified.');
    } catch (e) {
      onDone('✗ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    if (!sessionId) return;
    if (!confirm('Cancel this session?')) return;
    setBusy(true);
    try {
      await api.del(`/sessions/${sessionId}`);
      onDone('✓ Session cancelled. The patient was notified.');
    } catch (e) {
      onDone('✗ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (upcoming.length === 0) {
    return (
      <section className="card">
        <h3>Reschedule appointment</h3>
        <p className="muted">No upcoming sessions for this patient.</p>
      </section>
    );
  }

  return (
    <section className="card">
      <h3>Reschedule a specific appointment</h3>
      <div className="form-grid">
        <label className="span-2">
          Appointment
          <select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
            {upcoming.map((s) => (
              <option key={s.id} value={s.id}>
                {therapyOf(s.therapyId)?.name} — {formatDateTime(s.startAt)} (Dr.{' '}
                {practitionerOf(s.practitionerId)?.name?.split(' ').slice(-1)[0]})
              </option>
            ))}
          </select>
        </label>
        <label>
          New date &amp; time
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
          />
        </label>
        <div className="row" style={{ alignItems: 'flex-end', gap: 10 }}>
          <button className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Saving…' : 'Reschedule'}
          </button>
          <button className="btn-ghost danger" onClick={cancel} disabled={busy}>
            Cancel session
          </button>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Diet plan ───────────── */

function DietPanel({
  plan, draft, setDraft, patientId, patientName, practitionerId, busy, setBusy, onDone,
}) {
  const [restrictionInput, setRestrictionInput] = useState('');

  function updateMeal(i, patch) {
    setDraft((d) => ({
      ...d,
      meals: d.meals.map((m, idx) => (idx === i ? { ...m, ...patch } : m)),
    }));
  }

  function addMeal() {
    setDraft((d) => ({ ...d, meals: [...d.meals, { time: '', items: '' }] }));
  }

  function removeMeal(i) {
    setDraft((d) => ({ ...d, meals: d.meals.filter((_, idx) => idx !== i) }));
  }

  function addRestriction() {
    const v = restrictionInput.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, restrictions: [...d.restrictions, v] }));
    setRestrictionInput('');
  }

  function removeRestriction(i) {
    setDraft((d) => ({ ...d, restrictions: d.restrictions.filter((_, idx) => idx !== i) }));
  }

  async function save() {
    if (!draft.title.trim()) return onDone('✗ Plan needs a title.');
    setBusy(true);
    try {
      const payload = {
        title: draft.title.trim(),
        notes: draft.notes,
        meals: draft.meals,
        restrictions: draft.restrictions,
      };
      if (plan) {
        await api.patch(`/diet-plans/${plan.id}`, payload);
        onDone('✓ Diet plan updated. The patient was notified.');
      } else {
        await api.post('/diet-plans', {
          ...payload,
          patientId,
          practitionerId,
        });
        onDone('✓ Diet plan created. The patient was notified.');
      }
    } catch (e) {
      onDone('✗ ' + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      {/* Make it unmistakable which patient is being addressed. */}
      <div className="diet-target">
        <span className="diet-target-label">Diet plan for</span>
        <span className="diet-target-name">{patientName || '— select a patient above —'}</span>
      </div>
      <h3>{plan ? 'Edit diet plan' : 'Create diet plan'}</h3>
      <p className="muted">
        Tailor meals, timings and restrictions to <b>{patientName || 'this patient'}</b>'s
        prakriti and current therapy. Saving sends an in-app/SMS/email notification to{' '}
        <b>{patientName || 'them'}</b> on their preferred channels.
      </p>

      <div className="form-grid">
        <label className="span-2">
          Plan title
          <input
            type="text"
            placeholder="e.g. Pitta-pacifying summer diet"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="span-2">
          Notes for the patient
          <textarea
            rows={3}
            placeholder="General guidance — when to eat, what to avoid, hydration etc."
            value={draft.notes}
            onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          />
        </label>
      </div>

      <h4 style={{ marginTop: 16 }}>Meals</h4>
      <table className="table">
        <thead>
          <tr><th style={{ width: '24%' }}>Time</th><th>Items</th><th style={{ width: 60 }}></th></tr>
        </thead>
        <tbody>
          {draft.meals.map((m, i) => (
            <tr key={i}>
              <td>
                <input
                  type="text"
                  value={m.time}
                  placeholder="e.g. Breakfast"
                  onChange={(e) => updateMeal(i, { time: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={m.items}
                  placeholder="e.g. Spiced oats with stewed apple"
                  onChange={(e) => updateMeal(i, { items: e.target.value })}
                />
              </td>
              <td>
                <button className="btn-ghost danger" onClick={() => removeMeal(i)}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn-ghost" onClick={addMeal} type="button" style={{ marginTop: 6 }}>
        + Add meal
      </button>

      <h4 style={{ marginTop: 16 }}>Restrictions</h4>
      <div className="chip-grid">
        {draft.restrictions.map((r, i) => (
          <span key={i} className="chip active" style={{ cursor: 'default' }}>
            {r}
            <button
              className="chip-x"
              onClick={() => removeRestriction(i)}
              aria-label="Remove"
              type="button"
            >×</button>
          </span>
        ))}
      </div>
      <div className="row" style={{ marginTop: 8, gap: 8 }}>
        <input
          type="text"
          placeholder="e.g. No curd at night"
          value={restrictionInput}
          onChange={(e) => setRestrictionInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addRestriction(); } }}
        />
        <button className="btn-ghost" type="button" onClick={addRestriction}>Add</button>
      </div>

      <div style={{ marginTop: 16 }}>
        <button className="btn-primary" onClick={save} disabled={busy || !patientId}>
          {busy
            ? 'Saving…'
            : plan
              ? `Update plan & notify ${patientName || 'patient'}`
              : `Send plan to ${patientName || 'patient'}`}
        </button>
        {plan && (
          <span className="muted small" style={{ marginLeft: 12 }}>
            Last updated {formatDateTime(plan.updatedAt)}
          </span>
        )}
      </div>
    </section>
  );
}

/* ───────────── helpers ───────────── */

function TabBtn({ active, onClick, children }) {
  return (
    <button className={'tab-btn' + (active ? ' active' : '')} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function initials(name) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

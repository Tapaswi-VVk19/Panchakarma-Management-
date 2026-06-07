import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime, statusColor } from '../utils/constants.js';

export default function PractitionerDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [therapies, setTherapies] = useState([]);
  const [patients, setPatients] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get(`/sessions?practitionerId=${user.id}`),
      api.get('/therapies'),
      api.get('/users?role=patient'),
    ]).then(([s, t, p]) => {
      setSessions(s);
      setTherapies(t);
      setPatients(p);
    });
  }, [user.id]);

  const today = new Date().toDateString();
  const todaySessions = sessions.filter((s) => new Date(s.startAt).toDateString() === today);
  const upcoming = sessions.filter(
    (s) => new Date(s.startAt) > new Date() && ['scheduled', 'rescheduled'].includes(s.status),
  );

  const therapyOf = (id) => therapies.find((t) => t.id === id);
  const patientOf = (id) => patients.find((p) => p.id === id);

  async function complete(id) {
    await api.patch(`/sessions/${id}`, { status: 'completed' });
    setSessions((list) => list.map((s) => (s.id === id ? { ...s, status: 'completed' } : s)));
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{user.name}</h1>
          <p className="muted">Today’s clinic at a glance</p>
        </div>
      </header>

      <div className="kpi-grid">
        <Kpi label="Today" value={todaySessions.length} accent="#2563eb" />
        <Kpi label="Upcoming this week" value={upcoming.length} accent="#7c3aed" />
        <Kpi label="Active patients" value={new Set(sessions.map((s) => s.patientId)).size} accent="#16a34a" />
        <Kpi
          label="Completed all-time"
          value={sessions.filter((s) => s.status === 'completed').length}
          accent="#f59e0b"
        />
      </div>

      <section className="card">
        <h3>Today's schedule</h3>
        {todaySessions.length === 0 && <p className="muted">No sessions scheduled today.</p>}
        <table className="table">
          <thead>
            <tr><th>Time</th><th>Patient</th><th>Therapy</th><th>Status</th><th></th></tr>
          </thead>
          <tbody>
            {todaySessions.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.startAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td>{patientOf(s.patientId)?.name || s.patientId}</td>
                <td>{therapyOf(s.therapyId)?.name}</td>
                <td><span className="status-pill" style={{ background: statusColor(s.status) }}>{s.status}</span></td>
                <td>
                  {s.status !== 'completed' && (
                    <button className="btn-ghost" onClick={() => complete(s.id)}>Mark complete</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h3>Upcoming sessions</h3>
        <ul className="session-list">
          {upcoming.slice(0, 10).map((s) => (
            <li key={s.id} className="session-row">
              <div className="session-body">
                <div className="session-title">
                  {therapyOf(s.therapyId)?.name} — {patientOf(s.patientId)?.name}
                </div>
                <div className="muted small">{formatDateTime(s.startAt)}</div>
              </div>
              <span className="status-pill" style={{ background: statusColor(s.status) }}>{s.status}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-value" style={{ color: accent }}>{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}

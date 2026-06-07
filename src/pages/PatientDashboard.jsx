import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime, statusColor } from '../utils/constants.js';
import ProgressRing from '../components/ProgressRing.jsx';

export default function PatientDashboard() {
  const { user } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [therapies, setTherapies] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [progress, setProgress] = useState(null);
  const [dietPlan, setDietPlan] = useState(null);
  const [packages, setPackages] = useState([]);
  const [doctor, setDoctor] = useState(null);

  useEffect(() => {
    refresh();
  }, [user.id]);

  async function refresh() {
    const [s, t, n, p, d, pkgs] = await Promise.all([
      api.get(`/sessions?patientId=${user.id}`),
      api.get('/therapies'),
      api.get(`/notifications?userId=${user.id}`),
      api.get(`/progress/${user.id}`),
      api.get(`/diet-plans?patientId=${user.id}&latest=1`),
      api.get('/packages'),
    ]);
    setSessions(s);
    setTherapies(t);
    setNotifs(n);
    setProgress(p);
    setDietPlan(d);
    setPackages(pkgs);
    if (user.assignedDoctorId) {
      api.get(`/users/${user.assignedDoctorId}`).then(setDoctor).catch(() => {});
    }
  }

  const upcoming = sessions
    .filter((s) => ['scheduled', 'rescheduled'].includes(s.status) && new Date(s.startAt) > new Date())
    .slice(0, 5);
  const therapyOf = (id) => therapies.find((t) => t.id === id);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Namaste, {user.name.split(' ')[0]} 🙏</h1>
          <p className="muted">
            Here is the snapshot of your healing journey today.
            {doctor && <> Your doctor: <b>{doctor.name}</b>.</>}
          </p>
        </div>
        {/* Patients can no longer self-book — they raise a request to their doctor. */}
        <Link to="/requests" className="btn-primary">+ Request appointment</Link>
      </header>

      <div className="kpi-grid">
        <KpiCard label="Sessions completed" value={progress?.counts.completed ?? 0} accent="#16a34a" />
        <KpiCard label="Upcoming" value={progress?.counts.upcoming ?? 0} accent="#2563eb" />
        <KpiCard label="Total in course" value={progress?.counts.total ?? 0} accent="#7c3aed" />
        <div className="card kpi-card center">
          <ProgressRing value={progress?.completionPct ?? 0} />
          <div className="muted small">Course completion</div>
        </div>
      </div>

      <div className="two-col">
        <section className="card">
          <h3>Upcoming sessions</h3>
          {upcoming.length === 0 && <p className="muted">No upcoming sessions. Book one from the Schedule page.</p>}
          <ul className="session-list">
            {upcoming.map((s) => {
              const t = therapyOf(s.therapyId);
              return (
                <li key={s.id} className="session-row">
                  <div className="session-time">
                    <div className="day">
                      {new Date(s.startAt).toLocaleDateString(undefined, { weekday: 'short' })}
                    </div>
                    <div className="date">
                      {new Date(s.startAt).getDate()}
                    </div>
                  </div>
                  <div className="session-body">
                    <div className="session-title">{t?.name || s.therapyId}</div>
                    <div className="muted small">{formatDateTime(s.startAt)}</div>
                  </div>
                  <span className="status-pill" style={{ background: statusColor(s.status) }}>
                    {s.status}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="card">
          <h3>Recent alerts</h3>
          {notifs.length === 0 && <p className="muted">No notifications yet.</p>}
          <ul className="notif-list">
            {notifs.slice(0, 5).map((n) => (
              <li key={n.id} className={'notif-item' + (n.read ? '' : ' unread')}>
                <div className="notif-title">{n.title}</div>
                <pre className="notif-body">{n.body}</pre>
                <div className="muted small">{formatDateTime(n.createdAt)}</div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card">
        <h3>Your diet plan {dietPlan && <span className="muted small" style={{ fontWeight: 400 }}>· updated {new Date(dietPlan.updatedAt).toLocaleDateString()}</span>}</h3>
        {!dietPlan ? (
          <p className="muted">
            No diet plan has been assigned yet. Your doctor will publish a personalised plan
            soon — you'll be notified the moment it's ready.
          </p>
        ) : (
          <>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{dietPlan.title}</div>
            {dietPlan.notes && <p className="muted" style={{ marginTop: 0 }}>{dietPlan.notes}</p>}
            <table className="table">
              <thead><tr><th style={{ width: '24%' }}>Time</th><th>Items</th></tr></thead>
              <tbody>
                {(dietPlan.meals || []).map((m, i) => (
                  <tr key={i}><td>{m.time}</td><td>{m.items}</td></tr>
                ))}
              </tbody>
            </table>
            {dietPlan.restrictions?.length > 0 && (
              <>
                <div className="muted small" style={{ marginTop: 10 }}>Restrictions</div>
                <div className="chip-grid">
                  {dietPlan.restrictions.map((r, i) => (
                    <span key={i} className="chip active" style={{ cursor: 'default' }}>{r}</span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </section>

      {/* Show ONLY the package(s) this patient is actually enrolled in —
          never the full centre catalogue. */}
      {(() => {
        const enrolledIds = new Set(user.enrolledPackageIds || []);
        const myPackages = packages.filter((p) => enrolledIds.has(p.id));
        return (
          <section className="card">
            <h3>Your treatment package</h3>
            {myPackages.length === 0 ? (
              <p className="muted">
                You haven't been enrolled in a wellness package yet. Please contact
                the centre admin or your doctor if you'd like to start one.
              </p>
            ) : (
              <>
                <div className="package-grid">
                  {myPackages.map((p) => (
                    <article key={p.id} className="package-card">
                      <div className="pkg-emoji">{p.coverEmoji || '🌿'}</div>
                      <div style={{ flex: 1 }}>
                        <div className="pkg-title">{p.title}</div>
                        <div className="muted small">{p.tagline}</div>
                        <div className="pkg-meta">
                          {p.durationDays && <span>📅 {p.durationDays} days</span>}
                          {p.priceINR && <span>₹ {p.priceINR.toLocaleString('en-IN')}</span>}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
                <Link to="/packages" className="btn-ghost" style={{ marginTop: 10, display: 'inline-block' }}>
                  Full details →
                </Link>
              </>
            )}
          </section>
        );
      })()}

      <section className="card">
        <h3>Personalised recovery milestones</h3>
        <div className="milestones">
          {(progress?.milestones || []).map((m) => (
            <div key={m.label} className={'milestone' + (m.reached ? ' reached' : '')}>
              <div className="dot">{m.reached ? '✓' : ''}</div>
              <div>
                <div className="m-label">{m.label}</div>
                <div className="muted small">{m.at}%</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, accent }) {
  return (
    <div className="card kpi-card">
      <div className="kpi-value" style={{ color: accent }}>{value}</div>
      <div className="muted">{label}</div>
    </div>
  );
}

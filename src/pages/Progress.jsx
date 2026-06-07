import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import ProgressRing from '../components/ProgressRing.jsx';

export default function Progress() {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [patientId, setPatientId] = useState(user.role === 'patient' ? user.id : '');
  const [data, setData] = useState(null);

  useEffect(() => {
    if (user.role !== 'patient') {
      api.get('/users?role=patient').then((list) => {
        setPatients(list);
        if (!patientId && list[0]) setPatientId(list[0].id);
      });
    }
  }, []);

  useEffect(() => {
    if (patientId) api.get(`/progress/${patientId}`).then(setData);
  }, [patientId]);

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Real-time progress</h1>
          <p className="muted">Visualise wellness trends and milestone achievements.</p>
        </div>
        {user.role !== 'patient' && (
          <select value={patientId} onChange={(e) => setPatientId(e.target.value)}>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        )}
      </header>

      {!data ? <p className="muted">Loading…</p> : (
        <>
          <div className="kpi-grid">
            <div className="card kpi-card center">
              <ProgressRing value={data.completionPct} />
              <div className="muted small">Course completion</div>
            </div>
            <Kpi label="Completed" value={data.counts.completed} accent="#16a34a" />
            <Kpi label="Upcoming" value={data.counts.upcoming} accent="#2563eb" />
            <Kpi label="Total" value={data.counts.total} accent="#7c3aed" />
          </div>

          <section className="card">
            <h3>Wellness score over time</h3>
            {data.series.length === 0 ? (
              <p className="muted">Submit feedback after a session to start tracking your wellness.</p>
            ) : (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <AreaChart data={data.series}>
                    <defs>
                      <linearGradient id="wellnessFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#16a34a" stopOpacity={0.7} />
                        <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="wellness" stroke="#16a34a" fill="url(#wellnessFill)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Symptom trends (1 = low, 10 = high)</h3>
            {data.series.length === 0 ? (
              <p className="muted">No data yet.</p>
            ) : (
              <div style={{ width: '100%', height: 300 }}>
                <ResponsiveContainer>
                  <LineChart data={data.series}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="energy" stroke="#16a34a" />
                    <Line type="monotone" dataKey="mood" stroke="#2563eb" />
                    <Line type="monotone" dataKey="sleep" stroke="#7c3aed" />
                    <Line type="monotone" dataKey="fatigue" stroke="#f59e0b" />
                    <Line type="monotone" dataKey="pain" stroke="#dc2626" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="card">
            <h3>Recovery milestones</h3>
            <div className="milestones">
              {data.milestones.map((m) => (
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
        </>
      )}
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

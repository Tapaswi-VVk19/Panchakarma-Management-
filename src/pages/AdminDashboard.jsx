import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [users, setUsers] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [therapies, setTherapies] = useState([]);

  useEffect(() => {
    Promise.all([
      api.get('/users'),
      api.get('/sessions'),
      api.get('/therapies'),
    ]).then(([u, s, t]) => {
      setUsers(u);
      setSessions(s);
      setTherapies(t);
    });
  }, []);

  const byTherapy = therapies.map((t) => ({
    name: t.name.split(' ')[0],
    sessions: sessions.filter((s) => s.therapyId === t.id).length,
  }));

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Center overview</h1>
          <p className="muted">Operational health across all practitioners and patients.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <Kpi label="Patients" value={users.filter((u) => u.role === 'patient').length} accent="#16a34a" />
        <Kpi label="Practitioners" value={users.filter((u) => u.role === 'practitioner').length} accent="#2563eb" />
        <Kpi label="Therapies offered" value={therapies.length} accent="#7c3aed" />
        <Kpi label="Sessions (total)" value={sessions.length} accent="#f59e0b" />
      </div>

      <section className="card">
        <h3>Sessions per therapy</h3>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={byTherapy}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="sessions" fill="#0e9f6e" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
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

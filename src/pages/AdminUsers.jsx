// Admin user management: add patients & doctors, and (re)assign each patient
// to a primary practitioner.

import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [packages, setPackages] = useState([]);
  const [tab, setTab] = useState('patients'); // 'patients' | 'doctors'
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  // Add-form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [assignedDoctorId, setAssignedDoctorId] = useState('');

  // Inline package-enrollment editor — which patient row is currently expanded.
  const [enrollingFor, setEnrollingFor] = useState(null);

  useEffect(() => { refresh(); }, []);
  function refresh() {
    api.get('/users').then(setUsers);
    api.get('/packages').then(setPackages);
  }

  async function toggleEnroll(patient, packageId) {
    const current = new Set(patient.enrolledPackageIds || []);
    if (current.has(packageId)) current.delete(packageId);
    else current.add(packageId);
    try {
      await api.patch(`/users/${patient.id}`, { enrolledPackageIds: Array.from(current) });
      refresh();
    } catch (e) {
      setMessage('✗ ' + e.message);
    }
  }

  const patients = users.filter((u) => u.role === 'patient');
  const doctors = users.filter((u) => u.role === 'practitioner');

  async function submit(e) {
    e.preventDefault();
    if (!name || !email || !password) {
      setMessage('✗ Name, email and password are required.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const role = tab === 'patients' ? 'patient' : 'practitioner';
      const payload = { name, email, phone, password, role };
      if (role === 'patient') payload.assignedDoctorId = assignedDoctorId || null;
      const created = await api.post('/users', payload);
      setMessage(`✓ ${role === 'patient' ? 'Patient' : 'Doctor'} ${created.name} added.`);
      setName(''); setEmail(''); setPhone(''); setPassword(''); setAssignedDoctorId('');
      refresh();
    } catch (err) {
      setMessage('✗ ' + err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reassign(patientId, doctorId) {
    try {
      await api.patch(`/users/${patientId}`, { assignedDoctorId: doctorId || null });
      setMessage('✓ Patient reassigned.');
      refresh();
    } catch (e) {
      setMessage('✗ ' + e.message);
    }
  }

  async function remove(id, label) {
    if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
    try {
      await api.del(`/users/${id}`);
      setMessage(`✓ ${label} deleted.`);
      refresh();
    } catch (e) {
      setMessage('✗ ' + e.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>User management</h1>
          <p className="muted">Add patients and doctors, and assign patients to their primary practitioner.</p>
        </div>
      </header>

      <div className="tab-bar">
        <button className={'tab-btn' + (tab === 'patients' ? ' active' : '')} onClick={() => setTab('patients')}>
          🧘 Patients ({patients.length})
        </button>
        <button className={'tab-btn' + (tab === 'doctors' ? ' active' : '')} onClick={() => setTab('doctors')}>
          🩺 Doctors ({doctors.length})
        </button>
      </div>

      {message && <div className="info-banner">{message}</div>}

      <section className="card">
        <h3>Add a {tab === 'patients' ? 'patient' : 'doctor'}</h3>
        <form onSubmit={submit} className="form-grid">
          <label>Name<input type="text" value={name} onChange={(e) => setName(e.target.value)} required /></label>
          <label>Email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></label>
          <label>Phone<input type="text" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91-…" /></label>
          <label>Initial password<input type="text" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
          {tab === 'patients' && (
            <label className="span-2">
              Assign to doctor
              <select value={assignedDoctorId} onChange={(e) => setAssignedDoctorId(e.target.value)}>
                <option value="">— unassigned —</option>
                {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </label>
          )}
          <div className="span-2">
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Adding…' : `+ Add ${tab === 'patients' ? 'patient' : 'doctor'}`}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <h3>All {tab === 'patients' ? 'patients' : 'doctors'}</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Name</th><th>Email</th><th>Phone</th>
              {tab === 'patients' && <th>Assigned doctor</th>}
              {tab === 'patients' && <th>Packages</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {(tab === 'patients' ? patients : doctors).map((u) => (
              <React.Fragment key={u.id}>
                <tr>
                  <td>{u.name}</td>
                  <td>{u.email}</td>
                  <td>{u.phone || '—'}</td>
                  {tab === 'patients' && (
                    <td>
                      <select
                        value={u.assignedDoctorId || ''}
                        onChange={(e) => reassign(u.id, e.target.value)}
                      >
                        <option value="">— unassigned —</option>
                        {doctors.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </td>
                  )}
                  {tab === 'patients' && (
                    <td>
                      <button
                        className="btn-ghost"
                        onClick={() => setEnrollingFor(enrollingFor === u.id ? null : u.id)}
                      >
                        {u.enrolledPackageIds?.length || 0} enrolled
                        {enrollingFor === u.id ? ' ▴' : ' ▾'}
                      </button>
                    </td>
                  )}
                  <td>
                    <button className="btn-ghost danger" onClick={() => remove(u.id, u.name)}>Delete</button>
                  </td>
                </tr>
                {tab === 'patients' && enrollingFor === u.id && (
                  <tr className="enroll-row">
                    <td colSpan={6}>
                      <div className="muted small" style={{ marginBottom: 6 }}>
                        Toggle the packages <b>{u.name}</b> is enrolled in (patient is notified on each enrollment):
                      </div>
                      {packages.length === 0 ? (
                        <div className="muted">No packages have been published yet — create some under <b>Manage Packages</b>.</div>
                      ) : (
                        <div className="chip-grid">
                          {packages.map((p) => {
                            const enrolled = (u.enrolledPackageIds || []).includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                className={'chip' + (enrolled ? ' active' : '')}
                                onClick={() => toggleEnroll(u, p.id)}
                                title={p.tagline}
                              >
                                {p.coverEmoji} {p.title}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

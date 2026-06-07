// Packages page.
// - PATIENT: shows only the package(s) the patient is actually enrolled in
//   (set by the admin from the Manage Users screen). This is "your treatment
//   package details", not a catalogue.
// - ADMIN / DOCTOR (if they ever land here): shows the full catalogue.

import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function Packages() {
  const { user } = useAuth();
  const [all, setAll] = useState([]);

  useEffect(() => { api.get('/packages').then(setAll); }, []);

  const isPatient = user.role === 'patient';
  // For patients, filter down to only the enrolled package IDs on the user.
  const enrolledIds = new Set(user.enrolledPackageIds || []);
  const visible = isPatient ? all.filter((p) => enrolledIds.has(p.id)) : all;

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>{isPatient ? 'Your treatment package' : 'Wellness packages'}</h1>
          <p className="muted">
            {isPatient
              ? 'Details of the programme(s) the centre has enrolled you in.'
              : 'All packages currently published by the centre.'}
          </p>
        </div>
      </header>

      {visible.length === 0 ? (
        <section className="card">
          <p className="muted">
            {isPatient
              ? "You haven't been enrolled in any package yet. Please contact the centre admin or your doctor."
              : 'No packages have been published yet.'}
          </p>
          {isPatient && (
            <Link to="/requests" className="btn-primary" style={{ marginTop: 8, display: 'inline-block' }}>
              Raise a request
            </Link>
          )}
        </section>
      ) : (
        <div className="package-grid big">
          {visible.map((p) => (
            <article key={p.id} className="package-card">
              <div className="pkg-emoji xl">{p.coverEmoji}</div>
              <div style={{ flex: 1 }}>
                <h3 style={{ margin: '0 0 4px' }}>{p.title}</h3>
                <p className="muted" style={{ marginTop: 0 }}>{p.tagline}</p>
                <div className="pkg-meta">
                  {p.durationDays && <span>📅 {p.durationDays} days</span>}
                  {p.priceINR && <span>₹ {p.priceINR.toLocaleString('en-IN')}</span>}
                </div>
                {p.idealFor && <p style={{ marginBottom: 4 }}><b>Ideal for:</b> {p.idealFor}</p>}
                {p.includes?.length > 0 && (
                  <>
                    <div className="muted small" style={{ marginTop: 6 }}>What's included</div>
                    <ul style={{ margin: '4px 0 0 18px', padding: 0 }}>
                      {p.includes.map((x, i) => <li key={i}>{x}</li>)}
                    </ul>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

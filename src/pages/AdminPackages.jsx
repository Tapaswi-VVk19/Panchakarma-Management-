// Admin CRUD for wellness packages (the "special blog" patients see).

import React, { useEffect, useState } from 'react';
import { api } from '../api/client.js';

const EMOJIS = ['🌿', '💆', '🦴', '☘️', '🪷', '🌸', '🔥', '💧', '🌞'];

const EMPTY = () => ({
  title: '',
  tagline: '',
  durationDays: '',
  priceINR: '',
  includes: [],
  idealFor: '',
  coverEmoji: '🌿',
});

export default function AdminPackages() {
  const [packages, setPackages] = useState([]);
  const [draft, setDraft] = useState(EMPTY());
  const [editingId, setEditingId] = useState(null);
  const [includeInput, setIncludeInput] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { refresh(); }, []);
  function refresh() { api.get('/packages').then(setPackages); }

  function startEdit(p) {
    setEditingId(p.id);
    setDraft({
      title: p.title,
      tagline: p.tagline,
      durationDays: p.durationDays || '',
      priceINR: p.priceINR || '',
      includes: p.includes || [],
      idealFor: p.idealFor || '',
      coverEmoji: p.coverEmoji || '🌿',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function reset() {
    setEditingId(null);
    setDraft(EMPTY());
    setIncludeInput('');
  }

  function addInclude() {
    const v = includeInput.trim();
    if (!v) return;
    setDraft((d) => ({ ...d, includes: [...d.includes, v] }));
    setIncludeInput('');
  }
  function removeInclude(i) {
    setDraft((d) => ({ ...d, includes: d.includes.filter((_, idx) => idx !== i) }));
  }

  async function save(e) {
    e.preventDefault();
    if (!draft.title.trim() || !draft.tagline.trim()) {
      setMessage('✗ Title and tagline are required.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (editingId) {
        await api.patch(`/packages/${editingId}`, draft);
        setMessage('✓ Package updated.');
      } else {
        await api.post('/packages', draft);
        setMessage('✓ Package published.');
      }
      reset();
      refresh();
    } catch (e2) {
      setMessage('✗ ' + e2.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(p) {
    if (!confirm(`Delete "${p.title}"?`)) return;
    try {
      await api.del(`/packages/${p.id}`);
      refresh();
      if (editingId === p.id) reset();
    } catch (e) {
      setMessage('✗ ' + e.message);
    }
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Wellness packages</h1>
          <p className="muted">Publish the treatment packages that patients can browse from their dashboard.</p>
        </div>
      </header>

      {message && <div className="info-banner">{message}</div>}

      <section className="card">
        <h3>{editingId ? 'Edit package' : 'New package'}</h3>
        <form onSubmit={save} className="form-grid">
          <label>
            Cover emoji
            <select value={draft.coverEmoji} onChange={(e) => setDraft({ ...draft, coverEmoji: e.target.value })}>
              {EMOJIS.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label>
            Title
            <input type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} required />
          </label>
          <label className="span-2">
            Tagline
            <input type="text" value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} required />
          </label>
          <label>
            Duration (days)
            <input type="number" min={1} value={draft.durationDays} onChange={(e) => setDraft({ ...draft, durationDays: e.target.value })} />
          </label>
          <label>
            Price (INR)
            <input type="number" min={0} value={draft.priceINR} onChange={(e) => setDraft({ ...draft, priceINR: e.target.value })} />
          </label>
          <label className="span-2">
            Ideal for
            <input type="text" value={draft.idealFor} onChange={(e) => setDraft({ ...draft, idealFor: e.target.value })} placeholder="e.g. Chronic stress, sleep issues" />
          </label>

          <div className="span-2">
            <div className="muted small" style={{ marginBottom: 6 }}>What's included</div>
            <div className="chip-grid">
              {draft.includes.map((x, i) => (
                <span key={i} className="chip active" style={{ cursor: 'default' }}>
                  {x}<button className="chip-x" onClick={() => removeInclude(i)} type="button">×</button>
                </span>
              ))}
            </div>
            <div className="row" style={{ marginTop: 8, gap: 8 }}>
              <input
                type="text"
                placeholder="e.g. Daily Abhyanga"
                value={includeInput}
                onChange={(e) => setIncludeInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addInclude(); } }}
              />
              <button className="btn-ghost" type="button" onClick={addInclude}>Add</button>
            </div>
          </div>

          <div className="span-2 row" style={{ gap: 10 }}>
            <button className="btn-primary" disabled={busy}>
              {busy ? 'Saving…' : editingId ? 'Update package' : 'Publish package'}
            </button>
            {editingId && (
              <button type="button" className="btn-ghost" onClick={reset}>Cancel edit</button>
            )}
          </div>
        </form>
      </section>

      <section className="card">
        <h3>Published packages ({packages.length})</h3>
        {packages.length === 0 && <p className="muted">No packages yet.</p>}
        <div className="package-grid">
          {packages.map((p) => (
            <article key={p.id} className="package-card">
              <div className="pkg-emoji">{p.coverEmoji}</div>
              <div style={{ flex: 1 }}>
                <div className="pkg-title">{p.title}</div>
                <div className="muted small">{p.tagline}</div>
                <div className="pkg-meta">
                  {p.durationDays && <span>📅 {p.durationDays} days</span>}
                  {p.priceINR && <span>₹ {p.priceINR.toLocaleString('en-IN')}</span>}
                </div>
                {p.includes?.length > 0 && (
                  <ul style={{ margin: '6px 0 0 16px', padding: 0, fontSize: 13 }}>
                    {p.includes.map((x, i) => <li key={i}>{x}</li>)}
                  </ul>
                )}
                <div className="row" style={{ marginTop: 8, gap: 8 }}>
                  <button className="btn-ghost" onClick={() => startEdit(p)}>Edit</button>
                  <button className="btn-ghost danger" onClick={() => remove(p)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';
import { formatDateTime } from '../utils/constants.js';

export default function Notifications() {
  const { user } = useAuth();
  const [list, setList] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 10000);
    return () => clearInterval(t);
  }, [user.id]);

  function refresh() {
    api.get(`/notifications?userId=${user.id}`).then(setList);
  }

  async function markRead(id) {
    await api.patch(`/notifications/${id}/read`);
    refresh();
  }

  async function markAll() {
    await api.patch('/notifications/read-all', { userId: user.id });
    refresh();
  }

  const filtered = list.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.kind === filter;
  });

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <h1>Notifications</h1>
          <p className="muted">Pre- &amp; post-procedure precautions plus scheduling alerts.</p>
        </div>
        <button className="btn-ghost" onClick={markAll}>Mark all read</button>
      </header>

      <div className="filter-bar">
        {['all', 'unread', 'emergency', 'pre', 'post', 'reminder', 'system'].map((k) => (
          <button
            key={k}
            className={'chip' + (filter === k ? ' active' : '')}
            onClick={() => setFilter(k)}
          >
            {k}
          </button>
        ))}
      </div>

      <ul className="notif-list big">
        {filtered.length === 0 && <p className="muted">Nothing here yet.</p>}
        {filtered.map((n) => (
          <li
            key={n.id}
            className={
              'notif-item' +
              (n.read ? '' : ' unread') +
              (n.kind === 'emergency' ? ' emergency' : '')
            }
          >
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <div className="notif-title">{n.title}</div>
              <span className={`kind-pill kind-${n.kind || 'system'}`}>{n.kind || 'system'}</span>
            </div>
            <pre className="notif-body">{n.body}</pre>
            <div className="row" style={{ justifyContent: 'space-between' }}>
              <span className="muted small">{formatDateTime(n.createdAt)}</span>
              <span className="muted small">
                via {channelLabels(n.channels)}
              </span>
              {!n.read && (
                <button className="btn-ghost" onClick={() => markRead(n.id)}>Mark read</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function channelLabels(ch) {
  if (!ch) return 'in-app';
  const arr = [];
  if (ch.inApp) arr.push('in-app');
  if (ch.sms) arr.push('SMS');
  if (ch.email) arr.push('email');
  return arr.join(', ') || 'in-app';
}

import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { api } from '../api/client.js';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [pendingReq, setPendingReq] = useState(0);

  const isPatient = user.role === 'patient';
  const isDoctor = user.role === 'practitioner';
  const isAdmin = user.role === 'admin';

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const list = await api.get(`/notifications?userId=${user.id}`);
        if (mounted) setUnread(list.filter((n) => !n.read).length);

        // For doctors/admin, also surface the count of pending requests.
        if (isDoctor || isAdmin) {
          const q = isAdmin ? '?status=pending' : `?doctorId=${user.id}&status=pending`;
          const reqs = await api.get(`/appointment-requests${q}`);
          if (mounted) setPendingReq(reqs.length);
        }
      } catch {
        /* ignore */
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [user.id, isDoctor, isAdmin]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="logo">☘</span>
          <div>
            <div className="brand-title">Panchakarma</div>
            <div className="brand-sub">Management Suite</div>
          </div>
        </div>

        <nav>
          <NavItem to="/" icon="🏠" label="Dashboard" />

          {/* Doctors & admins can schedule directly; patients see the request form instead. */}
          {!isPatient && <NavItem to="/schedule" icon="🗓️" label="Schedule" />}
          {isPatient && <NavItem to="/requests" icon="📨" label="Request appointment" />}

          {/* Unified patient operations for doctors/admin. */}
          {(isDoctor || isAdmin) && (
            <>
              <NavItem to="/patients" icon="👥" label="Patient Management" />
              <NavItem to="/inbox" icon="📥" label="Request Inbox" badge={pendingReq} />
            </>
          )}

          {/* Admin-only management entries. */}
          {isAdmin && (
            <>
              <NavItem to="/admin/users" icon="🧑‍⚕️" label="Manage Users" />
              <NavItem to="/admin/packages" icon="📦" label="Manage Packages" />
            </>
          )}

          <NavItem to="/notifications" icon="🔔" label="Notifications" badge={unread} />
          <NavItem to="/progress" icon="📈" label="Progress" />

          {/* Packages page is meaningful only to patients (browsing what's
              available). Admins manage them under "Manage Packages"; doctors
              don't need this entry at all, so we hide it from them. */}
          {isPatient && <NavItem to="/packages" icon="🌿" label="Packages" />}

          {isPatient && <NavItem to="/feedback" icon="📝" label="Feedback" />}

          <NavItem to="/settings" icon="⚙️" label="Settings" />
        </nav>

        <div className="user-card">
          <div className="avatar">{initials(user.name)}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
          <button
            className="btn-ghost"
            onClick={() => {
              logout();
              navigate('/');
            }}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="content">{children}</main>
    </div>
  );
}

function NavItem({ to, icon, label, badge }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
    >
      <span className="nav-icon">{icon}</span>
      <span>{label}</span>
      {badge ? <span className="nav-badge">{badge}</span> : null}
    </NavLink>
  );
}

function initials(name) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

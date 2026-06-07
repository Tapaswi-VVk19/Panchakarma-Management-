import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import Login from './pages/Login.jsx';
import PatientDashboard from './pages/PatientDashboard.jsx';
import PractitionerDashboard from './pages/PractitionerDashboard.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Schedule from './pages/Schedule.jsx';
import Notifications from './pages/Notifications.jsx';
import Progress from './pages/Progress.jsx';
import Feedback from './pages/Feedback.jsx';
import Settings from './pages/Settings.jsx';
import PatientManagement from './pages/PatientManagement.jsx';
import PatientRequests from './pages/PatientRequests.jsx';
import DoctorRequests from './pages/DoctorRequests.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import AdminPackages from './pages/AdminPackages.jsx';
import Packages from './pages/Packages.jsx';

export default function App() {
  const { user } = useAuth();

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    );
  }

  const isPatient = user.role === 'patient';
  const isDoctor = user.role === 'practitioner';
  const isAdmin = user.role === 'admin';

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />

        {/* Schedule page — doctors & admin only (patients see a redirect inside). */}
        <Route path="/schedule" element={<Schedule />} />

        {/* Notifications & progress — everyone. */}
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/progress" element={<Progress />} />

        {/* Feedback — patients only. */}
        {isPatient && <Route path="/feedback" element={<Feedback />} />}

        {/* Patient self-service: request an appointment from the assigned doctor. */}
        {isPatient && <Route path="/requests" element={<PatientRequests />} />}

        {/* Read-only packages "blog" — visible to all logged-in users. */}
        <Route path="/packages" element={<Packages />} />

        {/* Doctor & admin: unified Patient Management (reassign/reschedule/diet/emergency). */}
        {(isDoctor || isAdmin) && <Route path="/patients" element={<PatientManagement />} />}

        {/* Doctor & admin: review patient appointment requests. */}
        {(isDoctor || isAdmin) && <Route path="/inbox" element={<DoctorRequests />} />}

        {/* Admin-only: user & package management. */}
        {isAdmin && <Route path="/admin/users" element={<AdminUsers />} />}
        {isAdmin && <Route path="/admin/packages" element={<AdminPackages />} />}

        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function Home() {
  const { user } = useAuth();
  if (user.role === 'patient') return <PatientDashboard />;
  if (user.role === 'practitioner') return <PractitionerDashboard />;
  return <AdminDashboard />;
}

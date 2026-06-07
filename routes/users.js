import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db, save } from '../services/db.js';
import { httpErr } from '../services/scheduler.js';
import { emitNotification } from '../services/notificationScheduler.js';

const router = Router();

router.get('/', (req, res) => {
  const { role, assignedDoctorId } = req.query;
  let users = db().users;
  if (role) users = users.filter((u) => u.role === role);
  if (assignedDoctorId) users = users.filter((u) => u.assignedDoctorId === assignedDoctorId);
  res.json(users.map(({ password, ...rest }) => rest));
});

router.get('/:id', (req, res) => {
  const u = db().users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const { password, ...rest } = u;
  res.json(rest);
});

router.patch('/:id/channels', (req, res) => {
  const u = db().users.find((x) => x.id === req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  u.channels = { ...u.channels, ...(req.body || {}) };
  save();
  const { password, ...rest } = u;
  res.json(rest);
});

// Admin can create a new user (patient or practitioner). When a patient is
// created, the admin must (or may) immediately assign them a primary doctor.
router.post('/', (req, res, next) => {
  try {
    const data = db();
    const { name, email, password, role, phone, assignedDoctorId } = req.body || {};
    if (!name || !email || !password || !role) {
      throw httpErr(400, 'name, email, password and role are required');
    }
    if (!['patient', 'practitioner', 'admin'].includes(role)) {
      throw httpErr(400, 'Invalid role');
    }
    if (data.users.some((u) => u.email.toLowerCase() === String(email).toLowerCase())) {
      throw httpErr(400, 'A user with that email already exists');
    }
    if (role === 'patient' && assignedDoctorId) {
      const doc = data.users.find((u) => u.id === assignedDoctorId && u.role === 'practitioner');
      if (!doc) throw httpErr(400, 'Assigned doctor not found');
    }
    const prefix = role === 'patient' ? 'u_pat_' : role === 'practitioner' ? 'u_doc_' : 'u_adm_';
    const user = {
      id: prefix + nanoid(6),
      name,
      email,
      password,
      role,
      phone: phone || '',
      channels: { inApp: true, sms: !!phone, email: true },
      ...(role === 'patient'
        ? { assignedDoctorId: assignedDoctorId || null, enrolledPackageIds: [] }
        : {}),
    };
    data.users.push(user);
    save();

    // Welcome notification (works for patient + doctor alike).
    emitNotification(
      user.id,
      'Welcome to the Panchakarma Centre',
      role === 'patient'
        ? `Your account has been created. ${assignedDoctorId
            ? `You have been assigned to ${data.users.find((u) => u.id === assignedDoctorId).name}.`
            : ''}`
        : 'Your practitioner account is now active.',
      { kind: 'system' },
    );
    // If a patient was assigned, also let the doctor know.
    if (role === 'patient' && assignedDoctorId) {
      emitNotification(
        assignedDoctorId,
        'New patient assigned to you',
        `${name} has been added to your care list.`,
        { kind: 'system' },
      );
    }

    const { password: _pw, ...safe } = user;
    res.status(201).json(safe);
  } catch (e) {
    next(e);
  }
});

// Admin updates user profile (used to (re)assign a patient to a doctor).
router.patch('/:id', (req, res, next) => {
  try {
    const data = db();
    const u = data.users.find((x) => x.id === req.params.id);
    if (!u) throw httpErr(404, 'Not found');
    const { name, email, phone, password, assignedDoctorId, enrolledPackageIds } = req.body || {};
    if (name !== undefined) u.name = name;
    if (email !== undefined) u.email = email;
    if (phone !== undefined) u.phone = phone;
    if (password) u.password = password;
    if (u.role === 'patient' && assignedDoctorId !== undefined) {
      if (assignedDoctorId) {
        const doc = data.users.find((x) => x.id === assignedDoctorId && x.role === 'practitioner');
        if (!doc) throw httpErr(400, 'Doctor not found');
      }
      const changed = u.assignedDoctorId !== assignedDoctorId;
      u.assignedDoctorId = assignedDoctorId || null;
      if (changed && assignedDoctorId) {
        emitNotification(u.id, 'Your assigned doctor has changed', `You are now under the care of ${data.users.find((d) => d.id === assignedDoctorId).name}.`, { kind: 'system' });
        emitNotification(assignedDoctorId, 'New patient assigned', `${u.name} has been assigned to you.`, { kind: 'system' });
      }
    }
    if (u.role === 'patient' && enrolledPackageIds !== undefined) {
      const before = new Set(u.enrolledPackageIds || []);
      const after = new Set(
        Array.isArray(enrolledPackageIds)
          ? enrolledPackageIds.filter((id) => data.packages.find((p) => p.id === id))
          : [],
      );
      u.enrolledPackageIds = Array.from(after);
      // Notify patient about each newly added package so they know the centre
      // has enrolled them into a programme.
      for (const newId of after) {
        if (!before.has(newId)) {
          const pkg = data.packages.find((p) => p.id === newId);
          emitNotification(
            u.id,
            'You have been enrolled in a wellness package',
            `${pkg.title}\n\n${pkg.tagline}\n\nOpen the Packages page to view full details.`,
            { kind: 'system' },
          );
        }
      }
    }
    save();
    const { password: _pw, ...safe } = u;
    res.json(safe);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const data = db();
    const i = data.users.findIndex((x) => x.id === req.params.id);
    if (i === -1) throw httpErr(404, 'Not found');
    const [removed] = data.users.splice(i, 1);
    save();
    const { password: _pw, ...safe } = removed;
    res.json(safe);
  } catch (e) {
    next(e);
  }
});

export default router;

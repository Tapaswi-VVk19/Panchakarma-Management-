import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db, save } from '../services/db.js';
import { autoScheduleCourse, httpErr } from '../services/scheduler.js';
import { emitNotification } from '../services/notificationScheduler.js';

const router = Router();

// List, optionally filtered.
router.get('/', (req, res) => {
  const { patientId, practitionerId, status } = req.query;
  let list = db().sessions.slice();
  if (patientId) list = list.filter((s) => s.patientId === patientId);
  if (practitionerId) list = list.filter((s) => s.practitionerId === practitionerId);
  if (status) list = list.filter((s) => s.status === status);
  list.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  res.json(list);
});

router.get('/:id', (req, res) => {
  const s = db().sessions.find((x) => x.id === req.params.id);
  if (!s) return res.status(404).json({ error: 'Not found' });
  res.json(s);
});

// Create a single session.
// IMPORTANT: patients are not allowed to self-book any more. They must raise
// an "appointment request" instead (see routes/appointmentRequests.js).
// We enforce this by requiring `bookedBy` to be a practitioner or admin.
router.post('/', (req, res, next) => {
  try {
    const { patientId, practitionerId, therapyId, startAt, notes, bookedBy } = req.body || {};
    if (!patientId || !practitionerId || !therapyId || !startAt) {
      throw httpErr(400, 'Missing required fields');
    }
    if (!bookedBy) throw httpErr(400, 'bookedBy (user id) is required');
    const booker = db().users.find((u) => u.id === bookedBy);
    if (!booker || (booker.role !== 'practitioner' && booker.role !== 'admin')) {
      throw httpErr(403, 'Only doctors or admins can book sessions. Patients must submit an appointment request.');
    }
    const data = db();
    if (!data.users.find((u) => u.id === patientId)) throw httpErr(400, 'Unknown patient');
    if (!data.users.find((u) => u.id === practitionerId)) throw httpErr(400, 'Unknown practitioner');
    if (!data.therapies.find((t) => t.id === therapyId)) throw httpErr(400, 'Unknown therapy');

    const sess = {
      id: 's_' + nanoid(8),
      patientId,
      practitionerId,
      therapyId,
      startAt: new Date(startAt).toISOString(),
      status: 'scheduled',
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };
    data.sessions.push(sess);
    save();
    emitNotification(
      patientId,
      'New session scheduled',
      `Your ${data.therapies.find((t) => t.id === therapyId).name} session is booked for ${new Date(sess.startAt).toLocaleString()}.`,
      { sessionId: sess.id, kind: 'reminder' },
    );
    res.status(201).json(sess);
  } catch (e) {
    next(e);
  }
});

// Auto-schedule a multi-session course based on therapy cadence.
router.post('/auto', (req, res, next) => {
  try {
    const { bookedBy } = req.body || {};
    if (!bookedBy) throw httpErr(400, 'bookedBy (user id) is required');
    const booker = db().users.find((u) => u.id === bookedBy);
    if (!booker || (booker.role !== 'practitioner' && booker.role !== 'admin')) {
      throw httpErr(403, 'Only doctors or admins can book a course. Patients must submit an appointment request.');
    }
    const created = autoScheduleCourse(req.body || {});
    const data = db();
    const therapy = data.therapies.find((t) => t.id === created[0].therapyId);
    emitNotification(
      created[0].patientId,
      `Course scheduled: ${therapy.name}`,
      `${created.length} session(s) auto-scheduled starting ${new Date(created[0].startAt).toLocaleString()}.`,
      { kind: 'reminder' },
    );
    res.status(201).json(created);
  } catch (e) {
    next(e);
  }
});

// Reschedule / cancel / complete.
router.patch('/:id', (req, res, next) => {
  try {
    const data = db();
    const s = data.sessions.find((x) => x.id === req.params.id);
    if (!s) throw httpErr(404, 'Not found');
    const { startAt, status, notes } = req.body || {};
    if (startAt) {
      s.startAt = new Date(startAt).toISOString();
      s.status = 'rescheduled';
      emitNotification(s.patientId, 'Session rescheduled', `New time: ${new Date(s.startAt).toLocaleString()}`, {
        sessionId: s.id,
        kind: 'reminder',
      });
    }
    if (status) s.status = status;
    if (notes !== undefined) s.notes = notes;
    save();
    res.json(s);
  } catch (e) {
    next(e);
  }
});

// Reassign a session (or a whole batch of upcoming sessions for one patient)
// to a different practitioner. Used by the doctor's Patient Management page
// when they are unavailable and need to hand off care.
router.post('/reassign', (req, res, next) => {
  try {
    const data = db();
    const { sessionIds, patientId, fromPractitionerId, toPractitionerId, reason } = req.body || {};
    if (!toPractitionerId) throw httpErr(400, 'toPractitionerId required');
    if (!data.users.find((u) => u.id === toPractitionerId && u.role === 'practitioner')) {
      throw httpErr(400, 'Target practitioner not found');
    }

    let affected = [];
    if (Array.isArray(sessionIds) && sessionIds.length > 0) {
      affected = data.sessions.filter((s) => sessionIds.includes(s.id));
    } else if (patientId && fromPractitionerId) {
      // Reassign every upcoming session for this patient currently held by
      // the unavailable doctor.
      const now = Date.now();
      affected = data.sessions.filter(
        (s) =>
          s.patientId === patientId &&
          s.practitionerId === fromPractitionerId &&
          ['scheduled', 'rescheduled'].includes(s.status) &&
          new Date(s.startAt).getTime() > now,
      );
    } else {
      throw httpErr(400, 'Provide sessionIds[] or both patientId & fromPractitionerId');
    }

    if (affected.length === 0) {
      return res.json({ updated: [], message: 'No matching upcoming sessions to reassign.' });
    }

    const toDoc = data.users.find((u) => u.id === toPractitionerId);
    for (const s of affected) {
      s.practitionerId = toPractitionerId;
      // Note the handoff in the session for the audit trail.
      const stamp = new Date().toLocaleString();
      s.notes = (s.notes ? s.notes + '\n' : '') +
        `[${stamp}] Reassigned to ${toDoc.name}${reason ? ' — ' + reason : ''}`;
    }
    save();

    // Notify each affected patient once per patient (in case the batch spans
    // multiple patients in the future).
    const byPatient = new Map();
    for (const s of affected) {
      if (!byPatient.has(s.patientId)) byPatient.set(s.patientId, []);
      byPatient.get(s.patientId).push(s);
    }
    for (const [pid, list] of byPatient) {
      emitNotification(
        pid,
        `Your practitioner has been updated`,
        `${list.length} upcoming session(s) reassigned to ${toDoc.name}.` +
          (reason ? `\nReason: ${reason}` : ''),
        { kind: 'reminder' },
      );
    }

    res.json({ updated: affected, message: `Reassigned ${affected.length} session(s) to ${toDoc.name}.` });
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const data = db();
    const s = data.sessions.find((x) => x.id === req.params.id);
    if (!s) throw httpErr(404, 'Not found');
    s.status = 'cancelled';
    save();
    emitNotification(s.patientId, 'Session cancelled', `Your session on ${new Date(s.startAt).toLocaleString()} was cancelled.`, {
      sessionId: s.id,
      kind: 'reminder',
    });
    res.json(s);
  } catch (e) {
    next(e);
  }
});

export default router;

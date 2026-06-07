// Patient-initiated appointment requests.
// Flow: patient submits issue → doctor (and admin) get notified → doctor either
// ACCEPTS (which creates a real session) or REJECTS (with an optional reason).
// Pure JavaScript — no TS.

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db, save } from '../services/db.js';
import { httpErr } from '../services/scheduler.js';
import { emitNotification } from '../services/notificationScheduler.js';

const router = Router();

router.get('/', (req, res) => {
  const { patientId, doctorId, status } = req.query;
  let list = db().appointmentRequests.slice();
  if (patientId) list = list.filter((r) => r.patientId === patientId);
  if (doctorId) list = list.filter((r) => r.doctorId === doctorId);
  if (status) list = list.filter((r) => r.status === status);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

// Patient creates a request.
router.post('/', (req, res, next) => {
  try {
    const data = db();
    const { patientId, reason, urgency, preferredAt, therapyId } = req.body || {};
    if (!patientId || !reason) throw httpErr(400, 'patientId and reason are required');
    const patient = data.users.find((u) => u.id === patientId && u.role === 'patient');
    if (!patient) throw httpErr(400, 'Patient not found');
    if (!patient.assignedDoctorId) {
      throw httpErr(400, 'You have no assigned doctor yet. Please contact the centre admin.');
    }
    const allowed = ['low', 'normal', 'high'];
    const u = allowed.includes(urgency) ? urgency : 'normal';

    const reqDoc = {
      id: 'r_' + nanoid(8),
      patientId,
      doctorId: patient.assignedDoctorId,
      reason: String(reason).trim(),
      urgency: u,
      preferredAt: preferredAt ? new Date(preferredAt).toISOString() : null,
      therapyId: therapyId || null,
      status: 'pending', // pending | accepted | rejected
      decisionNote: '',
      sessionId: null,
      createdAt: new Date().toISOString(),
      decidedAt: null,
    };
    data.appointmentRequests.push(reqDoc);
    save();

    // Notify the doctor (and admins, if any).
    emitNotification(
      patient.assignedDoctorId,
      `New appointment request${u === 'high' ? ' (HIGH urgency)' : ''}`,
      `From: ${patient.name}\nIssue: ${reqDoc.reason}${
        preferredAt ? `\nPreferred: ${new Date(preferredAt).toLocaleString()}` : ''
      }`,
      { kind: 'reminder' },
    );
    for (const admin of data.users.filter((x) => x.role === 'admin')) {
      emitNotification(
        admin.id,
        'New appointment request from a patient',
        `${patient.name} → ${reqDoc.reason}`,
        { kind: 'system' },
      );
    }

    // Confirm to the patient.
    emitNotification(
      patientId,
      'Your appointment request was received',
      'Your doctor will review it shortly. You will be notified of the decision.',
      { kind: 'system' },
    );

    res.status(201).json(reqDoc);
  } catch (e) {
    next(e);
  }
});

// Doctor decides on a request.
//   action: 'accept' | 'reject'
//   For 'accept': { startAt, therapyId } create a real session.
router.post('/:id/decision', (req, res, next) => {
  try {
    const data = db();
    const r = data.appointmentRequests.find((x) => x.id === req.params.id);
    if (!r) throw httpErr(404, 'Request not found');
    if (r.status !== 'pending') throw httpErr(400, 'Request already decided');

    const { action, startAt, therapyId, note } = req.body || {};
    if (!['accept', 'reject'].includes(action)) throw httpErr(400, 'action must be accept or reject');

    if (action === 'reject') {
      r.status = 'rejected';
      r.decisionNote = note || '';
      r.decidedAt = new Date().toISOString();
      save();
      emitNotification(
        r.patientId,
        'Your appointment request was declined',
        note
          ? `Reason: ${note}\n\nPlease contact the centre for next steps.`
          : 'Please contact the centre for next steps.',
        { kind: 'system' },
      );
      return res.json(r);
    }

    // Accept → create a real session and link it back.
    const finalTherapyId = therapyId || r.therapyId;
    if (!startAt || !finalTherapyId) {
      throw httpErr(400, 'startAt and therapyId are required to accept');
    }
    if (!data.therapies.find((t) => t.id === finalTherapyId)) {
      throw httpErr(400, 'Unknown therapy');
    }

    const sess = {
      id: 's_' + nanoid(8),
      patientId: r.patientId,
      practitionerId: r.doctorId,
      therapyId: finalTherapyId,
      startAt: new Date(startAt).toISOString(),
      status: 'scheduled',
      notes: `Booked from patient request: "${r.reason}"`,
      createdAt: new Date().toISOString(),
    };
    data.sessions.push(sess);

    r.status = 'accepted';
    r.decisionNote = note || '';
    r.decidedAt = new Date().toISOString();
    r.sessionId = sess.id;
    save();

    emitNotification(
      r.patientId,
      'Your appointment request was approved',
      `A ${data.therapies.find((t) => t.id === finalTherapyId).name} session has been booked for ${new Date(sess.startAt).toLocaleString()}.${
        note ? `\n\nNote from doctor: ${note}` : ''
      }`,
      { kind: 'reminder', sessionId: sess.id },
    );

    res.json({ request: r, session: sess });
  } catch (e) {
    next(e);
  }
});

export default router;

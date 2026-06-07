import { Router } from 'express';
import { db, save } from '../services/db.js';
import { emitNotification } from '../services/notificationScheduler.js';
import { httpErr } from '../services/scheduler.js';

const router = Router();

// Doctor / admin pushes an EMERGENCY alert to a patient (or to all patients
// under their care). Marked with kind:'emergency' so the UI can style it red.
router.post('/emergency', (req, res, next) => {
  try {
    const data = db();
    const { fromUserId, patientId, title, message } = req.body || {};
    if (!fromUserId || !title || !message) {
      throw httpErr(400, 'fromUserId, title and message are required');
    }
    const from = data.users.find((u) => u.id === fromUserId);
    if (!from || (from.role !== 'practitioner' && from.role !== 'admin')) {
      throw httpErr(403, 'Only doctors or admins can send emergency alerts');
    }

    let recipients = [];
    if (patientId) {
      const p = data.users.find((u) => u.id === patientId && u.role === 'patient');
      if (!p) throw httpErr(400, 'Patient not found');
      recipients = [p];
    } else if (from.role === 'practitioner') {
      recipients = data.users.filter((u) => u.role === 'patient' && u.assignedDoctorId === from.id);
    } else {
      recipients = data.users.filter((u) => u.role === 'patient');
    }

    const sent = recipients.map((r) =>
      emitNotification(
        r.id,
        `🚨 EMERGENCY: ${title}`,
        `${message}\n\n— from ${from.name}`,
        { kind: 'emergency' },
      ),
    );
    res.json({ sent: sent.length });
  } catch (e) {
    next(e);
  }
});

router.get('/', (req, res) => {
  const { userId } = req.query;
  let list = db().notifications.slice();
  if (userId) list = list.filter((n) => n.userId === userId);
  list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(list);
});

router.patch('/:id/read', (req, res) => {
  const n = db().notifications.find((x) => x.id === req.params.id);
  if (!n) return res.status(404).json({ error: 'Not found' });
  n.read = true;
  save();
  res.json(n);
});

router.patch('/read-all', (req, res) => {
  const { userId } = req.body || {};
  db().notifications.forEach((n) => {
    if (!userId || n.userId === userId) n.read = true;
  });
  save();
  res.json({ ok: true });
});

export default router;

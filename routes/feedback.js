// Integrated feedback loop. Submitting feedback can:
//  • Mark the related session 'completed' (if still scheduled),
//  • Auto-push back upcoming sessions when fatigue >= 7,
//  • Send a thank-you notification.

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db, save } from '../services/db.js';
import { emitNotification } from '../services/notificationScheduler.js';
import { httpErr } from '../services/scheduler.js';

const router = Router();

const DAY = 24 * 60 * 60 * 1000;

router.get('/', (req, res) => {
  const { patientId, sessionId } = req.query;
  let list = db().feedback.slice();
  if (patientId) list = list.filter((f) => f.patientId === patientId);
  if (sessionId) list = list.filter((f) => f.sessionId === sessionId);
  list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  res.json(list);
});

router.post('/', (req, res, next) => {
  try {
    const data = db();
    const {
      sessionId,
      patientId,
      energy,        // 1–10
      fatigue,       // 1–10
      pain,          // 1–10
      mood,          // 1–10
      sleep,         // 1–10
      sideEffects,   // string[]
      notes,         // string
    } = req.body || {};

    if (!sessionId || !patientId) throw httpErr(400, 'sessionId & patientId required');
    const sess = data.sessions.find((s) => s.id === sessionId);
    if (!sess) throw httpErr(404, 'Session not found');

    const entry = {
      id: 'f_' + nanoid(8),
      sessionId,
      patientId,
      energy: num(energy),
      fatigue: num(fatigue),
      pain: num(pain),
      mood: num(mood),
      sleep: num(sleep),
      wellness: wellnessScore({ energy, fatigue, pain, mood, sleep }),
      sideEffects: Array.isArray(sideEffects) ? sideEffects : [],
      notes: notes || '',
      createdAt: new Date().toISOString(),
    };
    data.feedback.push(entry);

    if (sess.status === 'scheduled' || sess.status === 'rescheduled') {
      sess.status = 'completed';
    }

    // Adaptive rescheduling: if patient reports high fatigue/pain, push the next
    // upcoming session forward by 1 day to allow recovery.
    let adjusted = null;
    if ((entry.fatigue ?? 0) >= 7 || (entry.pain ?? 0) >= 7) {
      const upcoming = data.sessions
        .filter(
          (s) =>
            s.patientId === patientId &&
            s.status !== 'cancelled' &&
            s.status !== 'completed' &&
            new Date(s.startAt).getTime() > Date.now(),
        )
        .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))[0];
      if (upcoming) {
        upcoming.startAt = new Date(new Date(upcoming.startAt).getTime() + DAY).toISOString();
        upcoming.status = 'rescheduled';
        adjusted = upcoming;
        emitNotification(
          patientId,
          'Your next session was pushed back 24 h',
          'Based on your feedback (high fatigue/pain), we shifted your next session by one day so your body can rest.',
          { sessionId: upcoming.id, kind: 'reminder' },
        );
      }
    }

    save();
    emitNotification(patientId, 'Feedback received — thank you!', 'Your therapist has been notified.', {
      sessionId,
      kind: 'system',
    });

    res.status(201).json({ feedback: entry, adjustedSession: adjusted });
  } catch (e) {
    next(e);
  }
});

function num(v) {
  const n = Number(v);
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(10, n));
}

// Higher is better. Weights chosen to be intuitive — tune per clinic policy.
function wellnessScore({ energy = 5, fatigue = 5, pain = 5, mood = 5, sleep = 5 }) {
  const positives = (Number(energy) + Number(mood) + Number(sleep)) / 3;
  const negatives = (Number(fatigue) + Number(pain)) / 2;
  return Number(Math.max(0, Math.min(10, positives - negatives / 2 + 2.5)).toFixed(1));
}

export default router;

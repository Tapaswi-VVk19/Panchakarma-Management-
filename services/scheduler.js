// Auto-scheduling helpers. The protocol cadence drives spacing; the feedback loop
// can later push back individual sessions (see routes/feedback.js).

import { nanoid } from 'nanoid';
import { db, save } from './db.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * Auto-create N sessions for a patient given a therapy.
 * Avoids double-booking the practitioner by stepping forward 30 minutes when busy.
 */
export function autoScheduleCourse({
  patientId,
  practitionerId,
  therapyId,
  startAt,
  count,
}) {
  const data = db();
  const therapy = data.therapies.find((t) => t.id === therapyId);
  if (!therapy) throw httpErr(400, 'Unknown therapy');

  const sessionsToCreate = Math.max(1, Math.min(count ?? therapy.sessionsRecommended, 30));
  const cadence = (therapy.cadenceDays || 1) * DAY;
  const created = [];

  let cursor = new Date(startAt).getTime();
  if (Number.isNaN(cursor)) throw httpErr(400, 'Invalid startAt');

  for (let i = 0; i < sessionsToCreate; i += 1) {
    let when = cursor + i * cadence;
    when = nextFreeSlot(data, practitionerId, when, therapy.durationMinutes || 60);

    const sess = {
      id: 's_' + nanoid(8),
      patientId,
      practitionerId,
      therapyId,
      startAt: new Date(when).toISOString(),
      status: 'scheduled',
      notes: '',
      createdAt: new Date().toISOString(),
    };
    data.sessions.push(sess);
    created.push(sess);
  }

  save();
  return created;
}

function nextFreeSlot(data, practitionerId, whenMs, durationMin) {
  const STEP = 30 * 60 * 1000;
  let candidate = whenMs;
  // Bail-out after 48 hops to avoid runaway loops.
  for (let i = 0; i < 48; i += 1) {
    if (!hasConflict(data, practitionerId, candidate, durationMin)) return candidate;
    candidate += STEP;
  }
  return candidate;
}

function hasConflict(data, practitionerId, whenMs, durationMin) {
  const endMs = whenMs + durationMin * 60 * 1000;
  return data.sessions.some((s) => {
    if (s.practitionerId !== practitionerId) return false;
    if (s.status === 'cancelled') return false;
    const sStart = new Date(s.startAt).getTime();
    const therapy = data.therapies.find((t) => t.id === s.therapyId);
    const sEnd = sStart + (therapy?.durationMinutes || 60) * 60 * 1000;
    return whenMs < sEnd && endMs > sStart;
  });
}

export function httpErr(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

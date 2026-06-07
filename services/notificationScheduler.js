// Background worker that promotes upcoming-session reminders into the
// notifications collection. Runs in-process every 30 seconds for the demo.
// In a real deployment this would be a cron job / queue worker.

import { nanoid } from 'nanoid';
import { db, save } from './db.js';

const PRE_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 h before
const TICK_MS = 30 * 1000;

export function startNotificationScheduler() {
  tick();
  setInterval(tick, TICK_MS);
}

function tick() {
  const data = db();
  const now = Date.now();
  let changed = false;

  for (const s of data.sessions) {
    if (s.status !== 'scheduled') continue;
    const start = new Date(s.startAt).getTime();
    const therapy = data.therapies.find((t) => t.id === s.therapyId);
    if (!therapy) continue;

    // Pre-procedure (24 h prior)
    if (start - now <= PRE_WINDOW_MS && start - now > 0) {
      if (!alreadySent(data, s.id, 'pre')) {
        pushPrecautionNotifications(data, s, therapy, 'pre');
        changed = true;
      }
    }

    // Post-procedure (after session start + duration)
    const endMs = start + (therapy.durationMinutes || 60) * 60 * 1000;
    if (now >= endMs && !alreadySent(data, s.id, 'post')) {
      pushPrecautionNotifications(data, s, therapy, 'post');
      changed = true;
    }
  }

  if (changed) save();
}

function alreadySent(data, sessionId, kind) {
  return data.notifications.some(
    (n) => n.sessionId === sessionId && n.kind === kind && n.system === true,
  );
}

function pushPrecautionNotifications(data, session, therapy, kind) {
  const patient = data.users.find((u) => u.id === session.patientId);
  if (!patient) return;
  const items = kind === 'pre' ? therapy.preCare : therapy.postCare;
  const title =
    kind === 'pre'
      ? `Upcoming: ${therapy.name} — please follow pre-procedure precautions`
      : `${therapy.name} complete — follow post-procedure care`;

  const note = {
    id: 'n_' + nanoid(8),
    userId: patient.id,
    sessionId: session.id,
    kind, // 'pre' | 'post' | 'reminder' | 'system'
    title,
    body: items.map((x) => '• ' + x).join('\n'),
    channels: patient.channels,
    createdAt: new Date().toISOString(),
    read: false,
    system: true,
  };
  data.notifications.push(note);
  dispatch(note, patient);
}

// Stub external channels. Swap with Twilio / SendGrid in production.
function dispatch(note, user) {
  if (note.channels?.sms && user.phone) {
    // eslint-disable-next-line no-console
    console.log(`[SMS → ${user.phone}] ${note.title}`);
  }
  if (note.channels?.email && user.email) {
    // eslint-disable-next-line no-console
    console.log(`[EMAIL → ${user.email}] ${note.title}`);
  }
}

// Exposed so manual scheduling actions can emit ad-hoc notifications too.
export function emitNotification(userId, title, body, extra = {}) {
  const data = db();
  const user = data.users.find((u) => u.id === userId);
  if (!user) return null;
  const note = {
    id: 'n_' + nanoid(8),
    userId,
    title,
    body,
    channels: user.channels,
    createdAt: new Date().toISOString(),
    read: false,
    system: false,
    ...extra,
  };
  data.notifications.push(note);
  dispatch(note, user);
  save();
  return note;
}

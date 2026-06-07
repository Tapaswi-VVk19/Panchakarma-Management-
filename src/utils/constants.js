// TypeScript enums are not used. We export frozen plain-object constants
// to get the same "named-constant" ergonomics with zero TS dependencies.

export const ROLES = Object.freeze({
  PATIENT: 'patient',
  PRACTITIONER: 'practitioner',
  ADMIN: 'admin',
});

export const SESSION_STATUS = Object.freeze({
  SCHEDULED: 'scheduled',
  RESCHEDULED: 'rescheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
});

export const NOTIFICATION_KIND = Object.freeze({
  PRE: 'pre',
  POST: 'post',
  REMINDER: 'reminder',
  SYSTEM: 'system',
});

export function statusColor(status) {
  switch (status) {
    case 'scheduled':
      return '#2563eb';
    case 'rescheduled':
      return '#f59e0b';
    case 'completed':
      return '#16a34a';
    case 'cancelled':
      return '#dc2626';
    default:
      return '#6b7280';
  }
}

export function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

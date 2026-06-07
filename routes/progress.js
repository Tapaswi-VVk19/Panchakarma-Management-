// Aggregates session + feedback data into chart-ready series.

import { Router } from 'express';
import { db } from '../services/db.js';

const router = Router();

router.get('/:patientId', (req, res) => {
  const data = db();
  const { patientId } = req.params;

  const sessions = data.sessions
    .filter((s) => s.patientId === patientId)
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
  const completed = sessions.filter((s) => s.status === 'completed').length;
  const upcoming = sessions.filter((s) => ['scheduled', 'rescheduled'].includes(s.status)).length;
  const total = sessions.length;

  const fb = data.feedback
    .filter((f) => f.patientId === patientId)
    .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
    .map((f) => ({
      date: f.createdAt.slice(0, 10),
      energy: f.energy,
      fatigue: f.fatigue,
      pain: f.pain,
      mood: f.mood,
      sleep: f.sleep,
      wellness: f.wellness,
    }));

  // Personalised milestones based on % completion.
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const milestones = [
    { label: 'Course started', reached: completed >= 1, at: 1 },
    { label: '25% complete', reached: pct >= 25, at: 25 },
    { label: 'Mid-course review', reached: pct >= 50, at: 50 },
    { label: '75% complete', reached: pct >= 75, at: 75 },
    { label: 'Course complete', reached: pct >= 100, at: 100 },
  ];

  res.json({
    patientId,
    counts: { total, completed, upcoming },
    completionPct: pct,
    series: fb,
    milestones,
  });
});

export default router;

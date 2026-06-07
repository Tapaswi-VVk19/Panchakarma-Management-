// Diet-plan CRUD. Practitioners create/update a plan per patient; patients
// can read their own. Pure JavaScript — no TS.

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db, save } from '../services/db.js';
import { emitNotification } from '../services/notificationScheduler.js';
import { httpErr } from '../services/scheduler.js';

const router = Router();

// GET /api/diet-plans?patientId=...   → list (most-recent first)
// GET /api/diet-plans?patientId=...&latest=1 → just the active/latest one
router.get('/', (req, res) => {
  const { patientId, latest } = req.query;
  let list = db().dietPlans.slice();
  if (patientId) list = list.filter((p) => p.patientId === patientId);
  list.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  if (latest) return res.json(list[0] || null);
  res.json(list);
});

router.get('/:id', (req, res) => {
  const p = db().dietPlans.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

// Create a new plan for a patient. If a plan already exists we still allow
// creating another one — the "latest" query returns the most recent.
router.post('/', (req, res, next) => {
  try {
    const data = db();
    const { patientId, practitionerId, title, notes, meals, restrictions } = req.body || {};
    if (!patientId || !practitionerId || !title) {
      throw httpErr(400, 'patientId, practitionerId and title are required');
    }
    if (!data.users.find((u) => u.id === patientId)) throw httpErr(400, 'Unknown patient');
    if (!data.users.find((u) => u.id === practitionerId)) throw httpErr(400, 'Unknown practitioner');

    const plan = {
      id: 'd_' + nanoid(8),
      patientId,
      practitionerId,
      title,
      notes: notes || '',
      meals: sanitizeMeals(meals),
      restrictions: Array.isArray(restrictions) ? restrictions.filter(Boolean) : [],
      updatedAt: new Date().toISOString(),
    };
    data.dietPlans.push(plan);
    save();

    emitNotification(
      patientId,
      'Your diet plan has been updated',
      `${plan.title}\n\nOpen the app to see your new meal schedule.`,
      { kind: 'system' },
    );

    res.status(201).json(plan);
  } catch (e) {
    next(e);
  }
});

// Patch an existing plan in place.
router.patch('/:id', (req, res, next) => {
  try {
    const data = db();
    const plan = data.dietPlans.find((x) => x.id === req.params.id);
    if (!plan) throw httpErr(404, 'Not found');

    const { title, notes, meals, restrictions } = req.body || {};
    if (title !== undefined) plan.title = title;
    if (notes !== undefined) plan.notes = notes;
    if (meals !== undefined) plan.meals = sanitizeMeals(meals);
    if (restrictions !== undefined) {
      plan.restrictions = Array.isArray(restrictions) ? restrictions.filter(Boolean) : [];
    }
    plan.updatedAt = new Date().toISOString();
    save();

    emitNotification(
      plan.patientId,
      'Your diet plan was just updated',
      `${plan.title}\n\nCheck the app for the latest meal schedule and restrictions.`,
      { kind: 'system' },
    );

    res.json(plan);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const data = db();
    const i = data.dietPlans.findIndex((x) => x.id === req.params.id);
    if (i === -1) throw httpErr(404, 'Not found');
    const [removed] = data.dietPlans.splice(i, 1);
    save();
    res.json(removed);
  } catch (e) {
    next(e);
  }
});

function sanitizeMeals(meals) {
  if (!Array.isArray(meals)) return [];
  return meals
    .map((m) => ({
      time: String(m?.time || '').trim(),
      items: String(m?.items || '').trim(),
    }))
    .filter((m) => m.time || m.items);
}

export default router;

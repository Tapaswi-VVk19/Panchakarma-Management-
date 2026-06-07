// Wellness "packages" curated by the admin. Acts as a small CMS / blog that
// patients can browse on their dashboard.

import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db, save } from '../services/db.js';
import { httpErr } from '../services/scheduler.js';

const router = Router();

router.get('/', (_req, res) => {
  const list = db().packages.slice().sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
  res.json(list);
});

router.get('/:id', (req, res) => {
  const p = db().packages.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  res.json(p);
});

router.post('/', (req, res, next) => {
  try {
    const { title, tagline, durationDays, priceINR, includes, idealFor, coverEmoji } = req.body || {};
    if (!title || !tagline) throw httpErr(400, 'title and tagline are required');
    const pkg = {
      id: 'pkg_' + nanoid(8),
      title,
      tagline,
      durationDays: Number(durationDays) || null,
      priceINR: Number(priceINR) || null,
      includes: Array.isArray(includes) ? includes.filter(Boolean) : [],
      idealFor: idealFor || '',
      coverEmoji: coverEmoji || '🌿',
      publishedAt: new Date().toISOString(),
    };
    db().packages.push(pkg);
    save();
    res.status(201).json(pkg);
  } catch (e) {
    next(e);
  }
});

router.patch('/:id', (req, res, next) => {
  try {
    const p = db().packages.find((x) => x.id === req.params.id);
    if (!p) throw httpErr(404, 'Not found');
    const { title, tagline, durationDays, priceINR, includes, idealFor, coverEmoji } = req.body || {};
    if (title !== undefined) p.title = title;
    if (tagline !== undefined) p.tagline = tagline;
    if (durationDays !== undefined) p.durationDays = Number(durationDays) || null;
    if (priceINR !== undefined) p.priceINR = Number(priceINR) || null;
    if (includes !== undefined) p.includes = Array.isArray(includes) ? includes.filter(Boolean) : [];
    if (idealFor !== undefined) p.idealFor = idealFor;
    if (coverEmoji !== undefined) p.coverEmoji = coverEmoji;
    save();
    res.json(p);
  } catch (e) {
    next(e);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const i = db().packages.findIndex((x) => x.id === req.params.id);
    if (i === -1) throw httpErr(404, 'Not found');
    const [removed] = db().packages.splice(i, 1);
    save();
    res.json(removed);
  } catch (e) {
    next(e);
  }
});

export default router;

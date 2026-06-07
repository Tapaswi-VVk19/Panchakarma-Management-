import { Router } from 'express';
import { db } from '../services/db.js';

const router = Router();

router.get('/', (_req, res) => res.json(db().therapies));
router.get('/:id', (req, res) => {
  const t = db().therapies.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).json({ error: 'Not found' });
  res.json(t);
});

export default router;

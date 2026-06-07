// Simple demo auth — returns the user record on a matching email+password.
// In production, replace with hashed passwords + JWTs.

import { Router } from 'express';
import { db } from '../services/db.js';

const router = Router();

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = db().users.find(
    (u) => u.email.toLowerCase() === String(email || '').toLowerCase() && u.password === password,
  );
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const { password: _pw, ...safe } = user;
  res.json({ user: safe });
});

router.get('/demo-accounts', (_req, res) => {
  res.json(
    db().users.map((u) => ({ name: u.name, email: u.email, role: u.role, password: u.password })),
  );
});

export default router;

// Entry point for the Panchakarma backend.
// Pure JavaScript (ES Modules). No TypeScript anywhere.

import express from 'express';
import cors from 'cors';
import { loadDb } from './services/db.js';
import authRoutes from './routes/auth.js';
import sessionRoutes from './routes/sessions.js';
import notificationRoutes from './routes/notifications.js';
import feedbackRoutes from './routes/feedback.js';
import userRoutes from './routes/users.js';
import therapyRoutes from './routes/therapies.js';
import progressRoutes from './routes/progress.js';
import dietPlanRoutes from './routes/dietPlans.js';
import appointmentRequestRoutes from './routes/appointmentRequests.js';
import packageRoutes from './routes/packages.js';
import { startNotificationScheduler } from './services/notificationScheduler.js';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// Friendly root response. This is the API server only — the web UI lives on
// the Vite dev server (default http://localhost:5173). Hitting "/" in a browser
// previously returned Express's default "Cannot GET /" which confused users,
// so we now show a small HTML landing page pointing to the right place.
app.get('/', (_req, res) => {
  res.type('html').send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Panchakarma API</title>
<style>
  body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f5f7f4;color:#1f2937;
       display:grid;place-items:center;min-height:100vh;margin:0;padding:24px}
  .card{background:#fff;border:1px solid #e6ebe6;border-radius:14px;padding:28px;max-width:560px;
        box-shadow:0 1px 3px rgba(0,0,0,.05)}
  h1{margin:0 0 8px;color:#0f3d2e}
  code{background:#ecfdf5;color:#065f46;padding:2px 6px;border-radius:6px}
  a.btn{display:inline-block;margin-top:14px;background:#0e9f6e;color:#fff;text-decoration:none;
        padding:10px 16px;border-radius:10px;font-weight:600}
  ul{line-height:1.7}
</style></head><body><div class="card">
  <h1>☘ Panchakarma API is running</h1>
  <p>This URL (<code>http://localhost:${PORT}</code>) is the <b>backend API only</b>.
     The web app you're looking for runs on the Vite dev server.</p>
  <p><b>To open the actual application:</b></p>
  <ul>
    <li>Open a new terminal</li>
    <li>Run <code>cd panchakarma/client &amp;&amp; npm install &amp;&amp; npm run dev</code></li>
    <li>Then visit <a href="http://localhost:5173">http://localhost:5173</a></li>
  </ul>
  <p>API health check: <a href="/api/health">/api/health</a></p>
  <a class="btn" href="http://localhost:5173">Open the app →</a>
</div></body></html>`);
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/therapies', therapyRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/diet-plans', dietPlanRoutes);
app.use('/api/appointment-requests', appointmentRequestRoutes);
app.use('/api/packages', packageRoutes);

// Generic error handler — keeps responses JSON for the client.
app.use((err, _req, res, _next) => {
  // eslint-disable-next-line no-console
  console.error('[server error]', err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// Bootstrap: ensure db.json exists with seed data, then start.
await loadDb();
startNotificationScheduler();

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Panchakarma API listening on http://localhost:${PORT}`);
});

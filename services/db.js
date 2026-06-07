// Tiny JSON-file "database". Synchronous reads after the initial load keep the
// code simple. All persisted shapes are documented with JSDoc only — no TS.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedData } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'db.json');

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} name
 * @property {string} email
 * @property {string} password   // plaintext is fine for the demo
 * @property {'patient'|'practitioner'|'admin'} role
 * @property {string=} phone
 * @property {{inApp:boolean, sms:boolean, email:boolean}} channels
 */

let cache = null;

export async function loadDb() {
  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    cache = JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') {
      cache = seedData();
      await persist();
    } else {
      throw err;
    }
  }
  // Forward-compat: older db.json snapshots may pre-date the dietPlans
  // collection. Make sure every expected top-level key exists so routes that
  // assume an array can iterate safely.
  for (const key of [
    'users', 'therapies', 'sessions', 'notifications',
    'feedback', 'dietPlans', 'appointmentRequests', 'packages',
  ]) {
    if (!Array.isArray(cache[key])) cache[key] = [];
  }
  return cache;
}

export function db() {
  if (!cache) throw new Error('DB not loaded. Call loadDb() first.');
  return cache;
}

async function persist() {
  await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
  await fs.writeFile(DB_PATH, JSON.stringify(cache, null, 2), 'utf8');
}

// Debounced save — many writes in a single tick get coalesced.
let saveTimer = null;
export function save() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    persist().catch((e) => console.error('[db save failed]', e));
  }, 50);
}

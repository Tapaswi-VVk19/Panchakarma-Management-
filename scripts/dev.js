// Cross-platform dev launcher — spawns the Express backend and the Vite frontend
// in a single terminal, prefixes their output, and forwards Ctrl+C to both.
// Pure JavaScript (no concurrently / no extra deps needed).
//
// Windows note (Node 18.20+/20.12+/22+):
//   For security (CVE-2024-27980) Node now refuses to spawn .cmd/.bat files
//   without `shell: true` and throws EINVAL. Since `npm` on Windows is
//   actually `npm.cmd`, we always pass `shell: true` here. On macOS/Linux
//   `shell: true` is harmless.

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

const targets = [
  { name: 'server', color: '\x1b[36m', cwd: path.join(ROOT, 'server'), args: ['run', 'dev'] },
  { name: 'client', color: '\x1b[35m', cwd: path.join(ROOT, 'client'), args: ['run', 'dev'] },
];

const RESET = '\x1b[0m';
const children = [];

for (const t of targets) {
  // shell:true is required on Windows for .cmd shims; harmless elsewhere.
  const child = spawn(npmCmd, t.args, {
    cwd: t.cwd,
    env: process.env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  children.push(child);

  const prefix = `${t.color}[${t.name}]${RESET} `;
  const pipe = (stream, out) => {
    let buf = '';
    stream.on('data', (chunk) => {
      buf += chunk.toString();
      let i;
      while ((i = buf.indexOf('\n')) !== -1) {
        out.write(prefix + buf.slice(0, i) + '\n');
        buf = buf.slice(i + 1);
      }
    });
    stream.on('end', () => {
      if (buf) out.write(prefix + buf + '\n');
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);

  child.on('error', (err) => {
    process.stderr.write(`${prefix}failed to start: ${err.message}\n`);
    shutdown(1);
  });

  child.on('exit', (code) => {
    process.stdout.write(`${prefix}exited with code ${code}\n`);
    // If one dies, stop the other so the user isn't left with a half-running app.
    shutdown(code ?? 0);
  });
}

let shuttingDown = false;
function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const c of children) {
    if (!c.killed) {
      try {
        // On Windows, SIGINT often doesn't propagate through the shell wrapper —
        // taskkill the whole process tree to be sure.
        if (isWin && c.pid) {
          spawn('taskkill', ['/pid', String(c.pid), '/f', '/t'], { shell: true });
        } else {
          c.kill('SIGINT');
        }
      } catch { /* ignore */ }
    }
  }
  setTimeout(() => process.exit(code), 500);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log('Starting Panchakarma (server + client)…');
console.log('  • API:  http://localhost:4000');
console.log('  • App:  http://localhost:5173   ← open this in your browser');
console.log('Press Ctrl+C to stop both.\n');

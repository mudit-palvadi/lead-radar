/**
 * Runs the API and the Temporal worker in a single process.
 *
 * Render's free compute plan supports web services but not background workers,
 * so the worker has to live inside the web service. The API stays the main
 * process because Render's health check probes it; the worker runs alongside
 * and does not serve HTTP.
 *
 * If either process exits, the whole thing exits so Render restarts the
 * service — a silently dead worker would otherwise leave scans stuck in
 * "scanning" forever.
 */
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';

const api = spawn('node', ['dist/api/server.js'], { stdio: 'inherit' });

// `npm run worker` resolves the local tsx binary and stays cross-platform.
// The worker bundles its workflow with webpack at startup, so it needs tsx
// rather than running compiled output.
const worker = spawn('npm', ['run', 'worker'], {
  stdio: 'inherit',
  shell: isWin,
});

let shuttingDown = false;

function shutdown(code) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[start] a process exited with code ${code}; shutting down`);
  for (const child of [api, worker]) {
    try {
      child.kill();
    } catch {
      // already gone
    }
  }
  process.exit(code ?? 0);
}

api.on('exit', (code) => shutdown(code));
worker.on('exit', (code) => shutdown(code));

process.on('SIGTERM', () => shutdown(0));
process.on('SIGINT', () => shutdown(0));
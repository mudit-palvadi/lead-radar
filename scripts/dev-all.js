/**
 * Runs the API and the Temporal worker together for local development.
 *
 * The default `npm run dev` only starts the API, which means scans hang
 * forever if you forget the worker. This runs both so a single command
 * gives you a working app.
 */
import { spawn } from 'node:child_process';

const isWin = process.platform === 'win32';

const api = spawn('npm', ['run', 'dev'], { stdio: 'inherit', shell: isWin });
const worker = spawn('npm', ['run', 'worker'], { stdio: 'inherit', shell: isWin });

let shuttingDown = false;

function shutdown() {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of [api, worker]) {
    try {
      child.kill();
    } catch {
      // already gone
    }
  }
  process.exit(0);
}

api.on('exit', shutdown);
worker.on('exit', shutdown);
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
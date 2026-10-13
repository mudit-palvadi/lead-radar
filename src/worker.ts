import { Worker, NativeConnection } from '@temporalio/worker';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { isTemporalCloud, temporalConnectionOptions } from './temporal.js';
import * as activities from './workflow/activities.js';

/**
 * dev (tsx):   src/worker.ts          -> ./workflow/scanWorkflow.ts
 * prod (tsc):  dist/worker.js         -> ./workflow/scanWorkflow.js
 */
const selfPath = fileURLToPath(import.meta.url);
const workflowsPath = selfPath.endsWith('.js')
  ? fileURLToPath(new URL('./workflow/scanWorkflow.js', import.meta.url))
  : fileURLToPath(new URL('./workflow/scanWorkflow.ts', import.meta.url));

async function run(): Promise<void> {
  console.log(
    isTemporalCloud
      ? `Connecting to Temporal Cloud at ${config.temporal.address}`
      : `Connecting to local Temporal at ${config.temporal.address}`,
  );

  const connection = await NativeConnection.connect(temporalConnectionOptions());

  const worker = await Worker.create({
    connection,
    workflowsPath,
    activities,
    taskQueue: config.temporal.taskQueue,
    namespace: config.temporal.namespace,
  });

  await worker.run();
}

run().catch((err) => {
  console.error('Temporal worker failed:', err);
  process.exit(1);
});

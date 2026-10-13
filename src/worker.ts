import { Worker } from '@temporalio/worker';
import { config } from './config.js';
import * as activities from './workflow/activities.js';

async function run(): Promise<void> {
  const worker = await Worker.create({
    workflowsPath: require.resolve('./workflow/scanWorkflow'),
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

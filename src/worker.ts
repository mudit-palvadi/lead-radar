import { Worker, NativeConnection } from '@temporalio/worker';
import { config } from './config.js';
import { isTemporalCloud, temporalConnectionOptions } from './temporal.js';
import * as activities from './workflow/activities.js';

async function run(): Promise<void> {
  console.log(
    isTemporalCloud
      ? `Connecting to Temporal Cloud at ${config.temporal.address}`
      : `Connecting to local Temporal at ${config.temporal.address}`,
  );

  const connection = await NativeConnection.connect(temporalConnectionOptions());

  const worker = await Worker.create({
    connection,
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

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { WorkflowClient, Connection } from '@temporalio/client';
import { config } from '../config.js';
import { ScanRequestSchema } from '../types.js';
import { ScanModel } from '../db/models.js';
import { connectDatabase } from '../db/connection.js';
import { leadRadarScanWorkflow } from '../workflow/scanWorkflow.js';

const app = express();
app.use(cors());
app.use(express.json());

let workflowClient: WorkflowClient | null = null;

async function getWorkflowClient(): Promise<WorkflowClient> {
  if (!workflowClient) {
    const connection = await Connection.connect({
      address: config.temporal.address,
    });
    workflowClient = new WorkflowClient({
      connection,
      namespace: config.temporal.namespace,
    });
  }
  return workflowClient;
}

app.post('/api/scans', async (req, res) => {
  const parsed = ScanRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.errors });
    return;
  }

  const scanId = uuidv4();
  const scan = new ScanModel({
    scanId,
    request: parsed.data,
    leads: [],
    status: 'pending',
  });

  await scan.save();

  try {
    const client = await getWorkflowClient();
    await client.start(leadRadarScanWorkflow, {
      args: [parsed.data],
      taskQueue: config.temporal.taskQueue,
      workflowId: scanId,
    });
  } catch (error) {
    scan.status = 'failed';
    scan.error = error instanceof Error ? error.message : 'Failed to start workflow';
    await scan.save();
    res.status(500).json({ error: 'Failed to start scan', scanId });
    return;
  }

  res.status(202).json({
    scanId,
    status: 'pending',
    message: 'Scan created. Poll /api/scans/:id for results.',
  });
});

app.get('/api/scans/:id', async (req, res) => {
  const scan = await ScanModel.findOne({ scanId: req.params.id });
  if (!scan) {
    res.status(404).json({ error: 'Scan not found' });
    return;
  }

  if (scan.status === 'pending' || scan.status === 'scanning' || scan.status === 'classifying' || scan.status === 'drafting') {
    try {
      const client = await getWorkflowClient();
      const handle = client.getHandle(scan.scanId);

      const status = await handle.query('scanStatus');
      scan.status = status as typeof scan.status;

      if (status === 'complete' && scan.leads.length === 0) {
        try {
          const leads = await handle.result();
          scan.leads = leads;
          scan.status = 'complete';
        } catch {
          // Workflow completed but result not yet available
        }
      }

      await scan.save();
    } catch {
      // Temporal not reachable — return cached status
    }
  }

  res.json({
    scanId: scan.scanId,
    status: scan.status,
    leads: scan.leads,
    createdAt: scan.createdAt,
    error: scan.error,
  });
});

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

async function start(): Promise<void> {
  await connectDatabase();
  app.listen(config.port, () => {
    console.log(`LeadRadar API listening on port ${config.port}`);
  });
}

start().catch(console.error);

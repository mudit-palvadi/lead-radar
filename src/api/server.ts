import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config.js';
import { ScanRequestSchema } from '../types.js';
import { ScanModel } from '../db/models.js';
import { connectDatabase } from '../db/connection.js';

const app = express();
app.use(cors());
app.use(express.json());

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

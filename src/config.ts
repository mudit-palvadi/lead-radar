import 'dotenv/config';

function required(name: string): string {
  const val = process.env[name];
  if (!val) throw new Error(`Missing required env var: ${name}`);
  return val;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  hf: {
    token: process.env.HF_TOKEN || '',
    model: process.env.HF_MODEL || 'google/gemma-3-4b-it',
  },

  serpapi: {
    key: process.env.SERPAPI_KEY || '',
  },

  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/leadradar',
  },

  temporal: {
    address: process.env.TEMPORAL_ADDRESS || 'localhost:7233',
    namespace: process.env.TEMPORAL_NAMESPACE || 'default',
    taskQueue: 'leadradar-scans',
  },

  limits: {
    maxLeadsPerScan: parseInt(process.env.MAX_LEADS_PER_SCAN || '50', 10),
    classificationBatchSize: parseInt(process.env.CLASSIFICATION_BATCH_SIZE || '10', 10),
  },
};

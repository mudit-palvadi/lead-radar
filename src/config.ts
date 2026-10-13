import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  groq: {
    apiKey: process.env.GROQ_API_KEY || '',
    model: process.env.GROQ_MODEL || 'gemma2-9b-it',
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
    apiKey: process.env.TEMPORAL_API_KEY || '',
    taskQueue: 'leadradar-scans',
  },

  limits: {
    maxLeadsPerScan: parseInt(process.env.MAX_LEADS_PER_SCAN || '50', 10),
    classificationBatchSize: parseInt(process.env.CLASSIFICATION_BATCH_SIZE || '10', 10),
  },
};

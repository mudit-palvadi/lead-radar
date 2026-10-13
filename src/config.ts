import 'dotenv/config';

export type AIProviderName = 'ollama' | 'groq';

function pickProvider(): AIProviderName {
  const value = process.env.AI_PROVIDER?.toLowerCase();
  if (value === 'ollama') return 'ollama';
  return 'groq';
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),

  ai: {
    provider: pickProvider(),
    ollama: {
      host: process.env.OLLAMA_HOST || 'http://localhost:11434',
      model: process.env.OLLAMA_MODEL || 'qwen3:8b',
    },
    groq: {
      apiKey: process.env.GROQ_API_KEY || '',
      model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b',
    },
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

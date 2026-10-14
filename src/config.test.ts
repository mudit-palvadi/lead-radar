import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('dotenv/config', () => ({}));

describe('config', () => {
  beforeEach(() => {
    vi.resetModules();
    // Clear env vars that could interfere with defaults
    const envVars = [
      'PORT', 'AI_PROVIDER', 'OLLAMA_HOST', 'OLLAMA_MODEL',
      'GROQ_API_KEY', 'GROQ_MODEL', 'SERPAPI_KEY',
      'MONGODB_URI', 'TEMPORAL_ADDRESS', 'TEMPORAL_NAMESPACE', 'TEMPORAL_API_KEY',
      'MAX_LEADS_PER_SCAN', 'CLASSIFICATION_BATCH_SIZE',
    ];
    for (const key of envVars) delete process.env[key];
  });

  it('loads correct default values', async () => {
    const { config } = await import('./config');

    expect(config.port).toBe(3000);
    expect(config.ai.provider).toBe('groq');
    expect(config.ai.ollama.host).toBe('http://localhost:11434');
    expect(config.ai.ollama.model).toBe('qwen3:8b');
    expect(config.ai.groq.apiKey).toBe('');
    expect(config.ai.groq.model).toBe('allam-2-7b');
    expect(config.serpapi.key).toBe('');
    expect(config.mongodb.uri).toBe('mongodb://localhost:27017/leadradar');
    expect(config.temporal.address).toBe('localhost:7233');
    expect(config.temporal.namespace).toBe('default');
    expect(config.temporal.taskQueue).toBe('leadradar-scans');
    expect(config.limits.maxLeadsPerScan).toBe(50);
    expect(config.limits.classificationBatchSize).toBe(10);
  });

  it('respects environment variable overrides', async () => {
    process.env.PORT = '8080';
    process.env.MONGODB_URI = 'mongodb://prod:27017/app';
    process.env.MAX_LEADS_PER_SCAN = '25';
    process.env.SERPAPI_KEY = 'test-key';
    process.env.AI_PROVIDER = 'ollama';
    process.env.GROQ_MODEL = 'qwen/qwen3-32b';

    const { config } = await import('./config');

    expect(config.port).toBe(8080);
    expect(config.mongodb.uri).toBe('mongodb://prod:27017/app');
    expect(config.limits.maxLeadsPerScan).toBe(25);
    expect(config.serpapi.key).toBe('test-key');
    expect(config.ai.provider).toBe('ollama');
    expect(config.ai.groq.model).toBe('qwen/qwen3-32b');
  });
});

import mongoose from 'mongoose';

let memoryServer: { stop: () => Promise<unknown> } | null = null;

/** True once mongoose has a live connection. */
export function isDatabaseReady(): boolean {
  return mongoose.connection.readyState === 1;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Connect to the configured MongoDB URI, falling back to an in-memory
 * MongoDB when the external cluster is unreachable.
 *
 * The fallback keeps the demo alive on any machine and makes Render
 * deployment possible without exposing an Atlas cluster to the internet.
 * Every step logs, and the fallback is capped by a timeout: an in-memory
 * server that stalls on its binary download used to hang startup forever,
 * which kept the API from ever listening and failed the Render deploy.
 */
export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      console.log('[db] connecting to external MongoDB...');
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      console.log(`[db] connected to MongoDB at ${mongoose.connection.host}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[db] external MongoDB unavailable (${message.slice(0, 120)})`);
      console.warn('[db] falling back to in-memory MongoDB (data is not persisted)');
    }
  } else {
    console.warn('[db] MONGODB_URI is not set; using in-memory MongoDB');
  }

  console.log('[db] starting in-memory MongoDB (downloads a binary on first run)...');
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mem = await withTimeout(MongoMemoryServer.create(), 60_000, 'in-memory MongoDB startup');
    memoryServer = mem;
    await mongoose.connect(mem.getUri());
    console.log('[db] connected to in-memory MongoDB (ephemeral)');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[db] in-memory MongoDB failed (${message.slice(0, 160)})`);
    throw new Error(`No database available: ${message}`);
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

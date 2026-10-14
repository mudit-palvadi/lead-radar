import mongoose from 'mongoose';

let memoryServer: { stop: () => Promise<unknown> } | null = null;

/**
 * Connect to the configured MongoDB URI, falling back to an in-memory
 * MongoDB when the external cluster is unreachable.
 *
 * The fallback keeps the demo alive on any machine and makes Render
 * deployment possible without exposing an Atlas cluster to the internet.
 */
export async function connectDatabase(): Promise<void> {
  const uri = process.env.MONGODB_URI;

  if (uri) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
      console.log(`[db] connected to MongoDB at ${mongoose.connection.host}`);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[db] external MongoDB unavailable (${message.slice(0, 120)})`);
      console.warn('[db] falling back to in-memory MongoDB (data is not persisted)');
    }
  }

  const { MongoMemoryServer } = await import('mongodb-memory-server');
  const mem = await MongoMemoryServer.create();
  memoryServer = mem;
  await mongoose.connect(mem.getUri());
  console.log('[db] connected to in-memory MongoDB (ephemeral)');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

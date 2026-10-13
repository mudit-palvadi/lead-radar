import mongoose from 'mongoose';
import { config } from '../config.js';

export async function connectDatabase(): Promise<void> {
  await mongoose.connect(config.mongodb.uri);
  console.log('Connected to MongoDB');
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

import { Connection } from '@temporalio/client';
import { config } from './config.js';

export const isTemporalCloud = Boolean(config.temporal.apiKey);

export interface TemporalConnectionConfig {
  address: string;
  apiKey?: string;
  tls?: Record<string, never>;
}

export function temporalConnectionOptions(): TemporalConnectionConfig {
  const options: TemporalConnectionConfig = {
    address: config.temporal.address,
  };

  if (config.temporal.apiKey) {
    options.apiKey = config.temporal.apiKey;
    options.tls = {};
  }

  return options;
}

let connection: Connection | null = null;

export async function getConnection(): Promise<Connection> {
  if (!connection) {
    connection = await Connection.connect(temporalConnectionOptions());
  }
  return connection;
}

/** Typed worker configuration loaded from the environment. */
export interface WorkerEnv {
  database: { url: string };
  redis: { host: string; port: number };
  import: { batchSize: number; maxAttempts: number; concurrency: number };
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== undefined && value !== '' ? parsed : fallback;
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function configuration(): WorkerEnv {
  return {
    database: { url: required('DATABASE_URL') },
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: int(process.env.REDIS_PORT, 6379),
    },
    import: {
      batchSize: int(process.env.IMPORT_BATCH_SIZE, 100),
      maxAttempts: int(process.env.IMPORT_MAX_ATTEMPTS, 3),
      concurrency: int(process.env.WORKER_CONCURRENCY, 2),
    },
  };
}

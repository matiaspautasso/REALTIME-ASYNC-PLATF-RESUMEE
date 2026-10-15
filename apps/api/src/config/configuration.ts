/** Typed application configuration loaded from the environment. */
export interface AppEnv {
  api: { port: number };
  database: { url: string };
  redis: { host: string; port: number };
  upload: { dir: string };
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

export function configuration(): AppEnv {
  return {
    api: { port: int(process.env.API_PORT, 3000) },
    database: { url: required('DATABASE_URL') },
    redis: {
      host: process.env.REDIS_HOST ?? 'localhost',
      port: int(process.env.REDIS_PORT, 6379),
    },
    upload: { dir: process.env.UPLOAD_DIR ?? './data/uploads' },
    import: {
      batchSize: int(process.env.IMPORT_BATCH_SIZE, 100),
      maxAttempts: int(process.env.IMPORT_MAX_ATTEMPTS, 3),
      concurrency: int(process.env.WORKER_CONCURRENCY, 2),
    },
  };
}

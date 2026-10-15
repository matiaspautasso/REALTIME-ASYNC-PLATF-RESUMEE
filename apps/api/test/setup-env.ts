import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Per-worker test env. When the Testcontainers global setup ran, prefer the
// throwaway containers' connection details; otherwise fall back to a locally
// running Docker Compose stack so the suite still runs without Testcontainers.
const stateFile = join(__dirname, '.tc-state.json');
if (existsSync(stateFile)) {
  const state = JSON.parse(readFileSync(stateFile, 'utf8')) as {
    databaseUrl: string;
    redisHost: string;
    redisPort: number;
  };
  process.env.DATABASE_URL = state.databaseUrl;
  process.env.REDIS_HOST = state.redisHost;
  process.env.REDIS_PORT = String(state.redisPort);
} else {
  process.env.DATABASE_URL ??= 'postgresql://jobflow:jobflow@localhost:5455/jobflow?schema=public';
  process.env.REDIS_HOST ??= 'localhost';
  process.env.REDIS_PORT ??= '6380';
}
process.env.UPLOAD_DIR ??= './data/uploads';
// Drive the outbox relay manually in tests instead of on its timer.
process.env.OUTBOX_RELAY_DISABLED = 'true';

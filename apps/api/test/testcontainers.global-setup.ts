import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer, type StartedRedisContainer } from '@testcontainers/redis';

/**
 * Jest global setup (TICKET-08.1): boot throwaway PostgreSQL and Redis, run the
 * Prisma migrations against the fresh database, and hand the connection details
 * to the per-worker setup file via a state file.
 */
module.exports = async function globalSetup(): Promise<void> {
  const postgres = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('jobflow')
    .withUsername('jobflow')
    .withPassword('jobflow')
    .start();
  const redis = await new RedisContainer('redis:7-alpine').start();

  const databaseUrl = `${postgres.getConnectionUri()}?schema=public`;
  execSync('pnpm --filter @jobflow/database migrate:deploy', {
    env: { ...process.env, DATABASE_URL: databaseUrl },
    stdio: 'inherit',
  });

  writeFileSync(
    join(__dirname, '.tc-state.json'),
    JSON.stringify({ databaseUrl, redisHost: redis.getHost(), redisPort: redis.getPort() }),
  );

  (globalThis as unknown as { __TC__: { postgres: StartedPostgreSqlContainer; redis: StartedRedisContainer } }).__TC__ = {
    postgres,
    redis,
  };
};

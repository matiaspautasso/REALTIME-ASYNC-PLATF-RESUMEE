import { rmSync } from 'node:fs';
import { join } from 'node:path';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { StartedRedisContainer } from '@testcontainers/redis';

/** Jest global teardown (TICKET-08.1): stop the throwaway containers. */
module.exports = async function globalTeardown(): Promise<void> {
  const tc = (globalThis as unknown as {
    __TC__?: { postgres: StartedPostgreSqlContainer; redis: StartedRedisContainer };
  }).__TC__;
  await tc?.redis?.stop();
  await tc?.postgres?.stop();
  rmSync(join(__dirname, '.tc-state.json'), { force: true });
};

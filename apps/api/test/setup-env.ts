// Integration tests talk to the real PostgreSQL and Redis started via Docker.
// @nestjs/config also loads apps/api/.env; these defaults are a fallback so the
// suite still runs when the file is absent (e.g. in CI with env vars set).
process.env.DATABASE_URL ??= 'postgresql://jobflow:jobflow@localhost:5455/jobflow?schema=public';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6380';
process.env.UPLOAD_DIR ??= './data/uploads';
// Drive the outbox relay manually in tests instead of on its timer.
process.env.OUTBOX_RELAY_DISABLED = 'true';

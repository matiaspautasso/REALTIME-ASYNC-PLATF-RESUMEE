// Integration tests talk to the real PostgreSQL started via Docker. The worker
// reads the same database as the API. These defaults are a fallback so the suite
// still runs when a local .env is absent (e.g. in CI with env vars set).
process.env.DATABASE_URL ??= 'postgresql://jobflow:jobflow@localhost:5455/jobflow?schema=public';
process.env.REDIS_HOST ??= 'localhost';
process.env.REDIS_PORT ??= '6380';

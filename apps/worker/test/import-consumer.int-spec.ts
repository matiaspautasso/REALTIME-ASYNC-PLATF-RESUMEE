import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { IMPORTS_QUEUE_NAME, type ImportJobData } from '@jobflow/contracts';
import { prisma } from '@jobflow/database';
import { AppModule } from '../src/app.module';

async function waitFor<T>(fn: () => Promise<T | null | undefined>, timeoutMs = 15000): Promise<T> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const value = await fn();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for condition');
}

const HEADER = 'sku,name,price,stock';

describe('ImportConsumer (e2e, through Redis)', () => {
  let app: TestingModule;
  let queue: Queue;
  let connection: Redis;
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'jobflow-consumer-'));
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await app.init();
    connection = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT), maxRetriesPerRequest: null });
    queue = new Queue(IMPORTS_QUEUE_NAME, { connection });
  });

  afterAll(async () => {
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
    connection.disconnect();
    await app.close();
    await rm(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await queue.obliterate({ force: true });
    await prisma.importError.deleteMany();
    await prisma.jobAttempt.deleteMany();
    await prisma.outbox.deleteMany();
    await prisma.importJob.deleteMany();
    await prisma.product.deleteMany();
  });

  async function enqueueImport(rows: string[], opts: { attempts: number; delay?: number }): Promise<string> {
    const filePath = join(dir, `${randomUUID()}.csv`);
    await writeFile(filePath, [HEADER, ...rows].join('\n'));
    const job = await prisma.importJob.create({
      data: { fileName: 'f.csv', filePath, totalRows: rows.length, status: 'QUEUED' },
    });
    const data: ImportJobData = { importId: job.id, filePath };
    await queue.add('import', data, {
      jobId: randomUUID(),
      attempts: opts.attempts,
      backoff: { type: 'exponential', delay: opts.delay ?? 100 },
      removeOnComplete: true,
    });
    return job.id;
  }

  async function enqueueMissingFile(opts: { attempts: number; delay?: number }): Promise<string> {
    const job = await prisma.importJob.create({
      data: { fileName: 'gone.csv', filePath: join(dir, `${randomUUID()}.csv`), totalRows: 1, status: 'QUEUED' },
    });
    const data: ImportJobData = { importId: job.id, filePath: job.filePath };
    await queue.add('import', data, {
      jobId: randomUUID(),
      attempts: opts.attempts,
      backoff: { type: 'exponential', delay: opts.delay ?? 100 },
      removeOnComplete: true,
    });
    return job.id;
  }

  it('consumes a queued job and drives the Import to COMPLETED', async () => {
    const id = await enqueueImport(['A,Alpha,1.00,5', 'B,Bravo,2.00,3'], { attempts: 3 });

    const done = await waitFor(async () => {
      const job = await prisma.importJob.findUnique({ where: { id } });
      return job && (job.status === 'COMPLETED' || job.status === 'COMPLETED_WITH_ERRORS') ? job : null;
    });

    expect(done.status).toBe('COMPLETED');
    expect(done.successRows).toBe(2);
    expect(await prisma.product.count()).toBe(2);
  });

  it('retries an Infrastructure Error up to the cap, then marks the Import FAILED', async () => {
    const id = await enqueueMissingFile({ attempts: 2, delay: 50 });

    const failed = await waitFor(async () => {
      const job = await prisma.importJob.findUnique({ where: { id } });
      return job && job.status === 'FAILED' ? job : null;
    });

    expect(failed.status).toBe('FAILED');
    const attempts = await prisma.jobAttempt.findMany({ where: { importJobId: id } });
    expect(attempts).toHaveLength(2);
    expect(attempts.every((a) => a.status === 'FAILED')).toBe(true);
  });

  it('processes multiple jobs with concurrency enabled', async () => {
    const first = await enqueueImport(['A,Alpha,1.00,1'], { attempts: 1 });
    const second = await enqueueImport(['B,Bravo,2.00,2'], { attempts: 1 });

    await waitFor(async () => {
      const jobs = await prisma.importJob.findMany({ where: { id: { in: [first, second] } } });
      return jobs.length === 2 && jobs.every((j) => j.status === 'COMPLETED') ? jobs : null;
    });

    expect(await prisma.product.count()).toBe(2);
  });
});

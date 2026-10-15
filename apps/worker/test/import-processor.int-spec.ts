import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { ImportStatus, type ImportJobData } from '@jobflow/contracts';
import { prisma } from '@jobflow/database';
import { ImportProcessor } from '../src/import/import-processor.service';

/** A ConfigService stub exposing just the import.batchSize the processor reads. */
function configWith(batchSize: number): ConfigService {
  return { get: (key: string) => (key === 'import.batchSize' ? batchSize : undefined) } as unknown as ConfigService;
}

const HEADER = 'sku,name,price,stock';

describe('ImportProcessor (integration)', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'jobflow-worker-'));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.importError.deleteMany();
    await prisma.jobAttempt.deleteMany();
    await prisma.outbox.deleteMany();
    await prisma.importJob.deleteMany();
    await prisma.product.deleteMany();
  });

  async function csv(name: string, rows: string[]): Promise<string> {
    const filePath = join(dir, `${name}.csv`);
    await writeFile(filePath, [HEADER, ...rows].join('\n'));
    return filePath;
  }

  async function seedJob(filePath: string, totalRows: number, overrides: Record<string, unknown> = {}) {
    return prisma.importJob.create({
      data: { fileName: 'f.csv', filePath, totalRows, status: 'QUEUED', ...overrides },
    });
  }

  function run(processor: ImportProcessor, job: { id: string; filePath: string }, attemptNumber = 1, isLastAttempt = false) {
    const data: ImportJobData = { importId: job.id, filePath: job.filePath };
    return processor.process(data, { attemptNumber, isLastAttempt });
  }

  it('persists valid rows as Products, invalid rows as ImportErrors, and ends COMPLETED_WITH_ERRORS', async () => {
    const processor = new ImportProcessor(configWith(2));
    const filePath = await csv('mixed', ['A,Alpha,1.00,5', 'B,,2.00,3', 'C,Charlie,-1,4', 'D,Delta,4.00,1']);
    const job = await seedJob(filePath, 4);

    const progress: number[] = [];
    const data: ImportJobData = { importId: job.id, filePath: job.filePath };
    await processor.process(data, { attemptNumber: 1, isLastAttempt: false }, (p) => progress.push(p.progress));
    expect(progress).toEqual([50, 100]); // one emit per committed Batch

    const detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.status).toBe('COMPLETED_WITH_ERRORS');
    expect(detail.processedRows).toBe(4);
    expect(detail.successRows).toBe(2);
    expect(detail.failedRows).toBe(2);
    expect(detail.committedBatches).toBe(2);
    expect(detail.progress).toBe(100);

    expect(await prisma.product.count()).toBe(2);
    const errors = await prisma.importError.findMany({ where: { importJobId: job.id }, orderBy: { rowNumber: 'asc' } });
    expect(errors.map((e) => [e.rowNumber, e.errorCode])).toEqual([
      [3, 'MISSING_NAME'],
      [4, 'INVALID_PRICE'],
    ]);
  });

  it('upserts by SKU: an existing Product is updated, never duplicated', async () => {
    await prisma.product.create({ data: { sku: 'A', name: 'Old', price: '1.00', stock: 1 } });
    const processor = new ImportProcessor(configWith(10));
    const filePath = await csv('upsert', ['A,New Name,9.99,42']);
    const job = await seedJob(filePath, 1);

    await run(processor, job);

    const products = await prisma.product.findMany();
    expect(products).toHaveLength(1);
    expect(products[0]?.name).toBe('New Name');
    expect(products[0]?.stock).toBe(42);
  });

  it('resumes after the Checkpoint without re-counting committed batches', async () => {
    // Batch 0 (rows A,B) is already committed: pre-seed its products and counters.
    await prisma.product.createMany({
      data: [
        { sku: 'A', name: 'Alpha', price: '1.00', stock: 1 },
        { sku: 'B', name: 'Bravo', price: '2.00', stock: 2 },
      ],
    });
    const processor = new ImportProcessor(configWith(2));
    const filePath = await csv('resume', ['A,Alpha,1.00,1', 'B,Bravo,2.00,2', 'C,Charlie,3.00,3', 'D,Delta,4.00,4']);
    const job = await seedJob(filePath, 4, {
      status: 'PROCESSING',
      committedBatches: 1,
      processedRows: 2,
      successRows: 2,
    });

    await run(processor, job);

    const detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.processedRows).toBe(4); // 6 would mean batch 0 was re-processed
    expect(detail.successRows).toBe(4);
    expect(detail.committedBatches).toBe(2);
    expect(detail.status).toBe('COMPLETED');
    expect(await prisma.product.count()).toBe(4);
  });

  it('records each execution as a JobAttempt with an incrementing attemptNumber', async () => {
    const processor = new ImportProcessor(configWith(10));
    const filePath = await csv('attempts', ['A,Alpha,1.00,1']);
    const job = await seedJob(filePath, 1);

    await run(processor, job, 1);
    await run(processor, job, 2);

    const attempts = await prisma.jobAttempt.findMany({
      where: { importJobId: job.id },
      orderBy: { attemptNumber: 'asc' },
    });
    expect(attempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
    expect(attempts.every((a) => a.status === 'SUCCEEDED')).toBe(true);
  });

  it('a Data Error never throws (no BullMQ retry) and still reaches a terminal status', async () => {
    const processor = new ImportProcessor(configWith(10));
    const filePath = await csv('data-error', ['A,Alpha,1.00,1', ',Nameless,2.00,2']);
    const job = await seedJob(filePath, 2);

    const payload = await run(processor, job);
    expect(payload.status).toBe(ImportStatus.COMPLETED_WITH_ERRORS);
    const detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.status).toBe('COMPLETED_WITH_ERRORS');
  });

  it('an Infrastructure Error throws, leaves the job non-terminal, and a later retry resumes to success', async () => {
    const processor = new ImportProcessor(configWith(10));
    const missing = join(dir, 'does-not-exist.csv');
    const job = await seedJob(missing, 1);

    // First attempt: the file is unreadable -> infra error -> throws, nothing committed.
    await expect(run(processor, job, 1, false)).rejects.toBeDefined();
    let detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(ImportStatus[detail.status as keyof typeof ImportStatus]).not.toBe(ImportStatus.COMPLETED);
    expect(detail.committedBatches).toBe(0);
    const failedAttempt = await prisma.jobAttempt.findFirst({ where: { importJobId: job.id } });
    expect(failedAttempt?.status).toBe('FAILED');

    // Retry: the file now exists -> succeeds.
    const fixed = await csv('recovered', ['A,Alpha,1.00,1']);
    await prisma.importJob.update({ where: { id: job.id }, data: { filePath: fixed } });
    await run(processor, { id: job.id, filePath: fixed }, 2, false);

    detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.status).toBe('COMPLETED');
    expect(await prisma.product.count()).toBe(1);
  });

  it('marks the job FAILED when the last attempt hits an Infrastructure Error', async () => {
    const processor = new ImportProcessor(configWith(10));
    const job = await seedJob(join(dir, 'still-missing.csv'), 1);

    await expect(run(processor, job, 3, true)).rejects.toBeDefined();
    const detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.status).toBe('FAILED');
  });
});

import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigService } from '@nestjs/config';
import { ImportStatus, type ImportJobData } from '@jobflow/contracts';
import { prisma } from '@jobflow/database';
import { ImportProcessor } from '../src/import/import-processor.service';

// Auditable suite for the mandatory resilience scenarios in docs/testing.md.
// Each describe names its scenario number. Scenarios 3 (Outbox) and 6 (WebSocket
// reconnect) live with the API and the web client respectively.

function configWith(batchSize: number): ConfigService {
  return { get: (key: string) => (key === 'import.batchSize' ? batchSize : undefined) } as unknown as ConfigService;
}

const HEADER = 'sku,name,price,stock';

describe('Resilience scenarios (worker)', () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'jobflow-scn-'));
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

  function seedJob(filePath: string, totalRows: number, overrides: Record<string, unknown> = {}) {
    return prisma.importJob.create({
      data: { fileName: 'f.csv', filePath, totalRows, status: 'QUEUED', ...overrides },
    });
  }

  function run(job: { id: string; filePath: string }, attemptNumber = 1, isLastAttempt = false, batchSize = 100) {
    const data: ImportJobData = { importId: job.id, filePath: job.filePath };
    return new ImportProcessor(configWith(batchSize)).process(data, { attemptNumber, isLastAttempt });
  }

  it('Scenario 1: a fully valid CSV imports every row and completes COMPLETED', async () => {
    const job = await seedJob(await csv('s1', ['A,Alpha,1.00,1', 'B,Bravo,2.00,2']), 2);
    await run(job);
    const detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.status).toBe('COMPLETED');
    expect(detail.successRows).toBe(2);
    expect(await prisma.product.count()).toBe(2);
  });

  it('Scenario 2: a partially invalid CSV imports valid rows, records errors, no valid row blocked', async () => {
    const job = await seedJob(await csv('s2', ['A,Alpha,1.00,1', 'B,,2.00,2', 'C,Charlie,3.00,3']), 3);
    await run(job, 1, false, 1); // batchSize 1 => the invalid row sits in its own batch, must not block others
    const detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.status).toBe('COMPLETED_WITH_ERRORS');
    expect(detail.successRows).toBe(2);
    expect(detail.failedRows).toBe(1);
    expect((await prisma.product.findMany()).map((p) => p.sku).sort()).toEqual(['A', 'C']);
  });

  it('Scenario 4: a worker interrupted mid-import resumes from the Checkpoint with no duplicates', async () => {
    await prisma.product.createMany({
      data: [
        { sku: 'A', name: 'Alpha', price: '1.00', stock: 1 },
        { sku: 'B', name: 'Bravo', price: '2.00', stock: 2 },
      ],
    });
    const job = await seedJob(await csv('s4', ['A,Alpha,1.00,1', 'B,Bravo,2.00,2', 'C,Charlie,3.00,3', 'D,Delta,4.00,4']), 4, {
      status: 'PROCESSING',
      committedBatches: 1,
      processedRows: 2,
      successRows: 2,
    });
    await run(job, 2, false, 2);
    const detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.processedRows).toBe(4); // not 6 — batch 0 was not re-processed
    expect(detail.status).toBe('COMPLETED');
    expect(await prisma.product.count()).toBe(4);
  });

  it('Scenario 5: an infra error retries and then succeeds; a data error never retries', async () => {
    // Data error: completes without throwing (no BullMQ retry).
    const dataJob = await seedJob(await csv('s5-data', ['A,Alpha,1.00,1', ',Nameless,2.00,2']), 2);
    await expect(run(dataJob)).resolves.toBeDefined();
    expect((await prisma.importJob.findUniqueOrThrow({ where: { id: dataJob.id } })).status).toBe('COMPLETED_WITH_ERRORS');

    // Infra error: a missing file throws; a later retry with a real file succeeds.
    const infraJob = await seedJob(join(dir, 'missing.csv'), 1);
    await expect(run(infraJob, 1, false)).rejects.toBeDefined();
    const fixed = await csv('s5-fixed', ['Z,Zeta,9.00,9']);
    await prisma.importJob.update({ where: { id: infraJob.id }, data: { filePath: fixed } });
    await run({ id: infraJob.id, filePath: fixed }, 2, false);
    expect((await prisma.importJob.findUniqueOrThrow({ where: { id: infraJob.id } })).status).toBe('COMPLETED');
  });

  it('Scenario 7: two imports with overlapping SKUs keep integrity (deterministic upsert)', async () => {
    const jobA = await seedJob(await csv('s7-a', ['SHARED,From A,1.00,1', 'ONLY-A,Only A,1.00,1']), 2);
    const jobB = await seedJob(await csv('s7-b', ['SHARED,From B,2.00,2', 'ONLY-B,Only B,2.00,2']), 2);

    await Promise.all([run(jobA), run(jobB)]);

    const detailA = await prisma.importJob.findUniqueOrThrow({ where: { id: jobA.id } });
    const detailB = await prisma.importJob.findUniqueOrThrow({ where: { id: jobB.id } });
    expect(detailA.status).toBe('COMPLETED');
    expect(detailB.status).toBe('COMPLETED');
    expect(detailA.successRows).toBe(2);
    expect(detailB.successRows).toBe(2);

    // The shared SKU exists exactly once; the two unique SKUs also exist: 3 total.
    const skus = (await prisma.product.findMany()).map((p) => p.sku).sort();
    expect(skus).toEqual(['ONLY-A', 'ONLY-B', 'SHARED']);
    const shared = await prisma.product.findUniqueOrThrow({ where: { sku: 'SHARED' } });
    expect(['From A', 'From B']).toContain(shared.name); // last writer wins; never corrupted
  });

  it('Scenario 8: retrying after a committed Batch does not double-count counters', async () => {
    // Batch 0 committed; re-running the whole job must not re-apply it.
    await prisma.product.create({ data: { sku: 'A', name: 'Alpha', price: '1.00', stock: 1 } });
    const job = await seedJob(await csv('s8', ['A,Alpha,1.00,1', 'B,Bravo,2.00,2']), 2, {
      status: 'PROCESSING',
      committedBatches: 1,
      processedRows: 1,
      successRows: 1,
    });
    await run(job, 2, false, 1);
    const detail = await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } });
    expect(detail.processedRows).toBe(2); // not 3
    expect(detail.successRows).toBe(2);
    expect(detail.status).toBe(ImportStatus.COMPLETED);
  });
});

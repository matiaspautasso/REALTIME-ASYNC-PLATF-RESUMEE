import { access } from 'node:fs/promises';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { prisma } from '@jobflow/database';
import { AppModule } from '../src/app.module';
import { IMPORTS_QUEUE } from '../src/redis/redis.module';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service';

const VALID_CSV = ['sku,name,price,stock', 'SKU-1,Item 1,1.00,1', 'SKU-2,Item 2,2.00,2'].join('\n');
const INVALID_CSV = ['sku,name,price', 'SKU-1,Item 1,1.00'].join('\n');

describe('Imports (e2e)', () => {
  let app: INestApplication;
  let queue: Queue;
  let relay: OutboxRelayService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    queue = app.get(IMPORTS_QUEUE);
    relay = app.get(OutboxRelayService);
  });

  beforeEach(async () => {
    await prisma.importError.deleteMany();
    await prisma.outbox.deleteMany();
    await prisma.jobAttempt.deleteMany();
    await prisma.importJob.deleteMany();
    await queue.obliterate({ force: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('accepts a valid CSV, persists the import and an outbox row atomically, and stores the file', async () => {
    const response = await request(app.getHttpServer())
      .post('/imports')
      .attach('file', Buffer.from(VALID_CSV), 'products.csv')
      .expect(202);

    expect(response.body).toMatchObject({ status: 'QUEUED', progress: 0, totalRows: 2 });
    const id = response.body.id as string;

    const job = await prisma.importJob.findUnique({ where: { id } });
    expect(job?.status).toBe('QUEUED');

    const outbox = await prisma.outbox.findMany({ where: { importJobId: id } });
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.publishedAt).toBeNull();

    await expect(access(job!.filePath)).resolves.toBeUndefined();
  });

  it('rejects an invalid CSV with 400 and persists nothing', async () => {
    const response = await request(app.getHttpServer())
      .post('/imports')
      .attach('file', Buffer.from(INVALID_CSV), 'bad.csv')
      .expect(400);

    expect(response.body).toMatchObject({ code: 'MISSING_COLUMNS' });
    expect(await prisma.importJob.count()).toBe(0);
    expect(await prisma.outbox.count()).toBe(0);
  });

  it('publishes a pending outbox row to the queue exactly once (stable jobId)', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/imports')
      .attach('file', Buffer.from(VALID_CSV), 'products.csv')
      .expect(202);
    const id = body.id as string;

    const published = await relay.publishPending();
    expect(published).toBe(1);

    const outbox = await prisma.outbox.findFirst({ where: { importJobId: id } });
    expect(outbox?.publishedAt).not.toBeNull();

    const job = await queue.getJob(outbox!.id);
    expect(job).toBeDefined();
    expect(job?.data).toMatchObject({ importId: id });

    // A second relay tick must not create a duplicate job.
    const again = await relay.publishPending();
    expect(again).toBe(0);
  });

  it('returns 404 for an unknown import', async () => {
    await request(app.getHttpServer()).get('/imports/does-not-exist').expect(404);
  });

  it('rejects retrying a non-FAILED import with 409', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/imports')
      .attach('file', Buffer.from(VALID_CSV), 'products.csv')
      .expect(202);
    await request(app.getHttpServer()).post(`/imports/${body.id}/retry`).expect(409);
  });

  it('re-queues a FAILED import on retry with a fresh outbox row', async () => {
    const job = await prisma.importJob.create({
      data: { fileName: 'f.csv', filePath: '/tmp/f.csv', totalRows: 2, status: 'FAILED' },
    });

    const response = await request(app.getHttpServer()).post(`/imports/${job.id}/retry`).expect(202);
    expect(response.body).toMatchObject({ status: 'QUEUED' });

    const refreshed = await prisma.importJob.findUnique({ where: { id: job.id } });
    expect(refreshed?.status).toBe('QUEUED');
    expect(await prisma.outbox.count({ where: { importJobId: job.id } })).toBe(1);
  });

  it('exports row errors as CSV', async () => {
    const job = await prisma.importJob.create({
      data: { fileName: 'f.csv', filePath: '/tmp/f.csv', totalRows: 1, status: 'COMPLETED_WITH_ERRORS' },
    });
    await prisma.importError.create({
      data: { importJobId: job.id, rowNumber: 2, errorCode: 'INVALID_PRICE', message: 'price must be greater than 0' },
    });

    const response = await request(app.getHttpServer()).get(`/imports/${job.id}/errors.csv`).expect(200);
    expect(response.headers['content-type']).toContain('text/csv');
    expect(response.text).toContain('rowNumber,errorCode,message');
    expect(response.text).toContain('2,INVALID_PRICE');
  });
});

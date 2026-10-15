import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import request from 'supertest';
import { prisma } from '@jobflow/database';
import { AppModule } from '../src/app.module';
import { IMPORTS_QUEUE } from '../src/redis/redis.module';
import { OutboxRelayService } from '../src/outbox/outbox-relay.service';

const VALID_CSV = ['sku,name,price,stock', 'SKU-1,Item 1,1.00,1'].join('\n');

// Mandatory scenario 3: Postgres committed but Redis publish failed. The request
// is not lost; it stays as a detectable unpublished Outbox row and the relay
// republishes it once Redis is reachable.
describe('Outbox recovery — scenario 3 (e2e)', () => {
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

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await prisma.outbox.deleteMany();
    await prisma.importJob.deleteMany();
    await queue.obliterate({ force: true });
  });

  it('keeps the Import recoverable while Redis is down, then republishes on recovery', async () => {
    const { body } = await request(app.getHttpServer())
      .post('/imports')
      .attach('file', Buffer.from(VALID_CSV), 'products.csv')
      .expect(202);
    const importId = body.id as string;

    // Redis is down: enqueue fails, the row stays unpublished and is detectable.
    const addSpy = jest.spyOn(queue, 'add').mockRejectedValue(new Error('redis down'));
    expect(await relay.publishPending()).toBe(0);
    expect(await prisma.outbox.count({ where: { importJobId: importId, publishedAt: null } })).toBe(1);
    expect(await relay.countStuck(0)).toBeGreaterThanOrEqual(1);

    // Redis recovers: the next relay cycle publishes the backlog; nothing stuck.
    addSpy.mockRestore();
    expect(await relay.publishPending()).toBe(1);
    const outbox = await prisma.outbox.findFirstOrThrow({ where: { importJobId: importId } });
    expect(outbox.publishedAt).not.toBeNull();
    expect(await queue.getJob(outbox.id)).toBeDefined();
    expect(await relay.countStuck(0)).toBe(0);
  });
});

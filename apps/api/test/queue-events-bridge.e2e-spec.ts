import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { ImportEvents, ImportStatus, IMPORTS_QUEUE_NAME, type ImportEventPayload } from '@jobflow/contracts';
import { AppModule } from '../src/app.module';
import { ImportsGateway } from '../src/realtime/imports.gateway';
import { IMPORTS_QUEUE } from '../src/redis/redis.module';

async function waitFor(predicate: () => boolean, timeoutMs = 10000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('Timed out waiting for condition');
}

describe('QueueEvents bridge (e2e, worker → Redis → gateway)', () => {
  let app: INestApplication;
  let gateway: ImportsGateway;
  let queue: Queue;
  let worker: Worker;
  let connection: Redis;

  beforeAll(async () => {
    delete process.env.QUEUE_EVENTS_DISABLED; // bridge must run for this suite
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    gateway = app.get(ImportsGateway);
    queue = app.get(IMPORTS_QUEUE);
    connection = new Redis({ host: process.env.REDIS_HOST, port: Number(process.env.REDIS_PORT), maxRetriesPerRequest: null });
  });

  afterAll(async () => {
    await worker?.close();
    await queue.obliterate({ force: true }).catch(() => undefined);
    connection.disconnect();
    await app.close();
  });

  it('forwards worker progress and completion from the queue to the gateway room', async () => {
    const importId = 'imp_bridge_1';
    const progressPayload: ImportEventPayload = {
      importId, status: ImportStatus.PROCESSING, progress: 50, processedRows: 1, totalRows: 2, successRows: 1, failedRows: 0,
    };
    const completedPayload: ImportEventPayload = {
      importId, status: ImportStatus.COMPLETED, progress: 100, processedRows: 2, totalRows: 2, successRows: 2, failedRows: 0,
    };

    const broadcasts: Array<[string, ImportEventPayload]> = [];
    jest.spyOn(gateway, 'broadcast').mockImplementation((event, payload) => {
      broadcasts.push([event, payload]);
    });

    // A throwaway worker that reports progress then completes with the snapshot.
    worker = new Worker(
      IMPORTS_QUEUE_NAME,
      async (job) => {
        await job.updateProgress(progressPayload);
        return completedPayload;
      },
      { connection },
    );

    await queue.add('import', { importId, filePath: '/tmp/x.csv' }, { removeOnComplete: true });

    await waitFor(() => broadcasts.some(([event]) => event === ImportEvents.Completed));

    expect(broadcasts).toContainEqual([ImportEvents.Progress, progressPayload]);
    expect(broadcasts).toContainEqual([ImportEvents.Completed, completedPayload]);
  });
});

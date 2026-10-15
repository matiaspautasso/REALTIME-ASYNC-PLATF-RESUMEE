import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, QueueEvents } from 'bullmq';
import { Redis } from 'ioredis';
import {
  ImportEvents,
  ImportStatus,
  IMPORTS_QUEUE_NAME,
  lifecycleEventFor,
  toImportEventPayload,
  type ImportEventPayload,
} from '@jobflow/contracts';
import { prisma } from '@jobflow/database';
import { REDIS_CONNECTION, IMPORTS_QUEUE } from '../redis/redis.module';
import { ImportsGateway } from './imports.gateway';

/**
 * Bridges BullMQ queue signals to WebSocket lifecycle events (RF-06). The worker
 * never holds a socket (ADR-0002): it reports progress as BullMQ job progress
 * and returns a terminal snapshot, and this bridge — running in the API — turns
 * those into room broadcasts keyed by `importId`.
 *
 * Terminal events read the Import back from PostgreSQL, so they only ever carry
 * the persisted state (ADR-0006). The failed signal is split by that state: an
 * Import the worker already marked FAILED emits `import:failed`; otherwise a
 * retry is pending and it emits `import:retrying`.
 */
@Injectable()
export class QueueEventsBridge implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueEventsBridge.name);
  private events?: QueueEvents;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: Redis,
    @Inject(IMPORTS_QUEUE) private readonly queue: Queue,
    private readonly gateway: ImportsGateway,
  ) {}

  onModuleInit(): void {
    if (process.env.QUEUE_EVENTS_DISABLED === 'true') {
      return;
    }
    this.events = new QueueEvents(IMPORTS_QUEUE_NAME, { connection: this.connection.duplicate() });

    this.events.on('progress', ({ data }) => {
      const payload = data as unknown as ImportEventPayload;
      if (payload?.importId) {
        this.gateway.broadcast(ImportEvents.Progress, payload);
      }
    });

    this.events.on('completed', ({ returnvalue }) => {
      const payload = returnvalue as unknown as ImportEventPayload;
      if (payload?.importId) {
        this.gateway.broadcast(lifecycleEventFor(payload.status), payload);
      }
    });

    this.events.on('failed', ({ jobId }) => {
      void this.handleFailed(jobId);
    });

    this.logger.log('QueueEvents bridge subscribed to the imports queue');
  }

  async onModuleDestroy(): Promise<void> {
    await this.events?.close();
  }

  /** A failed job: emit `import:failed` if the Import is already FAILED (last
   * attempt), otherwise `import:retrying` because BullMQ will try again. */
  private async handleFailed(jobId: string): Promise<void> {
    const job = await this.queue.getJob(jobId);
    const importId = job?.data?.importId as string | undefined;
    if (!importId) {
      return;
    }
    const snapshot = await prisma.importJob.findUnique({ where: { id: importId } });
    if (!snapshot) {
      return;
    }
    const payload = toImportEventPayload({ ...snapshot, status: snapshot.status as unknown as ImportStatus });
    const event = payload.status === ImportStatus.FAILED ? ImportEvents.Failed : ImportEvents.Retrying;
    this.gateway.broadcast(event, payload);
  }
}

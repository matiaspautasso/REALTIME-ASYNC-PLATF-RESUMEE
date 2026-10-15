import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { type ImportJobData } from '@jobflow/contracts';
import { prisma } from '@jobflow/database';
import { IMPORTS_QUEUE } from '../redis/redis.module';

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 50;

/**
 * Transactional outbox relay (ADR-0004). Polls unpublished Outbox rows and
 * enqueues each to BullMQ, marking it published only on success. If Redis is
 * unreachable the row stays unpublished and is retried next tick, so an Import
 * is never lost when PostgreSQL committed but the enqueue failed.
 *
 * The enqueue uses a stable jobId (the import id) so a double tick cannot
 * create two jobs for the same Import.
 */
@Injectable()
export class OutboxRelayService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @Inject(IMPORTS_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (process.env.OUTBOX_RELAY_DISABLED === 'true') {
      return;
    }
    this.timer = setInterval(() => {
      void this.publishPending();
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  /** Publish all currently-pending Outbox rows. Returns how many were published. */
  async publishPending(): Promise<number> {
    const pending = await prisma.outbox.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
    });

    let published = 0;
    for (const row of pending) {
      try {
        const data = row.payload as unknown as ImportJobData;
        await this.queue.add('import', data, {
          // The outbox row id is the dedup key: a double relay tick of the same
          // row is ignored, while a retry (a NEW row) always enqueues a new job.
          jobId: row.id,
          attempts: this.config.get<number>('import.maxAttempts') ?? 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        });
        await prisma.outbox.update({ where: { id: row.id }, data: { publishedAt: new Date() } });
        published += 1;
      } catch (error) {
        this.logger.warn(`Failed to publish outbox row ${row.id}; will retry next tick`, error as Error);
      }
    }
    return published;
  }
}

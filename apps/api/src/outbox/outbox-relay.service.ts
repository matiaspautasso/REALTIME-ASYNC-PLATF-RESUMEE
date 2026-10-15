import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { type ImportJobData } from '@jobflow/contracts';
import { prisma } from '@jobflow/database';
import { IMPORTS_QUEUE } from '../redis/redis.module';
import { StructuredLogger } from '../logging/structured-logger';

const POLL_INTERVAL_MS = 1000;
const BATCH_SIZE = 50;
/** An unpublished Outbox row older than this is considered stuck and surfaced. */
const STUCK_AFTER_MS = 30_000;

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
  private readonly slog = new StructuredLogger({ component: 'api', relay: 'outbox' });
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
      void this.tick();
    }, POLL_INTERVAL_MS);
  }

  /** One relay cycle: publish what is pending, then surface anything stuck so a
   * row that outlived a Redis outage is visible and not silently lost. */
  private async tick(): Promise<void> {
    await this.publishPending();
    const stuck = await this.countStuck(STUCK_AFTER_MS);
    if (stuck > 0) {
      this.slog.warn('outbox.stuck', { count: stuck, olderThanMs: STUCK_AFTER_MS });
    }
  }

  /** How many Outbox rows are still unpublished and older than `ageMs` — a
   * detectable "Postgres committed but Redis publish failed" backlog (ADR-0004,
   * mandatory scenario 3). */
  countStuck(ageMs: number): Promise<number> {
    return prisma.outbox.count({
      where: { publishedAt: null, createdAt: { lt: new Date(Date.now() - ageMs) } },
    });
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
        this.slog.info('outbox.published', { outboxId: row.id, importId: data.importId });
        published += 1;
      } catch (error) {
        this.slog.warn('outbox.publish_failed', {
          outboxId: row.id,
          cause: error instanceof Error ? error.message : String(error),
        });
      }
    }
    return published;
  }
}

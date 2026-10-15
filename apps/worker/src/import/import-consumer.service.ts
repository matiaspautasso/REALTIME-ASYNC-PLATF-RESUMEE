import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { IMPORTS_QUEUE_NAME, type ImportJobData } from '@jobflow/contracts';
import { prisma } from '@jobflow/database';
import { REDIS_CONNECTION } from '../redis/redis.module';
import { ImportProcessor } from './import-processor.service';

/**
 * Thin BullMQ adapter (ADR-0002): a Worker bound to the imports queue that
 * translates queue mechanics into the ImportProcessor's interface. Concurrency
 * is configurable so several Imports run in parallel (RF-11). It owns no
 * business logic — all processing lives behind ImportProcessor.process.
 */
@Injectable()
export class ImportConsumer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportConsumer.name);
  private worker?: Worker;

  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: Redis,
    private readonly config: ConfigService,
    private readonly processor: ImportProcessor,
  ) {}

  onModuleInit(): void {
    const concurrency = this.config.get<number>('import.concurrency') ?? 2;
    this.worker = new Worker(
      IMPORTS_QUEUE_NAME,
      async (job: Job<ImportJobData>) => {
        // attemptNumber is DB-driven so it stays monotonic even across a manual
        // retry, which starts a fresh BullMQ job with its own attempt budget.
        const prior = await prisma.jobAttempt.count({ where: { importJobId: job.data.importId } });
        const maxAttempts = job.opts.attempts ?? 1;
        await this.processor.process(job.data, {
          attemptNumber: prior + 1,
          isLastAttempt: job.attemptsMade + 1 >= maxAttempts,
        });
      },
      { connection: this.connection, concurrency },
    );
    this.worker.on('failed', (job, err) => {
      this.logger.warn(`Job ${job?.id} failed: ${err.message}`);
    });
    this.logger.log(`Import consumer listening on "${IMPORTS_QUEUE_NAME}" (concurrency ${concurrency})`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}

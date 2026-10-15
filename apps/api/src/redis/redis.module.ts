import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { IMPORTS_QUEUE_NAME } from '@jobflow/contracts';

export const REDIS_CONNECTION = 'REDIS_CONNECTION';
export const IMPORTS_QUEUE = 'IMPORTS_QUEUE';

/**
 * Owns the single Redis connection and the BullMQ imports queue, shared by the
 * health check, the imports service and the outbox relay.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CONNECTION,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis =>
        new Redis({
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
          maxRetriesPerRequest: null,
        }),
    },
    {
      provide: IMPORTS_QUEUE,
      inject: [REDIS_CONNECTION],
      useFactory: (connection: Redis): Queue =>
        new Queue(IMPORTS_QUEUE_NAME, { connection }),
    },
  ],
  exports: [REDIS_CONNECTION, IMPORTS_QUEUE],
})
export class RedisModule implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CONNECTION) private readonly connection: Redis,
    @Inject(IMPORTS_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
    this.connection.disconnect();
  }
}

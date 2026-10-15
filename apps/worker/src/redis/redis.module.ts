import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';

export const REDIS_CONNECTION = 'REDIS_CONNECTION';

/**
 * Owns the single Redis connection the BullMQ consumer uses. `maxRetriesPerRequest`
 * must be null for a BullMQ Worker's blocking commands.
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
  ],
  exports: [REDIS_CONNECTION],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS_CONNECTION) private readonly connection: Redis) {}

  onModuleDestroy(): void {
    this.connection.disconnect();
  }
}

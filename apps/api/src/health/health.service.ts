import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { prisma } from '@jobflow/database';
import { REDIS_CONNECTION } from '../redis/redis.module';

export interface HealthResult {
  ok: boolean;
  services: { postgres: boolean; redis: boolean };
}

@Injectable()
export class HealthService {
  constructor(@Inject(REDIS_CONNECTION) private readonly redis: Redis) {}

  async check(): Promise<HealthResult> {
    const [postgres, redis] = await Promise.all([this.pingPostgres(), this.pingRedis()]);
    return { ok: postgres && redis, services: { postgres, redis } };
  }

  private async pingPostgres(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async pingRedis(): Promise<boolean> {
    try {
      return (await this.redis.ping()) === 'PONG';
    } catch {
      return false;
    }
  }
}

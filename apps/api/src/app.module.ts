import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { configuration } from './config/configuration';
import { RedisModule } from './redis/redis.module';
import { HealthModule } from './health/health.module';
import { ImportsModule } from './imports/imports.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration], envFilePath: ['.env'] }),
    RedisModule,
    HealthModule,
    ImportsModule,
    ProductsModule,
  ],
})
export class AppModule {}

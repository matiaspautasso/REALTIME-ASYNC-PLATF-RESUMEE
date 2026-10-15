import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

/**
 * The worker is a standalone process with no HTTP server (ADR-0002): it only
 * consumes the queue. An application context (not createApplicationContext's
 * HTTP sibling) is enough; shutdown hooks drive the BullMQ Worker and Redis
 * connection to close cleanly.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule);
  app.enableShutdownHooks();
  new Logger('Worker').log('JobFlow worker started');
}

void bootstrap();

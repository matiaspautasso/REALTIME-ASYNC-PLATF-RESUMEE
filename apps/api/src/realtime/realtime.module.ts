import { Module } from '@nestjs/common';
import { ImportsGateway } from './imports.gateway';
import { QueueEventsBridge } from './queue-events.bridge';

@Module({
  providers: [ImportsGateway, QueueEventsBridge],
})
export class RealtimeModule {}

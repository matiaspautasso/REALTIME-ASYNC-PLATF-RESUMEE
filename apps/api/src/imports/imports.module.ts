import { Module } from '@nestjs/common';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { OutboxRelayService } from '../outbox/outbox-relay.service';

@Module({
  controllers: [ImportsController],
  providers: [ImportsService, OutboxRelayService],
})
export class ImportsModule {}

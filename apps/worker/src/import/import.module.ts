import { Module } from '@nestjs/common';
import { ImportProcessor } from './import-processor.service';
import { ImportConsumer } from './import-consumer.service';

@Module({
  providers: [ImportProcessor, ImportConsumer],
})
export class ImportModule {}

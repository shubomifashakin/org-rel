import { Module } from '@nestjs/common';
import { HasherService } from './hasher.service.js';

@Module({
  providers: [HasherService],
  exports: [HasherService],
})
export class HasherModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { MyLogger } from './logger.service.js';

@Module({
  providers: [MyLogger],
  exports: [MyLogger],
  imports: [ConfigModule],
})
export class LoggerModule {}

import { Module } from '@nestjs/common';

import { RedisService } from './redis.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';
import { AppLoggerModule } from '../app-logger/app-logger.module.js';

@Module({
  providers: [RedisService],
  imports: [AppConfigModule, AppLoggerModule],
  exports: [RedisService],
})
export class RedisModule {}

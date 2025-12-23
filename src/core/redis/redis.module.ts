import { Module } from '@nestjs/common';

import { RedisService } from './redis.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';

@Module({
  providers: [RedisService],
  imports: [AppConfigModule],
  exports: [RedisService],
})
export class RedisModule {}

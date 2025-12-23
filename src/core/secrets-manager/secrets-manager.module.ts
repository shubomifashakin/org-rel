import { Module } from '@nestjs/common';

import { SecretsManagerService } from './secrets-manager.service.js';
import { RedisModule } from '../redis/redis.module.js';
import { AppConfigModule } from '../app-config/app-config.module.js';
import { AppLoggerModule } from '../app-logger/app-logger.module.js';

@Module({
  imports: [RedisModule, AppConfigModule, AppLoggerModule],
  exports: [SecretsManagerService],
  providers: [SecretsManagerService],
})
export class SecretsManagerModule {}

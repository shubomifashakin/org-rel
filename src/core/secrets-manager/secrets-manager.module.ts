import { Module } from '@nestjs/common';

import { SecretsManagerService } from './secrets-manager.service.js';
import { RedisModule } from '../redis/redis.module.js';

@Module({
  imports: [RedisModule],
  exports: [SecretsManagerService],
  providers: [SecretsManagerService],
})
export class SecretsManagerModule {}

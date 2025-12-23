import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { SecretsManagerService } from './secrets-manager.service.js';
import { RedisModule } from '../redis/redis.module.js';

@Module({
  imports: [RedisModule, ConfigModule],
  exports: [SecretsManagerService],
  providers: [SecretsManagerService],
})
export class SecretsManagerModule {}

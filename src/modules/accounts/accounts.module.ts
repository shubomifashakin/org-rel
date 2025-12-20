import { Module } from '@nestjs/common';

import { AccountsService } from './accounts.service.js';
import { AccountsController } from './accounts.controller.js';

import { DatabaseModule } from '../../core/database/database.module.js';
import { SecretsManagerModule } from '../../core/secrets-manager/secrets-manager.module.js';
import { S3Module } from '../../core/s3/s3.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';

@Module({
  providers: [AccountsService],
  controllers: [AccountsController],
  imports: [DatabaseModule, SecretsManagerModule, S3Module, RedisModule],
})
export class AccountsModule {}

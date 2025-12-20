import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

import { DatabaseModule } from '../../core/database/database.module.js';
import { SecretsManagerModule } from '../../core/secrets-manager/secrets-manager.module.js';
import { MailerModule } from '../../core/mailer/mailer.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';

@Module({
  imports: [DatabaseModule, SecretsManagerModule, MailerModule, RedisModule],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}

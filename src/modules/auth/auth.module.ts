import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

import { DatabaseModule } from '../../core/database/database.module.js';
import { SecretsManagerModule } from '../../core/secrets-manager/secrets-manager.module.js';
import { MailerModule } from '../../core/mailer/mailer.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { S3Module } from '../../core/s3/s3.module.js';
import { JwtServiceModule } from '../../core/jwt-service/jwt-service.module.js';

@Module({
  imports: [
    DatabaseModule,
    SecretsManagerModule,
    MailerModule,
    RedisModule,
    S3Module,
    ConfigModule,
    JwtServiceModule,
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}

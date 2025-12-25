import { Module } from '@nestjs/common';

import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

import { DatabaseModule } from '../../core/database/database.module.js';
import { MailerModule } from '../../core/mailer/mailer.module.js';
import { RedisModule } from '../../core/redis/redis.module.js';
import { S3Module } from '../../core/s3/s3.module.js';
import { JwtServiceModule } from '../../core/jwt-service/jwt-service.module.js';
import { AppConfigModule } from '../../core/app-config/app-config.module.js';
import { AppLoggerModule } from '../../core/app-logger/app-logger.module.js';
import { HasherModule } from '../../core/hasher/hasher.module.js';

@Module({
  imports: [
    DatabaseModule,
    MailerModule,
    RedisModule,
    S3Module,
    AppConfigModule,
    JwtServiceModule,
    AppLoggerModule,
    HasherModule,
  ],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}

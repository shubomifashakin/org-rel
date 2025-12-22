import { Request } from 'express';
import { APP_GUARD } from '@nestjs/core';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './core/database/database.module.js';
import { S3Module } from './core/s3/s3.module.js';

import { OrganizationsModule } from './modules/organizations/organizations.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { RedisModule } from './core/redis/redis.module.js';
import { RedisService } from './core/redis/redis.service.js';
import { logger } from './middlewares/logger.middleware.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { SecretsManagerModule } from './core/secrets-manager/secrets-manager.module.js';
import { AccountsModule } from './modules/accounts/accounts.module.js';
import { MailerModule } from './core/mailer/mailer.module.js';
import { LoggerModule } from './core/logger/logger.module.js';

@Module({
  imports: [
    OrganizationsModule,
    DatabaseModule,
    RedisModule,
    LoggerModule,
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisService],
      useFactory: (redisService: RedisService) => {
        return {
          throttlers: [
            {
              ttl: 10,
              limit: 5,
              name: 'default',
            },
          ],
          errorMessage: 'Too many requests',
          generateKey: (ctx, _, throttlerName) => {
            const req = ctx.switchToHttp().getRequest<Request>();
            const key =
              req?.user?.id || req?.ip || req?.ips?.[0] || 'unknown-ip';

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
            const route = req.route?.path || req.path;

            return `${throttlerName}:${route}:${key}`.toLowerCase();
          },

          storage: {
            increment(key, ttl, limit, blockDuration) {
              return redisService.increment(key, ttl, limit, blockDuration);
            },
          },
        };
      },
    }),
    S3Module,
    SecretsManagerModule,
    AuthModule,
    AccountsModule,
    HealthModule,
    MailerModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(logger)
      .exclude({ path: 'health', method: RequestMethod.ALL })
      .forRoutes('*');
  }
}

import { type Request } from 'express';
import { APP_GUARD } from '@nestjs/core';
import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ClsModule } from 'nestjs-cls';
import { v4 as uuid } from 'uuid';
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
import { JwtServiceModule } from './core/jwt-service/jwt-service.module.js';
import { AppConfigModule } from './core/app-config/app-config.module.js';
import { AppLoggerModule } from './core/app-logger/app-logger.module.js';
import { HasherModule } from './core/hasher/hasher.module.js';

@Module({
  imports: [
    OrganizationsModule,
    DatabaseModule,
    RedisModule,
    JwtServiceModule,
    AppConfigModule,
    AppLoggerModule,
    HasherModule,
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator(req) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return
          return (
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            req.headers['x-request-id'] || uuid()
          );
        },
        setup(clx, req: Request) {
          clx.set('ip', req?.ip || req.ips?.[0] || 'unknown');
          clx.set('userAgent', req.get('user-agent'));
        },
      },
      guard: {
        mount: true,
        setup(clx, ctx) {
          if (ctx.getType() === 'http') {
            const req = ctx.switchToHttp().getRequest<Request>();

            clx.set('method', req.method);
            clx.set(
              'handler',
              `${ctx.getClass().name}.${ctx.getHandler().name}`,
            );
          }
        },
      },
    }),
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
            async increment(key, ttl, limit, blockDuration) {
              return await redisService.increment(
                key,
                ttl,
                limit,
                blockDuration,
              );
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

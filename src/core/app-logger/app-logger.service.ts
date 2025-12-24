/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Request } from 'express';
import {
  Injectable,
  LoggerService,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import DailyRotateFile from 'winston-daily-rotate-file';
import { createLogger, format, Logger, transports } from 'winston';

import { AppConfigService } from '../app-config/app-config.service.js';

@Injectable()
export class AppLoggerService
  implements LoggerService, OnModuleInit, OnApplicationShutdown
{
  private logger: Logger;

  constructor(private readonly configService: AppConfigService) {
    if (!this.configService.LogLevel.data) {
      throw new Error('Failed to get env variable LOG_LEVEL');
    }
  }

  onModuleInit() {
    const combinedTransport = new DailyRotateFile({
      maxSize: '5m',
      maxFiles: '3d',
      zippedArchive: true,
      datePattern: 'YYYY-MM-DD',
      level: this.configService.LogLevel.data!,
      dirname: './logs',
      filename: 'combined-%DATE%.log',
    });

    const errorTransport = new DailyRotateFile({
      maxSize: '5m',
      maxFiles: '3d',
      zippedArchive: true,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      dirname: './logs',
      filename: 'error-%DATE%.log',
    });

    const consoleTransport = new transports.Console({
      format: format.simple(),
    });

    const selectedTransports =
      this.configService.Environment.data === 'production'
        ? [combinedTransport, errorTransport]
        : [consoleTransport];

    this.logger = createLogger({
      level: this.configService.LogLevel.data!,
      format: format.combine(
        format.timestamp({
          format: 'YYYY-MM-DD HH:mm:ss',
        }),
        format.errors({ stack: true }),
        format.json(),
      ),
      transports: selectedTransports,
      defaultMeta: {
        serviceName: this.configService.ServiceName.data,
        environment: this.configService.Environment.data,
      },
    });
  }

  log(message: any, ...optionalParams: any[]) {
    this.logger.info(message, optionalParams);
  }

  error(message: any, ...optionalParams: any[]) {
    this.logger.error(message, optionalParams);
  }
  fatal(message: any, ...optionalParams: any[]) {
    this.logger.error(message, optionalParams);
  }

  warn(message: any, ...optionalParams: any[]) {
    this.logger.warn(message, optionalParams);
  }

  debug(message: any, ...optionalParams: any[]) {
    this.logger.debug(message, optionalParams);
  }

  verbose(message: any, ...optionalParams: any[]) {
    this.logger.verbose(message, optionalParams);
  }

  logError({
    req,
    message,
    reason,
  }: {
    req: Request;
    message: string;
    reason: unknown;
  }) {
    this.logger.error(message, {
      reason,
      userId: req?.user?.id || 'unknown',
      ipAddr: req?.ip || req?.ips?.[0] || 'unknown',
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
      path: req.route?.path || req.path,
      requestId: req.headers?.['request-id'],
      userAgent: req.get('user-agent'),
    });
  }

  onApplicationShutdown() {
    this.logger.info('Application is shutting down');
    this.logger?.destroy();
  }
}

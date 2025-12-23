/* eslint-disable @typescript-eslint/no-unsafe-argument */
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
      this.configService.Environment.data === 'development'
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

  onApplicationShutdown() {
    this.logger.info('Application is shutting down');
    this.logger?.destroy();
  }
}

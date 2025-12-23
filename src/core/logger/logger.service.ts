import * as path from 'path';
import { Injectable, LoggerService, OnModuleInit, Scope } from '@nestjs/common';
import * as winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import env from '../serverEnv';

@Injectable({ scope: Scope.TRANSIENT })
export class MyLogger implements LoggerService, OnModuleInit {
  private logger: winston.Logger;
  private context?: string;

  constructor(context?: string) {
    this.context = context;
  }

  onModuleInit() {
    const logDir = path.join(process.cwd(), 'logs');
    const isProduction = env.ENVIRONMENT === 'production';

    const errorTransport = new DailyRotateFile({
      filename: path.join(logDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '3d',
      level: 'error',
    });

    const logTransport = new DailyRotateFile({
      filename: path.join(logDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '5m',
      maxFiles: '3d',
    });

    const transports: winston.transport[] = [errorTransport, logTransport];

    if (!isProduction) {
      transports.push(
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
        }),
      );
    }

    this.logger = winston.createLogger({
      level: isProduction ? 'info' : 'debug',
      defaultMeta: {
        service: env.SERVICE_NAME,
        environment: env.ENVIRONMENT,
        context: this.context,
      },
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true }),
        winston.format.splat(),
        winston.format.json(),
      ),
      transports,
    });

    // Handle uncaught exceptions
    winston.exceptions.handle(errorTransport, logTransport);
    process.on('unhandledRejection', (reason) => {
      throw reason;
    });
  }

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  fatal(message: any, trace?: string, context?: string) {
    this.logger.crit(message, {
      context: context || this.context,
      stack: trace,
    });
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, {
      context: context || this.context,
      stack: trace,
    });
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }
}

import { Injectable, LoggerService } from '@nestjs/common';
import * as winston from 'winston';

@Injectable()
export class MyLogger implements LoggerService {
  private logger: winston.Logger;
  private context?: string;

  constructor() {}

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

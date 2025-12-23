import { Module } from '@nestjs/common';
import { AppLoggerService } from './app-logger.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';

@Module({
  providers: [AppLoggerService],
  exports: [AppLoggerService],
  imports: [AppConfigModule],
})
export class AppLoggerModule {}

import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { AppLoggerModule } from '../app-logger/app-logger.module.js';
import { AppConfigModule } from '../app-config/app-config.module.js';

@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
  imports: [AppConfigModule, AppLoggerModule],
})
export class DatabaseModule {}

import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';

@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
  imports: [AppConfigModule],
})
export class DatabaseModule {}

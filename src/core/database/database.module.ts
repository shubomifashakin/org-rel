import { Module } from '@nestjs/common';
import { DatabaseService } from './database.service.js';
import { ConfigModule } from '@nestjs/config';

@Module({
  providers: [DatabaseService],
  exports: [DatabaseService],
  imports: [ConfigModule],
})
export class DatabaseModule {}

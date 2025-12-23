import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { AppConfigService } from './app-config.service.js';

@Module({
  imports: [ConfigModule.forRoot()],
  exports: [AppConfigService],
  providers: [AppConfigService],
})
export class AppConfigModule {}

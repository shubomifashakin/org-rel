import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { JwtServiceService } from './jwt-service.service.js';
import { SecretsManagerModule } from '../secrets-manager/secrets-manager.module.js';

@Module({
  providers: [JwtServiceService],
  exports: [JwtServiceService],
  imports: [SecretsManagerModule, ConfigModule],
})
export class JwtServiceModule {}

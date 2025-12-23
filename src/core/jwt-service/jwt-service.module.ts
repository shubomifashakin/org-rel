import { Module } from '@nestjs/common';

import { JwtServiceService } from './jwt-service.service.js';
import { AppConfigModule } from '../app-config/app-config.module.js';
import { SecretsManagerModule } from '../secrets-manager/secrets-manager.module.js';

@Module({
  providers: [JwtServiceService],
  exports: [JwtServiceService],
  imports: [SecretsManagerModule, AppConfigModule],
})
export class JwtServiceModule {}

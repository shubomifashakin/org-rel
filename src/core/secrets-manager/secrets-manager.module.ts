import { Module } from '@nestjs/common';
import { SecretsManagerService } from './secrets-manager.service.js';

@Module({
  exports: [SecretsManagerService],
  providers: [SecretsManagerService],
})
export class SecretsManagerModule {}

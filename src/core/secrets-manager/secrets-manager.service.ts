import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import env from '../serverEnv/index.js';

@Injectable()
export class SecretsManagerService
  extends SecretsManagerClient
  implements OnModuleDestroy
{
  constructor() {
    super({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
      },
    });
  }

  onModuleDestroy() {
    console.log('destroying secrets manager service');
    this.destroy();
  }
}

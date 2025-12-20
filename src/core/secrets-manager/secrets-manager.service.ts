import {
  Injectable,
  InternalServerErrorException,
  OnModuleDestroy,
} from '@nestjs/common';
import {
  GetSecretValueCommand,
  SecretsManagerClient,
} from '@aws-sdk/client-secrets-manager';
import env from '../serverEnv/index.js';

type FnResult<T> =
  | { status: true; data: T; error: null }
  | { status: false; data: null; error: string };

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

  async getSecret<T>(secretId: string): Promise<FnResult<T>> {
    try {
      //FIXME: CACHE OR SOMETHING
      const secret = await this.send(
        new GetSecretValueCommand({
          SecretId: secretId,
        }),
      );

      if (!secret.SecretString) {
        throw new InternalServerErrorException('Secret string is empty');
      }

      const jwtSecret = JSON.parse(secret.SecretString) as {
        JWT_SECRET: string;
      };

      return { status: true, data: jwtSecret as T, error: null };
    } catch (err) {
      if (err instanceof Error) {
        return { status: false, data: null, error: err.message };
      }

      return {
        status: false,
        data: null,
        error: 'Failed to get secret from secrets maanger',
      };
    }
  }
}

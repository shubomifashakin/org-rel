import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { type Request } from 'express';
import { GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

import { TOKEN } from '../common/utils/constants.js';
import { verifyJwt } from '../../../common/utils/fns.js';
import { SecretsManagerService } from '../../../core/secrets-manager/secrets-manager.service.js';
import env from '../../../core/serverEnv/index.js';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly secretsManagerService: SecretsManagerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const accessToken = request.cookies?.[TOKEN.ACCESS.TYPE] as
      | string
      | undefined;

    if (!accessToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    try {
      //FIXME: CACHE THIS, uselike 10 minutess?
      const secret = await this.secretsManagerService.send(
        new GetSecretValueCommand({
          SecretId: env.JWT_SECRET_NAME,
        }),
      );

      if (!secret.SecretString) {
        throw new InternalServerErrorException('Internal Server Error');
      }

      const jwtSecret = JSON.parse(secret.SecretString) as {
        JWT_SECRET: string;
      };

      const { status, error, data } = await verifyJwt(
        accessToken,
        jwtSecret.JWT_SECRET,
      );

      if (!status) {
        //FIXME: USE BETTER LOGGER IMPLEMENTATION
        console.log(error);
        throw new UnauthorizedException('Unauthorized');
      }

      request.user = { id: data.sub!, email: data?.email as string };
      return true;
    } catch (error: unknown) {
      //FIXME: USE BETTER LOGGER IMPLEMENTATION
      console.error(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }
}

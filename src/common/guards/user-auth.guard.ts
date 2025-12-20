import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { type Request } from 'express';

import env from '../../core/serverEnv/index.js';
import { SecretsManagerService } from '../../core/secrets-manager/secrets-manager.service.js';

import { TOKEN } from '../utils/constants.js';
import { verifyJwt } from '../../common/utils/fns.js';

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
      const secret = await this.secretsManagerService.getSecret<{
        JWT_SECRET: string;
      }>(env.JWT_SECRET_NAME);

      if (!secret.status) {
        //FIXME: USE BETTER LOGGER IMPLMEMENTATION
        console.error(secret.error);
        throw new InternalServerErrorException('Internal Server Error');
      }

      const { status, error, data } = await verifyJwt(
        accessToken,
        secret.data.JWT_SECRET,
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

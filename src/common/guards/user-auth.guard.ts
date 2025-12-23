import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { type Request } from 'express';

import { RedisService } from '../../core/redis/redis.service.js';
import { JwtServiceService } from '../../core/jwt-service/jwt-service.service.js';
import { TOKEN } from '../utils/constants.js';
import { makeBlacklistedKey } from '../utils/fns.js';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtServiceService,
    private readonly redisService: RedisService,
  ) {}

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
      const { status, error, data } = await this.jwtService.verify(accessToken);

      if (!status) {
        //FIXME: USE BETTER LOGGER IMPLEMENTATION
        console.error(error);
        throw new InternalServerErrorException('Unauthorized');
      }

      if (!data || !data.jti) {
        throw new UnauthorizedException('Unauthorized');
      }

      //if this fails, do we want to throw an error  & potentiall block legit users??
      const blacklisted = await this.redisService.getFromCache<boolean>(
        makeBlacklistedKey(data.jti),
      );

      if (!blacklisted.status) {
        console.error(blacklisted.error);
      }

      if (blacklisted.data) {
        throw new UnauthorizedException('Unauthorized');
      }

      request.user = { id: data.sub!, email: data?.email as string };
      return true;
    } catch (error: unknown) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      //FIXME: USE BETTER LOGGER IMPLEMENTATION
      console.error(error);
      throw new InternalServerErrorException('Internal Server Error');
    }
  }
}

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { type Request } from 'express';

import { JwtServiceService } from '../../core/jwt-service/jwt-service.service.js';
import { TOKEN } from '../utils/constants.js';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtServiceService) {}

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

      if (!data) {
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

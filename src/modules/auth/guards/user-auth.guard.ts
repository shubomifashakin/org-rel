import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { type Request } from 'express';
import { TOKEN } from '../common/utils/constants.js';

@Injectable()
export class UserAuthGuard implements CanActivate {
  constructor() {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const accessToken = request.cookies?.[TOKEN.ACCESS.TYPE] as
      | string
      | undefined;

    if (!accessToken) {
      throw new UnauthorizedException('Unauthorized');
    }

    //FIXME: EXTRACT THE CLAIMS AND APPEND THE SUB TO THE REQUEST

    return true;
  }
}

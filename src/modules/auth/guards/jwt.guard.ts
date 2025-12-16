import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Roles } from '../common/decorators/roles.decorators.js';
import { Request } from 'express';

@Injectable()
export class JWTGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> {
    const roles = this.reflector.get(Roles, context.getHandler());

    if (!roles) {
      return true;
    }
    const request = context.switchToHttp().getRequest<Request>();
    const usersRole = request?.user?.role;

    if (!usersRole) {
      throw new UnauthorizedException('Unauthorized');
    }

    return true;
  }
}

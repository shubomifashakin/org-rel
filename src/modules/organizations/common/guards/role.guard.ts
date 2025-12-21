import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { DatabaseService } from '../../../../core/database/database.service.js';
import { RedisService } from '../../../../core/redis/redis.service.js';

import { ROLES_KEY } from '../decorators/role.decorator.js';
import { cacheKeys } from '../../utils.js';
import { CachedUser } from '../../types/index.js';
import { Roles } from '../../../../../generated/prisma/enums.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const requiredRolesForHandler = this.reflector.get<Roles[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    if (!requiredRolesForHandler) {
      return true;
    }

    const userId = request.user.id;
    const { organizationId } = request.params;

    if (!organizationId) {
      throw new BadRequestException('Invalid Organization Id');
    }

    const cacheIdentifier = `${cacheKeys.ORGANIZATION}${organizationId}:${cacheKeys.USER}${userId}`;
    const cachedUserRole =
      await this.redisService.getFromCache<CachedUser>(cacheIdentifier);

    if (
      cachedUserRole.status &&
      cachedUserRole.data &&
      !requiredRolesForHandler.includes(cachedUserRole.data.role)
    ) {
      throw new ForbiddenException();
    }

    if (
      cachedUserRole.status &&
      cachedUserRole.data &&
      requiredRolesForHandler.includes(cachedUserRole.data.role)
    ) {
      return true;
    }

    //if getting the users role from cache failed, log it
    if (!cachedUserRole.status) {
      //FIXME: USE BETTER LOGGER
      console.error(cachedUserRole.error);
    }

    const roleUserHas =
      await this.databaseService.organizationsOnUsers.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
        select: {
          role: true,
          user: {
            select: {
              id: true,
              email: true,
              image: true,
              fullname: true,
              username: true,
            },
          },
        },
      });

    if (!roleUserHas) {
      throw new ForbiddenException();
    }

    const cachedUser = {
      role: roleUserHas.role,
      id: roleUserHas.user.id,
      email: roleUserHas.user.email,
      image: roleUserHas.user.image,
      fullname: roleUserHas.user.fullname,
      username: roleUserHas.user.username,
    } satisfies CachedUser;

    const { status, error } = await this.redisService.setInCache(
      cacheIdentifier,
      cachedUser,
    );

    if (!status) {
      //FIXME: USE BETTER LOGGER
      console.error(error);
    }

    if (!requiredRolesForHandler.includes(roleUserHas.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}

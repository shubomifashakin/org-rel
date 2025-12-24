import { Reflector } from '@nestjs/core';
import { type Request } from 'express';
import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

import { RedisService } from '../../../../core/redis/redis.service.js';
import { DatabaseService } from '../../../../core/database/database.service.js';
import { AppLoggerService } from '../../../../core/app-logger/app-logger.service.js';

import { MINUTES_10 } from '../../../../common/utils/constants.js';

import { ROLES_KEY } from '../decorators/role.decorator.js';
import { makeUserCacheKey } from '../utils.js';
import { CachedUser } from '../../types/index.js';
import { Roles } from '../../../../../generated/prisma/enums.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly loggerService: AppLoggerService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const requiredRolesForHandler = this.reflector.get<Roles[]>(
      ROLES_KEY,
      context.getHandler(),
    );

    if (!requiredRolesForHandler || !requiredRolesForHandler?.length) {
      return true;
    }

    const userId = request.user.id;
    const { organizationId } = request.params;

    if (!organizationId) {
      throw new BadRequestException('Invalid Organization Id');
    }

    const cacheIdentifier = makeUserCacheKey(organizationId, userId);
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
      this.loggerService.logError({
        reason: cachedUserRole.error,
        message: 'RoleGuard: Failed to get organization user info from cache',
      });
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
      MINUTES_10,
    );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: 'RoleGuard: Failed to store organization user info in cache',
      });
    }

    if (!requiredRolesForHandler.includes(roleUserHas.role)) {
      throw new ForbiddenException();
    }

    return true;
  }
}

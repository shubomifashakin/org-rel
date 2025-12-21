import { Request } from 'express';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';

import { MINUTES_10 } from '../../../../common/utils/constants.js';
import { DatabaseService } from '../../../../core/database/database.service.js';
import { RedisService } from '../../../../core/redis/redis.service.js';
import { makeUserCacheKey } from '../utils.js';
import { CachedUser } from '../../types/index.js';

@Injectable()
export class IsMemberGuard implements CanActivate {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    const userId = request.user.id;
    const { organizationId } = request.params;

    const cacheIdentifier = makeUserCacheKey(organizationId, userId);

    const { status, data, error } =
      await this.redisService.getFromCache<CachedUser>(cacheIdentifier);

    if (status && data) {
      return true;
    }

    if (!status) {
      //FIXME: USE A BETTER ERROR LOGGER
      console.error(error);
    }

    const isMember = await this.databaseService.organizationsOnUsers.findUnique(
      {
        where: {
          organizationId_userId: {
            userId,
            organizationId,
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
      },
    );

    if (!isMember) {
      return false;
    }

    const cachedUser = {
      role: isMember.role,
      id: isMember.user.id,
      email: isMember.user.email,
      image: isMember.user.image,
      fullname: isMember.user.fullname,
      username: isMember.user.username,
    } satisfies CachedUser;

    const { status: setInCacheStatus, error: setInCacheError } =
      await this.redisService.setInCache(
        cacheIdentifier,
        cachedUser,
        MINUTES_10,
      );

    if (!setInCacheStatus) {
      //FIXME: USE BETTER LOGGER
      console.error(setInCacheError);
    }

    return !!isMember;
  }
}

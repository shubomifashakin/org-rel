import { type Request } from 'express';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Inject } from '@nestjs/common';

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client';

import { CachedUser } from '../types/index.js';

import { RedisService } from '../../../core/redis/redis.service.js';
import { DatabaseService } from '../../../core/database/database.service.js';
import { AppLoggerService } from '../../../core/app-logger/app-logger.service.js';

import { makeUserCacheKey } from '../common/utils.js';
import { MINUTES_10 } from '../../../common/utils/constants.js';
import { UpdateOrgUserDto } from '../dto/update-org-user.dto.js';

@Injectable()
export class OrganizationsUserService {
  constructor(
    private readonly redisService: RedisService,
    private readonly databaseService: DatabaseService,
    private readonly loggerService: AppLoggerService,
    @Inject(REQUEST) private readonly request: Request,
  ) {}

  async getOrgUsers(organizationId: string, next?: string) {
    const limit = 10;

    const users = await this.databaseService.organizationsOnUsers.findMany({
      where: {
        organizationId,
      },
      select: {
        role: true,
        user: {
          select: {
            id: true,
            email: true,
            image: true,
            username: true,
            fullname: true,
          },
        },
      },
      take: limit + 1,
      cursor: next
        ? {
            organizationId_userId: {
              userId: next,
              organizationId: organizationId,
            },
          }
        : undefined,
    });

    const hasNextPage = users.length > limit;
    const cursor = hasNextPage ? users[users.length - 1]?.user.id : undefined;
    const validUsers = users.slice(0, limit);
    const allUsers = validUsers.map((user) => ({
      ...user.user,
      role: user.role,
    }));

    return {
      users: allUsers,
      hasNextPage,
      ...(cursor && { cursor }),
    };
  }

  async getOneOrgUser(
    organizationId: string,
    userId: string,
  ): Promise<CachedUser> {
    const { status, data, error } =
      await this.redisService.getFromCache<CachedUser>(
        makeUserCacheKey(organizationId, userId),
      );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        req: this.request,
        message: 'Failed to get organization user from cache',
      });
    }

    if (status && data) {
      return data;
    }

    const user = await this.databaseService.organizationsOnUsers.findUnique({
      where: {
        organizationId_userId: {
          userId,
          organizationId,
        },
      },
      select: {
        user: {
          select: {
            id: true,
            image: true,
            email: true,
            fullname: true,
            username: true,
          },
        },
        role: true,
      },
    });

    if (!user) {
      throw new NotFoundException('user does not exist');
    }

    const userInfo = user.user;
    const userRole = user.role;

    const cachedUser = {
      ...userInfo,
      role: userRole,
    } satisfies CachedUser;

    const storeInCache = await this.redisService.setInCache(
      makeUserCacheKey(organizationId, userId),
      cachedUser,
      MINUTES_10,
    );

    if (!storeInCache.status) {
      this.loggerService.logError({
        reason: error,
        req: this.request,
        message: 'Failed to store organization user in cache',
      });
    }

    return cachedUser;
  }

  async updateOneOrgUsersRole(
    organizationId: string,
    userId: string,
    updateOrgUserDto: UpdateOrgUserDto,
  ) {
    try {
      const userIsAdmin =
        await this.databaseService.organizationsOnUsers.findUnique({
          where: {
            organizationId_userId: {
              organizationId,
              userId,
            },
          },
          select: {
            role: true,
          },
        });

      if (!userIsAdmin) {
        throw new NotFoundException('User does not exist');
      }

      if (userIsAdmin.role === 'ADMIN' && updateOrgUserDto.role !== 'ADMIN') {
        const otherAdminsExist =
          await this.databaseService.organizationsOnUsers.findFirst({
            where: {
              organizationId,
              role: 'ADMIN',
              AND: {
                NOT: {
                  userId,
                },
              },
            },
          });

        if (!otherAdminsExist) {
          throw new BadRequestException(
            'An organization must have at least 1 admin!',
          );
        }
      }

      const user = await this.databaseService.organizationsOnUsers.update({
        where: {
          organizationId_userId: {
            userId,
            organizationId,
          },
        },
        data: {
          role: updateOrgUserDto.role,
        },
        select: {
          user: {
            select: {
              id: true,
              email: true,
              image: true,
              fullname: true,
              username: true,
            },
          },
          role: true,
        },
      });

      const updatedUser = {
        ...user.user,
        role: user.role,
      } satisfies CachedUser;

      const { status, error } = await this.redisService.setInCache(
        makeUserCacheKey(organizationId, userId),
        updatedUser,
        MINUTES_10,
      );

      if (!status) {
        this.loggerService.logError({
          reason: error,
          req: this.request,
          message: 'Failed to store organization user in cache',
        });
      }

      return { message: 'Success' };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('User does not exist');
        }
      }

      throw error;
    }
  }

  async deleteOneOrgUser(organizationId: string, userId: string) {
    const userExist =
      await this.databaseService.organizationsOnUsers.findUnique({
        where: {
          organizationId_userId: {
            userId,
            organizationId,
          },
        },
        select: {
          role: true,
        },
      });

    if (!userExist) {
      return { message: 'Success' };
    }

    //prevent deleting all admin users
    if (userExist.role === 'ADMIN') {
      const otherAdminsExist =
        await this.databaseService.organizationsOnUsers.findFirst({
          where: {
            organizationId,
            role: 'ADMIN',
            AND: {
              NOT: {
                userId,
              },
            },
          },
        });

      if (!otherAdminsExist) {
        throw new BadRequestException(
          'An organization must have at least 1 admin!',
        );
      }
    }

    await this.databaseService.organizationsOnUsers.delete({
      where: {
        organizationId_userId: {
          userId,
          organizationId,
        },
      },
    });

    const { status, error } = await this.redisService.deleteFromCache(
      makeUserCacheKey(organizationId, userId),
    );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        req: this.request,
        message: 'Failed to delete organization user from cache',
      });
    }

    return { message: 'Success' };
  }
}

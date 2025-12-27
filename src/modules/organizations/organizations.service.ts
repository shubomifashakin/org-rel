import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { S3Service } from '../../core/s3/s3.service.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { AppConfigService } from '../../core/app-config/app-config.service.js';
import { AppLoggerService } from '../../core/app-logger/app-logger.service.js';

import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';

import { makeOrganizationCacheKey } from './common/utils.js';
import { Organizations } from '../../../generated/prisma/client.js';
import { FnResult } from '../../types/fnResult.js';

type CachedOrg = Pick<Organizations, 'id' | 'name' | 'image' | 'createdAt'>;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly configService: AppConfigService,
    private readonly loggerService: AppLoggerService,
  ) {}

  private async uploadToS3(
    image: Express.Multer.File,
  ): Promise<FnResult<string>> {
    const imageKey = uuid();

    const { status, data, error } = this.configService.S3BucketName;

    if (!status) {
      return { status: false, data: null, error };
    }

    const result = await this.s3Service.uploadToS3(data, image, imageKey);

    return result;
  }

  async createOrganization(
    createOrganizationDto: CreateOrganizationDto,
    userId: string,
    image?: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
      const { status, error, data } = await this.uploadToS3(image);

      if (!status) {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to upload image to S3',
        });
      }

      if (status) {
        s3Url = data;
      }
    }

    const org = (await this.databaseService.organizations.create({
      data: {
        name: createOrganizationDto.name,
        image: s3Url,
        users: {
          create: {
            userId,
            role: 'ADMIN',
          },
        },
      },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
      },
    })) satisfies CachedOrg;

    const { status, error } = await this.redisService.setInCache(
      makeOrganizationCacheKey(org.id),
      org,
    );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to store organization info in cache',
      });
    }

    return { id: org.id };
  }

  async getOrganizationsUserIsMemberOf(userId: string, next?: string) {
    const limit = 10;

    const orgs = await this.databaseService.organizationsOnUsers.findMany({
      where: {
        userId,
      },
      select: {
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
        assignedAt: true,
      },
      take: limit + 1,
      cursor: next
        ? {
            organizationId_userId: {
              organizationId: next,
              userId: userId,
            },
          }
        : undefined,
      orderBy: {
        assignedAt: 'desc',
      },
    });

    const transformed = orgs.slice(0, limit).map((org) => {
      return {
        role: org.role,
        id: org.organization.id,
        name: org.organization.name,
        image: org.organization.image,
        assignedAt: org.assignedAt,
      };
    });

    const hasNextPage = orgs.length > limit;
    const cursor = hasNextPage
      ? orgs[orgs.length - 1]?.organization.id
      : undefined;

    return {
      organizations: transformed,
      hasNextPage,
      ...(cursor && { cursor }),
    };
  }

  async getOneOrganization(id: string) {
    const { status, error, data } =
      await this.redisService.getFromCache<CachedOrg>(
        makeOrganizationCacheKey(id),
      );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to get organization info from cache',
      });
    }

    if (status && data) {
      return data;
    }

    const organization = (await this.databaseService.organizations.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
      },
    })) satisfies CachedOrg | null;

    if (!organization) {
      throw new NotFoundException('Organization does not exist');
    }

    const cachedOrg = organization;

    const storeInCache = await this.redisService.setInCache(
      makeOrganizationCacheKey(id),
      cachedOrg,
    );

    if (!storeInCache.status) {
      this.loggerService.logError({
        reason: storeInCache.error,
        message: 'Failed to store organization info in cache',
      });
    }

    return cachedOrg;
  }

  async updateOneOrganization(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
    image?: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
      const { status, error, data } = await this.uploadToS3(image);

      if (!status) {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to upload image to S3',
        });

        throw new InternalServerErrorException('Internal Server Error');
      }

      s3Url = data;
    }

    const org = (await this.databaseService.organizations.update({
      where: { id },
      data: {
        image: s3Url,
        name: updateOrganizationDto.name,
      },
      select: {
        id: true,
        name: true,
        image: true,
        createdAt: true,
      },
    })) satisfies CachedOrg;

    const { status, error } = await this.redisService.setInCache(
      makeOrganizationCacheKey(id),
      org,
    );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to store organization info in cache',
      });
    }

    return { message: 'success' };
  }

  async deleteOneOrganization(id: string) {
    const orgExists = await this.databaseService.organizations.findUnique({
      where: { id },
    });

    if (!orgExists) {
      return { message: 'success' };
    }

    await this.databaseService.organizations.delete({
      where: { id },
    });

    const { status, error } = await this.redisService.deleteFromCache(
      makeOrganizationCacheKey(id),
    );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: `Failed to delete ${makeOrganizationCacheKey(id)} info from cache`,
      });
    }

    return { message: 'success' };
  }
}

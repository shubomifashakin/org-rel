import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { Projects } from '../../../../generated/prisma/client.js';

import { S3Service } from '../../../core/s3/s3.service.js';
import { RedisService } from '../../../core/redis/redis.service.js';
import { DatabaseService } from '../../../core/database/database.service.js';
import { AppConfigService } from '../../../core/app-config/app-config.service.js';
import { AppLoggerService } from '../../../core/app-logger/app-logger.service.js';

import { makeProjectCacheKey } from '../common/utils.js';

import { CreateProjectDto } from '../dto/create-project.dto.js';
import { UpdateProjectDto } from '../dto/update-project.dto.js';

type CachedProject = Pick<
  Projects,
  'id' | 'name' | 'image' | 'userId' | 'organizationId'
>;

@Injectable()
export class OrganizationsProjectsService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
    private readonly s3Service: S3Service,
    private readonly configService: AppConfigService,
    private readonly loggerService: AppLoggerService,
  ) {}

  private async uploadToS3(image: Express.Multer.File) {
    const imageKey = uuid();

    const { status, error, data } = this.configService.S3BucketName;

    if (!status) {
      return { status, error, data };
    }

    const result = await this.s3Service.uploadToS3(data, image, imageKey);

    return result;
  }

  async getAllOrgProjects(id: string, next?: string) {
    const limit = 10;
    const projects = await this.databaseService.projects.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        name: true,
        image: true,
        userId: true,
        organizationId: true,
      },
      take: limit + 1,
      ...(next && { cursor: { id: next } }),
      orderBy: {
        createdAt: 'desc',
      },
    });

    const hasNextPage = projects.length > limit;
    const cursor = hasNextPage ? projects[projects.length - 1]?.id : undefined;
    return {
      projects: projects.slice(0, limit),
      hasNextPage,
      ...(cursor && { cursor }),
    };
  }

  async createOrgProject(
    organizationId: string,
    createProjectDto: CreateProjectDto,
    image?: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
      const { status, error, data } = await this.uploadToS3(image);

      if (!status) {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to upload image to S3',
          context: `${OrganizationsProjectsService.name}.createOrgProject`,
        });
      }

      if (status) {
        s3Url = data;
      }
    }

    const isMember = await this.databaseService.organizationsOnUsers.findUnique(
      {
        where: {
          organizationId_userId: {
            userId: createProjectDto.userId,
            organizationId,
          },
        },
      },
    );

    if (!isMember) {
      throw new ForbiddenException('User is not a member of the organization');
    }

    const project = (await this.databaseService.projects.create({
      data: {
        name: createProjectDto.name,
        userId: createProjectDto.userId,
        image: s3Url,
        organizationId,
      },
      select: {
        id: true,
        name: true,
        image: true,
        userId: true,
        organizationId: true,
      },
    })) satisfies CachedProject;

    const { status, error } = await this.redisService.setInCache(
      makeProjectCacheKey(organizationId, project.id),
      project,
    );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to store project in cache',
        context: `${OrganizationsProjectsService.name}.createOrgProject`,
      });
    }

    return { id: project.id };
  }

  async getOneOrgProject(
    organizationId: string,
    projectId: string,
  ): Promise<CachedProject> {
    const { status, error, data } =
      await this.redisService.getFromCache<CachedProject>(
        makeProjectCacheKey(organizationId, projectId),
      );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to get project from cache',
        context: `${OrganizationsProjectsService.name}.getOneOrgProject`,
      });
    }

    if (status && data) {
      return data;
    }

    const project = (await this.databaseService.projects.findUnique({
      where: { id: projectId, organizationId },
      select: {
        id: true,
        name: true,
        image: true,
        organizationId: true,
        userId: true,
      },
    })) satisfies CachedProject | null;

    if (!project) {
      throw new NotFoundException('Project does not exist');
    }

    const storeInCache = await this.redisService.setInCache(
      makeProjectCacheKey(organizationId, projectId),
      project,
    );

    if (!storeInCache.status) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to store project in cache',
        context: `${OrganizationsProjectsService.name}.getOneOrgProject`,
      });
    }

    return project;
  }

  async updateOneOrgProject(
    orgId: string,
    projectId: string,
    updateProjectDto: UpdateProjectDto,
    image?: Express.Multer.File,
  ) {
    if (updateProjectDto?.userId) {
      const isMember =
        await this.databaseService.organizationsOnUsers.findUnique({
          where: {
            organizationId_userId: {
              userId: updateProjectDto.userId,
              organizationId: orgId,
            },
          },
        });

      if (!isMember) {
        throw new ForbiddenException(
          'User is not a member of the organization',
        );
      }
    }

    let s3Url: string | undefined = undefined;

    if (image) {
      const { status, error, data } = await this.uploadToS3(image);

      if (!status) {
        this.loggerService.logError({
          reason: error,
          message: 'Failed to upload image to S3',
          context: `${OrganizationsProjectsService.name}.updateOneOrgProject`,
        });

        throw new InternalServerErrorException('Internal Server Error');
      }

      s3Url = data;
    }

    const project = (await this.databaseService.projects.update({
      where: {
        id: projectId,
        organizationId: orgId,
      },
      data: {
        image: s3Url,
        name: updateProjectDto?.name,
        userId: updateProjectDto?.userId,
      },
      select: {
        id: true,
        name: true,
        image: true,
        userId: true,
        organizationId: true,
      },
    })) satisfies CachedProject;

    const { status, error } = await this.redisService.setInCache(
      makeProjectCacheKey(orgId, projectId),
      project,
    );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to store project in cache',
        context: `${OrganizationsProjectsService.name}.updateOneOrgProject`,
      });
    }

    return { message: 'success' };
  }

  async deleteOneOrgProject(organizationId: string, projectId: string) {
    const projectExists = await this.databaseService.projects.findUnique({
      where: {
        id: projectId,
        organizationId,
      },
    });

    if (!projectExists) {
      return { message: 'success' };
    }

    await this.databaseService.projects.delete({
      where: {
        id: projectId,
        organizationId,
      },
    });

    const { status, error } = await this.redisService.deleteFromCache(
      makeProjectCacheKey(organizationId, projectId),
    );

    if (!status) {
      this.loggerService.logError({
        reason: error,
        message: 'Failed to delete project from cache',
        context: `${OrganizationsProjectsService.name}.deleteOneOrgProject`,
      });
    }

    return { message: 'success' };
  }
}

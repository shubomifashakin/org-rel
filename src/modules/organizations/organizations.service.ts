import { Injectable, NotFoundException } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { S3Service } from '../../core/s3/s3.service.js';
import { UpdateOrgUserDto } from './dto/update-org-user.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/updateProject.dto.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { cacheKeys } from './utils.js';
import {
  Organizations,
  Projects,
  Roles,
} from '../../../generated/prisma/client.js';

type CachedUser = {
  id: string;
  email: string;
  fullname: string;
  image: string | null;
  username: string;
  role: Roles;
};

type CachedProject = Pick<
  Projects,
  'id' | 'name' | 'image' | 'userId' | 'organizationId'
>;

type CachedOrg = Pick<Organizations, 'id' | 'name' | 'image'>;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  private async uploadToS3(
    image: Express.Multer.File,
  ): Promise<string | undefined> {
    try {
      const imageKey = uuid();
      const bucket = process.env.BUCKET_NAME!;

      await this.s3Service.send(
        new PutObjectCommand({
          Key: imageKey,
          Bucket: bucket,
          Body: image.buffer,
          ContentType: image.mimetype,
        }),
      );

      return `https://${bucket}.s3.amazonaws.com/${imageKey}`;
    } catch (error) {
      console.error(error);
      //FIXME: LOG ERROR PROPERLY
      return undefined;
    }
  }

  private makeUserCacheKey(orgId: string, userId: string) {
    return `${cacheKeys.ORGANIZATION}${orgId}${cacheKeys.USER}${userId}`;
  }

  private makeProjectCacheKey(orgId: string, projectId: string) {
    return `${cacheKeys.ORGANIZATION}${orgId}${cacheKeys.PROJECT}${projectId}`;
  }

  private makeOrganizationCacheKey(orgId: string) {
    return `${cacheKeys.ORGANIZATION}${orgId}`;
  }

  async createOrganization(
    createOrganizationDto: CreateOrganizationDto,
    userId: string,
    image?: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
      s3Url = await this.uploadToS3(image);
    }

    const org = await this.databaseService.organizations.create({
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
      },
    });

    await this.redisService
      .setInCache(this.makeOrganizationCacheKey(org.id), org)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGING
        console.error('Error caching organization in Redis:', error);
      });

    return { message: 'Success' };
  }

  async getOneOrganization(id: string) {
    const cache = await this.redisService
      .getFromCache<CachedOrg>(this.makeOrganizationCacheKey(id))
      .catch((error) => {
        //FIXME
        console.error(error);
        return null;
      });

    if (cache) {
      return cache;
    }

    const organization = await this.databaseService.organizations.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    await this.redisService
      .setInCache(this.makeOrganizationCacheKey(id), organization)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGING
        console.error('Error caching organization in Redis:', error);
      });

    return organization;
  }

  async updateOneOrganization(
    id: string,
    updateOrganizationDto: UpdateOrganizationDto,
    image?: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
      s3Url = await this.uploadToS3(image);
    }

    const org = await this.databaseService.organizations.update({
      where: { id },
      data: {
        image: s3Url,
        name: updateOrganizationDto.name,
      },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });

    await this.redisService
      .setInCache(this.makeOrganizationCacheKey(id), org)
      .catch((error) => {
        //FIXME
        console.error('Error updating organization in cache:', error);
        return null;
      });

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

    await this.redisService
      .deleteFromCache(this.makeOrganizationCacheKey(id))
      .catch((error) => {
        //FIXME
        console.error(error);
        return null;
      });

    return { message: 'success' };
  }

  // USERs
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

    const cursor = users[users.length - 1]?.user.id;
    const validUsers = users.slice(0, limit);
    const allUsers = validUsers.map((user) => ({
      ...user.user,
      role: user.role,
    }));

    return {
      users: allUsers,
      hasNextPage: users.length > limit,
      ...(cursor && { cursor }),
    };
  }

  async getOneOrgUser(
    organizationId: string,
    userId: string,
  ): Promise<CachedUser> {
    const cache = await this.redisService
      .getFromCache<CachedUser>(this.makeUserCacheKey(organizationId, userId))
      .catch((error) => {
        //FIXME:
        console.error('Error fetching organization user from cache:', error);
        return null;
      });

    if (cache) {
      return cache;
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

    await this.redisService
      .setInCache(this.makeUserCacheKey(organizationId, userId), cachedUser)
      .catch((error) => {
        //FIXME:
        console.error('Error setting organization user in cache:', error);
        return null;
      });

    return cachedUser;
  }

  async updateOneOrgUser(
    organizationId: string,
    userId: string,
    updateOrgUserDto: UpdateOrgUserDto,
  ) {
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

    await this.redisService
      .setInCache(this.makeUserCacheKey(organizationId, userId), updatedUser)
      .catch((error) => {
        //FIXME:
        console.error('Error updating organization user in cache:', error);
        return null;
      });

    return { message: 'Success' };
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
      });

    if (!userExist) {
      return { message: 'Success' };
    }

    await this.databaseService.organizationsOnUsers.delete({
      where: {
        organizationId_userId: {
          userId,
          organizationId,
        },
      },
    });

    await this.redisService
      .deleteFromCache(this.makeUserCacheKey(organizationId, userId))
      .catch((error) => {
        //FIXME:
        console.error('Error deleting organization user from cache:', error);
        return null;
      });

    return { message: 'Success' };
  }

  //PROJECTS
  async getOrgProjects(id: string, next?: string) {
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
        id: 'desc',
        createdAt: 'desc',
      },
    });

    const cursor = projects[projects.length - 1]?.id;
    return {
      projects: projects.slice(0, limit),
      hasNextPage: projects.length > limit,
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
      s3Url = await this.uploadToS3(image);
    }

    const project = await this.databaseService.projects.create({
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
    });

    await this.redisService
      .setInCache(this.makeProjectCacheKey(organizationId, project.id), project)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGING
        console.error('Error caching project in Redis:', error);
      });

    return { message: 'success' };
  }

  async getOneOrgProject(
    organizationId: string,
    projectId: string,
  ): Promise<CachedProject> {
    const cachedProject = await this.redisService
      .getFromCache<CachedProject>(
        this.makeProjectCacheKey(organizationId, projectId),
      )
      .catch((error) => {
        console.error('Error fetching project from Redis:', error);
        return null;
      });

    if (cachedProject) {
      return cachedProject;
    }

    const project = await this.databaseService.projects.findUnique({
      where: { id: projectId, organizationId },
      select: {
        id: true,
        name: true,
        image: true,
        organizationId: true,
        userId: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.redisService
      .setInCache(this.makeProjectCacheKey(organizationId, projectId), project)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGING
        console.error('Error caching project in Redis:', error);
      });

    return project;
  }

  async updateOneOrgProject(
    orgId: string,
    projectId: string,
    updateProjectDto: UpdateProjectDto,
    image?: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
      s3Url = await this.uploadToS3(image);
    }

    const project = await this.databaseService.projects.update({
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
    });

    await this.redisService
      .setInCache(this.makeProjectCacheKey(orgId, projectId), project)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGER
        console.error('Error updating project in Redis:', error);
      });

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

    await this.redisService
      .deleteFromCache(this.makeProjectCacheKey(organizationId, projectId))
      .catch((error) => {
        //FIXME:
        console.error('Error deleting project from cache:', error);
        return null;
      });

    return { message: 'success' };
  }
}

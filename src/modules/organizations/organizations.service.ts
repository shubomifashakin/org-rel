import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { DatabaseService } from '../../core/database/database.service.js';
import { S3Service } from '../../core/s3/s3.service.js';
import { RedisService } from '../../core/redis/redis.service.js';
import env from '../../core/serverEnv/index.js';

import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { UpdateOrgUserDto } from './dto/update-org-user.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

import { cacheKeys } from './utils.js';
import { Organizations, Projects } from '../../../generated/prisma/client.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { UpdateInviteDto } from './dto/update-invite.dto.js';
import { CachedUser } from './types/index.js';

type CachedProject = Pick<
  Projects,
  'id' | 'name' | 'image' | 'userId' | 'organizationId'
>;

type CachedOrg = Pick<Organizations, 'id' | 'name' | 'image' | 'createdAt'>;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly databaseService: DatabaseService,
    private readonly redisService: RedisService,
  ) {}

  private async uploadToS3(image: Express.Multer.File) {
    const imageKey = uuid();

    const result = await this.s3Service.uploadToS3(
      env.S3_BUCKET_NAME,
      image,
      imageKey,
    );

    return result;
  }

  private makeUserCacheKey(orgId: string, userId: string) {
    return `${cacheKeys.ORGANIZATION}${orgId}:${cacheKeys.USER}${userId}`;
  }

  private makeProjectCacheKey(orgId: string, projectId: string) {
    return `${cacheKeys.ORGANIZATION}${orgId}:${cacheKeys.PROJECT}${projectId}`;
  }

  private makeOrganizationCacheKey(orgId: string) {
    return `${cacheKeys.ORGANIZATION}${orgId}`;
  }

  async createOrganization(
    createOrganizationDto: CreateOrganizationDto,
    userId: string,
    image?: Express.Multer.File,
  ) {
    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    let s3Url: string | undefined = undefined;

    if (image) {
      const { status, error, data } = await this.uploadToS3(image);

      if (!status) {
        console.error(error);
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
      this.makeOrganizationCacheKey(org.id),
      org,
    );

    if (!status) {
      console.error(error);
    }

    return { id: org.id };
  }

  async getOneOrganization(id: string) {
    const { status, error, data } =
      await this.redisService.getFromCache<CachedOrg>(
        this.makeOrganizationCacheKey(id),
      );

    if (!status) {
      console.error(error);
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
      throw new NotFoundException('Organization not found');
    }

    const cachedOrg = organization;

    const storeInCache = await this.redisService.setInCache(
      this.makeOrganizationCacheKey(id),
      cachedOrg,
    );

    if (!storeInCache.status) {
      console.error(storeInCache.error);
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
        console.error(error);
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
      this.makeOrganizationCacheKey(id),
      org,
    );

    if (!status) {
      console.error(error);
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
      this.makeOrganizationCacheKey(id),
    );

    if (!status) {
      console.error(error);
    }

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

  async inviteOneUser(
    userId: string,
    organizationId: string,
    inviteUserDto: InviteUserDto,
  ) {
    const usersName = await this.databaseService.users.findUnique({
      where: { id: userId },
      select: { fullname: true },
    });

    if (!usersName) {
      throw new NotFoundException('User Not Found');
    }

    const organizationName =
      await this.databaseService.organizations.findUnique({
        where: {
          id: organizationId,
        },
        select: {
          name: true,
        },
      });

    if (!organizationName) {
      throw new NotFoundException('Organization Not Found');
    }

    const invitedUsersEmail = inviteUserDto.email;
    const invitedUsersRole = inviteUserDto.role;

    await this.databaseService.invites.create({
      data: {
        organizationId,
        email: invitedUsersEmail,
        invitedByUserId: userId,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
    });

    //FIXME: SEND A MAIL TO THE INVITED USER
    //send a mail to the user stating the role they are being invited for and the person inviting them
    console.log(invitedUsersEmail, invitedUsersRole);
  }

  async getAllInvites(organizationId: string, next?: string) {
    const limit = 10;
    const invites = await this.databaseService.invites.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        email: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        invitedByUserId: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      cursor: next
        ? {
            id: next,
          }
        : undefined,
    });

    const hasNextPage = invites.length > limit;
    const items = invites.slice(0, limit);
    const cursor = invites[invites.length - 1]?.id;

    return {
      invites: items,
      hasNextPage,
      ...(cursor && { cursor }),
    };
  }

  async updateInvite(
    organizationId: string,
    inviteId: string,
    updateInvite: UpdateInviteDto,
  ) {
    await this.databaseService.invites.update({
      where: {
        id: inviteId,
        organizationId,
      },
      data: {
        status: updateInvite.status,
      },
    });

    return { message: 'status' };
  }

  async getOneOrgUser(
    organizationId: string,
    userId: string,
  ): Promise<CachedUser> {
    const { status, data, error } =
      await this.redisService.getFromCache<CachedUser>(
        this.makeUserCacheKey(organizationId, userId),
      );

    if (!status) {
      console.error(error);
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
      this.makeUserCacheKey(organizationId, userId),
      cachedUser,
    );

    if (!storeInCache.status) {
      console.error(storeInCache.error);
    }

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

    const { status, error } = await this.redisService.setInCache(
      this.makeUserCacheKey(organizationId, userId),
      updatedUser,
    );

    if (!status) {
      console.error(error);
    }

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

    const { status, error } = await this.redisService.deleteFromCache(
      this.makeUserCacheKey(organizationId, userId),
    );

    if (!status) {
      console.error(error);
    }

    return { message: 'Success' };
  }

  //PROJECTS
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
      const { status, error, data } = await this.uploadToS3(image);

      if (!status) {
        console.error(error);
      }

      if (status) {
        s3Url = data;
      }
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
      this.makeProjectCacheKey(organizationId, project.id),
      project,
    );

    if (!status) {
      console.error(error);
    }

    return { message: 'success' };
  }

  async getOneOrgProject(
    organizationId: string,
    projectId: string,
  ): Promise<CachedProject> {
    const { status, error, data } =
      await this.redisService.getFromCache<CachedProject>(
        this.makeProjectCacheKey(organizationId, projectId),
      );

    if (!status) {
      console.error(error);
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
      throw new NotFoundException('Project not found');
    }

    const storeInCache = await this.redisService.setInCache(
      this.makeProjectCacheKey(organizationId, projectId),
      project,
    );

    if (!storeInCache.status) {
      console.error(storeInCache.error);
    }

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
      const { status, error, data } = await this.uploadToS3(image);

      if (!status) {
        console.error(error);
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
      this.makeProjectCacheKey(orgId, projectId),
      project,
    );

    if (!status) {
      console.error(error);
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
      this.makeProjectCacheKey(organizationId, projectId),
    );

    if (!status) {
      console.error(error);
    }

    return { message: 'success' };
  }
}

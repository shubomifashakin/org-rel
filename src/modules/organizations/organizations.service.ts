import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { v4 as uuid } from 'uuid';

import { DatabaseService } from '../../core/database/database.service.js';
import { S3Service } from '../../core/s3/s3.service.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { MINUTES_10 } from '../../common/utils/constants.js';
import env from '../../core/serverEnv/index.js';

import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { UpdateOrgUserDto } from './dto/update-org-user.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';

import {
  makeOrganizationCacheKey,
  makeProjectCacheKey,
  makeUserCacheKey,
} from './common/utils.js';
import { Organizations, Projects } from '../../../generated/prisma/client.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { CachedUser } from './types/index.js';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/client.js';

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
        //FIXME: USE LOGGER IMPLEMENTATION
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
      makeOrganizationCacheKey(org.id),
      org,
    );

    if (!status) {
      console.error(error);
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

    const cursor = orgs[orgs.length - 1]?.organization.id;

    return {
      organizations: transformed,
      hasNextPage: orgs.length > limit,
      ...(cursor && { cursor }),
    };
  }

  async getOneOrganization(id: string) {
    const { status, error, data } =
      await this.redisService.getFromCache<CachedOrg>(
        makeOrganizationCacheKey(id),
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
      makeOrganizationCacheKey(id),
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
      makeOrganizationCacheKey(id),
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
      makeOrganizationCacheKey(id),
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

  //USERS INVITES
  async inviteOneUser(
    userId: string,
    organizationId: string,
    inviteUserDto: InviteUserDto,
  ) {
    const inviteExists = await this.databaseService.invites.findUnique({
      where: {
        organizationId_email: {
          organizationId,
          email: inviteUserDto.email,
        },
      },
    });

    if (inviteExists) {
      throw new BadRequestException('User has already been invited');
    }

    const invitersInfo = await this.databaseService.users.findUnique({
      where: { id: userId },
      select: { fullname: true, email: true },
    });

    if (!invitersInfo) {
      throw new NotFoundException('Inviter does not exist');
    }

    if (invitersInfo.email === inviteUserDto.email) {
      throw new BadRequestException('You cannot invite yourself');
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
      throw new NotFoundException('Organization does not exist');
    }

    const invitedUsersEmail = inviteUserDto.email;
    const invitedUsersRole = inviteUserDto.role;

    const inviteId = await this.databaseService.invites.create({
      data: {
        organizationId,
        email: invitedUsersEmail,
        inviterId: userId,
        role: invitedUsersRole,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      select: {
        id: true,
      },
    });

    console.log('inviteId', inviteId);

    //FIXME: SEND A MAIL TO THE INVITED USER
    //send a mail to the user stating the role they are being invited for and the person inviting them
    console.log(invitedUsersEmail, invitedUsersRole);

    return { message: 'success' };
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
        inviterId: true,
        role: true,
        status: true,
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
    const cursor = hasNextPage ? invites[invites.length - 1]?.id : undefined;

    return {
      invites: items,
      hasNextPage,
      ...(cursor && { cursor }),
    };
  }

  async deleteInvite(organizationId: string, inviteId: string) {
    const inviteExists = await this.databaseService.invites.findUnique({
      where: { id: inviteId, organizationId },
    });

    if (!inviteExists) {
      return { message: 'success' };
    }

    await this.databaseService.invites.delete({
      where: { id: inviteId, organizationId },
    });

    return { message: 'success' };
  }

  //USER SPECIFIC
  async getOneOrgUser(
    organizationId: string,
    userId: string,
  ): Promise<CachedUser> {
    const { status, data, error } =
      await this.redisService.getFromCache<CachedUser>(
        makeUserCacheKey(organizationId, userId),
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
      makeUserCacheKey(organizationId, userId),
      cachedUser,
      MINUTES_10,
    );

    if (!storeInCache.status) {
      console.error(storeInCache.error);
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

      if (userIsAdmin?.role === 'ADMIN' && updateOrgUserDto.role !== 'ADMIN') {
        const usersThatAreAdmins =
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

        if (!usersThatAreAdmins) {
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
        console.error(error);
      }

      return { message: 'Success' };
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new NotFoundException('User Not Found');
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
      const usersThatAreAdmins =
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

      if (!usersThatAreAdmins) {
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
      console.error(error);
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
      makeProjectCacheKey(organizationId, projectId),
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
      makeProjectCacheKey(orgId, projectId),
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
      makeProjectCacheKey(organizationId, projectId),
    );

    if (!status) {
      console.error(error);
    }

    return { message: 'success' };
  }
}

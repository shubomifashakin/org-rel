import { Injectable, NotFoundException } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { DatabaseService } from '../../core/database/database.service.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { S3Service } from '../../core/s3/s3.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/updateProject.dto.js';
import { RedisService } from '../../core/redis/redis.service.js';
import { cacheKeys } from './utils.js';
import { Organizations, Projects, Users } from 'generated/prisma/client.js';

type CachedUser = Pick<
  Users,
  'id' | 'email' | 'fullname' | 'image' | 'username' | 'organizationId'
>;

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

  async createOrganization(
    createOrganizationDto: CreateOrganizationDto,
    images?: Express.Multer.File[],
  ) {
    let s3Url: string | undefined = undefined;
    let userImageUrl: string | undefined = undefined;

    const orgImage = images?.find((image) => image.fieldname === 'orgImage');
    const userImage = images?.find((image) => image.fieldname === 'userImage');

    if (orgImage) {
      s3Url = await this.uploadToS3(orgImage);
    }

    if (userImage) {
      userImageUrl = await this.uploadToS3(userImage);
    }

    const org = await this.databaseService.organizations.create({
      data: {
        name: createOrganizationDto.name,
        image: s3Url,
        users: {
          create: {
            role: 'ADMIN',
            image: userImageUrl,
            email: createOrganizationDto.user.email,
            fullname: createOrganizationDto.user.fullname,
            username: createOrganizationDto.user.username,
            password: createOrganizationDto.user.password,
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
      .setInCache(`${cacheKeys.ORGANIZATION}${org.id}`, org)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGING
        console.error('Error caching organization in Redis:', error);
      });

    return { message: 'Success' };
  }

  async findAllOrganizations(name?: string) {
    const orgs = await this.databaseService.organizations.findMany({
      where: {
        name: {
          contains: name,
        },
      },
      select: {
        id: true,
        name: true,
        image: true,
      },
    });

    return { organizations: orgs };
  }

  async findOrganization(id: string) {
    const cache = await this.redisService
      .getFromCache<CachedOrg>(`${cacheKeys.ORGANIZATION}${id}`)
      .catch((error) => {
        //FIXME
        console.error(error);
        return null;
      });

    if (cache) {
      return {
        organization: cache,
      };
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
      .setInCache(`${cacheKeys.ORGANIZATION}${organization.id}`, organization)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGING
        console.error('Error caching organization in Redis:', error);
      });

    return { organization };
  }

  async updateOrganization(
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
      .setInCache(`${cacheKeys.ORGANIZATION}${id}`, org)
      .catch((error) => {
        //FIXME
        console.error('Error updating organization in cache:', error);
        return null;
      });

    return { message: 'success' };
  }

  async deleteOrganization(id: string) {
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
      .deleteFromCache(`${cacheKeys.ORGANIZATION}${id}`)
      .catch((error) => {
        //FIXME
        console.error(error);
        return null;
      });

    return { message: 'success' };
  }

  //projects
  async getOrgProjects(id: string) {
    const projects = await this.databaseService.projects.findMany({
      where: { organizationId: id },
      select: {
        id: true,
        name: true,
        image: true,
        userId: true,
      },
    });

    return { projects };
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
      .setInCache(`${cacheKeys.PROJECT}${project.id}`, project)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGING
        console.error('Error caching project in Redis:', error);
      });

    return { message: 'success' };
  }

  async getOneProject(organizationId: string, projectId: string) {
    const cachedProject = await this.redisService
      .getFromCache<CachedProject>(`${cacheKeys.PROJECT}${projectId}`)
      .catch((error) => {
        console.error('Error fetching project from Redis:', error);
        return null;
      });

    if (cachedProject) {
      return {
        project: cachedProject,
      };
    }

    const project = await this.databaseService.projects.findUnique({
      where: { id: projectId, organizationId },
      select: {
        id: true,
        name: true,
        image: true,
        userId: true,
      },
    });

    if (!project) {
      throw new NotFoundException('Project not found');
    }

    await this.redisService
      .setInCache(`${cacheKeys.PROJECT}${project.id}`, project)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGING
        console.error('Error caching project in Redis:', error);
      });

    return { project };
  }

  async updateOrgProject(
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
      .setInCache(`${cacheKeys.PROJECT}${projectId}`, project)
      .catch((error) => {
        //FIXME: IMPLEMENT PROPER ERROR LOGGER
        console.error('Error updating project in Redis:', error);
      });

    return { message: 'success' };
  }

  // organization users
  async createOrgUser(
    organizationId: string,
    createUserDto: CreateUserDto,
    image: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
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

      s3Url = `https://${bucket}.s3.amazonaws.com/${imageKey}`;
    }

    const user = await this.databaseService.users.create({
      data: {
        image: s3Url,
        fullname: createUserDto.fullname,
        email: createUserDto.email,
        organizationId: organizationId,
        username: createUserDto.username,
        role: createUserDto.role,
        password: createUserDto.password,
      },
      select: {
        id: true,
        email: true,
        fullname: true,
        image: true,
        username: true,
        organizationId: true,
      },
    });

    await this.redisService
      .setInCache(`${cacheKeys.USER}${user.id}`, user)
      .catch((error) => {
        //FIXME:
        console.error('Error setting user in cache:', error);
        return null;
      });

    return { message: 'Success' };
  }

  async getOrgUsers(organizationId: string) {
    const users = await this.databaseService.users.findMany({
      where: {
        organizationId,
      },
      select: {
        id: true,
        email: true,
        fullname: true,
        image: true,
        username: true,
        organizationId: true,
      },
    });

    return { users };
  }

  async getOneOrgUser(organizationId: string, userId: string) {
    const cache = await this.redisService
      .getFromCache<CachedUser>(`${cacheKeys.USER}${userId}`)
      .catch((error) => {
        //FIXME:
        console.error('Error fetching user from cache:', error);
        return null;
      });

    if (cache) {
      return {
        user: cache,
      };
    }

    const user = await this.databaseService.users.findUnique({
      where: {
        id: userId,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        fullname: true,
        image: true,
        username: true,
        organizationId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

    await this.redisService
      .setInCache(`${cacheKeys.USER}${userId}`, user)
      .catch((error) => {
        //FIXME:
        console.error('Error fetching user from cache:', error);
        return null;
      });

    return { user };
  }

  async updateOrgUser(
    orgId: string,
    userId: string,
    updateUserDto: UpdateUserDto,
    image?: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
      s3Url = await this.uploadToS3(image);
    }

    const user = await this.databaseService.users.update({
      where: {
        id: userId,
        organizationId: orgId,
      },
      data: {
        image: s3Url,
        fullname: updateUserDto?.fullname,
        email: updateUserDto?.email,
        username: updateUserDto?.username,
      },
      select: {
        id: true,
        email: true,
        fullname: true,
        username: true,
        image: true,
        organizationId: true,
      },
    });

    await this.redisService
      .setInCache(`${cacheKeys.USER}${userId}`, user)
      .catch((error) => {
        //FIXME:
        console.error('Error updating user in cache:', error);
        return null;
      });

    return { message: 'Success' };
  }

  async deleteOrgUser(orgId: string, userId: string) {
    const userExist = await this.databaseService.users.findUnique({
      where: {
        id: userId,
        organizationId: orgId,
      },
    });

    if (!userExist) {
      return { message: 'Success' };
    }

    await this.databaseService.users.delete({
      where: {
        id: userId,
        organizationId: orgId,
      },
    });

    await this.redisService
      .deleteFromCache(`${cacheKeys.USER}${userId}`)
      .catch((error) => {
        //FIXME:
        console.error('Error deleting user from cache:', error);
        return null;
      });

    return { message: 'Success' };
  }

  async deleteOrgProject(organizationId: string, projectId: string) {
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

    return { message: 'success' };
  }
}

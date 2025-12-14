import { Injectable, NotFoundException } from '@nestjs/common';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuid } from 'uuid';

import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { DatabaseService } from '../database/database.service.js';
// import { Organizations, Users } from '../../generated/prisma/client.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { S3Service } from '../s3/s3.service.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/updateProject.dto.js';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly s3Service: S3Service,
    private readonly databaseService: DatabaseService,
  ) {}

  private async uploadToS3(image: Express.Multer.File): Promise<string> {
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
  }

  async createOrganization(
    createOrganizationDto: CreateOrganizationDto,
    image: Express.Multer.File,
  ) {
    let s3Url: string | undefined = undefined;

    if (image) {
      s3Url = await this.uploadToS3(image);
    }

    await this.databaseService.organizations.create({
      data: {
        name: createOrganizationDto.name,
        image: s3Url,
      },
      select: {
        id: true,
        name: true,
        image: true,
      },
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

    await this.databaseService.organizations.update({
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

    return { message: 'success' };
  }

  //projects
  async getOrgProjects(organizationId: string) {
    const projects = await this.databaseService.projects.findMany({
      where: { organizationId },
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

    await this.databaseService.projects.create({
      data: {
        name: createProjectDto.name,
        userId: createProjectDto.userId,
        image: s3Url,
        organizationId,
      },
    });

    return { message: 'success' };
  }

  async getOneProject(organizationId: string, projectId: string) {
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

    await this.databaseService.projects.update({
      where: {
        id: projectId,
        organizationId: orgId,
      },
      data: {
        image: s3Url,
        name: updateProjectDto?.name,
        userId: updateProjectDto?.userId,
      },
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

    await this.databaseService.users.create({
      data: {
        image: s3Url,
        name: createUserDto.name,
        email: createUserDto.email,
        organizationId: organizationId,
        username: createUserDto.username,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        username: true,
        organizationId: true,
      },
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
        name: true,
        image: true,
        username: true,
        organizationId: true,
      },
    });

    return { users };
  }

  async getOneOrgUser(organizationId: string, userId: string) {
    const user = await this.databaseService.users.findUnique({
      where: {
        id: userId,
        organizationId,
      },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        username: true,
        organizationId: true,
      },
    });

    if (!user) {
      throw new NotFoundException('user not found');
    }

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

    await this.databaseService.users.update({
      where: {
        id: userId,
        organizationId: orgId,
      },
      data: {
        image: s3Url,
        name: updateUserDto?.name,
        email: updateUserDto?.email,
        username: updateUserDto?.username,
      },
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

    return { message: 'Success' };
  }
}

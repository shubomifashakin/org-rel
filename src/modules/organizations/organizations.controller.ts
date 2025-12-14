import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ValidationPipe,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { Organizations, Users } from '../../../generated/prisma/client.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { seconds, Throttle } from '@nestjs/throttler';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/updateProject.dto.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only img, png and jpeg files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  createOrganization(
    @UploadedFile() file: Express.Multer.File,
    @Body(ValidationPipe) createOrganizationDto: CreateOrganizationDto,
  ) {
    return this.organizationsService.createOrganization(
      createOrganizationDto,
      file,
    );
  }

  @Get()
  findAllOrganizations(@Query('name') name?: string): Promise<{
    organizations: Pick<Organizations, 'id' | 'name' | 'image'>[];
  }> {
    return this.organizationsService.findAllOrganizations(name);
  }

  @Get(':id')
  findOrganization(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    id: string,
  ): Promise<{ organization: Pick<Organizations, 'id' | 'name' | 'image'> }> {
    return this.organizationsService.findOrganization(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only img, png and jpeg files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  updateOrganization(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    id: string,
    @Body(ValidationPipe) updateOrganizationDto: UpdateOrganizationDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOrganization(
      id,
      updateOrganizationDto,
      file,
    );
  }

  @Delete(':id')
  deleteOrganization(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    id: string,
  ) {
    return this.organizationsService.deleteOrganization(id);
  }

  @Post(':id/users')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only img, png and jpeg files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  createOrgUser(
    @Body(ValidationPipe) createUserDto: CreateUserDto,
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.createOrgUser(
      organizationId,
      createUserDto,
      file,
    );
  }

  @Get(':id/users')
  getOrgUsers(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
  ): Promise<{
    users: Pick<
      Users,
      'id' | 'email' | 'name' | 'image' | 'organizationId' | 'username'
    >[];
  }> {
    return this.organizationsService.getOrgUsers(organizationId);
  }

  @Get(':id/users/:userId')
  getOneOrgUser(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
    @Param(
      'userId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Invalid userId'),
      }),
    )
    userId: string,
  ): Promise<{
    user: Pick<
      Users,
      'id' | 'email' | 'name' | 'image' | 'organizationId' | 'username'
    >;
  }> {
    return this.organizationsService.getOneOrgUser(organizationId, userId);
  }

  @Patch(':id/users/:userId')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only img, png and jpeg files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  updateOrgUser(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
    @Param(
      'userId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Invalid userId'),
      }),
    )
    userId: string,
    @Body(ValidationPipe) updateUserDto: UpdateUserDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOrgUser(
      organizationId,
      userId,
      updateUserDto,
      image,
    );
  }

  @Throttle({ default: { limit: 5, ttl: seconds(30) } })
  @Delete(':id/users/:userId')
  deleteUser(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
    @Param(
      'userId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Invalid userId'),
      }),
    )
    userId: string,
  ): Promise<{ message: string }> {
    return this.organizationsService.deleteOrgUser(organizationId, userId);
  }

  @Get(':id/projects')
  getOrgProjects(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
  ) {
    return this.organizationsService.getOrgProjects(organizationId);
  }

  @Throttle({ default: { limit: 5, ttl: seconds(10) } })
  @Post(':id/projects')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only img, png and jpeg files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  createOrgProject(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
    @Body(ValidationPipe) createProjectDto: CreateProjectDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.createOrgProject(
      organizationId,
      createProjectDto,
      image,
    );
  }

  @Get(':id/projects/:projectId')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only img, png and jpeg files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  getOneProject(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
    @Param(
      'projectId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Invalid projectId'),
      }),
    )
    projectId: string,
  ) {
    return this.organizationsService.getOneProject(organizationId, projectId);
  }

  @Patch(':id/projects/:projectId')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
          return cb(
            new BadRequestException('Only img, png and jpeg files are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  updateOrgProject(
    @Param(
      'id',
      new ParseUUIDPipe({
        exceptionFactory: () =>
          new BadRequestException('Invalid organizationId'),
      }),
    )
    organizationId: string,
    @Param(
      'projectId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Invalid projectId'),
      }),
    )
    projectId: string,
    @Body(ValidationPipe) updateProjectDto: UpdateProjectDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOrgProject(
      organizationId,
      projectId,
      updateProjectDto,
      image,
    );
  }
}

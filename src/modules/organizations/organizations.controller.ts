import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  ParseUUIDPipe,
  HttpCode,
  UploadedFiles,
} from '@nestjs/common';
import {
  FileFieldsInterceptor,
  FileInterceptor,
} from '@nestjs/platform-express';

import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { Organizations, Users } from '../../../generated/prisma/client.js';
import { CreateUserDto } from './dto/create-user.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { seconds, Throttle } from '@nestjs/throttler';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/updateProject.dto.js';
import { ValidateUUID } from './common/decorators/organizations-id-validator.decorator.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  @HttpCode(200)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'orgImage', maxCount: 1 },
        { name: 'userImage', maxCount: 1 },
      ],
      {
        fileFilter: (_, file, cb) => {
          if (!file.mimetype.match(/(jpg|jpeg|png)$/)) {
            return cb(
              new BadRequestException(
                'Only img, png and jpeg files are allowed',
              ),
              false,
            );
          }
          cb(null, true);
        },
      },
    ),
  )
  createOrganization(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @UploadedFiles() images?: Express.Multer.File[],
  ) {
    return this.organizationsService.createOrganization(
      createOrganizationDto,
      images,
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
    @ValidateUUID('id', 'Invalid organization id') id: string,
  ): Promise<{ organization: Pick<Organizations, 'id' | 'name' | 'image'> }> {
    return this.organizationsService.findOrganization(id);
  }

  @Patch(':id')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_, file, cb) => {
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
    @ValidateUUID('id', 'Invalid organization id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
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
    @ValidateUUID('id', 'Invalid organization id') id: string,
  ) {
    return this.organizationsService.deleteOrganization(id);
  }

  @Post(':id/users')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_, file, cb) => {
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
    @Body() createUserDto: CreateUserDto,
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
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
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
  ): Promise<{
    users: Pick<
      Users,
      'id' | 'email' | 'fullname' | 'image' | 'organizationId' | 'username'
    >[];
  }> {
    return this.organizationsService.getOrgUsers(organizationId);
  }

  @Get(':id/users/:userId')
  getOneOrgUser(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
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
      'id' | 'email' | 'fullname' | 'image' | 'organizationId' | 'username'
    >;
  }> {
    return this.organizationsService.getOneOrgUser(organizationId, userId);
  }

  @Patch(':id/users/:userId')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_, file, cb) => {
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
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @Param(
      'userId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Invalid userId'),
      }),
    )
    userId: string,
    @Body() updateUserDto: UpdateUserDto,
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
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
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
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
  ) {
    return this.organizationsService.getOrgProjects(organizationId);
  }

  @Throttle({ default: { limit: 5, ttl: seconds(10) } })
  @Post(':id/projects')
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (_, file, cb) => {
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
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @Body() createProjectDto: CreateProjectDto,
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
      fileFilter: (_, file, cb) => {
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
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
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
      fileFilter: (_, file, cb) => {
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
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @Param(
      'projectId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Invalid projectId'),
      }),
    )
    projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
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

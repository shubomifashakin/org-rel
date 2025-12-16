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
import { ValidateUUID } from './common/decorators/uuid-validator.decorator.js';
import { GetImage } from './common/decorators/get-file.decorator.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post() //create an organization
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

  @Get() //get all orgs
  getOrganizations(@Query('next', ParseUUIDPipe) next?: string): Promise<{
    organizations: Pick<Organizations, 'id' | 'name' | 'image'>[];
    hasNextPage: boolean;
    cursor?: string;
  }> {
    return this.organizationsService.getOrganizations(next);
  }

  @Get(':id') //get a particular org
  getOneOrganization(
    @ValidateUUID('id', 'Invalid organization id') id: string,
  ): Promise<Pick<Organizations, 'id' | 'name' | 'image'>> {
    return this.organizationsService.getOneOrganization(id);
  }

  @Patch(':id') //update an org
  @GetImage()
  updateOneOrganization(
    @ValidateUUID('id', 'Invalid organization id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOneOrganization(
      id,
      updateOrganizationDto,
      image,
    );
  }

  @Delete(':id') //delete an org
  deleteOneOrganization(
    @ValidateUUID('id', 'Invalid organization id') id: string,
  ) {
    return this.organizationsService.deleteOneOrganization(id);
  }

  //USERS
  @Post(':id/users') //create a user in an org
  @GetImage()
  createOrgUser(
    @Body() createUserDto: CreateUserDto,
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.createOrgUser(
      organizationId,
      createUserDto,
      file,
    );
  }

  @Get(':id/users') //get all the users in an org
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

  @Get(':id/users/:userId') //get a user in an org
  getOneOrgUser(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @ValidateUUID('userId', 'Invalid user id') userId: string,
  ): Promise<
    Pick<
      Users,
      'id' | 'email' | 'fullname' | 'image' | 'organizationId' | 'username'
    >
  > {
    return this.organizationsService.getOneOrgUser(organizationId, userId);
  }

  @Patch(':id/users/:userId') //update a user in an org
  @GetImage()
  updateOneOrgUser(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @ValidateUUID('userId', 'Invalid user id') userId: string,
    @Body() updateUserDto: UpdateUserDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOneOrgUser(
      organizationId,
      userId,
      updateUserDto,
      image,
    );
  }

  @Throttle({ default: { limit: 5, ttl: seconds(30) } })
  @Delete(':id/users/:userId') //delete a user in an org
  deleteOneOrgUser(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @ValidateUUID('userId', 'Invalid user id') userId: string,
  ): Promise<{ message: string }> {
    return this.organizationsService.deleteOneOrgUser(organizationId, userId);
  }

  //PROJECTS
  @Get(':id/projects') //get the projects in an org
  getOrgProjects(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
  ) {
    return this.organizationsService.getOrgProjects(organizationId);
  }

  @Throttle({ default: { limit: 5, ttl: seconds(10) } })
  @Post(':id/projects') //create a project in an org
  @GetImage()
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

  @Get(':id/projects/:projectId') //get a project in an org
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

  @Patch(':id/projects/:projectId') //update a project in an org
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

  @Delete(':id/projects/:projectId')
  deleteOrgProject(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @Param(
      'projectId',
      new ParseUUIDPipe({
        exceptionFactory: () => new BadRequestException('Invalid projectId'),
      }),
    )
    projectId: string,
  ) {
    return this.organizationsService.deleteOrgProject(
      organizationId,
      projectId,
    );
  }
}

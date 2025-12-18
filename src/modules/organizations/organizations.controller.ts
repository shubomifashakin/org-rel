import { type Request } from 'express';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  UploadedFile,
  Query,
  ParseUUIDPipe,
  HttpCode,
  UploadedFiles,
  Req,
} from '@nestjs/common';

import { OrganizationsService } from './organizations.service.js';
import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { Organizations, Roles } from '../../../generated/prisma/client.js';
import { UpdateOrgUserDto } from './dto/update-org-user.dto.js';
import { seconds, Throttle } from '@nestjs/throttler';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/updateProject.dto.js';
import { ValidateUUID } from './common/decorators/uuid-validator.decorator.js';
import { GetImage } from './common/decorators/get-file.decorator.js';
import { Projects } from '../../../generated/prisma/client.js';
import { InviteUserDto } from './dto/invite_user.dto.js';
import { UpdateInviteDto } from './dto/update-invite.dto.js';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post() //create an organization
  @HttpCode(200)
  @GetImage()
  createOrganization(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @Req() request: Request,
    @UploadedFiles() image?: Express.Multer.File,
  ) {
    return this.organizationsService.createOrganization(
      createOrganizationDto,
      request.user.id,
      image,
    );
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
  @Get(':id/users') //get all the users in an org
  getOrgUsers(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @Query('next', ParseUUIDPipe) next?: string,
  ): Promise<{
    cursor?: string;
    hasNextPage: boolean;
    users: Array<{
      role: Roles;
      id: string;
      image: string | null;
      email: string;
      username: string;
      fullname: string;
    }>;
  }> {
    return this.organizationsService.getOrgUsers(organizationId, next);
  }

  //USERS / INVITES
  @Post(':id/users/invites')
  inviteOneUser(
    @Req() req: Request,
    @ValidateUUID('id', 'Invalid organization id') id: string,
    @Body() inviteUserDto: InviteUserDto,
  ) {
    return this.organizationsService.inviteOneUser(
      req.user.id,
      id,
      inviteUserDto,
    );
  }

  @Get(':id/users/invites')
  getAllInvites(
    @ValidateUUID('id', 'Invalid organization id') id: string,
    @Query('next', ParseUUIDPipe) next?: string,
  ) {
    return this.organizationsService.getAllInvites(id, next);
  }

  @Post(':id/users/invites/:inviteId')
  updateInvite(
    @ValidateUUID('id', 'Invalid organization id') orgId: string,
    @ValidateUUID('inviteId', 'Invalid invite id') inviteId: string,
    @Body() updateInviteDto: UpdateInviteDto,
  ) {
    return this.organizationsService.updateInvite(
      orgId,
      inviteId,
      updateInviteDto,
    );
  }

  //USERS / USERID

  @Get(':id/users/:userId') //get a user in an org
  getOneOrgUser(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @ValidateUUID('userId', 'Invalid user id') userId: string,
  ) {
    return this.organizationsService.getOneOrgUser(organizationId, userId);
  }

  @Patch(':id/users/:userId') //update a user in an org
  updateOneOrgUser(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @ValidateUUID('userId', 'Invalid user id') userId: string,
    @Body() updateOrgUserDto: UpdateOrgUserDto,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOneOrgUser(
      organizationId,
      userId,
      updateOrgUserDto,
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
    @Query('next', ParseUUIDPipe) next?: string,
  ): Promise<{
    projects: Pick<
      Projects,
      'id' | 'name' | 'image' | 'userId' | 'organizationId'
    >[];
    hasNextPage: boolean;
    cursor?: string;
  }> {
    return this.organizationsService.getOrgProjects(organizationId, next);
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
  getOneOrgProject(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @ValidateUUID('projectId', 'Invalid project id') projectId: string,
  ) {
    return this.organizationsService.getOneOrgProject(
      organizationId,
      projectId,
    );
  }

  @Patch(':id/projects/:projectId') //update a project in an org
  @GetImage()
  updateOneOrgProject(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @ValidateUUID('projectId', 'Invalid project id') projectId: string,
    @Body() updateProjectDto: UpdateProjectDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOneOrgProject(
      organizationId,
      projectId,
      updateProjectDto,
      image,
    );
  }

  @Delete(':id/projects/:projectId')
  deleteOneOrgProject(
    @ValidateUUID('id', 'Invalid organization id') organizationId: string,
    @ValidateUUID('projectId', 'Invalid project id') projectId: string,
  ) {
    return this.organizationsService.deleteOneOrgProject(
      organizationId,
      projectId,
    );
  }
}

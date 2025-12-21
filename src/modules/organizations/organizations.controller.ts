import { type Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  UploadedFile,
  HttpCode,
  Req,
  UseGuards,
} from '@nestjs/common';

import { OrganizationsService } from './organizations.service.js';

import { NeedsRoles } from './common/decorators/role.decorator.js';
import { ValidateUUID } from './common/decorators/uuid-validator.decorator.js';
import { ValidateUUIDQueryParam } from './common/decorators/query-validator.decorator.js';

import { CreateOrganizationDto } from './dto/create-organization.dto.js';
import { UpdateOrganizationDto } from './dto/update-organization.dto.js';
import { UpdateOrgUserDto } from './dto/update-org-user.dto.js';
import { CreateProjectDto } from './dto/create-project.dto.js';
import { UpdateProjectDto } from './dto/update-project.dto.js';
import { InviteUserDto } from './dto/invite-user.dto.js';
import { UpdateInviteDto } from './dto/update-invite.dto.js';

import { Organizations } from '../../../generated/prisma/client.js';
import { Projects } from '../../../generated/prisma/client.js';
import { GetImage } from '../../common/decorators/get-image.decorator.js';
import { UserAuthGuard } from '../../common/guards/user-auth.guard.js';
import { RolesGuard } from './common/guards/role.guard.js';
import { IsMemberGuard } from './common/guards/is-member.guard.js';
import { CachedUser } from './types/index.js';

@Controller('organizations')
@UseGuards(UserAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post() //create an organization
  @HttpCode(200)
  @GetImage()
  createOrganization(
    @Body() createOrganizationDto: CreateOrganizationDto,
    @Req() request: Request,
    @UploadedFile() image?: Express.Multer.File,
  ) {
    return this.organizationsService.createOrganization(
      createOrganizationDto,
      request.user.id,
      image,
    );
  }

  @Get(':organizationId') //get a particular org
  @UseGuards(IsMemberGuard)
  getOneOrganization(
    @ValidateUUID('organizationId', 'Invalid organization id') id: string,
  ): Promise<Pick<Organizations, 'id' | 'name' | 'image'>> {
    return this.organizationsService.getOneOrganization(id);
  }

  @Patch(':organizationId') //update an org
  @UseGuards(IsMemberGuard, RolesGuard)
  @NeedsRoles('ADMIN')
  @GetImage()
  updateOneOrganization(
    @ValidateUUID('organizationId', 'Invalid organization id') id: string,
    @Body() updateOrganizationDto: UpdateOrganizationDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOneOrganization(
      id,
      updateOrganizationDto,
      image,
    );
  }

  @Delete(':organizationId') //delete an org
  @UseGuards(IsMemberGuard, RolesGuard)
  @NeedsRoles('ADMIN')
  deleteOneOrganization(
    @ValidateUUID('organizationId', 'Invalid organization id') id: string,
  ) {
    return this.organizationsService.deleteOneOrganization(id);
  }

  //USERS
  @Get(':organizationId/users') //get all the users in an org
  @UseGuards(IsMemberGuard)
  getOrgUsers(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
    @ValidateUUIDQueryParam('next', null, true) next?: string,
  ): Promise<{
    cursor?: string;
    hasNextPage: boolean;
    users: Array<CachedUser>;
  }> {
    return this.organizationsService.getOrgUsers(organizationId, next);
  }

  //USERS / INVITES
  @Post(':organizationId/users/invites') //send an invite to a user
  @UseGuards(IsMemberGuard, RolesGuard)
  @NeedsRoles('ADMIN')
  inviteOneUser(
    @Req() req: Request,
    @ValidateUUID('organizationId', 'Invalid organization id') id: string,
    @Body() inviteUserDto: InviteUserDto,
  ) {
    return this.organizationsService.inviteOneUser(
      req.user.id,
      id,
      inviteUserDto,
    );
  }

  @Get(':organizationId/users/invites') //get all invites that have been sent out
  @UseGuards(IsMemberGuard)
  getAllInvites(
    @ValidateUUID('organizationId', 'Invalid organization id') id: string,
    @ValidateUUIDQueryParam('next', null, true) next?: string,
  ) {
    return this.organizationsService.getAllInvites(id, next);
  }

  @Post(':organizationId/users/invites/:inviteId')
  @UseGuards(IsMemberGuard)
  updateInvite(
    @ValidateUUID('organizationId', 'Invalid organization id') orgId: string,
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
  @Get(':organizationId/users/:userId') //get a user in an org
  @UseGuards(IsMemberGuard)
  getOneOrgUser(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
    @ValidateUUID('userId', 'Invalid user id') userId: string,
  ) {
    return this.organizationsService.getOneOrgUser(organizationId, userId);
  }

  @Patch(':organizationId/users/:userId') //update a user in an org
  @UseGuards(IsMemberGuard, RolesGuard)
  @NeedsRoles('ADMIN')
  updateOneOrgUser(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
    @ValidateUUID('userId', 'Invalid user id') userId: string,
    @Body() updateOrgUserDto: UpdateOrgUserDto,
  ): Promise<{ message: string }> {
    return this.organizationsService.updateOneOrgUser(
      organizationId,
      userId,
      updateOrgUserDto,
    );
  }

  @Throttle({ default: { limit: 5, ttl: 30 } })
  @Delete(':organizationId/users/:userId') //delete a user in an org
  @UseGuards(IsMemberGuard, RolesGuard)
  @NeedsRoles('ADMIN')
  deleteOneOrgUser(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
    @ValidateUUID('userId', 'Invalid user id') userId: string,
  ): Promise<{ message: string }> {
    return this.organizationsService.deleteOneOrgUser(organizationId, userId);
  }

  //PROJECTS
  @Get(':organizationId/projects') //get the projects in an org
  @UseGuards(IsMemberGuard)
  getOrgProjects(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
    @ValidateUUIDQueryParam('next', null, true) next?: string,
  ): Promise<{
    projects: Pick<
      Projects,
      'id' | 'name' | 'image' | 'userId' | 'organizationId'
    >[];
    hasNextPage: boolean;
    cursor?: string;
  }> {
    return this.organizationsService.getAllOrgProjects(organizationId, next);
  }

  @Throttle({ default: { limit: 5, ttl: 10 } })
  @Post(':organizationId/projects') //create a project in an org
  @UseGuards(IsMemberGuard)
  @GetImage()
  createOrgProject(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
    @Body() createProjectDto: CreateProjectDto,
    @UploadedFile() image?: Express.Multer.File,
  ): Promise<{ id: string }> {
    return this.organizationsService.createOrgProject(
      organizationId,
      createProjectDto,
      image,
    );
  }

  @Get(':organizationId/projects/:projectId') //get a project in an org
  @UseGuards(IsMemberGuard)
  getOneOrgProject(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
    @ValidateUUID('projectId', 'Invalid project id') projectId: string,
  ) {
    return this.organizationsService.getOneOrgProject(
      organizationId,
      projectId,
    );
  }

  @Patch(':organizationId/projects/:projectId') //update a project in an org
  @UseGuards(IsMemberGuard, RolesGuard)
  @NeedsRoles('ADMIN')
  @GetImage()
  updateOneOrgProject(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
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

  @Delete(':organizationId/projects/:projectId') //delete a project in an org
  @UseGuards(IsMemberGuard, RolesGuard)
  @NeedsRoles('ADMIN')
  deleteOneOrgProject(
    @ValidateUUID('organizationId', 'Invalid organization id')
    organizationId: string,
    @ValidateUUID('projectId', 'Invalid project id') projectId: string,
  ) {
    return this.organizationsService.deleteOneOrgProject(
      organizationId,
      projectId,
    );
  }
}

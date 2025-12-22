import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import env from '../../../core/serverEnv/index.js';
import { DatabaseService } from '../../../core/database/database.service.js';
import { MailerService } from '../../../core/mailer/mailer.service.js';
import { InviteUserDto } from './../dto/invite-user.dto.js';
import { generateInviteMail } from '../common/utils.js';

@Injectable()
export class OrganizationsInviteService {
  constructor(
    private readonly databaseService: DatabaseService,
    private readonly mailerService: MailerService,
  ) {}

  async inviteOneUser(
    userId: string,
    organizationId: string,
    inviteUserDto: InviteUserDto,
  ) {
    const inviteAlreadyExistsForUser =
      await this.databaseService.invites.findUnique({
        where: {
          organizationId_email: {
            organizationId,
            email: inviteUserDto.email,
          },
        },
      });

    if (inviteAlreadyExistsForUser) {
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

    const organizationInfo =
      await this.databaseService.organizations.findUnique({
        where: {
          id: organizationId,
        },
        select: {
          name: true,
        },
      });

    if (!organizationInfo) {
      throw new NotFoundException('Organization does not exist');
    }

    const invitedUsersEmail = inviteUserDto.email;
    const invitedUsersRole = inviteUserDto.role;

    const inviteInfo = await this.databaseService.invites.create({
      data: {
        organizationId,
        email: invitedUsersEmail,
        inviterId: userId,
        role: invitedUsersRole,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      },
      select: {
        id: true,
        role: true,
        expiresAt: true,
      },
    });

    const { error } = await this.mailerService.emails.send({
      from: env.MAILER_FROM,
      to: invitedUsersEmail,
      subject: `Invitation to join ${organizationInfo.name}`,
      html: generateInviteMail({
        role: inviteInfo.role,
        inviteId: inviteInfo.id,
        expiresAt: inviteInfo.expiresAt,
        invitersName: invitersInfo.fullname,
        organizationsName: organizationInfo.name,
      }),
    });

    if (error) {
      console.error(
        `Failed to send invite mail to user: ${invitedUsersEmail}`,
        error.message,
      );
    }

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
}

import { IsEnum } from 'class-validator';
import { InviteStatus } from '../../../../generated/prisma/enums.js';

export class UpdateInviteDto {
  @IsEnum(InviteStatus, { message: 'Invalid invite status' })
  status: InviteStatus;
}

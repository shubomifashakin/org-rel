import { IsEnum } from 'class-validator';
import { Roles } from '../../../../generated/prisma/client.js';

export class UpdateOrgUserDto {
  @IsEnum(Roles, { message: 'Invalid role' })
  role: Roles;
}

import { IsEmail, IsEnum } from 'class-validator';
import { Roles } from '../../../../generated/prisma/enums.js';

export class InviteUserDto {
  @IsEmail({}, { message: 'Invalid email' })
  email: string;

  @IsEnum(Roles, { message: 'Invalid role' })
  role: Roles;
}

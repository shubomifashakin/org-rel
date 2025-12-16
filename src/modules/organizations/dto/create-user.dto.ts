import {
  IsDefined,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  IsStrongPassword,
} from 'class-validator';
import { Roles, Users } from '../../../../generated/prisma/client.js';

export class CreateUserDto implements Pick<
  Users,
  'fullname' | 'email' | 'username'
> {
  @IsNotEmpty({ message: 'name is required' })
  @IsString({ message: 'Invalid name' })
  fullname: string;

  @IsEmail()
  email: string;

  @IsString({ message: 'Invalid username' })
  @IsNotEmpty({ message: 'username is required' })
  username: string;

  @IsStrongPassword(
    {
      minLength: 8,
      minSymbols: 1,
      minNumbers: 1,
      minLowercase: 1,
      minUppercase: 1,
    },
    {
      message:
        'Password should must be at least 8 characters long and contain 1, lowercase, uppercase, number and symbol',
    },
  )
  password: string;

  @IsDefined({ message: 'users role must be specified' })
  @IsEnum(Roles, { message: 'Invalid role' })
  role: Roles;
}

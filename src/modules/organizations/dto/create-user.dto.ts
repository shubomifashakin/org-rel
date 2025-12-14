import { IsEmail, IsNotEmpty, IsString } from 'class-validator';
import { Users } from '../../../../generated/prisma/client.js';

export class CreateUserDto implements Pick<
  Users,
  'name' | 'email' | 'username'
> {
  @IsNotEmpty({ message: 'name is required' })
  @IsString({ message: 'Invalid name' })
  name: string;

  @IsEmail()
  email: string;

  @IsString({ message: 'Invalid username' })
  @IsNotEmpty({ message: 'username is required' })
  username: string;
}

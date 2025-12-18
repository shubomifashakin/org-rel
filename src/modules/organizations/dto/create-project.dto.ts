import { IsNotEmpty, IsString, IsUUID, MinLength } from 'class-validator';
import { Projects } from '../../../../generated/prisma/client.js';

export class CreateProjectDto implements Pick<Projects, 'name' | 'userId'> {
  @IsString({ message: 'Invalid Project name' })
  @IsNotEmpty({ message: 'Project Name is required' })
  @MinLength(3, { message: 'Project Name is too short' })
  name: string;

  @IsUUID(4, { message: 'invalid userId' })
  userId: string;
}

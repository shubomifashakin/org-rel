import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { Projects } from '../../../generated/prisma/client.js';

export class CreateProjectDto implements Pick<Projects, 'name' | 'userId'> {
  @IsString({ message: 'Invalid project name' })
  @IsNotEmpty({ message: 'project name is required' })
  name: string;

  @IsUUID(4, { message: 'invalid userId' })
  userId: string;
}

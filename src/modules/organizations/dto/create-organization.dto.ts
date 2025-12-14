import { IsNotEmpty, IsString } from 'class-validator';
import { OrganizationsCreateInput } from '../../../../generated/prisma/models.js';

export class CreateOrganizationDto implements OrganizationsCreateInput {
  @IsNotEmpty({ message: 'Name is required' })
  @IsString({ message: 'Invalid Name' })
  name: string;
}

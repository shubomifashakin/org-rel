import { SetMetadata } from '@nestjs/common';
import { Roles } from '../../../../../generated/prisma/client';

export const ROLES_KEY = 'roles';

export function NeedsRoles(...roles: Roles[]) {
  return SetMetadata(ROLES_KEY, roles);
}

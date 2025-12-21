import { Roles } from '../../../../generated/prisma/enums.js';

export type CachedUser = {
  id: string;
  email: string;
  fullname: string;
  image: string | null;
  username: string;
  role: Roles;
};

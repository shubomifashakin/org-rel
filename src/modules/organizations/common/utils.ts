import { Roles } from '../../../../generated/prisma/enums.js';

export const cacheKeys = {
  ORGANIZATION: 'organization:',
  PROJECT: 'project:',
  USER: 'user:',
};

export function makeUserCacheKey(organizationId: string, userId: string) {
  return `${cacheKeys.ORGANIZATION}${organizationId}:${cacheKeys.USER}${userId}`;
}

export function makeProjectCacheKey(organizationId: string, projectId: string) {
  return `${cacheKeys.ORGANIZATION}${organizationId}:${cacheKeys.PROJECT}${projectId}`;
}

export function makeOrganizationCacheKey(organizationId: string) {
  return `${cacheKeys.ORGANIZATION}${organizationId}`;
}

//FIXME: IMPLEMENT THIS
export function generateInviteMail({
  role,
  inviteId,
  expiresAt,
  invitersName,
  organizationsName,
}: {
  role: Roles;
  expiresAt: Date;
  inviteId: string;
  invitersName: string;
  organizationsName: string;
}) {
  console.log(invitersName, organizationsName, inviteId, expiresAt, role);
  return '';
}
